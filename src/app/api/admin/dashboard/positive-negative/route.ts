// src/app/api/admin/dashboard/positive-negative/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

/* ---------- Row shape ---------- */
interface TotalsRow extends RowDataPacket {
  totalAnswered: number | null;
  positiveTotal: number | null;
  negativeTotal: number | null;
  positiveLikert: number | null;
  positiveYesNo: number | null;
  negativeLikert: number | null;
  negativeYesNo: number | null;
}

/* ---------- Manila time helpers ---------- */
const MANILA_TZ = "Asia/Manila";
const MANILA_OFFSET = "+08:00";

function todayInManila(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: MANILA_TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}

function parseYMDToUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${MANILA_OFFSET}`);
}

function addDays(d: Date, n: number): Date {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt;
}

function toMySQLDateTimeUTC(d: Date): string {
  const iso = new Date(d).toISOString();
  return iso.slice(0, 19).replace("T", " ");
}

function isValidYMD(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function computeRangeFromParam(range: string): { from: string; to: string } | null {
  const m = range.match(/^(\d+)[d]$/i);
  if (!m) return null;
  const days = parseInt(m[1], 10);
  if (![7, 30, 90].includes(days)) return null;

  const endPH = todayInManila();
  const startPH = new Date(endPH);
  startPH.setDate(endPH.getDate() - (days - 1));

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { from: ymd(startPH), to: ymd(endPH) };
}

/* ---------- Handler ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    let from = searchParams.get("from");
    let to = searchParams.get("to");

    const range = searchParams.get("range");
    if (!isValidYMD(from) || !isValidYMD(to)) {
      if (range) {
        const r = computeRangeFromParam(range);
        if (!r) return NextResponse.json({ error: "Invalid range; use 7d|30d|90d" }, { status: 400 });
        from = r.from;
        to = r.to;
      } else {
        return NextResponse.json({ error: "from/to required (YYYY-MM-DD)" }, { status: 400 });
      }
    }

    const fromUtc = parseYMDToUTC(from!);
    const toUtcExclusive = addDays(parseYMDToUTC(to!), 1);

    const fromSql = toMySQLDateTimeUTC(fromUtc);
    const toSql = toMySQLDateTimeUTC(toUtcExclusive);

    const pool = await getPool();
    const [rows] = await pool.query<TotalsRow[]>(
      `
      SELECT
        SUM(CASE WHEN q.question_type IN ('LIKERT','YES_NO') AND a.option_id IS NOT NULL THEN 1 ELSE 0 END) AS totalAnswered,

        SUM(CASE
              WHEN q.question_type = 'LIKERT' AND o.option_value IN ('3','4') THEN 1
              WHEN q.question_type = 'YES_NO' AND o.option_value = 'yes' THEN 1
              ELSE 0
            END) AS positiveTotal,

        SUM(CASE
              WHEN q.question_type = 'LIKERT' AND o.option_value IN ('1','2') THEN 1
              WHEN q.question_type = 'YES_NO' AND o.option_value = 'no'  THEN 1
              ELSE 0
            END) AS negativeTotal,

        SUM(CASE WHEN q.question_type = 'LIKERT'  AND o.option_value IN ('3','4') THEN 1 ELSE 0 END) AS positiveLikert,
        SUM(CASE WHEN q.question_type = 'YES_NO' AND o.option_value = 'yes'      THEN 1 ELSE 0 END) AS positiveYesNo,
        SUM(CASE WHEN q.question_type = 'LIKERT'  AND o.option_value IN ('1','2') THEN 1 ELSE 0 END) AS negativeLikert,
        SUM(CASE WHEN q.question_type = 'YES_NO' AND o.option_value = 'no'       THEN 1 ELSE 0 END) AS negativeYesNo

      FROM answers a
      JOIN submissions s         ON s.id = a.submission_id
      JOIN questions q           ON q.id = a.question_id
      LEFT JOIN question_options o ON o.id = a.option_id
      WHERE
        s.submitted_at >= ? AND s.submitted_at < ?
        AND q.question_type IN ('LIKERT','YES_NO')
        AND a.option_id IS NOT NULL
      `,
      [fromSql, toSql]
    );

    const r = rows?.[0];
    const totals = {
      totalAnswered: Number(r?.totalAnswered ?? 0),
      positiveTotal: Number(r?.positiveTotal ?? 0),
      negativeTotal: Number(r?.negativeTotal ?? 0),
      positiveLikert: Number(r?.positiveLikert ?? 0),
      positiveYesNo: Number(r?.positiveYesNo ?? 0),
      negativeLikert: Number(r?.negativeLikert ?? 0),
      negativeYesNo: Number(r?.negativeYesNo ?? 0),
    };

    return NextResponse.json({ from, to, totals });
  } catch (e) {
    return NextResponse.json({ error: "Server error", details: String(e) }, { status: 500 });
  }
}
