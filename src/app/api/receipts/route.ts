// app/api/receipts/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPool } from '@/lib/database';

const createSchema = z.object({
  receipt_number: z.string().min(3).max(64).trim(),
  // optional; if omitted DB default/current_timestamp will be used by your table
  issued_at: z.string().datetime().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = createSchema.parse(json);

    const pool = getPool();

    if (body.issued_at) {
      const [result] = await pool.execute(
        `INSERT INTO receipts (receipt_number, issued_at) VALUES (?, ?)`,
        [body.receipt_number.trim(), body.issued_at],
      );
      return NextResponse.json({ id: (result as any).insertId }, { status: 201 });
    } else {
      const [result] = await pool.execute(
        `INSERT INTO receipts (receipt_number) VALUES (?)`,
        [body.receipt_number.trim()],
      );
      return NextResponse.json({ id: (result as any).insertId }, { status: 201 });
    }
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Duplicate receipt_number' }, { status: 409 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize } = listQuerySchema.parse({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    });
    const offset = (page - 1) * pageSize;

    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT id, receipt_number, issued_at, expires_at
       FROM receipts
       ORDER BY issued_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM receipts`);
    const total = (countRows as any)[0]?.total ?? 0;

    return NextResponse.json({ page, pageSize, total, data: rows });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
