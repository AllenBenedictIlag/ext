import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { recordAuditEvent } from "@/lib/audit-log";

const IdParam = z.object({ id: z.coerce.number().int().positive() });

const UpdateAdminSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(191).optional(),
  password: z.string().min(1).max(255).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveAdminId(context: RouteContext): Promise<number> {
  const params = await context.params;
  const parsed = IdParam.parse(params);
  return parsed.id;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveAdminId(context);
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, name, email, role, status, last_login_at, created_at, updated_at
       FROM admins WHERE id = ? LIMIT 1`,
      [id]
    );
    const admin = Array.isArray(rows) ? rows[0] : null;
    if (!admin) return err("Not found", 404);
    return ok({ data: admin });
  } catch (e: any) {
    return err(e?.message ?? "Failed to fetch admin", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveAdminId(context);
    const body = UpdateAdminSchema.parse(await req.json());

    if (Object.keys(body).length === 0) {
      return err("No fields to update", 400);
    }

    const setParts: string[] = [];
    const values: unknown[] = [];
    const changes: string[] = [];

    if (body.name !== undefined) {
      setParts.push("name = ?");
      values.push(body.name.trim());
      changes.push("name");
    }
    if (body.email !== undefined) {
      setParts.push("email = ?");
      values.push(body.email.trim());
      changes.push("email");
    }
    if (body.password !== undefined) {
      setParts.push("password = ?");
      values.push(body.password);
      changes.push("password");
    }
    if (body.role !== undefined) {
      setParts.push("role = ?");
      values.push(body.role);
      changes.push(`role=${body.role}`);
    }
    if (body.status !== undefined) {
      setParts.push("status = ?");
      values.push(body.status);
      changes.push(`status=${body.status}`);
    }

    const pool = getPool();

    if (body.email) {
      const [existsRows] = await pool.query(
        `SELECT id FROM admins WHERE email = ? AND id <> ? LIMIT 1`,
        [body.email.trim(), id]
      );
      if (Array.isArray(existsRows) && existsRows.length > 0) {
        return err("Email already exists", 409);
      }
    }

    const [result] = await pool.execute(
      `UPDATE admins SET ${setParts.join(", ")} WHERE id = ?`,
      [...values, id]
    );

    // @ts-ignore mysql2 typing
    if (result?.affectedRows === 0) return err("Not found", 404);

    const [rows] = await pool.query(
      `SELECT id, name, email, role, status, last_login_at, created_at, updated_at
       FROM admins WHERE id = ? LIMIT 1`,
      [id]
    );

    if (changes.length > 0) {
      await recordAuditEvent({
        req,
        action: "ROLE_CHANGE",
        targetType: "admin",
        targetId: id,
        notes: `Updated admin ${id}: ${changes.join(", ")}`,
      });
    }

    return ok({ data: Array.isArray(rows) ? rows[0] : null });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return err("Invalid payload", 400);
    }
    return err(e?.message ?? "Failed to update admin", 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveAdminId(context);
    const pool = getPool();

    const [result] = await pool.execute(`DELETE FROM admins WHERE id = ?`, [id]);
    // @ts-ignore mysql2 typing
    if (result?.affectedRows === 0) return err("Not found", 404);

    await recordAuditEvent({
      req,
      action: "ROLE_CHANGE",
      targetType: "admin",
      targetId: id,
      notes: `Deleted admin ${id}`,
    });

    return ok({ success: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return err("Invalid admin id", 400);
    }
    return err(e?.message ?? "Failed to delete admin", 500);
  }
}
