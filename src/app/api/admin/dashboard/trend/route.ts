// src/app/api/admin/dashboard/trend/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

/** ---------- Row type for SELECT ---------- */
interface TrendRow extends RowDataPacket {
  y: number;
  m: number;
  receipts: number;
  submissions: number;
}

/** ---------- Time helpers (Asia/Manila) ---------- */
const TZ = "Asia/Manila";

function partsInManila(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p = fmt.formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function ymd(y: number, m: number, d: number) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** month math on (year, month) with month = 1..12 */
function addMonthsYM(y: number, m: number, delta: number) {
  const total = y * 12 + (m - 1) + delta;
  const y2 = Math.floor(total / 12);
  const m2 = (total % 12) + 1;
  return { y: y2, m: m2 };
}

function monthLabel(y: number, m: number) {
  const d = new Date(Date.UTC(y, m - 1, 1));
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${mon} '${String(y).slice(2)}`;
}

/** ---------- Route (IGNORES global filter) ---------- */
export async function GET() {
  try {
    const now = new Date();
    const { year: yNow, month: mNow, day: dNow } = partsInManila(now);

    // Build the 10-month list **current → older**
    type MonthSlot = {
      y: number; m: number;
      name: string;
      from: string; // inclusive YYYY-MM-DD (Manila)
      to: string;   // YYYY-MM-DD (Manila) — for current month it's "today"
      receipts: number;
      submissions: number;
      responsePct: number;
      receiptsPct: number;
      submissionsPct: number;
    };

    const slots: MonthSlot[] = [];
    for (let j = 0; j < 10; j++) {
      const { y, m } = addMonthsYM(yNow, mNow, -j);
      const isCurrent = j === 0;
      const from = ymd(y, m, 1);
      const to = isCurrent
        ? ymd(yNow, mNow, dNow) // current month: 1st → today
        : ymd(addMonthsYM(y, m, 1).y, addMonthsYM(y, m, 1).m, 1); // past month: whole month (we use < to in SQL)
      slots.push({
        y, m,
        name: monthLabel(y, m),
        from, to,
        receipts: 0,
        submissions: 0,
        responsePct: 0,
        receiptsPct: 0,
        submissionsPct: 0,
      });
    }

    // Query window covers the oldest slot start up to **today+1day** (exclusive)
    const oldest = slots[slots.length - 1];
    const today = ymd(yNow, mNow, dNow);
    const startSQL = `${oldest.from} 00:00:00`;
    const toSQL = `${today} 00:00:00`; // we'll +1 day in SQL

    const sql = `
      SELECT
        YEAR(r.issued_at)  AS y,
        MONTH(r.issued_at) AS m,
        COUNT(*)           AS receipts,
        COUNT(s.id)        AS submissions
      FROM receipts r
      LEFT JOIN submissions s
        ON s.receipt_id = r.id
      WHERE r.issued_at >= ?
        AND r.issued_at < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY y, m
    `;

    const pool = getPool();
    const [rows] = await pool.query<TrendRow[]>(sql, [startSQL, toSQL]);

    // Index DB results by y-m for quick merge
    const byYM = new Map<string, TrendRow>();
    rows.forEach((r) => byYM.set(`${r.y}-${r.m}`, r));

    // Merge + compute responsePct
    slots.forEach((mo) => {
      const hit = byYM.get(`${mo.y}-${mo.m}`);
      mo.receipts = Number(hit?.receipts ?? 0);
      mo.submissions = Number(hit?.submissions ?? 0);
      mo.responsePct = mo.receipts ? (mo.submissions / mo.receipts) * 100 : 0;
    });

    // Anchor for scaling: highest raw count across both series in this 10-month window
    const anchorMax = Math.max(
      1,
      ...slots.map((s) => Math.max(s.receipts, s.submissions))
    );

    slots.forEach((s) => {
      s.receiptsPct = (s.receipts / anchorMax) * 100;
      s.submissionsPct = (s.submissions / anchorMax) * 100;
    });

    return NextResponse.json({
      window: { from: slots[0].from, to: today }, // current month start → today
      anchorMax,
      yTicks: [0, 25, 50, 75, 100],
      months: slots, // **current → older**, so X-axis starts at the current month
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
