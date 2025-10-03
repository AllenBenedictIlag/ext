// src/app/api/admin/statistics/monthly-trend/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";

const MANILA_TZ = "+08:00";

/* ---------- PH time helpers ---------- */
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
function monthsSpanInclusive(fromYMD: string, toYMD: string) {
  const f = new Date(`${fromYMD}T00:00:00${MANILA_TZ}`);
  const t = new Date(`${toYMD}T00:00:00${MANILA_TZ}`);
  return (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1;
}

/* ---------- Compute [from, to+1d) window (PH) ---------- */
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

/* ---------- Granularity rules ---------- */
type Granularity = "day" | "week" | "month" | "quarter3"; // 3-month buckets aligned to 'to'
function chooseGranularity(fromYMD: string, toYMD: string): Granularity {
  const d = daysInclusive(fromYMD, toYMD);
  const m = monthsSpanInclusive(fromYMD, toYMD);
  if (d === 7) return "day";
  if (d === 30) return "week";
  if (m === 3) return "month";
  if (m > 24) return "quarter3";
  return "month";
}

/* ---------- Bucket builders ---------- */
function mondayOfWeekPH(d: Date): Date {
  const js = new Date(d);
  const wd = js.getDay(); // 0=Sun..6=Sat
  const iso = wd === 0 ? 7 : wd; // Sun->7
  js.setDate(js.getDate() - (iso - 1));
  js.setHours(0, 0, 0, 0);
  return js;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

type Bucket = { key: string; axisLabel: string; tooltip: string };

function buildBuckets(fromYMD: string, toYMD: string, gran: Granularity): Bucket[] {
  const startPH = new Date(`${fromYMD}T00:00:00${MANILA_TZ}`);
  const endPH   = new Date(`${toYMD}T00:00:00${MANILA_TZ}`);

  if (gran === "day") {
    const out: Bucket[] = [];
    for (let d = new Date(startPH); d <= endPH; d = addDays(d, 1)) {
      const key = ymd(d);
      out.push({
        key,
        axisLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" }),
        tooltip:   d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }),
      });
    }
    return out;
  }

  if (gran === "week") {
    const startMon = mondayOfWeekPH(startPH);
    const endMon   = mondayOfWeekPH(endPH);
    const out: Bucket[] = [];
    for (let d = new Date(startMon); d <= endMon; d = addDays(d, 7)) {
      const key = ymd(d);
      out.push({
        key,
        axisLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" }),
        tooltip:   `Week of ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}`,
      });
    }
    return out;
  }

  if (gran === "month") {
    const startM = startOfMonth(startPH);
    const endM   = startOfMonth(endPH);
    const out: Bucket[] = [];
    for (let d = new Date(startM); d <= endM; d = addMonths(d, 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        key,
        axisLabel: d.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Manila" }),
        tooltip:   d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" }),
      });
    }
    return out;
  }

  // quarter3: 3-month buckets aligned so the last bucket ends at the 'to' month.
  {
    const endMonth = startOfMonth(endPH);
    const startMonth = startOfMonth(startPH);
    const diffMonths = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + (endMonth.getMonth() - startMonth.getMonth());
    const firstEnd = addMonths(endMonth, - (Math.floor(diffMonths / 3) * 3));

    const out: Bucket[] = [];
    for (let d = new Date(firstEnd); d <= endMonth; d = addMonths(d, 3)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM of ENDING month
      const from3 = addMonths(d, -2);
      out.push({
        key,
        axisLabel: d.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Manila" }), // "Sep", "Jun", ...
        tooltip:   `${from3.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Manila" })}–${d.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Manila" })} ${d.getFullYear()}`
      });
    }
    return out;
  }
}

/* ---------- SQL key expressions per granularity ---------- */
function sqlKeyExpr(gran: Granularity, columnUTC: string, toYMD?: string) {
  const conv = `CONVERT_TZ(${columnUTC},'+00:00','${MANILA_TZ}')`;
  if (gran === "day")   return `DATE_FORMAT(${conv}, '%Y-%m-%d')`;
  if (gran === "week")  return `DATE_FORMAT(DATE_SUB(${conv}, INTERVAL WEEKDAY(${conv}) DAY), '%Y-%m-%d')`;
  if (gran === "month") return `DATE_FORMAT(${conv}, '%Y-%m')`;
  if (!toYMD) throw new Error("toYMD required for quarter3");
  const toDate = `STR_TO_DATE(?, '%Y-%m-%d')`;
  const bucketIdx = `FLOOR(TIMESTAMPDIFF(MONTH, DATE(${conv}), ${toDate}) / 3)`;
  const endMonthDate = `DATE_SUB(${toDate}, INTERVAL (${bucketIdx})*3 MONTH)`;
  return `DATE_FORMAT(${endMonthDate}, '%Y-%m')`; // YYYY-MM of ending month
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const gran: Granularity = chooseGranularity(from, to);

  const pool = getPool();

  try {
    const buckets = buildBuckets(from, to, gran);

    const keyR = sqlKeyExpr(gran, "r.issued_at", to);
    const keyS = sqlKeyExpr(gran, "r.issued_at", to);

    const paramsR = gran === "quarter3" ? [FROM_UTC, TO_PLUS_1D_UTC, to, to] : [FROM_UTC, TO_PLUS_1D_UTC];
    const paramsS = gran === "quarter3" ? [FROM_UTC, TO_PLUS_1D_UTC, to, to] : [FROM_UTC, TO_PLUS_1D_UTC];

    // Receipts
    const [rowsR] = await pool.query(
      `
      SELECT ${keyR} AS bucket_key, COUNT(*) AS receipts
      FROM receipts r
      WHERE r.issued_at >= ? AND r.issued_at < ?
      GROUP BY bucket_key
      ORDER BY bucket_key
      `,
      paramsR as any
    ) as any;

    // Submissions (cohort by receipt issued_at)
    const [rowsS] = await pool.query(
      `
      SELECT ${keyS} AS bucket_key, COUNT(*) AS submissions
      FROM receipts r
      JOIN submissions s ON s.receipt_id = r.id
      WHERE r.issued_at >= ? AND r.issued_at < ?
      GROUP BY bucket_key
      ORDER BY bucket_key
      `,
      paramsS as any
    ) as any;

    const rMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    (rowsR as any[]).forEach(r => rMap.set(String(r.bucket_key), Number(r.receipts || 0)));
    (rowsS as any[]).forEach(r => sMap.set(String(r.bucket_key), Number(r.submissions || 0)));

    const points = buckets.map(b => {
      const receipts = rMap.get(b.key) ?? 0;
      const submissions = sMap.get(b.key) ?? 0;
      const responsePct = receipts > 0 ? (submissions / receipts) * 100 : 0;
      return {
        bucketKey: b.key,
        axisLabel: b.axisLabel,
        tooltipLabel: b.tooltip,
        receipts,
        submissions,
        responsePct,
      };
    });

    return NextResponse.json(
      {
        window: { from, to },
        basis: { cohort: "issued_at", tz: "Asia/Manila", granularity: gran },
        points,
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
