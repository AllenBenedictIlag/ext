// src/components/admin/dashboard/composite-satisfaction-trend.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

/* ---------- Types ---------- */
type Point = {
  name: string;      // e.g., "Apr", "May"
  composite: number; // 1..4 average of core Likert items
  idx: number;
};

/* ---------- Sample data ---------- */
const SAMPLE: Point[] = [
  { name: "Apr", composite: 3.05, idx: 0 },
  { name: "May", composite: 3.18, idx: 1 },
  { name: "Jun", composite: 3.12, idx: 2 },
  { name: "Jul", composite: 3.26, idx: 3 },
  { name: "Aug", composite: 3.31, idx: 4 },
  { name: "Sep", composite: 3.42, idx: 5 },
];

/* ---------- Tooltip ---------- */
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const curr = payload[0]?.payload as Point;
  const prev = SAMPLE[Math.max(0, curr.idx - 1)];
  const delta = curr.idx === 0 ? 0 : curr.composite - prev.composite;

  return (
    <div className="rounded-md border bg-popover p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Composite</span>
        <span className="font-semibold">{curr.composite.toFixed(2)}</span>
      </div>
      {curr.idx > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">MoM</span>
          <span
            className={
              delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : ""
            }
          >
            {delta > 0 ? "+" : delta < 0 ? "−" : ""}
            {Math.abs(delta).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Component ---------- */
export default function CompositeSatisfactionTrend() {
  const data = SAMPLE;

  return (
    <Card className="md:col-span-8 h-90 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Composite Satisfaction (1–4)</CardTitle>
          <CardDescription>Average of core Likert items over time</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            aria-label="Composite Satisfaction trend on a 1–4 scale"
            margin={{ top: 8, right: 24, bottom: 6, left: 10 }}
          >
            {/* use your tokens directly, no hsl() wrapper */}
            <CartesianGrid stroke="var(--muted)" />
            <XAxis dataKey="name" tickMargin={6} tick={{ fontSize: 12 }} height={28} />
            <YAxis
              domain={[1, 4]}
              ticks={[1, 2, 3, 4]}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => v.toFixed(0)}
            />
            <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />

            {/* Reference bands */}
            <ReferenceLine y={3} stroke="var(--chart-2)" strokeDasharray="4 4" />
            <ReferenceLine y={2} stroke="var(--muted-foreground)" strokeDasharray="3 6" />

            <Line
              type="monotone"
              dataKey="composite"
              name="Composite"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3, stroke: "var(--chart-1)", fill: "var(--chart-1)" }}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>Time Span</p>
      </CardFooter>
    </Card>
  );
}
