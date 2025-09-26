// src/components/admin/dashboard/submissions-patterns.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";

/* ---------- Types ---------- */
type ApiCell = { hour: number; dow: number; count: number };
type ApiResponse = {
  window: { from: string; to: string };
  cells: ApiCell[];
  max: number;
};



/* ---------- Labels ---------- */
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourTickLabel(h: number) {
  const am = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${am}`;
}
function hourRangeLabel(h: number) {
  const end = (h + 1) % 24;
  return `${hourTickLabel(h)}–${hourTickLabel(end)}`;
}

const X_PAD_HOURS = 0.75; // try 0.5–1.0

/* ---------- Initial range from URL -> localStorage -> PH last 30d ---------- */
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
function HeatTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload as ApiCell | undefined;
  if (!p) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-sm text-sm">
      <div className="font-medium mb-0.5">
        {DOW_LABELS[p.dow]} · {hourRangeLabel(p.hour)}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-1)", opacity: 1 }} />
        <span className="text-muted-foreground">Submissions:</span>
        <span>{p.count}</span>
      </div>
    </div>
  );
}

/* ---------- Opacity scale (brand color fixed; intensity via opacity) ---------- */
function makeOpacity(max: number) {
  return (v: number) => {
    if (!max || max <= 0) return 0.12;
    const t = Math.max(0, Math.min(1, v / max));
    const gamma = 0.8;
    return 0.12 + 0.83 * Math.pow(t, gamma);
  };
}

/* ---------- Component ---------- */
export default function SubmissionsPattern() {
  const [range, setRange] = React.useState(getInitialRange);
  const [cells, setCells] = React.useState<ApiCell[] | null>(null);
  const [max, setMax] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  const CELL_PX = 500;
  const hourTicks = React.useMemo(
    () => Array.from({ length: 24 }, (_, h) => h).filter((h) => h % 3 === 0),
    []
  );

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/statistics/submissions-pattern?from=${f.from}&to=${f.to}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setCells(Array.isArray(json.cells) ? json.cells : []);
      setMax(Number(json.max ?? 0));
    } catch {
      setCells([]);
      setMax(0);
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
  const opacityFor = React.useMemo(() => makeOpacity(max), [max]);

  // 👉 ensure Recharts always receives an array, not null
  const dataCells: ApiCell[] = React.useMemo(() => (cells ?? []), [cells]);

  const empty = !loading && dataCells.every((c) => c.count === 0);

  return (
    <Card className="md:col-span-8 h-120 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Submission Patterns</CardTitle>
          <CardDescription>Heatmap — Day of week × Hour (Manila)</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="98%" height="100%">
            <ScatterChart
              aria-label="Submissions heatmap: day of week by hour"
              margin={{ top: 12, right: 24, bottom: 0, left: 12 }}
            >
              <CartesianGrid
                stroke="var(--chart-2)"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
                />
              <XAxis
                type="number"
                dataKey="hour"
                domain={[-X_PAD_HOURS, 23 + X_PAD_HOURS]} // ← left/right padding in “hour” units
                ticks={hourTicks}
                tick={{ fontSize: 11 }}
                tickMargin={8}
                height={28}
                tickFormatter={hourTickLabel}
                />

              <YAxis
                type="number"
                dataKey="dow"
                domain={[-0.5, 6.5]}
                ticks={[0, 1, 2, 3, 4, 5, 6]}
                tick={{ fontSize: 12 }}
                width={48}
                tickFormatter={(d) => DOW_LABELS[d] ?? d}
                
              />

              {/* Constant pixel squares via ZAxis */}
              <ZAxis type="number" dataKey="z" range={[CELL_PX, CELL_PX]} />

              <RechartsTooltip
                content={<HeatTooltip />}
                wrapperStyle={{ outline: "none" }}
                cursor={{ fill: "var(--muted)" }}
              />

              <Scatter data={dataCells} shape="square" name="Submissions" fill="var(--chart-1)">
                {dataCells.map((p, i) => (
                  <Cell key={i} fillOpacity={opacityFor(p.count)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p>{footer}</p>
      </CardFooter>
    </Card>
  );
}
