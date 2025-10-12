// app/customer/feedback/page.tsx (or wherever this route lives)
import FeedbackForm from "@/components/customer/feedback-form";
import { SiteFooter } from "@/components/customer/site-footer";
import { ModeToggle } from "@/components/ui/theme-button";

type Search = { code?: string | string[] };

export default function FeedbackPage({ searchParams }: { searchParams: Search }) {
  const rawCode = searchParams?.code;
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode ?? "").toString().trim();

  if (!code) {
    return (
      <main className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div className="absolute right-6 top-6 z-50">
          <ModeToggle />
        </div>

        <div className="flex-1">
          <div className="container mx-auto grid h-full max-w-4xl place-content-center gap-4 px-4 md:px-6 lg:px-8">
            <div>
              <h1 className="mb-2 text-2xl font-semibold tracking-tight">Customer Feedback</h1>
              <p className="rounded-md border border-destructive bg-destructive px-3 py-2 text-destructive-foreground">
                Missing receipt code. Please use your unique link or log in again to get a valid code.
              </p>
            </div>
          </div>
        </div>

        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="absolute right-6 top-6 z-50">
        <ModeToggle />
      </div>

      {/* content */}
      <div className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 pt-12 pb-8 md:px-6 lg:px-8">
          {/* FeedbackForm already handles its own sticky progress + sticky bottom */}
          <FeedbackForm code={code} />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
