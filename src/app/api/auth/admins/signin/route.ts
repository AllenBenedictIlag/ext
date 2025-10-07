import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { signToken } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { recordAdminLogin, recordAuditEvent } from "@/lib/audit-log";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = SignInSchema.parse(await req.json());

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

    if (admin.password !== body.password) {
      return err("Invalid email or password", 401);
    }

    const adminId = Number(admin.id);
    const name = `${admin.first_name ?? ""} ${admin.last_name ?? ""}`.trim();
    const token = await signToken({
      id: adminId,
      role: admin.role as "ADMIN" | "SUPER_ADMIN",
      email: admin.email,
      name,
    });

    const res = ok({
      data: {
        id: adminId,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });

    setSessionCookie(res, token);

    await Promise.allSettled([
      recordAdminLogin({ req, adminId }),
      recordAuditEvent({
        req,
        actorAdminId: adminId,
        action: "SIGN_IN",
        targetType: "admin",
        targetId: adminId,
        notes: "Admin signed in",
      }),
    ]);

    return res;
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return err("Invalid sign-in payload", 400);
    }
    return err(e?.message ?? "Failed to sign in", 500);
  }
}
