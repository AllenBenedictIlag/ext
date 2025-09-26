import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPool } from "@/lib/database";

// Ensure node runtime (mysql driver)
export const dynamic = "force-dynamic";

type ApiRow = {
  question_id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  required: boolean;
  help_text: string | null;
  options: { option_id: number; option_value: string; label: string }[] | null;
  updated_at: string;
};

type ApiSurvey = {
  id: number;
  title: string;
  version: number;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
  submitted_by: { id: number; name: string; email: string } | null;
  submitted_for_review_at: string | null;
};

function sanitizeSort(input: string | null): {
  sortCol: string;
  sortKey: string;
} {
  switch ((input ?? "").toLowerCase()) {
    case "question_id":
      return { sortCol: "q.id", sortKey: "question_id" };
    case "display_order":
      return { sortCol: "q.display_order", sortKey: "display_order" };
    case "question_key":
      return { sortCol: "q.question_key", sortKey: "question_key" };
    case "type":
      return { sortCol: "q.question_type", sortKey: "type" };
    case "required":
      return { sortCol: "q.required", sortKey: "required" };
    case "updated_at":
    default:
      return { sortCol: "q.updated_at", sortKey: "updated_at" };
  }
}

function sanitizeDir(dir: string | null): "asc" | "desc" {
  return (dir ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
}

export async function GET(req: NextRequest) {
  const pool = getPool();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "500", 10), 1), 1000);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const { sortCol, sortKey } = sanitizeSort(searchParams.get("sort"));
  const dir = sanitizeDir(searchParams.get("dir"));

  const conn = await pool.getConnection();
  try {
    // 1) pick survey (prefer DRAFT → PENDING_REVIEW → PUBLISHED)
    const [surveyRows] = await conn.query<any[]>(
      `
      SELECT s.id, s.title, s.version, s.status, s.submitted_by, s.submitted_for_review_at
      FROM surveys s
      WHERE s.status IN ('DRAFT','PENDING_REVIEW','PUBLISHED')
      ORDER BY FIELD(s.status,'DRAFT','PENDING_REVIEW','PUBLISHED'), s.version DESC
      LIMIT 1
      `
    );

    if (!Array.isArray(surveyRows) || surveyRows.length === 0) {
      const payload = {
        survey: null,
        data: [] as ApiRow[],
        meta: { total: 0, limit, offset, sort: sortKey, dir },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const s = surveyRows[0] as {
      id: number; title: string; version: number; status: ApiSurvey["status"];
      submitted_by: number | null; submitted_for_review_at: Date | string | null;
    };

    // 2) count questions (for meta.total)
    const [countRows] = await conn.query<any[]>(
      `SELECT COUNT(*) AS total FROM questions WHERE survey_id = ?`,
      [s.id]
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    // 3) fetch question rows with sort + pagination
    const [qRows] = await conn.query<any[]>(
      `
      SELECT
        q.id              AS question_id,
        q.display_order   AS display_order,
        q.question_key    AS question_key,
        q.prompt          AS prompt,
        q.question_type   AS type,
        q.required        AS required,
        q.help_text       AS help_text,
        q.updated_at      AS updated_at
      FROM questions q
      WHERE q.survey_id = ?
      ORDER BY ${sortCol} ${dir}, q.display_order ASC
      LIMIT ? OFFSET ?
      `,
      [s.id, limit, offset]
    );

    const ids: number[] = qRows.map((r) => Number(r.question_id)).filter((n) => Number.isFinite(n));
    let optsByQ: Record<number, { option_id: number; option_value: string; label: string }[]> = {};
    if (ids.length > 0) {
      const [optRows] = await conn.query<any[]>(
        `
        SELECT
          o.id AS option_id,
          o.question_id,
          o.option_value,
          o.label
        FROM question_options o
        WHERE o.question_id IN ( ${ids.map(() => "?").join(",")} )
        ORDER BY o.question_id, o.id
        `,
        ids
      );
      for (const r of optRows) {
        const qid = Number(r.question_id);
        (optsByQ[qid] ||= []).push({
          option_id: Number(r.option_id),
          option_value: String(r.option_value),
          label: String(r.label),
        });
      }
    }

    // 4) submitted_by details
    let submittedBy: ApiSurvey["submitted_by"] = null;
    if (s.submitted_by) {
      const [adminRows] = await conn.query<any[]>(
        `SELECT id, first_name, last_name, email FROM admins WHERE id = ? LIMIT 1`,
        [s.submitted_by]
      );
      if (Array.isArray(adminRows) && adminRows[0]) {
        submittedBy = {
          id: Number(adminRows[0].id),
          name: `${adminRows[0].first_name} ${adminRows[0].last_name}`.trim(),
          email: String(adminRows[0].email),
        };
      }
    }

    const data: ApiRow[] = qRows.map((r) => ({
      question_id: Number(r.question_id),
      display_order: Number(r.display_order),
      question_key: String(r.question_key),
      prompt: String(r.prompt),
      type: r.type as ApiRow["type"],
      required: Boolean(r.required),
      help_text: r.help_text == null ? null : String(r.help_text),
      options: Array.isArray(optsByQ[Number(r.question_id)]) ? optsByQ[Number(r.question_id)] : (null as any),
      updated_at: new Date(r.updated_at).toISOString(),
    }));

    const survey: ApiSurvey = {
      id: s.id,
      title: s.title,
      version: s.version,
      status: s.status,
      submitted_by: submittedBy,
      submitted_for_review_at: s.submitted_for_review_at
        ? new Date(s.submitted_for_review_at).toISOString()
        : null,
    };

    const payload = {
      survey,
      data,
      meta: { total, limit, offset, sort: sortKey, dir },
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    console.error("answers-table GET error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    conn.release();
  }
}
