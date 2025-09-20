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
  if (d <= 7)   return { tickEveryDays: 1,  labelEveryDays: 1  };
  if (d <= 30)  return { tickEveryDays: 1,  labelEveryDays: 2  };
  if (d <= 92)  return { tickEveryDays: 3,  labelEveryDays: 3  };
  if (d < 365)  return { tickEveryDays: 7,  labelEveryDays: 14 };
  if (d < 730)  return { tickEveryDays: 14, labelEveryDays: 28 };
  return           { tickEveryDays: 30, labelEveryDays: 90 };
}

/* ---------- Route ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // scope: default ALL surveys (more forgiving); force latest with ?scope=latest
  const scope = (url.searchParams.get("scope") || "all").toLowerCase();
  const explicitQKey = (url.searchParams.get("qkey") || process.env.REVISIT_QKEY || "").toLowerCase().trim();

  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const cadence = pickCadence(from, to);

  const pool = getPool();

  try {
    // Maybe constrain to latest published survey
    let latestId: number | null = null;
    if (scope === "latest") {
      const [pubRows] = (await pool.query(
        `SELECT id
         FROM surveys
         WHERE status='PUBLISHED'
         ORDER BY COALESCE(published_at, created_at) DESC, version DESC
         LIMIT 1`
      )) as any;
      latestId = pubRows?.[0]?.id ?? null;
    }
    const surveyFilter = scope === "latest" && latestId != null ? "AND s.survey_id = ?" : "";

    // If no qkey provided, auto-pick the best YES/NO question in this window.
    // Preference: key/prompt contains "revisit" / "return" / "come back", then by highest answer count.
    let resolvedQKey = explicitQKey || null;

    if (!resolvedQKey) {
      const [candidates] = (await pool.query(
        `
        SELECT
          LOWER(q.question_key) AS qkey,
          SUM(1) AS answered,
          MAX( CASE
                 WHEN LOWER(q.question_key) LIKE '%revisit%' THEN 1
                 WHEN LOWER(q.prompt)      LIKE '%revisit%' THEN 1
                 WHEN LOWER(q.prompt)      LIKE '%return%'  THEN 1
                 WHEN LOWER(q.prompt)      LIKE '%come back%' THEN 1
                 ELSE 0
               END ) AS is_revisit_like
        FROM answers a
        JOIN submissions s ON s.id = a.submission_id
        JOIN questions q   ON q.id = a.question_id
        WHERE q.question_type = 'YES_NO'
          AND a.option_id IS NOT NULL
          AND s.submitted_at >= ?
          AND s.submitted_at <  ?
          ${surveyFilter}
        GROUP BY qkey
        ORDER BY is_revisit_like DESC, answered DESC
        LIMIT 1
        `,
        surveyFilter ? [FROM_UTC, TO_PLUS_1D_UTC, latestId] : [FROM_UTC, TO_PLUS_1D_UTC]
      )) as any;

      resolvedQKey = candidates?.[0]?.qkey || null;
    }

    // If we still didn't find anything, short-circuit with empty series.
    if (!resolvedQKey) {
      return NextResponse.json(
        {
          window: { from, to },
          cadence,
          series: buildEmptySeries(from, to),
          meta: { scope, resolvedQKey: null, note: "No YES_NO answers found in window." },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Main aggregation for the resolved key
    const sql = `
      SELECT
        DATE_FORMAT(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'), '%Y-%m-%d') AS day_key,
        COUNT(*) AS answered,
        SUM(
          CASE
            WHEN LOWER(COALESCE(qo.option_value, qo.label)) IN ('yes','y','true','1') THEN 1
            ELSE 0
          END
        ) AS yes_count
      FROM submissions s
      JOIN answers a   ON a.submission_id = s.id
      JOIN questions q ON q.id = a.question_id
      LEFT JOIN question_options qo ON qo.id = a.option_id
      WHERE a.option_id IS NOT NULL
        AND q.question_type = 'YES_NO'
        AND LOWER(q.question_key) = ?
        AND s.submitted_at >= ?
        AND s.submitted_at <  ?
        ${surveyFilter}
      GROUP BY day_key
      ORDER BY day_key
    `;

    const params: any[] = [resolvedQKey, FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) params.push(latestId);

    const [rows] = (await pool.query(sql, params)) as any[];

    // Map result -> full daily sequence
    const map = new Map<string, { answered: number; yes: number }>();
    (rows as any[]).forEach((r) => {
      map.set(String(r.day_key), {
        answered: Number(r.answered || 0),
        yes: Number(r.yes_count || 0),
      });
    });

    const series = buildSeries(from, to, cadence.labelEveryDays, map);

    return NextResponse.json(
      {
        window: { from, to },
        cadence,
        series,
        meta: { scope, resolvedQKey, explicitQKey: explicitQKey || null },
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

/* ---------- helpers to build series ---------- */
function buildSeries(
  from: string,
  to: string,
  labelEveryDays: number,
  map: Map<string, { answered: number; yes: number }>
) {
  const out: Array<{
    day: string;
    axisLabel: string;
    tooltipLabel: string;
    pctYes: number | null;
    answered: number;
    yes: number;
  }> = [];

  const start = new Date(`${from}T00:00:00${MANILA_TZ}`);
  const end   = new Date(`${to}T00:00:00${MANILA_TZ}`);
  let idx = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), idx++) {
    const key = ymd(d);
    const got = map.get(key) || { answered: 0, yes: 0 };
    const pct = got.answered > 0 ? Number(((got.yes * 100) / got.answered).toFixed(1)) : null;

    const showLabel = (idx % Math.max(1, labelEveryDays)) === 0;
    const axisLabel = showLabel
      ? d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" })
      : "";

    const tooltipLabel = d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });

    out.push({
      day: key,
      axisLabel,
      tooltipLabel,
      pctYes: pct,
      answered: got.answered,
      yes: got.yes,
    });
  }
  return out;
}

function buildEmptySeries(from: string, to: string) {
  return buildSeries(from, to, 1, new Map());
}
