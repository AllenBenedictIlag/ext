import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";

const MANILA_TZ = "+08:00";

/* ---------- Time helpers (copied pattern) ---------- */
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

/* ---------- Window from URL (same semantics as composite) ---------- */
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

/* ---------- Validation ---------- */
function parseStepHours(sp: URLSearchParams): number {
  const raw = sp.get("step");
  const allowed = [1, 2, 3, 6, 12, 24];
  const val = raw ? Number(raw) : 6;
  return allowed.includes(val) ? val : 6;
}

/* ---------- Handler ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);
  const stepHours = parseStepHours(url.searchParams);
  const MAX_HOURS = 168; // 7 days
  const binCount = Math.ceil(MAX_HOURS / stepHours);

  const pool = getPool();
  try {
    const sql = `
      SELECT
        FLOOR(LEAST(GREATEST(TIMESTAMPDIFF(HOUR, r.issued_at, r.used_at), 0), 167) / ?) AS bin_id,
        COUNT(*) AS cnt
      FROM receipts r
      WHERE r.used_at IS NOT NULL
        AND r.issued_at >= ?
        AND r.issued_at <  ?
        AND r.used_at < DATE_ADD(r.issued_at, INTERVAL 7 DAY)
      GROUP BY bin_id
      ORDER BY bin_id
    `;
    const [rows] = (await pool.query(sql, [stepHours, FROM_UTC, TO_PLUS_1D_UTC])) as any[];

    // Map results by bin_id
    const byId = new Map<number, number>();
    let totalUsed = 0;
    (rows || []).forEach((r: any) => {
      const id = Number(r.bin_id);
      const c = Number(r.cnt);
      byId.set(id, c);
      totalUsed += c;
    });
    // Build full bins 0..binCount-1
    const bins: Array<{ start: number; end: number; label: string; count: number; share: number; cumShare: number }> = [];
    let running = 0;
    for (let i = 0; i < binCount; i++) {
      const start = i * stepHours;
      const end = Math.min((i + 1) * stepHours, MAX_HOURS);
      const count = byId.get(i) ?? 0;
      const share = totalUsed > 0 ? (count / totalUsed) * 100 : 0;
      running += share;
      bins.push({
        start,
        end,
        label: `${start}–${end}h`,
        count,
        share,
        cumShare: running,
      });
    }

    return NextResponse.json(
      {
        window: { from, to },
        rule: { stepHours, maxHours: MAX_HOURS },
        totalUsed,
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
