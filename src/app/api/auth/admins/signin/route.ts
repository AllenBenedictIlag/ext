import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = SignInSchema.parse(json);

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, password, role, status
       FROM admins
       WHERE email = ? LIMIT 1`,
      [body.email.trim()]
    );

    const admin = Array.isArray(rows) ? (rows as any)[0] : null;
    if (!admin) return err("Invalid email or password", 401);
    if (admin.status !== "ACTIVE") return err("Account is inactive", 403);

    // Plain-text compare for now (you said no security yet).
    if (admin.password !== body.password) {
      return err("Invalid email or password", 401);
    }

    // Normally you'd set a cookie/session here. For now, just return the profile.
    return ok({
      data: {
        id: admin.id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (e: any) {
    return err(e?.message ?? "Failed to sign in", 500);
  }
}
