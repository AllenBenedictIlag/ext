// src/components/admin/dashboard/trend-card.tsx
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
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Area,
  Bar,
  Line,
  ComposedChart,
  Tooltip as RechartsTooltip,
  TooltipProps,
} from "recharts";

/* ---------- Colors ---------- */
const COLOR_RECEIPTS = "#F59E0B";   // Bars
const COLOR_SUBMITS  = "#D97706";   // Line
const COLOR_PERCENT  = "#7C2D12";   // Area

/* ---------- Utils ---------- */
const fmtNum = (n: number) => n.toLocaleString("en-US");
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/* ---------- Custom Tooltip (smaller text) ---------- */
function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const receipts    = Number(payload.find((p) => p.dataKey === "receipts")?.value ?? 0);
  const submissions = Number(payload.find((p) => p.dataKey === "submissions")?.value ?? 0);
  const responsePct = Number(payload.find((p) => p.dataKey === "responsePct")?.value ?? 0);

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-2.5 py-1.5 text-xs">
      <div className="font-medium mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: COLOR_RECEIPTS }} />
        <span className="text-muted-foreground">Receipts:</span>
        <span className="ml-auto tabular-nums">{fmtNum(receipts)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: COLOR_SUBMITS }} />
        <span className="text-muted-foreground">Submissions:</span>
        <span className="ml-auto tabular-nums">{fmtNum(submissions)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: COLOR_PERCENT }} />
        <span className="text-muted-foreground">Response %:</span>
        <span className="ml-auto tabular-nums">{fmtPct(responsePct)}</span>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function TrendCard() {
  // Sample months to match your mock; Feb ’25 explicitly 3000 / 270 → 9.0%
  const base = [
    { name: "Jan '25", receipts: 2400, submissions: 210 },
    { name: "Feb '25", receipts: 3000, submissions: 270 },
    { name: "Mar '25", receipts: 2000, submissions: 160 },
    { name: "Apr '25", receipts: 2200, submissions: 180 },
    { name: "May '25", receipts: 2600, submissions: 220 },
    { name: "Jun '25", receipts: 2700, submissions: 230 },
    { name: "Jul '25", receipts: 2800, submissions: 240 },
    { name: "Aug '25", receipts: 2700, submissions: 235 },
  ];

  const data = base.map((m) => ({
    ...m,
    responsePct: m.receipts ? (m.submissions / m.receipts) * 100 : 0,
  }));

  return (
    <Card className="md:col-span-3 h-160 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Monthly Trend</CardTitle>
          <CardDescription className="text-xs">Receipts • Submissions • Response %</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            aria-label="Monthly trend: Receipts (bar), Submissions (line), Response % (area)"
            margin={{ top: 8, right: 28, bottom: 6, left: 10 }}
          >
            <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
            <XAxis
              dataKey="name"
              tickMargin={6}
              tick={{ fontSize: 11 }}
              height={28}
            />
            {/* Left axis: counts */}
            <YAxis
              yAxisId="counts"
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmtNum(v as number)}
              width={40}
            />
            {/* Right axis: percent */}
            <YAxis
              yAxisId="percent"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />

            <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
              height={24}
            />

            {/* BAR = Receipts (left axis) */}
            <Bar
              yAxisId="counts"
              dataKey="receipts"
              name="Receipts"
              barSize={24}
              fill={COLOR_RECEIPTS}
              radius={[6, 6, 0, 0]}
            />

            {/* LINE = Submissions (left axis) */}
            <Line
              yAxisId="counts"
              type="monotone"
              dataKey="submissions"
              name="Submissions"
              stroke={COLOR_SUBMITS}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />

            {/* AREA = Response % (right axis) */}
            <Area
              yAxisId="percent"
              type="monotone"
              dataKey="responsePct"
              name="Response %"
              stroke={COLOR_PERCENT}
              fill={COLOR_PERCENT}
              fillOpacity={0.22}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-[11px] text-muted-foreground">
        Response % = submissions ÷ receipts
      </CardFooter>
    </Card>
  );
}
