// src/app/api/admin/dashboard/deadline-effect/route.ts
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

/* ---------- Window from URL (same behavior as composite-satisfaction) ---------- */
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

  // [from, to+1d) PH -> UTC string for MySQL
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
  const pool = getPool();

  try {
    // Totals (cohort by issued_at)
    const [totalRows] = (await pool.query(
      `
      SELECT
        COUNT(*) AS issued,
        SUM(CASE WHEN used_at IS NOT NULL AND used_at <= expires_at THEN 1 ELSE 0 END) AS usedWithin7d
      FROM receipts
      WHERE issued_at >= ? AND issued_at < ?
      `,
      [FROM_UTC, TO_PLUS_1D_UTC]
    )) as any;

    const issued = Number(totalRows?.[0]?.issued || 0);
    const usedWithin7d = Number(totalRows?.[0]?.usedWithin7d || 0);

    // Bin counts (0..7) for uses within 7 days
    const [binRows] = (await pool.query(
      `
      SELECT
        (TIMESTAMPDIFF(HOUR, issued_at, used_at) DIV 24) AS day_bin,
        COUNT(*) AS cnt
      FROM receipts
      WHERE issued_at >= ? AND issued_at < ?
        AND used_at IS NOT NULL
        AND used_at <= expires_at
        AND TIMESTAMPDIFF(HOUR, issued_at, used_at) BETWEEN 0 AND 7*24
      GROUP BY day_bin
      `,
      [FROM_UTC, TO_PLUS_1D_UTC]
    )) as any;

    const byBin = new Map<number, number>();
    (binRows as any[]).forEach((r) => {
      const k = Number(r.day_bin);
      const v = Number(r.cnt || 0);
      if (k >= 0 && k <= 7) byBin.set(k, v);
    });

    const bins = Array.from({ length: 8 }, (_, day) => {
      const count = byBin.get(day) || 0;
      const sharePct = usedWithin7d > 0 ? (count / usedWithin7d) * 100 : 0;
      return { day, count, sharePct: Math.round(sharePct * 10) / 10 }; // 1 decimal
    });

    return NextResponse.json(
      {
        window: { from, to },
        totals: { issued, usedWithin7d },
        bins,
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
