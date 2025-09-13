// Perfect—thanks for the DDL. Here’s a drop-in seeder aligned exactly to your schema:
// Uses your existing surveys / questions / question_options
// Seeds 24 months of receipts (Scenario B: 2,400–3,200/mo)
// issued_at random within each month (local-midday bias)
// expires_at is your generated column (we do not insert it)
// 5–15% become “used” → used_at within issued_at … issued_at+7d
// Creates submissions only for used receipts
// Inserts answers:
// required=1 → always answer
// required=0 → answer 30% (70% blank)
// LIKERT / YES_NO use option_id from your question_options
// TEXT / SHORT_TEXT fills sample strings (no numeric_value column)




// scripts/seed-linked-ddl.ts
// Run: pnpm tsx scripts/seed-linked-ddl.ts
// If "@/lib/database" alias isn't set for tsx, swap to a relative path.

import "dotenv/config";
import { getPool } from "../src/lib/database"; // keep this AFTER dotenv.config
// ---------- Config ----------
const MONTHS_BACK = 24;
const MIN_MONTHLY = 2400;
const MAX_MONTHLY = 3200;
const USED_RATE_MIN = 0.1;  // 10%
const USED_RATE_MAX = 0.15;  // 15%
const RECEIPT_BATCH = 1000;
const SUBMISSION_BATCH = 1000;
const ANSWER_BATCH = 2000;
const OPTIONAL_ANSWER_RATE = 0.20; // optional questions: 30% answered

type QType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

// ---------- Utils ----------
const pad2 = (n: number) => n.toString().padStart(2, "0");
const pad6 = (n: number) => n.toString().padStart(6, "0");
const fmt = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
function randInRange(start: Date, end: Date) {
  const t0 = start.getTime();
  const t1 = end.getTime();
  return new Date(randInt(t0, t1));
}
// Bias towards mid-day to avoid UTC boundary oddities
function randMiddayWithinMonth(year: number, month0: number) {
  const start = new Date(year, month0, 1, 12, randInt(0, 59), randInt(0, 59));
  const end = new Date(year, month0 + 1, 0, 12, randInt(0, 59), randInt(0, 59));
  return randInRange(start, end);
}
function receiptNumber(year: number, month0: number, seq: number) {
  return `RCP-${year}-${pad2(month0 + 1)}-${pad6(seq)}`;
}
function placeholders(rows: number, cols: number) {
  return Array.from({ length: rows }, () => `(${Array(cols).fill("?").join(",")})`).join(",");
}
function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Main ----------
async function main() {
  const pool = getPool();

  // 1) Pick a published survey (newest)
  const survey = await pickPublishedSurvey();
  const surveyId = survey.id as number;

  // 2) Load questions & options
  const questions = await getQuestions(surveyId);
  const optionMap = await getOptionsForQuestions(questions.map(q => q.id));

  // 3) Month-by-month seeding
  let globalSeq = 1;

  for (let back = MONTHS_BACK - 1; back >= 0; back--) {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = monthDate.getFullYear();
    const m0 = monthDate.getMonth();

    const monthlyCount = randInt(MIN_MONTHLY, MAX_MONTHLY);
    const usedRate = USED_RATE_MIN + Math.random() * (USED_RATE_MAX - USED_RATE_MIN);

    // (A) Build receipts (expires_at is GENERATED; do NOT insert it)
    const receiptRows: Array<[string, string, string | null]> = [];
    for (let i = 0; i < monthlyCount; i++) {
      const issuedAt = randMiddayWithinMonth(y, m0);
      // used_at initially null; we’ll set for a subset after insert
      receiptRows.push([receiptNumber(y, m0, globalSeq++), fmt(issuedAt), null]);
    }
    await batchInsertReceipts(receiptRows);

    // Map receipt_number -> {id, issued_at}
    const rMap = await mapReceiptsByNumber(receiptRows.map(r => r[0])); // Map<number, { rn, issued_at }>
    const allIds = Array.from(rMap.keys());

    // (B) Choose used subset and update used_at within [issued_at, issued_at+7d]
    shuffle(allIds);
    const usedCount = Math.round(monthlyCount * usedRate);
    const usedIds = allIds.slice(0, usedCount);

    const usedUpdates: Array<[string, number]> = [];
    for (const id of usedIds) {
      const rec = rMap.get(id)!;
      const issued = new Date(rec.issued_at);
      const usedAt = randInRange(issued, addDays(issued, 7));
      usedUpdates.push([fmt(usedAt), id]);
    }
    await batchUpdateUsedAt(usedUpdates);

    // (C) Insert submissions for used receipts (submitted_at ~= used_at)
    const submissionsRows: Array<[number, number, string]> = usedIds.map((rid) => {
      const usedAt = usedUpdates.find(([, id]) => id === rid)?.[0] ?? rMap.get(rid)!.issued_at;
      return [rid, surveyId, usedAt];
    });
    await batchInsertSubmissions(submissionsRows);

    // Map receipt_id -> submission_id
    const subMap = await mapSubmissionsByReceipt(usedIds);

    // (D) Answers per submission (respect required vs optional)
    const answersRows: Array<[number, number, number | null, string | null]> = [];
    for (const rid of usedIds) {
      const subId = subMap.get(rid);
      if (!subId) continue;

      for (const q of questions) {
        const must = q.required === 1;
        const include = must ? true : Math.random() < OPTIONAL_ANSWER_RATE;
        if (!include) continue;

        const a = genAnswer(q, optionMap.get(q.id) || []);
        answersRows.push([subId, q.id, a.option_id, a.text_value]);
      }
    }
    await batchInsertAnswers(answersRows);

    console.log(
      `[${y}-${pad2(m0 + 1)}] receipts=${monthlyCount}, used=${usedCount} (${(usedRate * 100).toFixed(
        1
      )}%), submissions=${usedIds.length}, answers=${answersRows.length}`
    );
  }

  console.log("✅ Seed complete");
  await pool.end();
}

// ---------- DB Access ----------
async function pickPublishedSurvey() {
  const pool = getPool();
  // Prefer newest PUBLISHED; your sample has title "Customer Experience v1"
  const [rows] = await pool.execute(
    `SELECT id, title, version
     FROM surveys
     WHERE status = 'PUBLISHED'
     ORDER BY COALESCE(published_at, created_at, id) DESC
     LIMIT 1`
  );
  if ((rows as any[]).length === 0) {
    throw new Error("No PUBLISHED survey found.");
  }
  return (rows as any[])[0];
}

type QRow = {
  id: number;
  survey_id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  question_type: QType;
  required: 0 | 1;
};
async function getQuestions(surveyId: number): Promise<QRow[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, survey_id, display_order, question_key, prompt, question_type, required
     FROM questions
     WHERE survey_id = ?
     ORDER BY display_order ASC, id ASC`,
    [surveyId]
  );
  return rows as QRow[];
}

type OptRow = { id: number; question_id: number; option_value: string; label: string; display_order?: number };
async function getOptionsForQuestions(qIds: number[]) {
  const pool = getPool();
  const map = new Map<number, OptRow[]>();
  for (const part of chunk(qIds, 1000)) {
    if (!part.length) continue;
    const ph = part.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT id, question_id, option_value, label, COALESCE(display_order, id) AS display_order
       FROM question_options
       WHERE question_id IN (${ph})
       ORDER BY question_id ASC, display_order ASC, id ASC`,
      part
    );
    for (const r of rows as OptRow[]) {
      if (!map.has(r.question_id)) map.set(r.question_id, []);
      map.get(r.question_id)!.push(r);
    }
  }
  return map;
}

// receipts insert (NO expires_at here; it’s a GENERATED column)
async function batchInsertReceipts(rows: Array<[string, string, string | null]>) {
  const pool = getPool();
  for (const part of chunk(rows, RECEIPT_BATCH)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const sql = `INSERT INTO receipts (receipt_number, issued_at, used_at) VALUES ${placeholders(part.length, 3)}`;
      await conn.execute(sql, part.flat());
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

// Map<receipt_id, { rn, issued_at }>
async function mapReceiptsByNumber(receiptNumbers: string[]) {
  const pool = getPool();
  const map = new Map<number, { rn: string; issued_at: string }>();
  for (const part of chunk(receiptNumbers, 1000)) {
    const ph = part.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT id, receipt_number AS rn,
              DATE_FORMAT(issued_at, '%Y-%m-%d %H:%i:%s') AS issued_at
       FROM receipts
       WHERE receipt_number IN (${ph})`,
      part
    );
    (rows as any[]).forEach(r => map.set(r.id, { rn: r.rn, issued_at: r.issued_at }));
  }
  return map;
}

async function batchUpdateUsedAt(rows: Array<[string, number]>) {
  if (!rows.length) return;
  const pool = getPool();
  for (const part of chunk(rows, 1000)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const ids = part.map(([, id]) => id);
      const cases = part.map(([ts, id]) => `WHEN ${id} THEN ?`).join(" ");
      const sql = `UPDATE receipts SET used_at = CASE id ${cases} END WHERE id IN (${ids.join(",")})`;
      const params = part.map(([ts]) => ts);
      await conn.execute(sql, params);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

async function batchInsertSubmissions(rows: Array<[number, number, string]>) {
  if (!rows.length) return;
  const pool = getPool();
  for (const part of chunk(rows, SUBMISSION_BATCH)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const sql = `INSERT INTO submissions (receipt_id, survey_id, submitted_at) VALUES ${placeholders(part.length, 3)}`;
      await conn.execute(sql, part.flat());
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

async function mapSubmissionsByReceipt(receiptIds: number[]) {
  const pool = getPool();
  const map = new Map<number, number>();
  for (const part of chunk(receiptIds, 1000)) {
    const ph = part.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT id, receipt_id FROM submissions WHERE receipt_id IN (${ph})`,
      part
    );
    (rows as any[]).forEach(r => map.set(r.receipt_id, r.id));
  }
  return map;
}

// answers(submission_id, question_id, option_id, text_value)
async function batchInsertAnswers(rows: Array<[number, number, number | null, string | null]>) {
  if (!rows.length) return;
  const pool = getPool();
  for (const part of chunk(rows, ANSWER_BATCH)) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const sql =
        `INSERT INTO answers (submission_id, question_id, option_id, text_value) ` +
        `VALUES ${placeholders(part.length, 4)}`;
      await conn.execute(sql, part.flat());
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

// ---------- Answer generation (matches your schema) ----------
function genAnswer(
  q: QRow,
  options: OptRow[]
): { option_id: number | null; text_value: string | null } {
  switch (q.question_type) {
    case "LIKERT": {
      // Options are your actual rows (likely 4 options with values '1'..'4').
      // Favor higher scores: weights [0.08, 0.22, 0.35, 0.35] by ascending display_order.
      const pick = weightedPick(options, [0.08, 0.22, 0.35, 0.35]);
      return { option_id: pick?.id ?? null, text_value: null };
    }
    case "YES_NO": {
      const yes = options.find(o => o.option_value.toLowerCase() === "yes");
      const no  = options.find(o => o.option_value.toLowerCase() === "no");
      const chooseYes = Math.random() < 0.82;
      const picked = chooseYes ? (yes ?? no) : (no ?? yes);
      return { option_id: picked ? picked.id : null, text_value: null };
    }
    case "TEXT":
    case "SHORT_TEXT": {
      const texts = [
        "Great coffee and friendly staff.",
        "Loved the latte art!",
        "Cozy vibe, will return.",
        "Service was quick, thanks!",
        "Place was clean and comfy.",
      ];
      return { option_id: null, text_value: texts[randInt(0, texts.length - 1)] };
    }
    default:
      return { option_id: null, text_value: null };
  }
}

function weightedPick<T>(arr: T[], weights?: number[]): T | undefined {
  if (!arr.length) return undefined;
  if (!weights || weights.length !== arr.length) return arr[randInt(0, arr.length - 1)];
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

// ---------- Start ----------
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
