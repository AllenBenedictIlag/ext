// src/app/api/admin/dashboard/recent-comments/summary/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";

type QaItem = {
  question_id: number;
  question_key: string;
  display_order: number;
  prompt: string;
  question_type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  text_value: string | null;
  option_value: string | null;
  option_label: string | null;
};

type SubmissionDetail = {
  submission_id: number;
  receipt_id: number;
  receipt_number: string;
  issued_at: string | null;
  survey_title: string | null;
  survey_version: number;
  submitted_at: string;
  items: QaItem[];
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const receiptIdParam = url.searchParams.get("receiptId");
  const receiptNumber = url.searchParams.get("receiptNumber");

  const byId = receiptIdParam ? Number(receiptIdParam) : null;
  const usingId = Number.isFinite(byId) && (byId as number) > 0;
  const usingNumber = !!receiptNumber;

  if (!(usingId || usingNumber)) {
    return NextResponse.json(
      { error: "Provide receiptId or receiptNumber" },
      { status: 400 }
    );
  }

  const pool = getPool();

  try {
    const where = usingId ? "r.id = ?" : "r.receipt_number = ?";
    const val = usingId ? (byId as number) : (receiptNumber as string);

    // One submission per receipt (schema enforces UNIQUE on receipt_id)
    const sql = `
      SELECT
        s.id           AS submission_id,
        s.submitted_at,
        r.id           AS receipt_id,
        r.receipt_number,
        r.issued_at,
        v.title        AS survey_title,
        v.version      AS survey_version,
        q.id           AS question_id,
        q.question_key,
        q.display_order,
        q.prompt,
        q.question_type,
        a.text_value,
        o.option_value,
        o.label        AS option_label
      FROM receipts r
      JOIN submissions s       ON s.receipt_id = r.id
      JOIN surveys    v        ON v.id = s.survey_id
      JOIN answers    a        ON a.submission_id = s.id
      JOIN questions  q        ON q.id = a.question_id
      LEFT JOIN question_options o ON o.id = a.option_id
      WHERE ${where}
      ORDER BY q.display_order ASC
      LIMIT 1000
    `;

    const [rows] = (await pool.query(sql, [val])) as unknown as [
      Array<Record<string, unknown>>,
      unknown
    ];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No submission found for this receipt" },
        { status: 404 }
      );
    }

    const head = rows[0] as any;

    const items: QaItem[] = (rows as any[]).map((r) => ({
      question_id: Number(r.question_id),
      question_key: String(r.question_key),
      display_order: Number(r.display_order),
      prompt: String(r.prompt),
      question_type: r.question_type as QaItem["question_type"],
      text_value: r.text_value != null ? String(r.text_value) : null,
      option_value: r.option_value != null ? String(r.option_value) : null,
      option_label: r.option_label != null ? String(r.option_label) : null,
    }));

    const payload: SubmissionDetail = {
      submission_id: Number(head.submission_id),
      receipt_id: Number(head.receipt_id),
      receipt_number: String(head.receipt_number),
      issued_at: head.issued_at ? String(head.issued_at) : null,
      survey_title: head.survey_title ? String(head.survey_title) : null,
      survey_version: Number(head.survey_version),
      submitted_at: String(head.submitted_at),
      items,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== "production") {
      const anyErr = err as { message?: string; sqlMessage?: string };
      return NextResponse.json(
        { error: "QueryError", message: String(anyErr?.sqlMessage || anyErr?.message || err) },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
