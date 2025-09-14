import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- helpers -------------------------------------------------
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// choose random element
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

// --- route ---------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // config knobs (defaults are safe)
  const OPTIONAL_RATE = body.optionalRate != null ? Number(body.optionalRate) : 0.30; // 30%
  const limitPairs = body.limitPairs ? Number(body.limitPairs) : 4000;  // how many missing pairs to process per round
  const maxRounds  = body.maxRounds  ? Number(body.maxRounds)  : 20;    // safety
  const surveyIdInput = body.surveyId ? Number(body.surveyId) : undefined;
  const fromId = body.fromId ? Number(body.fromId) : undefined;         // optional submission id range
  const toId   = body.toId   ? Number(body.toId)   : undefined;
  const dryRun = Boolean(body.dryRun);

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // 1) figure out survey
    let surveyId = surveyIdInput;
    if (!surveyId) {
      const [sv]: any = await conn.query(
        `SELECT id FROM surveys WHERE status='PUBLISHED'
         ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`
      );
      if (!sv.length) return NextResponse.json({ error: "No PUBLISHED survey found." }, { status: 400 });
      surveyId = sv[0].id;
    }

    // 2) load questions + options map
    const [qs]: any = await conn.query(
      `SELECT id, question_type, required FROM questions
       WHERE survey_id=? ORDER BY display_order`, [surveyId]
    );
    if (!qs.length) return NextResponse.json({ error: "No questions for survey." }, { status: 400 });

    const qIds = qs.map((q: any) => q.id);
    const inClause = qIds.map(() => "?").join(",");
    const [opts]: any = await conn.query(
      `SELECT id, question_id FROM question_options
       WHERE question_id IN (${inClause})`, qIds
    );
    const optionsByQ = new Map<number, number[]>();
    for (const r of opts) {
      const arr = optionsByQ.get(r.question_id) ?? [];
      arr.push(r.id);
      optionsByQ.set(r.question_id, arr);
    }

    // sample text pools
    const sampleComments = [
      "Great coffee and quick service!",
      "Friendly staff. Will come back.",
      "Loved the ambience.",
      "Everything was fine.",
      "Could be faster during peak hours.",
      "Tasted great, thank you!",
      "Place was clean and cozy.",
      "Staff were helpful and polite.",
    ];
    const sampleNames = ["Mia","Noah","Liam","Ava","Ben","Luna","Kai","Elle","Jae","Iris"];
    const sampleContacts = ["0917-123-4567","0928-555-7788","0916-888-9900","sample@example.com","coffee.fan@inbox.test"];

    // 3) backfill loop
    let totalConsidered = 0;
    let totalInserted = 0;
    let rounds = 0;

    while (rounds < maxRounds) {
      rounds++;

      // Build filter
      const filters: string[] = ["s.survey_id = ?"];
      const params: any[] = [surveyId];
      if (fromId != null) { filters.push("s.id >= ?"); params.push(fromId); }
      if (toId   != null) { filters.push("s.id <= ?"); params.push(toId); }

      // Find missing (submission, question) pairs
      const [missing]: any = await conn.query(
        `
        SELECT s.id AS submission_id, q.id AS question_id, q.question_type, q.required
        FROM submissions s
        JOIN questions q ON q.survey_id = s.survey_id
        LEFT JOIN answers a
               ON a.submission_id = s.id
              AND a.question_id   = q.id
        WHERE ${filters.join(" AND ")} AND a.id IS NULL
        LIMIT ${limitPairs}
        `,
        params
      );

      if (!missing.length) break;

      totalConsidered += missing.length;

      // Decide which rows to insert (required always; optional with OPTIONAL_RATE)
      type Row = [number, number, number|null, string|null];
      const toInsert: Row[] = [];

      for (const r of missing as Array<{submission_id:number, question_id:number, question_type:string, required:number}>) {
        const required = Number(r.required) === 1;
        if (!required && Math.random() >= OPTIONAL_RATE) continue; // skip some optionals

        if (r.question_type === "LIKERT" || r.question_type === "YES_NO") {
          const options = optionsByQ.get(r.question_id) ?? [];
          if (!options.length) continue; // safety
          toInsert.push([r.submission_id, r.question_id, pick(options), null]);
        } else if (r.question_type === "TEXT") {
          toInsert.push([r.submission_id, r.question_id, null, pick(sampleComments)]);
        } else { // SHORT_TEXT
          // naive mix of names/contacts to keep variety
          const txt = Math.random() < 0.4 ? pick(sampleContacts) : pick(sampleNames);
          toInsert.push([r.submission_id, r.question_id, null, txt]);
        }
      }

      if (!toInsert.length) continue;

      if (dryRun) {
        // preview only first 10
        return NextResponse.json({
          dryRun: true,
          surveyId,
          roundsTried: rounds,
          missingFound: missing.length,
          willInsert: toInsert.length,
          preview: toInsert.slice(0, 10).map(([sid,qid,oid,txt]) => ({submission_id:sid, question_id:qid, option_id:oid, text_value:txt}))
        });
      }

      // Batch insert (IGNORE respects ux_answer_once unique key)
      const sql = `INSERT IGNORE INTO answers (submission_id, question_id, option_id, text_value)
                   VALUES ${toInsert.map(() => "(?, ?, ?, ?)").join(",")}`;
      const params2 = toInsert.flat();
      const [res]: any = await conn.query(sql, params2);
      totalInserted += res.affectedRows ?? 0;

      // If we inserted less than we considered, loop again to catch next chunk
      // and stop early if we didn’t insert anything this round.
      if ((res.affectedRows ?? 0) === 0) break;
    }

    // Final metrics
    const [[missingRequired]]: any = await conn.query(
      `
      SELECT COUNT(*) AS missing_required
      FROM submissions s
      JOIN questions q ON q.survey_id = s.survey_id AND q.required=1
      LEFT JOIN answers a ON a.submission_id=s.id AND a.question_id=q.id
      WHERE s.survey_id=?
      `, [surveyId]
    );

    return NextResponse.json({
      ok: true,
      surveyId,
      rounds,
      totalConsidered,
      totalInserted,
      missingRequired: Number(missingRequired?.missing_required || 0),
      note: "Run again if totalConsidered was capped by limitPairs."
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "backfill-answers failed" }, { status: 500 });
  } finally {
    pool.releaseConnection(conn);
  }
}
