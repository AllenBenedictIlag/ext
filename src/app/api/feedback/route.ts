// D:\Projects\sidebar\src\app\api\feedback\route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

type QuestionType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

type Body = {
  code: string;
  answers: Record<string, string | undefined>;
};

const CODE_PATTERN = /^[A-Z0-9-]{4,64}$/;

export async function POST(req: Request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const body = (await req.json()) as Body;

    // Basic guards
    if (!body?.code || !CODE_PATTERN.test(body.code)) {
      return NextResponse.json({ error: "Missing/invalid code" }, { status: 400 });
    }
    if (!body?.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "Missing answers" }, { status: 400 });
    }

    // 1) resolve receipt
    const [rrows] = (await conn.execute(
      `SELECT id, expires_at, used_at
         FROM receipts
        WHERE UPPER(receipt_number) = UPPER(?)
        LIMIT 1`,
      [body.code],
    )) as any[];
    if (!rrows || rrows.length === 0) {
      return NextResponse.json({ error: "Invalid control number" }, { status: 404 });
    }
    const receipt = rrows[0] as { id: number; expires_at: string | null; used_at: string | null };

    // 2) expiry
    if (receipt.expires_at && new Date(receipt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Expired control number" }, { status: 410 });
    }

    // 3) already submitted?
    const [srows] = (await conn.execute(
      `SELECT id FROM submissions WHERE receipt_id = ? LIMIT 1`,
      [receipt.id],
    )) as any[];
    if (receipt.used_at || (srows && srows.length > 0)) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    // 4) latest published survey
    const [svyRows] = (await conn.execute(
      `SELECT id, title, version
         FROM surveys
        WHERE status = 'PUBLISHED'
        ORDER BY version DESC, id DESC
        LIMIT 1`,
    )) as any[];
    if (!svyRows || svyRows.length === 0) {
      return NextResponse.json({ error: "No published survey configured" }, { status: 500 });
    }
    const survey = svyRows[0] as { id: number; title: string; version: number };

    // 5) load questions (id, key, type)
    const [qrows] = (await conn.execute(
      `SELECT id, question_key, question_type
         FROM questions
        WHERE survey_id = ?
        ORDER BY display_order ASC`,
      [survey.id],
    )) as any[];

    const keyToQ: Record<
      string,
      { id: number; type: QuestionType }
    > = {};
    const questionIds: number[] = [];
    for (const q of qrows as any[]) {
      keyToQ[q.question_key] = { id: q.id, type: q.question_type as QuestionType };
      questionIds.push(q.id);
    }

    // 6) load options for option-able questions
    const optionsByQ = new Map<number, { id: number; value: string }[]>();
    if (questionIds.length) {
      const [orows] = (await conn.query(
        `SELECT id, question_id, option_value
           FROM question_options
          WHERE question_id IN (${questionIds.join(",")})`,
      )) as any[];
      for (const o of (orows as any[]) ?? []) {
        const arr = optionsByQ.get(o.question_id) ?? [];
        arr.push({ id: o.id, value: String(o.option_value) });
        optionsByQ.set(o.question_id, arr);
      }
    }

    // 7) write submission + answers
    await conn.beginTransaction();

    const [insSub] = (await conn.execute(
      `INSERT INTO submissions (receipt_id, survey_id, submitted_at)
       VALUES (?, ?, NOW())`,
      [receipt.id, survey.id],
    )) as any[];
    const submissionId = (insSub as any).insertId as number;

    // helper to insert a single answer row
    async function putAnswer(questionId: number, optionValue?: string, text?: string) {
      let option_id: number | null = null;
      let text_value: string | null = null;

      if (optionValue != null) {
        const opts = optionsByQ.get(questionId) || [];
        const match = opts.find((o) => o.value === String(optionValue));
        if (!match) {
          // If the option sent from the client doesn't exist in DB, skip this answer.
          return;
        }
        option_id = match.id;
      }
      if (text != null) {
        const trimmed = text.trim();
        text_value = trimmed.length ? trimmed : null;
        if (text_value == null) return; // avoid inserting empty text answers
      }

      await conn.execute(
        `INSERT INTO answers (submission_id, question_id, option_id, text_value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [submissionId, questionId, option_id, text_value],
      );
    }

    // iterate through all provided answers
    for (const [qKey, rawValue] of Object.entries(body.answers)) {
      if (rawValue == null) continue;

      const qMeta = keyToQ[qKey];
      if (!qMeta) continue; // ignore answers for unknown keys (or from older survey versions)

      const v = String(rawValue);

      switch (qMeta.type) {
        case "LIKERT":
        case "YES_NO":
          // these must map to an option_value in question_options
          await putAnswer(qMeta.id, v, undefined);
          break;
        case "TEXT":
          await putAnswer(qMeta.id, undefined, v);
          break;
        case "SHORT_TEXT":
          // store as text_value; normalize to a numeric-looking string
          await putAnswer(qMeta.id, undefined, v);
          break;
        default:
          // unknown type — ignore gracefully
          break;
      }
    }

    // mark receipt as used
    await conn.execute(`UPDATE receipts SET used_at = NOW() WHERE id = ?`, [receipt.id]);

    await conn.commit();
    return NextResponse.json({ ok: true, submission_id: submissionId }, { status: 200 });
  } catch (e: any) {
    try {
      await (await getPool()).query("ROLLBACK");
    } catch {}
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    try {
      (conn as any)?.release?.();
    } catch {}
  }
}
