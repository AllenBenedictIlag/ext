"use client";

import * as React from "react";
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
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

/** ---------- Types ---------- */
type ApiResponse = {
  from: string;
  to: string;
  totals: {
    totalAnswered: number;
    positiveTotal: number;
    negativeTotal: number;
    positiveLikert: number;
    positiveYesNo: number;
    negativeLikert: number;
    negativeYesNo: number;
  };
};

type Period = { from: string; to: string } | null;

/** ---------- Helpers ---------- */
function readPeriodFromURL(): Period {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && to) return { from, to };

  try {
    const saved = localStorage.getItem("dashboard:filters");
    if (saved) {
      const j = JSON.parse(saved) as { from?: string; to?: string };
      if (j?.from && j?.to) return { from: j.from, to: j.to };
    }
  } catch {}
  return null;
}
const pct = (x: number, d: number) => (d ? Math.round((x / d) * 1000) / 10 : 0);

/** ---------- Colors (use your CSS vars) ---------- */
const C_POS     = "var(--chart-1)";
const C_NEG     = "var(--chart-2)";
const C_POS_LIK = "var(--chart-3)";
const C_POS_YN  = "var(--chart-4)";
const C_NEG_LIK = "var(--chart-5)";
const C_NEG_YN  = "var(--chart-6)";

/** ---------- Component ---------- */
export default function PositiveNegative() {
  const [period, setPeriod] = React.useState<Period>(() => readPeriodFromURL());
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchNow = React.useCallback(async (p: Period) => {
    if (!p) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/statistics/positive-negative?from=${encodeURIComponent(p.from)}&to=${encodeURIComponent(p.to)}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      // graceful empty fallback (keeps UI shape identical)
      setData({
        from: p.from,
        to: p.to,
        totals: {
          totalAnswered: 0,
          positiveTotal: 0,
          negativeTotal: 0,
          positiveLikert: 0,
          positiveYesNo: 0,
          negativeLikert: 0,
          negativeYesNo: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load
  React.useEffect(() => {
    const p = readPeriodFromURL();
    setPeriod(p);
    if (p) fetchNow(p);
  }, [fetchNow]);

  // subscribe to GlobalQuickFilter
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent).detail as { from?: string; to?: string } | undefined;
      if (detail?.from && detail?.to) {
        const p = { from: detail.from, to: detail.to };
        setPeriod(p);
        fetchNow(p);
      }
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, [fetchNow]);

  const totals = data?.totals ?? {
    totalAnswered: 0,
    positiveTotal: 0,
    negativeTotal: 0,
    positiveLikert: 0,
    positiveYesNo: 0,
    negativeLikert: 0,
    negativeYesNo: 0,
  };

  const total = totals.totalAnswered;
  const pos = totals.positiveTotal;
  const neg = totals.negativeTotal;

  // Inner ring
  const inner = [
    { name: "Positive", value: pos, fill: C_POS },
    { name: "Negative", value: neg, fill: C_NEG },
  ];

  // Outer ring (source split)
  const outer = [
    { name: "Likert", value: totals.positiveLikert, fill: C_POS_LIK },
    { name: "Yes/No", value: totals.positiveYesNo, fill: C_POS_YN },
    { name: "Likert", value: totals.negativeLikert, fill: C_NEG_LIK },
    { name: "Yes/No", value: totals.negativeYesNo, fill: C_NEG_YN },
  ];

  const TooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload;
    const v = Number(p?.value || 0);
    return (
      <div className="rounded-md border bg-popover p-2 text-sm shadow-sm">
        <div className="font-medium">{p?.name}</div>
        <div className="text-muted-foreground">
          {v.toLocaleString()} ({pct(v, total)}%)
        </div>
      </div>
    );
  };

  return (
    <Card className="md:col-span-3 h-120 rounded-xl border shadow-sm ">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Positive % • Negative %</CardTitle>
          <CardDescription>Inner: sentiment • Outer: source split</CardDescription>
        </div>
      </CardHeader>

      {/* Use same pattern as your Funnel: let RC own ~90% of the content area */}
      <CardContent className="h-[calc(100%-4rem)] flex items-center -mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
            <RechartsTooltip content={<TooltipContent />} wrapperStyle={{ outline: "none" }} />

            {/* Smaller legend text + icons so it won’t push the chart */}
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

            {/* INNER RING — use percent radii so it scales with container */}
            <Pie
              data={inner}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="32%"   // was ~38px
              outerRadius="52%"   // was ~64px
              paddingAngle={1}
              isAnimationActive={!loading}
            >
              {inner.map((s, i) => <Cell key={i} fill={s.fill} />)}
              {!loading && (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {total.toLocaleString()} ans
                </text>
              )}
            </Pie>

            {/* OUTER RING — also percent radii; a slim ring helps labels fit */}
            <Pie
              data={outer}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="56%"   // was 70px
              outerRadius="71%"   // was 88px
              paddingAngle={1}
              isAnimationActive={!loading}
              labelLine={false}
              // smaller labels; clamp to non-zero to avoid clutter
              label={(p) =>
                p.value > 0 ? (
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor={p.textAnchor}
                    dominantBaseline="central"
                    style={{ fontSize: 12 }}
                    className="fill-foreground"
                  >
                    {`${p.name} ${pct(p.value, total)}%`}
                  </text>
                ) : null
              }
            >
              {outer.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        {period ? `${period.from} → ${period.to}` : "—"}
      </CardFooter>
    </Card>
  );

}
