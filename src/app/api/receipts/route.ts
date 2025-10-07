import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { recordAuditEvent } from "@/lib/audit-log";

const createSchema = z.object({
  receipt_number: z.string().min(3).max(64).trim(),
  issued_at: z.string().datetime().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function POST(req: NextRequest) {
  try {
    const body = createSchema.parse(await req.json());
    const pool = getPool();

    let insertId: number | null = null;
    if (body.issued_at) {
      const [result] = await pool.execute(
        `INSERT INTO receipts (receipt_number, issued_at) VALUES (?, ?)`,
        [body.receipt_number.trim(), body.issued_at]
      );
      insertId = Number((result as any).insertId) || null;
    } else {
      const [result] = await pool.execute(
        `INSERT INTO receipts (receipt_number) VALUES (?)`,
        [body.receipt_number.trim()]
      );
      insertId = Number((result as any).insertId) || null;
    }

    await recordAuditEvent({
      req,
      action: "DRAFT_EDIT",
      targetType: "receipt",
      targetId: insertId ?? body.receipt_number,
      notes: `Created receipt ${body.receipt_number}`,
    });

    return NextResponse.json({ id: insertId }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Duplicate receipt_number" }, { status: 409 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize } = listQuerySchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
    });
    const offset = (page - 1) * pageSize;

    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT id, receipt_number, issued_at, expires_at
       FROM receipts
       ORDER BY issued_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM receipts`);
    const total = (countRows as any)[0]?.total ?? 0;

    return NextResponse.json({ page, pageSize, total, data: rows });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
