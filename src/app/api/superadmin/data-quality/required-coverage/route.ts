import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/* ---------- Window from URL (same semantics as your other API) ---------- */
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
  const allSurveys = url.searchParams.get("allSurveys") === "1";

  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const pool = getPool();

  try {
    // Latest published survey (unless allSurveys=1)
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

    // Total submissions in window
    const [totalRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM submissions s
       WHERE s.submitted_at >= ? AND s.submitted_at < ?
       ${surveyFilter}`,
      surveyFilter ? [FROM_UTC, TO_PLUS_1D_UTC, latestId] : [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;
    const total = Number(totalRows?.[0]?.total ?? 0);

    // Fully covered submissions: all required questions answered properly
    const [fullRows] = await pool.query(
      `SELECT COUNT(*) AS full_count
       FROM submissions s
       WHERE s.submitted_at >= ? AND s.submitted_at < ?
       ${surveyFilter}
       AND NOT EXISTS (
         SELECT 1
         FROM questions q
         WHERE q.survey_id = s.survey_id
           AND q.required = 1
           AND NOT EXISTS (
             SELECT 1
             FROM answers a
             WHERE a.submission_id = s.id
               AND a.question_id = q.id
               AND (
                 (q.question_type IN ('LIKERT','YES_NO') AND a.option_id IS NOT NULL)
                 OR (q.question_type IN ('TEXT','SHORT_TEXT') AND a.text_value IS NOT NULL AND a.text_value <> '')
               )
           )
       )`,
      surveyFilter ? [FROM_UTC, TO_PLUS_1D_UTC, latestId] : [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;

    const full = Number(fullRows?.[0]?.full_count ?? 0);
    const percent = total > 0 ? (full / total) * 100 : null;

    return NextResponse.json(
      { window: { from, to }, coverage: { percent, full, total } },
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
