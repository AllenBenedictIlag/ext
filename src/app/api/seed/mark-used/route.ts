import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(dt: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
}
function clampUsedBetween(issuedAt: Date) {
  // random seconds up to 7 days
  const maxSec = 7 * 24 * 60 * 60;
  const randSec = Math.floor(Math.random() * maxSec);
  const used = new Date(issuedAt.getTime() + randSec * 1000);
  return used;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const year  = Number(body.year)  || new Date().getFullYear();
    const month = Number(body.month) || (new Date().getMonth()+1);
    const limit = body.limit ? Number(body.limit) : undefined; // optional cap
    const minRate = body.minRate ? Number(body.minRate) : 10;  // percent
    const maxRate = body.maxRate ? Number(body.maxRate) : 15;  // percent
    const dryRun  = Boolean(body.dryRun);

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      // get candidate receipts for the month
      const [candidates]: any = await conn.query(
        `SELECT id, issued_at
           FROM receipts
          WHERE YEAR(issued_at)=? AND MONTH(issued_at)=? AND used_at IS NULL`,
        [year, month]
      );

      if (candidates.length === 0) {
        return NextResponse.json({ year, month, updated: 0, sample: [], note: "No candidates in this month." });
      }

      const rate = (Math.floor(Math.random() * (maxRate - minRate + 1)) + minRate) / 100; // e.g. 0.10...0.15
      let target = Math.floor(candidates.length * rate);
      if (limit) target = Math.min(target, limit);

      // shuffle and take target
      candidates.sort(() => Math.random() - 0.5);
      const pick = candidates.slice(0, target);

      if (dryRun) {
        return NextResponse.json({
          year, month, rate, target, preview: pick.slice(0, 5).map((r: any) => ({
            id: r.id,
            issued_at: r.issued_at,
            used_at: fmt(clampUsedBetween(new Date(r.issued_at))),
          })),
          note: "dryRun=true -> no DB updates",
        });
      }

      if (pick.length === 0) {
        return NextResponse.json({ year, month, updated: 0, sample: [], note: "Target computed to 0." });
      }

      // build CASE update
      const ids = pick.map((r: any) => r.id);
      const caseSql = pick.map((r: any) => `WHEN ${r.id} THEN ?`).join(" ");
      const params: any[] = pick.map((r: any) => fmt(clampUsedBetween(new Date(r.issued_at))));
      const sql = `
        UPDATE receipts
           SET used_at = CASE id ${caseSql} END
         WHERE id IN (${ids.join(",")}) AND used_at IS NULL
      `;
      const [res]: any = await conn.query(sql, params);

      // sample rows
      const [rows]: any = await conn.query(
        `SELECT id, receipt_number, issued_at, used_at
           FROM receipts
          WHERE id IN (${ids.slice(0, 10).join(",")})
          ORDER BY id DESC`
      );

      return NextResponse.json({
        ok: true, year, month, rate, updated: res.affectedRows ?? 0, sample: rows,
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "mark-used failed" }, { status: 500 });
  }
}
