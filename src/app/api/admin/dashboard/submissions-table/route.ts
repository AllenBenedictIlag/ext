import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";

const SORT_MAP = {
  submitted_at: "s.submitted_at",
  receipt_number: "r.receipt_number",
  survey_version: "v.version",
  submission_id: "s.id",
} as const;

type SortKey = keyof typeof SORT_MAP;
type Dir = "asc" | "desc";

export async function GET(req: NextRequest) {
  const pool = getPool();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limitRaw = Number(url.searchParams.get("limit") ?? "500");
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 500 : limitRaw), 1000);
  const offset = (page - 1) * limit;

  const sort = (url.searchParams.get("sort") ?? "submitted_at") as SortKey;
  const dir = ((url.searchParams.get("dir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc") as Dir;
  const q = url.searchParams.get("q");
  const qParam = q && q.trim().length > 0 ? q.trim() : null;

  if (!Object.hasOwn(SORT_MAP, sort)) {
    return NextResponse.json({ error: "invalid sort" }, { status: 400 });
  }

  const orderBy = `${SORT_MAP[sort]} ${dir.toUpperCase()}`;

  // WHERE fragment & params for text search
  const where = qParam
    ? "WHERE (r.receipt_number LIKE CONCAT('%', ?, '%') OR CAST(s.id AS CHAR) LIKE CONCAT('%', ?, '%'))"
    : "";

  const paramsData: unknown[] = [];
  if (qParam) paramsData.push(qParam, qParam);
  paramsData.push(limit, offset);

  const paramsCount: unknown[] = [];
  if (qParam) paramsCount.push(qParam, qParam);

  const sqlData = `
    SELECT
      s.id AS submission_id,
      r.receipt_number AS receipt_number,
      CONVERT_TZ(s.submitted_at, @@session.time_zone, '+08:00') AS submitted_at,  -- normalize to PH
      v.version AS survey_version,
      CONVERT_TZ(r.used_at, @@session.time_zone, '+08:00') AS used_at,
      TIMESTAMPDIFF(DAY, r.issued_at, COALESCE(r.used_at, s.submitted_at)) AS days_since_issue,
      (SELECT COUNT(*) FROM answers a WHERE a.submission_id = s.id) AS answers_count,
      (
        SELECT qo.label
        FROM questions q
        JOIN answers a2 ON a2.submission_id = s.id AND a2.question_id = q.id
        LEFT JOIN question_options qo ON qo.id = a2.option_id
        WHERE q.survey_id = v.id AND q.question_key = 'revisit'
        LIMIT 1
      ) AS revisit_intent
    FROM submissions s
    JOIN receipts r ON r.id = s.receipt_id
    JOIN surveys v  ON v.id = s.survey_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`;

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM submissions s
    JOIN receipts r ON r.id = s.receipt_id
    JOIN surveys v  ON v.id = s.survey_id
    ${where}`;

  try {
    const [rows] = await pool.query(sqlData, paramsData);
    const [countRows] = await pool.query(sqlCount, paramsCount);

    const total = Array.isArray(countRows) && countRows.length > 0
      ? Number((countRows as Array<{ total: number }>)[0].total)
      : 0;

    // shape + link
    const data = (rows as Array<any>).map((r) => ({
      submission_id: Number(r.submission_id),
      receipt_number: String(r.receipt_number),
      submitted_at: new Date(r.submitted_at).toISOString(),
      survey_version: Number(r.survey_version),
      used_at: r.used_at ? new Date(r.used_at).toISOString() : null,
      days_since_issue: Number(r.days_since_issue),
      answers_count: Number(r.answers_count),
      revisit_intent: r.revisit_intent ? String(r.revisit_intent).toUpperCase() as "YES"|"NO" : null,
      link_to_answers: `/admin/submissions/${r.submission_id}`,
    }));

    return NextResponse.json({
      data,
      meta: { total, page, limit, sort, dir, ...(qParam ? { q: qParam } : {}) },
    });
  } catch (err) {
    console.error("submissions/table GET error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
