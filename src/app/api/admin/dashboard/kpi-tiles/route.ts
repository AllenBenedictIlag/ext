// src/app/api/admin/dashboard/section-cards/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { readKpiThresholds } from "@/lib/kpi-thresholds";
import type { RowDataPacket } from "mysql2";

type RangeKey = "7d" | "30d" | "90d" | "custom";
const RANGE_TO_DAYS: Record<Exclude<RangeKey, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const TZ = "Asia/Manila";
const MIN_CUSTOM_START_YMD = "2023-10-01"; // inclusive lower bound

/* ---------------- helpers: YMD-only, Manila semantics ---------------- */

function clampRange(key?: string | null): RangeKey {
  if (key === "7d" || key === "90d" || key === "custom") return key;
  return "30d";
}

function todayPHMidnight(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymdStr: string, delta: number): string {
  const [y, m, d] = ymdStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return ymd(new Date(dt)); // returns in local tz but only YMD part is used
}

/** Inclusive N-day window in Manila: from = end-(n-1), to = end */
function lastNDaysInclusiveYmd(n: number): { from: string; to: string } {
  const end = todayPHMidnight(); // Manila “today” at 00:00
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));
  return { from: ymd(start), to: ymd(end) };
}

/** Parse YYYY-MM-DD; for end exclusive we’ll use DATE_ADD in SQL */
function parseYmd(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Resolve [from,to] YMD. Priority: explicit params -> custom -> range -> 30d */
function resolveWindowYmd(url: URL): { from: string; to: string; key: RangeKey } {
  const fromParam = parseYmd(url.searchParams.get("from"));
  const toParam = parseYmd(url.searchParams.get("to"));
  if (fromParam && toParam) {
    return { from: fromParam, to: toParam, key: "custom" };
  }

  const rangeKey = clampRange(url.searchParams.get("range"));
  if (rangeKey === "custom") {
    const start = parseYmd(url.searchParams.get("start"));
    const end = parseYmd(url.searchParams.get("end"));
    if (!start || !end) {
      throw new Error("For range=custom, provide valid start and end as YYYY-MM-DD.");
    }
    // clamp start
    const clampedStart =
      start < MIN_CUSTOM_START_YMD ? MIN_CUSTOM_START_YMD : start;

    if (clampedStart > end) {
      throw new Error("Invalid custom range: start must be on/before end.");
    }
    return { from: clampedStart, to: end, key: "custom" };
  }

  // 7d/30d/90d default (inclusive window like the filter)
  const days = RANGE_TO_DAYS[rangeKey];
  return { ...lastNDaysInclusiveYmd(days), key: rangeKey };
}

/* ---------------- small math helpers ---------------- */

function safePct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}
function pctDelta(currPct: number | null, prevPct: number | null): number | null {
  if (currPct == null || prevPct == null) return null;
  return currPct - prevPct; // percentage points
}
function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
function round1(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 10) / 10;
}

/* ---------------- row typings ---------------- */

const QUESTION_KEYS = {
  overall: "overall",
  accurate: "accurate",
  friendliness: "friendliness",
  quality: "quality",
} as const;

interface CountRow extends RowDataPacket { cnt: number }
interface AggRow extends RowDataPacket { pos: number; total: number }

/* ---------------- handler ---------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);

  let windowYmd: { from: string; to: string; key: RangeKey };
  try {
    windowYmd = resolveWindowYmd(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid parameters" }, { status: 400 });
  }

  const kpiThresholds = await readKpiThresholds();

  const { from, to, key: rangeKey } = windowYmd;

  // previous window = same number of days, immediately before current
  const days = Math.max(1, Math.round(
    // inclusive length (#days) = difference + 1
    (Date.parse(addDaysYmd(to, 1)) - Date.parse(from)) / (24 * 3600 * 1000)
  ));
  const prevTo = addDaysYmd(from, -1);
  const prevFrom = addDaysYmd(prevTo, -(days - 1));

  // SQL will use: >= from AND < DATE_ADD(to, 1 DAY)
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    // --- Receipts (current / previous) ---
    const [rowsReceiptsCurr] = await conn.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt
         FROM receipts r
        WHERE r.issued_at >= ?
          AND r.issued_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [from, to]
    );
    const [rowsReceiptsPrev] = await conn.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt
         FROM receipts r
        WHERE r.issued_at >= ?
          AND r.issued_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [prevFrom, prevTo]
    );
    const receiptsCurr = rowsReceiptsCurr[0]?.cnt ?? 0;
    const receiptsPrev = rowsReceiptsPrev[0]?.cnt ?? 0;

    // --- Submissions (current / previous) ---
    const [rowsSubsCurr] = await conn.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt
         FROM submissions s
        WHERE s.submitted_at >= ?
          AND s.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [from, to]
    );
    const [rowsSubsPrev] = await conn.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt
         FROM submissions s
        WHERE s.submitted_at >= ?
          AND s.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [prevFrom, prevTo]
    );
    const subsCurr = rowsSubsCurr[0]?.cnt ?? 0;
    const subsPrev = rowsSubsPrev[0]?.cnt ?? 0;

    const responseRateCurr = safePct(subsCurr, receiptsCurr);
    const responseRatePrev = safePct(subsPrev, receiptsPrev);
    const responseRateDeltaPP = pctDelta(responseRateCurr, responseRatePrev);
    const receiptsDeltaPct = pctChange(receiptsCurr, receiptsPrev);

    // --- Helper: positive% for a question key (current / previous) ---
    async function questionPositivePct(
      questionKey: string
    ): Promise<{ curr: number | null; prev: number | null }> {
      const sql = `
        SELECT
          SUM(
            CASE
              WHEN q.question_type = 'YES_NO' AND o.option_value = 'yes' THEN 1
              WHEN q.question_type = 'LIKERT'  AND o.option_value IN ('3','4') THEN 1
              ELSE 0
            END
          ) AS pos,
          COUNT(*) AS total
        FROM answers a
        JOIN submissions s    ON s.id = a.submission_id
        JOIN questions q      ON q.id = a.question_id
        LEFT JOIN question_options o ON o.id = a.option_id
        WHERE q.question_key = ?
          AND s.submitted_at >= ? AND s.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      const [currRows] = await conn.query<AggRow[]>(sql, [questionKey, from, to]);
      const [prevRows] = await conn.query<AggRow[]>(sql, [questionKey, prevFrom, prevTo]);
      const curr = currRows.length ? safePct(currRows[0].pos ?? 0, currRows[0].total ?? 0) : null;
      const prev = prevRows.length ? safePct(prevRows[0].pos ?? 0, prevRows[0].total ?? 0) : null;
      return { curr, prev };
    }

    const [overallPct, accuracyPct, servicePct, qualityPct] = await Promise.all([
      questionPositivePct("overall"),
      questionPositivePct("accurate"),
      questionPositivePct("friendliness"),
      questionPositivePct("quality"),
    ]);

    const payload = {
      period: {
        key: rangeKey,
        // Echo YMDs; consumers should render "from → to"
        current: { start: from, end: to },
        previous: { start: prevFrom, end: prevTo },
      },
      kpis: [
        {
          key: "overall_satisfaction",
          title: "Satisfaction",
          value: round1(overallPct.curr),
          unit: "%",
          delta_pp: round1(pctDelta(overallPct.curr, overallPct.prev)),
          alertThreshold: kpiThresholds.overall_satisfaction,
        },
        {
          key: "order_accuracy",
          title: "Accuracy",
          value: round1(accuracyPct.curr),
          unit: "%",
          delta_pp: round1(pctDelta(accuracyPct.curr, accuracyPct.prev)),
          alertThreshold: kpiThresholds.order_accuracy,
        },
        {
          key: "staff_service",
          title: "Service",
          value: round1(servicePct.curr),
          unit: "%",
          delta_pp: round1(pctDelta(servicePct.curr, servicePct.prev)),
          alertThreshold: kpiThresholds.staff_service,
        },
        {
          key: "food_quality",
          title: "Food Quality",
          value: round1(qualityPct.curr),
          unit: "%",
          delta_pp: round1(pctDelta(qualityPct.curr, qualityPct.prev)),
          alertThreshold: kpiThresholds.food_quality,
        },
        {
          key: "receipts_issued",
          title: "Receipts Issued",
          value: receiptsCurr,
          unit: "count",
          delta_pct: round1(receiptsDeltaPct),
        },
        {
          key: "response_rate",
          title: "Response Rate",
          value: round1(responseRateCurr),
          unit: "%",
          delta_pp: round1(responseRateDeltaPP),
          alertThreshold: kpiThresholds.response_rate,
        },
      ],
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("[section-cards API] error:", err);
    return NextResponse.json(
      { error: "Failed to compute KPIs", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
