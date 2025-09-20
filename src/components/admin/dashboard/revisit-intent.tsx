// src/components/admin/dashboard/revisit-intent.tsx
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
  Area,
  AreaChart,
} from "recharts";

/* ---------- Types ---------- */
type Point = { name: string; revisitYesPct: number };

/* ---------- Sample data (replace with API data later) ---------- */
const SAMPLE_LAST_6: Point[] = [
  { name: "Apr", revisitYesPct: 61 },
  { name: "May", revisitYesPct: 64 },
  { name: "Jun", revisitYesPct: 59 },
  { name: "Jul", revisitYesPct: 66 },
  { name: "Aug", revisitYesPct: 69 },
  { name: "Sep", revisitYesPct: 72 },
];

/* ---------- Tooltip ---------- */
function RevisitTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value as number;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        Revisit “Yes”: <span className="font-semibold">{v}%</span>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function RevisitIntent() {
  const [data] = React.useState<Point[]>(SAMPLE_LAST_6);

  return (
    <Card className="md:col-span-5 h-120 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Revisit Intent Over Time</CardTitle>
          <CardDescription>% of “Yes” to revisit</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            aria-label="Revisit intent trend (percentage Yes over time)"
            margin={{ top: 12, right: 20, bottom: 8, left: 12 }}
          >
            {/* Gradient respects your theme colors */}
            <defs>
              <linearGradient id="revisitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.06} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
            <XAxis
              dataKey="name"
              tickMargin={6}
              tick={{ fontSize: 12 }}
              height={28}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => `${v}%`}
            />

            <RechartsTooltip content={<RevisitTooltip />} wrapperStyle={{ outline: "none" }} />

            <Area
              type="monotone"
              dataKey="revisitYesPct"
              name="Revisit Yes %"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#revisitFill)"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        Showing last 6 months (sample data)
      </CardFooter>
    </Card>
  );
}
