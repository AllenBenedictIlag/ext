// src/app/api/auth/admins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { recordAuditEvent } from "@/lib/audit-log";

// ------- Zod Schemas -------
const CreateAdminSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(191).trim(),
  password: z.string().min(1).max(255), // TODO: hash later
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  q: z.string().trim().optional(), // search (name/email)
});

// ------- Helpers -------
function ok(data: any, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = ListQuerySchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      role: searchParams.get("role") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });

    const { page, pageSize, role, status, q } = parsed;
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = [];
    const vals: any[] = [];

    if (role) {
      whereParts.push("role = ?");
      vals.push(role);
    }
    if (status) {
      whereParts.push("status = ?");
      vals.push(status);
    }
    if (q && q.length > 0) {
      // Search first/last/concat + email
      whereParts.push(
        "(first_name LIKE ? OR last_name LIKE ? OR CONCAT_WS(' ', first_name, last_name) LIKE ? OR email LIKE ?)"
      );
      vals.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const pool = getPool();

    const [rows] = await pool.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        CONCAT_WS(' ', first_name, last_name) AS name,
        email,
        role,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM admins
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...vals, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM admins ${where}`,
      vals
    );

    const total = Array.isArray(countRows) ? (countRows as any)[0]?.total ?? 0 : 0;

    return ok({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e: any) {
    return err(e?.message ?? "Failed to list admins", 500);
  }
}

// ------- POST /api/auth/admins (create) -------
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = CreateAdminSchema.parse(json);

    const pool = getPool();

    // Ensure unique email
    const [existsRows] = await pool.query(
      `SELECT id FROM admins WHERE email = ? LIMIT 1`,
      [body.email]
    );
    if (Array.isArray(existsRows) && existsRows.length > 0) {
      return err("Email already exists", 409);
    }

    const [result] = await pool.execute(
      `
      INSERT INTO admins (
        first_name,
        last_name,
        email,
        password,
        role,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?);
    `,
      [
        body.first_name,
        body.last_name,
        body.email,
        body.password, // TODO: hash later
        body.role,
        body.status,
      ]
    );

    // @ts-ignore - mysql2 ResultSetHeader
    const insertedId = result?.insertId;

    const [rows] = await pool.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        CONCAT_WS(' ', first_name, last_name) AS name,
        email,
        role,
        status,
        NULL AS last_login_at, -- return null for brand-new accounts
        created_at,
        updated_at
      FROM admins
      WHERE id = ? LIMIT 1
    `,
      [insertedId]
    );

    const createdAdmin = Array.isArray(rows) ? rows[0] : null;
    const createdId = Number(insertedId) || 0;

    await recordAuditEvent({
      req,
      action: "ROLE_CHANGE",
      targetType: "admin",
      targetId: createdId || body.email,
      notes: `Created admin ${body.email} (role=${body.role}, status=${body.status})`,
    });

    return ok({ data: createdAdmin }, 201);
  } catch (e: any) {
    return err(e?.message ?? "Failed to create admin", 500);
  }
}

/*
-- If you've ALREADY DROPPED the legacy `name` column,
-- change the INSERT above to this simpler variant:

INSERT INTO admins (
  first_name,
  last_name,
  email,
  password,
  role,
  status
)
VALUES (?, ?, ?, ?, ?, ?);

-- ...and remove the `name` column from the SELECT lists.
*/
