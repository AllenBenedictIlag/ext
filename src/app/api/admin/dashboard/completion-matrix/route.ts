// src/app/api/admin/dashboard/completion-matrix/route.ts
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

/* ---------- Types sent to the client ---------- */
type ApiQuestion = {
  id: number;
  key: string;
  type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  required: boolean;
  order: number;
};
type ApiSubmission = {
  id: number;
  submitted_at: string; // UTC "YYYY-MM-DD HH:mm:ss"
  label: string;        // S01..Sxx (client shows on X axis)
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 40))); // cap to keep payload sane
  const order = (url.searchParams.get("order") || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
  const allSurveys = url.searchParams.get("allSurveys") === "1";

  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const pool = getPool();

  try {
    // 1) Latest PUBLISHED survey id (unless allSurveys=1)
    let latestId: number | null = null;
    if (!allSurveys) {
      const [pubRows] = await pool.query(
        `SELECT id
         FROM surveys
         WHERE status = 'PUBLISHED'
         ORDER BY COALESCE(published_at, created_at) DESC, version DESC
         LIMIT 1`
      ) as any;
      latestId = pubRows?.[0]?.id ?? null;
    }

    // 2) Questions for that survey (or none → return early)
    const qParams: any[] = [];
    let qSql = `SELECT id, question_key, question_type, required, display_order
                FROM questions`;
    if (!allSurveys && latestId != null) {
      qSql += ` WHERE survey_id = ?`;
      qParams.push(latestId);
    } else if (!allSurveys && latestId == null) {
      // No published survey at all → empty data
      return NextResponse.json(
        { window: { from, to }, questions: [], submissions: [], answeredPairs: [], stats: { totals: { questions: 0, submissions: 0 } } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    qSql += ` ORDER BY display_order ASC, id ASC`;
    const [qRows] = await pool.query(qSql, qParams) as any[];
    const questions: ApiQuestion[] = (qRows as any[]).map((r) => ({
      id: Number(r.id),
      key: String(r.question_key),
      type: r.question_type as ApiQuestion["type"],
      required: Boolean(r.required),
      order: Number(r.display_order),
    }));

    if (questions.length === 0) {
      return NextResponse.json(
        { window: { from, to }, questions: [], submissions: [], answeredPairs: [], stats: { totals: { questions: 0, submissions: 0 } } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3) Submissions in window (by submitted_at) for that survey
    const sParams: any[] = [FROM_UTC, TO_PLUS_1D_UTC];
    let sSql = `
      SELECT id, submitted_at
      FROM submissions s
      WHERE s.submitted_at >= ? AND s.submitted_at < ?`;
    if (!allSurveys && latestId != null) {
      sSql += ` AND s.survey_id = ?`;
      sParams.push(latestId);
    }
    sSql += ` ORDER BY s.submitted_at ${order} LIMIT ${limit}`;
    const [sRows] = await pool.query(sSql, sParams) as any[];
    const submissionsRaw: Array<{ id: number; submitted_at: string }> = (sRows as any[]).map((r) => ({
      id: Number(r.id),
      submitted_at: String(r.submitted_at),
    }));

    if (submissionsRaw.length === 0) {
      return NextResponse.json(
        { window: { from, to }, questions, submissions: [], answeredPairs: [], stats: { totals: { questions: questions.length, submissions: 0 } } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Label S01..Sxx left->right (based on chosen order)
    const submissions: ApiSubmission[] = submissionsRaw.map((r, i) => ({
      id: r.id,
      submitted_at: r.submitted_at,
      label: `S${String(i + 1).padStart(2, "0")}`,
    }));

    const submissionIds = submissions.map((s) => s.id);
    // 4) Answers for those submissions (answered = option_id present OR non-empty text_value)
    //    NOTE: unique constraint UX ensures one row per (submission, question)
    const [aRows] = await pool.query(
      `
      SELECT a.submission_id, a.question_id
      FROM answers a
      WHERE a.submission_id IN (?)
        AND (
          a.option_id IS NOT NULL
          OR (a.text_value IS NOT NULL AND a.text_value <> '')
        )
      `,
      [submissionIds]
    ) as any[];

    // Pairs (submission_id, question_id)
    const answeredPairs: Array<[number, number]> = (aRows as any[]).map((r) => [Number(r.submission_id), Number(r.question_id)]);

    // Optional: completion stats per question
    const answeredSet = new Set(aRows.map((r: any) => `${r.submission_id}:${r.question_id}`));
    const perQuestion = questions.map((q) => {
      let answered = 0;
      for (const s of submissions) {
        if (answeredSet.has(`${s.id}:${q.id}`)) answered++;
      }
      const total = submissions.length;
      return { question_id: q.id, answered, total, pct: total ? Math.round((answered / total) * 100) : 0 };
    });

    return NextResponse.json(
      {
        window: { from, to },
        questions,
        submissions,
        answeredPairs,
        stats: {
          totals: { questions: questions.length, submissions: submissions.length },
          perQuestion,
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
