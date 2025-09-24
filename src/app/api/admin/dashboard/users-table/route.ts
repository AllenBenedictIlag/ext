// src/app/api/admin/dashboard/users-table/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

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
  name: "name", // alias from SELECT
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination knobs (support either page/pageSize OR offset/limit)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.max(0, Number(searchParams.get("pageSize") ?? "0")); // 0 = unused
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

    // -------- total
    const totalSql = `
      SELECT COUNT(*) AS total
      FROM admins a
      ${where}
    `;
    const totalParams = hasQ ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
    const [totalRows] = await pool.query<TotalRow[]>(totalSql, totalParams);
    const total = totalRows[0]?.total ?? 0;

    // -------- rows
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
        totalPages: usePage ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}
