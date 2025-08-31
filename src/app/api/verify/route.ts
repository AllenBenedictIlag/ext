// app/api/verify/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";

/**
 * Outcomes:
 * - invalid : no row
 * - expired : row exists and expires_at < NOW()
 * - used    : row exists and used_at IS NOT NULL
 * - ok      : row exists, not expired, not used
 *
 * If you store UTC timestamps, replace NOW() with UTC_TIMESTAMP().
 */

// ✅ Always use a leading slash for absolute paths
const FORM_PATH = "/customer/feedback";
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

    // Fetch the row (case-insensitive match)
    const [rows] = await pool.execute(
      `
      SELECT
        id,
        receipt_number,
        issued_at,
        expires_at,
        used_at,
        CASE
          WHEN used_at IS NOT NULL THEN 'USED'
          WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'EXPIRED'
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

    if (r.status === "EXPIRED") {
      return NextResponse.json(
        {
          state: "expired" as VerifyState,
          message: "This Survey ID has expired.",
        },
        { status: 410 }, // Gone
      );
    }

    if (r.status === "USED") {
      return NextResponse.json(
        {
          state: "used" as VerifyState,
          message:
            "It seems you've already provided your feedback — we appreciate it! For now, we'll show your summary here.",
          redirect: `${SUMMARY_PATH}?code=${encodeURIComponent(code)}`,
        },
        { status: 409 },
      );
    }

    // UNUSED → ok
    return NextResponse.json(
      {
        state: "ok" as VerifyState,
        redirect: `${FORM_PATH}?code=${encodeURIComponent(code)}`,
      },
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
