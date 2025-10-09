"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Download,
  Settings2,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ---------- ADDED: confirm dialog imports for Export ---------- */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/* --------------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------------- */

export type QuestionType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

export type Row = {
  question_key: string;
  type: QuestionType;
  required: boolean;
  answers: number;
  positive_pct: number | null; // % in [0,100], null when N/A (TEXT types)
  negative_pct: number | null; // % in [0,100], null when N/A (TEXT types)
  net_score: number | null; // positive - negative, null when N/A
  top2_pct: number | null; // LIKERT only; null otherwise
  last_30d_delta: number | null; // delta in percentage points vs prior window
  display_order?: number | null;
  prompt?: string | null; // for tooltip/preview
  words?: number | null; // derived from prompt
  survey_version: number; // badge, e.g., v3
  survey_title?: string; // optional metadata
  stat_window_end: string; // ISO string of the active window end (used for default sort)
};

/** Column definition used by the DataTable */
type ColumnDef<T> = {
  id: keyof T | string;
  header: string;
  width?: string;
  accessor: (row: T) => unknown; // raw value used for sorting/export
  formatter?: (value: unknown, row: T) => React.ReactNode; // rendered cell
  sortable?: boolean;
  optional?: boolean; // can be hidden via toggle
  visibleByDefault?: boolean;
};

/* --------------------------------------------------------------------------------
 * Helpers (tiny, inline)
 * -------------------------------------------------------------------------------- */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatDatePH(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max - 1) + "… " : text;
}

function formatPct(n: number | null): string {
  return n === null || Number.isNaN(n) ? "—" : `${n.toFixed(1)}%`;
}

function formatDelta(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toFixed(1)} pp`;
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-PH").format(n);
}

function formatWords(n?: number | null): string {
  if (n == null) return "—";
  return `${n} ${n === 1 ? "word" : "words"}`;
}

function isIsoDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return /\d{4}-\d{2}-\d{2}T/.test(v);
}

/* ---------- Initial range from URL → localStorage → PH last 30d ---------- */
function getInitialRange(): { from: string; to: string } {
  const sp = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
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

  // PH last 30 days
  const nowPH = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  const end = new Date(
    nowPH.getFullYear(),
    nowPH.getMonth(),
    nowPH.getDate(),
    0,
    0,
    0,
    0
  );
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* --------------------------------------------------------------------------------
 * Column Definitions
 * -------------------------------------------------------------------------------- */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "display_order",
    header: "#",
    width: "w-12",
    accessor: (r) => r.display_order ?? Number.MAX_SAFE_INTEGER,
    formatter: (v) =>
      typeof v === "number" && v !== Number.MAX_SAFE_INTEGER ? v : "—",
    sortable: true,
    optional: true,
    visibleByDefault: false,
  },
  {
    id: "question_key",
    header: "Question",
    width: "min-w-[240px]",
    accessor: (r) => r.question_key,
    formatter: (_v, r) => (
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium tracking-normal">
            {r.question_key.replace(/_/g, " ")}
          </div>
          {r.prompt && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground truncate max-w-[420px]">
                    {truncate(r.prompt, 80)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[420px]">
                  <p className="text-xs leading-relaxed">{r.prompt}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="secondary"
            className="border border-border px-1.5 py-0 text-[10px]"
          >
            v{r.survey_version}
          </Badge>
          {r.required ? (
            <Badge className="px-1.5 py-0 text-[10px]">Required</Badge>
          ) : (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              Optional
            </Badge>
          )}
        </div>
      </div>
    ),
    sortable: true,
  },
  {
    id: "type",
    header: "Type",
    width: "w-28",
    accessor: (r) => r.type,
    formatter: (v: unknown) => {
      const t = String(v);
      return (
        <Badge variant="outline" className="px-2 py-0 text-xs">
          {t.replace("_", "/")}
        </Badge>
      );
    },
    sortable: true,
  },
  {
    id: "answers",
    header: "Answers",
    width: "w-24",
    accessor: (r) => r.answers,
    formatter: (v) => (typeof v === "number" ? formatInt(v) : "—"),
    sortable: true,
  },
  {
    id: "positive_pct",
    header: "Positive %",
    width: "w-28",
    accessor: (r) => r.positive_pct,
    formatter: (v) => formatPct(v as number | null),
    sortable: true,
  },
  {
    id: "negative_pct",
    header: "Negative %",
    width: "w-28",
    accessor: (r) => r.negative_pct,
    formatter: (v) => formatPct(v as number | null),
    sortable: true,
  },
  {
    id: "net_score",
    header: "Net",
    width: "w-24",
    accessor: (r) => r.net_score,
    formatter: (v) => formatPct(v as number | null),
    sortable: true,
  },
  {
    id: "top2_pct",
    header: "Top-2 %",
    width: "w-24",
    accessor: (r) => r.top2_pct,
    formatter: (v) => formatPct(v as number | null),
    sortable: true,
  },
  {
    id: "last_30d_delta",
    header: "Δ 30d",
    width: "w-24",
    accessor: (r) => r.last_30d_delta,
    formatter: (v) => formatDelta(v as number | null),
    sortable: true,
  },
  {
    id: "words",
    header: "Words",
    width: "w-24",
    accessor: (r) => r.words ?? 0,
    formatter: (v) => formatWords(typeof v === "number" ? v : undefined),
    sortable: true,
    optional: true,
    visibleByDefault: false,
  },
  {
    id: "prompt",
    header: "Prompt",
    width: "min-w-[320px]",
    accessor: (r) => r.prompt ?? "",
    formatter: (v) =>
      v ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate">{truncate(String(v), 96)}</div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[520px]">
              <p className="text-sm leading-relaxed">{String(v)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        "—"
      ),
    sortable: false,
    optional: true,
    visibleByDefault: false,
  },
  {
    id: "stat_window_end",
    header: "Window End",
    width: "w-[0px]",
    accessor: (r) => r.stat_window_end,
    formatter: (v) => (v ? formatDatePH(String(v)) : "—"),
    sortable: true,
    optional: true,
    visibleByDefault: false,
  },
  {
    id: "survey_version",
    header: "Survey",
    width: "w-24",
    accessor: (r) => r.survey_version,
    formatter: (v) => (typeof v === "number" ? `v${v}` : "—"),
    sortable: true,
    optional: true,
    visibleByDefault: false,
  },
];

/* --------------------------------------------------------------------------------
 * Reusable DataTable (client-side sort, search, paginate, column visibility, CSV)
 * -------------------------------------------------------------------------------- */

type SortDir = "asc" | "desc";
type SortState<T> = { key: ColumnDef<T>["id"]; dir: SortDir };

type DataTableProps<T> = {
  ariaLabel: string;
  rows: T[];
  columns: ColumnDef<T>[];
  defaultVisible?: Record<string, boolean>;
  searchKeys: Array<keyof T>;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  defaultSort?: SortState<T>;
  highlightRows?: boolean;
  csvFileName?: string;
};

function DataTable<T extends object>({
  ariaLabel,
  rows,
  columns,
  defaultVisible,
  searchKeys,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  defaultSort,
  highlightRows = true,
  csvFileName = "export.csv",
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize);
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState<T>>(
    defaultSort ?? { key: columns[0]?.id, dir: "desc" }
  );

  const initialVisibility = React.useMemo(() => {
    const vis: Record<string, boolean> = {};
    for (const c of columns) {
      const def =
        defaultVisible?.[String(c.id)] ??
        (c.visibleByDefault ?? (c.optional ? false : true));
      vis[String(c.id)] = def;
    }
    return vis;
  }, [columns, defaultVisible]);
  const [visible, setVisible] = React.useState<Record<string, boolean>>(
    initialVisibility
  );

  const visibleCols = React.useMemo(
    () => columns.filter((c) => visible[String(c.id)]),
    [columns, visible]
  );

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((r) =>
      searchKeys.some((k) => {
        const v = (r as Record<string, unknown>)[String(k)];
        if (v == null) return false;
        const s = String(v).toLowerCase();
        return s.includes(needle);
      })
    );
  }, [rows, search, searchKeys]);

  const sorted = React.useMemo(() => {
    const col = columns.find((c) => String(c.id) === String(sort.key));
    if (!col) return filtered;

    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);

      const na = va === null || va === undefined ? null : (va as unknown);
      const nb = vb === null || vb === undefined ? null : (vb as unknown);

      if (na === null && nb !== null) return 1;
      if (na !== null && nb === null) return -1;
      if (na === null && nb === null) return 0;

      if (typeof na === "number" && typeof nb === "number") {
        return sort.dir === "asc" ? na - nb : nb - na;
      }

      const da = isIsoDate(na) ? Date.parse(String(na)) : NaN;
      const db = isIsoDate(nb) ? Date.parse(String(nb)) : NaN;
      if (!Number.isNaN(da) && !Number.isNaN(db)) {
        return sort.dir === "asc" ? da - db : db - da;
      }

      const sa = String(na).toLowerCase();
      const sb = String(nb).toLowerCase();
      if (sa < sb) return sort.dir === "asc" ? -1 : 1;
      if (sa > sb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });

    return copy;
  }, [filtered, columns, sort]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = React.useMemo(
    () => sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [sorted, pageSafe, pageSize]
  );

  React.useEffect(() => {
    setPage(1);
  }, [pageSize, search, sort.key, sort.dir]);

  function toggleVisible(id: string) {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
  }

  function onHeaderClick(col: ColumnDef<T>) {
    if (!col.sortable) return;
    setSort((s) =>
      String(s.key) === String(col.id)
        ? { key: col.id, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: col.id, dir: "desc" }
    );
  }

  function exportCSV() {
    const header = visibleCols.map((c) => c.header);
    const rowsOut = sorted.map((r) =>
      visibleCols.map((c) => {
        const raw = c.accessor(r);
        if (typeof raw === "number") return String(raw);
        if (raw === null || raw === undefined) return "";
        return String(raw);
      })
    );

    const lines = [header, ...rowsOut]
      .map((arr) =>
        arr
          .map((cell) => {
            const needsQuotes = /[",\n]/.test(cell);
            const escaped = cell.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- ADDED: local state to control confirm dialog ---------- */
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search questions"
            placeholder="Search question key or prompt…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Toggle columns">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={String(c.id)}
                  checked={visible[String(c.id)]}
                  onCheckedChange={() => toggleVisible(String(c.id))}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page size */}
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="w-[120px]" aria-label="Rows per page">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ---------- ADDED: Confirm before CSV export ---------- */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                aria-label="Export CSV"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export CSV?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will export the <strong>currently visible columns</strong> and <strong>all rows</strong> that match your current search &amp; sort.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={exportCSV}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* ---------- /ADDED ---------- */}
        </div>
      </div>

      {/* Table */}
      <div
        className="relative rounded-md border"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="max-h-[640px] overflow-auto">
          <Table aria-label={ariaLabel}>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
              <TableRow>
                {visibleCols.map((c) => {
                  const isActive = String(sort.key) === String(c.id);
                  return (
                    <TableHead
                      key={String(c.id)}
                      className={cx(
                        "whitespace-nowrap text-medium font-semibold uppercase tracking-wide",
                        c.width
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onHeaderClick(c)}
                        disabled={!c.sortable}
                        aria-sort={
                          c.sortable
                            ? isActive
                              ? sort.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                            : undefined
                        }
                        className={cx(
                          "flex w-full select-none items-center gap-1.5",
                          c.sortable ? "cursor-pointer" : "cursor-default"
                        )}
                        title={c.sortable ? "Sort column" : undefined}
                      >
                        <span>{c.header}</span>
                        {c.sortable &&
                          (isActive ? (
                            sort.dir === "asc" ? (
                              <ArrowUpWideNarrow className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <span className="inline-block h-3.5 w-3.5 opacity-0" />
                          ))}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleCols.length}
                    className="h-24 text-center"
                  >
                    No results
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r, idx) => (
                  <TableRow
                    key={
                      String((r as Record<string, unknown>).question_key) +
                      "-" +
                      idx
                    }
                    className={cx(
                      highlightRows ? "" : idx % 2 === 0 ? "bg-muted/40" : undefined,
                      "hover:bg-accent/30"
                    )}
                    style={
                      highlightRows
                        ? { backgroundColor: "hsl(var(--chart-1) / 0.30)" }
                        : undefined
                    }
                  >
                    {visibleCols.map((c) => {
                      const raw = c.accessor(r);
                      return (
                        <TableCell
                          key={String(c.id)}
                          className={cx("align-top", c.width)}
                        >
                          {c.formatter
                            ? c.formatter(raw, r)
                            : String(raw ?? "—")}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">
            {paged.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1}–
            {Math.min(pageSafe * pageSize, total)}
          </span>{" "}
          of <span className="font-medium text-foreground">{total}</span> rows
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={pageSafe === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe === 1}
          >
            Prev
          </Button>
          <div className="min-w-[90px] text-center">
            Page <span className="font-medium text-foreground">{pageSafe}</span>{" "}
            / <span className="font-medium text-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={pageSafe >= totalPages}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
 * Exported Component (wired to GlobalQuickFilter + API)
 * -------------------------------------------------------------------------------- */

type QuestionsTableProps = {
  /** When true, rows use a subtle brand accent background. Defaults to true. */
  highlightRows?: boolean;
};

/* ---------- API Types ---------- */
type ApiResponse = {
  window: { from: string; to: string };
  survey: { id: number; title: string; version: number } | null;
  rows: Row[];
};

const DEFAULT_RANGE = { from: "", to: "" };

export default function QuestionsTable({
  highlightRows = true,
}: QuestionsTableProps) {
  // 1) Range state
  const [range, setRange] = React.useState<{ from: string; to: string }>(
    DEFAULT_RANGE
  );

  // 2) Data state
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  // 3) Fetcher
  async function fetchData(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/questions/questions-table?from=${f.from}&to=${f.to}`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // 4) Initial fetch (run after hydration so we can touch browser APIs)
  React.useEffect(() => {
    const initial = getInitialRange();
    setRange(initial);
    fetchData(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 5) Subscribe to GlobalQuickFilter
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detail = (e as CustomEvent<{ from: string; to: string }>).detail;
      if (!detail) return;
      setRange(detail);
      fetchData(detail);
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () =>
      window.removeEventListener(
        "dashboard:filters",
        onFilters as EventListener
      );
  }, []);

  const footer = `${range.from} → ${range.to}`;
  const defaultSort: { key: ColumnDef<Row>["id"]; dir: "asc" | "desc" } = {
    key: "stat_window_end",
    dir: "desc",
  };

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card px-4 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl tracking-normal">Active Published Survey</CardTitle>
        {/* <CardDescription className="text-sm">
          It connects the exact wording of each question to its live stats. Use it
          to spot what’s slipping and track if fixes move scores in the next 30 days.
        </CardDescription> */}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div
            className="w-full h-[420px] animate-pulse rounded-md bg-muted/40 px-4"
            aria-label="Loading"
          />
        ) : (rows?.length ?? 0) === 0 ? (
          <div className="w-full h-[120px] grid place-items-center text-sm text-muted-foreground">
            — No data —
          </div>
        ) : (
          <DataTable<Row>
            ariaLabel="Questions table (active published survey)"
            rows={rows ?? []}
            columns={COLUMNS}
            searchKeys={["question_key", "prompt"]}
            pageSizeOptions={[10, 25, 50, 100]}
            defaultPageSize={10}
            defaultSort={defaultSort}
            highlightRows={highlightRows}
            csvFileName="questions-table.csv"
          />
        )}
      </CardContent>

      <CardFooter className="px-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{footer}</span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              Positive = Top-2 (LIKERT) / Yes (YES_NO)
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              Negative = Bottom-2 (LIKERT) / No (YES_NO)
            </span>
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
