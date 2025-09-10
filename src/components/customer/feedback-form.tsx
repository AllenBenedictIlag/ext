"use client";

import * as React from "react";
import { useState } from "react";
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

type LikertValue = "1" | "2" | "3" | "4";
export type FormState = {
  code: string;
  accurate?: "yes" | "no" | "";
  overall?: LikertValue;
  speed?: LikertValue;
  friendliness?: LikertValue;
  quality?: LikertValue;
  taste?: LikertValue;
  ambience?: LikertValue;
  cleanliness?: LikertValue;
  revisit?: "yes" | "no" | "";
  comments?: string;
};

type Props = {
  code: string;
  onSubmit?: (data: FormState) => Promise<void> | void;
  className?: string;
};

const EMOJI_SCALE = [
  { value: "1" as LikertValue, caption: "Extremely Dissatisfied", emoji: "😔" },
  { value: "2" as LikertValue, caption: "Dissatisfied", emoji: "😟" },
  { value: "3" as LikertValue, caption: "Satisfied", emoji: "😐" },
  { value: "4" as LikertValue, caption: "Extremely Satisfied", emoji: "🙂" },
];

type PageType = "likert" | "yesno" | "free" | "review";
type Page = {
  key: keyof FormState | "review";
  type: PageType;
  title: string;
  desc: string;
  render: React.ReactNode;
};

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

// helpers for the Review page + success dialog
function likertLabel(v?: LikertValue) {
  return EMOJI_SCALE.find((o) => o.value === v)?.caption ?? "—";
}
function yesNoLabel(v?: "yes" | "no" | "") {
  return v === "yes" ? "Yes" : v === "no" ? "No" : "—";
}

export default function FeedbackForm({ code, onSubmit, className }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FormState>({ code, accurate: "", revisit: "" });
  const [step, setStep] = useState(1);

  // success dialog state
  const [successOpen, setSuccessOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  // keep a snapshot of what was submitted so recap doesn’t blank after reset
  const [submittedSnapshot, setSubmittedSnapshot] = useState<FormState | null>(null);

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setData((d) => ({ ...d, [key]: val }));

  const pages: Page[] = [
    {
      key: "accurate",
      type: "yesno",
      title: "Question 1",
      desc: "Was your order accurate?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sm:col-start-2">
            <EmojiTile
              selected={data.accurate === "yes"}
              emoji="👍"
              caption="Yes"
              onClick={() => setField("accurate", "yes")}
            />
          </div>
          <div className="sm:col-start-3">
            <EmojiTile
              selected={data.accurate === "no"}
              emoji="👎"
              caption="No"
              onClick={() => setField("accurate", "no")}
            />
          </div>
        </div>
      ),
    },
    {
      key: "overall",
      type: "likert",
      title: "Question 2",
      desc: "Based on your visit, how was your overall satisfaction?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.overall === o.value}
              onClick={() => setField("overall", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "speed",
      type: "likert",
      title: "Question 3",
      desc: "How satisfied were you with the speed of service?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.speed === o.value}
              onClick={() => setField("speed", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "friendliness",
      type: "likert",
      title: "Question 4",
      desc: "How satisfied were you with the staff's friendliness?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.friendliness === o.value}
              onClick={() => setField("friendliness", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "quality",
      type: "likert",
      title: "Question 5",
      desc: "Rate the quality of food and drinks.",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.quality === o.value}
              onClick={() => setField("quality", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "taste",
      type: "likert",
      title: "Question 6",
      desc: "Rate the taste and aroma of your order.",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.taste === o.value}
              onClick={() => setField("taste", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "ambience",
      type: "likert",
      title: "Question 7",
      desc: "Rate the ambience of the shop.",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.ambience === o.value}
              onClick={() => setField("ambience", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "cleanliness",
      type: "likert",
      title: "Question 8",
      desc: "Rate the cleanliness of the shop.",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.cleanliness === o.value}
              onClick={() => setField("cleanliness", o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: "revisit",
      type: "yesno",
      title: "Question 9",
      desc: "Based on your experience, would you visit us again?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sm:col-start-2">
            <EmojiTile
              selected={data.revisit === "yes"}
              emoji="👍"
              caption="Yes"
              onClick={() => setField("revisit", "yes")}
            />
          </div>
          <div className="sm:col-start-3">
            <EmojiTile
              selected={data.revisit === "no"}
              emoji="👎"
              caption="No"
              onClick={() => setField("revisit", "no")}
            />
          </div>
        </div>
      ),
    },
    {
      key: "comments",
      type: "free",
      title: "Question 10",
      desc: "Any additional comments or suggestions?",
      render: (
        <>
          <Label htmlFor="comments" className="sr-only">
            Comments
          </Label>
          <Textarea
            id="comments"
            placeholder="Type your comments here…"
            rows={5}
            className="h-40 max-h-40 w-full resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words break-all"
            style={{ overflowWrap: "anywhere" }}
            onChange={(e) => setField("comments", e.target.value)}
          />
        </>
      ),
    },
    {
      key: "review",
      type: "review",
      title: "Review & Submit",
      desc: "Please review your answers. Press Submit to finalize.",
      render: (
        <div className="text-sm text-muted-foreground">
          <div className="space-y-3">
            <ReviewItem label="Was your order accurate?" value={yesNoLabel(data.accurate)} />
            <ReviewItem label="Overall satisfaction" value={likertLabel(data.overall)} />
            <ReviewItem label="Speed of service" value={likertLabel(data.speed)} />
            <ReviewItem label="Staff friendliness" value={likertLabel(data.friendliness)} />
            <ReviewItem label="Quality of food and drinks" value={likertLabel(data.quality)} />
            <ReviewItem label="Taste and aroma" value={likertLabel(data.taste)} />
            <ReviewItem label="Ambience of the shop" value={likertLabel(data.ambience)} />
            <ReviewItem label="Cleanliness of the shop" value={likertLabel(data.cleanliness)} />
            <ReviewItem label="Would you visit us again?" value={yesNoLabel(data.revisit)} />
            <ReviewItem
              label="Comments"
              value={data.comments?.trim() ? data.comments.trim() : "—"}
              multiline
            />
          </div>
          <p className="mt-4">You can go back to change any answer before submitting.</p>
        </div>
      ),
    },
  ];

  const total = pages.length;
  const current = pages[step - 1] as Page;

  async function doSubmit() {
    if (!data.code) return;

    try {
      setSubmitting(true);

      // Snapshot BEFORE any reset so recap stays accurate
      setSubmittedSnapshot({ ...data });

      if (onSubmit) {
        await onSubmit(data);
        setSubmissionId(null);
      } else {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          // TODO: replace with toasts for 404/410/409
          return;
        }
        setSubmissionId(payload?.submission_id ?? null);
      }

      // Open dialog, reset local form state (no auto-navigation)
      setSuccessOpen(true);

    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const onContinue = async () => {
    if (submitting) return;
    if (step < total) setStep((s) => s + 1);
    else await doSubmit();
  };

  const onPrevious = () => setStep((s) => Math.max(1, s - 1));

  // Prefer snapshot in recap; fallback to current data
  const recap = submittedSnapshot ?? data;

  function resetForm() {
    setData({ code, accurate: "", revisit: "" });
    setStep(1);
    setSubmittedSnapshot(null);
    setSubmissionId(null);
  }

  return (
    <>
      {/* Success Dialog (user chooses when to exit) */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎉 Thanks for your feedback!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">
                We’ve recorded your responses. Your input helps us improve your next visit.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                className="btn-halo btn-halo--emph"
                onClick={() => {
                  // Explicit exit chosen by customer
                  router.replace("/customer/auth");
                  resetForm();
                }}
              >
                Exit
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

        {/* Question card — consistent height for all pages */}
        <Card className="w-full mx-auto mt-24 mb-10 border-muted shadow-2xl">
          <div className="flex flex-col min-h-[250px]">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-secondary-foreground text-base">{current.title}</CardTitle>
              <CardDescription className="text-foreground text-[1.25rem]">
                {current.desc}
              </CardDescription>
            </CardHeader>

            {/* For long review content, allow scrolling within the card */}
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
              disabled={submitting || !data.code}
              className="btn-halo btn-halo--emph"
            >
              {step === total ? (submitting ? "Submitting…" : "Submit") : "Continue"}
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
