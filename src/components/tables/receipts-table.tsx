// src/components/admin/dashboard/receipts-table.tsx
"use client";

/**
 * Receipts Table — wired to a dedicated API (no GlobalQuickFilter, no URL/localStorage).
 * - Production-ready React (Next.js App Router, TypeScript)
 * - shadcn/ui + Tailwind
 * - Sticky header, scrollable body (max-h ~600px), zebra rows, hover highlight
 * - Client controls: search, page size (10/25/50/100), column visibility
 * - Export CSV (two-step): choose range (Last 3 months / Last 30 days / Last 7 days / Follow the Custom Filter) then confirm
 * - Client sorting & pagination (can be swapped to server later using the same API params)
 * - Row accent via `highlightRows` prop (default true)
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
} from "lucide-react";
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

export type Status = "USED" | "EXPIRED_UNUSED" | "NOT_USED";

/** Row shape returned by the API and rendered by the table */
export type Row = {
  receipt_number: string;
  issued_at: string;      // ISO
  expires_at: string;     // ISO
  used_at: string | null; // ISO or null
  status: Status;
  days_to_use: number | null;
  submission_id: number | null;
  age_days: number;
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
  /** Provide a stable key generator to avoid relying on unknown fields inside generics */
  rowKey?: (row: T, index: number) => string | number;
  exportTitle?: string;
  exportExcludeColumns?: (keyof T & string)[];
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

const truncate = (text: string, max = 22): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

/* =========================================================================
   UI atoms
   ========================================================================= */

function EllipsizedWithTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text, 24)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[420px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "USED") return <Badge className="px-2">USED</Badge>;
  if (status === "EXPIRED_UNUSED")
    return (
      <Badge variant="destructive" className="px-2">
        EXPIRED
      </Badge>
    );
  return (
    <Badge variant="secondary" className="px-2">
      NOT USED
    </Badge>
  );
}

/* =========================================================================
   Columns
   ========================================================================= */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "receipt_number",
    header: "Receipt #",
    accessor: (r) => r.receipt_number,
    formatter: (v) => (
      <EllipsizedWithTooltip text={String(v)} className="max-w-[180px]" />
    ),
    width: "200px",
    sortable: true,
    visible: true,
  },
  {
    id: "issued_at",
    header: "Issued",
    accessor: (r) => r.issued_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "190px",
    sortable: true,
    visible: true,
  },
  {
    id: "expires_at",
    header: "Expires",
    accessor: (r) => r.expires_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "190px",
    sortable: true,
    visible: true,
    toggleable: true,
  },
  {
    id: "used_at",
    header: "Used At",
    accessor: (r) => r.used_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{v ? formatDatePH(String(v)) : "—"}</span>
    ),
    width: "190px",
    sortable: true,
    visible: true,
  },
  {
    id: "status",
    header: "Status",
    accessor: (r) => r.status,
    formatter: (v) => <StatusBadge status={String(v) as Status} />,
    width: "130px",
    sortable: true,
    visible: true,
    align: "center",
  },
  {
    id: "days_to_use",
    header: "Days to Use",
    accessor: (r) => r.days_to_use ?? "",
    width: "130px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "right",
  },
  {
    id: "submission_id",
    header: "Submission ID",
    accessor: (r) => r.submission_id ?? "—",
    width: "160px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "right",
  },
  {
    id: "age_days",
    header: "Age (days)",
    accessor: (r) => r.age_days,
    width: "120px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "right",
  },
];

/* =========================================================================
   DataTable (search, sort, column visibility, pagination, export CSV two-step)
   ========================================================================= */

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
  rowKey,
  exportTitle = "Export",
  exportExcludeColumns = [],
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [page, setPage] = React.useState<number>(1);
  const [sort, setSort] = React.useState<SortState<T> | undefined>(defaultSort);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.id, c.visible !== false]))
  );

  // --- Two-step Export state (ADDED) ---
  const [exportOpen, setExportOpen] = React.useState(false);   // Step 1: choose range
  const [confirmOpen, setConfirmOpen] = React.useState(false); // Step 2: confirm
  type ExportPreset = "FOLLOW_FILTER" | "LAST_7" | "LAST_30" | "LAST_90";
  const [exportPreset, setExportPreset] = React.useState<ExportPreset>("FOLLOW_FILTER");
  type ExportFormat = "CSV" | "PRINTABLE";
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("CSV");
  const PRESET_LABEL: Record<ExportPreset, string> = {
    FOLLOW_FILTER: "Follow the Custom Filter",
    LAST_7: "Last 7 days",
    LAST_30: "Last 30 days",
    LAST_90: "Last 3 months",
  };
  const FORMAT_LABEL: Record<ExportFormat, string> = {
    CSV: "CSV file",
    PRINTABLE: "Printable table (PDF via print dialog)",
  };

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[c.id]),
    [columns, visibility]
  );
  const exportExcludeSet = React.useMemo(
    () => new Set(exportExcludeColumns),
    [exportExcludeColumns]
  );
  const exportColumns = React.useMemo(() => {
    const filtered = visibleColumns.filter(
      (c) => !exportExcludeSet.has(c.id as keyof T & string)
    );
    return filtered.length > 0 ? filtered : visibleColumns;
  }, [visibleColumns, exportExcludeSet]);

  const SEARCH_KEYS: (keyof T & string)[] =
    searchKeys ?? (columns.map((c) => c.id) as (keyof T & string)[]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => {
      const fields = SEARCH_KEYS.map((k) =>
        getCell<T, typeof k>(columns, row, k)
      ).map((v) => (v == null ? "" : String(v).toLowerCase()));
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
    setSort((prev) => {
      if (!prev || prev.id !== c.id) return { id: c.id, dir: "desc" };
      return { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  };

  const toggleCol = (id: string) => setVisibility((v) => ({ ...v, [id]: !v[id] }));

  // --- PH timezone + ranges (ADDED) ---
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
    const days = p === "LAST_7" ? 7 : p === "LAST_30" ? 30 : 90; // 3 months ≈ 90 days
    const startDate = new Date(new Date(`${today}T00:00:00+08:00`).getTime());
    startDate.setDate(startDate.getDate() - (days - 1)); // inclusive
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const d = String(startDate.getDate()).padStart(2, "0");
    const startYMD = `${y}-${m}-${d}`;
    const startMs = phMidnightUTCms(startYMD);
    return { startMs, endMs };
  }

  function presetTitleShort(p: ExportPreset): string {
    return p === "FOLLOW_FILTER" ? "Custom" : PRESET_LABEL[p];
  }
  function currentDatePH(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  }
  function formatDisplayDatePH(d: Date): string {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    }).format(d);
  }
  function formatFileDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  function slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "export";
  }

  // Use the column accessor for "issued_at" to avoid hard-coding (ADDED)
  const issuedAtCol = React.useMemo(
    () => columns.find((c) => c.id === "issued_at"),
    [columns]
  );
  function getIssuedAtMs(row: T): number | null {
    if (!issuedAtCol) return null;
    const v = issuedAtCol.accessor(row);
    if (typeof v !== "string") return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }

  // Determine which rows to export (ADDED)
  function rowsForExport(): T[] {
    const r = rangeForPreset(exportPreset);
    if (!r) {
      // Follow the Custom Filter: full filtered + sorted (NOT paged)
      return sorted;
    }
    return sorted.filter((row) => {
      const t = getIssuedAtMs(row);
      if (t == null) return false;
      return t >= r.startMs && t <= r.endMs;
    });
  }

  // Build CSV for any list using visible columns (ADDED)
  function buildCSVFor(list: T[]): string {
    const cols = exportColumns.length ? exportColumns : visibleColumns;
    const headers = cols.map((c) => c.header);
    const rows = list.map((row) =>
      cols.map((c) => {
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

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return match;
      }
    });
  }

  function openPrintableTable(list: T[], docTitle: string, rangeLabel: string) {
    if (typeof window === "undefined") return;
    const cols = exportColumns.length ? exportColumns : visibleColumns;
    const headersHtml = cols.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
    const rowsHtml = list.length
      ? list
          .map((row) => {
            const cells = cols
              .map((c) => {
                const raw = c.accessor(row);
                let text: string;
                if (typeof raw === "string" && /\d{4}-\d{2}-\d{2}T/.test(raw)) {
                  text = formatDatePH(raw);
                } else if (raw == null) {
                  text = "";
                } else {
                  text = String(raw);
                }
                return `<td>${escapeHtml(text)}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${cols.length}" style="text-align:center;">No rows to export</td></tr>`;
    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
    const rangeLine = rangeLabel ? `Range: ${escapeHtml(rangeLabel)}<br />` : "";

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(docTitle)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 24px;
        color: #1f2937;
        background: #fff;
      }
      h1 {
        margin: 0 0 4px 0;
        font-size: 20px;
        font-weight: 600;
      }
      .meta {
        margin: 0 0 16px 0;
        font-size: 12px;
        color: #4b5563;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 8px;
        vertical-align: top;
        text-align: left;
      }
      th {
        background: #f3f4f6;
        font-weight: 600;
      }
      @media print {
        body {
          margin: 12px;
        }
        h1 {
          font-size: 18px;
        }
        table {
          font-size: 11px;
        }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(docTitle)}</h1>
    <p class="meta">${rangeLine}Generated ${escapeHtml(generatedAt)}</p>
    <table>
      <thead>
        <tr>${headersHtml}</tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;

    const printable = window.open("", "_blank");
    if (!printable) {
      console.warn("Unable to open printable export window.");
      return;
    }
    printable.document.open();
    printable.document.write(html);
    printable.document.close();
    printable.document.title = docTitle;

    const triggerPrint = () => {
      try {
        printable.focus();
      } catch {}
      try {
        printable.print();
      } catch {}
    };

    const cleanup = () => {
      try {
        printable.close();
      } catch {}
    };

    if (typeof printable.addEventListener === "function") {
      printable.addEventListener("afterprint", cleanup, { once: true });
    }
    setTimeout(cleanup, 60_000);

    if (printable.document.readyState === "complete") {
      setTimeout(triggerPrint, 100);
    } else if (typeof printable.addEventListener === "function") {
      printable.addEventListener(
        "load",
        () => {
          setTimeout(triggerPrint, 100);
        },
        { once: true }
      );
    } else {
      setTimeout(triggerPrint, 150);
    }
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
        <div className="relative w-full sm:max-w-[320px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search receipts"
            placeholder="Search receipt # or status…"
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
                  onCheckedChange={() => setVisibility((v) => ({ ...v, [c.id]: !v[c.id] }))}
                  disabled={c.toggleable === false}
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

          {/* Step 1: Choose export preset (ADDED) */}
          <AlertDialog
            open={exportOpen}
            onOpenChange={(open) => {
              setExportOpen(open);
              if (!open) setConfirmOpen(false);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                aria-label="Export rows"
                className="btn-halo btn-halo--emph"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export receipts</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose the time window and format to export. "Follow the Custom Filter" uses the current table filter & sort.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Date range</span>
                  <Select value={exportPreset} onValueChange={(v) => setExportPreset(v as ExportPreset)}>
                    <SelectTrigger className="w-full border-2 border-primary/70 hover:border-primary data-[state=open]:border-primary focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-primary/30 shadow-lg">
                      <SelectItem value="FOLLOW_FILTER">Follow the Custom Filter</SelectItem>
                      <SelectItem value="LAST_7">Last 7 days</SelectItem>
                      <SelectItem value="LAST_30">Last 30 days</SelectItem>
                      <SelectItem value="LAST_90">Last 3 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Format</span>
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                    <SelectTrigger className="w-full border-2 border-primary/70 hover:border-primary data-[state=open]:border-primary focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-primary/30 shadow-lg">
                      <SelectItem value="CSV">CSV (.csv)</SelectItem>
                      <SelectItem value="PRINTABLE">Printable table (PDF via print)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  Are you sure you want to export{" "}
                  <span className="font-medium">{PRESET_LABEL[exportPreset]}</span>{" "}
                  as{" "}
                  <span className="font-medium">{FORMAT_LABEL[exportFormat]}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const list = rowsForExport();
                    const nowPH = currentDatePH();
                    const displayDate = formatDisplayDatePH(nowPH);
                    const shortRange = presetTitleShort(exportPreset);
                    const docTitle = `${exportTitle} (${shortRange}) ${displayDate}`;
                    const rangeLabel = PRESET_LABEL[exportPreset];
                    if (exportFormat === "CSV") {
                      const csv = buildCSVFor(list);
                      const fileName = `${slugify(exportTitle)}-${presetSlug(exportPreset)}-${formatFileDate(nowPH)}.csv`;
                      downloadCSV(fileName, csv);
                    } else {
                      openPrintableTable(list, docTitle, rangeLabel);
                    }
                    setConfirmOpen(false);
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
                  key={rowKey ? rowKey(row, start + i) : `${start + i}`}
                  className={cn(
                    "hover:bg-accent/30 focus-within:bg-accent/30",
                    "odd:bg-muted/30 even:bg-card",
                    highlightRows && "bg-[hsl(var(--chart-1)/0.30)]/10"
                  )}
                >
                  {visibleColumns.map((c) => {
                    const raw = c.accessor(row);
                    const content = c.formatter ? (
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
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
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
   Utility
   ========================================================================= */

function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

/* =========================================================================
   Remote fetch wrapper (no URL/localStorage, no events)
   ========================================================================= */

type ApiResponse = {
  data: Row[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    sort: string;
    dir: "asc" | "desc";
    q: string | null;
  };
};

function ReceiptsRemoteData({
  children,
}: {
  children: (rows: Row[], loading: boolean, error: boolean) => React.ReactNode;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(
          "/api/admin/receipts/receipts-table?limit=1000&sort=issued_at&dir=desc",
          { method: "GET", cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResponse;
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
    };
  }, []);

  return <>{children(rows, loading, error)}</>;
}

/* =========================================================================
   Skeleton (loading)
   ========================================================================= */

function SkeletonTable() {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Card wrapper (final export)
   ========================================================================= */

export type ReceiptsTableCardProps = {
  highlightRows?: boolean;
};

export default function ReceiptsTable({
  highlightRows = true,
}: ReceiptsTableCardProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Receipts Table</CardTitle>
        <CardDescription>
          Receipts are the root of your feedback system. Use this to reconcile
          totals: issued, used, and expired unused. If response rates look off,
          check how many receipts were issued and how many expired without use.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <ReceiptsRemoteData>
          {(rows, loading, error) => {
            if (loading) return <SkeletonTable />;
            if (error)
              return (
                <div className="text-sm text-destructive">
                  Failed to load receipts. Please retry.
                </div>
              );
            if (rows.length === 0)
              return (
                <div className="text-sm text-muted-foreground">
                  — No receipts yet —
                </div>
              );

            return (
              <DataTable<Row>
                data={rows}
                columns={COLUMNS}
                defaultSort={{ id: "issued_at", dir: "desc" }}
                highlightRows={highlightRows}
                searchKeys={["receipt_number", "status"]}
                rowKey={(r) => r.receipt_number}
                exportTitle="Receipts"
              />
            );
          }}
        </ReceiptsRemoteData>
      </CardContent>
    </Card>
  );
}




