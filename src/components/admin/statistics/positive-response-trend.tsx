"use client";

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "@/components/ui/card";
import {
  ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid,
  XAxis, YAxis, LineChart, Line,
} from "recharts";

/* ---------- Types ---------- */
type QuestionType = "LIKERT" | "YES_NO";
type Bucket = "day" | "week" | "month" | "quarter";
type SeriesPoint = { x: string; positivePct: number; responses: number };
type MiniSeries = { question_key: string; question_type: QuestionType; series: SeriesPoint[] };
type Filters = { from: string; to: string };

const CHART_HEIGHT = 176;
const MTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ---------- Helpers ---------- */
function readFiltersFromUrlOrLocal(): Filters | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && to) return { from, to };
  try {
    const raw = localStorage.getItem("dashboard:filters");
    if (raw) {
      const j = JSON.parse(raw);
      if (j?.from && j?.to) return { from: j.from, to: j.to };
    }
  } catch {}
  return null;
}

// Decide bucket from window (mirrors API)
function pickBucketFromWindow(f: Filters): Bucket {
  const a = new Date(`${f.from}T00:00:00+08:00`);
  const b = new Date(`${f.to}T00:00:00+08:00`);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  if (days <= 7)  return "day";
  if (days <= 45) return "week";
  if (days > 730) return "quarter";
  return "month";
}

// Format x-axis labels (no year on month/quarter)
function fmtX(bucket: Bucket, x: string) {
  if (bucket === "month" || bucket === "quarter") {
    const [, m] = x.split("-");
    return MTH[(Number(m) || 1) - 1] ?? x;
  }
  // day or week: x is YYYY-MM-DD -> "Mon d"
  const [y, m, d0] = x.split("-").map(Number);
  const mon = MTH[(m ?? 1) - 1] ?? "";
  return `${mon} ${d0 ?? 1}`;
}

async function fetchMiniTrend(f: Filters, bucket: Bucket) {
  const u = new URL("/api/admin/statistics/positive-response-trend", window.location.origin);
  u.searchParams.set("from", f.from);
  u.searchParams.set("to", f.to);
  u.searchParams.set("bucket", bucket);
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as {
    period: { from: string; to: string };
    bucket: Bucket;
    series: Array<{ question_key: string; question_type: QuestionType; points: SeriesPoint[] }>;
  };
}

function prettyLabel(key: string) {
  if (!key) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/* ---------- Tooltip ---------- */
function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as { positivePct?: number; responses?: number } | undefined;
  const pct = Math.round(d?.positivePct ?? 0);   // ensure 0 when missing
  const responses = d?.responses ?? 0;           // ensure 0 when missing

  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">
        Positive: <strong className="text-foreground">{pct}%</strong>
      </div>
      <div className="text-muted-foreground">Responses: {responses}</div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function MiniTrendPerQuestion() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<Filters | null>(null);
  const [bucket, setBucket] = React.useState<Bucket>("month");
  const [rows, setRows] = React.useState<MiniSeries[]>([]);

  // initial load
  React.useEffect(() => {
    const f = readFiltersFromUrlOrLocal();
    if (!f) { setLoading(false); setRows([]); return; }
    const b = pickBucketFromWindow(f);
    setPeriod(f);
    setBucket(b);
    setLoading(true);
    fetchMiniTrend(f, b)
      .then((data) => {
        setBucket(data.bucket);
        setRows(
          data.series.map((s) => ({
            question_key: s.question_key,
            question_type: s.question_type,
            series: [...s.points].sort((a, b) => a.x.localeCompare(b.x)),
          }))
        );
        setError(null);
      })
      .catch((e) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  // subscribe to filter changes
  React.useEffect(() => {
    function onFilters(ev: any) {
      const detail = ev?.detail as Filters | undefined;
      if (!detail?.from || !detail?.to) return;
      const b = pickBucketFromWindow(detail);
      setPeriod(detail);
      setBucket(b);
      setLoading(true);
      fetchMiniTrend(detail, b)
        .then((data) => {
          setBucket(data.bucket);
          setRows(
            data.series.map((s) => ({
              question_key: s.question_key,
              question_type: s.question_type,
              series: [...s.points].sort((a, b) => a.x.localeCompare(b.x)),
            }))
          );
          setError(null);
        })
        .catch((e) => setError(e.message || "Failed to load"))
        .finally(() => setLoading(false));
    }
    window.addEventListener("dashboard:filters", onFilters as any);
    return () => window.removeEventListener("dashboard:filters", onFilters as any);
  }, []);

  return (
    <Card className="md:col-span-8 rounded-xl border shadow-sm bg-card px-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Positive Response Trend</CardTitle>
          <CardDescription>
            Small multiples — Positive % by {bucket === "day" ? "day" : bucket === "week" ? "week" : bucket === "month" ? "month" : "quarter"} per question (LIKERT & YES/NO)
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-lg border bg-muted/30" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">— No data —</div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((q) => (
              <div key={q.question_key} className="rounded-lg border bg-background p-3 flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold tracking-normal">
                    {prettyLabel(q.question_key)}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {q.question_type === "LIKERT" ? "Likert" : "Yes/No"}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <LineChart
                    data={q.series.map((p) => ({
                      name: fmtX(bucket, p.x),
                      positivePct: p.positivePct,
                      responses: p.responses,
                    }))}
                    margin={{ top: 6, right: 8, bottom: 4, left: 8 }}
                    aria-label={`Positive % trend for ${q.question_key}`}
                  >
                    <CartesianGrid stroke="rgba(0,0,0,.12)" />
                    <XAxis dataKey="name" tickMargin={6} height={20} tick={{ fontSize: 10 }} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      width={28}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <RechartsTooltip content={<MiniTooltip />} wrapperStyle={{ outline: "none" }} />
                    <Line
                      type="monotone"
                      dataKey="positivePct"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        {period ? `${period.from} → ${period.to}` : "—"}
      </CardFooter>
    </Card>
  );
}
