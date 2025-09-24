// src/app/api/admin/dashboard/driver-revisit/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";

const MANILA_TZ = "+08:00";

/* ---------- Time helpers (match composite-satisfaction) ---------- */
function phStartToUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${MANILA_TZ}`);
}
function toMySQLDateTimeUTC(d: Date): string {
  const iso = d.toISOString();
  return iso.slice(0, 19).replace("T", " ");
}
function todayStartPH(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}
function lastNDaysPH(n: number) {
  const endPH = todayStartPH();
  const startPH = new Date(endPH);
  startPH.setDate(startPH.getDate() - (n - 1));
  return { startPH, endPH };
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function computeWindow(params: URLSearchParams) {
  const range = params.get("range");
  let from = params.get("from");
  let to = params.get("to");

  if (!from || !to) {
    if (range === "7d" || range === "30d" || range === "90d") {
      const n = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const { startPH, endPH } = lastNDaysPH(n);
      from = ymd(startPH);
      to = ymd(endPH);
    }
  }
  if (!from || !to) {
    const { startPH, endPH } = lastNDaysPH(30);
    from = ymd(startPH);
    to = ymd(endPH);
  }

  const fromUTC = phStartToUTC(from);
  const toPlus1PH = phStartToUTC(to);
  toPlus1PH.setDate(toPlus1PH.getDate() + 1);

  return {
    from,
    to,
    FROM_UTC: toMySQLDateTimeUTC(fromUTC),
    TO_PLUS_1D_UTC: toMySQLDateTimeUTC(toPlus1PH),
  };
}

/* ---------- Row types ---------- */
interface SurveyRow extends RowDataPacket { id: number }
interface RevisitRow extends RowDataPacket { revisit_qid: number }
interface DriverRow extends RowDataPacket {
  key: string;
  label: string;
  avgYes: number | null;
  avgNo: number | null;
  nYes: number | null;
  nNo: number | null;
}
interface CandidateRow extends RowDataPacket {
  key: string;
  label: string;
  display_order: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const explicitKey = url.searchParams.get("revisitKey") || null;
  const { from, to, FROM_UTC, TO_PLUS_1D_UTC } = computeWindow(url.searchParams);

  const pool = getPool();

  try {
    // Latest PUBLISHED survey (same rule as composite)
    const [pubRows] = await pool.query<SurveyRow[]>(
      `SELECT id
         FROM surveys
        WHERE status='PUBLISHED'
        ORDER BY COALESCE(published_at, created_at) DESC, version DESC
        LIMIT 1`
    );
    const surveyId = pubRows?.[0]?.id ?? null;
    if (surveyId == null) {
      return NextResponse.json(
        { window: { from, to }, items: [], generatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // 1) Try explicit key (if provided)
    let revisitQid: number | null = null;
    if (explicitKey) {
      const [revByKey] = await pool.query<RevisitRow[]>(
        `SELECT q.id AS revisit_qid
           FROM questions q
          WHERE q.survey_id = ? AND q.question_key = ?
          LIMIT 1`,
        [surveyId, explicitKey]
      );
      revisitQid = revByKey?.[0]?.revisit_qid ?? null;
    }

    // 2) Heuristic auto-detect (contains "revisit/return/visit again/come back")
    if (revisitQid == null) {
      const [revHeur] = await pool.query<RevisitRow[]>(
        `SELECT q.id AS revisit_qid
           FROM questions q
          WHERE q.survey_id = ?
            AND q.question_type = 'YES_NO'
            AND (
              LOWER(q.question_key) LIKE '%revisit%' OR
              LOWER(q.prompt) REGEXP 'revisit|return|visit again|come back|back again'
            )
          ORDER BY q.display_order ASC, q.id ASC
          LIMIT 1`,
        [surveyId]
      );
      revisitQid = revHeur?.[0]?.revisit_qid ?? null;
    }

    // 3) Fallback: first YES_NO question
    if (revisitQid == null) {
      const [revAny] = await pool.query<RevisitRow[]>(
        `SELECT q.id AS revisit_qid
           FROM questions q
          WHERE q.survey_id = ?
            AND q.question_type = 'YES_NO'
          ORDER BY q.display_order ASC, q.id ASC
          LIMIT 1`,
        [surveyId]
      );
      revisitQid = revAny?.[0]?.revisit_qid ?? null;
    }

    // Main aggregation (handles YES/NO normalization and LIKERT label mapping)
    const [rows] = await pool.query<DriverRow[]>(
      `
      WITH windowed_sub AS (
        SELECT s.id
          FROM submissions s
         WHERE s.survey_id = ?
           AND s.submitted_at >= ?
           AND s.submitted_at <  ?
      ),
      revisit_per_sub AS (
        SELECT a.submission_id,
               CASE
                 WHEN LOWER(o.option_value) IN ('yes','y','true') OR o.option_value = '1'
                      OR LOWER(o.label) IN ('yes','y','true')  OR o.label = '1'
                   THEN 'Yes'
                 WHEN LOWER(o.option_value) IN ('no','n','false') OR o.option_value = '0'
                      OR LOWER(o.label) IN ('no','n','false')  OR o.label = '0'
                   THEN 'No'
               END AS cohort
          FROM answers a
          JOIN question_options o ON o.id = a.option_id
         WHERE a.question_id = ?
           AND a.submission_id IN (SELECT id FROM windowed_sub)
      ),
      candidate_q AS (
        SELECT q.id, q.question_key, q.prompt, q.question_type
          FROM questions q
         WHERE q.survey_id = ?
           AND q.question_type IN ('LIKERT','YES_NO')
      ),
      scored AS (
        SELECT
            cq.question_key AS \`key\`,
            cq.prompt       AS label,
            rps.cohort,
            CASE
              WHEN cq.question_type = 'LIKERT' THEN
                CASE
                  WHEN CAST(o.option_value AS UNSIGNED) BETWEEN 1 AND 4
                    THEN CAST(o.option_value AS UNSIGNED)
                  WHEN LOWER(o.label) IN ('extremely dissatisfied','1') THEN 1
                  WHEN LOWER(o.label) IN ('dissatisfied','2')             THEN 2
                  WHEN LOWER(o.label) IN ('satisfied','3')                THEN 3
                  WHEN LOWER(o.label) IN ('extremely satisfied','4')      THEN 4
                  ELSE NULL
                END
              WHEN cq.question_type = 'YES_NO' THEN
                CASE
                  WHEN LOWER(o.option_value) IN ('yes','y','true') OR o.option_value='1'
                       OR LOWER(o.label) IN ('yes','y','true') OR o.label='1'
                    THEN 1
                  WHEN LOWER(o.option_value) IN ('no','n','false') OR o.option_value='0'
                       OR LOWER(o.label) IN ('no','n','false') OR o.label='0'
                    THEN 0
                  ELSE NULL
                END
            END AS score
          FROM answers a
          JOIN candidate_q cq      ON cq.id = a.question_id
          LEFT JOIN question_options o ON o.id = a.option_id
          JOIN revisit_per_sub rps ON rps.submission_id = a.submission_id
         WHERE a.submission_id IN (SELECT id FROM windowed_sub)
           AND rps.cohort IN ('Yes','No')
      )
      SELECT
        \`key\`,
        MAX(label) AS label,
        AVG(CASE WHEN cohort='Yes' THEN score END) AS avgYes,
        AVG(CASE WHEN cohort='No'  THEN score END) AS avgNo,
        COUNT(CASE WHEN cohort='Yes' THEN score END) AS nYes,
        COUNT(CASE WHEN cohort='No'  THEN score END) AS nNo
      FROM scored
      GROUP BY \`key\`
      `,
      [surveyId, FROM_UTC, TO_PLUS_1D_UTC, revisitQid, surveyId]
    );

    let items = (rows ?? []).map(r => {
      const avgYes = r.avgYes == null ? null : Number(r.avgYes);
      const avgNo  = r.avgNo  == null ? null : Number(r.avgNo);
      const gap = avgYes != null && avgNo != null ? Number((avgYes - avgNo).toFixed(2)) : null;
      return {
        key: r.key,
        label: r.label,
        avgYes,
        avgNo,
        nYes: Number(r.nYes ?? 0),
        nNo:  Number(r.nNo  ?? 0),
        gap,
      };
    });

    // Frame empty results with candidate questions so the chart has categories
    if (items.length === 0) {
      const [candidates] = await pool.query<CandidateRow[]>(
        `SELECT q.question_key AS \`key\`,
                q.prompt       AS label,
                q.display_order
           FROM questions q
          WHERE q.survey_id = ?
            AND q.question_type IN ('LIKERT','YES_NO')
          ORDER BY q.display_order ASC, q.id ASC`,
        [surveyId]
      );
      items = (candidates ?? []).map(c => ({
        key: c.key, label: c.label, avgYes: null, avgNo: null, nYes: 0, nNo: 0, gap: null,
      }));
    }

    // Sort by |gap| when present; otherwise keep logical order
    items.sort((a, b) => {
      const ag = Math.abs(a.gap ?? 0);
      const bg = Math.abs(b.gap ?? 0);
      if (ag === 0 && bg === 0) return a.label.localeCompare(b.label);
      return bg - ag;
    });

    return NextResponse.json(
      { window: { from, to }, items, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        { error: "QueryError", message: String(err?.sqlMessage || err?.message || err) },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
