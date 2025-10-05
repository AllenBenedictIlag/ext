// src\components\admin\dashboard\answers-table.tsx
"use client";

/**
 * Answers Table (Remote Data)
 * - UI unchanged except Export flow:
 *   (1) Choose range: Last 3 months / Last 30 days / Last 7 days / Follow the Custom Filter
 *   (2) Confirm "Are you sure you want to export data for …?"
 * - Fetches from dedicated API: /api/admin/questions/answers-table
 * - No URL/localStorage reads; no filter events
 */

import * as React from "react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableHead, TableHeader, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Columns3, Download, Search,
} from "lucide-react";

/* ---------- Types (same as before) ---------- */
export type AnswerType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

export type Row = {
  submission_id: number;
  question_key: string;
  type: AnswerType;
  answer: string;
  required: boolean;
  created_at: string; // ISO string
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
};

/* ---------- Helpers ---------- */
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

const truncate = (text: string, max = 28): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const formatWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

function EllipsizedWithTooltip({
  text,
  className,
  asBadge,
}: {
  text: string;
  className?: string;
  asBadge?: boolean;
}) {
  const content = asBadge ? (
    <span className={cn("inline-block truncate", className)}>{truncate(text, 18)}</span>
  ) : (
    <span className={cn("block truncate", className)}>{truncate(text, 28)}</span>
  );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w=[520px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------- Columns (unchanged) ---------- */
const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "submission_id",
    header: "Submission ID",
    accessor: (r) => r.submission_id,
    width: "140px",
    sortable: true,
    visible: true,
    align: "left",
  },
  {
    id: "question_key",
    header: "Question Key",
    accessor: (r) => r.question_key,
    // formatter: (v) => (
    //   <EllipsizedWithTooltip text={String(v)} className="max-w-[200px]" />
    // ),
    width: "220px",
    sortable: true,
    visible: true,
  },
  {
    id: "type",
    header: "Type",
    accessor: (r) => r.type,
    formatter: (v) => {
      const val = String(v) as AnswerType;
      const pretty = val.replace("_", " ").toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase());
      return <Badge variant="secondary" className="px-2">{pretty}</Badge>;
    },
    width: "120px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "center",
  },
  {
    id: "answer",
    header: "Answer",
    accessor: (r) => r.answer,
    // formatter: (v, row) => {
    //   const text = String(v ?? "");
    //   const isFreeText = row.type === "TEXT" || row.type === "SHORT_TEXT";
    //   const words = isFreeText ? formatWords(text) : undefined;
    //   return (
    //     <div className="flex items-center gap-2">
    //       <EllipsizedWithTooltip text={text} className="max-w-[360px]" />
    //       {isFreeText && (
    //         <span className="text-xs text-muted-foreground whitespace-nowrap">
    //           {words} {words === 1 ? "word" : "words"}
    //         </span>
    //       )}
    //     </div>
    //   );
    // },
    width: "460px",
    sortable: true,
    visible: true,
  },
  {
    id: "required",
    header: "Required",
    accessor: (r) => (r.required ? "Yes" : "No"),
    formatter: (v, row) =>
      row.required ? (
        <Badge className="px-2" variant="outline">Required</Badge>
      ) : (
        <span className="text-muted-foreground">Optional</span>
      ),
    width: "120px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "center",
  },
  {
    id: "created_at",
    header: "Answered At",
    accessor: (r) => r.created_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "200px",
    sortable: true,
    visible: true,
  },
];

/* ---------- DataTable (two-step export added) ---------- */
function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);
  const [sort, setSort] = React.useState<SortState<T> | undefined>(defaultSort);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.id, c.visible !== false]))
  );

  // Export flow (ADDED)
  const [exportOpen, setExportOpen] = React.useState(false);   // Step 1: choose preset
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
      const fields = SEARCH_KEYS.map((k) => getCell<T, typeof k>(columns, row, k)).map((v) =>
        v == null ? "" : String(v).toLowerCase()
      );
      return fields.some((s) => s.includes(q));
    });
  }, [data, query, columns]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;

    const toComparable = (val: unknown): number | string => {
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

    const clone = [...filtered];
    clone.sort((a, b) => {
      const va = toComparable(col.accessor(a));
      const vb = toComparable(col.accessor(b));
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return clone;
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
    setSort((prev) => (!prev || prev.id !== c.id ? { id: c.id, dir: "desc" } : { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" }));
  };

  const toggleCol = (id: string) => setVisibility((v) => ({ ...v, [id]: !v[id] }));

  // ---------- PH timezone + ranges (ADDED) ----------
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
    const days = p === "LAST_7" ? 7 : p === "LAST_30" ? 30 : 90; // 3 months ≈ 90d
    const startDate = new Date(new Date(`${today}T00:00:00+08:00`).getTime());
    startDate.setDate(startDate.getDate() - (days - 1)); // inclusive
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const d = String(startDate.getDate()).padStart(2, "0");
    const startYMD = `${y}-${m}-${d}`;
    const startMs = phMidnightUTCms(startYMD);
    return { startMs, endMs };
  }

  // Access "created_at" consistently using the column accessor (ADDED)
  const createdAtCol = React.useMemo(
    () => columns.find((c) => c.id === "created_at"),
    [columns]
  );
  function getCreatedAtMs(row: T): number | null {
    if (!createdAtCol) return null;
    const v = createdAtCol.accessor(row);
    if (typeof v !== "string") return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }

  // Determine which rows to export (ADDED)
  function rowsForExport(): T[] {
    const r = rangeForPreset(exportPreset);
    if (!r) {
      // Follow the Custom Filter: use full filtered + sorted (NOT paged)
      return sorted;
    }
    return sorted.filter((row) => {
      const t = getCreatedAtMs(row);
      if (t == null) return false;
      return t >= r.startMs && t <= r.endMs;
    });
  }

  // Build CSV for any list using visible columns (ADDED)
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
        <div className="relative w-full sm:max-w-[360px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search answers"
            placeholder="Search submission, question, answer…"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Column visibility */}
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
                  disabled={c.toggleable === false}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page size */}
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              const next = Number(v);
              setPageSize(next);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[110px]" aria-label="Rows per page">
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

          {/* Step 1: Choose export preset (ADDED) */}
          <AlertDialog open={exportOpen} onOpenChange={setExportOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="default" size="sm" aria-label="Export rows to CSV" className="btn-halo btn-halo--emph">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export answers</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose the time window to export. “Follow the Custom Filter” uses the current table filter & sort.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Export range</label>
                <Select value={exportPreset} onValueChange={(v) => setExportPreset(v as ExportPreset)}>
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

          {/* Step 2: Confirm (ADDED) */}
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
                    downloadCSV(`answers-${slug}-${ts}.csv`, csv);
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
        <div className="max-h-[600px] overflow-auto">
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
                      onClick={() => {
                        if (!c.sortable) return;
                        setPage(1);
                        setSort((prev) =>
                          !prev || prev.id !== c.id
                            ? { id: c.id, dir: "desc" }
                            : { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" }
                        );
                      }}
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
                  key={`${(row as any).submission_id}-${(row as any).question_key}-${i}`}
                  className={cn(
                    "hover:bg-accent/30 focus-within:bg-accent/30",
                    "odd:bg-muted/30 even:bg-card",
                    highlightRows && "bg-[hsl(var(--chart-1)/0.30)]/10"
                  )}
                >
                  {visibleColumns.map((c) => {
                    const raw = c.accessor(row);
                    const content =
                      c.formatter ? (
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
                          "align-middle",
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
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="h-24 text-center text-muted-foreground">
                    — No answers found —
                  </TableCell>
                </TableRow>
              )}
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
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Last page">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Remote fetch wrapper + skeleton ---------- */
function SkeletonTable() {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnswersRemoteData({
  children,
}: {
  children: (rows: Row[], loading: boolean, error: boolean) => React.ReactNode;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<boolean>(false);

  React.useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(
          "/api/admin/answers/answers-table?limit=500&sort=created_at&dir=desc",
          { method: "GET", headers: { accept: "application/json" }, cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: Row[] };
        if (!alive) return;
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  return <>{children(rows, loading, error)}</>;
}

/* ---------- Main exported card (UI unchanged) ---------- */
export type AnswersTableCardProps = { highlightRows?: boolean };

export default function AnswersTable({ highlightRows = true }: AnswersTableCardProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      {/* <CardHeader>
        <CardTitle className="tracking-normal">Answers Table</CardTitle>
        <CardDescription>
          <span className="block">
            <strong>Why important:</strong> It’s the rawest level of truth — every survey answer as captured. Without this, you can’t debug why a metric looks wrong.
          </span>
          <span className="block">
            <strong>Use:</strong> Essential for ad-hoc analysis… and to detect bad data (e.g., required answers blank).
          </span>
        </CardDescription>
      </CardHeader> */}
      <CardContent className="pb-4">
        <AnswersRemoteData>
          {(rows, loading, error) => {
            if (loading) return <SkeletonTable />;
            if (error) return <div className="text-sm text-destructive">Failed to load answers. Please retry.</div>;
            return (
              <DataTable<Row>
                data={rows}
                columns={COLUMNS}
                defaultSort={{ id: "created_at", dir: "desc" }}
                highlightRows={highlightRows}
                searchKeys={["submission_id", "question_key", "answer"]}
              />
            );
          }}
        </AnswersRemoteData>
      </CardContent>
    </Card>
  );
}
