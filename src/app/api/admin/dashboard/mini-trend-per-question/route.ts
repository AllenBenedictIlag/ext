import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

const MANILA_TZ = "+08:00";

type Bucket = "day" | "week" | "month" | "quarter";

// Parse YYYY-MM-DD (Manila midnight) -> UTC Date
function parseYMDToUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${MANILA_TZ}`);
}

// to MySQL DATETIME "YYYY-MM-DD HH:MM:SS" (UTC)
function toMySQLDateTimeUTC(d: Date): string {
  const iso = new Date(d).toISOString();
  return iso.slice(0, 19).replace("T", " ");
}

// Last N days window in Manila (inclusive end day)
function lastNDaysManila(n: number) {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate()); // 00:00 PH today
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));
  return { from: start, to: end };
}

function pickBucket(fromYMD: string, toYMD: string, bucketParam?: string): Bucket {
  if (bucketParam === "day" || bucketParam === "week" || bucketParam === "month" || bucketParam === "quarter") {
    return bucketParam;
  }
  const f = new Date(`${fromYMD}T00:00:00+08:00`);
  const t = new Date(`${toYMD}T00:00:00+08:00`);
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;

  if (days <= 7)  return "day";       // last 7d → daily
  if (days <= 45) return "week";      // last ~30d → weekly (≈4–5 pts)
  if (days > 730) return "quarter";   // custom > 2 years → quarterly
  return "month";                     // 3mo..2y → monthly
}

// Monday start of PH week (label is that Monday, YYYY-MM-DD)
const WEEK_START_SQL = `
  DATE_FORMAT(
    DATE_SUB(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'),
      INTERVAL WEEKDAY(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}')) DAY
    ),
    '%Y-%m-%d'
  )
`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const range = url.searchParams.get("range");        // optional manual hits: 7d|30d|90d
  const bucketParam = url.searchParams.get("bucket"); // optional override: day|week|month|quarter

  try {
    let fromYMD: string;
    let toYMD: string;

    if (fromParam && toParam) {
      fromYMD = fromParam;
      toYMD = toParam;
    } else if (range && /^(7d|30d|90d)$/.test(range)) {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const { from, to } = lastNDaysManila(days);
      const pad = (x: number) => String(x).padStart(2, "0");
      fromYMD = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
      toYMD   = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`;
    } else {
      return NextResponse.json({ error: "Missing from/to or valid range=7d|30d|90d" }, { status: 400 });
    }

    // Build UTC window [from, to+1day)
    const fromUTC = parseYMDToUTC(fromYMD);
    const toUTCPlus1 = parseYMDToUTC(toYMD);
    toUTCPlus1.setDate(toUTCPlus1.getDate() + 1);

    const bucket: Bucket = pickBucket(fromYMD, toYMD, bucketParam || undefined);

    // Bucket expression producing a label 'x'
    let bucketExpr = "";
    const anchorYMD = `${toYMD.slice(0, 7)}-01`; // first day of 'to' month (for quarter anchoring)

    if (bucket === "day") {
      bucketExpr = `DATE_FORMAT(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'), '%Y-%m-%d')`;
    } else if (bucket === "week") {
      bucketExpr = WEEK_START_SQL;
    } else if (bucket === "month") {
      bucketExpr = `DATE_FORMAT(CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}'), '%Y-%m')`;
    } else {
      // quarter: group every 3 months, aligned to filter's 'to' month
      bucketExpr = `
        DATE_FORMAT(
          DATE_ADD(
            STR_TO_DATE('${anchorYMD}', '%Y-%m-%d'),
            INTERVAL 3 * FLOOR(
              TIMESTAMPDIFF(
                MONTH,
                STR_TO_DATE('${anchorYMD}', '%Y-%m-%d'),
                CONVERT_TZ(s.submitted_at,'+00:00','${MANILA_TZ}')
              ) / 3
            ) MONTH
          ),
          '%Y-%m'
        )
      `;
    }

    const pool = getPool();
    const sql = `
      SELECT
        q.question_key,
        q.question_type,
        ${bucketExpr} AS x,
        SUM(
          CASE
            WHEN q.question_type='YES_NO' AND o.option_value='yes'         THEN 1
            WHEN q.question_type='LIKERT'  AND o.option_value IN ('3','4') THEN 1
            ELSE 0
          END
        ) AS pos_cnt,
        COUNT(*) AS ans_cnt
      FROM submissions s
      JOIN answers a           ON a.submission_id = s.id
      JOIN questions q         ON q.id = a.question_id
      JOIN question_options o  ON o.id = a.option_id
      WHERE s.submitted_at >= ?
        AND s.submitted_at <  ?
        AND q.question_type IN ('LIKERT','YES_NO')
      GROUP BY q.question_key, q.question_type, x
      ORDER BY q.question_key, x;
    `;

    const [rows] = await pool.query(sql, [
      toMySQLDateTimeUTC(fromUTC),
      toMySQLDateTimeUTC(toUTCPlus1),
    ]) as any[];

    type Row = {
      question_key: string;
      question_type: "LIKERT" | "YES_NO";
      x: string;       // day: YYYY-MM-DD; week: YYYY-MM-DD (Mon); month/quarter: YYYY-MM
      pos_cnt: number;
      ans_cnt: number; // responses
    };

    const map = new Map<
      string,
      { question_type: "LIKERT" | "YES_NO"; points: { x: string; positivePct: number; responses: number }[] }
    >();

    (rows as Row[]).forEach((r) => {
      const pct = r.ans_cnt > 0 ? Math.round((10000 * r.pos_cnt) / r.ans_cnt) / 100 : 0;
      if (!map.has(r.question_key)) {
        map.set(r.question_key, { question_type: r.question_type, points: [] });
      }
      map.get(r.question_key)!.points.push({
        x: r.x,
        positivePct: pct,
        responses: r.ans_cnt, // ensure 0 is returned when no rows
      });
    });

    const series = Array.from(map.entries()).map(([question_key, v]) => ({
      question_key,
      question_type: v.question_type,
      points: v.points,
    }));

    return NextResponse.json(
      { period: { from: fromYMD, to: toYMD }, bucket, series },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("mini-trend-per-question error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
