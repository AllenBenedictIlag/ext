// src/components/admin/dashboard/driver-revisit.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis,
  Tooltip as RechartsTooltip, ReferenceLine, LabelList, Cell,
} from "recharts";

/* ---------- Types to mirror API ---------- */
type ApiItem = {
  key: string;
  label: string;
  avgYes: number | null;
  avgNo: number | null;
  nYes: number;
  nNo: number;
  gap: number | null;
};
type ApiResponse = {
  window: { from: string; to: string };
  items: ApiItem[];
};

/* ---------- Helpers ---------- */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Last 30 days in Asia/Manila, inclusive
function rangeFallbackPH(): { from: string; to: string } {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { from: ymd(start), to: ymd(end) };
}
function round2(n: number) { return Math.round(n * 100) / 100; }
// Title-case a key like "overall_experience" -> "Overall Experience"
function titleizeKey(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ---------- Tooltip ---------- */
function DriverTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ApiItem;
  if (!p) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-sm shadow-sm" style={{ maxWidth: 320 }}>
      <div className="mb-1 font-medium">{p.label || titleizeKey(p.key)}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <div className="text-muted-foreground">Avg (Revisit=Yes)</div>
        <div className="text-right font-medium">{p.avgYes != null ? round2(p.avgYes) : "—"}</div>
        <div className="text-muted-foreground">Avg (Revisit=No)</div>
        <div className="text-right font-medium">{p.avgNo  != null ? round2(p.avgNo)  : "—"}</div>
        <div className="text-muted-foreground">Gap (Yes − No)</div>
        <div className="text-right font-semibold">
          {p.gap != null ? (p.gap >= 0 ? `+${round2(p.gap)}` : `${round2(p.gap)}`) : "—"}
        </div>
        <div className="text-muted-foreground">n (Yes / No)</div>
        <div className="text-right">{p.nYes} / {p.nNo}</div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function DriverRevisit() {
  // Hydration-safe: don't read window/localStorage until after mount
  const [range, setRange] = React.useState<{ from: string; to: string } | null>(null);
  const [items, setItems] = React.useState<ApiItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Read initial range after mount
  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const from = sp.get("from");
      const to = sp.get("to");
      if (from && to) { setRange({ from, to }); return; }
      const saved = localStorage.getItem("dashboard:filters");
      if (saved) {
        const j = JSON.parse(saved) as { from?: string; to?: string };
        if (j.from && j.to) { setRange({ from: j.from, to: j.to }); return; }
      }
    } catch {}
    setRange(rangeFallbackPH());
  }, []);

  // Subscribe to GlobalQuickFilter event
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent<{ from: string; to: string }>).detail;
      if (!detail) return;
      setRange(detail);
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, []);

  // Fetch when range is available
  React.useEffect(() => {
    if (!range) return;
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/statistics/driver-revisit?from=${range.from}&to=${range.to}`, {
          cache: "no-store",
        });
        const json: ApiResponse = await res.json();
        if (!abort) setItems(json.items ?? []);
      } catch {
        if (!abort) setItems([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [range?.from, range?.to]);

  // ---- derive data (sort by absolute gap, color by sign) ----
  const dataRaw = items ?? [];
  const data = React.useMemo(() => {
    const copy = [...dataRaw];
    const abs = (x: ApiItem) => Math.abs(x.gap ?? 0);
    copy.sort((a, b) => abs(b) - abs(a));
    return copy;
  }, [dataRaw]);

  const empty = !loading && range != null && data.length === 0;

  const maxAbs = React.useMemo(() => {
    const m = Math.max(0, ...data.map(r => Math.abs(r.gap ?? 0)));
    return (m || 0.5) * 1.15;
  }, [data]);

  const colorFor = (gap: number | null) =>
    (gap ?? 0) >= 0 ? "var(--color-chart-4)" : "var(--color-destructive)";

  // Typed label formatter for noImplicitAny
  type LabelFormatter = (value: number | null, entry: any, index: number) => string;
  const labelFormatter: LabelFormatter = (_value, _entry, idx) => {
    const d = data[idx] as ApiItem | undefined;
    if (!d) return "";
    const g = d.gap != null ? (d.gap >= 0 ? `+${round2(d.gap)}` : `${round2(d.gap)}`) : "—";
    return `${g} · n ${d.nYes}/${d.nNo}`;
  };

  return (
    <Card className="md:col-span-4 h-90 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Drivers of Revisit</CardTitle>
          <CardDescription>Avg score difference (Revisit&nbsp;Yes − Revisit&nbsp;No), ranked</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center ">
        {!range ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 50, bottom: 0, left: 8 }}
              aria-label="Ranked drivers by mean difference between revisit=Yes and revisit=No"
            >
              {/* <CartesianGrid horizontal stroke="var(--muted)" /> */}
              <YAxis
                type="category"
                dataKey="key"
                width={100}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => titleizeKey(String(v))}
              />
              <CartesianGrid stroke="var(--chart-cartesian)" />
              <XAxis
                type="number"
                domain={[-maxAbs, maxAbs]}
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => round2(Number(v)).toString()}
              />
              <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <RechartsTooltip wrapperStyle={{ outline: "none" }} content={<DriverTooltip />} />

              <Bar dataKey="gap" name="Gap (Yes − No)" radius={[6, 6, 6, 6]} barSize={24}>
                {data.map((d, i) => (
                  <Cell key={`c-${i}`} fill={colorFor(d.gap)} />
                ))}
                <LabelList
                  dataKey="gap"
                  position="right"
                  className="text-xs fill-current"
                  formatter={labelFormatter}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <p suppressHydrationWarning>{range ? `${range.from} → ${range.to}` : "—"}</p>
      </CardFooter>
    </Card>
  );
}
