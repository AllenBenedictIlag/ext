"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

/* ---------- Types ---------- */
type ApiResponse = {
  window: { from: string; to: string };
  coverage: { percent: number | null; full: number; total: number };
};

/* ---------- Initial range (URL → localStorage → PH last 30d) ---------- */
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
function CovTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { progress: number; _full: number; _total: number };
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-sm">
      <div className="font-medium">Required Coverage</div>
      <div className="mt-1">
        <span className="tabular-nums font-semibold">{row.progress.toFixed(1)}%</span>{" "}
        <span className="text-muted-foreground">({row._full} of {row._total} complete)</span>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
const DEFAULT_RANGE = { from: "", to: "" };

export default function RequiredCoverage() {
  const [range, setRange] = React.useState(DEFAULT_RANGE);
  const [coverage, setCoverage] = React.useState<{ percent: number | null; full: number; total: number } | null>(null);
  const [loading, setLoading] = React.useState(true);

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/data-quality/required-coverage?from=${f.from}&to=${f.to}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setCoverage(json.coverage);
    } catch {
      setCoverage({ percent: null, full: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }

  // initial fetch (runs post-hydration to avoid SSR/client mismatch)
  React.useEffect(() => {
    const initial = getInitialRange();
    setRange(initial);
    fetchData(initial);
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
  const percent = Math.max(0, Math.min(100, Number(coverage?.percent ?? 0)));
  const full = coverage?.full ?? 0;
  const total = coverage?.total ?? 0;
  const empty = !loading && total === 0;

  const data = [{ name: "Coverage", track: 100, progress: empty ? 0 : percent, _full: full, _total: total }];

  return (
    <Card className="md:col-span-2 h-120 rounded-xl border shadow-sm bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Required Coverage</CardTitle>
        <CardDescription>Submissions with all required answers</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-5rem)] relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center pointer-events-none">
            {loading ? (
              <div className="w-20 h-7 rounded-md bg-muted/40 animate-pulse" />
            ) : empty ? (
              <>
                <div className="text-3xl font-semibold leading-none tabular-nums">—</div>
                <div className="mt-1 text-xs text-muted-foreground">No submissions</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-semibold leading-none tabular-nums">{percent.toFixed(1)}%</div>
                <div className="mt-1 text-xs text-muted-foreground">{full} of {total} complete</div>
              </>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="80%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            aria-label="Required Coverage gauge"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            {/* Track ring */}
            <RadialBar dataKey="track" fill="var(--muted)" cornerRadius={10} />
            {/* Progress ring */}
            <RadialBar dataKey="progress" fill="var(--chart-1)" cornerRadius={10} />
            <RechartsTooltip wrapperStyle={{ outline: "none" }} content={<CovTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
