// src/components/admin/dashboard/composite-satisfaction.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine,
} from "recharts";

/* ---------- Types ---------- */
type ApiPoint = {
  day: string;          // YYYY-MM-DD (always present, even if no value)
  axisLabel: string;    // may be "" (skipped label)
  tooltipLabel: string; // "Sep 14, 2025"
  value: number | null; // null for filler days
  n: number;            // sample size for that day
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

/* ---------- Tooltip (no year; hide if no value) ---------- */
function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const curr = payload[0]?.payload as { name: string; composite: number | null; n: number };
  if (curr.composite == null) return null; // don't show tooltip for filler days

  const d = new Date(`${curr.name}T00:00:00+08:00`);
  const shortLabel = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });

  return (
    <div className="rounded-md border bg-popover p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{shortLabel}</div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Composite</span>
        <span className="font-semibold">{curr.composite.toFixed(2)}</span>
      </div>
      <div className="text-muted-foreground">Responses: {curr.n}</div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function CompositeSatisfaction() {
  const [range, setRange] = React.useState(getInitialRange);
  const [series, setSeries] = React.useState<ApiPoint[] | null>(null);
  const [cadence, setCadence] = React.useState<{ tickEveryDays: number; labelEveryDays: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/dashboard/composite-satisfaction?from=${f.from}&to=${f.to}`,
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

  // Real points only for the line & tooltip (no nulls)
  const data = all
    .filter((p) => p.value != null)
    .map((p) => ({
      name: p.day,                 // x value
      composite: p.value as number,
      n: p.n,
    }));

  // Ticks come from the full window (even filler days), per API cadence
  const ticks: string[] = React.useMemo(() => {
    if (!all.length || !cadence) return [];
    const every = Math.max(1, cadence.tickEveryDays);
    const out: string[] = [];
    for (let i = 0; i < all.length; i += every) out.push(all[i].day);
    const last = all[all.length - 1]?.day; // ensure last tick
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
  }, [all, cadence]);

  // Axis label text by day (may be "")
  const labelByDay = React.useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((p) => m.set(p.day, p.axisLabel));
    return m;
  }, [all]);

  const empty =
    !loading && (all.length === 0 || data.length === 0);

  return (
    <Card className="md:col-span-8 h-90 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Composite Satisfaction (1–4)</CardTitle>
          <CardDescription>Average of core Likert items over time</CardDescription>
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
              aria-label="Composite Satisfaction trend on a 1–4 scale"
              margin={{ top: 8, right: 24, bottom: 6, left: 10 }}
            >
              <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
              <XAxis
                dataKey="name"
                ticks={ticks}
                tickMargin={6}
                tick={{ fontSize: 12 }}
                height={28}
                tickFormatter={(value: string) => labelByDay.get(value) ?? ""}
              />
              <YAxis
                domain={[1, 4]}
                ticks={[1, 2, 3, 4]}
                tick={{ fontSize: 11 }}
                width={36}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />
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
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
