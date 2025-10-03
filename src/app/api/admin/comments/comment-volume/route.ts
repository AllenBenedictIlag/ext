// src/app/api/admin/dashboard/comment-volume/route.ts
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
function pickCadence(fromYMD: string, toYMD: string) {
  const d = daysInclusive(fromYMD, toYMD);
  if (d <= 7)  return { tickEveryDays: 1,  labelEveryDays: 1  };
  if (d <= 30) return { tickEveryDays: 1,  labelEveryDays: 2  };
  if (d <= 92) return { tickEveryDays: 3,  labelEveryDays: 3  };
  if (d < 365) return { tickEveryDays: 7,  labelEveryDays: 14 };
  if (d < 730) return { tickEveryDays: 14, labelEveryDays: 28 };
  return          { tickEveryDays: 30, labelEveryDays: 90 };
}

/* ---------- GET ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const allSurveys = url.searchParams.get("allSurveys") === "1";

  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const cadence = pickCadence(from, to);

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

    // Count free-text answers by PH day of submission
    const sql = `
      SELECT
        DATE_FORMAT(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'), '%Y-%m-%d') AS day_key,
        COUNT(*) AS cnt
      FROM submissions s
      JOIN answers a   ON a.submission_id = s.id
      JOIN questions q ON q.id = a.question_id
      WHERE s.submitted_at >= ?
        AND s.submitted_at <  ?
        AND q.question_type IN ('TEXT','SHORT_TEXT')
        AND a.text_value IS NOT NULL
        AND TRIM(a.text_value) <> ''
        ${surveyFilter}
      GROUP BY day_key
      ORDER BY day_key
    `;

    const params: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) params.push(latestId);

    const [rows] = await pool.query(sql, params) as any[];

    // Map to full [from..to] sequence with zeros for empty days
    const map = new Map<string, number>();
    (rows as any[]).forEach((r) => {
      map.set(String(r.day_key), Number(r.cnt || 0));
    });

    const series: Array<{
      day: string;
      axisLabel: string;
      tooltipLabel: string;
      count: number;
    }> = [];

    const start = new Date(`${from}T00:00:00${MANILA_TZ}`);
    const end   = new Date(`${to}T00:00:00${MANILA_TZ}`);
    let idx = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), idx++) {
      const key = ymd(d);
      const count = map.get(key) ?? 0;

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

      series.push({ day: key, axisLabel, tooltipLabel, count });
    }

    return NextResponse.json(
      { window: { from, to }, cadence, series },
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
