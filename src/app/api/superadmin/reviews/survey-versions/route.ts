import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise"; // ⬅️ add this

type SortBy =
  | "status"
  | "version"
  | "title"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "id";

const ALLOWED_SORT: Record<SortBy, string> = {
  status: "s.status",
  version: "s.version",
  title: "s.title",
  published_at: "s.published_at",
  created_at: "s.created_at",
  updated_at: "s.updated_at",
  id: "s.id",
};

// Row typings that satisfy mysql2 generics
interface CountRow extends RowDataPacket {
  total: number;
}
interface SurveyRow extends RowDataPacket {
  id: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  title: string;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toInt(v: string | null, fallback: number, min = 1, max = 1000): number {
  const n = v ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = toInt(searchParams.get("page"), 1, 1, 1_000_000);
    const pageSize = toInt(searchParams.get("pageSize"), 50, 1, 1000);
    const rawSortBy = (searchParams.get("sortBy") || "updated_at") as SortBy;
    const sortBy: SortBy = (rawSortBy in ALLOWED_SORT ? rawSortBy : "updated_at");
    const sortDir = (searchParams.get("sortDir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const q = (searchParams.get("q") || "").trim();
    const qnum = q && /^\d+$/.test(q) ? Number(q) : null;

    const pool = getPool();

    const where: string[] = [];
    const params: Array<string | number | null> = [];

    if (q) {
      where.push("(s.title LIKE ? OR s.status LIKE ? OR (? IS NOT NULL AND s.version = ?))");
      params.push(`%${q}%`, `%${q}%`, qnum, qnum);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // 🔧 Use RowDataPacket-based generics
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM surveys s ${whereSql}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    const offset = (page - 1) * pageSize;

    const [rowsRaw] = await pool.query<SurveyRow[]>(
      `
      SELECT
        s.id,
        s.status,
        s.version,
        s.title,
        s.published_at,
        s.created_at,
        s.updated_at
      FROM surveys s
      ${whereSql}
      ORDER BY ${ALLOWED_SORT[sortBy]} ${sortDir}
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const toIso = (d: unknown): string | null => {
      if (d == null) return null;
      if (d instanceof Date) return d.toISOString();
      const s = String(d);
      const dt = new Date(s);
      return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
    };

    const rows = rowsRaw.map((r) => ({
      id: Number(r.id),
      status: r.status,
      version: Number(r.version),
      title: String(r.title),
      published_at: toIso(r.published_at),
      created_at: toIso(r.created_at)!,
      updated_at: toIso(r.updated_at)!,
      draft_owner: null as string | null,
      diff_link: `/admin/surveys/${Number(r.id)}/diff`,
    }));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({ page, pageSize, total, totalPages, rows }, { status: 200 });
  } catch (err) {
    console.error("[survey-versions] GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
