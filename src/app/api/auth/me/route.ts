import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { AUTH_COOKIE, clearSessionCookie } from "@/lib/session";
import { getPool } from "@/lib/database";

function ok(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  // ✅ Read cookie from the incoming request (no cookies())
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return err("Not authenticated", 401);

  try {
    // ✅ Validate JWT from cookie
    const payload = await verifyToken(token);

    // ✅ (Recommended) Get fresh user (role/status may change)
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, role, status
       FROM admins
       WHERE id = ? LIMIT 1`,
      [payload.id]
    );
    const admin = Array.isArray(rows) ? (rows as any)[0] : null;

    if (!admin) {
      const res = err("Session user not found", 401);
      clearSessionCookie(res);
      return res;
    }
    if (admin.status !== "ACTIVE") {
      const res = err("Account is inactive", 403);
      clearSessionCookie(res);
      return res;
    }

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
  } catch {
    const res = err("Invalid or expired session", 401);
    clearSessionCookie(res);
    return res;
  }
}
