"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ---------- Types ---------- */

type RangeKey = "7d" | "30d" | "90d" | "custom";

type Kpi =
  | {
      key:
        | "overall_satisfaction"
        | "order_accuracy"
        | "staff_service"
        | "food_quality";
      title: string;
      value: number | null; // %
      unit: "%";
      delta_pp: number | null; // vs prior, percentage points
    }
  | {
      key: "receipts_issued";
      title: string;
      value: number; // count
      unit: "count";
      delta_pct: number | null; // % change vs prior
    }
  | {
      key: "response_rate";
      title: string;
      value: number | null; // %
      unit: "%";
      delta_pp: number | null; // vs prior, percentage points
    };

type ApiPayload = {
  period: {
    key: RangeKey;
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  kpis: Kpi[];
};

type Props = {
  /** One of "7d" | "30d" | "90d" | "custom" (default "30d") */
  range?: RangeKey;
  /**
   * For range="custom", pass start (inclusive) and end (exclusive).
   * Accepts "YYYY-MM-DD" (date-only) or full ISO strings.
   */
  start?: string;
  end?: string;
};

/* ---------- Local helpers (match GlobalQuickFilter logic) ---------- */

type GlobalFilters = { from: string; to: string; versionId?: string | null };

const DEFAULT_STORAGE_KEY = "dashboard:filters";
const TZ = "Asia/Manila";
const MIN_DATE = new Date(2023, 9, 1); // Oct 1, 2023

function todayInManila(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}
function clampDate(d: Date, min: Date, max: Date) {
  return d < min ? min : d > max ? max : d;
}
function yyyymmdd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function lastNDays(n: number) {
  const to = todayInManila();
  const from = new Date(to);
  from.setDate(from.getDate() - (n - 1));
  return { from: clampDate(from, MIN_DATE, to), to };
}
function last30d() {
  return lastNDays(30);
}
function parseUrlDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function initialFiltersFromUrlOrStorage(sp: URLSearchParams): GlobalFilters {
  const max = todayInManila();

  // URL first
  const uf = parseUrlDate(sp.get("from"));
  const ut = parseUrlDate(sp.get("to"));
  if (uf && ut) {
    const from = clampDate(uf, MIN_DATE, max);
    const to = clampDate(ut, MIN_DATE, max);
    return { from: yyyymmdd(from), to: yyyymmdd(to), versionId: null };
  }

  // localStorage next
  try {
    const saved = localStorage.getItem(DEFAULT_STORAGE_KEY);
    if (saved) {
      const j = JSON.parse(saved) as GlobalFilters;
      const sf = parseUrlDate(j.from);
      const st = parseUrlDate(j.to);
      if (sf && st) {
        const from = clampDate(sf, MIN_DATE, max);
        const to = clampDate(st, MIN_DATE, max);
        return { from: yyyymmdd(from), to: yyyymmdd(to), versionId: null };
      }
    }
  } catch {}

  // fallback: last 30d
  const d = last30d();
  return { from: yyyymmdd(d.from), to: yyyymmdd(d.to), versionId: null };
}

/* ---------- Component ---------- */

export function SectionCards(props: Props) {
  const { range, start, end } = props;

  // Pick data source: explicit props win; otherwise use global filter (URL/event).
  const searchParams = useSearchParams();
  const [globalFilters, setGlobalFilters] = React.useState<GlobalFilters>(() =>
    initialFiltersFromUrlOrStorage(searchParams)
  );

  // Subscribe to GlobalQuickFilter events
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent<GlobalFilters>).detail;
      if (!detail?.from || !detail?.to) return;
      setGlobalFilters({ from: detail.from, to: detail.to, versionId: null });
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, []);

  // Decide the effective query to call the API with
  const effective = React.useMemo(() => {
    if (range && range !== "custom") {
      // If the caller gave a fixed preset, let the API handle it
      return { kind: "preset" as const, range, start: undefined, end: undefined };
    }
    if (range === "custom" && start && end) {
      return { kind: "custom" as const, range: "custom" as RangeKey, start, end };
    }
    // Otherwise, use global filters as custom
    return {
      kind: "custom" as const,
      range: "custom" as RangeKey,
      start: globalFilters.from,
      end: globalFilters.to,
    };
  }, [range, start, end, globalFilters.from, globalFilters.to]);

  const [data, setData] = React.useState<ApiPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Fetch when the effective inputs change
  React.useEffect(() => {
    let url: string;

    if (effective.kind === "preset") {
      url = `/api/admin/dashboard/section-cards?range=${encodeURIComponent(effective.range)}`;
    } else {
      url = `/api/admin/dashboard/section-cards?range=custom&start=${encodeURIComponent(
        effective.start!
      )}&end=${encodeURIComponent(effective.end!)}`;
    }

    let abort = false;
    setLoading(true);
    setError(null);

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const j = await safeJson(res);
          throw new Error(j?.error || j?.detail || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((j: ApiPayload) => {
        if (!abort) setData(j);
      })
      .catch((e: any) => {
        if (!abort) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [effective.kind, effective.range, effective.start, effective.end]);

  // Color tokens per tile, matching your original inline styles
  const colorVars: Record<Kpi["key"], string> = {
    overall_satisfaction: "var(--chart-bittersweet-dark)",
    order_accuracy: "var(--chart-mint-dark)",
    staff_service: "var(--chart-blue-jeans-dark)",
    food_quality: "var(--chart-lavander-dark)",
    receipts_issued: "var(--chart-sunflower-dark)",
    response_rate: "var(--chart-dark-gray-dark)",
  };

  // Order the tiles like your original layout
  const order: Kpi["key"][] = [
    "overall_satisfaction",
    "order_accuracy",
    "staff_service",
    "food_quality",
    "receipts_issued",
    "response_rate",
  ];

  const kpis = React.useMemo(() => {
    if (!data) return null;
    const map = new Map(data.kpis.map((k) => [k.key, k]));
    return order.map((k) => map.get(k)!).filter(Boolean) as Kpi[];
  }, [data]);

  return (
    <div
      className="
      *:data-[slot=card]:from-primary/5
      *:data-[slot=card]:to-card
      dark:*:data-[slot=card]:bg-card
      grid grid-cols-1 gap-4 px-4
      *:data-[slot=card]:shadow-xs
      lg:px-6
      @xl/main:grid-cols-3
      @5xl/main:grid-cols-6
    "
    >
      {loading && <SkeletonRow />}
      {!loading && error && <ErrorRow message={error} />}
      {!loading &&
        !error &&
        kpis?.map((kpi) => {
          const color = colorVars[kpi.key];
          const { title } = kpi;

          // Value string
          const valueStr =
            kpi.unit === "%"
              ? formatMaybePct(kpi.value)
              : formatCount((kpi as Extract<Kpi, { unit: "count" }>).value);

          // Delta string + arrow
          const { deltaLabel, TrendIcon } = (() => {
            if (kpi.key === "receipts_issued") {
              const d = (kpi as Extract<Kpi, { key: "receipts_issued" }>).delta_pct;
              if (d == null) return { deltaLabel: "— vs prior", TrendIcon: null as any };
              return {
                deltaLabel: `${formatSigned(d)}% vs prior`,
                TrendIcon: d >= 0 ? IconTrendingUp : IconTrendingDown,
              };
            } else {
              const d = (kpi as Extract<Kpi, { delta_pp: number | null }>).delta_pp;
              if (d == null) return { deltaLabel: "— vs prior", TrendIcon: null as any };
              return {
                deltaLabel: `${formatSigned(d)}% vs prior`,
                TrendIcon: d >= 0 ? IconTrendingUp : IconTrendingDown,
              };
            }
          })();

          return (
            <Card key={kpi.key} className="@container/card" data-kpi={kpi.key}>
              <CardHeader>
                <CardTitle className="">{title}</CardTitle>
                <CardTitle
                  style={{ color }}
                  className="text-3xl font-semibold tabular-nums @[250px]/card:text-3xl"
                >
                  {valueStr}
                </CardTitle>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <div className="line-clamp-1 flex items-center gap-1 font-medium">
                  {deltaLabel}
                  {TrendIcon ? <TrendIcon className="size-4" /> : null}
                </div>
              </CardFooter>
            </Card>
          );
        })}
    </div>
  );
}

/* ---------- helpers ---------- */

function formatMaybePct(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${round1(n)}%`;
}

function formatCount(n: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return Intl.NumberFormat().format(n);
}

function formatSigned(n: number) {
  const r = round1(n);
  if (r > 0) return `+${r}`;
  if (r < 0) return `${r}`;
  return "0.0";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- tiny UI states (match your card grid) ---------- */

function SkeletonRow() {
  const items = Array.from({ length: 6 });
  return (
    <>
      {items.map((_, i) => (
        <Card
          key={`s-${i}`}
          className="@container/card animate-pulse"
          style={{ color: "var(--muted-foreground)" }}
        >
          <CardHeader>
            <div className="h-4 w-32 rounded bg-muted/60" />
            <div className="mt-2 h-7 w-16 rounded bg-muted/60" />
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="h-4 w-40 rounded bg-muted/60" />
          </CardFooter>
        </Card>
      ))}
    </>
  );
}

function ErrorRow({ message }: { message: string }) {
  const items = Array.from({ length: 6 });
  return (
    <>
      {items.map((_, i) => (
        <Card
          key={`e-${i}`}
          className="@container/card"
          style={{ color: "var(--destructive)" }}
        >
          <CardHeader>
            <CardDescription>Error</CardDescription>
            <CardTitle className="text-lg font-semibold">Failed to load</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm opacity-80">
            {message || "Unknown error"}
          </CardFooter>
        </Card>
      ))}
    </>
  );
}
