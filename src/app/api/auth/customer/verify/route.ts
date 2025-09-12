import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";

const FORM_PATH = "/feedback";
const SUMMARY_PATH = "/feedback/summary";

const bodySchema = z.object({
  receipt_number: z.string().min(3).max(64).trim(),
});

type VerifyState = "invalid" | "expired" | "used" | "ok";

export async function POST(req: Request) {
  try {
    const { receipt_number } = bodySchema.parse(await req.json());
    const code = receipt_number.toUpperCase();

    const pool = getPool();

    // 1) fetch receipt row
    const [rows] = await pool.execute(
      `
      SELECT
        id, receipt_number, issued_at, expires_at, used_at,
        CASE
          WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'EXPIRED'
          WHEN used_at IS NOT NULL THEN 'USED'
          ELSE 'UNUSED'
        END AS status
      FROM receipts
      WHERE UPPER(receipt_number) = ?
      LIMIT 1
      `,
      [code],
    );

    const r = (rows as any[])[0] as
      | {
          id: number;
          receipt_number: string;
          issued_at: string;
          expires_at: string | null;
          used_at: string | null;
          status: "USED" | "EXPIRED" | "UNUSED";
        }
      | undefined;

    if (!r) {
      return NextResponse.json(
        { state: "invalid" as VerifyState, message: "Invalid control number." },
        { status: 404 },
      );
    }

    // 2) explicit expired check
    if (r.expires_at && new Date(r.expires_at) < new Date()) {
      return NextResponse.json(
        { state: "expired" as VerifyState, message: "This Survey ID has expired." },
        { status: 410 },
      );
    }

    // 3) also treat "already has a submission" as USED
    const [subs] = await pool.execute(
      `SELECT id FROM submissions WHERE receipt_id = ? LIMIT 1`,
      [r.id],
    );
    const hasSubmission = Array.isArray(subs) && (subs as any[]).length > 0;

    if (r.used_at || hasSubmission) {
      return NextResponse.json(
        {
          state: "used" as VerifyState,
          message:
            "It seems you've already provided your feedback — we appreciate it! For now, we'll show your summary here.",
          redirect: `${SUMMARY_PATH}?code=${encodeURIComponent(code)}`,
        },
        { status: 200 }, // OK is fine; your UI reads .state
      );
    }

    // 4) OK → proceed
    return NextResponse.json(
      { state: "ok" as VerifyState, redirect: `${FORM_PATH}?code=${encodeURIComponent(code)}` },
      { status: 200 },
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { state: "invalid" as VerifyState, message: "Invalid payload.", details: err.flatten() },
        { status: 400 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
