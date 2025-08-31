import FeedbackForm from '@/components/customer/feedback-form'

export default function FeedbackPage({
  searchParams,
}: {
  searchParams: { code?: string }
}) {
  const code = (searchParams?.code ?? '').toString().trim()

  if (!code) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Customer Feedback</h1>
        <p className="text-destructive-foreground bg-destructive/10 border border-destructive rounded-md px-3 py-2">
          Missing receipt code. Please use your unique link or log in again to get a valid code.
        </p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Customer Feedback</h1>
      <p className="mb-6 text-muted-foreground">
        Likert Scale: 1 = “Extremely Dissatisfied”, 4 = “Extremely Satisfied”.
      </p>
      {/* Don't pass a function from a Server Component */}
      <FeedbackForm code={code} />
    </main>
  )
}
