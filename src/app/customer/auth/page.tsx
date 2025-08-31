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
import { Loader2 } from "lucide-react";

// -----------------------------------------------------------------------------
// Coffee Crave • Auth
// -----------------------------------------------------------------------------

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/; // adjust to real format

type VerifyResult =
  | { state: "invalid"; message: string }
  | { state: "used"; message: string; summaryUrl?: string }
  | { state: "ok"; nextUrl?: string };

// mock verify (replace with your API)
async function demoVerify(code: string): Promise<VerifyResult> {
  await new Promise((r) => setTimeout(r, 500));
  if (!CODE_PATTERN.test(code))
    return { state: "invalid", message: "Invalid Control Number" };
  if (code === "USED123")
    return {
      state: "used",
      message: "We've already received your feedback.",
      summaryUrl: "/feedback/summary?code=" + code,
    };
  return { state: "ok", nextUrl: "/feedback/form?code=" + code };
}

/**
 * ReceiptPanel — extracted component for easier customization
 */
function ReceiptPanel({
  imageSrc = "/images/receipt.png",
  title = "Receipt",
  subtitle = "Preview",
  caption = "Sample only",
  aspect = "aspect-[7/12]",
  showBadge = true,
  footer,
}: {
  imageSrc?: string;
  title?: string;
  subtitle?: string;
  caption?: string;
  aspect?: string;
  showBadge?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          {showBadge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-none text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>

        {/* Image */}
        <div
          className={`relative overflow-hidden rounded-xl border border-muted-foreground/30 bg-muted/20 ${aspect}`}
        >
          <Image
            src={imageSrc}
            alt="Receipt preview"
            fill
            className="object-contain p-3"
            priority
            sizes="(min-width: 768px) 440px, 90vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
          {caption ? (
            <div className="absolute bottom-2 left-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
              {caption}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function FeedbackAuthPage() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const valid = CODE_PATTERN.test(code);
  const canBegin = valid && agree && !busy;

  async function handleBegin(e: React.FormEvent) {
    e.preventDefault();
    if (!canBegin) return;
    setBusy(true);
    try {
      const data = await demoVerify(code);
      if (data.state === "ok" && data.nextUrl) router.push(data.nextUrl);
      // If you want to surface invalid/used, show a toast or inline error here.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-sidebar text-foreground">
      <div className="mx-auto grid w-full max-w-6xl min-h-dvh grid-cols-1 gap-8 px-4 py-8 md:grid-cols-[minmax(270px,390px)_1fr] md:gap-10 md:px-6 lg:px-8">
        {/* LEFT: receipt preview */}
        <div className="order-2 mt-12 md:order-1">
          <ReceiptPanel />
        </div>

        {/* RIGHT */}
        <section className="order-1 flex flex-col gap-6 md:order-2 md:gap-8">
          <header className="m-5 space-y-3 pt-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="font-extrabold">Coffee Crave </span> - Your Opinion Matters
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                With your suggestions, we can improve the Coffee Crave
                experience. Please be advised that Coffee Crave will use the
                responses you provide in this survey to better understand,
                manage, and improve your experience. <span aria-hidden>☕</span>
              </p>
            </div>
          </header>

          <div className="w-full">
            <Card className="mx-auto w-full max-w-sm bg-card shadow-sm">
              <CardHeader className="space-y-1 text-center">
                <Image
                  src="/images/coffee-black.png"
                  alt=""
                  width={96}
                  height={96}
                  className="mx-auto h-24 w-24 object-contain dark:hidden"
                  priority
                />
                <CardTitle className="text-base">Welcome</CardTitle>
                <CardDescription>
                  Use your receipt&apos;s <span className="font-medium">Survey ID</span> to
                  begin
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleBegin} noValidate>
                <CardContent className="space-y-5">
                  {/* Survey Code */}
                  <div className="grid gap-2">
                    <Label htmlFor="code" className="text-sm font-medium">
                      Survey ID
                    </Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={12}
                      className="
                        h-10 rounded-xl border-2 border-muted-foreground/30
                        text-center font-mono text-lg tracking-[0.25em]
                        focus:border-primary focus:ring-2 focus:ring-primary/30
                      "
                    />
                  </div>

                  {/* Terms + full policy link */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-4"
                          >
                            Terms and Conditions
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Privacy &amp; Data Use</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[55vh] pr-2">
                            <div className="space-y-3 text-sm leading-relaxed">
                              <p>
                                By participating in this Customer Feedback Survey, you may be
                                asked to provide personal information such as your name,
                                contact number, and email address. This information is
                                collected voluntarily and will only be used for specific
                                purposes, including contacting you for additional feedback,
                                sharing relevant updates about our business (with your
                                consent), and producing aggregated, anonymous data for
                                statistical analysis and insights.
                              </p>
                              <p>
                                We are committed to protecting your privacy and ensuring that
                                your information remains confidential and secure. Your
                                personal data will never be sold, shared, or disclosed to
                                third parties without your explicit consent, unless required
                                by law. All personal information will be retained only as long
                                as necessary for the purposes stated above and will be
                                securely deleted thereafter. By participating in this survey,
                                you confirm that you understand and agree to the above terms.
                              </p>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* consent checkbox */}
                    <div className="mt-3 mb-3 flex items-start gap-3 text-sm">
                      <Checkbox
                        id="agree"
                        checked={agree}
                        onCheckedChange={(v) => setAgree(Boolean(v))}
                        className="mt-0.5 h-4 w-4 shrink-0 border-2 border-muted-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <Label htmlFor="agree" className="cursor-pointer select-none leading-5">
                        I agree to the terms above.
                      </Label>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-3 pb-5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-[110px]"
                    onClick={() => router.push("/")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={`min-w-[110px] ${agree ? "" : "opacity-50 cursor-not-allowed"}`}
                    disabled={!agree || busy}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                    Begin
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
