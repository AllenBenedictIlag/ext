import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { PoolConnection } from "mysql2/promise";
import { getPool } from "@/lib/database";
import { readTokenFromRequest } from "@/lib/session";
import { verifyToken } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

type QuestionType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
type SurveyStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";

type QuestionOptionRow = {
  option_id: number;
  option_value: string;
  label: string;
};

type QuestionRow = {
  question_id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  help_text: string | null;
  options: QuestionOptionRow[];
};

type SurveyMeta = {
  id: number;
  title: string;
  version: number;
  status: SurveyStatus;
  submitted_by: { id: number; name: string; email: string } | null;
  submitted_for_review_at: string | null;
};

type BuilderPayload = {
  working: { survey: SurveyMeta; questions: QuestionRow[] } | null;
  latestPublished: {
    survey: SurveyMeta;
    questions: QuestionRow[];
    questionKeys: string[];
  } | null;
};

type SubmitOption = { option_value: string; label: string };
type SubmitQuestion = {
  question_key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  help_text: string | null;
  display_order: number;
  options?: SubmitOption[];
};

type SubmitBody =
  | {
      intent?: "submit";
      surveyId?: number | null;
      title?: string | null;
      questions: SubmitQuestion[];
    }
  | {
      intent: "withdraw";
      surveyId: number;
    }
  | {
      intent: "export" | "draft_edit";
    };

type SubmitPayload = Extract<
  SubmitBody,
  { intent?: "submit"; questions: SubmitQuestion[] }
>;

type WithdrawPayload = Extract<SubmitBody, { intent: "withdraw"; surveyId: number }>;

const FIXED_OPTIONS: Record<Extract<QuestionType, "LIKERT" | "YES_NO">, SubmitOption[]> =
  {
    LIKERT: [
      { option_value: "1", label: "Extremely Dissatisfied" },
      { option_value: "2", label: "Dissatisfied" },
      { option_value: "3", label: "Satisfied" },
      { option_value: "4", label: "Extremely Satisfied" },
    ],
    YES_NO: [
      { option_value: "yes", label: "Yes" },
      { option_value: "no", label: "No" },
    ],
  };

const MULTICHOICE_TYPES: QuestionType[] = ["LIKERT", "YES_NO"];
const ALLOWED_TYPES: QuestionType[] = ["LIKERT", "YES_NO", "TEXT", "SHORT_TEXT"];

class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requireAuth(req: NextRequest) {
  const token = readTokenFromRequest(req);
  if (!token) {
    throw new AuthError(401, "Unauthorized");
  }
  try {
    const payload = await verifyToken(token);
    const role = String(payload.role ?? "").toUpperCase();
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      throw new AuthError(403, "Forbidden");
    }
    return { id: Number(payload.id), role: role as "ADMIN" | "SUPER_ADMIN" };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, "Unauthorized");
  }
}

function mapSurvey(row: any): SurveyMeta {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    version: Number(row.version ?? 0),
    status: row.status as SurveyStatus,
    submitted_by: row.submitted_by_id
      ? {
          id: Number(row.submitted_by_id),
          name: String(row.submitted_by_name ?? "").trim(),
          email: String(row.submitted_by_email ?? ""),
        }
      : null,
    submitted_for_review_at: row.submitted_for_review_at
      ? new Date(row.submitted_for_review_at).toISOString()
      : null,
  };
}

async function fetchSurvey(
  conn: PoolConnection,
  statuses: SurveyStatus[]
): Promise<SurveyMeta | null> {
  if (!statuses.length) return null;
  const placeholders = statuses.map(() => "?").join(",");
  const [rows] = await conn.query<any[]>(
    `
    SELECT
      s.id,
      s.title,
      s.version,
      s.status,
      s.submitted_for_review_at,
      sb.id   AS submitted_by_id,
      CONCAT(
        COALESCE(sb.first_name, ''),
        ' ',
        COALESCE(sb.last_name, '')
      )        AS submitted_by_name,
      sb.email AS submitted_by_email
    FROM surveys s
    LEFT JOIN admins sb ON sb.id = s.submitted_by
    WHERE s.status IN (${placeholders})
    ORDER BY FIELD(s.status, 'DRAFT', 'PENDING_REVIEW'), s.id DESC
    LIMIT 1
    `,
    statuses
  );
  if (!Array.isArray(rows) || !rows[0]) return null;
  return mapSurvey(rows[0]);
}

async function fetchQuestions(
  conn: PoolConnection,
  surveyId: number
): Promise<QuestionRow[]> {
  const [rows] = await conn.query<any[]>(
    `
    SELECT
      q.id            AS question_id,
      q.display_order AS display_order,
      q.question_key  AS question_key,
      q.prompt        AS prompt,
      q.question_type AS question_type,
      q.required      AS required,
      q.help_text     AS help_text
    FROM questions q
    WHERE q.survey_id = ?
    ORDER BY q.display_order ASC, q.id ASC
    `,
    [surveyId]
  );

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const ids = rows.map((row) => Number(row.question_id));
  const [optionRows] = await conn.query<any[]>(
    `
    SELECT
      o.id,
      o.question_id,
      o.option_value,
      o.label
    FROM question_options o
    WHERE o.question_id IN (${ids.map(() => "?").join(",")})
    ORDER BY o.question_id ASC, o.id ASC
    `,
    ids
  );

  const optionMap = new Map<number, QuestionOptionRow[]>();
  for (const option of optionRows ?? []) {
    const questionId = Number(option.question_id);
    const list = optionMap.get(questionId) ?? [];
    list.push({
      option_id: Number(option.id),
      option_value: String(option.option_value ?? ""),
      label: String(option.label ?? ""),
    });
    optionMap.set(questionId, list);
  }

  return rows.map((row) => ({
    question_id: Number(row.question_id),
    display_order: Number(row.display_order),
    question_key: String(row.question_key ?? ""),
    prompt: String(row.prompt ?? ""),
    type: String(row.question_type ?? "TEXT") as QuestionType,
    required: Boolean(row.required),
    help_text: row.help_text == null ? null : String(row.help_text),
    options: optionMap.get(Number(row.question_id)) ?? [],
  }));
}

function normalizeTitle(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length ? trimmed : null;
}

type NormalisedQuestion = SubmitQuestion & {
  options: SubmitOption[];
};

function validateQuestions(
  questions: SubmitQuestion[]
): { errors: string[]; normalised: NormalisedQuestion[] } {
  const errors: string[] = [];
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("At least one question is required.");
    return { errors, normalised: [] };
  }

  const keySet = new Set<string>();
  const orderSet = new Set<number>();
  const normalised: NormalisedQuestion[] = [];

  for (const question of questions) {
    if (!question) continue;
    const trimmedKey = typeof question.question_key === "string"
      ? question.question_key.trim()
      : "";
    const trimmedPrompt = typeof question.prompt === "string"
      ? question.prompt.trim()
      : "";
    const type = question.type;
    const displayOrder = Number(question.display_order);

    if (!trimmedKey) errors.push("Each question must have a question_key.");
    if (!trimmedPrompt) errors.push("Each question must have a prompt.");
    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(`Unsupported question type "${String(type)}".`);
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      errors.push("Display order must be a positive integer.");
    } else if (orderSet.has(displayOrder)) {
      errors.push("Display order must not contain duplicates.");
    } else {
      orderSet.add(displayOrder);
    }
    if (trimmedKey) {
      const lower = trimmedKey.toLowerCase();
      if (keySet.has(lower)) {
        errors.push(`Duplicate question_key "${trimmedKey}" detected.`);
      } else {
        keySet.add(lower);
      }
    }

    let options: SubmitOption[] = [];
    if (MULTICHOICE_TYPES.includes(type)) {
      options = FIXED_OPTIONS[type as "LIKERT" | "YES_NO"];
      if (!question.required) {
        errors.push(`Questions of type ${type} must be required.`);
      }
      const provided = Array.isArray(question.options) ? question.options : [];
      if (provided.length !== options.length) {
        errors.push(`Options for ${type} questions must match the fixed set.`);
      } else {
        for (let i = 0; i < options.length; i += 1) {
          const expected = options[i];
          const actual = provided[i];
          if (
            !actual ||
            actual.option_value.trim().toLowerCase() !== expected.option_value.toLowerCase() ||
            actual.label.trim() !== expected.label
          ) {
            errors.push(`Options for ${type} questions must match the fixed set.`);
            break;
          }
        }
      }
    } else {
      options = [];
    }

    normalised.push({
      question_key: trimmedKey,
      prompt: trimmedPrompt,
      type,
      required: MULTICHOICE_TYPES.includes(type) ? true : Boolean(question.required),
      help_text:
        typeof question.help_text === "string"
          ? question.help_text.trim() || null
          : null,
      display_order: displayOrder,
      options,
    });
  }

  const expectedOrders = Array.from({ length: questions.length }, (_, i) => i + 1);
  for (const order of expectedOrders) {
    if (!orderSet.has(order)) {
      errors.push("Display order must be contiguous (1..N).");
      break;
    }
  }

  return { errors, normalised };
}

async function deleteExistingQuestions(conn: PoolConnection, surveyId: number) {
  await conn.query(`DELETE FROM question_options WHERE question_id IN (
    SELECT id FROM questions WHERE survey_id = ?
  )`, [surveyId]);
  await conn.query(`DELETE FROM questions WHERE survey_id = ?`, [surveyId]);
}

async function insertQuestions(
  conn: PoolConnection,
  surveyId: number,
  questions: NormalisedQuestion[]
) {
  for (const question of questions) {
    const [result] = await conn.execute<any>(
      `
      INSERT INTO questions (
        survey_id,
        display_order,
        question_key,
        prompt,
        question_type,
        required,
        help_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        surveyId,
        question.display_order,
        question.question_key,
        question.prompt,
        question.type,
        question.required ? 1 : 0,
        question.help_text,
      ]
    );
    const questionId = Number(result.insertId);
    if (MULTICHOICE_TYPES.includes(question.type)) {
      const fixed = FIXED_OPTIONS[question.type as "LIKERT" | "YES_NO"];
      for (const option of fixed) {
        await conn.execute(
          `
          INSERT INTO question_options (
            question_id,
            option_value,
            label
          )
          VALUES (?, ?, ?)
          `,
          [questionId, option.option_value, option.label]
        );
      }
    }
  }
}

export async function GET() {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const workingSurvey = await fetchSurvey(conn, ["DRAFT", "PENDING_REVIEW"]);
    const latestPublished = await fetchSurvey(conn, ["PUBLISHED"]);

    const workingQuestions = workingSurvey ? await fetchQuestions(conn, workingSurvey.id) : [];
    const latestQuestions = latestPublished ? await fetchQuestions(conn, latestPublished.id) : [];
    const publishedKeys = latestQuestions.map((q) => q.question_key);

    const payload: BuilderPayload = {
      working: workingSurvey
        ? { survey: workingSurvey, questions: workingQuestions }
        : null,
      latestPublished: latestPublished
        ? {
            survey: latestPublished,
            questions: latestQuestions,
            questionKeys: publishedKeys,
          }
        : null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[questions-builder] GET failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const intent = body.intent ?? "submit";

  if (intent === "export") {
    try {
      const auth = await requireAuth(req);
      await recordAuditEvent({
        req,
        actorAdminId: auth.id,
        action: "EXPORT",
        targetType: "survey",
        targetId: "questions-builder",
        notes: "Exported current questions builder view.",
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("[questions-builder] export log failed", error);
      return NextResponse.json({ error: "Unable to record export" }, { status: 500 });
    }
  }

  if (intent === "draft_edit") {
    try {
      const auth = await requireAuth(req);
      await recordAuditEvent({
        req,
        actorAdminId: auth.id,
        action: "DRAFT_EDIT",
        targetType: "survey",
        targetId: "questions-builder",
        notes: "Started editing survey draft.",
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("[questions-builder] draft_edit log failed", error);
      return NextResponse.json({ error: "Unable to record draft edit" }, { status: 500 });
    }
  }

  if (intent === "withdraw") {
    const withdrawPayload = body as WithdrawPayload;
    if (
      typeof withdrawPayload.surveyId !== "number" ||
      !Number.isFinite(withdrawPayload.surveyId)
    ) {
      return NextResponse.json({ error: "surveyId is required" }, { status: 400 });
    }
    let auth;
    try {
      auth = await requireAuth(req);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<any[]>(
        `SELECT id, status FROM surveys WHERE id = ? FOR UPDATE`,
        [withdrawPayload.surveyId]
      );
      if (!Array.isArray(rows) || !rows[0]) {
        await conn.rollback();
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }
      const survey = rows[0] as { status: SurveyStatus };
      if (survey.status !== "PENDING_REVIEW") {
        await conn.rollback();
        return NextResponse.json({ error: "Only pending surveys can be withdrawn" }, { status: 409 });
      }
      await conn.execute(
        `
        UPDATE surveys
        SET status = 'DRAFT',
            submitted_by = NULL,
            submitted_for_review_at = NULL,
            approved_by = NULL,
            approved_at = NULL,
            effective_at = NULL
        WHERE id = ?
        `,
        [withdrawPayload.surveyId]
      );
      await conn.commit();
      await recordAuditEvent({
        req,
        actorAdminId: auth.id,
        action: "DRAFT_EDIT",
        targetType: "survey",
        targetId: withdrawPayload.surveyId,
        notes: "Withdrew pending survey for further edits.",
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      await conn.rollback();
      console.error("[questions-builder] withdraw failed", error);
      return NextResponse.json({ error: "Failed to withdraw survey" }, { status: 500 });
    } finally {
      conn.release();
    }
  }

  // intent === "submit"
  if (intent && intent !== "submit") {
    return NextResponse.json({ error: "Unsupported intent" }, { status: 400 });
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  if (!("questions" in body) || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "questions array is required" }, { status: 400 });
  }

  const submitPayload = body as SubmitPayload;

  const { errors, normalised } = validateQuestions(submitPayload.questions);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }

  const desiredTitle = normalizeTitle(submitPayload.title) ?? null;

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    let surveyId: number;
    let version = 0;

    if (typeof submitPayload.surveyId === "number" && Number.isFinite(submitPayload.surveyId)) {
      const [surveyRows] = await conn.query<any[]>(
        `SELECT id, title, status FROM surveys WHERE id = ? FOR UPDATE`,
        [submitPayload.surveyId]
      );
      if (!Array.isArray(surveyRows) || !surveyRows[0]) {
        await conn.rollback();
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      }
      const row = surveyRows[0] as { id: number; title: string; status: SurveyStatus };
      if (row.status !== "DRAFT") {
        await conn.rollback();
        return NextResponse.json({ error: "Only drafts can be submitted" }, { status: 409 });
      }
      surveyId = Number(row.id);
      await deleteExistingQuestions(conn, surveyId);
      await conn.execute(
        `
        UPDATE surveys
        SET status = 'PENDING_REVIEW',
            submitted_by = ?,
            submitted_for_review_at = NOW(),
            approved_by = NULL,
            approved_at = NULL,
            effective_at = NULL,
            created_by = COALESCE(created_by, ?)
        WHERE id = ?
        `,
        [auth.id, auth.id, surveyId]
      );
      version = 0;
    } else {
      if (!desiredTitle) {
        await conn.rollback();
        return NextResponse.json({ error: "Survey title is required" }, { status: 400 });
      }

      const [duplicateRows] = await conn.query<any[]>(
        `SELECT id FROM surveys WHERE title = ? AND version = 0 AND status IN ('DRAFT','PENDING_REVIEW') LIMIT 1`,
        [desiredTitle]
      );
      if (Array.isArray(duplicateRows) && duplicateRows[0]) {
        await conn.rollback();
        return NextResponse.json({ error: "A draft already exists for this title." }, { status: 409 });
      }

      const [result] = await conn.execute<any>(
        `
        INSERT INTO surveys (
          title,
          created_by,
          status,
          version,
          submitted_by,
          submitted_for_review_at,
          approved_by,
          approved_at,
          effective_at
        )
        VALUES (?, ?, 'PENDING_REVIEW', 0, ?, NOW(), NULL, NULL, NULL)
        `,
        [desiredTitle, auth.id, auth.id]
      );
      surveyId = Number(result.insertId);
    }

    await insertQuestions(conn, surveyId, normalised);
    await conn.commit();

    await recordAuditEvent({
      req,
      actorAdminId: auth.id,
      action: "SUBMIT_FOR_REVIEW",
      targetType: "survey",
      targetId: surveyId,
      notes: "Submitted survey for review.",
    });

    return NextResponse.json({ surveyId, version }, { status: 201 });
  } catch (error: any) {
    await conn.rollback();
    console.error("[questions-builder] submit failed", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Duplicate question key detected in database." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to submit survey for review." }, { status: 500 });
  } finally {
    conn.release();
  }
}
