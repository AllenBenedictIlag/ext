'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/* ---------- Types (same shape as your form) ---------- */
type LikertValue = '1' | '2' | '3' | '4'
export type FormState = {
  code: string
  accurate?: LikertValue
  overall?: LikertValue
  speed?: LikertValue
  friendliness?: LikertValue
  quality?: LikertValue
  taste?: LikertValue
  ambience?: LikertValue
  cleanliness?: LikertValue
  revisit?: 'yes' | 'no' | ''
  comments?: string
  name?: string
  email?: string
  phone?: string
  subscribe?: boolean
}

type Props = {
  code: string
  onSubmit?: (data: FormState) => Promise<void> | void
  className?: string
}

/* ---------- Visual constants ---------- */
const EMOJI_SCALE = [
  { value: '1' as LikertValue, caption: 'Never', emoji: '😔' },
  { value: '2' as LikertValue, caption: 'Rarely', emoji: '😟' },
  { value: '3' as LikertValue, caption: 'Sometimes', emoji: '😐' },
  { value: '4' as LikertValue, caption: 'Often', emoji: '🙂' },
]

function ProgressHeader({ current, total }: { current: number; total: number }) {
  const filled = Math.min(current, total)
  return (
    <div className="sticky top-0 z-10 -mx-2 bg-background/80 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 text-sm text-foreground/80">
          <span className="tabular-nums">{filled}</span> of <span className="tabular-nums">{total}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i < filled ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </div>
    </div>
  )
}

function EmojiTile({
  selected,
  emoji,
  caption,
  onClick,
}: {
  selected: boolean
  emoji: string
  caption: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border px-6 py-7 text-center transition',
        'bg-card hover:bg-accent hover:text-accent-foreground',
        selected && 'ring-2 ring-ring bg-primary/10'
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
  )
}

/* ---------- Wizard ---------- */
export default function FeedbackWizard({ code, onSubmit, className }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<FormState>({ code, revisit: '', subscribe: true })
  const [step, setStep] = useState(1)

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setData((d) => ({ ...d, [key]: val }))

  /* Define each “page”. Keep text short/neutral like your mock. */
  const pages = [
    {
      key: 'accurate',
      title: 'Question 1',
      desc: 'Was your order accurate?',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.accurate === o.value}
              onClick={() => setField('accurate', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'overall',
      title: 'Question 2',
      desc: 'Based on your visit, how was your overall satisfaction?',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.overall === o.value}
              onClick={() => setField('overall', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'speed',
      title: 'Question 3',
      desc: 'How satisfied were you with the speed of service?',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.speed === o.value}
              onClick={() => setField('speed', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'friendliness',
      title: 'Question 4',
      desc: "How satisfied were you with the staff's friendliness?",
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.friendliness === o.value}
              onClick={() => setField('friendliness', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'quality',
      title: 'Question 5',
      desc: 'Rate the quality of food and drinks.',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.quality === o.value}
              onClick={() => setField('quality', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'taste',
      title: 'Question 6',
      desc: 'Rate the taste and aroma of your order.',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.taste === o.value}
              onClick={() => setField('taste', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'ambience',
      title: 'Question 7',
      desc: 'Rate the ambience of the shop.',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.ambience === o.value}
              onClick={() => setField('ambience', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'cleanliness',
      title: 'Question 8',
      desc: 'Rate the cleanliness of the shop.',
      render: (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EMOJI_SCALE.map((o) => (
            <EmojiTile
              key={o.value}
              emoji={o.emoji}
              caption={o.caption}
              selected={data.cleanliness === o.value}
              onClick={() => setField('cleanliness', o.value)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'revisit',
      title: 'Question 9',
      desc: 'Based on your experience, would you visit us again?',
      render: (
        <div className="grid max-w-sm grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((val) => (
            <EmojiTile
              key={val}
              emoji={val === 'yes' ? '👍' : '👎'}
              caption={val === 'yes' ? 'Yes' : 'No'}
              selected={data.revisit === val}
              onClick={() => setField('revisit', val)}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'comments',
      title: 'Question 10',
      desc: 'Any additional comments or suggestions?',
      render: (
        <>
          <Label htmlFor="comments" className="sr-only">Comments</Label>
          <Textarea
            id="comments"
            placeholder="Type your comments here…"
            className="min-h-[160px]"
            onChange={(e) => setField('comments', e.target.value)}
          />
        </>
      ),
    },
    {
      key: 'name',
      title: 'Question 11',
      desc: 'What is your full name? (optional)',
      render: (
        <>
          <Label htmlFor="name" className="sr-only">Full name</Label>
          <Input id="name" placeholder="Juan Dela Cruz" onChange={(e) => setField('name', e.target.value)} />
        </>
      ),
    },
    {
      key: 'email',
      title: 'Question 12',
      desc: 'Your email (optional)',
      render: (
        <>
          <Label htmlFor="email" className="sr-only">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" onChange={(e) => setField('email', e.target.value)} />
        </>
      ),
    },
    {
      key: 'phone',
      title: 'Question 13',
      desc: 'Phone number (optional)',
      render: (
        <>
          <Label htmlFor="phone" className="sr-only">Phone</Label>
          <Input id="phone" type="tel" placeholder="+63 9xx xxx xxxx" onChange={(e) => setField('phone', e.target.value)} />
        </>
      ),
    },
    {
      key: 'subscribe',
      title: 'Question 14',
      desc: 'Join our mailing list?',
      render: (
        <div className="flex items-center gap-2">
          <input
            id="subscribe"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-input"
            onChange={(e) => setField('subscribe', e.target.checked)}
          />
          <Label htmlFor="subscribe" className="text-sm">Yes, add me to the mailing list.</Label>
        </div>
      ),
    },
    {
      key: 'review',
      title: 'Review & Submit',
      desc: 'Press Continue to submit your feedback.',
      render: (
        <div className="text-sm text-muted-foreground">
          You can go back to change any answer before submitting.
        </div>
      ),
    },
  ] as const

  const total = pages.length
  const current = pages[step - 1]

  const requiredKeys: (keyof FormState)[] = [
    'accurate','overall','speed','friendliness','quality','taste','ambience','cleanliness','revisit',
  ]
  const answeredCount = useMemo(
    () => requiredKeys.reduce((n, k) => n + (data[k] ? 1 : 0), 0),
    [data]
  )

  async function doSubmit() {
    if (!data.code) {
      alert('Missing receipt code. Please use your unique link or contact staff.')
      return
    }
    try {
      setSubmitting(true)
      if (onSubmit) {
        await onSubmit(data)
      } else {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }
      alert('Thank you! Your feedback has been submitted.')
      setData({ code: data.code, revisit: '', subscribe: true })
      setStep(1)
    } catch (e) {
      console.error(e)
      alert('Sorry—something went wrong submitting your feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  const onContinue = async () => {
    if (step < total) setStep((s) => s + 1)
    else await doSubmit()
  }

  const onPrevious = () => setStep((s) => Math.max(1, s - 1))

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onContinue() }}
      className={cn('mx-auto grid max-w-3xl gap-4', className)}
    >
      {/* Title + scale hint (optional) */}
      <div className="mt-2">
        <h1 className="text-2xl font-semibold">Customer Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Likert Scale: 1 = “Extremely Dissatisfied”, 4 = “Extremely Satisfied”.
        </p>
      </div>

      <ProgressHeader current={step - 1} total={15} />

      {/* Code banner */}
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Feedback code:</span>{' '}
          <span className="font-medium tracking-wide">{data.code || '—'}</span>
        </div>
        <div className="text-xs text-muted-foreground">one-time link</div>
      </div>
      <input type="hidden" name="code" value={data.code} />

      {/* Page card */}
      <Card className="mt-2 border-muted shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{current.title}</CardTitle>
          <CardDescription className="text-[0.95rem]">{current.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">{current.render}</CardContent>
      </Card>

      <Separator className="my-1" />

      {/* Wizard footer */}
      <div className="sticky bottom-0 bg-background/80 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-3xl justify-between">
          <Button type="button" variant="secondary" onClick={onPrevious} disabled={step === 1}>
            Previous
          </Button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {answeredCount} of {requiredKeys.length} answered
            </span>
            <Button type="submit" disabled={submitting || !data.code}>
              {step === total ? (submitting ? 'Submitting…' : 'Continue') : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
