// app/api/receipts/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPool } from '@/lib/database';

type Params = { params: { id: string } };

const idSchema = z.coerce.number().int().positive();
const putSchema = z.object({
  receipt_number: z.string().min(3).max(64).trim(),
  issued_at: z.string().datetime(),
});
const patchSchema = z.object({
  receipt_number: z.string().min(3).max(64).trim().optional(),
  issued_at: z.string().datetime().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No valid fields provided' });

/** helper: fetch one by id */
async function fetchOne(id: number) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, receipt_number, issued_at, expires_at
     FROM receipts
     WHERE id = ?`,
    [id],
  );
  return (rows as any[])[0] ?? null;
}

/** GET /api/receipts/:id */
export async function GET(_req: Request, { params }: Params) {
  try {
    const id = idSchema.parse(params.id);
    const row = await fetchOne(id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}

/** PUT /api/receipts/:id (replace receipt_number & issued_at) */
export async function PUT(req: Request, { params }: Params) {
  try {
    const id = idSchema.parse(params.id);
    const body = putSchema.parse(await req.json());

    const pool = getPool();
    const [result] = await pool.execute(
      `UPDATE receipts SET receipt_number = ?, issued_at = ? WHERE id = ?`,
      [body.receipt_number.trim(), body.issued_at, id],
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // return the updated row (expires_at auto-recomputed)
    const row = await fetchOne(id);
    return NextResponse.json(row);
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

/** PATCH /api/receipts/:id (partial update) */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const id = idSchema.parse(params.id);
    const body = patchSchema.parse(await req.json());

    const fields: string[] = [];
    const values: any[] = [];

    if (body.receipt_number !== undefined) {
      fields.push(`receipt_number = ?`);
      values.push(body.receipt_number.trim());
    }
    if (body.issued_at !== undefined) {
      fields.push(`issued_at = ?`);
      values.push(body.issued_at);
    }

    const sql = `UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const pool = getPool();
    const [result] = await pool.execute(sql, values);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = await fetchOne(id);
    return NextResponse.json(row);
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

/** DELETE /api/receipts/:id */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const id = idSchema.parse(params.id);
    const pool = getPool();
    const [result] = await pool.execute(`DELETE FROM receipts WHERE id = ?`, [id]);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ id }); // or 204 No Content if you prefer
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
