"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ---------- Types from API ---------- */
type Bucket = { key: string; label: string; count: number; pct: number };
type ApiResponse = {
  window: { from: string; to: string };
  totals: { likert: number; yesno: number };
  likert: Bucket[]; // keys: "1".."4"
  yesno: Bucket[];  // keys: "yes", "no"
};

/* ---------- Initial range helpers ---------- */
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
function BalanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter((p: any) => typeof p.value === "number")
    .map((p: any) => ({ name: p.name as string, value: p.value as number, color: p.color || p.fill }));

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm" style={{ minWidth: 220 }}>
      <div className="mb-1 font-medium">{label}</div>
      {items.map((it: any) => (
        <div key={it.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
            <span>{it.name}</span>
          </div>
          <span className="tabular-nums">{Math.round(it.value * 10) / 10}%</span>
        </div>
      ))}
      <div className="mt-2 text-xs text-muted-foreground">Share of answers (sums to ~100%).</div>
    </div>
  );
}

/* ---------- Colors (your tokens) ---------- */
const COLOR_L1 = "var(--destructive)";
const COLOR_L2 = "var(--chart-2)";
const COLOR_L3 = "var(--chart-4)";
const COLOR_L4 = "var(--chart-1)";
const COLOR_YES = "var(--chart-4)";
const COLOR_NO = "var(--destructive)";

/* ---------- Component ---------- */
export default function OptionBalance() {
  const [range, setRange] = React.useState(getInitialRange);
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<"STACKED" | "PIE">("STACKED");
  const [pieKind, setPieKind] = React.useState<"LIKERT" | "YESNO">("LIKERT");

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/data-quality/option-balance?from=${f.from}&to=${f.to}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
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
  const empty =
    !loading &&
    (!data ||
      ((data.totals.likert ?? 0) === 0 && (data.totals.yesno ?? 0) === 0));

  /* ---------- Build chart datasets ---------- */
  const likert = data?.likert ?? [
    { key: "1", label: "1 — Extremely Dissatisfied", count: 0, pct: 0 },
    { key: "2", label: "2 — Dissatisfied",            count: 0, pct: 0 },
    { key: "3", label: "3 — Satisfied",               count: 0, pct: 0 },
    { key: "4", label: "4 — Extremely Satisfied",     count: 0, pct: 0 },
  ];
  const yesno = data?.yesno ?? [
    { key: "yes", label: "Yes", count: 0, pct: 0 },
    { key: "no",  label: "No",  count: 0, pct: 0 },
  ];

  const stackedData = [
    {
      type: "Likert",
      o1: likert.find((x) => x.key === "1")?.pct ?? 0,
      o2: likert.find((x) => x.key === "2")?.pct ?? 0,
      o3: likert.find((x) => x.key === "3")?.pct ?? 0,
      o4: likert.find((x) => x.key === "4")?.pct ?? 0,
    },
    {
      type: "Yes/No",
      yes: yesno.find((x) => x.key === "yes")?.pct ?? 0,
      no:  yesno.find((x) => x.key === "no")?.pct ?? 0,
    },
  ];

  const pieLikert = [
    { name: likert[3]?.label ?? "4", value: likert[3]?.pct ?? 0, color: COLOR_L4 },
    { name: likert[2]?.label ?? "3", value: likert[2]?.pct ?? 0, color: COLOR_L3 },
    { name: likert[1]?.label ?? "2", value: likert[1]?.pct ?? 0, color: COLOR_L2 },
    { name: likert[0]?.label ?? "1", value: likert[0]?.pct ?? 0, color: COLOR_L1 },
  ];
  const pieYesNo = [
    { name: yesno[0]?.label ?? "Yes", value: yesno.find(x=>x.key==="yes")?.pct ?? 0, color: COLOR_YES },
    { name: yesno[1]?.label ?? "No",  value: yesno.find(x=>x.key==="no")?.pct ?? 0,  color: COLOR_NO  },
  ];
  const pieData = pieKind === "LIKERT" ? pieLikert : pieYesNo;

  return (
    <Card className="md:col-span-4 h-120 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Option Balance</CardTitle>
          <CardDescription>% share of each Likert / Yes-No option</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={view === "STACKED" ? "default" : "ghost"} onClick={() => setView("STACKED")}>
            Stacked
          </Button>
          <Button size="sm" variant={view === "PIE" ? "default" : "ghost"} onClick={() => setView("PIE")}>
            Pie
          </Button>
          {view === "PIE" && (
            <div className="ml-1 flex items-center gap-1">
              <Button size="sm" variant={pieKind === "LIKERT" ? "secondary" : "ghost"} onClick={() => setPieKind("LIKERT")}>
                Likert
              </Button>
              <Button size="sm" variant={pieKind === "YESNO" ? "secondary" : "ghost"} onClick={() => setPieKind("YESNO")}>
                Yes/No
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {view === "STACKED" ? (
              <BarChart
                data={stackedData}
                aria-label="Option balance stacked bars for Likert and Yes/No (percent scale)"
                margin={{ top: 8, right: 20, bottom: 8, left: 10 }}
              >
                <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
                <XAxis dataKey="type" tickMargin={8} tick={{ fontSize: 12 }} height={28} />
                <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                <RechartsTooltip content={<BalanceTooltip />} wrapperStyle={{ outline: "none" }} />
                <Legend wrapperStyle={{ fontSize: 14 }} height={28} />

                {/* Likert slices */}
                <Bar dataKey="o1" name="1 — Extremely Dissatisfied" stackId="LIKERT" fill={COLOR_L1} />
                <Bar dataKey="o2" name="2 — Dissatisfied"            stackId="LIKERT" fill={COLOR_L2} />
                <Bar dataKey="o3" name="3 — Satisfied"               stackId="LIKERT" fill={COLOR_L3} />
                <Bar dataKey="o4" name="4 — Extremely Satisfied"     stackId="LIKERT" fill={COLOR_L4} />

                {/* Yes/No slices */}
                <Bar dataKey="yes" name="Yes" stackId="YESNO" fill={COLOR_YES} />
                <Bar dataKey="no"  name="No"  stackId="YESNO" fill={COLOR_NO} />
              </BarChart>
            ) : (
              <PieChart aria-label={`Option balance pie for ${pieKind === "LIKERT" ? "Likert" : "Yes/No"}`} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <RechartsTooltip content={<BalanceTooltip />} wrapperStyle={{ outline: "none" }} />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="48%"
                  outerRadius="80%"
                  isAnimationActive
                  label={(d: any) => (d.value >= 6 ? `${Math.round(d.value * 10) / 10}%` : "")}
                >
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
