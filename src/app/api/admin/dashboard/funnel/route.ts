import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2";

export const revalidate = 0;

/* ---------- TZ helpers ---------- */
const TZ = "Asia/Manila";
function todayPHMidnight() {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** Inclusive N-day window: [end-(n-1), end] to match GlobalQuickFilter lastNDays(n) */
function lastNDaysInclusive(n: number) {
  const end = todayPHMidnight();          // “today” 00:00 in Manila
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));
  return { from: ymd(start), to: ymd(end) };
}
/** Resolve from/to; if missing, look at range; default to last 30d (inclusive) */
function resolveWindow(search: URLSearchParams) {
  const f = search.get("from");
  const t = search.get("to");
  if (f && t) return { from: f, to: t };

  const range = (search.get("range") || "").toLowerCase();
  if (range === "7d")  return lastNDaysInclusive(7);
  if (range === "30d") return lastNDaysInclusive(30);
  if (range === "90d") return lastNDaysInclusive(90);

  return lastNDaysInclusive(30);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { from, to } = resolveWindow(searchParams);
  const pool = getPool();

  // Issued
  const [issuedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS issued
       FROM receipts
      WHERE issued_at >= ?
        AND issued_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to]
  );
  const issued = Number((issuedRows[0] as any)?.issued ?? 0);

  // Used
  const [usedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS used
       FROM receipts
      WHERE used_at IS NOT NULL
        AND used_at >= ?
        AND used_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to]
  );
  const used = Number((usedRows[0] as any)?.used ?? 0);

  // Submitted: all optional questions answered (vacuously true if none)
  const [submittedRows] = await pool.execute<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS submitted
      FROM submissions s
     WHERE s.submitted_at >= ?
       AND s.submitted_at < DATE_ADD(?, INTERVAL 1 DAY)
       AND NOT EXISTS (
            SELECT 1
              FROM questions q
             WHERE q.survey_id = s.survey_id
               AND q.required = 0
               AND NOT EXISTS (
                    SELECT 1
                      FROM answers a
                     WHERE a.submission_id = s.id
                       AND a.question_id   = q.id
                       AND (
                          (q.question_type IN ('TEXT','SHORT_TEXT')
                               AND a.text_value IS NOT NULL AND a.text_value <> '')
                       OR (q.question_type IN ('LIKERT','YES_NO')
                               AND a.option_id IS NOT NULL)
                       )
               )
       )
    `,
    [from, to]
  );
  const submitted = Number((submittedRows[0] as any)?.submitted ?? 0);

  return NextResponse.json({ period: { from, to }, issued, used, submitted });
}
