import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const year  = body.year  ? Number(body.year)  : undefined; // e.g. 2025
    const month = body.month ? Number(body.month) : undefined; // 1–12
    const limit = body.limit ? Number(body.limit) : undefined; // cap inserts
    const dryRun = Boolean(body.dryRun);

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      // 1) latest PUBLISHED survey
      const [surveyRows]: any = await conn.query(
        `SELECT id
           FROM surveys
          WHERE status='PUBLISHED'
       ORDER BY COALESCE(published_at, created_at) DESC
          LIMIT 1`
      );
      if (surveyRows.length === 0) {
        return NextResponse.json({ error: "No PUBLISHED survey found" }, { status: 400 });
      }
      const surveyId = surveyRows[0].id;

      // 2) used receipts with no submission
      const filters: string[] = ["r.used_at IS NOT NULL", "s.id IS NULL"];
      const params: any[] = [surveyId];

      if (year && month) {
        filters.push("YEAR(r.used_at)=? AND MONTH(r.used_at)=?");
        params.push(year, month);
      } else if (year) {
        filters.push("YEAR(r.used_at)=?");
        params.push(year);
      }

      const where = `WHERE ${filters.join(" AND ")}`;
      const cap = limit ? `LIMIT ${limit}` : "";

      // 3) preview
      const [preview]: any = await conn.query(
        `
        SELECT r.id AS receipt_id, ? AS survey_id, r.used_at AS submitted_at
          FROM receipts r
          LEFT JOIN submissions s ON s.receipt_id = r.id
        ${where}
        ORDER BY r.used_at ASC
        ${cap || "LIMIT 50"}
        `,
        params
      );

      if (dryRun) {
        return NextResponse.json({
          surveyId,
          toCreate: preview.length,
          sample: preview.slice(0, 5),
          note: "dryRun=true -> nothing inserted",
        });
      }

      // 4) insert
      const [res]: any = await conn.query(
        `
        INSERT INTO submissions (receipt_id, survey_id, submitted_at)
        SELECT r.id, ?, r.used_at
          FROM receipts r
          LEFT JOIN submissions s ON s.receipt_id = r.id
        ${where}
        ORDER BY r.used_at ASC
        ${cap}
        `,
        params
      );

      // 5) sample output
      const [lastRows]: any = await conn.query(
        `SELECT id, receipt_id, survey_id, submitted_at
           FROM submissions
       ORDER BY id DESC
          LIMIT 5`
      );

      return NextResponse.json({
        ok: true,
        surveyId,
        created: res.affectedRows ?? 0,
        sample: lastRows,
      });
    } finally {
      conn.release();
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "seed submissions failed" }, { status: 500 });
  }
}
