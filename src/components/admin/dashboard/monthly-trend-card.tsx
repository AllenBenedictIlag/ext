// src/components/admin/dashboard/monthly-trend-card.tsx
"use client";

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
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

/* ---------- Types ---------- */
type MonthlyPoint = {
  month: string;        // e.g., "Jan '25"
  receipts: number;     // volume
  submissions: number;  // volume
  responseRate: number; // 0..1
};

/* ---------- Sample data (swap with API) ---------- */
const data: MonthlyPoint[] = [
  { month: "Jan '25", receipts: 2800, submissions: 230, responseRate: 230 / 2800 },
  { month: "Feb '25", receipts: 3000, submissions: 270, responseRate: 270 / 3000 },
  { month: "Mar '25", receipts: 3150, submissions: 295, responseRate: 295 / 3150 },
  { month: "Apr '25", receipts: 2900, submissions: 260, responseRate: 260 / 2900 },
  { month: "May '25", receipts: 3400, submissions: 340, responseRate: 340 / 3400 },
  { month: "Jun '25", receipts: 3600, submissions: 420, responseRate: 420 / 3600 },
  { month: "Jul '25", receipts: 3700, submissions: 455, responseRate: 455 / 3700 },
  { month: "Aug '25", receipts: 3550, submissions: 430, responseRate: 430 / 3550 },
];

/* ---------- Colors (CSS var fallbacks) ---------- */
const COLORS = {
  receipts: "var(--chart-1, hsl(25 95% 53% / 0.55))",
  submissions: "var(--chart-2, hsl(217 91% 60%))",
  responseRate: "var(--chart-3, hsl(142 71% 45%))",
  grid: "hsl(var(--muted) / 0.4)",
  cursor: "hsl(var(--muted) / 0.35)",
};

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload.reduce((acc: Record<string, any>, p: any) => {
    acc[p.dataKey] = p.value;
    return acc;
  }, {});

  const receipts = row["receipts"] ?? 0;
  const submissions = row["submissions"] ?? 0;
  const responseRate = row["responseRate"] ?? 0;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.receipts }} />
          <span>Receipts:</span>
          <span className="ml-auto tabular-nums">{receipts.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.submissions }} />
          <span>Submissions:</span>
          <span className="ml-auto tabular-nums">{submissions.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS.responseRate }} />
          <span>Response %:</span>
          <span className="ml-auto tabular-nums">{(responseRate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyTrendCard() {
  return (
    <Card className="md:col-span-3 h-120 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Receipts • Submissions • Response %</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)]">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              aria-label="Monthly trend: Receipts, Submissions, Response Rate"
              margin={{ top: 4, right: 24, bottom: 8, left: 12 }}
            >
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                minTickGap={16}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
                domain={[0, 1]}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12 }}
              />
              <RechartsTooltip
                content={<TooltipContent />}
                cursor={{ fill: COLORS.cursor }}
                wrapperStyle={{ outline: "none" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Bar
                name="Receipts"
                dataKey="receipts"
                yAxisId="left"
                fill={COLORS.receipts}
                radius={[6, 6, 0, 0]}
                barSize={22}
              />
              <Line
                name="Submissions"
                type="monotone"
                dataKey="submissions"
                yAxisId="left"
                stroke={COLORS.submissions}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                name="Response %"
                type="monotone"
                dataKey="responseRate"
                yAxisId="right"
                stroke={COLORS.responseRate}
                strokeWidth={2.25}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        Response % = submissions ÷ receipts
      </CardFooter>
    </Card>
  );
}
