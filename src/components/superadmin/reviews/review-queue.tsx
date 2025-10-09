"use client";

/**
 * File: src\components\superadmin\reviews\review-queue.tsx
 * Component: <ReviewQueue/>
 *
 * Super Admin — Review Queue + Diff
 * - Client-only. No fetching. Renders from typed SAMPLE_DATA (≥ 12 rows).
 * - Next.js App Router + TypeScript (strict) + shadcn/ui + Tailwind.
 *
 * Update (UX): Dialog made larger + roomier diff table (wider, taller, better wrapping).
 * - DialogContent: max-w-6xl, w-[98vw], max-h-[88vh]
 * - Diff table: wider columns, monospace for before/after, better spacing, word-count tucked.
 *
 * Export (Updated):
 * - Step 1: Select export range (Last 3 months / Last 30 days / Last 7 days / Follow the Custom Filter)
 * - Step 2: Confirm “Are you sure you want to export data for …?”
 * - “Follow the Custom Filter” exports the full filtered & sorted set (not paged).
 * - Presets filter by `submitted_for_review_at` in Asia/Manila time.
 */

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  Search,
  X,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  CircleSlash2,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

/* =========================================================================
   Types
   ========================================================================= */

type ChangeType =
  | "ADDED_QUESTION"
  | "REMOVED_QUESTION"
  | "PROMPT_CHANGED"
  | "REQUIRED_CHANGED"
  | "OPTION_LABEL_CHANGED"
  | "OPTION_VALUE_CHANGED";

type Severity = "SAFE" | "RISKY" | "BLOCKER";

/** Diff row (shown in the Diff dialog) */
export type DiffRow = {
  change_type: ChangeType;
  question_key: string;
  before: string; // prior Published value(s) — JSON/text snapshot
  after: string; // Draft value(s)
  severity: Severity;
};

/** Queue row (one survey version awaiting decision) */
export type QueueRow = {
  survey_id: number;
  title: string;
  version: number;
  submitted_by_id: number;
  submitted_by_name: string; // resolved name
  submitted_for_review_at: string; // ISO datetime
  changes_count: number; // derived: number of diffs
  diff_link: string; // /super/reviews/{id}/diff
  diffs: DiffRow[]; // embedded for the example
  /** derived, for search convenience */
  diff_keys_joined: string;
};

type ColumnDef<T> = {
  id: keyof T & string;
  header: string;
  accessor: (row: T) => unknown;
  formatter?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  visible?: boolean;
  toggleable?: boolean;
  align?: "left" | "right" | "center";
};

type SortState<T> = { id: keyof T & string; dir: "asc" | "desc" };

type DataTableProps<T extends Record<string, unknown>> = {
  data: T[];
  columns: ColumnDef<T>[];
  defaultSort?: SortState<T>;
  highlightRows?: boolean;
  searchKeys?: (keyof T & string)[];
  renderLinkCell?: (row: T) => React.ReactNode;
};

/** Action receipts (client-only simulation of server-side mutations) */
type ActionType = "PUBLISH_NOW" | "SCHEDULED" | "REJECTED";
type ActionReceipt = {
  survey_id: number;
  action: ActionType;
  status: "PUBLISHED" | "DRAFT";
  published_at?: string; // ISO
  effective_at?: string; // ISO
  note?: string;
};

/* =========================================================================
   Helpers
   ========================================================================= */

const formatDatePH = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const truncate = (text: string, max = 24): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

/** tiny helper to display word counts when needed */
const formatWords = (text: string): string => {
  const words = (text.trim().match(/\S+/g) || []).length;
  return `${words} ${words === 1 ? "word" : "words"}`;
};

const nowISO = (): string => new Date().toISOString();

function EllipsizedWithTooltip({
  text,
  className,
  max = 48,
  side = "top",
}: {
  text: string;
  className?: string;
  max?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text, max)}</span>
        </TooltipTrigger>
        <TooltipContent side={side} align="start" className="max-w-[720px]">
          <p className="break-words whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* =========================================================================
   Column Definitions (Queue)
   ========================================================================= */

const QUEUE_COLUMNS: ColumnDef<QueueRow>[] = [
  {
    id: "survey_id",
    header: "Survey ID",
    accessor: (r) => r.survey_id,
    width: "120px",
    sortable: true,
    visible: true,
  },
  {
    id: "title",
    header: "Title",
    accessor: (r) => r.title,
    formatter: (v) => <EllipsizedWithTooltip text={String(v)} className="max-w-[360px]" />,
    width: "380px",
    sortable: true,
    visible: true,
  },
  {
    id: "version",
    header: "Version",
    accessor: (r) => r.version,
    formatter: (v) => <Badge variant="secondary">v{String(v)}</Badge>,
    width: "100px",
    sortable: true,
    visible: true,
    align: "center",
  },
  {
    id: "submitted_by_name",
    header: "Submitted By",
    accessor: (r) => r.submitted_by_name,
    formatter: (v) => <span className="whitespace-nowrap">{String(v)}</span>,
    width: "200px",
    sortable: true,
    visible: true,
    toggleable: true,
  },
  {
    id: "submitted_for_review_at",
    header: "Submitted (PH)",
    accessor: (r) => r.submitted_for_review_at,
    formatter: (v) => <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>,
    width: "220px",
    sortable: true,
    visible: true,
  },
  {
    id: "changes_count",
    header: "Changes",
    accessor: (r) => r.changes_count,
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "diff_link",
    header: "Diff",
    accessor: (r) => r.diff_link,
    width: "130px",
    sortable: false,
    visible: true,
    toggleable: true,
  },
];

/* =========================================================================
   Generic DataTable (client-side search/sort/paginate/visibility/export)
   ========================================================================= */

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
  renderLinkCell,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);
  const [sort, setSort] = React.useState<SortState<T> | undefined>(defaultSort);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.id, c.visible !== false]))
  );

  // ----- Export (two-step) -----
  const [exportOpen, setExportOpen] = React.useState(false);   // Step 1: preset picker
  const [confirmOpen, setConfirmOpen] = React.useState(false); // Step 2: confirmation
  type ExportPreset = "FOLLOW_FILTER" | "LAST_7" | "LAST_30" | "LAST_90";
  const [exportPreset, setExportPreset] = React.useState<ExportPreset>("FOLLOW_FILTER");
  const PRESET_LABEL: Record<ExportPreset, string> = {
    FOLLOW_FILTER: "Follow the Custom Filter",
    LAST_7: "Last 7 days",
    LAST_30: "Last 30 days",
    LAST_90: "Last 3 months",
  };

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[c.id]),
    [columns, visibility]
  );

  const SEARCH_KEYS: (keyof T & string)[] =
    searchKeys ?? (columns.map((c) => c.id) as (keyof T & string)[]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => {
      const hay = SEARCH_KEYS.map((k) => row[k])
        .map((v) => (v == null ? "" : String(v).toLowerCase()));
      return hay.some((s) => s.includes(q));
    });
  }, [data, query, SEARCH_KEYS]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;

    const toCmp = (val: unknown): number | string => {
      if (val == null) return "";
      if (typeof val === "string" && /\d{4}-\d{2}-\d{2}T/.test(val)) {
        const t = new Date(val).getTime();
        return Number.isNaN(t) ? val : t;
      }
      if (val instanceof Date) return val.getTime();
      if (typeof val === "number") return val;
      const n = Number(val);
      return Number.isNaN(n) ? String(val) : n;
    };

    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = toCmp(col.accessor(a));
      const vb = toCmp(col.accessor(b));
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = sorted.slice(start, end);

  const onHeaderClick = (c: ColumnDef<T>) => {
    if (!c.sortable) return;
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.id !== c.id) return { id: c.id, dir: "desc" };
      return { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  };

  const toggleCol = (id: string) =>
    setVisibility((v) => ({ ...v, [id]: !v[id] }));

  // ----- PH timezone + preset range helpers -----
  function phTodayYMD() {
    const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const y = nowPH.getFullYear();
    const m = String(nowPH.getMonth() + 1).padStart(2, "0");
    const d = String(nowPH.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function phMidnightUTCms(ymd: string) {
    return new Date(`${ymd}T00:00:00+08:00`).getTime();
  }
  function phEndOfDayUTCms(ymd: string) {
    return new Date(`${ymd}T23:59:59.999+08:00`).getTime();
  }
  function rangeForPreset(p: ExportPreset) {
    if (p === "FOLLOW_FILTER") return null;
    const today = phTodayYMD();
    const endMs = phEndOfDayUTCms(today);
    const days = p === "LAST_7" ? 7 : p === "LAST_30" ? 30 : 90;
    const startDate = new Date(new Date(`${today}T00:00:00+08:00`).getTime());
    startDate.setDate(startDate.getDate() - (days - 1)); // inclusive
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const d = String(startDate.getDate()).padStart(2, "0");
    const startYMD = `${y}-${m}-${d}`;
    const startMs = phMidnightUTCms(startYMD);
    return { startMs, endMs };
  }

  // Use the declared column accessor for submitted_for_review_at
  const submittedCol = React.useMemo(
    () => columns.find((c) => c.id === "submitted_for_review_at"),
    [columns]
  );
  function getSubmittedAtMs(row: T): number | null {
    if (!submittedCol) return null;
    const v = submittedCol.accessor(row);
    if (typeof v !== "string") return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }

  // Decide which rows to export
  function rowsForExport(): T[] {
    const r = rangeForPreset(exportPreset);
    if (!r) {
      // Follow the Custom Filter: full filtered + sorted (NOT paged)
      return sorted;
    }
    return sorted.filter((row) => {
      const t = getSubmittedAtMs(row);
      if (t == null) return false;
      return t >= r.startMs && t <= r.endMs;
    });
  }

  // CSV utils
  function buildCSVFor(list: T[]): string {
    const headers = visibleColumns.map((c) => c.header);
    const rows = list.map((row) =>
      visibleColumns.map((c) => {
        const raw = c.accessor(row);
        if (typeof raw === "string" && /\d{4}-\d{2}-\d{2}T/.test(raw)) {
          return formatDatePH(raw);
        }
        return raw == null ? "" : String(raw);
      })
    );
    const csv =
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => {
              const s = String(cell);
              const needsQuotes = /[",\n]/.test(s);
              const escaped = s.replace(/"/g, '""');
              return needsQuotes ? `"${escaped}"` : escaped;
            })
            .join(",")
        )
        .join("\n") + "\n";
    return csv;
  }

  function downloadCSV(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function presetSlug(p: ExportPreset): string {
    switch (p) {
      case "LAST_7": return "last7d";
      case "LAST_30": return "last30d";
      case "LAST_90": return "last3mo";
      default: return "custom";
    }
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search queue"
            placeholder="Search title, admin, key…"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Toggle columns">
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show/Hide</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  className="capitalize"
                  checked={!!visibility[c.id]}
                  onCheckedChange={() => toggleCol(c.id)}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const next = Number(v);
              setPageSize(next);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]" aria-label="Rows per page">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}/page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Step 1: Choose export preset */}
          <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                aria-label="Export rows to CSV"
                className="btn-halo btn-halo--emph"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export review queue</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose the time window. “Follow the Custom Filter” uses the current table filter & sort.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Export range</label>
                <Select value={exportPreset} onValueChange={(v) => setExportPreset(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOLLOW_FILTER">Follow the Custom Filter</SelectItem>
                    <SelectItem value="LAST_7">Last 7 days</SelectItem>
                    <SelectItem value="LAST_30">Last 30 days</SelectItem>
                    <SelectItem value="LAST_90">Last 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <AlertDialogFooter className="mt-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setExportOpen(false);
                    setTimeout(() => setConfirmOpen(true), 10);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Step 2: Confirm export */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm export</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to export data for{" "}
                  <span className="font-medium">{PRESET_LABEL[exportPreset]}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const list = rowsForExport();
                    const csv = buildCSVFor(list);
                    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
                    const slug = presetSlug(exportPreset);
                    downloadCSV(`review-queue-${slug}-${ts}.csv`, csv);
                  }}
                >
                  Yes, export
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {visibleColumns.map((c) => (
                  <TableHead
                    key={c.id}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center"
                    )}
                  >
                    <button
                      onClick={() => onHeaderClick(c)}
                      className={cn(
                        "flex w-full items-center gap-1 text-left",
                        c.align === "right" && "justify-end",
                        c.align === "center" && "justify-center",
                        c.sortable ? "cursor-pointer select-none" : "cursor-default"
                      )}
                      aria-label={`Sort by ${c.header}`}
                    >
                      <span>{c.header}</span>
                      {c.sortable && <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, i) => (
                <TableRow
                  key={i}
                  className={cn(
                    "hover:bg-accent/30 focus-within:bg-accent/30",
                    "odd:bg-muted/30 even:bg-card",
                    highlightRows && "bg-[hsl(var(--chart-1)/0.30)]/10"
                  )}
                >
                  {visibleColumns.map((c) => {
                    const raw = c.accessor(row);
                    const isLink = c.id === "diff_link" && renderLinkCell;
                    const content = isLink ? (
                      renderLinkCell!(row)
                    ) : c.formatter ? (
                      c.formatter(raw, row)
                    ) : (
                      <span
                        className={cn(
                          "block truncate",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center"
                        )}
                        title={raw == null ? "" : String(raw)}
                      >
                        {String(raw ?? "")}
                      </span>
                    );

                    return (
                      <TableCell
                        key={c.id}
                        className={cn(
                          "align-middle py-3",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center"
                        )}
                        style={c.width ? { width: c.width } : undefined}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">
            {total === 0 ? 0 : start + 1}–{end}
          </span>{" "}
          of <span className="font-medium text-foreground">{total}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Diff Dialog (per row) — LARGER + roomier
   ========================================================================= */

function SeverityBadge({ s }: { s: Severity }) {
  const map: Record<Severity, string> = {
    SAFE: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
    RISKY: "bg-amber-600/15 text-amber-700 dark:text-amber-300",
    BLOCKER: "bg-red-600/15 text-red-700 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        map[s]
      )}
    >
      {s}
    </span>
  );
}

function ChangeTypeBadge({ t }: { t: ChangeType }) {
  const label = t.replace(/_/g, " ");
  return <Badge variant="outline" className="uppercase">{label}</Badge>;
}

function DiffTable({ diffs }: { diffs: DiffRow[] }) {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-auto">
        <Table className="table-auto min-w-[980px]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[200px]">Change</TableHead>
              <TableHead className="w-[200px]">Key</TableHead>
              <TableHead className="w-[1px]">Before</TableHead>
              <TableHead className="w-[1px]">After</TableHead>
              <TableHead className="w-[120px] text-center">Severity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diffs.map((d, idx) => (
              <TableRow
                key={`${d.question_key}-${idx}`}
                className={cn("odd:bg-muted/30 even:bg-card")}
              >
                <TableCell className="align-top py-3">
                  <div className="flex items-center gap-2">
                    <ChangeTypeBadge t={d.change_type} />
                  </div>
                </TableCell>
                <TableCell className="align-top py-3">
                  <code className="text-xs">{d.question_key}</code>
                </TableCell>
                <TableCell className="align-top py-3">
                  <div className="space-y-1">
                    <EllipsizedWithTooltip
                      text={d.before}
                      className=" font-mono text-xs leading-relaxed"
                      side="bottom"
                    />
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {formatWords(d.before)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top py-3">
                  <div className="space-y-1">
                    <EllipsizedWithTooltip
                      text={d.after}
                      className="font-mono text-xs leading-relaxed"
                      side="bottom"
                    />
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {formatWords(d.after)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top text-center py-3">
                  <SeverityBadge s={d.severity} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* =========================================================================
   SAMPLE_DATA (≥ 12 rows)
   ========================================================================= */

const SAMPLE_DATA: QueueRow[] = [
  mkRow(1001, "Coffee Crave — Core CX", 4, 21, "Ana Santos", "2025-09-26T05:12:00Z", [
    diff("PROMPT_CHANGED", "staff_service", `{"prompt":"How satisfied are you with our staff?"}`, `{"prompt":"How satisfied were you with the staff's friendliness today?"}`, "RISKY"),
    diff("OPTION_LABEL_CHANGED", "order_accuracy", `["Very Accurate","Accurate","Slightly Off","Wrong"]`, `["Perfect","Good","Okay","Wrong"]`, "RISKY"),
  ]),
  mkRow(1002, "Drinks Quality — Seasonal", 2, 34, "Miguel Reyes", "2025-09-25T14:45:00Z", [
    diff("ADDED_QUESTION", "new_syrup_pref", "—", `{"key":"new_syrup_pref","type":"YES_NO","required":false}`, "SAFE"),
    diff("REQUIRED_CHANGED", "drink_temp", `{"required":false}`, `{"required":true}`, "RISKY"),
  ]),
  mkRow(1003, "Operations — Speed & Cleanliness", 3, 17, "Lara Cruz", "2025-09-25T10:20:00Z", [
    diff("PROMPT_CHANGED", "cleanliness", `{"prompt":"Was the store clean?"}`, `{"prompt":"How clean was the store?"}`, "SAFE"),
  ]),
  mkRow(1004, "Loyalty & Revisit Intent", 5, 11, "Paolo Dizon", "2025-09-24T23:02:00Z", [
    diff("OPTION_VALUE_CHANGED", "revisit_intent", `{"YES":1,"NO":0}`, `{"YES":"Y","NO":"N"}`, "BLOCKER"),
  ]),
  mkRow(1005, "Food Quality — Bakery Items", 2, 28, "Jessa Lim", "2025-09-24T16:18:00Z", [
    diff("OPTION_LABEL_CHANGED", "food_quality", `["Excellent","Good","Fair","Poor"]`, `["Great","Good","Fair","Poor"]`, "SAFE"),
    diff("PROMPT_CHANGED", "food_temp", `{"prompt":"Was your food served hot?"}`, `{"prompt":"Was your food hot/warm enough?"}`, "SAFE"),
  ]),
  mkRow(1006, "Order Flow — Counter vs App", 3, 33, "Noel Tan", "2025-09-24T09:11:00Z", [
    diff("REMOVED_QUESTION", "app_bug_report", `{"type":"TEXT","required":false}`, "—", "SAFE"),
  ]),
  mkRow(1007, "Queue Experience — Lunch Rush", 4, 44, "Isa Manalo", "2025-09-23T21:40:00Z", [
    diff("REQUIRED_CHANGED", "queue_time", `{"required":false}`, `{"required":true}`, "RISKY"),
    diff("PROMPT_CHANGED", "queue_time", `{"prompt":"How long did you wait?"}`, `{"prompt":"How many minutes did you wait in line?"}`, "SAFE"),
  ]),
  mkRow(1008, "Packaging & Sustainability", 1, 25, "Rico Uy", "2025-09-23T13:55:00Z", [
    diff("ADDED_QUESTION", "eco_packaging_optout", "—", `{"key":"eco_packaging_optout","type":"YES_NO","required":false}`, "SAFE"),
  ]),
  mkRow(1009, "Order Accuracy Deep Dive", 6, 52, "Trixie Ong", "2025-09-23T08:03:00Z", [
    diff("OPTION_VALUE_CHANGED", "order_accuracy", `{"Perfect":3,"Good":2,"Okay":1,"Wrong":0}`, `{"Perfect":"3","Good":"2","Okay":"1","Wrong":"0"}`, "BLOCKER"),
  ]),
  mkRow(1010, "Ambience & Music", 2, 39, "Carlo Chua", "2025-09-22T18:20:00Z", [
    diff("PROMPT_CHANGED", "music_volume", `{"prompt":"How's the music volume?"}`, `{"prompt":"Is the music volume comfortable?"}`, "SAFE"),
  ]),
  mkRow(1011, "Drive-thru Experience", 3, 41, "Grace Yu", "2025-09-22T12:27:00Z", [
    diff("REQUIRED_CHANGED", "license_plate", `{"required":false}`, `{"required":true}`, "RISKY"),
    diff("OPTION_LABEL_CHANGED", "staff_greeting", `["Great","Good","Okay","Poor"]`, `["Excellent","Good","Fair","Poor"]`, "SAFE"),
  ]),
  mkRow(1012, "Holiday Menu Readiness", 4, 16, "Benjie Ramos", "2025-09-21T22:49:00Z", [
    diff("ADDED_QUESTION", "preorder_interest", "—", `{"key":"preorder_interest","type":"YES_NO","required":false}`, "SAFE"),
    diff("OPTION_VALUE_CHANGED", "taste_profile", `{"Sweet":4,"Balanced":3,"Bitter":2}`, `{"Sweet":"4","Balanced":"3","Bitter":"2"}`, "BLOCKER"),
  ]),
];

/* helpers to build sample rows */
function mkRow(
  id: number,
  title: string,
  version: number,
  adminId: number,
  adminName: string,
  submittedAtISO: string,
  diffs: DiffRow[]
): QueueRow {
  return {
    survey_id: id,
    title,
    version,
    submitted_by_id: adminId,
    submitted_by_name: adminName,
    submitted_for_review_at: submittedAtISO,
    changes_count: diffs.length,
    diff_link: `/super/reviews/${id}/diff`,
    diffs,
    diff_keys_joined: diffs.map((d) => d.question_key).join(" "),
  };
}
function diff(
  change_type: ChangeType,
  question_key: string,
  before: string,
  after: string,
  severity: Severity
): DiffRow {
  return { change_type, question_key, before, after, severity };
}

/* =========================================================================
   Action Banner (client-only feedback after actions)
   ========================================================================= */

function ActionBanner({ receipt }: { receipt: ActionReceipt | null }) {
  if (!receipt) return null;
  const icon =
    receipt.action === "PUBLISH_NOW" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : receipt.action === "SCHEDULED" ? (
      <Calendar className="h-4 w-4" />
    ) : (
      <CircleSlash2 className="h-4 w-4" />
    );

  const base =
    receipt.action === "REJECTED"
      ? "bg-amber-600/10 text-amber-800 dark:text-amber-200 border-amber-600/30"
      : "bg-emerald-600/10 text-emerald-800 dark:text-emerald-200 border-emerald-600/30";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-3 rounded-md border px-3 py-2 text-sm flex flex-col gap-1",
        base
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">
          Survey {receipt.survey_id} • {receipt.status}
        </span>
      </div>
      {receipt.action !== "REJECTED" ? (
        <div className="pl-6">
          {receipt.action === "PUBLISH_NOW" ? (
            <>
              Published now • Effective now •{" "}
              <span className="font-medium">
                {formatDatePH(receipt.published_at ?? null)}
              </span>
            </>
          ) : (
            <>
              Scheduled publish • Effective at{" "}
              <span className="font-medium">
                {formatDatePH(receipt.effective_at ?? null)}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="pl-6">
          Sent back to <code>DRAFT</code>
          {receipt.note ? (
            <>
              {" "}
              • Note: <span className="italic">{receipt.note}</span>
            </>
          ) : null}
        </div>
      )}
      <div className="pl-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        When <span className="font-medium">Published</span>, the server must freeze{" "}
        <code>questions</code> &amp; <code>question_options</code>.
      </div>
    </div>
  );
}

/* =========================================================================
   Main Card + ReviewQueue component (export default)
   ========================================================================= */

export type ReviewQueueProps = {
  highlightRows?: boolean;
};

export default function ReviewQueue({ highlightRows = true }: ReviewQueueProps) {
  // queue state
  const [rows, setRows] = React.useState<QueueRow[]>(SAMPLE_DATA);

  // last action receipt (for inline banner)
  const [lastAction, setLastAction] = React.useState<ActionReceipt | null>(null);

  // Diff dialog state
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<QueueRow | null>(null);

  const renderLinkCell = (row: QueueRow) => (
    <Button
      variant="link"
      className="p-0 h-auto"
      aria-label={`Open diff for survey ${row.survey_id}`}
      onClick={() => {
        setSelected(row);
        setOpen(true);
      }}
    >
      <ExternalLink className="mr-1.5 h-4 w-4" />
      View Diff
    </Button>
  );

  // queue helper
  const removeFromQueue = (id: number) =>
    setRows((prev) => prev.filter((r) => r.survey_id !== id));

  // ACTIONS (client-only simulation)

  /** Approve → Publish now */
  const approvePublishNow = () => {
    if (!selected) return;
    const ts = nowISO();
    setLastAction({
      survey_id: selected.survey_id,
      action: "PUBLISH_NOW",
      status: "PUBLISHED",
      published_at: ts,
      effective_at: ts,
    });
    removeFromQueue(selected.survey_id);
    setSelected(null);
    setOpen(false);
  };

  /** Approve → Schedule (published_at = effective_at = chosen) */
  const approveSchedule = (effectiveLocalISO: string) => {
    if (!selected) return;
    const effISO = new Date(effectiveLocalISO).toISOString();
    setLastAction({
      survey_id: selected.survey_id,
      action: "SCHEDULED",
      status: "PUBLISHED",
      published_at: effISO,
      effective_at: effISO,
    });
    removeFromQueue(selected.survey_id);
    setSelected(null);
    setOpen(false);
  };

  /** Reject with note → back to DRAFT */
  const rejectToDraft = (note: string) => {
    if (!selected) return;
    setLastAction({
      survey_id: selected.survey_id,
      action: "REJECTED",
      status: "DRAFT",
      note,
    });
    removeFromQueue(selected.survey_id);
    setSelected(null);
    setOpen(false);
  };

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader className="pb-2">
        <CardTitle className="tracking-normal">Review Queue + Diff (Super Admin)</CardTitle>
        <CardDescription>
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Row unit: one <strong className="font-medium">survey version</strong> awaiting decision.
          </span>
          <br />
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Source: <code>surveys</code> (compare Draft vs latest <em>Published</em>); Filter:{" "}
            <code>status = 'PENDING_REVIEW'</code>.
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-4">
        {/* Inline banner that reflects the last action taken */}
        <ActionBanner receipt={lastAction} />

        <DataTable<QueueRow>
          data={rows}
          columns={QUEUE_COLUMNS}
          defaultSort={{ id: "submitted_for_review_at", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={[
            "survey_id",
            "title",
            "submitted_by_name",
            "diff_keys_joined",
            "version",
          ]}
          renderLinkCell={renderLinkCell}
        />
      </CardContent>

      {/* Diff Dialog — bigger */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="max-w-6xl w-[98vw] max-h-[88vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b px-4 py-4">
            <DialogTitle className="text-base sm:text-lg">  
              Compare Draft vs Published
            </DialogTitle>
            <DialogDescription className="text-sm">
              <span className="mr-2">
                Survey <span className="font-medium">{selected?.survey_id ?? "—"}</span> •{" "}
                <span className="font-medium">{selected?.title ?? "—"}</span>
              </span>
              {selected?.version != null && (
                <Badge variant="outline" className="align-middle">v{selected.version}</Badge>
              )}
              <span className="ml-2 text-muted-foreground">
                Submitted {selected ? formatDatePH(selected.submitted_for_review_at) : "—"} by{" "}
                <span className="font-medium">{selected?.submitted_by_name ?? "—"}</span>
              </span>
            </DialogDescription>
            <DialogClose asChild>
              <button
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 focus-visible:outline-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {selected ? (
              <DiffTable diffs={selected.diffs} />
            ) : (
              <div className="text-sm text-muted-foreground">— No selection —</div>
            )}
          </div>

          <div className="border-t px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {/* Reject with note */}
              <RejectWithNoteButton onConfirm={(note) => rejectToDraft(note)} />
              {/* Approve → Schedule */}
              <ScheduleButton onConfirm={(when) => approveSchedule(when)} />
              {/* Approve → Publish now */}
              <Button
                onClick={approvePublishNow}
                className="btn-halo btn-halo--emph"
                aria-label="Approve and publish now"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve → Publish now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* =========================================================================
   Action Dialog Buttons (mock implementations)
   ========================================================================= */

function RejectWithNoteButton({
  onConfirm,
}: {
  onConfirm: (note: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Reject with note"
      >
        <CircleSlash2 className="mr-2 h-4 w-4" />
        Reject with note
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject with note</DialogTitle>
          <DialogDescription>
            Add a short reason. Status will return to <code>DRAFT</code>.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="reject-note" className="text-sm text-muted-foreground">
            Note
          </label>
          <textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            rows={4}
            placeholder="What needs fixing before approval?"
          />
        </div>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              onConfirm(note.trim());
              setOpen(false);
            }}
            className="btn-halo"
            disabled={!note.trim()}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleButton({
  onConfirm,
}: {
  onConfirm: (effectiveLocalISO: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [when, setWhen] = React.useState<string>("");

  React.useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    setWhen(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="default"
        onClick={() => setOpen(true)}
        aria-label="Approve and schedule"
      >
        <Calendar className="mr-2 h-4 w-4" />
        Approve → Schedule
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Publish</DialogTitle>
          <DialogDescription>
            Sets <code>status='PUBLISHED'</code>, with <code>effective_at</code> used as{" "}
            <code>published_at</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="schedule-at" className="text-sm text-muted-foreground">
            Effective at (Asia/Manila)
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            className="rounded-md border bg-background p-2 text-sm"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </div>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => {
              onConfirm(when);
              setOpen(false);
            }}
            className="btn-halo"
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
