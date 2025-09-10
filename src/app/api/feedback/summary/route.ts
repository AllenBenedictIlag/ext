import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

const CODE_PATTERN = /^[A-Z0-9-]{4,64}$/;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const pool = getPool();

    // 1) resolve receipt + submission
    const [rrows] = await pool.execute(
      `SELECT id FROM receipts WHERE UPPER(receipt_number) = ? LIMIT 1`,
      [code],
    ) as any[];
    if (!rrows || rrows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const receiptId = (rrows[0] as any).id as number;

    const [srows] = await pool.execute(
      `SELECT id, survey_id, submitted_at FROM submissions WHERE receipt_id = ? LIMIT 1`,
      [receiptId],
    ) as any[];
    if (!srows || srows.length === 0) {
      return NextResponse.json({ error: "No submission for this code" }, { status: 404 });
    }
    const submission = srows[0] as { id: number; survey_id: number; submitted_at: string };

    // 2) load questions
    const [qrows] = await pool.execute(
      `SELECT id, question_key, prompt, question_type, display_order
         FROM questions
        WHERE survey_id = ?
        ORDER BY display_order ASC`,
      [submission.survey_id],
    ) as any[];

    // 3) answers (join option label if any)
    const [arows] = await pool.execute(
      `SELECT a.question_id, a.option_id, a.text_value,
              o.option_value, o.label AS option_label
         FROM answers a
         LEFT JOIN question_options o ON o.id = a.option_id
        WHERE a.submission_id = ?`,
      [submission.id],
    ) as any[];

    const byQ = new Map<number, any>();
    for (const a of arows as any[]) byQ.set(a.question_id, a);

    const result = {
      receipt_code: code,
      submission: {
        id: submission.id,
        survey_id: submission.survey_id,
        submitted_at: submission.submitted_at,
      },
      answers: (qrows as any[]).map((q) => {
        const a = byQ.get(q.id);
        return {
          key: q.question_key,
          prompt: q.prompt,
          type: q.question_type,
          display_order: q.display_order,
          value:
            a?.option_label ??
            a?.option_value ?? // fallback to stored raw
            a?.text_value ??
            null,
          raw: a ?? null,
        };
      }),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
