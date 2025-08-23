"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive area chart"

const chartData = [
  { date: "2024-04-01", before: 222, current: 150 },
  { date: "2024-04-02", before: 97, current: 180 },
  { date: "2024-04-03", before: 167, current: 120 },
  { date: "2024-04-04", before: 242, current: 260 },
  { date: "2024-04-05", before: 373, current: 290 },
  { date: "2024-04-06", before: 301, current: 340 },
  { date: "2024-04-07", before: 245, current: 180 },
  { date: "2024-04-08", before: 409, current: 320 },
  { date: "2024-04-09", before: 59, current: 110 },
  { date: "2024-04-10", before: 261, current: 190 },
  { date: "2024-04-11", before: 327, current: 350 },
  { date: "2024-04-12", before: 292, current: 210 },
  { date: "2024-04-13", before: 342, current: 380 },
  { date: "2024-04-14", before: 137, current: 220 },
  { date: "2024-04-15", before: 120, current: 170 },
  { date: "2024-04-16", before: 138, current: 190 },
  { date: "2024-04-17", before: 446, current: 360 },
  { date: "2024-04-18", before: 364, current: 410 },
  { date: "2024-04-19", before: 243, current: 180 },
  { date: "2024-04-20", before: 89, current: 150 },
  { date: "2024-04-21", before: 137, current: 200 },
  { date: "2024-04-22", before: 224, current: 170 },
  { date: "2024-04-23", before: 138, current: 230 },
  { date: "2024-04-24", before: 387, current: 290 },
  { date: "2024-04-25", before: 215, current: 250 },
  { date: "2024-04-26", before: 75, current: 130 },
  { date: "2024-04-27", before: 383, current: 420 },
  { date: "2024-04-28", before: 122, current: 180 },
  { date: "2024-04-29", before: 315, current: 240 },
  { date: "2024-04-30", before: 454, current: 380 },
  { date: "2024-05-01", before: 165, current: 220 },
  { date: "2024-05-02", before: 293, current: 310 },
  { date: "2024-05-03", before: 247, current: 190 },
  { date: "2024-05-04", before: 385, current: 420 },
  { date: "2024-05-05", before: 481, current: 390 },
  { date: "2024-05-06", before: 498, current: 520 },
  { date: "2024-05-07", before: 388, current: 300 },
  { date: "2024-05-08", before: 149, current: 210 },
  { date: "2024-05-09", before: 227, current: 180 },
  { date: "2024-05-10", before: 293, current: 330 },
  { date: "2024-05-11", before: 335, current: 270 },
  { date: "2024-05-12", before: 197, current: 240 },
  { date: "2024-05-13", before: 197, current: 160 },
  { date: "2024-05-14", before: 448, current: 490 },
  { date: "2024-05-15", before: 473, current: 380 },
  { date: "2024-05-16", before: 338, current: 400 },
  { date: "2024-05-17", before: 499, current: 420 },
  { date: "2024-05-18", before: 315, current: 350 },
  { date: "2024-05-19", before: 235, current: 180 },
  { date: "2024-05-20", before: 177, current: 230 },
  { date: "2024-05-21", before: 82, current: 140 },
  { date: "2024-05-22", before: 81, current: 120 },
  { date: "2024-05-23", before: 252, current: 290 },
  { date: "2024-05-24", before: 294, current: 220 },
  { date: "2024-05-25", before: 201, current: 250 },
  { date: "2024-05-26", before: 213, current: 170 },
  { date: "2024-05-27", before: 420, current: 460 },
  { date: "2024-05-28", before: 233, current: 190 },
  { date: "2024-05-29", before: 78, current: 130 },
  { date: "2024-05-30", before: 340, current: 280 },
  { date: "2024-05-31", before: 178, current: 230 },
  { date: "2024-06-01", before: 178, current: 200 },
  { date: "2024-06-02", before: 470, current: 410 },
  { date: "2024-06-03", before: 103, current: 160 },
  { date: "2024-06-04", before: 439, current: 380 },
  { date: "2024-06-05", before: 88, current: 140 },
  { date: "2024-06-06", before: 294, current: 250 },
  { date: "2024-06-07", before: 323, current: 370 },
  { date: "2024-06-08", before: 385, current: 320 },
  { date: "2024-06-09", before: 438, current: 480 },
  { date: "2024-06-10", before: 155, current: 200 },
  { date: "2024-06-11", before: 92, current: 150 },
  { date: "2024-06-12", before: 492, current: 420 },
  { date: "2024-06-13", before: 81, current: 130 },
  { date: "2024-06-14", before: 426, current: 380 },
  { date: "2024-06-15", before: 307, current: 350 },
  { date: "2024-06-16", before: 371, current: 310 },
  { date: "2024-06-17", before: 475, current: 520 },
  { date: "2024-06-18", before: 107, current: 170 },
  { date: "2024-06-19", before: 341, current: 290 },
  { date: "2024-06-20", before: 408, current: 450 },
  { date: "2024-06-21", before: 169, current: 210 },
  { date: "2024-06-22", before: 317, current: 270 },
  { date: "2024-06-23", before: 480, current: 530 },
  { date: "2024-06-24", before: 132, current: 180 },
  { date: "2024-06-25", before: 141, current: 190 },
  { date: "2024-06-26", before: 434, current: 380 },
  { date: "2024-06-27", before: 448, current: 490 },
  { date: "2024-06-28", before: 149, current: 200 },
  { date: "2024-06-29", before: 103, current: 160 },
  { date: "2024-06-30", before: 446, current: 400 },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  before: {
    label: "before",
    color: "var(--primary)",
  },
  current: {
    label: "current",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const iscurrent = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (iscurrent) {
      setTimeRange("7d")
    }
  }, [iscurrent])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Resignees per Month</CardTitle>
        {/* <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription> */}
        <CardAction>
          {/* <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup> */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillbefore" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-before)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-before)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillcurrent" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-current)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-current)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="current"
              type="natural"
              fill="url(#fillcurrent)"
              stroke="var(--color-current)"
              stackId="a"
            />
            <Area
              dataKey="before"
              type="natural"
              fill="url(#fillbefore)"
              stroke="var(--color-before)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
