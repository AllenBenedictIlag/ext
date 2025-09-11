// app/api/surveys/current/route.ts
import { NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import type { RowDataPacket } from "mysql2"; // <-- important

interface SurveyRow extends RowDataPacket {
  id: number;
  title: string;
  version: number;
  published_at: Date | null;
}

interface QuestionRow extends RowDataPacket {
  id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  question_type: "LIKERT" | "YES_NO" | "TEXT" | "NUMBER";
  required: 0 | 1;
  help_text: string | null;
}

interface OptionRow extends RowDataPacket {
  id: number;
  question_id: number;
  option_value: string;
  label: string;
}

export async function GET() {
  const pool = getPool();

  // ✅ Type now satisfies mysql2 constraint
  const [surveyRows] = await pool.execute<SurveyRow[]>(
    `
    SELECT id, title, version, published_at
    FROM surveys
    WHERE status = 'PUBLISHED'
    ORDER BY published_at DESC, version DESC
    LIMIT 1
    `
  );

  if (surveyRows.length === 0) {
    return NextResponse.json({ error: "No published survey found." }, { status: 404 });
  }

  const survey = surveyRows[0];

  const [questionRows] = await pool.execute<QuestionRow[]>(
    `
    SELECT id, display_order, question_key, prompt, question_type, required, help_text
    FROM questions
    WHERE survey_id = ?
    ORDER BY display_order ASC, id ASC
    `,
    [survey.id]
  );

  let optionRows: OptionRow[] = [];
  if (questionRows.length) {
    const ids = questionRows.map((q) => q.id);
    const placeholders = ids.map(() => "?").join(",");
    const [opts] = await pool.execute<OptionRow[]>(
      `
      SELECT id, question_id, option_value, label
      FROM question_options
      WHERE question_id IN (${placeholders})
      ORDER BY id ASC
      `,
      ids
    );
    optionRows = opts;
  }

  // …build your payload as before, converting Date -> ISO safely:
  const payload = {
    id: survey.id,
    title: survey.title,
    version: survey.version,
    published_at: survey.published_at ? survey.published_at.toISOString() : null,
    questions: questionRows.map((q) => ({
      id: q.id,
      display_order: q.display_order,
      question_key: q.question_key,
      prompt: q.prompt,
      question_type: q.question_type,
      required: q.required,
      help_text: q.help_text,
      options: optionRows
        .filter((o) => o.question_id === q.id)
        .map((o) => ({ id: o.id, option_value: o.option_value, label: o.label })),
    })),
  };

  return NextResponse.json(payload);
}
