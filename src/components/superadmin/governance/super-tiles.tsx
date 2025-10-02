import Link from "next/link"
import {
  IconTrendingUp,
  IconTrendingDown,
  IconShieldCheck,
  IconListCheck,
  IconAdjustmentsAlt,
  IconChartHistogram,
  IconActivity,
  IconFileTime,
  IconUserCog,
  IconDownload,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Super Dashboard Tiles (Governance)
 * Pure UI only — no API calls. Replace hardcoded values when wiring.
 *
 * Tiles:
 * 1) Required Coverage (% fully-answered required questions) — shows delta vs previous window
 * 2) Completion Issues (questions below threshold)
 * 3) Option Balance Skews (questions with option share out-of-bounds)
 * 4) Answer Density Outliers (submissions with abnormal answer counts)
 * 5) Anomalies (metrics with |Δpp| beyond threshold & sufficient N)
 * 6) Pending Reviews (surveys in PENDING_REVIEW)
 * 7) User Changes (invites pending / role changes in last 7d)
 * 8) Exports (count in window + last export time)
 */

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* 1) Required Coverage */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconShieldCheck className="size-4" />
            Required Coverage
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            97.2%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1 tabular-nums">
              <IconTrendingUp className="size-4" />
              +0.8&nbsp;pp
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            % of submissions with all required questions answered
          </div>
          <div className="text-muted-foreground">
            Compared to previous window of equal length
          </div>
          <Link
            href="/super/health#required-coverage"
            className="text-primary underline-offset-4 hover:underline"
          >
            View details
          </Link>
        </CardFooter>
      </Card>

      {/* 2) Completion Issues */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconListCheck className="size-4" />
            Completion Issues
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            2
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              Below 95%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Questions with low required completion
          </div>
          <div className="text-muted-foreground">Investigate form logic</div>
          <Link
            href="/super/health#completion-matrix"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open completion matrix
          </Link>
        </CardFooter>
      </Card>

      {/* 3) Option Balance Skews */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconAdjustmentsAlt className="size-4" />
            Option Balance Skews
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              &gt;90% / &lt;2% share
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Check for leading wording or broken options
          </div>
          <div className="text-muted-foreground">Distribution by question</div>
          <Link
            href="/super/health#option-balance"
            className="text-primary underline-offset-4 hover:underline"
          >
            Review option balance
          </Link>
        </CardFooter>
      </Card>

      {/* 4) Answer Density Outliers */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconChartHistogram className="size-4" />
            Answer Density Outliers
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            4
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              Outside expected band
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Submissions with too few / too many answers
          </div>
          <div className="text-muted-foreground">Possible bot or UX issue</div>
          <Link
            href="/super/health#answer-density"
            className="text-primary underline-offset-4 hover:underline"
          >
            Inspect outliers
          </Link>
        </CardFooter>
      </Card>

      {/* 5) Anomalies */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconActivity className="size-4" />
            Anomalies
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            3
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              |Δ| ≥ 10&nbsp;pp
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Metrics with significant change this window
          </div>
          <div className="text-muted-foreground">Net / Positive% moves</div>
          <Link
            href="/super/health#anomalies"
            className="text-primary underline-offset-4 hover:underline"
          >
            Go to anomalies
          </Link>
        </CardFooter>
      </Card>

      {/* 6) Pending Reviews */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconFileTime className="size-4" />
            Pending Reviews
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            1
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              Needs action
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Surveys awaiting Super Admin review
          </div>
          <div className="text-muted-foreground">Approve / schedule</div>
          <Link
            href="/super/reviews"
            className="text-primary underline-offset-4 hover:underline"
          >
            Review queue
          </Link>
        </CardFooter>
      </Card>

      {/* 7) User Changes */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconUserCog className="size-4" />
            User Changes (7d)
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            3
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              2 invites • 1 role
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Governance activity in the last 7 days
          </div>
          <div className="text-muted-foreground">Audit & access hygiene</div>
          <Link
            href="/super/users#changes"
            className="text-primary underline-offset-4 hover:underline"
          >
            See user changes
          </Link>
        </CardFooter>
      </Card>

      {/* 8) Exports */}
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <IconDownload className="size-4" />
            Exports
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            5
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1 tabular-nums">
              Last: Sep&nbsp;27,&nbsp;2025&nbsp;14:03
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Exports created in this window
          </div>
          <div className="text-muted-foreground">CSV / JSON / XLSX</div>
          <Link
            href="/super/exports"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open export history
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
