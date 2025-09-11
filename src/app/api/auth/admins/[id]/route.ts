import { NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";

const IdParam = z.object({ id: z.coerce.number().int().positive() });

const UpdateAdminSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(191).optional(),
  password: z.string().min(1).max(255).optional(), // TODO: hash later
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ------- GET /api/auth/admins/:id -------
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = IdParam.parse(params);
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

// ------- PATCH /api/auth/admins/:id -------
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = IdParam.parse(params);
    const json = await req.json();
    const body = UpdateAdminSchema.parse(json);

    if (Object.keys(body).length === 0) {
      return err("No fields to update", 400);
    }

    const setParts: string[] = [];
    const vals: any[] = [];

    if (body.name !== undefined) {
      setParts.push("name = ?");
      vals.push(body.name.trim());
    }
    if (body.email !== undefined) {
      setParts.push("email = ?");
      vals.push(body.email.trim());
    }
    if (body.password !== undefined) {
      setParts.push("password = ?");
      vals.push(body.password); // TODO: hash later
    }
    if (body.role !== undefined) {
      setParts.push("role = ?");
      vals.push(body.role);
    }
    if (body.status !== undefined) {
      setParts.push("status = ?");
      vals.push(body.status);
    }

    const pool = getPool();

    // Unique email check if updating email
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
      [...vals, id]
    );

    // @ts-ignore
    if (result?.affectedRows === 0) return err("Not found", 404);

    const [rows] = await pool.query(
      `SELECT id, name, email, role, status, last_login_at, created_at, updated_at
       FROM admins WHERE id = ? LIMIT 1`,
      [id]
    );

    return ok({ data: Array.isArray(rows) ? rows[0] : null });
  } catch (e: any) {
    return err(e?.message ?? "Failed to update admin", 500);
  }
}

// ------- DELETE /api/auth/admins/:id -------
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = IdParam.parse(params);
    const pool = getPool();

    const [result] = await pool.execute(`DELETE FROM admins WHERE id = ?`, [
      id,
    ]);
    // @ts-ignore
    if (result?.affectedRows === 0) return err("Not found", 404);

    return ok({ success: true });
  } catch (e: any) {
    return err(e?.message ?? "Failed to delete admin", 500);
  }
}
