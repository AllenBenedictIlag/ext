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

/* ---------- Window from URL (matches composite-satisfaction) ---------- */
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

/* ---------- Build full 7×24 grid ---------- */
function fullGrid(rows: Array<{ dow: number; hr: number; cnt: number }>) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(`${r.dow}:${r.hr}`, Number(r.cnt || 0)));

  const cells: Array<{ hour: number; dow: number; count: number }> = [];
  let max = 0;
  for (let d = 0; d <= 6; d++) {
    for (let h = 0; h < 24; h++) {
      const count = map.get(`${d}:${h}`) ?? 0;
      if (count > max) max = count;
      cells.push({ hour: h, dow: d, count });
    }
  }
  return { cells, max };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const allSurveys = url.searchParams.get("allSurveys") === "1";
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const pool = getPool();

  try {
    // Resolve latest PUBLISHED survey id (unless allSurveys=1)
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

    // Aggregate to PH day-of-week (0..6) × hour (0..23)
    const sql = `
      SELECT
        CAST(DATE_FORMAT(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'), '%w') AS UNSIGNED) AS dow,
        HOUR(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}')) AS hr,
        COUNT(*) AS cnt
      FROM submissions s
      WHERE s.submitted_at >= ?
        AND s.submitted_at <  ?
        ${surveyFilter}
      GROUP BY dow, hr
      ORDER BY dow, hr
    `;

    const params: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) params.push(latestId);

    const [rows] = await pool.query(sql, params) as any;
    const { cells, max } = fullGrid(rows as any[]);

    return NextResponse.json(
      { window: { from, to }, cells, max },
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
