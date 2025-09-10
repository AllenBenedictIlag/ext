import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";

type Likert = "1" | "2" | "3" | "4";
type YesNo = "yes" | "no" | "";

type Body = {
  code: string;
  accurate?: YesNo;
  overall?: Likert;
  speed?: Likert;
  friendliness?: Likert;
  quality?: Likert;
  taste?: Likert;
  ambience?: Likert;
  cleanliness?: Likert;
  revisit?: YesNo;
  comments?: string;
};

const CODE_PATTERN = /^[A-Z0-9-]{4,64}$/;

export async function POST(req: Request) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const body = (await req.json()) as Body;
    if (!body?.code || !CODE_PATTERN.test(body.code)) {
      return NextResponse.json({ error: "Missing/invalid code" }, { status: 400 });
    }

    // 1) receipt
    const [rrows] = await conn.execute(
      `SELECT id, expires_at, used_at FROM receipts WHERE UPPER(receipt_number) = UPPER(?) LIMIT 1`,
      [body.code],
    ) as any[];
    if (!rrows || rrows.length === 0) {
      return NextResponse.json({ error: "Invalid control number" }, { status: 404 });
    }
    const receipt = rrows[0] as { id: number; expires_at: string | null; used_at: string | null };

    // 2) expiry
    if (receipt.expires_at && new Date(receipt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Expired control number" }, { status: 410 });
    }

    // 3) guard used/submitted
    const [srows] = await conn.execute(
      `SELECT id FROM submissions WHERE receipt_id = ? LIMIT 1`,
      [receipt.id],
    ) as any[];
    if (receipt.used_at || (srows && srows.length > 0)) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    // 4) latest published survey
    const [svyRows] = await conn.execute(
      `SELECT id, title, version
         FROM surveys
        WHERE status = 'PUBLISHED'
        ORDER BY version DESC, id DESC
        LIMIT 1`,
    ) as any[];
    if (!svyRows || svyRows.length === 0) {
      return NextResponse.json({ error: "No published survey configured" }, { status: 500 });
    }
    const survey = svyRows[0] as { id: number; title: string; version: number };

    // 5) questions + options
    const [qrows] = await conn.execute(
      `SELECT id, question_key, question_type FROM questions WHERE survey_id = ? ORDER BY display_order ASC`,
      [survey.id],
    ) as any[];
    const keyToQ: Record<string, { id: number; type: "LIKERT" | "YES_NO" | "TEXT" }> = {};
    for (const q of qrows as any[]) keyToQ[q.question_key] = { id: q.id, type: q.question_type };

    const ids = (qrows as any[]).map((q) => q.id);
    const [orows] = ids.length
      ? await conn.query(
          `SELECT id, question_id, option_value FROM question_options WHERE question_id IN (${ids.join(",")})`,
        )
      : ([[]] as any);
    const optionsByQ = new Map<number, { id: number; value: string }[]>();
    for (const o of (orows as any[])) {
      const arr = optionsByQ.get(o.question_id) ?? [];
      arr.push({ id: o.id, value: String(o.option_value) });
      optionsByQ.set(o.question_id, arr);
    }

    await conn.beginTransaction();

    // 6) submission
    const [insSub] = await conn.execute(
      `INSERT INTO submissions (receipt_id, survey_id, submitted_at) VALUES (?, ?, NOW())`,
      [receipt.id, survey.id],
    ) as any[];
    const submissionId = (insSub as any).insertId as number;

    async function putAnswer(qKey: string, optOrText: { option?: string; text?: string }) {
      const q = keyToQ[qKey];
      if (!q) return;

      let option_id: number | null = null;
      let text_value: string | null = null;

      if (optOrText.option != null) {
        const opts = optionsByQ.get(q.id) || [];
        const match = opts.find((o) => o.value === String(optOrText.option));
        if (!match) return;
        option_id = match.id;
      }
      if (optOrText.text != null) {
        text_value = optOrText.text.trim() || null;
      }

      await conn.execute(
        `INSERT INTO answers (submission_id, question_id, option_id, text_value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [submissionId, q.id, option_id, text_value],
      );
    }

    await putAnswer("accurate",     { option: body.accurate === "yes" ? "yes" : body.accurate === "no" ? "no" : undefined });
    await putAnswer("overall",      { option: body.overall });
    await putAnswer("speed",        { option: body.speed });
    await putAnswer("friendliness", { option: body.friendliness });
    await putAnswer("quality",      { option: body.quality });
    await putAnswer("taste",        { option: body.taste });
    await putAnswer("ambience",     { option: body.ambience });
    await putAnswer("cleanliness",  { option: body.cleanliness });
    await putAnswer("revisit",      { option: body.revisit === "yes" ? "yes" : body.revisit === "no" ? "no" : undefined });
    await putAnswer("comments",     { text: body.comments ?? "" });

    await conn.execute(`UPDATE receipts SET used_at = NOW() WHERE id = ?`, [receipt.id]);

    await conn.commit();
    return NextResponse.json({ ok: true, submission_id: submissionId }, { status: 200 });
  } catch (e: any) {
    try { await (await getPool()).query("ROLLBACK"); } catch {}
    if (e?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    try { (conn as any)?.release?.(); } catch {}
  }
}
