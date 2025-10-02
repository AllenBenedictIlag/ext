// src/app/api/admin/statistics/monthly-trend/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";

const MANILA_TZ = "+08:00";

/* ---------- Time helpers (PH -> UTC window) ---------- */
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

/* ---------- Window from URL (mirrors your other API) ---------- */
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

/* ---------- Month helpers ---------- */
function startOfMonthPH(ymdStr: string): Date {
  const d = new Date(`${ymdStr}T00:00:00${MANILA_TZ}`);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endMonthInclusiveList(fromYMD: string, toYMD: string): Array<{ key: string; label: string; long: string }> {
  const out: Array<{ key: string; label: string; long: string }> = [];
  const fromM = startOfMonthPH(fromYMD);
  const toM = startOfMonthPH(toYMD);
  for (let y = fromM.getFullYear(), m = fromM.getMonth(); y < toM.getFullYear() || (y === toM.getFullYear() && m <= toM.getMonth()); ) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`; // YYYY-MM
    const d = new Date(y, m, 1);
    const short = d.toLocaleString("en-US", { month: "short" });
    const label = `${short} ’${String(y).slice(-2)}`;
    const long = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    out.push({ key, label, long });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

/* ---------- GET ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const pool = getPool();

  try {
    // Receipts per PH month (cohort basis = issued_at)
    const [rowsR] = await pool.query(
      `
      SELECT
        DATE_FORMAT(CONVERT_TZ(r.issued_at,'+00:00','${MANILA_TZ}'), '%Y-%m') AS month_key,
        COUNT(*) AS receipts
      FROM receipts r
      WHERE r.issued_at >= ? AND r.issued_at < ?
      GROUP BY month_key
      ORDER BY month_key
      `,
      [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;

    // Submissions per PH month, grouped by the RECEIPT'S issued_at
    const [rowsS] = await pool.query(
      `
      SELECT
        DATE_FORMAT(CONVERT_TZ(r.issued_at,'+00:00','${MANILA_TZ}'), '%Y-%m') AS month_key,
        COUNT(*) AS submissions
      FROM receipts r
      JOIN submissions s ON s.receipt_id = r.id
      WHERE r.issued_at >= ? AND r.issued_at < ?
      GROUP BY month_key
      ORDER BY month_key
      `,
      [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;

    // Maps for quick merge
    const rMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    (rowsR as any[]).forEach((r) => rMap.set(String(r.month_key), Number(r.receipts || 0)));
    (rowsS as any[]).forEach((r) => sMap.set(String(r.month_key), Number(r.submissions || 0)));

    // Full month sequence covering [from..to] inclusive (PH)
    const months = endMonthInclusiveList(from, to).map(({ key, label, long }) => {
      const receipts = rMap.get(key) || 0;
      const submissions = sMap.get(key) || 0;
      const responsePct = receipts > 0 ? (submissions / receipts) * 100 : 0;
      return {
        monthKey: key,
        axisLabel: label,
        tooltipLabel: long,
        receipts,
        submissions,
        responsePct,
      };
    });

    return NextResponse.json(
      {
        window: { from, to },
        basis: { cohort: "issued_at", tz: "Asia/Manila" },
        months,
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
