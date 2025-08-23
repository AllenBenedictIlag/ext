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
  { date: "2024-04-01", before: 31, current: 32 },
  { date: "2024-04-02", before: 34, current: 35 },
  { date: "2024-04-03", before: 37, current: 37 },
  { date: "2024-04-04", before: 39, current: 40 },
  { date: "2024-04-05", before: 44, current: 43 },
  { date: "2024-04-06", before: 49, current: 49 },
  { date: "2024-04-07", before: 49, current: 51 },
  { date: "2024-04-08", before: 53, current: 53 },
  { date: "2024-04-09", before: 49, current: 51 },
  { date: "2024-04-10", before: 52, current: 53 },
  { date: "2024-04-11", before: 52, current: 55 },
  { date: "2024-04-12", before: 55, current: 53 },
  { date: "2024-04-13", before: 55, current: 52 },
  { date: "2024-04-14", before: 54, current: 53 },
  { date: "2024-04-15", before: 56, current: 57 },
  { date: "2024-04-16", before: 61, current: 59 },
  { date: "2024-04-17", before: 66, current: 63 },
  { date: "2024-04-18", before: 64, current: 63 },
  { date: "2024-04-19", before: 67, current: 69 },
  { date: "2024-04-20", before: 68, current: 67 },
  { date: "2024-04-21", before: 71, current: 71 },
  { date: "2024-04-22", before: 73, current: 75 },
  { date: "2024-04-23", before: 76, current: 76 },
  { date: "2024-04-24", before: 79, current: 82 },
  { date: "2024-04-25", before: 83, current: 85 },
  { date: "2024-04-26", before: 87, current: 85 },
  { date: "2024-04-27", before: 85, current: 86 },
  { date: "2024-04-28", before: 88, current: 92 },
  { date: "2024-04-29", before: 91, current: 94 },
  { date: "2024-04-30", before: 89, current: 90 },
  { date: "2024-05-01", before: 95, current: 96 },
  { date: "2024-05-02", before: 95, current: 96 },
  { date: "2024-05-03", before: 99, current: 98 },
  { date: "2024-05-04", before: 102, current: 101 },
  { date: "2024-05-05", before: 103, current: 103 },
  { date: "2024-05-06", before: 101, current: 103 },
  { date: "2024-05-07", before: 105, current: 105 },
  { date: "2024-05-08", before: 112, current: 109 },
  { date: "2024-05-09", before: 113, current: 112 },
  { date: "2024-05-10", before: 116, current: 113 },
  { date: "2024-05-11", before: 112, current: 113 },
  { date: "2024-05-12", before: 112, current: 115 },
  { date: "2024-05-13", before: 114, current: 114 },
  { date: "2024-05-14", before: 116, current: 119 },
  { date: "2024-05-15", before: 119, current: 120 },
  { date: "2024-05-16", before: 126, current: 125 },
  { date: "2024-05-17", before: 125, current: 124 },
  { date: "2024-05-18", before: 132, current: 132 },
  { date: "2024-05-19", before: 136, current: 136 },
  { date: "2024-05-20", before: 138, current: 134 },
  { date: "2024-05-21", before: 141, current: 143 },
  { date: "2024-05-22", before: 145, current: 143 },
  { date: "2024-05-23", before: 147, current: 146 },
  { date: "2024-05-24", before: 149, current: 151 },
  { date: "2024-05-25", before: 153, current: 150 },
  { date: "2024-05-26", before: 156, current: 154 },
  { date: "2024-05-27", before: 155, current: 155 },
  { date: "2024-05-28", before: 159, current: 162 },
  { date: "2024-05-29", before: 167, current: 165 },
  { date: "2024-05-30", before: 168, current: 167 },
  { date: "2024-05-31", before: 169, current: 168 },
  { date: "2024-06-01", before: 168, current: 171 },
  { date: "2024-06-02", before: 174, current: 174 },
  { date: "2024-06-03", before: 175, current: 175 },
  { date: "2024-06-04", before: 175, current: 176 },
  { date: "2024-06-05", before: 181, current: 182 },
  { date: "2024-06-06", before: 182, current: 183 },
  { date: "2024-06-07", before: 183, current: 181 },
  { date: "2024-06-08", before: 181, current: 183 },
  { date: "2024-06-09", before: 185, current: 185 },
  { date: "2024-06-10", before: 189, current: 189 },
  { date: "2024-06-11", before: 191, current: 190 },
  { date: "2024-06-12", before: 193, current: 190 },
  { date: "2024-06-13", before: 196, current: 193 },
  { date: "2024-06-14", before: 195, current: 194 },
  { date: "2024-06-15", before: 198, current: 200 },
  { date: "2024-06-16", before: 202, current: 204 },
  { date: "2024-06-17", before: 203, current: 203 },
  { date: "2024-06-18", before: 210, current: 209 },
  { date: "2024-06-19", before: 214, current: 214 },
  { date: "2024-06-20", before: 218, current: 218 },
  { date: "2024-06-21", before: 219, current: 220 },
  { date: "2024-06-22", before: 226, current: 224 },
  { date: "2024-06-23", before: 231, current: 229 },
  { date: "2024-06-24", before: 229, current: 230 },
  { date: "2024-06-25", before: 235, current: 238 },
  { date: "2024-06-26", before: 241, current: 238 },
  { date: "2024-06-27", before: 242, current: 239 },
  { date: "2024-06-28", before: 246, current: 244 },
  { date: "2024-06-29", before: 248, current: 247 },
  { date: "2024-06-30", before: 247, current: 247 }
];


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
    let daysToSubtract = 90 //90 default
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
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
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
              stroke="var(--color-chart3)"
              // stackId="a"
            />
            <Area
              dataKey="before"
              type="natural"
              fill="url(#fillbefore)"
              stroke="var(--color-orange-chart3)"
              // stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
