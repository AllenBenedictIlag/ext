import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { signToken } from "@/lib/auth";                 // ✅ NEW
import { setSessionCookie } from "@/lib/session";       // ✅ NEW

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const jsonBody = await req.json();
    const body = SignInSchema.parse(jsonBody);

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

    // NOTE: plain-text compare for now (you mentioned no security yet).
    if (admin.password !== body.password) {
      return err("Invalid email or password", 401);
    }

    // ✅ Create a JWT session (8h by default) and set it on an httpOnly cookie
    const name = `${admin.first_name ?? ""} ${admin.last_name ?? ""}`.trim();
    const token = await signToken({
      id: Number(admin.id),
      role: admin.role as "ADMIN" | "SUPER_ADMIN",
      email: admin.email,
      name,
    });

    const res = json({
      data: {
        id: admin.id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });

    setSessionCookie(res, token); // ✅ attach cookie to response
    return res;
  } catch (e: any) {
    return err(e?.message ?? "Failed to sign in", 500);
  }
}
