// src/app/api/admin/dashboard/receipts-table/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

type Status = "USED" | "EXPIRED_UNUSED" | "NOT_USED";

/** Rows must extend RowDataPacket for mysql2 query<T>() */
interface RowSQL extends RowDataPacket {
  receipt_number: string;
  issued_at: Date;
  expires_at: Date;
  used_at: Date | null;
  status: Status;
  days_to_use: number | null;
  submission_id: number | null;
  age_days: number;
}
interface CountRow extends RowDataPacket {
  total: number;
}

const STATUS_EXPR = `
  CASE
    WHEN r.used_at IS NOT NULL THEN 'USED'
    WHEN NOW() > r.expires_at THEN 'EXPIRED_UNUSED'
    ELSE 'NOT_USED'
  END
`;

const SORT_MAP = {
  receipt_number: "r.receipt_number",
  issued_at: "r.issued_at",
  expires_at: "r.expires_at",
  used_at: "r.used_at",
  status: "status",
  days_to_use: "days_to_use",
  submission_id: "submission_id",
  age_days: "age_days",
} as const;
type SortKey = keyof typeof SORT_MAP;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limitParam = Number(searchParams.get("limit") ?? 500);
    const offsetParam = Number(searchParams.get("offset") ?? 0);
    const sortParam = (searchParams.get("sort") ?? "issued_at").toLowerCase() as string;
    const dirParam = (searchParams.get("dir") ?? "desc").toLowerCase();

    const limit = clamp(Number.isFinite(limitParam) ? limitParam : 500, 1, 5000);
    const offset = Math.max(0, Number.isFinite(offsetParam) ? offsetParam : 0);
    const sortCol = SORT_MAP[(sortParam as SortKey)] ?? SORT_MAP.issued_at;
    const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc";

    const pool = getPool();

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (q) {
      // match receipt_number (LIKE) or exact status
      where.push(`(r.receipt_number LIKE ? OR ${STATUS_EXPR} = ?)`);
      params.push(`%${q}%`, q.toUpperCase());
    }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const baseSelect = `
      SELECT
        r.receipt_number,
        r.issued_at,
        r.expires_at,
        r.used_at,
        ${STATUS_EXPR} AS status,
        CASE WHEN r.used_at IS NOT NULL
             THEN TIMESTAMPDIFF(DAY, r.issued_at, r.used_at)
        END AS days_to_use,
        s.id AS submission_id,
        TIMESTAMPDIFF(DAY, r.issued_at, NOW()) AS age_days
      FROM receipts r
      LEFT JOIN submissions s ON s.receipt_id = r.id
      ${whereSQL}
    `;

    // Count
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM (${baseSelect}) AS t`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    // Data
    const [rows] = await pool.query<RowSQL[]>(
      `${baseSelect} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const data = rows.map((r) => ({
      receipt_number: r.receipt_number,
      issued_at: r.issued_at.toISOString(),
      expires_at: r.expires_at.toISOString(),
      used_at: r.used_at ? r.used_at.toISOString() : null,
      status: r.status,
      days_to_use: r.days_to_use ?? null,
      submission_id: r.submission_id ?? null,
      age_days: r.age_days,
    }));

    return NextResponse.json({
      data,
      meta: { total, limit, offset, sort: sortParam, dir, q: q || null },
    });
  } catch (err) {
    console.error("receipts-table GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
