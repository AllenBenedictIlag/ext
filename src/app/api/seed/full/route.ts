import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";

/** ----------------------- helpers ----------------------- */

const PER_MONTH_MIN = 2400;
const PER_MONTH_MAX = 3200;
const USED_RATE_MIN = 5;
const USED_RATE_MAX = 15;
const OPTIONAL_ANSWER_RATE = 0.30;
const BATCH_SIZE_INSERT = 1000;  // receipts/answers batch size
const TZ_OFFSET_MINUTES = 8 * 60; // Asia/Manila (+08:00)

// format Date -> 'YYYY-MM-DD HH:MM:SS' (local to Asia/Manila by shifting)
function fmt(dt: Date) {
  // shift UTC -> Manila (if your node runs in UTC, this gives Manila wall time)
  const ms = dt.getTime() + TZ_OFFSET_MINUTES * 60_000;
  const x = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const y = x.getUTCFullYear();
  const m = p(x.getUTCMonth() + 1);
  const d = p(x.getUTCDate());
  const h = p(x.getUTCHours());
  const mi = p(x.getUTCMinutes());
  const s = p(x.getUTCSeconds());
  return `${y}-${m}-${d} ${h}:${mi}:${s}`;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// Box–Muller normal
function normal(mu = 13, sigma = 2.5) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mu + z * sigma;
}

// random Manila time inside month, biased to midday (9:00–20:59 clamp)
function randomIssuedAtInMonth(year: number, month1to12: number) {
  const days = new Date(year, month1to12, 0).getDate();
  const day = randInt(1, days);
  let hour = Math.round(normal(13, 2.5));
  hour = Math.max(9, Math.min(20, hour));
  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  // Construct in UTC then fmt() shifts to Manila wall time
  return new Date(Date.UTC(year, month1to12 - 1, day, hour, minute, second));
}

// AAA-0035-0012 pattern
function makeReceiptNumber() {
  const letters = () =>
    Array.from({ length: 3 }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join("");
  const four = () => String(randInt(0, 9999)).padStart(4, "0");
  return `${letters()}-${four()}-${four()}`;
}

function monthBack(from: Date, back: number) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - back);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** ----------------------- route ----------------------- */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const months = Number(body.months) || 24;
  const perMin = Number(body.perMonthMin) || PER_MONTH_MIN;
  const perMax = Number(body.perMonthMax) || PER_MONTH_MAX;
  const usedMin = Number(body.usedRateMin) || USED_RATE_MIN;
  const usedMax = Number(body.usedRateMax) || USED_RATE_MAX;
  const only = (Array.isArray(body.only) ? body.only : []) as string[]; // ["receipts","used","submissions","answers"]
  const dryRun = Boolean(body.dryRun);

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    // latest PUBLISHED survey
    const [sv]: any = await conn.query(
      `SELECT id
         FROM surveys
        WHERE status='PUBLISHED'
     ORDER BY COALESCE(published_at, created_at) DESC
        LIMIT 1`
    );
    if (sv.length === 0) {
      return NextResponse.json({ error: "No PUBLISHED survey found." }, { status: 400 });
    }
    const surveyId = sv[0].id;

    // questions + options for that survey
    const [qrows]: any = await conn.query(
      `SELECT id, question_type, required
         FROM questions
        WHERE survey_id=?
     ORDER BY display_order`, [surveyId]
    );
    const qIds = qrows.map((q: any) => q.id);
    const optionsByQ = new Map<number, Array<{id:number}>>();
    if (qIds.length) {
      const inClause = qIds.map(() => "?").join(",");
      const [opt]: any = await conn.query(
        `SELECT id, question_id FROM question_options WHERE question_id IN (${inClause})`,
        qIds
      );
      for (const r of opt) {
        const arr = optionsByQ.get(r.question_id) ?? [];
        arr.push({ id: r.id });
        optionsByQ.set(r.question_id, arr);
      }
    }

    // date window to pull submissions later
    const nowUTC = new Date();
    const { year: startY, month: startM } = monthBack(nowUTC, months - 1);
    const startStr = fmt(new Date(Date.UTC(startY, startM - 1, 1, 0, 0, 0)));
    const endStr = fmt(new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth() + 1, 1, 0, 0, 0)));

    const summary: any[] = [];

    // 1) receipts per month
    for (let i = months - 1; i >= 0; i--) {
      const { year, month } = monthBack(nowUTC, i);
      const want = randInt(perMin, perMax);
      const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

      if (!only.length || only.includes("receipts")) {
        if (!dryRun) {
          // generate rows
          const rows: { receipt_number: string; issued_at: string }[] = [];
          for (let n = 0; n < want; n++) {
            rows.push({
              receipt_number: makeReceiptNumber(),
              issued_at: fmt(randomIssuedAtInMonth(year, month)),
            });
          }
          // insert in batches
          for (let off = 0; off < rows.length; off += BATCH_SIZE_INSERT) {
            const slice = rows.slice(off, off + BATCH_SIZE_INSERT);
            const sql = `INSERT IGNORE INTO receipts (receipt_number, issued_at)
                         VALUES ${slice.map(() => "(?, ?)").join(",")}`;
            const params = slice.flatMap(v => [v.receipt_number, v.issued_at]);
            await conn.query(sql, params);
          }
        }
      }

      // 2) mark 5–15% used (ensure at least 1 if month has any)
      if (!only.length || only.includes("used")) {
        const [[counts]]: any = await conn.query(
          `SELECT
              SUM(used_at IS NOT NULL) AS used_ct,
              SUM(used_at IS NULL)     AS unused_ct,
              COUNT(*)                 AS total_ct
             FROM receipts
            WHERE YEAR(issued_at)=? AND MONTH(issued_at)=?`,
          [year, month]
        );
        const total = Number(counts?.total_ct || 0);
        const unused = Number(counts?.unused_ct || 0);
        if (total > 0 && unused > 0 && !dryRun) {
          const rate = (randInt(usedMin, usedMax)) / 100;
          const target = Math.max(1, Math.floor(unused * rate));
          await conn.query(
            `UPDATE receipts
                SET used_at = LEAST(
                    DATE_ADD(issued_at, INTERVAL FLOOR(RAND()*604800) SECOND),
                    DATE_ADD(issued_at, INTERVAL 7 DAY)
                 )
              WHERE YEAR(issued_at)=? AND MONTH(issued_at)=? AND used_at IS NULL
              ORDER BY RAND()
              LIMIT ?`,
            [year, month, target]
          );
        }
      }

      // 3) submissions for used receipts of this month (no duplicates)
      if (!only.length || only.includes("submissions")) {
        if (!dryRun) {
          await conn.query(
            `INSERT INTO submissions (receipt_id, survey_id, submitted_at)
             SELECT r.id, ?, r.used_at
               FROM receipts r
               LEFT JOIN submissions s ON s.receipt_id = r.id
              WHERE s.id IS NULL
                AND r.used_at IS NOT NULL
                AND YEAR(r.used_at)=? AND MONTH(r.used_at)=?`,
            [surveyId, year, month]
          );
        }
      }

      // snapshot for this month
      const [[snap1]]: any = await conn.query(
        `SELECT
            SUM(used_at IS NOT NULL) AS used_ct,
            COUNT(*)                 AS total_ct
         FROM receipts
         WHERE YEAR(issued_at)=? AND MONTH(issued_at)=?`,
        [year, month]
      );
      const [[snap2]]: any = await conn.query(
        `SELECT COUNT(*) AS subs_ct
           FROM submissions
          WHERE YEAR(submitted_at)=? AND MONTH(submitted_at)=?`,
        [year, month]
      );
      summary.push({
        month: monthLabel,
        receipts_total: Number(snap1?.total_ct || 0),
        receipts_used: Number(snap1?.used_ct || 0),
        submissions: Number(snap2?.subs_ct || 0),
      });
    }

    // 4) answers for submissions within the window
    let answersInserted = 0;
    if (!only.length || only.includes("answers")) {
      // pull submissions in the seeded window
      const [subs]: any = await conn.query(
        `SELECT id FROM submissions
          WHERE submitted_at >= ? AND submitted_at < ?
            AND survey_id = ?`,
        [startStr, endStr, surveyId]
      );

      // build answer rows incrementally
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
      const sampleNames = ["Mia", "Noah", "Liam", "Ava", "Ben", "Luna", "Kai", "Elle", "Jae", "Iris"];
      const sampleContacts = [
        "0917-123-4567",
        "0928-555-7788",
        "0916-888-9900",
        "sample@example.com",
        "coffee.fan@inbox.test",
      ];

      // prebuild question plans
      type Plan = { qid: number; type: "LIKERT"|"YES_NO"|"TEXT"|"SHORT_TEXT"; required: 0|1; options?: number[] };
      const plans: Plan[] = qrows.map((q: any) => ({
        qid: q.id,
        type: q.question_type,
        required: q.required ? 1 : 0,
        options: optionsByQ.get(q.id)?.map(o => o.id),
      }));

      const values: Array<[number, number, number|null, string|null]> = [];

      function maybeAnswer(required: 0|1) {
        return required === 1 ? true : Math.random() < OPTIONAL_ANSWER_RATE;
      }

      for (const s of subs as Array<{id:number}>) {
        for (const p of plans) {
          if (!maybeAnswer(p.required)) continue;
          if (p.type === "LIKERT" || p.type === "YES_NO") {
            const opts = p.options ?? [];
            if (opts.length === 0) continue; // safety
            const pick = opts[randInt(0, opts.length - 1)];
            values.push([s.id, p.qid, pick, null]);
          } else if (p.type === "TEXT") {
            const t = sampleComments[randInt(0, sampleComments.length - 1)];
            values.push([s.id, p.qid, null, t]);
          } else { // SHORT_TEXT
            // naive heuristic: if the prompt likely asks for contact, mix contacts; else a name
            const likelyContact = false; // keep it generic without reading prompt again
            const t = likelyContact
              ? sampleContacts[randInt(0, sampleContacts.length - 1)]
              : sampleNames[randInt(0, sampleNames.length - 1)];
            values.push([s.id, p.qid, null, t]);
          }

          // flush batch
          if (values.length >= BATCH_SIZE_INSERT) {
            const sql = `INSERT IGNORE INTO answers (submission_id, question_id, option_id, text_value)
                         VALUES ${values.map(() => "(?, ?, ?, ?)").join(",")}`;
            const params = values.flat();
            const [res]: any = await conn.query(sql, params);
            answersInserted += res.affectedRows ?? 0;
            values.length = 0;
          }
        }
      }
      // flush remainder
      if (values.length > 0) {
        const sql = `INSERT IGNORE INTO answers (submission_id, question_id, option_id, text_value)
                     VALUES ${values.map(() => "(?, ?, ?, ?)").join(",")}`;
        const params = values.flat();
        const [res]: any = await conn.query(sql, params);
        answersInserted += res.affectedRows ?? 0;
      }
    }

    // return summary
    return NextResponse.json({
      surveyId,
      monthsSeeded: months,
      window: { start: startStr, end: endStr },
      summary,
      answersInserted,
      note: dryRun ? "dryRun=true (no DB writes for receipts/used/submissions/answers)" : "OK",
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "seed failed" }, { status: 500 });
  } finally {
    conn?.release?.();
  }
}
