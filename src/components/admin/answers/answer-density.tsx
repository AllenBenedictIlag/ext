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
  Bar,
  LabelList,
  ComposedChart,
  ReferenceLine,
} from "recharts";

/* ---------- API types ---------- */
type ApiResponse = {
  window: { from: string; to: string };
  survey: { id: number; title: string; version: number } | null;
  questions: { required: number; optional: number } | null;
  expected: number | null;
  total: number;
  domain: { min: number; max: number };
  bins: Array<{ answers: number; count: number; share: number }>;
};

/* ---------- Range helpers ---------- */
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
function DensityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { answers: number; count: number; share: number };
  const sharePct = `${Math.round(point.share * 100)}%`;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">Answers: {label}</div>
      <div className="text-muted-foreground">Submissions: {point.count} • Share: {sharePct}</div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function AnswerDensity({
  height = "h-120",          // NEW
  cardClassName,             // NEW
}: {
  height?: string;           // NEW: e.g., "h-90"
  cardClassName?: string;    // NEW: e.g., "md:col-span-6"
}) {
  const [range, setRange] = React.useState(getInitialRange);
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/answers/answer-density?from=${f.from}&to=${f.to}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData({
        window: f,
        survey: null,
        questions: null,
        expected: null,
        total: 0,
        domain: { min: 0, max: 0 },
        bins: [],
      });
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
  const bins = data?.bins ?? [];
  const empty = !loading && (!bins.length || (data?.total ?? 0) === 0);

  // x-axis domain with padding for bar radius & ref line
  const xMin = data ? (data.domain.min ?? 0) - 0.5 : 0;
  const xMax = data ? (data.domain.max ?? 0) + 0.5 : 0;
  const yMax = Math.max(0, ...bins.map(b => b.count));
  const expected = data?.expected ?? null;

  return (
    <Card className={`md:col-span-4 ${height} rounded-xl border shadow-sm bg-card ${cardClassName ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Answer Density</CardTitle>
          <CardDescription>Distribution of answers per submission</CardDescription>
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
              data={bins}
              aria-label="Histogram of answers per submission"
              margin={{ top: 12, right: 24, bottom: 10, left: 14 }}
            >
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="answers"
                domain={[xMin, xMax]}
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickMargin={6}
                height={28}
                label={{ value: "Answers per submission", position: "insideBottom", offset: -6 }}
              />
              <YAxis
                type="number"
                dataKey="count"
                domain={[0, Math.ceil(yMax * 1.15)]}
                tick={{ fontSize: 12 }}
                width={44}
              />

              <RechartsTooltip
                content={<DensityTooltip />}
                wrapperStyle={{ outline: "none" }}
                cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
              />

              {expected != null && (
                <ReferenceLine
                  x={expected}
                  stroke="var(--chart-2)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `Expected ≈ ${expected.toFixed(1)}`,
                    position: "top",
                    fill: "currentColor",
                    fontSize: 12,
                  }}
                />
              )}

              <Bar
                dataKey="count"
                name="Submissions"
                fill="var(--chart-1)"
                radius={[6, 6, 0, 0]}
                barSize={28}
                isAnimationActive
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  className="fill-foreground"
                  fontSize={11}
                />
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <div className="flex flex-col gap-1">
          <p>{footer}</p>
        </div>
      </CardFooter>
    </Card>
  );
}
