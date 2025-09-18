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
const C_POS     = "hsl(var(--chart-2))";
const C_NEG     = "hsl(var(--destructive))";
const C_POS_LIK = "hsl(var(--chart-1))";
const C_POS_YN  = "hsl(var(--chart-3))";
const C_NEG_LIK = "hsl(var(--chart-4))";
const C_NEG_YN  = "hsl(var(--chart-5))";

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
        `/api/admin/dashboard/positive-negative?from=${encodeURIComponent(p.from)}&to=${encodeURIComponent(p.to)}`
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
    { name: "Pos · Likert", value: totals.positiveLikert, fill: C_POS_LIK },
    { name: "Pos · Yes/No", value: totals.positiveYesNo, fill: C_POS_YN },
    { name: "Neg · Likert", value: totals.negativeLikert, fill: C_NEG_LIK },
    { name: "Neg · Yes/No", value: totals.negativeYesNo, fill: C_NEG_YN },
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
    <Card className="md:col-span-3 h-90 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Positive % • Negative %</CardTitle>
          <CardDescription>Inner: sentiment • Outer: source split</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 8, bottom: 8, left: 8 }}>
            <RechartsTooltip content={<TooltipContent />} wrapperStyle={{ outline: "none" }} />
            <Legend verticalAlign="bottom" height={28} iconSize={10} wrapperStyle={{ fontSize: 12 }} />

            <Pie
              data={inner}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={64}
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
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  {total.toLocaleString()} ans
                </text>
              )}
            </Pie>

            <Pie
              data={outer}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={88}
              paddingAngle={1}
              isAnimationActive={!loading}
              labelLine={false}
              label={(p) => (p.value > 0 ? `${p.name} ${pct(p.value, total)}%` : "")}
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
