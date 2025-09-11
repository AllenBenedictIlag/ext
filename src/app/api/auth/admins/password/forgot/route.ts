import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getPool } from "@/lib/database";

const Body = z.object({ email: z.string().email() });

function ok(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { email } = Body.parse(json);

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, status FROM admins WHERE email = ? LIMIT 1`,
      [email.trim()]
    );
    const admin = Array.isArray(rows) ? (rows as any)[0] : null;

    // Always respond success to avoid leaking which emails exist.
    if (!admin || admin.status !== "ACTIVE") {
      return ok({ message: "If the email exists, a reset link was generated." });
    }

    // Invalidate any previous tokens for this admin (optional but clean)
    await pool.execute(
      `DELETE FROM admin_password_resets WHERE admin_id = ?`,
      [admin.id]
    );

    const token = crypto.randomBytes(32).toString("hex"); // 64 chars
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

    await pool.execute(
      `INSERT INTO admin_password_resets (admin_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [admin.id, token, expiresAt]
    );

    // In a real app you’d email this. For now, return the URL so you can click it.
    const resetUrl = `/reset?token=${token}`;

    return ok({
      message: "If the email exists, a reset link was generated.",
      resetUrl, // temporary: UI will show this
    });
  } catch (e: any) {
    return err(e?.message ?? "Failed to request password reset", 500);
  }
}
