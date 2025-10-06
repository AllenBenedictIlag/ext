// src/components/admin/dashboard/answer-distribution.tsx
"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid,
  XAxis, YAxis, Legend, Bar, BarChart,
} from "recharts";

/* ---------- Types ---------- */
type QuestionType = "LIKERT" | "YES_NO";
type QuestionDistribution = {
  id: number;
  key: string;      // short code (question_key)
  prompt: string;
  type: QuestionType;
  segments: Record<string, number>; // 0..100 per option
  answered: number;
};
type ApiResponse = {
  period: { from: string; to: string };
  survey: { id: number; title: string; version: number; published_at: string | null } | null;
  questions: QuestionDistribution[];
};

/* ---------- Theme & labels ---------- */
const DEFAULT_LABELS: Record<string, string> = {
  "1": "Extremely Dissatisfied",
  "2": "Dissatisfied",
  "3": "Satisfied",
  "4": "Extremely Satisfied",
  Yes: "Yes",
  No: "No",
};
const DEFAULT_COLORS: Record<string, string> = {
  "1": "var(--chart-2)",  // worst
  "2": "var(--chart-3)",
  "3": "var(--chart-4)",
  "4": "var(--chart-5)",      // best
  No: "var(--chart-1)",
  Yes: "var(--chart-5)",
};

/* ---------- Small utils (URL/localStorage) ---------- */
const STORAGE_KEY = "dashboard:filters";

function readUrlOrStorage(): { from: string; to: string } | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    const uf = sp.get("from");
    const ut = sp.get("to");
    if (uf && ut) return { from: uf, to: ut };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { from?: string; to?: string };
      if (j.from && j.to) return { from: j.from, to: j.to };
    }
  } catch {}
  return null;
}

function computeKeys(rows: QuestionDistribution[]) {
  const set = new Set<string>();
  for (const q of rows) {
    if (q.type === "LIKERT") ["1", "2", "3", "4"].forEach((k) => set.add(k));
    if (q.type === "YES_NO") ["No", "Yes"].forEach((k) => set.add(k));
    Object.keys(q.segments).forEach((k) => set.add(k));
  }
  const likert = ["1", "2", "3", "4"].filter((k) => set.has(k));
  const yesno = ["No", "Yes"].filter((k) => set.has(k));
  const others = [...set].filter((k) => !likert.includes(k) && !yesno.includes(k)).sort();
  return [...likert, ...yesno, ...others];
}

/* ---------- Tooltip (type-aware) ---------- */
function DistTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;

  const p0 = payload[0];
  const row = p0?.payload;
  if (!row) return null;

  const type: QuestionType = row.__type;
  const name: string = row.__key; // show question_key as header

  const validKeys = type === "LIKERT" ? ["1", "2", "3", "4"] : ["No", "Yes"];
  const rows = payload.filter((r) => validKeys.includes(r.dataKey));

  // sort biggest share first
  rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{name}</div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.dataKey} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.fill }} />
            <span className="text-muted-foreground">{r.name}</span>
            <span className="ml-auto tabular-nums">{Math.round(r.value)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function AnswerDistribution({
  cardHeightClass = "h-120",
  height,                // NEW
  cardClassName,         // NEW
  segmentLabels = DEFAULT_LABELS,
  segmentColors = DEFAULT_COLORS,
}: {
  cardHeightClass?: string;
  height?: string;       // NEW: e.g., "h-90"
  cardClassName?: string; // NEW: e.g., "md:col-span-6"
  segmentLabels?: Record<string, string>;
  segmentColors?: Record<string, string>;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<{ from: string; to: string } | null>(null);
  const [rows, setRows] = React.useState<QuestionDistribution[] | null>(null);

  const fetchData = React.useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";
      const res = await fetch(`/api/admin/answers/answer-distribution${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setPeriod(json.period);
      setRows(json.questions ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial read (URL → localStorage → API default)
  React.useEffect(() => {
    const init = readUrlOrStorage();
    if (init) fetchData(init.from, init.to);
    else fetchData(); // API defaults to last 30d
  }, [fetchData]);

  // Subscribe to GlobalQuickFilter events
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent).detail as { from: string; to: string };
      if (detail?.from && detail?.to) fetchData(detail.from, detail.to);
    }
    window.addEventListener("dashboard:filters", onFilters as any);
    return () => window.removeEventListener("dashboard:filters", onFilters as any);
  }, [fetchData]);

  // Build dataset for Recharts (use question_key on X-axis)
  const keys = React.useMemo(() => computeKeys(rows ?? []), [rows]);
  const data = React.useMemo(() => {
    if (!rows?.length) return [];
    return rows.map((q) => {
      const base: Record<string, number | string> = {
        name: q.key,     // ← compact axis label
        __key: q.key,    // for tooltip header
        __type: q.type,  // for tooltip filtering
      };
      for (const k of keys) base[k] = Number(q.segments?.[k] ?? 0);
      return base;
    });
  }, [rows, keys]);

  // Prefer `height` when provided; otherwise use `cardHeightClass`
  const resolvedHeight = height ?? cardHeightClass;

  return (
    <Card className={`md:col-span-5 ${resolvedHeight} rounded-xl border shadow-sm bg-card ${cardClassName ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between ">
        <div>
          <CardTitle>Answer Distribution</CardTitle>
          <CardDescription>Distribution of Likert answers (1–4) or Yes/No</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            aria-label="Answer distribution per question (100% stacked)"
            margin={{ top: 8, right: 52, bottom: 4, left: 32 }}
          >
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tickMargin={6}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              height={28}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 11, fill: "var(--foreground)" }}
              width={36}
              tickFormatter={(v) => `${v}%`}
            />
            <RechartsTooltip content={<DistTooltip />} wrapperStyle={{ outline: "none" }} />
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

            {keys.map((k) => (
              <Bar
                key={k}
                stackId="dist"
                dataKey={k}
                name={segmentLabels[k] ?? k}
                fill={segmentColors[k] ?? "var(--muted-foreground)"}
                isAnimationActive={!loading}
                radius={[0, 0, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        {loading && "Loading…"}
        {!loading && error && "—"}
        {!loading && !error && (period?.from && period?.to ? `${period.from} → ${period.to}` : "—")}
      </CardFooter>
    </Card>
  );
}
