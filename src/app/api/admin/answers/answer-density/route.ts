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

  // [from, to+1d) using PH local midnight, expressed in UTC for MySQL
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
  const allSurveys = url.searchParams.get("allSurveys") === "1";

  const pool = getPool();

  try {
    // (1) Latest published survey (unless allSurveys=1)
    let latest: { id: number; title: string; version: number } | null = null;
    if (!allSurveys) {
      const [pubRows] = await pool.query(
        `SELECT id, title, version
           FROM surveys
          WHERE status='PUBLISHED'
          ORDER BY COALESCE(published_at, created_at) DESC, version DESC
          LIMIT 1`
      ) as any;
      if (pubRows?.[0]) {
        latest = {
          id: Number(pubRows[0].id),
          title: String(pubRows[0].title),
          version: Number(pubRows[0].version),
        };
      }
    }

    const surveyFilter = !allSurveys && latest ? "AND s.survey_id = ?" : "";
    const paramsCore: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    if (surveyFilter) paramsCore.push(latest!.id);

    // (2) Per-submission answered count (allow 0), then group into bins
    const sqlBins = `
      SELECT t.answered_count AS answers, COUNT(*) AS submissions
      FROM (
        SELECT
          s.id,
          COUNT(
            CASE
              WHEN q.question_type IN ('LIKERT','YES_NO') AND a.option_id IS NOT NULL THEN 1
              WHEN q.question_type IN ('TEXT','SHORT_TEXT')
                   AND a.text_value IS NOT NULL AND TRIM(a.text_value) <> '' THEN 1
              ELSE NULL
            END
          ) AS answered_count
        FROM submissions s
        LEFT JOIN answers   a ON a.submission_id = s.id
        LEFT JOIN questions q ON q.id = a.question_id
        WHERE s.submitted_at >= ? AND s.submitted_at < ?
          ${surveyFilter}
        GROUP BY s.id
      ) AS t
      GROUP BY t.answered_count
      ORDER BY t.answered_count
    `;

    const [binRows] = await pool.query(sqlBins, paramsCore) as any;
    const rawBins = (binRows as any[]).map(r => ({
      answers: Number(r.answers),
      count: Number(r.submissions),
    }));

    // Fill missing integer bins between min..max
    let bins = rawBins;
    if (rawBins.length > 0) {
      const min = rawBins[0].answers;
      const max = rawBins[rawBins.length - 1].answers;
      const map = new Map<number, number>(rawBins.map(b => [b.answers, b.count]));
      const filled: { answers: number; count: number }[] = [];
      for (let k = min; k <= max; k++) filled.push({ answers: k, count: map.get(k) ?? 0 });
      bins = filled;
    }

    const total = bins.reduce((s, b) => s + b.count, 0);
    const domain = {
      min: bins.length ? bins[0].answers : 0,
      max: bins.length ? bins[bins.length - 1].answers : 0,
    };

    // (3) Questions: required/optional for expected line (only if latest)
    let questions: { required: number; optional: number } | null = null;
    let expected: number | null = null;

    if (latest) {
      const [qRows] = await pool.query(
        `SELECT
           SUM(CASE WHEN required=1 THEN 1 ELSE 0 END) AS required_count,
           SUM(CASE WHEN required=0 THEN 1 ELSE 0 END) AS optional_count
         FROM questions
         WHERE survey_id = ?`,
        [latest.id]
      ) as any;

      const req = Number(qRows?.[0]?.required_count ?? 0);
      const opt = Number(qRows?.[0]?.optional_count ?? 0);
      questions = { required: req, optional: opt };
      expected = req + 0.3 * opt;
    }

    // Build response
    const out = {
      window: { from, to },
      survey: latest,
      questions,
      expected,
      total,
      domain,
      bins: bins.map(b => ({
        answers: b.answers,
        count: b.count,
        share: total ? b.count / total : 0,
      })),
    };

    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
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
