import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { recordAuditEvent } from "@/lib/audit-log";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

type SortKey =
  | "admin_id"
  | "name"
  | "email"
  | "role"
  | "status"
  | "created_at"
  | "updated_at";

const SORT_MAP: Record<SortKey, string> = {
  admin_id: "a.id",
  name: "name",
  email: "a.email",
  role: "a.role",
  status: "a.status",
  created_at: "a.created_at",
  updated_at: "a.updated_at",
};

interface TotalRow extends RowDataPacket {
  total: number;
}

export interface UsersRow extends RowDataPacket {
  admin_id: number;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
}

type InviteBody = {
  action: "invite";
  first_name: string;
  last_name: string;
  email: string;
  role?: "ADMIN" | "SUPER_ADMIN";
  send_later?: boolean;
};

type UpdateStatusBody = {
  action: "update_status";
  admin_id: number;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

type ChangeRoleBody = {
  action: "change_role";
  admin_id: number;
  role: "ADMIN" | "SUPER_ADMIN";
};

type ResetPasswordBody = {
  action: "reset_password";
  admin_id: number;
};

type PostBody = InviteBody | UpdateStatusBody | ChangeRoleBody | ResetPasswordBody;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(0, Number(searchParams.get("pageSize") ?? "0"));
    const limitParam = Number(searchParams.get("limit") ?? "500");
    const offsetParam = Number(searchParams.get("offset") ?? "0");

    const usePage = pageSize > 0;
    const limit = usePage ? pageSize : Math.min(Math.max(1, limitParam), 2000);
    const offset = usePage ? (page - 1) * pageSize : Math.max(0, offsetParam);

    const sortParam = (searchParams.get("sort") ?? "updated_at") as SortKey;
    const sort: SortKey = (Object.keys(SORT_MAP) as SortKey[]).includes(sortParam)
      ? sortParam
      : "updated_at";

    const dirParam = (searchParams.get("dir") ?? "desc").toLowerCase();
    const dir: "ASC" | "DESC" = dirParam === "asc" ? "ASC" : "DESC";

    const q = searchParams.get("q");
    const hasQ = !!q && q.trim().length > 0;
    const where = hasQ
      ? "WHERE (a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ?)"
      : "";

    const pool = getPool();

    const totalSql = `SELECT COUNT(*) AS total FROM admins a ${where}`;
    const totalParams = hasQ ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const [totalRows] = await pool.query<TotalRow[]>(totalSql, totalParams);
    const total = totalRows[0]?.total ?? 0;

    const orderBy = SORT_MAP[sort];
    const rowsSql = `
      SELECT
        a.id AS admin_id,
        CONCAT(a.first_name, ' ', a.last_name) AS name,
        a.email,
        a.role,
        a.status,
        a.created_at,
        a.updated_at
      FROM admins a
      ${where}
      ORDER BY ${orderBy} ${dir}
      LIMIT ? OFFSET ?
    `;
    const rowsParams = hasQ
      ? [`%${q}%`, `%${q}%`, `%${q}%`, limit, offset]
      : [limit, offset];

    const [rows] = await pool.query<UsersRow[]>(rowsSql, rowsParams);

    return NextResponse.json(
      {
        data: rows,
        page: usePage ? page : 1,
        pageSize: usePage ? pageSize : limit,
        total,
        totalPages: usePage ? Math.max(1, Math.ceil(total / (pageSize || 1))) : 1,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;
    const pool = getPool();

    const selectOne = async (id: number) => {
      const [r] = await pool.query<UsersRow[]>(
        `
        SELECT
          a.id AS admin_id,
          CONCAT(a.first_name, ' ', a.last_name) AS name,
          a.email, a.role, a.status, a.created_at, a.updated_at
        FROM admins a
        WHERE a.id = ?
        `,
        [id]
      );
      return r[0] ?? null;
    };

    const makeTemp = () =>
      Math.random().toString(36).slice(2, 6) +
      "-" +
      Math.random().toString(36).slice(2, 6) +
      "-" +
      Math.random().toString(36).slice(2, 6);

    switch (body.action) {
      case "invite": {
        const role = body.role ?? "ADMIN";
        const temp = makeTemp();
        const insertSql = `
          INSERT INTO admins (first_name, last_name, email, password, role, status)
          VALUES (?, ?, ?, ?, ?, 'ACTIVE')
        `;
        const [res] = await pool.query<ResultSetHeader>(insertSql, [
          body.first_name,
          body.last_name,
          body.email,
          temp,
          role,
        ]);

        const created = await selectOne(res.insertId);

        await recordAuditEvent({
          req,
          action: "ROLE_CHANGE",
          targetType: "admin",
          targetId: res.insertId || body.email,
          notes: `Invited admin ${body.email} (role=${role})`,
        });

        return NextResponse.json(
          { ok: true, data: created, temp_password: temp },
          { status: 201 }
        );
      }

      case "update_status": {
        const sql = `UPDATE admins SET status = ? WHERE id = ?`;
        const [res] = await pool.query<ResultSetHeader>(sql, [
          body.status,
          body.admin_id,
        ]);
        if (res.affectedRows === 0) {
          return NextResponse.json({ ok: false }, { status: 404 });
        }
        const row = await selectOne(body.admin_id);

        await recordAuditEvent({
          req,
          action: "ROLE_CHANGE",
          targetType: "admin",
          targetId: body.admin_id,
          notes: `Updated status for admin ${body.admin_id} -> ${body.status}`,
        });

        return NextResponse.json({ ok: true, data: row }, { status: 200 });
      }

      case "change_role": {
        const sql = `UPDATE admins SET role = ? WHERE id = ?`;
        const [res] = await pool.query<ResultSetHeader>(sql, [
          body.role,
          body.admin_id,
        ]);
        if (res.affectedRows === 0) {
          return NextResponse.json({ ok: false }, { status: 404 });
        }
        const row = await selectOne(body.admin_id);

        await recordAuditEvent({
          req,
          action: "ROLE_CHANGE",
          targetType: "admin",
          targetId: body.admin_id,
          notes: `Changed role for admin ${body.admin_id} -> ${body.role}`,
        });

        return NextResponse.json({ ok: true, data: row }, { status: 200 });
      }

      case "reset_password": {
        const temp = makeTemp();
        const sql = `UPDATE admins SET password = ? WHERE id = ?`;
        const [res] = await pool.query<ResultSetHeader>(sql, [temp, body.admin_id]);
        if (res.affectedRows === 0) {
          return NextResponse.json({ ok: false }, { status: 404 });
        }

        await recordAuditEvent({
          req,
          action: "ROLE_CHANGE",
          targetType: "admin",
          targetId: body.admin_id,
          notes: `Reset password for admin ${body.admin_id}`,
        });

        return NextResponse.json(
          { ok: true, admin_id: body.admin_id, temp_password: temp },
          { status: 200 }
        );
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
