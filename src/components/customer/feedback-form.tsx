// D:\Projects\sidebar\src\components\customer\feedback-form.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "../ui/input";

// ---------- NEW: DTOs from /api/surveys/current ----------
type OptionDTO = {
  id: number;
  option_value: string;
  label: string;
};

type QuestionDTO = {
  id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  question_type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  required: 0 | 1;
  help_text: string | null;
  options: OptionDTO[];
};

type SurveyDTO = {
  id: number;
  title: string;
  version: number;
  published_at: string | null;
  questions: QuestionDTO[];
};

// ---------- Your existing UI helpers ----------
type LikertValue = "1" | "2" | "3" | "4";

const LIKERT_EMOJIS: Record<LikertValue, { emoji: string }> = {
  "1": { emoji: "😔" },
  "2": { emoji: "😟" },
  "3": { emoji: "😐" },
  "4": { emoji: "🙂" },
};

// Generic "answers" bag keyed by question_key; keep code separate
export type FormState = {
  code: string;
  answers: Record<string, string | undefined>; // key = question_key, value = option_value or free text
};

// Page plumbing
type PageType = "likert" | "yesno" | "free" | "short" | "review";
type Page = {
  key: string; // question_key or "review"
  type: PageType;
  title: string;
  desc: string;
  required?: boolean;
  question?: QuestionDTO;
  render: React.ReactNode;
};

// ---------- Progress + Tile components ----------
function ProgressHeader({ current, total }: { current: number; total: number }) {
  const clamped = Math.min(current, total);
  const activeIdx = clamped - 1;

  return (
    <div className="sticky top-0 z-10 -mx-32 bg-sidebar/80 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
      <div className="mx-auto w-full max-w-4xl rounded-md p-3 bg-sidebar/40">
        <div className="mb-2 text-base font-medium text-foreground">
          <span className="tabular-nums">{clamped}</span> of{" "}
          <span className="tabular-nums">{total}</span>
        </div>

        <div className="flex gap-2">
          {Array.from({ length: total }).map((_, i) => {
            const isDone = i < activeIdx;
            const isCurrent = i === activeIdx;
            const isTodo = i > activeIdx;
            return (
              <div key={i} className="relative h-2 flex-1">
                <div className="absolute inset-0 rounded-full bg-muted" />
                {isDone && <div className="absolute inset-[1px] rounded-full bg-primary" />}
                {isCurrent && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-1 rounded-full bg-primary/35 blur-[6px]"
                    />
                    <div className="absolute inset-[1px] rounded-full bg-primary ring-2 ring-primary/40" />
                  </>
                )}
                {isTodo && <div className="absolute inset-[1px] rounded-full bg-muted-foreground/20" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmojiTile({
  selected,
  emoji,
  caption,
  onClick,
}: {
  selected: boolean;
  emoji: string;
  caption: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-2xl border px-6 py-7 text-center transition",
        "bg-card hover:bg-accent hover:text-accent-foreground",
        selected && "ring-2 ring-ring bg-primary/10"
      )}
      aria-pressed={selected}
    >
      {selected && (
        <span className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          ✓
        </span>
      )}
      <div className="mb-2 text-3xl leading-none">{emoji}</div>
      <div className="text-sm font-medium">{caption}</div>
    </button>
  );
}

// ---------- Label helpers ----------
function likertLabelFromOptions(opts: OptionDTO[], v?: string) {
  if (!v) return "—";
  return opts.find((o) => o.option_value === v)?.label ?? "—";
}
function yesNoLabelFromOptions(opts: OptionDTO[], v?: string) {
  if (!v) return "—";
  return opts.find((o) => o.option_value === v)?.label ?? (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
}
function formatAnswerForDisplay(q: QuestionDTO, v?: string) {
  if (!v || (typeof v === "string" && !v.trim())) return "—";
  if (q.question_type === "LIKERT") return likertLabelFromOptions(q.options, v);
  if (q.question_type === "YES_NO") return yesNoLabelFromOptions(q.options, v);
  return v;
}

// ---------- NEW: helper to know if a required page is answered ----------
function isPageAnswered(page: Page, answers: Record<string, string | undefined>) {
  if (!page || page.key === "review" || !page.required) return true;
  const v = answers[page.key];
  if (v == null) return false;

  if (page.type === "free" || page.type === "short") {
    return typeof v === "string" && v.trim().length > 0;
  }
  return String(v).length > 0; // likert/yesno
}

export default function FeedbackForm({
  code,
  onSubmit,
  className,
}: {
  code: string;
  onSubmit?: (data: FormState) => Promise<void> | void;
  className?: string;
}) {
  const router = useRouter();

  // ---------- survey loading ----------
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [survey, setSurvey] = useState<SurveyDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // submission state
  const [submitting, setSubmitting] = useState(false); // used for Exit (actual save)
  const [step, setStep] = useState(1);

  // answers bag
  const [data, setData] = useState<FormState>({ code, answers: {} });

  // ---------- NEW: success dialog (opens BEFORE saving) ----------
  const [successOpen, setSuccessOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---------- "Used survey ID" dialog ----------
  const [usedOpen, setUsedOpen] = useState(false);
  const [usedSummary, setUsedSummary] = useState<Record<string, string> | null>(null);

  // Load survey once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSurvey(true);
        const res = await fetch("/api/surveys/current", { cache: "no-store" });
        if (!res.ok) {
          const msg = (await res.json().catch(() => ({} as any)))?.error ?? `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const payload: SurveyDTO = await res.json();
        if (mounted) setSurvey(payload);
      } catch (e: any) {
        if (mounted) setLoadError(e?.message || "Failed to load survey.");
      } finally {
        if (mounted) setLoadingSurvey(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Short helper to set an answer
  const setAnswer = (key: string, value: string | undefined) =>
    setData((d) => ({ ...d, answers: { ...d.answers, [key]: value } }));

  // ---------- Build dynamic pages from survey ----------
  const pages: Page[] = useMemo(() => {
    const base: Page[] = [];

    if (survey?.questions?.length) {
      for (const q of survey.questions) {
        if (q.question_type === "YES_NO") {
          const yes = q.options.find((o) => o.option_value === "yes");
          const no = q.options.find((o) => o.option_value === "no");
          base.push({
            key: q.question_key,
            type: "yesno",
            title: `Question ${q.display_order}`,
            desc: q.prompt,
            required: !!q.required,
            question: q,
            render: (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm:col-start-2">
                  <EmojiTile
                    selected={data.answers[q.question_key] === yes?.option_value}
                    emoji="👍"
                    caption={yes?.label ?? "Yes"}
                    onClick={() => setAnswer(q.question_key, yes?.option_value)}
                  />
                </div>
                <div className="sm:col-start-3">
                  <EmojiTile
                    selected={data.answers[q.question_key] === no?.option_value}
                    emoji="👎"
                    caption={no?.label ?? "No"}
                    onClick={() => setAnswer(q.question_key, no?.option_value)}
                  />
                </div>
              </div>
            ),
          });
        } else if (q.question_type === "LIKERT") {
          const opts = [...q.options].sort((a, b) => (a.option_value > b.option_value ? 1 : -1));
          base.push({
            key: q.question_key,
            type: "likert",
            title: `Question ${q.display_order}`,
            desc: q.prompt,
            required: !!q.required,
            question: q,
            render: (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {opts.map((o) => {
                  const em = (LIKERT_EMOJIS as any)[o.option_value as LikertValue]?.emoji ?? "🙂";
                  return (
                    <EmojiTile
                      key={o.id}
                      emoji={em}
                      caption={o.label}
                      selected={data.answers[q.question_key] === o.option_value}
                      onClick={() => setAnswer(q.question_key, o.option_value)}
                    />
                  );
                })}
              </div>
            ),
          });
        } else if (q.question_type === "TEXT") {
          base.push({
            key: q.question_key,
            type: "free",
            title: `Question ${q.display_order}`,
            desc: q.prompt,
            required: !!q.required,
            question: q,
            render: (
              <>
                <Label htmlFor={`text-${q.id}`} className="sr-only">
                  {q.prompt}
                </Label>
                <Textarea
                  key={`text-${q.id}`}                 // NEW: prevent DOM reuse
                  id={`text-${q.id}`}
                  placeholder="Type your answer here…"
                  rows={5}
                  className="h-40 max-h-40 w-full resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words break-all"
                  style={{ overflowWrap: "anywhere" }}
                  value={data.answers[q.question_key] ?? ""}    // NEW: controlled
                  onChange={(e) => setAnswer(q.question_key, e.target.value)}
                />
                {q.help_text && (
                  <p className="text-xs text-muted-foreground mt-1">{q.help_text}</p>
                )}
              </>
            ),
          });
        } else if (q.question_type === "SHORT_TEXT") {
          base.push({
            key: q.question_key,
            type: "short",
            title: `Question ${q.display_order}`,
            desc: q.prompt,
            required: !!q.required,
            question: q,
            render: (
              <>
                <Label htmlFor={`short-${q.id}`} className="sr-only">
                  {q.prompt}
                </Label>
                <Input
                  key={`short-${q.id}`}                         // NEW
                  id={`short-${q.id}`}
                  type="text"
                  placeholder="Your answer…"
                  value={data.answers[q.question_key] ?? ""}    // controlled
                  onChange={(e) => setAnswer(q.question_key, e.target.value)}
                />
                {q.help_text && (
                  <p className="text-xs text-muted-foreground mt-1">{q.help_text}</p>
                )}
              </>
            ),
          });
        }
      }
    }

    // Add Review page (always last)
    base.push({
      key: "review",
      type: "review",
      title: "Review & Submit",
      desc: "Please review your answers. Press Submit to finalize.",
      render: (
        <div className="text-sm text-muted-foreground">
          <div className="space-y-3">
            {survey?.questions.map((q) => {
              const v = data.answers[q.question_key];
              const value = formatAnswerForDisplay(q, v);
              return (
                <ReviewItem
                  key={q.id}
                  label={q.prompt}
                  value={value}
                  multiline={q.question_type === "TEXT"}
                />
              );
            })}
          </div>
          <p className="mt-4">You can go back to change any answer before submitting.</p>
        </div>
      ),
    });

    return base;
  }, [survey, data.answers]);

  const total = pages.length;
  const current = pages[step - 1];

  // Compute disabled state for Continue/Submit
  const isCurrentRequiredAndUnanswered =
    current?.key !== "review" && current?.required && !isPageAnswered(current, data.answers);
  const isContinueDisabled = submitting || !data.code || isCurrentRequiredAndUnanswered;

  // ---------- NEW: commit on Exit (actual DB save) ----------
  async function commitSubmission() {
    if (!recap?.code) return;

    try {
      setSaveError(null);
      setSubmitting(true);

      if (onSubmit) {
        await onSubmit(recap);
        setSubmissionId(null);
      } else {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recap),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error ?? `Failed to submit (HTTP ${res.status})`);
        }
        setSubmissionId(payload?.submission_id ?? null);
      }

      // After successful save, leave the flow
      setSuccessOpen(false);
      router.replace("/auth/customer");
      resetForm();
    } catch (e: any) {
      setSaveError(e?.message || "Something went wrong while submitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- OLD doSubmit replaced by open modal ----------
  const onContinue = async () => {
    if (submitting) return;
    if (current?.key !== "review" && current?.required && !isPageAnswered(current, data.answers)) {
      return;
    }
    if (step < total) {
      setStep((s) => s + 1);
    } else {
      // Instead of saving now, open the Thank You popup and defer saving to Exit
      setSubmittedSnapshot({ ...data });
      setSuccessOpen(true);
    }
  };

  const onPrevious = () => setStep((s) => Math.max(1, s - 1));

  const recap = submittedSnapshot ?? data;

  function resetForm() {
    setData({ code, answers: {} });
    setStep(1);
    setSubmittedSnapshot(null);
    setSubmissionId(null);
    setSaveError(null);
  }

  // ---------- Loading / Error states ----------
  if (loadingSurvey) {
    return (
      <div className={cn("mx-auto grid max-w-3xl", className)}>
        <div className="mt-24 text-sm text-muted-foreground">Loading survey…</div>
      </div>
    );
  }
  if (loadError || !survey) {
    return (
      <div className={cn("mx-auto grid max-w-3xl", className)}>
        <div className="mt-24 text-sm text-red-500">
          Failed to load survey: {loadError ?? "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ---------- Used Survey ID Dialog (sticky header + sticky footer) ---------- */}
      <Dialog open={usedOpen} onOpenChange={setUsedOpen}>
        <DialogContent className="max-w-3xl p-0">
          <div className="flex max-h-[85vh] flex-col">
            {/* Sticky Header (with extra line you asked to keep sticky) */}
            <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <DialogHeader className="p-0">
                <DialogTitle className="text-base leading-tight">Thank you 🙌</DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  It seems you&apos;ve already provided your feedback — we appreciate it! For now, we&apos;ll show your summary here.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  You can go back to change any answer before submitting.
                </p>
              </DialogHeader>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {(survey?.questions ?? []).map((q) => {
                  const raw = usedSummary?.[q.question_key];
                  const val = formatAnswerForDisplay(q, raw);
                  return (
                    <ReviewItem
                      key={q.id}
                      label={q.prompt}
                      value={val}
                      multiline={q.question_type === "TEXT"}
                    />
                  );
                })}
                {(!survey?.questions?.length || !usedSummary) && (
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll load your previous answers here once available.
                  </p>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 z-10 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setUsedOpen(false)} className="btn-halo">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Thank You / Finalize Dialog (opens BEFORE saving) ---------- */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🎉 Thank you!</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">
                You&apos;re all set. Click <strong>Exit</strong> to submit your answers and finish.
              </p>
              {submissionId != null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Reference:&nbsp;<span className="font-mono tabular-nums">#{submissionId}</span>
                </p>
              )}
              {saveError && (
                <p className="mt-2 text-xs text-red-500" role="alert">
                  {saveError}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                className="btn-halo btn-halo--emph"
                onClick={commitSubmission}
                disabled={submitting}
                title="This will submit your answers and exit"
              >
                {submitting ? "Submitting…" : "Exit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
        className={cn(" mx-auto grid max-w-3xl", className)}
      >
        <ProgressHeader current={step} total={total} />

        <input type="hidden" name="code" value={data.code} />

        {/* Question card — consistent height */}
        <Card key={`page-${current.key}`} className="w-full mx-auto mt-24 mb-10 border-muted shadow-2xl">
          <div className="flex flex-col min-h-[250px]">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-secondary-foreground text-base">
                {current.title}
                {current.required && current.key !== "review" && (
                  <span className="ml-2 align-middle rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Required
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-foreground text-[1.25rem]">
                {current.desc}
              </CardDescription>
            </CardHeader>

            <CardContent
              className={cn(
                "mt-6 space-y-3",
                current.type === "review" && "max-h-[320px] overflow-auto pr-1"
              )}
            >
              {current.render}
            </CardContent>
          </div>
        </Card>

        <div className="sticky bottom-0 -mx-32 py-3 px-6 backdrop-blur supports-[backdrop-filter]:bg-sidebar">
          <div className="mx-auto flex max-w-4xl justify-between px-8">
            <Button type="button" onClick={onPrevious} disabled={step === 1} className="btn-halo">
              Previous
            </Button>

            <Button
              type="submit"
              disabled={isContinueDisabled}
              aria-disabled={isContinueDisabled}
              title={
                isCurrentRequiredAndUnanswered
                  ? "Please answer the required question to continue"
                  : step === total
                  ? "Open the thank-you popup"
                  : undefined
              }
              className="btn-halo btn-halo--emph"
            >
              {step === total ? "Submit" : "Continue"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function ReviewItem({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-[0.9rem] font-medium text-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm text-muted-foreground",
          multiline && "whitespace-pre-wrap break-words"
        )}
      >
        {value}
      </div>
    </div>
  );
}
