import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";
const MANILA_TZ = "+08:00";

/* ---------- Time helpers ---------- */
function phStartToUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${MANILA_TZ}`);
}
function toMySQLDateTimeUTC(d: Date): string {
  const iso = d.toISOString();
  return iso.slice(0, 19).replace("T", " ");
}
function todayStartPH(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}
function lastNDaysPH(n: number) {
  const endPH = todayStartPH();
  const startPH = new Date(endPH);
  startPH.setDate(startPH.getDate() - (n - 1));
  return { startPH, endPH };
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysInclusive(fromYMD: string, toYMD: string) {
  const f = new Date(`${fromYMD}T00:00:00${MANILA_TZ}`);
  const t = new Date(`${toYMD}T00:00:00${MANILA_TZ}`);
  return Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
}

/* ---------- Window from URL (same technique as composite) ---------- */
function computeWindow(params: URLSearchParams) {
  const range = params.get("range");
  let from = params.get("from");
  let to = params.get("to");

  if (!from || !to) {
    if (range === "7d" || range === "30d" || range === "90d") {
      const n = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const { startPH, endPH } = lastNDaysPH(n);
      from = ymd(startPH);
      to = ymd(endPH);
    }
  }
  if (!from || !to) {
    const { startPH, endPH } = lastNDaysPH(30);
    from = ymd(startPH);
    to = ymd(endPH);
  }

  const fromUTC = phStartToUTC(from);
  const toPlus1PH = phStartToUTC(to);
  toPlus1PH.setDate(toPlus1PH.getDate() + 1);

  return {
    from,
    to,
    FROM_UTC: toMySQLDateTimeUTC(fromUTC),
    TO_PLUS_1D_UTC: toMySQLDateTimeUTC(toPlus1PH),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  // prior window: same length right before `from`
  const lenDays = daysInclusive(from, to);
  const fromPH = new Date(`${from}T00:00:00${MANILA_TZ}`);
  const prevStartPH = new Date(fromPH);
  prevStartPH.setDate(prevStartPH.getDate() - lenDays);
  const prevEndPH = new Date(fromPH);
  prevEndPH.setDate(prevEndPH.getDate() - 1);

  const PREV_FROM_UTC = toMySQLDateTimeUTC(phStartToUTC(ymd(prevStartPH)));
  const PREV_TO_PLUS_1D_UTC = toMySQLDateTimeUTC(
    (() => { const d = phStartToUTC(ymd(prevEndPH)); d.setDate(d.getDate() + 1); return d; })()
  );

  const pool = getPool();

  try {
    // latest PUBLISHED survey
    const [surveyRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, version
       FROM surveys
       WHERE status='PUBLISHED'
       ORDER BY COALESCE(published_at, created_at) DESC, version DESC
       LIMIT 1`
    );
    const latest = surveyRows[0] as { id: number; title: string; version: number } | undefined;
    if (!latest) {
      return NextResponse.json(
        { window: { from, to }, survey: null, rows: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Current window stats
    const [curr] = await pool.query<RowDataPacket[]>(
      `
      WITH c AS (
        SELECT
          q.id AS question_id,
          q.display_order,
          q.question_key,
          q.prompt,
          q.question_type,
          q.required,
          sv.title AS survey_title,
          sv.version AS survey_version,

          COUNT(a.id) AS answers_total,

          SUM(CASE
            WHEN q.question_type IN ('LIKERT','YES_NO') AND a.option_id IS NOT NULL THEN 1 ELSE 0
          END) AS answered_choice,

          SUM(CASE
            WHEN q.question_type='LIKERT' AND CAST(o.option_value AS UNSIGNED) IN (3,4) THEN 1
            WHEN q.question_type='YES_NO' AND UPPER(o.option_value)='YES' THEN 1
            ELSE 0
          END) AS positive_count,

          SUM(CASE
            WHEN q.question_type='LIKERT' AND CAST(o.option_value AS UNSIGNED) IN (1,2) THEN 1
            WHEN q.question_type='YES_NO' AND UPPER(o.option_value)='NO' THEN 1
            ELSE 0
          END) AS negative_count,

          CASE
            WHEN q.prompt IS NULL OR TRIM(q.prompt) = '' THEN NULL
            ELSE (LENGTH(TRIM(q.prompt)) - LENGTH(REPLACE(TRIM(q.prompt), ' ', '')) + 1)
          END AS words
        FROM questions q
        JOIN surveys sv ON sv.id = q.survey_id
        LEFT JOIN answers a          ON a.question_id = q.id
        LEFT JOIN submissions s      ON s.id = a.submission_id
             AND s.submitted_at >= ? AND s.submitted_at < ?
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE q.survey_id = ?
        GROUP BY q.id
      )
      SELECT
        question_id, display_order, question_key, prompt, question_type, required,
        survey_title, survey_version, answers_total, answered_choice, positive_count, negative_count, words
      FROM c
      ORDER BY display_order ASC, question_key ASC
      `,
      [FROM_UTC, TO_PLUS_1D_UTC, latest.id]
    );

    // Prior window stats for delta
    const [prev] = await pool.query<RowDataPacket[]>(
      `
      WITH p AS (
        SELECT
          q.id AS question_id,
          SUM(CASE
            WHEN q.question_type IN ('LIKERT','YES_NO') AND a.option_id IS NOT NULL THEN 1 ELSE 0
          END) AS answered_choice,
          SUM(CASE
            WHEN q.question_type='LIKERT' AND CAST(o.option_value AS UNSIGNED) IN (3,4) THEN 1
            WHEN q.question_type='YES_NO' AND UPPER(o.option_value)='YES' THEN 1
            ELSE 0
          END) AS positive_count
        FROM questions q
        LEFT JOIN answers a          ON a.question_id = q.id
        LEFT JOIN submissions s      ON s.id = a.submission_id
             AND s.submitted_at >= ? AND s.submitted_at < ?
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE q.survey_id = ?
        GROUP BY q.id
      )
      SELECT question_id, answered_choice, positive_count
      FROM p
      `,
      [PREV_FROM_UTC, PREV_TO_PLUS_1D_UTC, latest.id]
    );

    const prevMap = new Map<number, { answered_choice: number; positive_count: number }>();
    for (const r of prev) {
      prevMap.set(Number(r.question_id), {
        answered_choice: Number(r.answered_choice ?? 0),
        positive_count: Number(r.positive_count ?? 0),
      });
    }

    // Build response rows
    type ApiRow = {
      question_key: string;
      type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
      required: boolean;
      answers: number;
      positive_pct: number | null;
      negative_pct: number | null;
      net_score: number | null;
      top2_pct: number | null;
      last_30d_delta: number | null;
      display_order: number | null;
      prompt: string | null;
      words: number | null;
      survey_version: number;
      survey_title: string;
      stat_window_end: string;
    };

    const rows: ApiRow[] = (curr as RowDataPacket[]).map((r) => {
      const type = String(r.question_type) as ApiRow["type"];
      const denom = Number(r.answered_choice ?? 0);
      const pos = Number(r.positive_count ?? 0);
      const neg = Number(r.negative_count ?? 0);

      const positive_pct = denom > 0 ? Number(((pos * 100) / denom).toFixed(1)) : null;
      const negative_pct = denom > 0 ? Number(((neg * 100) / denom).toFixed(1)) : null;
      const net_score =
        positive_pct !== null && negative_pct !== null ? Number((positive_pct - negative_pct).toFixed(1)) : null;
      const top2_pct = type === "LIKERT" ? positive_pct : null;

      const prior = prevMap.get(Number(r.question_id));
      const priorDen = Number(prior?.answered_choice ?? 0);
      const priorPos = Number(prior?.positive_count ?? 0);
      const priorPct = priorDen > 0 ? Number(((priorPos * 100) / priorDen).toFixed(1)) : null;

      const last_30d_delta =
        positive_pct !== null && priorPct !== null ? Number((positive_pct - priorPct).toFixed(1)) : null;

      return {
        question_key: String(r.question_key),
        type,
        required: Number(r.required) === 1,
        answers: Number(r.answers_total ?? 0),
        positive_pct,
        negative_pct,
        net_score,
        top2_pct,
        last_30d_delta,
        display_order: r.display_order != null ? Number(r.display_order) : null,
        prompt: r.prompt ? String(r.prompt) : null,
        words: r.words != null ? Number(r.words) : null,
        survey_version: Number(r.survey_version),
        survey_title: String(r.survey_title),
        stat_window_end: phStartToUTC(to).toISOString(),
      };
    });

    return NextResponse.json(
      {
        window: { from, to },
        survey: { id: latest.id, title: latest.title, version: latest.version },
        rows,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "production") {
      const msg = (err as { message?: string } | null)?.message ?? String(err);
      return NextResponse.json({ error: "QueryError", message: msg }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
