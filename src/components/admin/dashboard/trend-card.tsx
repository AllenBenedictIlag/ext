// src/components/admin/dashboard/trend-card.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
const COLOR_RECEIPTS = "var(--chart-1)"; // Bars
const COLOR_SUBMITS = "var(--chart-3)";  // Line
const COLOR_PERCENT = "var(--chart-5)";  // Area

/* ---------- Types ---------- */
type TrendPoint = {
  name: string;
  // raw values for tooltip
  receipts: number;
  submissions: number;
  responsePct: number;    // already 0..100
  // scaled values for plotting (0..100 vs anchorMax)
  receiptsPct: number;
  submissionsPct: number;
};

type ApiTrend = {
  window: { from: string; to: string };
  anchorMax: number;
  yTicks: number[]; // [0,25,50,75,100]
  months: (TrendPoint & { y: number; m: number; from: string; to: string })[];
};

/* ---------- Utils ---------- */
const fmtNum = (n: number) => n.toLocaleString("en-US");
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/* ---------- Custom Tooltip (uses RAW counts) ---------- */
function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const datum: any = payload[0]?.payload ?? {};
  const receipts = Number(datum.receipts ?? 0);
  const submissions = Number(datum.submissions ?? 0);
  const responsePct = Number(datum.responsePct ?? 0);

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-2.5 py-1.5 text-xs">
      <div className="font-medium mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ backgroundColor: COLOR_RECEIPTS }}
        />
        <span className="text-muted-foreground">Receipts:</span>
        <span className="ml-auto tabular-nums">{fmtNum(receipts)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ backgroundColor: COLOR_SUBMITS }}
        />
        <span className="text-muted-foreground">Submissions:</span>
        <span className="ml-auto tabular-nums">{fmtNum(submissions)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span
          className="inline-block size-2.5 rounded-sm"
          style={{ backgroundColor: COLOR_PERCENT }}
        />
        <span className="text-muted-foreground">Response %:</span>
        <span className="ml-auto tabular-nums">{fmtPct(responsePct)}</span>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function TrendCard() {
  const [data, setData] = React.useState<TrendPoint[]>([]);
  const [period, setPeriod] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [anchorMax, setAnchorMax] = React.useState<number>(1); // for left raw-axis labels

  // This card ignores GlobalQuickFilter — fetch fixed last-10-months window
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard/trend", { cache: "no-store" });
        const json: ApiTrend = await res.json();
        setData(json.months ?? []);
        setPeriod(`${json.window.from} → ${json.window.to}`);
        setAnchorMax(Math.max(1, Number(json.anchorMax || 1)));
      } catch {
        setData([]);
        setAnchorMax(1);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="md:col-span-5 h-90 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Receipts • Submissions • Response % •</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            aria-label="Monthly trend (scaled to 0–100%): Receipts (bar), Submissions (line), Response % (area)"
            margin={{ top: 8, right: 36, bottom: 0, left: 16 }}
          >
            <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
            <XAxis dataKey="name" tickMargin={6} tick={{ fontSize: 12 }} height={28} />

            {/* LEFT axis = RAW counts, labels mirror 0..100 ticks using anchorMax */}
            <YAxis
              yAxisId="raw"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11 }}
              width={48}
              tickFormatter={(v) =>
                fmtNum(Math.round((Number(v) / 100) * (anchorMax || 1)))
              }
            />

            {/* RIGHT axis = PERCENT scale for the series */}
            <YAxis
              yAxisId="percent"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => `${v}%`}
            />

            <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />
            <Legend wrapperStyle={{ fontSize: 16 }} iconSize={10} height={12} />

            {/* BAR = Receipts (scaled) */}
            <Bar
              yAxisId="percent"
              dataKey="receiptsPct"
              name="Receipts"
              barSize={24}
              fill={COLOR_RECEIPTS}
              radius={[6, 6, 0, 0]}
              isAnimationActive={!loading}
            />

            {/* LINE = Submissions (scaled) */}
            <Line
              yAxisId="percent"
              type="monotone"
              dataKey="submissionsPct"
              name="Submissions"
              stroke={COLOR_SUBMITS}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={!loading}
            />

            {/* AREA = Response % (already 0..100) */}
            <Area
              yAxisId="percent"
              type="monotone"
              dataKey="responsePct"
              name="Response %"
              stroke={COLOR_PERCENT}
              fill={COLOR_PERCENT}
              fillOpacity={0.22}
              isAnimationActive={!loading}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
