"use client"
import "../styles/globals.css"
import { TrendingDown } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

export const description = "A bar chart with a custom label"

const chartData = [
  { month: "Engineering", current: 64, before: 160 },
  { month: "Marketing", current: 122, before: 305 },
  { month: "Sales", current: 94, before: 237 },
  { month: "Human Resources", current: 76, before: 190 },
  { month: "Operations", current: 83, before: 209 },
  { month: "Finance", current: 64, before: 214 },
  { month: "IT", current: 30, before: 214 },
]

const chartConfig = {
  before: {
    label: "Before",
    color: "var(--chart-1)",
  },
  current: {
    label: "Current",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

export function ChartBarLabelCustom() {
  return (
    <Card className="h-full flex flex-col ">
      <CardHeader>
        <CardTitle>Exits by Department</CardTitle>
        <CardDescription>Current FY vs Last FY</CardDescription>
      </CardHeader>

      <CardContent className="relative flex-1 min-h-0 p-0">
        <div className="absolute inset-0">
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 24 }}
              barCategoryGap="18%"
              barGap={0}
            >
              <CartesianGrid horizontal={false} />
              {/* overlapped Y axes just to line bars up */}
              <YAxis yAxisId="before" dataKey="month" type="category" hide />
              <YAxis yAxisId="current" dataKey="month" type="category" hide />
              <XAxis type="number" hide />

              {/* Theme-matching tooltip */}
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="bg-background text-foreground border-border"
                    labelClassName="text-muted-foreground"
                  />
                }
              />

              {/* TOP: Current */}
              <Bar
                yAxisId="current"
                dataKey="current"
                name="Current"
                fill="var(--chart-1)"
                barSize={35}
                radius={[0, 4, 4, 0]}
              >
                {/* Light: use background (white). Dark: flip to foreground (light). */}
                <LabelList
                  dataKey="current"
                  position="insideLeft"
                  offset={8}
                  className="fill-background dark:fill-foreground"
                  fontSize={12}
                />
              </Bar>

              {/* BACKGROUND: Before (wider) */}
              <Bar
                yAxisId="before"
                dataKey="before"
                name="Before"
                fill="var(--chart-5)"
                barSize={35}
                radius={[0, 4, 4, 0]}
                fillOpacity={0.35}
              >
                {/* Always readable on both themes */}
                <LabelList
                  dataKey="before"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Comparison per department from last FY <TrendingDown className="h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  )
}
