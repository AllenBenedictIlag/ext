"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine,
} from "recharts";

/* ---------- Types ---------- */
type ApiPoint = {
  day: string;          // YYYY-MM-DD
  axisLabel: string;    // may be ""
  tooltipLabel: string; // "Sep 14, 2025"
  pctYes: number | null;
  answered: number;
  yes: number;
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
  // PH last 30 days fallback (server will also default safely)
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

const nf = new Intl.NumberFormat("en-US");

/* ---------- Tooltip ---------- */
function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const curr = payload[0]?.payload as {
    name: string; pct: number | null; answered: number; tooltip: string;
  };
  const pct = curr.pct == null ? "0%" : `${curr.pct}%`;
  return (
    <div className="rounded-md border bg-popover p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{curr.tooltip}</div>
      <div className="text-muted-foreground">
        Revisit “Yes”: <span className="font-semibold">{pct}</span>
      </div>
      <div className="text-muted-foreground">Responses: {nf.format(curr.answered || 0)}</div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function RevisitIntent() {
  // align with Composite: keep SSR/CSR in sync
  const [range, setRange] = React.useState(getInitialRange);
  const [series, setSeries] = React.useState<ApiPoint[] | null>(null);
  const [cadence, setCadence] = React.useState<{ tickEveryDays: number; labelEveryDays: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      // if you use a different question_key, add &qkey=your_key here
      const res = await fetch(`/api/admin/statistics/revisit-intent?from=${f.from}&to=${f.to}`, { cache: "no-store" });
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

  // Area gets the full window (nulls create gaps); we also carry tooltip text
  const data = all.map((p) => ({
    name: p.day,
    pct: p.pctYes,          // null -> gap
    answered: p.answered,
    tooltip: p.tooltipLabel,
  }));

  // Ticks come from full window (per cadence from API)
  const ticks: string[] = React.useMemo(() => {
    if (!all.length || !cadence) return [];
    const every = Math.max(1, cadence.tickEveryDays);
    const out: string[] = [];
    for (let i = 0; i < all.length; i += every) out.push(all[i].day);
    const last = all[all.length - 1]?.day;
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
  }, [all, cadence]);

  const labelByDay = React.useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((p) => m.set(p.day, p.axisLabel));
    return m;
  }, [all]);

  const allNull = !loading && all.length > 0 && all.every((p) => p.pctYes == null);
  const empty = !loading && all.length === 0;

  return (
    <Card className="md:col-span-4 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Revisit Intent Over Time</CardTitle>
          <CardDescription>% of “Yes” to revisit</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            aria-label="Revisit Intent trend (% Yes)"
            margin={{ top: 8, right: 24, bottom: 0, left: 10 }}
          >
            <defs>
              <linearGradient id="revisitFill" x1="0" y1="0" x2="0" y2="1">
                {/* Use fully-opaque (or near) stops */}
                <stop offset="30%" stopColor={`var(--chart-3)`} stopOpacity={0.95} />
                <stop offset="100%" stopColor={`var(--chart-2)`} stopOpacity={0.95} />
              </linearGradient>
            </defs>

            {/* 1) Grid FIRST = drawn behind */}
            <CartesianGrid stroke="var(--chart-cartesian)" />

            {/* 2) Axes */}
            <XAxis
              dataKey="name"
              ticks={ticks}
              tickMargin={6}
              tick={{ fontSize: 12 }}
              height={28}
              tickFormatter={(value: string) => labelByDay.get(value) ?? ""}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => `${v}%`}
            />

            <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />

            {/* 3) Series LAST = drawn above */}
            {!allNull ? (
              <Area
                type="monotone"
                dataKey="pct"
                name="Revisit Yes %"
                stroke={`var(--chart-3)`}
                strokeWidth={2}
                fill="url(#revisitFill)"
                fillOpacity={1}            // ensure fully opaque fill
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive
              />
            ) : (
              <>
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 6" />
                <text x="50%" y="50%" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">
                  No answered revisit-intent data in this period.
                </text>
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>

        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
