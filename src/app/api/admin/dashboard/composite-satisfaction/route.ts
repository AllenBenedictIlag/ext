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

  // [from, to+1d) in PH -> UTC strings for MySQL
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

/* ---------- Cadence rules (ticks vs labels) ---------- */
function daysInclusive(fromYMD: string, toYMD: string) {
  const f = new Date(`${fromYMD}T00:00:00${MANILA_TZ}`);
  const t = new Date(`${toYMD}T00:00:00${MANILA_TZ}`);
  return Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
}
// Returns { tickEveryDays, labelEveryDays }
function pickCadence(fromYMD: string, toYMD: string) {
  const d = daysInclusive(fromYMD, toYMD);
  if (d <= 7)   return { tickEveryDays: 1,  labelEveryDays: 1  };  // every day, labels daily
  if (d <= 30)  return { tickEveryDays: 1,  labelEveryDays: 2  };  // daily ticks, label every 2 days
  if (d <= 92)  return { tickEveryDays: 3,  labelEveryDays: 3  };  // 3 months: ticks/labels every 3 days
  if (d < 365)  return { tickEveryDays: 7,  labelEveryDays: 14 };  // >3m & <1y: ticks 7d, labels 14d
  if (d < 730)  return { tickEveryDays: 14, labelEveryDays: 28 };  // 1–2y: ticks 14d, labels 28d
  return           { tickEveryDays: 30, labelEveryDays: 90 };      // ≥2y: ticks 30d, labels 90d (~quarter)
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const allSurveys = url.searchParams.get("allSurveys") === "1";

  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const cadence = pickCadence(from, to);

  const pool = getPool();

  try {
    // Latest PUBLISHED survey id (fallback to all if none or allSurveys=1)
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

    // Aggregate per calendar day in PH
    const sql = `
      SELECT
        DATE_FORMAT(CONVERT_TZ(t.submitted_at,'+00:00','${MANILA_TZ}'), '%Y-%m-%d') AS day_key,
        AVG(t.score) AS composite_avg,
        COUNT(t.score) AS n
      FROM (
        SELECT
          s.submitted_at,
          CASE
            WHEN q.question_type <> 'LIKERT' THEN NULL
            WHEN CAST(o.option_value AS UNSIGNED) BETWEEN 1 AND 4
              THEN CAST(o.option_value AS UNSIGNED)
            WHEN LOWER(o.label) IN ('extremely dissatisfied','1') THEN 1
            WHEN LOWER(o.label) IN ('dissatisfied','2')             THEN 2
            WHEN LOWER(o.label) IN ('satisfied','3')                THEN 3
            WHEN LOWER(o.label) IN ('extremely satisfied','4')      THEN 4
            ELSE NULL
          END AS score
        FROM submissions s
        JOIN answers a               ON a.submission_id = s.id
        JOIN questions q             ON q.id = a.question_id
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE a.option_id IS NOT NULL
          AND s.submitted_at >= ?
          AND s.submitted_at <  ?
          ${surveyFilter}
      ) AS t
      WHERE t.score IS NOT NULL
      GROUP BY day_key
      ORDER BY day_key
    `;

    const params: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) params.push(latestId);

    const [rows] = await pool.query(sql, params) as any[];

    // Build full daily sequence [from..to] so ticks exist even on empty days
    const map = new Map<string, { value: number | null; n: number }>();
    (rows as any[]).forEach((r) => {
      map.set(String(r.day_key), {
        value: r.composite_avg != null ? Number(r.composite_avg) : null,
        n: Number(r.n || 0),
      });
    });

    const series: Array<{
      day: string;          // YYYY-MM-DD (x value)
      axisLabel: string;    // may be "" if label is skipped
      tooltipLabel: string; // always full "Sep 14, 2025"
      value: number | null;
      n: number;
    }> = [];

    const start = new Date(`${from}T00:00:00${MANILA_TZ}`);
    const end   = new Date(`${to}T00:00:00${MANILA_TZ}`);
    let idx = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), idx++) {
      const key = ymd(d);
      const got = map.get(key) || { value: null, n: 0 };

      // label cadence
      const showLabel = (idx % cadence.labelEveryDays) === 0;
      const axisLabel = showLabel
        ? d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" })
        : "";

      const tooltipLabel = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      });

      series.push({
        day: key,
        axisLabel,
        tooltipLabel,
        value: got.value,
        n: got.n,
      });
    }

    return NextResponse.json(
      {
        window: { from, to },
        cadence,       // { tickEveryDays, labelEveryDays }
        series,        // daily entries for [from..to]
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
