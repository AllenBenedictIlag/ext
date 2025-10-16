import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { AuthError, requireAdminSession } from "@/lib/api-auth";
import { recordAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const PasswordSchema = z.object({
  current: z.string().min(1, "Current password is required"),
  next: z.string().min(8, "New password must be at least 8 characters"),
});

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdminSession(req);
    const body = PasswordSchema.parse(await req.json());

    const pool = getPool();
    const [rows] = await pool.query(
      `
        SELECT password
          FROM admins
         WHERE id = ?
         LIMIT 1
      `,
      [admin.id]
    );

    const currentRow = Array.isArray(rows) && rows[0] ? (rows[0] as { password: string }) : null;
    if (!currentRow) {
      return err("Account not found", 404);
    }
    if (currentRow.password !== body.current) {
      return err("Current password is incorrect", 403);
    }

    await pool.execute(
      `
        UPDATE admins
           SET password = ?, updated_at = NOW()
         WHERE id = ?
         LIMIT 1
      `,
      [body.next, admin.id]
    );

    await recordAuditEvent({
      req,
      action: "PASSWORD_CHANGE",
      targetType: "admin",
      targetId: admin.id,
      notes: "Admin updated their password",
    });

    return ok({ data: { success: true } });
  } catch (error) {
    if (error instanceof AuthError) {
      return err(error.message, error.status);
    }
    if (error instanceof z.ZodError) {
      return err("Invalid password payload", 422);
    }
    console.error("[settings.password] PUT failed", error);
    return err("Failed to update password", 500);
  }
}
