import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/database";
import { recordAuditEvent } from "@/lib/audit-log";

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.coerce.number().int().positive();
const putSchema = z.object({
  receipt_number: z.string().min(3).max(64).trim(),
  issued_at: z.string().datetime(),
});
const patchSchema = z
  .object({
    receipt_number: z.string().min(3).max(64).trim().optional(),
    issued_at: z.string().datetime().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No valid fields provided" });

async function resolveReceiptId(context: RouteContext): Promise<number> {
  const params = await context.params;
  return idSchema.parse(params.id);
}

async function fetchOne(id: number) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, receipt_number, issued_at, expires_at
     FROM receipts
     WHERE id = ?`,
    [id]
  );
  return (rows as any[])[0] ?? null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveReceiptId(context);
    const row = await fetchOne(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveReceiptId(context);
    const body = putSchema.parse(await req.json());

    const pool = getPool();
    const [result] = await pool.execute(
      `UPDATE receipts SET receipt_number = ?, issued_at = ? WHERE id = ?`,
      [body.receipt_number.trim(), body.issued_at, id]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await recordAuditEvent({
      req,
      action: "DRAFT_EDIT",
      targetType: "receipt",
      targetId: id,
      notes: `Replaced receipt ${id} with number ${body.receipt_number}`,
    });

    const row = await fetchOne(id);
    return NextResponse.json(row);
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

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveReceiptId(context);
    const body = patchSchema.parse(await req.json());

    const fields: string[] = [];
    const values: unknown[] = [];
    const changes: string[] = [];

    if (body.receipt_number !== undefined) {
      fields.push("receipt_number = ?");
      values.push(body.receipt_number.trim());
      changes.push(`number=${body.receipt_number}`);
    }
    if (body.issued_at !== undefined) {
      fields.push("issued_at = ?");
      values.push(body.issued_at);
      changes.push("issued_at");
    }

    const sql = `UPDATE receipts SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);

    const pool = getPool();
    const [result] = await pool.execute(sql, values);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (changes.length > 0) {
      await recordAuditEvent({
        req,
        action: "DRAFT_EDIT",
        targetType: "receipt",
        targetId: id,
        notes: `Patched receipt ${id}: ${changes.join(", ")}`,
      });
    }

    const row = await fetchOne(id);
    return NextResponse.json(row);
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

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const id = await resolveReceiptId(context);
    const pool = getPool();
    const [result] = await pool.execute(`DELETE FROM receipts WHERE id = ?`, [id]);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await recordAuditEvent({
      req,
      action: "ARCHIVE",
      targetType: "receipt",
      targetId: id,
      notes: `Deleted receipt ${id}`,
    });

    return NextResponse.json({ id });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
