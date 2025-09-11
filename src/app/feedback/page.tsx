import FeedbackForm from '@/components/customer/feedback-form'
import { ModeToggle } from '@/components/ui/theme-button'

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const sp = await searchParams
  const rawCode = sp?.code
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode ?? '').toString().trim()

  if (!code) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Customer Feedback</h1>
        <p className="text-destructive-foreground bg-destructive border border-destructive rounded-md px-3 py-2">
          Missing receipt code. Please use your unique link or log in again to get a valid code.
        </p>
      </main>
    )
  }

  return (
    <main className="bg-sidebar min-h-screen container mx-auto max-w-6xl px-4 py-8">
      <div className="absolute right-6 top-6 z-50">
        <ModeToggle />
      </div>
      {/* Don't pass a function from a Server Component */}
      <FeedbackForm code={code} />
    </main>
  )
}
