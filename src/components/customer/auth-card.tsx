"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

const CODE_PATTERN = /^[A-Z0-9-]{4,64}$/; // matches RCP-2025-0001

type VerifyResponse =
  | { state: "invalid"; message: string }
  | { state: "expired"; message: string }
  | { state: "used"; message: string; redirect?: string }
  | { state: "ok"; redirect?: string };

type Summary = {
  receipt_code: string;
  submission: { id: number; survey_id: number; submitted_at: string };
  answers: Array<{
    key: string;
    prompt: string;
    type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
    display_order: number;
    value: string | null;
    raw: any;
  }>;
};

export function CustomerAuthCard() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // "used" popup state
  const [usedOpen, setUsedOpen] = React.useState(false);
  const [usedMessage, setUsedMessage] = React.useState<string>("");
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);

  // Terms dialog state
  const [tcOpen, setTcOpen] = React.useState(false);
  const [tcChecked, setTcChecked] = React.useState(false);

  const valid = CODE_PATTERN.test(code);
  const canBegin = valid && agree && !busy;

  async function handleBegin(e: React.FormEvent) {
    e.preventDefault();
    if (!canBegin) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_number: code }),
      });

      const data: VerifyResponse = await res.json();

      if (data.state === "invalid") {
        setError(data.message || "Invalid control number.");
        return;
      }

      if (data.state === "expired") {
        setError(data.message || "This Survey ID has expired.");
        return;
      }

      if (data.state === "used") {
        setUsedMessage(
          data.message ||
            "It seems you've already provided your feedback — we appreciate it! Here is the summary of your feedback:"
        );
        setSummaryLoading(true);
        setUsedOpen(true);

        try {
          const sRes = await fetch(
            `/api/feedback/summary?code=${encodeURIComponent(code)}`
          );
          if (sRes.ok) {
            const json = await sRes.json();
            setSummary(json);
          } else {
            setSummary(null);
          }
        } catch {
          setSummary(null);
        } finally {
          setSummaryLoading(false);
        }
        return;
      }

      const target =
        data.redirect && data.redirect.startsWith("/")
          ? data.redirect
          : `/feedback?code=${encodeURIComponent(code)}`;

      router.push(target);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Tooltip copy + show it only on hover (no forced open)
  const disabledReason =
    !valid
      ? "Enter a valid Survey ID."
      : !agree
      ? "You must read and agree to the Terms first."
      : busy
      ? "Please wait…"
      : null;

  return (
    <>
      {/* USED POPUP (shows full summary) */}
      <Dialog open={usedOpen} onOpenChange={setUsedOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Thank you 🙌</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-2">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{usedMessage}</p>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="mb-2 font-bold">Your previous answers</p>

                {summaryLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </div>
                )}

                {!summaryLoading && !summary && (
                  <p className="text-muted-foreground">
                    Sorry, we couldn’t load your summary.
                  </p>
                )}

                {!summaryLoading && summary && (
                  <ul className="space-y-3">
                    {summary.answers
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((a) => (
                        <li
                          key={a.key}
                          className="rounded-md border bg-background p-3"
                        >
                          <div className="text-[0.9rem] font-medium text-foreground">
                            {a.prompt}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {a.value ?? "—"}
                          </div>
                        </li>
                      ))}
                    <li className="rounded-md border bg-background p-3">
                      <div className="text-[0.8rem] text-muted-foreground">
                        Submitted at:{" "}
                        <span className="tabular-nums">
                          {new Date(
                            summary.submission.submitted_at
                          ).toLocaleString()}
                        </span>
                      </div>
                    </li>
                  </ul>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setUsedOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* CARD */}
      <Card className="mx-auto w-full max-w-sm bg-card px-4 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <Image
            src="/images/coffee-black.png"
            alt=""
            width={96}
            height={96}
            className="mx-auto h-24 w-24 object-contain dark:hidden"
            priority
          />
          <Image
            src="/images/coffee-white.png"
            alt="Coffee Crave"
            width={96}
            height={96}
            className="mx-auto hidden h-24 w-24 object-contain dark:block"
          />
          <CardTitle className="text-base">Welcome</CardTitle>
          <CardDescription>
            Use your receipt&apos;s{" "}
            <span className="font-medium">Survey ID</span> to begin
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleBegin} noValidate>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="code" className="text-sm font-medium">
                Survey ID
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AAA-0000-0000"
                maxLength={64}
                className="
                  h-10 rounded-xl border-2 border-muted-foreground/30
                  text-center font-mono text-lg tracking-[0.25em]
                  focus:border-primary focus:ring-2 focus:ring-primary/30
                "
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "code-error" : undefined}
              />
              {error ? (
                <p id="code-error" className="text-xs text-red-600">
                  {error}
                </p>
              ) : null}
            </div>

            {/* Terms link + Dialog with checkbox inside */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Dialog open={tcOpen} onOpenChange={(o) => {
                  setTcOpen(o);
                  if (!o) setTcChecked(false); // reset when closing
                }}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-4 pb-6"
                      aria-haspopup="dialog"
                    >
                      Terms and Conditions
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Privacy &amp; Data Use</DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="max-h-[55vh] pr-2">
                      <div className="mb-5 mt-3 space-y-3 text-sm leading-relaxed text-justify">
                        <p>
                          By participating in this Customer Feedback Survey, you
                          may be asked to provide personal information such as
                          your name, contact number, and email address. This
                          information is collected voluntarily and will only be
                          used for specific purposes, including contacting you
                          for additional feedback, sharing relevant updates
                          about our business (with your consent), and producing
                          aggregated, anonymous data for statistical analysis
                          and insights.
                        </p>
                        <p>
                          We are committed to protecting your privacy and
                          ensuring that your information remains confidential
                          and secure. Your personal data will never be sold,
                          shared, or disclosed to third parties without your
                          explicit consent, unless required by law. All personal
                          information will be retained only as long as necessary
                          for the purposes stated above and will be securely
                          deleted thereafter. By participating in this survey,
                          you confirm that you understand and agree to the above
                          terms.
                        </p>
                      </div>
                    </ScrollArea>

                    <div className="mt-3 flex items-start gap-3 text-sm">
                      <Checkbox
                        id="agree-in-dialog"
                        checked={tcChecked}
                        onCheckedChange={(v) => setTcChecked(Boolean(v))}
                        className="mt-0.5 h-4 w-4 shrink-0 border-2 border-muted-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <Label
                        htmlFor="agree-in-dialog"
                        className="cursor-pointer select-none leading-5"
                      >
                        I have read and agree to the Terms and Conditions.
                      </Label>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTcOpen(false)}
                      >
                        Close
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (tcChecked) {
                            setAgree(true);
                            setTcOpen(false);
                          }
                        }}
                        disabled={!tcChecked}
                      >
                        Agree &amp; Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            {/* END Terms dialog */}
          </CardContent>

          <CardFooter className="flex items-center justify-between gap-3 pb-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="min-w-[110px]"
              onClick={() => router.push("/auth/customer")}
            >
              Cancel
            </Button>

            {/* Tooltip appears ONLY on hover when disabledReason exists */}
            {disabledReason ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="submit"
                        className={`min-w-[110px] opacity-50 cursor-not-allowed`}
                        disabled
                      >
                        {busy && (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden
                          />
                        )}
                        Begin
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="max-w-[220px] text-xs">{disabledReason}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button type="submit" className="min-w-[110px]">
                {busy && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Begin
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
