import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

/* ---------- Types ---------- */
type AuditAction =
  | "SIGN_IN"
  | "DRAFT_EDIT"
  | "SUBMIT_FOR_REVIEW"
  | "PUBLISH"
  | "ARCHIVE"
  | "ROLE_CHANGE"
  | "EXPORT";

interface CountRow extends RowDataPacket {
  total: number;
}

interface AuditLogRow extends RowDataPacket {
  time: Date;                // occurred_at
  actor: string;             // CONCAT(first_name, ' ', last_name)
  action: AuditAction;       // enum
  target: string;            // target_type#target_id
  notes: string | null;
  ip: string | null;
  user_agent: string | null;
}

/* ---------- Allow-listed sorting ---------- */
const SORT_MAP: Record<string, string> = {
  time: "al.occurred_at",
  actor: "a.last_name, a.first_name",
  action: "al.action",
  target: "al.target_type, al.target_id",
  notes: "al.notes",
  ip: "al.ip",
  user_agent: "al.user_agent",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // pagination
  const page = Math.max(1, Number(searchParams.get("page") ?? 0) || 0);
  const pageSize = Math.min(1000, Math.max(1, Number(searchParams.get("pageSize") ?? 0) || 0));
  const limitParam = Number(searchParams.get("limit") ?? 0) || (pageSize || 500);
  const limit = Math.min(1000, Math.max(1, limitParam));
  const offset =
    Number(searchParams.get("offset") ?? 0) ||
    (page > 0 && pageSize > 0 ? (page - 1) * pageSize : 0);

  // sorting
  const sortKey = (searchParams.get("sort") || "time").toLowerCase();
  const sortSql = SORT_MAP[sortKey] ?? SORT_MAP["time"];
  const dir: "asc" | "desc" =
    (searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  // optional search (manual API use only; UI keeps client search)
  const q = searchParams.get("q")?.trim();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (q) {
    where.push(
      "(CONCAT(a.first_name,' ',a.last_name) LIKE ? OR " +
        "al.action LIKE ? OR " +
        "CONCAT(al.target_type,'#',al.target_id) LIKE ? OR " +
        "al.notes LIKE ? OR " +
        "al.ip LIKE ? OR " +
        "al.user_agent LIKE ?)"
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getPool();

  try {
    // total
    const [countRows] = await pool.query<CountRow[]>(
      `
      SELECT COUNT(*) AS total
      FROM audit_logs al
      JOIN admins a ON a.id = al.actor_admin_id
      ${whereSql}
      `,
      params
    );
    const total = countRows?.[0]?.total ?? 0;

    // data (note the AuditLogRow[] type here)
    const [rows] = await pool.query<AuditLogRow[]>(
      `
      SELECT
        al.occurred_at                             AS time,
        CONCAT(a.first_name,' ',a.last_name)      AS actor,
        al.action                                  AS action,
        CONCAT(al.target_type,'#',al.target_id)    AS target,
        al.notes                                    AS notes,
        al.ip                                       AS ip,
        al.user_agent                               AS user_agent
      FROM audit_logs al
      JOIN admins a ON a.id = al.actor_admin_id
      ${whereSql}
      ORDER BY ${sortSql} ${dir}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return NextResponse.json({
      data: rows.map((r) => ({
        time: new Date(r.time).toISOString(),
        actor: r.actor,
        action: r.action,
        target: r.target,
        notes: r.notes ?? "",
        ip: r.ip,
        user_agent: r.user_agent,
      })),
      pagination: { total, limit, offset },
      meta: { sort: sortKey, dir, ...(q ? { q } : {}) },
    });
  } catch (err) {
    console.error("[audit-log] GET failed:", err);
    return NextResponse.json({ error: "Failed to load audit log." }, { status: 500 });
  }
}
