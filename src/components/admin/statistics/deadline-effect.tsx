// src/components/admin/dashboard/deadline-effect.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine, Cell,
} from "recharts";

/* ---------- Types ---------- */
type ApiBin = { day: number; count: number; sharePct: number };
type ApiResponse = {
  window: { from: string; to: string };
  totals: { issued: number; usedWithin7d: number };
  bins: ApiBin[];
};

/* ---------- Initial range (URL -> localStorage -> PH last 30d) ---------- */
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

  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ---------- Tooltip ---------- */
function DeadlineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as { day: number; share: number; count: number };
  const isExpiry = p.day === 7;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">
        {p.day === 7 ? "Day 7 (expiry)" : `Day ${p.day}`}
        {isExpiry ? " • Expiry day" : null}
      </div>
      <div className="mt-1 text-muted-foreground">
        {p.share.toFixed(1)}% of used receipts were redeemed on this day.
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">Count: {p.count}</div>
      {isExpiry && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          The spike here quantifies the “deadline effect”.
        </div>
      )}
    </div>
  );
}

/* ---------- Component ---------- */
export default function DeadlineEffect() {
  const [range, setRange] = React.useState(getInitialRange);
  const [bins, setBins] = React.useState<ApiBin[] | null>(null);
  const [totals, setTotals] = React.useState<{ issued: number; usedWithin7d: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/statistics/deadline-effect?from=${f.from}&to=${f.to}`, {
        cache: "no-store",
      });
      const json: ApiResponse = await res.json();
      setBins(json.bins);
      setTotals(json.totals);
    } catch {
      setBins([]);
      setTotals({ issued: 0, usedWithin7d: 0 });
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

  const empty = !loading && (!bins || bins.length === 0 || (totals?.usedWithin7d ?? 0) === 0);

  // chart data
  const data =
    bins?.map((b) => ({
      day: b.day,
      label: b.day === 7 ? "Day 7 (expiry)" : `Day ${b.day}`,
      share: b.sharePct, // 0..100
      count: b.count,
    })) ?? [];

  return (
    <Card className="md:col-span-5 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Deadline Effect (Day 0–7)</CardTitle>
          <CardDescription>Bar chart highlighting redeems on the expiry day</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="98%" height="100%">
            <BarChart
              data={data}
              aria-label="Deadline Effect: share of uses by day since issue (0–7)"
              margin={{ top: 16, right: 20, bottom: 0, left: 12 }}
              barCategoryGap={20}
            >
             
              <XAxis
                dataKey="day"
                tickFormatter={(d: number) => (d === 7 ? "Day 7 (expiry)" : `Day ${d}`)}
                tick={{ fontSize: 12 }}
                tickMargin={8}
                height={28}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <RechartsTooltip content={<DeadlineTooltip />} wrapperStyle={{ outline: "none" }} cursor={{ fill: "var(--muted)" }} />

              {/* Visual marker at expiry day */}
              <ReferenceLine
                x={7}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{ value: "Expiry", position: "top", fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <CartesianGrid stroke="var(--chart-cartesian)" />
              <Bar dataKey="share" name="Share of uses" radius={[6, 6, 0, 0]} isAnimationActive>
                {data.map((entry, idx) => (
                  <Cell key={`c-${idx}`} fill={entry.day === 7 ? "var(--muted)" : "var(--chart-3)"} />
                  
                ))}
              </Bar>
               
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
