// src/app/api/admin/dashboard/cumulative-usage/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";

const MANILA_TZ = "+08:00";

/* ---------- Time helpers (PH) ---------- */
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const pool = getPool();

  try {
    // 1) Denominator: all receipts issued in the window (PH window mapped to UTC)
    const [issuedRows] = await pool.query(
      `SELECT COUNT(*) AS issued_total
       FROM receipts
       WHERE issued_at >= ? AND issued_at < ?`,
      [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;

    const issued_total: number = Number(issuedRows?.[0]?.issued_total ?? 0);

    // 2) Daily bins for used receipts (dayIndex = 0..7 in PH)
    // - Convert both issued_at and used_at to PH first, then TIMESTAMPDIFF(DAY)
    // - Clamp to 0..7, and group
    const [bins] = await pool.query(
      `
      SELECT d, COUNT(*) AS c
      FROM (
        SELECT
          LEAST(7,
            GREATEST(0,
              TIMESTAMPDIFF(
                DAY,
                CONVERT_TZ(issued_at,'+00:00','${MANILA_TZ}'),
                CONVERT_TZ(used_at,'+00:00','${MANILA_TZ}')
              )
            )
          ) AS d
        FROM receipts
        WHERE used_at IS NOT NULL
          AND issued_at >= ?
          AND issued_at <  ?
          AND used_at <= expires_at
      ) x
      GROUP BY d
      ORDER BY d
      `,
      [FROM_UTC, TO_PLUS_1D_UTC]
    ) as any;

    // 3) Build 0..7 bins with cumulative + percentages
    const daily = new Array(8).fill(0) as number[];
    for (const r of bins as Array<{ d: number; c: number }>) {
      const di = Number(r.d);
      const c = Number(r.c);
      if (di >= 0 && di <= 7) daily[di] = c;
    }

    const series = [] as Array<{
      dayIndex: number;
      label: string;
      dailyCount: number;
      runningCount: number;
      dailyPct: number;
      runningPct: number;
    }>;

    let running = 0;
    for (let i = 0; i <= 7; i++) {
      running += daily[i];
      const dailyPct = issued_total > 0 ? (daily[i] / issued_total) * 100 : 0;
      const runningPct = issued_total > 0 ? (running / issued_total) * 100 : 0;
      series.push({
        dayIndex: i,
        label: `Day ${i}`,
        dailyCount: daily[i],
        runningCount: running,
        dailyPct: Number(dailyPct.toFixed(2)),
        runningPct: Number(runningPct.toFixed(2)),
      });
    }

    const used_total = series[7]?.runningCount ?? 0;

    return NextResponse.json(
      {
        window: { from, to },
        denom: { issued: issued_total, used: used_total },
        series,
        note: {
          tz: "Asia/Manila",
          bucket: "day",
          logic: "cohort by issued_at; denominator = receipts issued in window; used_at within 7 days",
        },
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
