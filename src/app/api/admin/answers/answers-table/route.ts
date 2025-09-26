import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

type SortKey = "created_at" | "submission_id" | "question_key" | "type" | "required";
const SORT_MAP: Record<SortKey, string> = {
  created_at: "a.created_at",
  submission_id: "a.submission_id",
  question_key: "q.question_key",
  type: "q.question_type",
  required: "q.required",
};

/** Each SELECT row must extend RowDataPacket to satisfy mysql2's query<T> */
interface CountRow extends RowDataPacket {
  total: number;
}
interface AnswerRow extends RowDataPacket {
  submission_id: number;
  question_key: string;
  type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  answer: string | null;
  required: 0 | 1;       // MySQL TINYINT
  created_at: Date;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "500", 10), 1), 1000);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);
  const sortParam = (url.searchParams.get("sort") ?? "created_at") as SortKey;
  const dirParam = (url.searchParams.get("dir") ?? "desc").toLowerCase();
  const sortKey: SortKey = (Object.keys(SORT_MAP) as SortKey[]).includes(sortParam)
    ? sortParam
    : "created_at";
  const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";
  const orderBy = `${SORT_MAP[sortKey]} ${dir.toUpperCase()}`;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // ---- total
    const [countRows] = await conn.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM answers a"
    );
    const total = countRows[0]?.total ?? 0;

    // ---- page rows
    const [rows] = await conn.query<AnswerRow[]>(
      `
      SELECT
        a.submission_id,
        q.question_key,
        q.question_type AS type,
        CASE
          WHEN q.question_type IN ('LIKERT','YES_NO')
            THEN COALESCE(o.label, o.option_value)
          ELSE a.text_value
        END AS answer,
        q.required AS required,
        a.created_at
      FROM answers a
      JOIN questions q ON q.id = a.question_id
      LEFT JOIN question_options o ON o.id = a.option_id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    const data = rows.map((r) => ({
      submission_id: r.submission_id,
      question_key: r.question_key,
      type: r.type,
      answer: r.answer ?? "",
      required: r.required === 1,
      created_at: new Date(r.created_at).toISOString(),
    }));

    return NextResponse.json(
      { data, meta: { total, limit, offset, sort: sortKey, dir } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[answers-table] GET error:", err);
    return NextResponse.json({ error: "Failed to load answers" }, { status: 500 });
  } finally {
    conn.release();
  }
}
