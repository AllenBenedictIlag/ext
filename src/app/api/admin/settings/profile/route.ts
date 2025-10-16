import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { AuthError, requireAdminSession } from "@/lib/api-auth";
import { recordAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const ProfileSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
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
    const body = ProfileSchema.parse(await req.json());

    const pool = getPool();
    const [result] = await pool.execute(
      `
        UPDATE admins
           SET first_name = ?, last_name = ?, updated_at = NOW()
         WHERE id = ?
         LIMIT 1
      `,
      [body.first_name, body.last_name, admin.id]
    );

    // @ts-ignore mysql2 types
    if (!result || result.affectedRows === 0) {
      return err("Failed to update profile", 500);
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          first_name,
          last_name,
          email,
          role,
          status,
          created_at,
          updated_at
        FROM admins
        WHERE id = ?
        LIMIT 1
      `,
      [admin.id]
    );

    const updated = Array.isArray(rows) && rows[0] ? rows[0] : null;

    await recordAuditEvent({
      req,
      action: "PROFILE_UPDATE",
      targetType: "admin",
      targetId: admin.id,
      notes: `Updated profile name to ${body.first_name} ${body.last_name}`,
    });

    return ok({ data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return err(error.message, error.status);
    }
    if (error instanceof z.ZodError) {
      return err("Invalid profile payload", 422);
    }
    console.error("[settings.profile] PUT failed", error);
    return err("Failed to update profile", 500);
  }
}
