'use client'

import * as React from 'react'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'


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
}

type Props = {
  code: string
  onSubmit?: (data: FormState) => Promise<void> | void
  className?: string
}

const EMOJI_SCALE = [
  { value: '1' as LikertValue, caption: 'Never',     emoji: '😔' },
  { value: '2' as LikertValue, caption: 'Rarely',    emoji: '😟' },
  { value: '3' as LikertValue, caption: 'Sometimes', emoji: '😐' },
  { value: '4' as LikertValue, caption: 'Often',     emoji: '🙂' },
]

type PageType = 'likert' | 'yesno' | 'free' | 'review'
type Page = {
  key: keyof FormState | 'review'
  type: PageType
  title: string
  desc: string
  render: React.ReactNode
}

function ProgressHeader({ current, total }: { current: number; total: number }) {
  const clamped = Math.min(current, total)
  const activeIdx = clamped - 1

  return (
    <div className="sticky top-0 z-10 -mx-32 bg-sidebar/80 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
      <div className="mx-auto w-full max-w-4xl rounded-md p-3 bg-sidebar/40">
        <div className="mb-2 text-base font-medium text-foreground">
          <span className="tabular-nums">{clamped}</span> of <span className="tabular-nums">{total}</span>
        </div>

        <div className="flex gap-2">
          {Array.from({ length: total }).map((_, i) => {
            const isDone = i < activeIdx
            const isCurrent = i === activeIdx
            const isTodo = i > activeIdx
            return (
              <div key={i} className="relative h-2 flex-1">
                <div className="absolute inset-0 rounded-full bg-muted" />
                {isDone && <div className="absolute inset-[1px] rounded-full bg-primary" />}
                {isCurrent && (
                  <>
                    <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full bg-primary/35 blur-[6px]" />
                    <div className="absolute inset-[1px] rounded-full bg-primary ring-2 ring-primary/40" />
                  </>
                )}
                {isTodo && <div className="absolute inset-[1px] rounded-full bg-muted-foreground/20" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmojiTile({
  selected, emoji, caption, onClick,
}: { selected: boolean; emoji: string; caption: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative w-full rounded-2xl border px-6 py-7 text-center transition', // w-full = fill grid cell width
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

export default function FeedbackForm({ code, onSubmit, className }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<FormState>({ code, revisit: '' })
  const [step, setStep] = useState(1)

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setData((d) => ({ ...d, [key]: val }))

  const pages: Page[] = [
    { key: 'revisit',      type: 'yesno',  title: 'Question 1',  desc: 'Was your order accurate?', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sm:col-start-2">
          <EmojiTile
            selected={data.revisit === 'yes'}
            emoji="👍"
            caption="Yes"
            onClick={() => setField('revisit', 'yes')}
          />
        </div>
        <div className="sm:col-start-3">
          <EmojiTile
            selected={data.revisit === 'no'}
            emoji="👎"
            caption="No"
            onClick={() => setField('revisit', 'no')}
          />
        </div>
      </div> },
    { key: 'overall',      type: 'likert', title: 'Question 2',  desc: 'Based on your visit, how was your overall satisfaction?', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.overall === o.value} onClick={() => setField('overall', o.value)} />
        ))}
      </div> },
    { key: 'speed',        type: 'likert', title: 'Question 3',  desc: 'How satisfied were you with the speed of service?', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.speed === o.value} onClick={() => setField('speed', o.value)} />
        ))}
      </div> },
    { key: 'friendliness', type: 'likert', title: 'Question 4',  desc: "How satisfied were you with the staff's friendliness?", render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.friendliness === o.value} onClick={() => setField('friendliness', o.value)} />
        ))}
      </div> },
    { key: 'quality',      type: 'likert', title: 'Question 5',  desc: 'Rate the quality of food and drinks.', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.quality === o.value} onClick={() => setField('quality', o.value)} />
        ))}
      </div> },
    { key: 'taste',        type: 'likert', title: 'Question 6',  desc: 'Rate the taste and aroma of your order.', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.taste === o.value} onClick={() => setField('taste', o.value)} />
        ))}
      </div> },
    { key: 'ambience',     type: 'likert', title: 'Question 7',  desc: 'Rate the ambience of the shop.', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.ambience === o.value} onClick={() => setField('ambience', o.value)} />
        ))}
      </div> },
    { key: 'cleanliness',  type: 'likert', title: 'Question 8',  desc: 'Rate the cleanliness of the shop.', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {EMOJI_SCALE.map(o => (
          <EmojiTile key={o.value} emoji={o.emoji} caption={o.caption}
            selected={data.cleanliness === o.value} onClick={() => setField('cleanliness', o.value)} />
        ))}
      </div> },

    // YES/NO laid out in the middle two columns on sm+ → same tile width as Likert
    { key: 'revisit',      type: 'yesno',  title: 'Question 9',  desc: 'Based on your experience, would you visit us again?', render:
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sm:col-start-2">
          <EmojiTile
            selected={data.revisit === 'yes'}
            emoji="👍"
            caption="Yes"
            onClick={() => setField('revisit', 'yes')}
          />
        </div>
        <div className="sm:col-start-3">
          <EmojiTile
            selected={data.revisit === 'no'}
            emoji="👎"
            caption="No"
            onClick={() => setField('revisit', 'no')}
          />
        </div>
      </div> },

    { key: 'comments', type: 'free', title: 'Question 10', desc: 'Any additional comments or suggestions?', render:
      <>
        <Label htmlFor="comments" className="sr-only">Comments</Label>
        <Textarea
          id="comments"
          placeholder="Type your comments here…"
          rows={5}
          className="h-40 max-h-40 w-full resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words break-all"
          style={{ overflowWrap: 'anywhere' }}
          onChange={(e) => setField('comments', e.target.value)}
        />
      </>
    },

    { key: 'review',       type: 'review', title: 'Review & Submit', desc: 'Press Continue to submit your feedback.', render:
      <div className="text-sm text-muted-foreground">You can go back to change any answer before submitting.</div> },
  ]

  const total = pages.length
  const current = pages[step - 1] as Page

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
      setData({ code: data.code, revisit: '' })
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
      className={cn(' mx-auto grid max-w-3xl', className)}
    >
      <ProgressHeader current={step} total={total} />

      <input type="hidden" name="code" value={data.code} />

      {/* Question card — consistent height for all pages */}
      <Card className="w-full mx-auto mt-24 mb-10 border-muted shadow-2xl">
        <div className="flex flex-col min-h-[250px]">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-secondary-foreground text-base">{current.title}</CardTitle>
            <CardDescription className="text-foreground text-[1.25rem]">{current.desc}</CardDescription>
          </CardHeader>
          <CardContent className="mt-6 space-y-3">
            {current.render}
          </CardContent>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-32 py-3 px-6 backdrop-blur supports-[backdrop-filter]:bg-sidebar">
        <div className="mx-auto flex max-w-4xl justify-between px-8">
        <Button
          type="button"
          onClick={onPrevious}
          disabled={step === 1}
          className="btn-halo"
        >
          Previous
        </Button>

        <Button
          type="submit"
          disabled={submitting || !data.code}
          className="btn-halo btn-halo--emph"
        >
          {step === total ? (submitting ? 'Submitting…' : 'Continue') : 'Continue'}
        </Button>
        </div>
      </div>
    </form>
  )
}
