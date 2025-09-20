// src/components/admin/dashboard/conversion-funnel.tsx
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
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip as RechartsTooltip,
  TooltipProps,
} from "recharts";

/* ---------- Types ---------- */
type Stage = { name: "Issued" | "Used" | "Submitted"; value: number; fill: string };

type FunnelApiResponse = {
  period: { from: string; to: string };
  issued: number;
  used: number;
  /** This is "submitted with complete answers over all OPTIONAL questions" */
  submitted: number;
};

/* ---------- Defaults (UI stays the same; values get replaced) ---------- */
const DEFAULT_STAGES: Stage[] = [
  { value: 0, name: "Issued",    fill: "var(--chart-1)" },
  { value: 0, name: "Used",      fill: "var(--chart-2)" },
  { value: 0, name: "Submitted", fill: "var(--chart-5)" },
];

/* ---------- Tooltip (unchanged visuals) ---------- */
function makeFunnelTooltip(top: number) {
  return function FunnelShadcnTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const stage = (p?.payload as any)?.name as string;
    const value = (p?.payload as any)?.value as number;
    const color = (p?.payload as any)?.fill as string;
    const conv = top ? (value / top) * 100 : 0;

    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-3 py-2 text-sm">
        <div className="font-medium mb-1">{stage}</div>
        <div className="flex items-center gap-3">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-muted-foreground">Count</span>
          <span className="ml-auto tabular-nums">{value}</span>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-muted-foreground">% of Issued</span>
          <span className="ml-auto tabular-nums">{conv.toFixed(1)}%</span>
        </div>
      </div>
    );
  };
}

/* ---------- Read saved window if URL doesn't have it yet ---------- */
function loadSavedWindow() {
  try {
    const raw = localStorage.getItem("dashboard:filters");
    if (!raw) return null;
    const j = JSON.parse(raw) as { from?: string; to?: string };
    if (j?.from && j?.to) return { from: j.from, to: j.to };
  } catch {}
  return null;
}

/* ---------- Component ---------- */
export default function FunnelCard() {
  const [stages, setStages] = React.useState<Stage[]>(DEFAULT_STAGES);
  const [period, setPeriod] = React.useState<{ from: string; to: string } | null>(null);

  // Always fetch with explicit from/to to match GlobalQuickFilter exactly
  const fetchData = React.useCallback(async (from: string, to: string) => {
    const url = `/api/admin/dashboard/conversion-funnel?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j: FunnelApiResponse = await res.json();

    setPeriod(j.period);
    setStages([
      { name: "Issued",    value: j.issued,    fill: "var(--chart-1)" },
      { name: "Used",      value: j.used,      fill: "var(--chart-2)" },
      { name: "Submitted", value: j.submitted, fill: "var(--chart-5)" },
    ]);
  }, []);

  // Initial load: URL → localStorage fallback
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const from = sp.get("from");
    const to   = sp.get("to");
    if (from && to) {
      fetchData(from, to);
    } else {
      const saved = loadSavedWindow();
      if (saved) fetchData(saved.from, saved.to);
    }
  }, [fetchData]);

  // Listen for GlobalQuickFilter commits
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent<{ from: string; to: string }>).detail;
      if (detail?.from && detail?.to) fetchData(detail.from, detail.to);
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, [fetchData]);

  const topValue = stages[0]?.value ?? 0;
  const CustomTooltip = makeFunnelTooltip(topValue);

  return (
    <Card className="md:col-span-3 h-90 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Issued → Used → Submitted</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="90%">
          <FunnelChart aria-label="Conversion funnel" margin={{ top: 0, right: 8, bottom: 8, left: 8 }}>
            <RechartsTooltip
              content={<CustomTooltip />}
              cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
              wrapperStyle={{ outline: "none" }}
            />
            <Funnel dataKey="value" data={stages} isAnimationActive>
              <LabelList
                dataKey="name"
                position="right"
                dx={12}
                dy={6}
                fill="currentColor"
                stroke="none"
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        {period ? ` ${period.from} → ${period.to}` : "Loading..."}
      </CardFooter>
    </Card>
  );
}
