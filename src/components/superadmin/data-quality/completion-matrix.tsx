// src/components/admin/dashboard/completion-matrix.tsx
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
  ZAxis,
  ScatterChart,
  Scatter,
} from "recharts";

/* ---------- API types ---------- */
type ApiQuestion = {
  id: number;
  key: string;
  type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  required: boolean;
  order: number;
};
type ApiSubmission = {
  id: number;
  submitted_at: string;
  label: string; // S01..Sxx
};
type ApiResponse = {
  window: { from: string; to: string };
  questions: ApiQuestion[];
  submissions: ApiSubmission[];
  answeredPairs: Array<[number, number]>;
  stats: {
    totals: { questions: number; submissions: number };
    perQuestion: Array<{ question_id: number; answered: number; total: number; pct: number }>;
  };
};

/* ---------- Helpers ---------- */
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

  // PH last 30 days fallback (inclusive)
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ---------- Custom ticks & tooltip ---------- */
function YTick({
  x, y, payload, questions,
}: {
  x: number; y: number; payload: { value: number };
  questions: ApiQuestion[];
}) {
  const idx = payload.value;
  const q = questions[idx];
  if (!q) return null;
  const dot = q.required ? "●" : "○";
  const fill = q.required ? "var(--chart-1)" : "var(--chart-6)";
  return (
    <g transform={`translate(${x - 6},${y})`}>
      <text
        x={0}
        y={0}
        dy="0.35em"
        textAnchor="end"
        fontSize={12}
        fill="currentColor"
        className="text-muted-foreground"
      >
        {q.key}{" "}
        <tspan fill={fill} fontSize={11}>
          {dot}
        </tspan>
      </text>
    </g>
  );
}

function XTick({
  x, y, payload, labels,
}: {
  x: number; y: number; payload: { value: number };
  labels: string[];
}) {
  const idx1 = payload.value as number; // 1..N
  if (idx1 < 1 || idx1 > labels.length) return null;
  const isMajor = idx1 % 5 === 0 || idx1 === 1;
  if (!isMajor) return null;
  return (
    <g transform={`translate(${x},${y + 8})`}>
      <text x={0} y={0} textAnchor="middle" fontSize={11} fill="currentColor" className="text-muted-foreground">
        {labels[idx1 - 1]}
      </text>
    </g>
  );
}

function HeatTooltip({
  active, payload, questions, labels,
}: {
  active?: boolean;
  payload?: any[];
  questions: ApiQuestion[];
  labels: string[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const q = questions[p.row];
  const status = p.answered ? "Answered" : "Blank";
  const req = q?.required ? "Required" : "Optional";
  const type = q?.type;
  const subLabel = labels[p.col - 1] || `S${String(p.col).padStart(2, "0")}`;

  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-sm text-xs px-3 py-2">
      <div className="font-medium mb-1">Completion</div>
      <div>Submission: <span className="font-mono">{subLabel}</span></div>
      <div>Question: <span className="font-mono">{q?.key}</span></div>
      <div>Type: {type} • {req}</div>
      <div>Status: <span className={p.answered ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>{status}</span></div>
    </div>
  );
}

/* ---------- Component ---------- */
const DEFAULT_RANGE = { from: "", to: "" };

export default function CompletionMatrix() {
  const [range, setRange] = React.useState(DEFAULT_RANGE);
  const [questions, setQuestions] = React.useState<ApiQuestion[] | null>(null);
  const [submissions, setSubmissions] = React.useState<ApiSubmission[] | null>(null);
  const [answeredPairs, setAnsweredPairs] = React.useState<Array<[number, number]> | null>(null);
  const [loading, setLoading] = React.useState(true);

  const CELL_PX = 250;
  const MARGIN = { top: 16, right: 50, bottom: 22, left:20 };
  const LIMIT = 40;

  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/data-quality/completion-matrix?from=${f.from}&to=${f.to}&limit=${LIMIT}&order=asc`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setQuestions(json.questions);
      setSubmissions(json.submissions);
      setAnsweredPairs(json.answeredPairs);
    } catch {
      setQuestions([]);
      setSubmissions([]);
      setAnsweredPairs([]);
    } finally {
      setLoading(false);
    }
  }

  // initial fetch (after hydration to keep SSR/client markup consistent)
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

  const qs = questions ?? [];
  const subs = submissions ?? [];
  const labels = subs.map((s) => s.label);

  // Build a Set for quick answer lookup
  const answeredSet = React.useMemo(() => {
    const s = new Set<string>();
    (answeredPairs ?? []).forEach(([sid, qid]) => s.add(`${sid}:${qid}`));
    return s;
  }, [answeredPairs]);

  // Build the scatter points (rows = question index, cols = 1..N)
  const points = React.useMemo(() => {
    if (!qs.length || !subs.length) return [];
    // map question id -> row index
    const qIndex = new Map<number, number>();
    qs.forEach((q, i) => qIndex.set(q.id, i));
    // map submission id -> column index (1..N)
    const sIndex = new Map<number, number>();
    subs.forEach((s, i) => sIndex.set(s.id, i + 1));

    const out: Array<any> = [];
    for (const q of qs) {
      const row = qIndex.get(q.id)!;
      for (const s of subs) {
        const col = sIndex.get(s.id)!;
        const answered = answeredSet.has(`${s.id}:${q.id}`) ? 1 : 0;
        out.push({
          row,
          col,
          z: CELL_PX,
          answered,
          fill: answered ? "var(--chart-1)" : "var(--chart-6)",
          fillOpacity: answered ? 0.95 : 0.50,
          stroke: "var(--border)",
        });
      }
    }
    return out;
  }, [qs, subs, answeredSet]);

  const xTicks = React.useMemo(() => subs.map((_, i) => i + 1), [subs]);
  const yTicks = React.useMemo(() => qs.map((_, i) => i), [qs]);

  const empty = !loading && (!qs.length || !subs.length);

  return (
    <Card className="md:col-span-6 h-120 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Completion Matrix</CardTitle>
          <CardDescription>Submissions × questions • answered vs blank • required(●) vs optional(○)</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="h-[calc(100%-4rem)] flex items-center">
        {loading ? (
          <div className="w-full h-full animate-pulse rounded-md bg-muted/40" />
        ) : empty ? (
          <div className="w-full text-center text-sm text-muted-foreground">— No data —</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              aria-label="Completion matrix: submissions by questions; squares indicate answered (filled) vs blank (faint)"
              margin={MARGIN}
            >
              <CartesianGrid stroke="hsl(var(--muted) / 0.35)" />
              <XAxis
                type="number"
                dataKey="col"
                domain={[0.5, subs.length + 0.5]}
                ticks={xTicks}
                tickMargin={8}
                tick={<XTick x={0} y={0} payload={{ value: 0 }} labels={labels} />}
                height={28}
              />
              <YAxis
                type="number"
                dataKey="row"
                domain={[-0.5, qs.length - 0.5]}
                ticks={yTicks}
                tickMargin={8}
                interval={0}
                tick={<YTick x={0} y={0} payload={{ value: 0 }} questions={qs} />}
                width={108}
              />

              {/* Keep each square constant pixel size */}
              <ZAxis type="number" dataKey="z" range={[CELL_PX, CELL_PX]} />

              <RechartsTooltip
                content={<HeatTooltip questions={qs} labels={labels} />}
                wrapperStyle={{ outline: "none" }}
              />

              <Scatter
                data={points}
                shape="square"
                isAnimationActive={false}
                name="Completion"
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-1)" }} />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-6)", opacity: "0.50" }} />
          <span>Blank</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Row key: <span className="font-mono">question_key</span> • <span style={{ color: "var(--chart-1)" }}>●</span> Required • ○ Optional</span>
        </div>
        <div className="ml-auto">{footer}</div>
      </CardFooter>
    </Card>
  );
}
