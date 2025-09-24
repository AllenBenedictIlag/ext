"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis,
  Tooltip as RechartsTooltip, BarChart, Bar,
} from "recharts";

/* ---------- Types ---------- */
type Bin = {
  start: number;    // inclusive hours
  end: number;      // exclusive hours
  label: string;    // "0–6h"
  count: number;
  share: number;    // 0..100
  cumShare: number; // 0..100
};
type ApiResponse = {
  window: { from: string; to: string };
  rule: { stepHours: number; maxHours: number };
  totalUsed: number;
  bins: Bin[];
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

  // Fallback: PH last 30d inclusive
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: f(start), to: f(end) };
}

/* ---------- Tooltip ---------- */
function HistogramTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Bin | undefined;
  if (!p) return null;

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{`Window: ${p.label}`}</div>
      <div className="mt-1">
        <div className="text-foreground">
          Used: <span className="font-semibold">{fmt(p.count)}</span>
        </div>
        <div className="text-muted-foreground">
          Share: <span className="font-medium">{p.share.toFixed(1)}%</span>
        </div>
        <div className="text-muted-foreground">
          Cumulative: <span className="font-medium">{p.cumShare.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function TimeToUse() {
  const [range, setRange] = React.useState(getInitialRange);
  const [bins, setBins] = React.useState<Bin[] | null>(null);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      // You can add &step=6 here if you want to force bin size from the client.
      const res = await fetch(`/api/admin/statistics/time-to-use?from=${f.from}&to=${f.to}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setBins(json.bins);
      setTotal(json.totalUsed);
    } catch {
      setBins([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  React.useEffect(() => { fetchData(range); /* eslint-disable-next-line */ }, []);

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
  const empty = !loading && (!bins || bins.every(b => b.count === 0));

  return (
    <Card className="md:col-span-4 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Time-to-Use Distribution</CardTitle>
          <CardDescription>Hours from issue to use (6h bins)</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="95%" height="100%">
            <BarChart
              data={bins!}
              aria-label="Histogram of hours from receipt issue to use, grouped in 6-hour windows"
              margin={{ top: 8, right: 16, bottom: 0, left: 10 }}
            >
                <CartesianGrid
                stroke="var(--chart-2)"
                strokeOpacity={0.7}
                strokeDasharray="3 3"
                />
                
              <XAxis dataKey="label" tickMargin={8} tick={{ fontSize: 12 }} height={30}/>
              <YAxis tick={{ fontSize: 11 }} width={46} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<HistogramTooltip />} wrapperStyle={{ outline: "none" }} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="count" name="Used" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}{total ? ` • Total used: ${total.toLocaleString()}` : ""}</p>
      </CardFooter>
    </Card>
  );
}
