// src/components/admin/dashboard/comment-volume.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

/* ---------- Types ---------- */
type ApiPoint = {
  day: string;          // YYYY-MM-DD
  axisLabel: string;    // may be "" if label skipped
  tooltipLabel: string; // "Sep 14, 2025"
  count: number;        // 0 allowed
};
type ApiResponse = {
  window: { from: string; to: string };
  cadence: { tickEveryDays: number; labelEveryDays: number };
  series: ApiPoint[];
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

  // PH last 30 days fallback
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ---------- Tooltip ---------- */
function VolumeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const curr = payload[0]?.payload as { name: string; count: number; tooltip: string };
  if (curr == null) return null;
  return (
    <div className="rounded-md border bg-popover p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{curr.tooltip}</div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Comments</span>
        <span className="font-semibold">{curr.count}</span>
      </div>
      <div className="text-muted-foreground mt-1">Free-text responses submitted on this date.</div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function CommentVolume() {
  const [range, setRange] = React.useState(getInitialRange);
  const [series, setSeries] = React.useState<ApiPoint[] | null>(null);
  const [cadence, setCadence] = React.useState<{ tickEveryDays: number; labelEveryDays: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/dashboard/comment-volume?from=${f.from}&to=${f.to}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setSeries(json.series);
      setCadence(json.cadence);
    } catch {
      setSeries([]);
      setCadence({ tickEveryDays: 1, labelEveryDays: 2 });
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  React.useEffect(() => {
    fetchData(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subscribe to GlobalQuickFilter event
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

  /* ---------- Prep data ---------- */
  const all = series ?? [];
  const ticks: string[] = React.useMemo(() => {
    if (!all.length) return [];
    const STEP = 4;     // show every 4th day
    const OFFSET = all.length > 2 ? 2 : 0; // start 2 days after the first day (e.g., Aug 23 -> Aug 25)
    const out: string[] = [];
    for (let i = OFFSET; i < all.length; i += STEP) out.push(all[i].day);

    // Always ensure the last day is visible as a tick
    const last = all[all.length - 1]?.day;
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
  }, [all]);

  const labelByDay = React.useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((p) => m.set(p.day, p.axisLabel));
    return m;
  }, [all]);

  // Line data (0s are meaningful—keep them)
  const data = all.map((p) => ({
    name: p.day,
    count: p.count,
    tooltip: p.tooltipLabel,
  }));

  const empty = !loading && (!all.length || data.every((d) => d.count === 0));

  return (
    <Card className="md:col-span-8 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl tracking-normal">Comment Volume</CardTitle>
          <CardDescription>Free-text answers over time</CardDescription>
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
              aria-label="Comment volume over time (daily counts)"
              margin={{ top: 8, right: 24, bottom: 0, left: 10 }}
            >
              <CartesianGrid
                stroke="var(--chart-2)"
                strokeOpacity={0.7}
                strokeDasharray="3 3"
                />
              <XAxis
                dataKey="name"
                ticks={ticks}
                tickMargin={6}
                tick={{ fontSize: 12 }}
                height={28}
                tickFormatter={(value: string) => labelByDay.get(value) ?? ""}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, "auto"]}
                tick={{ fontSize: 11 }}
                width={36}
              />
              <RechartsTooltip content={<VolumeTooltip />} wrapperStyle={{ outline: "none" }} />
              <Line
                type="monotone"
                dataKey="count"
                name="Comments"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3, stroke: "var(--chart-11)", fill: "var(--chart-11)" }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
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
