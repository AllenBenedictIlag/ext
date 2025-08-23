"use client"

import { TrendingUp } from "lucide-react"
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
  { month: "Engineering", before: 160, current: 80 },
  { month: "Marketing", before: 305, current: 200 },
  { month: "Sales", before: 237, current: 120 },
  { month: "Human Resources", before: 73, current: 190 },
  { month: "Operations", before: 209, current: 130 },
  { month: "Finance", before: 214, current: 140 },
  { month: "IT", before: 214, current: 30 },
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
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig

export function ChartBarLabelCustom() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Comparison — Exits by Department</CardTitle>
        <CardDescription>January - June 2024</CardDescription>
      </CardHeader>
      <CardContent className="relative flex-1 min-h-0 p-0">
      <div className="absolute inset-0">
        <ChartContainer config={chartConfig}>
          <BarChart className= "h-full w-full"
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              top: 0, right: 16, bottom: 0, left: 24
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="month"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
              hide
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="before"
              stackId="a"
              layout="vertical"
              fill="var(--color-before)"
              radius={[0, 0, 0, 0]}
              >
              <LabelList
                dataKey="current"
                position="insideLeft"
                offset={8}
                className="fill-(--color-label)"
                fontSize={12}
              />
            </Bar>


            <Bar
              dataKey="current"
              stackId="a"
              fill="var(--color-current)"
              radius={[0, 4, 4, 0]}
              >
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
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter>
    </Card>
  )
}
