// src/components/admin/dashboard/cumulative-usage.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
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

/* ---------- API types ---------- */
type ApiPoint = {
  dayIndex: number;      // 0..7
  label: string;         // "Day 0"..."Day 7"
  dailyCount: number;
  runningCount: number;
  dailyPct: number;      // 0..100
  runningPct: number;    // 0..100
};
type ApiResponse = {
  window: { from: string; to: string };
  denom: { issued: number; used: number };
  series: ApiPoint[];
  note: { tz: string; bucket: string; logic: string };
};

/* ---------- Helpers ---------- */
function getInitialRange(): { from: string; to: string } {
  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && to) return { from, to };

  try {
    const saved = localStorage.getItem("dashboard:filters");
    if (saved) {
      const j = JSON.parse(saved) as { from?: string; to?: string };
      if (j.from && j.to) return { from: j.from, to: j.to };
    }
  } catch {}

  // fallback: PH last 30 days
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ---------- Tooltip ---------- */
function CumulativeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { label: string; runningPct: number; dailyPct: number; runningCount: number; dailyCount: number };

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow px-3 py-2 text-sm">
      <div className="font-medium">{p.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">Day 0 = same-day use; Day 7 = expiry day.</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} />
          <span><strong>{p.runningPct.toFixed(1)}%</strong> running</span>
        </div>
        <div className="text-right">{p.runningCount} used</div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-3)" }} />
          <span><strong>{p.dailyPct.toFixed(1)}%</strong> added</span>
        </div>
        <div className="text-right">+{p.dailyCount}</div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function CumulativeUsage() {
  const [range, setRange] = React.useState(getInitialRange);
  const [series, setSeries] = React.useState<ApiPoint[] | null>(null);
  const [denom, setDenom] = React.useState<{ issued: number; used: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/statistics/cumulative-usage?from=${f.from}&to=${f.to}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setSeries(json.series);
      setDenom(json.denom);
    } catch {
      setSeries([]);
      setDenom({ issued: 0, used: 0 });
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  React.useEffect(() => {
    fetchData(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subscribe to GlobalQuickFilter
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent<{ from: string; to: string }>).detail;
      if (!detail) return;
      setRange(detail);
      fetchData(detail);
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, []);

  const footer = `${range.from} → ${range.to}`;
  const data = (series ?? []).map((p) => ({
    name: p.label,
    runningPct: p.runningPct,
    dailyPct: p.dailyPct,
    runningCount: p.runningCount,
    dailyCount: p.dailyCount,
  }));

  const empty = !loading && ((series?.length ?? 0) === 0 || (denom?.issued ?? 0) === 0);

  return (
    <Card className="md:col-span-3 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cumulative Usage (7 Days)</CardTitle>
          <CardDescription>Running share of receipts used by day 0–7</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              aria-label="Cumulative Usage (7 Days): running percent of receipts used by day 0–7"
              margin={{ top: 10, right: 24, bottom: 8, left: 12 }}
            >
              <CartesianGrid stroke="var(--chart-cartesian)" />
              <XAxis
                dataKey="name"
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
              <RechartsTooltip content={<CumulativeTooltip />} wrapperStyle={{ outline: "none" }} />
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={100}
                stroke="var(--border)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: "100%", position: "right", fill: "currentColor", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="runningPct"
                name="Running %"
                stroke="var(--chart-1)"
                strokeWidth={3}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
              {/* Optional: show daily increment as a thin line; comment out if you want only one series */}
              {/* <Line type="monotone" dataKey="dailyPct" name="Added % (day)" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} /> */}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
