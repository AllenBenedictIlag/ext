// src/app/api/admin/dashboard/recent-comments/route.ts
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

/* ---------- Compute window identical to Composite API ---------- */
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

/* ---------- GET ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const pool = getPool();

  // NOTE: only the free-text COMMENTS question is allowed
  // Change this constant if your question_key changes.
  const COMMENTS_KEY = "comments";

  try {
    const sql = `
      SELECT
        a.id AS comment_id,
        s.submitted_at,
        r.receipt_number,
        q.prompt,
        TRIM(a.text_value) AS preview,
        NULLIF(1 + LENGTH(TRIM(a.text_value)) - LENGTH(REPLACE(TRIM(a.text_value), ' ', '')), 0) AS words,
        v.title AS survey_title,
        v.version AS survey_version,
        CONCAT('/admin/submissions/', s.id) AS submission_link
      FROM answers a
      JOIN submissions s ON s.id = a.submission_id
      JOIN receipts   r ON r.id = s.receipt_id
      JOIN questions  q ON q.id = a.question_id
      JOIN surveys    v ON v.id = s.survey_id
      WHERE q.question_key = ?
        AND a.text_value IS NOT NULL
        AND LENGTH(TRIM(a.text_value)) > 0
        AND s.submitted_at >= ?
        AND s.submitted_at <  ?
      ORDER BY s.submitted_at DESC
      LIMIT ? OFFSET ?;
    `;

    const params: (string | number)[] = [COMMENTS_KEY, FROM_UTC, TO_PLUS_1D_UTC, limit, offset];
    const [rows] = (await pool.query(sql, params)) as unknown as [Array<Record<string, unknown>>, unknown];

    return NextResponse.json(
      {
        window: { from, to },
        rows,
        meta: { limit, offset, count: (rows as unknown[]).length },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "production") {
      // expose SQL error in dev
      const anyErr = err as { message?: string; sqlMessage?: string };
      return NextResponse.json(
        { error: "QueryError", message: String(anyErr?.sqlMessage || anyErr?.message || err) },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
