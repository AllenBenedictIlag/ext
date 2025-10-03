// src/components/admin/monthly-trend.tsx
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
  Bar,
  Line,
  ComposedChart,
  type TooltipProps,
} from "recharts";

/* ---------- API types ---------- */
type ApiPoint = {
  bucketKey: string;
  axisLabel: string;
  tooltipLabel: string;
  receipts: number;
  submissions: number;
  responsePct: number;
};
type ApiResponse = {
  window: { from: string; to: string };
  basis: { cohort: "issued_at"; tz: "Asia/Manila"; granularity: "day" | "week" | "month" | "quarter3" };
  points: ApiPoint[];
};

type Props = { cardClassName?: string };

/* ---------- Read initial {from,to} ---------- */
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
  const start = new Date(end); start.setDate(start.getDate() - 29);
  const y = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ---------- Formatting ---------- */
const NF = new Intl.NumberFormat("en-US");
const fmtNum = (n: number) => NF.format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/* ---------- Colors (tokens 1..5 only) ---------- */
const COLOR_RECEIPTS = "var(--chart-1)";
const COLOR_SUBMITS  = "var(--chart-2)";
const COLOR_PERCENT  = "var(--chart-3)";

/* ---------- Tooltip ---------- */
function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ApiPoint | undefined;
  if (!p) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <div className="mb-1 font-medium">{p.tooltipLabel}</div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: COLOR_RECEIPTS }} />
          <span className="text-muted-foreground">Receipts:</span>
          <span className="font-medium">{fmtNum(p.receipts)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_SUBMITS }} />
          <span className="text-muted-foreground">Submissions:</span>
          <span className="font-medium">{fmtNum(p.submissions)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_PERCENT }} />
          <span className="text-muted-foreground">Response %:</span>
          <span className="font-medium">{fmtPct(p.responsePct)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function MonthlyTrend({ cardClassName }: Props) {
  const [range, setRange] = React.useState(getInitialRange);
  const [rows, setRows] = React.useState<ApiPoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/statistics/monthly-trend?from=${f.from}&to=${f.to}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setRows(json.points ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  React.useEffect(() => { fetchData(range); /* eslint-disable-next-line */ }, []);

  // subscribe to GlobalQuickFilter updates
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
  const data = rows ?? [];
  const empty = !loading && (!data.length || data.every(d => d.receipts === 0 && d.submissions === 0));

  // Left-axis nice max
  const maxCount = Math.max(0, ...data.map(d => Math.max(d.receipts, d.submissions)));
  const yMax =
    maxCount <= 1000 ? Math.ceil(maxCount / 200) * 200 :
    maxCount <= 5000 ? Math.ceil(maxCount / 500) * 500 :
    Math.ceil(maxCount / 1000) * 1000;

  return (
    <Card className={`md:col-span-5 h-90 rounded-xl border shadow-sm bg-card ${cardClassName ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Receipts & Response Trend</CardTitle>
          <CardDescription>Receipts • Submissions • Response %</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              aria-label="Receipts (bars), Submissions (line), Response % (right-axis line) with dynamic X ticks"
              margin={{ top: 12, right: 28, bottom: 0, left: 12 }}
            >
              <CartesianGrid stroke="var(--chart-cartesian)" />
              <XAxis
                dataKey="axisLabel"
                tickMargin={6}
                tick={{ fontSize: 12 }}
                height={28}
              />
              <YAxis
                yAxisId="count"
                domain={[0, Math.max(200, yMax)]}
                tick={{ fontSize: 11 }}
                width={52}
                tickFormatter={(v) => fmtNum(Number(v))}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fontSize: 11 }}
                width={40}
                tickFormatter={(v) => `${v}%`}
              />
              <RechartsTooltip content={<TrendTooltip />} wrapperStyle={{ outline: "none" }} />
              <Legend
                  iconSize={10}
                  height={24}
                  formatter={(value) => (
                    <span
                      style={{
                        fontSize: "12px",        // tweak size
                        fontWeight: 400,         // or "bold"
                        color: "var(--card-foreground)", // use your theme variable
                      }}
                    >
                      {value}
                    </span>
                  )}
                />
              <Bar
                yAxisId="count"
                dataKey="receipts"
                name="Receipts"
                barSize={26}
                fill={COLOR_RECEIPTS}
                radius={[6, 6, 0, 0]}
                isAnimationActive
              />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="submissions"
                name="Submissions"
                stroke={COLOR_SUBMITS}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="responsePct"
                name="Response %"
                stroke={COLOR_PERCENT}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
