// src/app/api/admin/dashboard/answer-distribution/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

/** Asia/Manila helpers */
const MANILA_TZ = "+08:00";
function parseYMDToUTC(ymd: string): Date {
  // Interpret YYYY-MM-DD at Manila midnight, then create a UTC Date from it.
  // Example: "2025-09-01T00:00:00+08:00" → Date(UTC)
  return new Date(`${ymd}T00:00:00${MANILA_TZ}`);
}
function addDays(d: Date, n: number): Date {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t;
}
function toMySQLDateTimeUTC(d: Date): string {
  // "YYYY-MM-DD HH:MM:SS" in UTC
  const iso = d.toISOString();
  return iso.slice(0, 19).replace("T", " ");
}
function todayManilaYMD(): string {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const y = nowPH.getFullYear();
  const m = String(nowPH.getMonth() + 1).padStart(2, "0");
  const dd = String(nowPH.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function computeFromToFromRange(range: "7d" | "30d" | "90d"): { from: string; to: string } {
  const to = todayManilaYMD();
  const n = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  // inclusive window: start = end − (N−1)
  const toStart = parseYMDToUTC(to); // Manila midnight of "to"
  const fromUtc = addDays(toStart, -(n - 1));
  const y = fromUtc.getUTCFullYear();
  const m = String(fromUtc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fromUtc.getUTCDate()).padStart(2, "0");
  return { from: `${y}-${m}-${d}`, to };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = url.searchParams.get("range") as "7d" | "30d" | "90d" | null;
  let from = url.searchParams.get("from") || undefined;
  let to = url.searchParams.get("to") || undefined;

  if (range && (!from || !to)) {
    const w = computeFromToFromRange(range);
    from = w.from;
    to = w.to;
  }
  if (!from || !to) {
    // default to Last 30 days (inclusive) in Manila
    const w = computeFromToFromRange("30d");
    from = w.from;
    to = w.to;
  }

  try {
    const pool = getPool();

    // Window [from, to+1d) in Manila → UTC
    const startUtc = parseYMDToUTC(from);
    const endUtc = parseYMDToUTC(to);
    const endExclusiveUtc = addDays(endUtc, 1);
    const startStr = toMySQLDateTimeUTC(startUtc);
    const endStr = toMySQLDateTimeUTC(endExclusiveUtc);

    // Latest PUBLISHED survey
    const [surveyRows] = (await pool.query(
      `SELECT id, title, version, published_at
       FROM surveys
       WHERE status='PUBLISHED'
       ORDER BY published_at DESC, version DESC
       LIMIT 1`
    )) as any[];

    const survey = surveyRows?.[0] ?? null;
    if (!survey) {
      return NextResponse.json(
        { period: { from, to }, survey: null, questions: [] },
        { status: 200 }
      );
    }

    // LIKERT / YES_NO questions (ordered) — includes question_key
    const [qRows] = (await pool.query(
      `SELECT q.id, q.prompt, q.question_type, q.question_key
       FROM questions q
       WHERE q.survey_id = ? AND q.question_type IN ('LIKERT','YES_NO')
       ORDER BY q.display_order`,
      [survey.id]
    )) as any[];

    if (!qRows?.length) {
      return NextResponse.json(
        { period: { from, to }, survey, questions: [] },
        { status: 200 }
      );
    }

    // Counts by option (answered only)
    const [optCounts] = (await pool.query(
      `SELECT a.question_id           AS question_id,
              LOWER(qo.option_value)  AS opt,
              COUNT(*)                AS cnt
       FROM submissions s
       JOIN answers a           ON a.submission_id = s.id
       JOIN questions q         ON q.id = a.question_id
       LEFT JOIN question_options qo ON qo.id = a.option_id
       WHERE s.survey_id = ?
         AND q.question_type IN ('LIKERT','YES_NO')
         AND a.option_id IS NOT NULL
         AND s.submitted_at >= ?
         AND s.submitted_at <  ?
       GROUP BY a.question_id, LOWER(qo.option_value)`,
      [survey.id, startStr, endStr]
    )) as any[];

    // Denominators per question (answered rows)
    const [denRows] = (await pool.query(
      `SELECT a.question_id AS question_id, COUNT(*) AS answered
       FROM submissions s
       JOIN answers a   ON a.submission_id = s.id
       JOIN questions q ON q.id = a.question_id
       WHERE s.survey_id = ?
         AND q.question_type IN ('LIKERT','YES_NO')
         AND a.option_id IS NOT NULL
         AND s.submitted_at >= ?
         AND s.submitted_at <  ?
       GROUP BY a.question_id`,
      [survey.id, startStr, endStr]
    )) as any[];

    const answeredMap = new Map<number, number>();
    for (const r of denRows) answeredMap.set(Number(r.question_id), Number(r.answered));

    // Tally per question
    const byQ: Record<number, Record<string, number>> = {};
    for (const r of optCounts) {
      const qid = Number(r.question_id);
      const opt: string = String(r.opt ?? "");
      const cnt = Number(r.cnt) || 0;
      const key = opt === "yes" ? "Yes" : opt === "no" ? "No" : opt; // likert "1".."4"
      byQ[qid] ||= {};
      byQ[qid][key] = (byQ[qid][key] ?? 0) + cnt;
    }

    // Build final list in display order; convert to percents
    const out = qRows.map((q: any) => {
      const id = Number(q.id);
      const type = q.question_type as "LIKERT" | "YES_NO";
      const answered = answeredMap.get(id) ?? 0;

      const stableKeys = type === "LIKERT" ? ["1", "2", "3", "4"] : ["No", "Yes"];
      const raw = byQ[id] ?? {};
      const segments: Record<string, number> = {};

      if (answered > 0) {
        for (const k of stableKeys) {
          const v = Number(raw[k] ?? 0);
          segments[k] = (v / answered) * 100;
        }
      } else {
        for (const k of stableKeys) segments[k] = 0;
      }

      return {
        id,
        prompt: q.prompt as string,
        key: q.question_key as string, // ← short label for X-axis
        type,
        segments,
        answered,
      };
    });

    return NextResponse.json(
      { period: { from, to }, survey, questions: out },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("/answer-distribution error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
