// src/components/admin/dashboard/cumulative-usage.tsx
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
  Tooltip as RechartsTooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
} from "recharts";

/* ---------- Types ---------- */
type Point = {
  day: number;            // 0..7
  label: string;          // "Day 0"..."Day 7"
  runningPct: number;     // 0..100 (cumulative)
  dailyPct: number;       // optional: day-over-day increment (for tooltip)
};

/* ---------- Sample data (Day 0..7) ---------- */
const SAMPLE: Point[] = [
  { day: 0, label: "Day 0", runningPct: 22, dailyPct: 22 },
  { day: 1, label: "Day 1", runningPct: 38, dailyPct: 16 },
  { day: 2, label: "Day 2", runningPct: 52, dailyPct: 14 },
  { day: 3, label: "Day 3", runningPct: 64, dailyPct: 12 },
  { day: 4, label: "Day 4", runningPct: 73, dailyPct: 9 },
  { day: 5, label: "Day 5", runningPct: 81, dailyPct: 8 },
  { day: 6, label: "Day 6", runningPct: 90, dailyPct: 9 },
  { day: 7, label: "Day 7", runningPct: 100, dailyPct: 10 }, // expiry day surge
];

/* ---------- Colors (theme aware) ---------- */
const COLOR_LINE = "var(--chart-1)";        // primary brand line
const COLOR_GRID = "var(--chart-2)";          // subtle grid (works in both themes)

/* ---------- Tooltip ---------- */
function CumulativeTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: any[];
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload as Point;

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow px-3 py-2 text-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: COLOR_LINE }}
        />
        <span className="tabular-nums">
          Running&nbsp;%:&nbsp;<strong>{p.runningPct}%</strong>
        </span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        Added today: {p.dailyPct}%
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Day 0 = same-day use; Day 7 = expiry day.
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function CumulativeUsage() {
  return (
    <Card className="md:col-span-4 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cumulative Usage (7 Days)</CardTitle>
          <CardDescription>Running share of receipts used by day 0–7</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="95%" height="100%">
          <LineChart
            data={SAMPLE}
            aria-label="Cumulative Usage (7 Days): running percent of receipts used by each day from 0 to 7"
            margin={{ top: 10, right: 24, bottom: 0, left: 12 }}
          >
            {/* Gridlines (theme-aware). Using a plain var color for broad renderer support */}
            <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" />

            <XAxis
              dataKey="label"
              tickMargin={6}
              height={28}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => `${v}%`}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />

            <RechartsTooltip
              content={<CumulativeTooltip />}
              wrapperStyle={{ outline: "none" }}
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            />

            <Legend
              verticalAlign="top"
              height={24}
              wrapperStyle={{ fontSize: 12 }}
            />

            {/* Reference line at 100% */}
            <ReferenceLine
              y={100}
              stroke="var(--border)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: "100%",
                position: "right",
                fill: "currentColor",
                fontSize: 11,
              }}
            />

            <Line
              type="monotone"
              dataKey="runningPct"
              name="Running %"
              stroke={COLOR_LINE}
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        Shows how quickly receipts are used: Day 0 (same-day) → Day 7 (expiry).
      </CardFooter>
    </Card>
  );
}
