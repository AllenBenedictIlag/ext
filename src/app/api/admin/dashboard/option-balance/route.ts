import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

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

/* ---------- Window from URL ---------- */
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

/* ---------- Utils ---------- */
function toPctParts(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  // round to 1 decimal, then force sum to 100.0 by adjusting the largest
  const raw = counts.map((c) => (c / total) * 100);
  const rounded = raw.map((v) => Math.round(v * 10) / 10);
  const diff = 100 - rounded.reduce((a, b) => Math.round((a + b) * 10) / 10, 0);
  if (Math.abs(diff) >= 0.1) {
    const i = raw.indexOf(Math.max(...raw));
    rounded[i] = Math.round((rounded[i] + diff) * 10) / 10;
  }
  return rounded;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const allSurveys = url.searchParams.get("allSurveys") === "1";
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const pool = getPool();

  try {
    // Latest PUBLISHED survey id (unless allSurveys=1)
    let latestId: number | null = null;
    if (!allSurveys) {
      const [pubRows] = await pool.query(
        `SELECT id
         FROM surveys
         WHERE status='PUBLISHED'
         ORDER BY COALESCE(published_at, created_at) DESC, version DESC
         LIMIT 1`
      ) as any;
      latestId = pubRows?.[0]?.id ?? null;
    }
    const surveyFilter = !allSurveys && latestId != null ? "AND s.survey_id = ?" : "";

    /* ---------- LIKERT buckets 1..4 ---------- */
    const likertSql = `
      SELECT t.bucket AS bucket, COUNT(*) AS cnt
      FROM (
        SELECT
          CASE
            WHEN q.question_type <> 'LIKERT' THEN NULL
            WHEN CAST(o.option_value AS UNSIGNED) BETWEEN 1 AND 4
              THEN CAST(o.option_value AS UNSIGNED)
            WHEN LOWER(o.label) IN ('extremely dissatisfied','1') THEN 1
            WHEN LOWER(o.label) IN ('dissatisfied','2') THEN 2
            WHEN LOWER(o.label) IN ('satisfied','3') THEN 3
            WHEN LOWER(o.label) IN ('extremely satisfied','4') THEN 4
            ELSE NULL
          END AS bucket
        FROM submissions s
        JOIN answers a               ON a.submission_id = s.id
        JOIN questions q             ON q.id = a.question_id
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE a.option_id IS NOT NULL
          AND q.question_type = 'LIKERT'
          AND s.submitted_at >= ?
          AND s.submitted_at <  ?
          ${surveyFilter}
      ) AS t
      WHERE t.bucket IS NOT NULL
      GROUP BY t.bucket
    `;

    const likertParams: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) likertParams.push(latestId);

    const [likertRows] = await pool.query(likertSql, likertParams) as any;

    const lCounts = { "1": 0, "2": 0, "3": 0, "4": 0 };
    (likertRows as any[]).forEach((r) => {
      const k = String(r.bucket) as "1" | "2" | "3" | "4";
      if (lCounts[k] != null) lCounts[k] = Number(r.cnt || 0);
    });
    const lTotal = Object.values(lCounts).reduce((a, b) => a + b, 0);
    const lPcts = toPctParts([lCounts["1"], lCounts["2"], lCounts["3"], lCounts["4"]]);

    const likert = [
      { key: "1", label: "1 — Extremely Dissatisfied", count: lCounts["1"], pct: lPcts[0] },
      { key: "2", label: "2 — Dissatisfied",            count: lCounts["2"], pct: lPcts[1] },
      { key: "3", label: "3 — Satisfied",               count: lCounts["3"], pct: lPcts[2] },
      { key: "4", label: "4 — Extremely Satisfied",     count: lCounts["4"], pct: lPcts[3] },
    ];

    /* ---------- YES/NO buckets ---------- */
    const yesnoSql = `
      SELECT t.yn AS bucket, COUNT(*) AS cnt
      FROM (
        SELECT
          CASE
            WHEN q.question_type <> 'YES_NO' THEN NULL
            WHEN LOWER(COALESCE(o.option_value, '')) IN ('yes','y','true','1')
              OR LOWER(COALESCE(o.label, ''))        IN ('yes','y','true','1') THEN 'yes'
            WHEN LOWER(COALESCE(o.option_value, '')) IN ('no','n','false','0')
              OR LOWER(COALESCE(o.label, ''))        IN ('no','n','false','0')  THEN 'no'
            ELSE NULL
          END AS yn
        FROM submissions s
        JOIN answers a               ON a.submission_id = s.id
        JOIN questions q             ON q.id = a.question_id
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE a.option_id IS NOT NULL
          AND q.question_type = 'YES_NO'
          AND s.submitted_at >= ?
          AND s.submitted_at <  ?
          ${surveyFilter}
      ) AS t
      WHERE t.yn IS NOT NULL
      GROUP BY t.yn
    `;

    const yesnoParams: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) yesnoParams.push(latestId);

    const [yesnoRows] = await pool.query(yesnoSql, yesnoParams) as any;
    const yCounts = { yes: 0, no: 0 };
    (yesnoRows as any[]).forEach((r) => {
      const k = String(r.bucket).toLowerCase() as "yes" | "no";
      if (yCounts[k] != null) yCounts[k] = Number(r.cnt || 0);
    });
    const yTotal = yCounts.yes + yCounts.no;
    const yPcts = toPctParts([yCounts.yes, yCounts.no]);

    const yesno = [
      { key: "yes", label: "Yes", count: yCounts.yes, pct: yPcts[0] },
      { key: "no",  label: "No",  count: yCounts.no,  pct: yPcts[1] },
    ];

    return NextResponse.json(
      {
        window: { from, to },
        totals: { likert: lTotal, yesno: yTotal },
        likert,
        yesno,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: "QueryError", message: String(err?.sqlMessage || err?.message || err) },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
