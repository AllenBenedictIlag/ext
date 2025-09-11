import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";

const Body = z.object({
  token: z.string().length(64),
  password: z.string().min(1).max(255), // plain for now
});

function ok(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { token, password } = Body.parse(json);

    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT apr.id as reset_id, apr.admin_id, apr.expires_at, apr.used_at,
              a.id as admin_id
       FROM admin_password_resets apr
       JOIN admins a ON a.id = apr.admin_id
       WHERE apr.token = ? LIMIT 1`,
      [token]
    );
    const rec = Array.isArray(rows) ? (rows as any)[0] : null;
    if (!rec) return err("Invalid or expired token", 400);

    if (rec.used_at) return err("Token already used", 400);
    if (new Date(rec.expires_at).getTime() < Date.now()) {
      return err("Token expired", 400);
    }

    // Update password (plain for now — swap to bcrypt later)
    await pool.execute(
      `UPDATE admins SET password = ? WHERE id = ?`,
      [password, rec.admin_id]
    );

    // Mark token used
    await pool.execute(
      `UPDATE admin_password_resets SET used_at = NOW() WHERE id = ?`,
      [rec.reset_id]
    );

    return ok({ success: true });
  } catch (e: any) {
    return err(e?.message ?? "Failed to reset password", 500);
  }
}
