// src/components/admin/dashboard/anomalies-table.tsx
"use client";

/**
 * Anomalies Table (sample-only, client-rendered)
 * - Next.js App Router + shadcn/ui + Tailwind
 * - No fetching here; uses typed SAMPLE_DATA (≥ 12 rows)
 * - Sticky header, zebra rows, hover, tooltips, column toggles, search, sort, pagination
 *
 * Export (Two-step + PDF without Comments):
 *   (1) Range selector: Last 3 months / Last 30 days / Last 7 days / Follow the Custom Filter
 *   (2) Format: CSV file or Printable table (PDF via print)
 *   (3) Confirmation: “Are you sure you want to export … as …?”
 *   - This dataset has no date column, so presets behave like “Follow the Custom Filter”.
 *   - Export covers the full filtered & sorted set (NOT just current page).
 *   - When exporting as Printable (PDF), the “Comments” column is EXCLUDED.
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
  ExternalLink,
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

/* ========= Types ========= */
export type Row = {
  metric: string;
  entity: string;
  current_value: number;
  previous_value: number;
  delta: number;
  delta_pct: number | null;
  n_current: number;
  link_to_comments: string;
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

/* ========= Helpers ========= */
const truncate = (text: string, max = 24): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pp = (v: number) => `${(v * 100).toFixed(1)} pp`;
const signed = (v: number, fmt: (x: number) => string) =>
  `${v >= 0 ? "+" : ""}${fmt(v)}`;
const isPctMetric = (metric: string) =>
  /\.top2_%$/i.test(metric) || /%$/.test(metric);
const isNetMetric = (metric: string) => /\.net_score$/i.test(metric);
const metricKindBadge = (metric: string) => {
  if (isPctMetric(metric)) return "Top-2 %";
  if (isNetMetric(metric)) return "Net score";
  return "Metric";
};
const formatWords = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(n);
};

/* ========= Sample Data (≥ 12) ========= */
const SAMPLE_DATA: Row[] = [
  { metric: "overall.top2_%", entity: "composite", current_value: 0.58, previous_value: 0.73, delta: -0.15, delta_pct: -0.2055, n_current: 312, link_to_comments: "/admin/comments?days=14&q=overall" },
  { metric: "staff_service.top2_%", entity: "q_staff_service", current_value: 0.61, previous_value: 0.76, delta: -0.15, delta_pct: -0.1974, n_current: 305, link_to_comments: "/admin/comments?days=14&q=staff_service" },
  { metric: "food_quality.top2_%", entity: "q_food_quality", current_value: 0.47, previous_value: 0.59, delta: -0.12, delta_pct: -0.2034, n_current: 298, link_to_comments: "/admin/comments?days=14&q=food_quality" },
  { metric: "order_accuracy.top2_%", entity: "q_order_accuracy", current_value: 0.69, previous_value: 0.66, delta: 0.03, delta_pct: 0.0455, n_current: 301, link_to_comments: "/admin/comments?days=14&q=order_accuracy" },
  { metric: "overall.net_score", entity: "composite", current_value: 0.24, previous_value: 0.41, delta: -0.17, delta_pct: -0.4146, n_current: 312, link_to_comments: "/admin/comments?days=14&q=overall" },
  { metric: "staff_service.net_score", entity: "q_staff_service", current_value: 0.21, previous_value: 0.38, delta: -0.17, delta_pct: -0.4474, n_current: 305, link_to_comments: "/admin/comments?days=14&q=staff_service" },
  { metric: "food_quality.net_score", entity: "q_food_quality", current_value: 0.02, previous_value: 0.17, delta: -0.15, delta_pct: -0.8824, n_current: 298, link_to_comments: "/admin/comments?days=14&q=food_quality" },
  { metric: "order_accuracy.net_score", entity: "q_order_accuracy", current_value: 0.34, previous_value: 0.31, delta: 0.03, delta_pct: 0.0968, n_current: 301, link_to_comments: "/admin/comments?days=14&q=order_accuracy" },
  { metric: "revisit_intent.top2_%", entity: "q_revisit_intent", current_value: 0.64, previous_value: 0.74, delta: -0.10, delta_pct: -0.1351, n_current: 312, link_to_comments: "/admin/comments?days=14&q=revisit_intent" },
  { metric: "ambience.top2_%", entity: "q_ambience", current_value: 0.55, previous_value: 0.63, delta: -0.08, delta_pct: -0.1270, n_current: 288, link_to_comments: "/admin/comments?days=14&q=ambience" },
  { metric: "wait_time.top2_%", entity: "q_wait_time", current_value: 0.41, previous_value: 0.52, delta: -0.11, delta_pct: -0.2115, n_current: 276, link_to_comments: "/admin/comments?days=14&q=wait_time" },
  { metric: "value_for_money.top2_%", entity: "q_value", current_value: 0.44, previous_value: 0.49, delta: -0.05, delta_pct: -0.1020, n_current: 280, link_to_comments: "/admin/comments?days=14&q=value" },
];

/* ========= Columns ========= */
const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "metric",
    header: "Metric",
    accessor: (r) => r.metric,
    formatter: (v, row) => (
      <div className="flex items-center gap-2">
        <EllipsizedWithTooltip text={String(v)} className="max-w-[220px]" />
        <Badge variant="outline" className="px-2">{metricKindBadge(row.metric)}</Badge>
      </div>
    ),
    width: "320px",
    sortable: true,
    visible: true,
  },
  {
    id: "entity",
    header: "Entity",
    accessor: (r) => r.entity,
    formatter: (v) =>
      v === "composite" ? (
        <Badge variant="secondary" className="px-2">composite</Badge>
      ) : (
        <code className="rounded bg-muted/60 px-1.5 py-[1px] text-xs">{String(v)}</code>
      ),
    width: "160px",
    sortable: true,
    visible: true,
  },
  {
    id: "current_value",
    header: "Current",
    accessor: (r) => r.current_value,
    formatter: (v, row) => (/\.(top2_%|%$)/.test(row.metric) ? pct(Number(v)) : pp(Number(v))),
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "previous_value",
    header: "Previous",
    accessor: (r) => r.previous_value,
    formatter: (v, row) => (/\.(top2_%|%$)/.test(row.metric) ? pct(Number(v)) : pp(Number(v))),
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "delta",
    header: "Δ (pp)",
    accessor: (r) => r.delta,
    formatter: (v) => signed(Number(v), pp),
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "delta_pct",
    header: "Δ %",
    accessor: (r) => (r.delta_pct == null ? null : r.delta_pct),
    formatter: (v) => (v == null ? "—" : signed(Number(v), pct)),
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
    toggleable: true,
  },
  {
    id: "n_current",
    header: "n (current)",
    accessor: (r) => r.n_current,
    formatter: (v) => formatWords(Number(v)),
    width: "120px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "link_to_comments",
    header: "Comments",
    accessor: (r) => r.link_to_comments,
    formatter: (v) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="link"
              className="px-0 h-auto"
              onClick={() => (window.location.href = String(v))}
              aria-label="Open filtered comments"
            >
              Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            <p className="max-w-[420px] break-words">{String(v)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    width: "140px",
    sortable: false,
    visible: true,
    toggleable: true,
  },
];

/* ========= DataTable (client-side) ========= */
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

  // ----- Export flow (Two-step with PDF that excludes Comments) -----
  const [exportOpen, setExportOpen] = React.useState(false);   // Step 1: choose preset + format
  const [confirmOpen, setConfirmOpen] = React.useState(false); // Step 2: confirm
  type ExportPreset = "FOLLOW_FILTER" | "LAST_7" | "LAST_30" | "LAST_90";
  type ExportFormat = "CSV" | "PRINTABLE";
  const [exportPreset, setExportPreset] = React.useState<ExportPreset>("FOLLOW_FILTER");
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("CSV");
  const PRESET_LABEL: Record<ExportPreset, string> = {
    FOLLOW_FILTER: "Follow the Custom Filter",
    LAST_7: "Last 7 days",
    LAST_30: "Last 30 days",
    LAST_90: "Last 3 months",
  };
  const FORMAT_LABEL: Record<ExportFormat, string> = {
    CSV: "CSV file",
    PRINTABLE: "Printable table (PDF via print)",
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
      if (typeof val === "number") return val;
      if (val instanceof Date) return val.getTime();
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

  const toggleCol = (id: string) =>
    setVisibility((v) => ({ ...v, [id]: !v[id] }));

  // ----- Export helpers -----
  // This dataset has no date column, so presets are informational only.
  function rowsForExport(): T[] {
    return sorted; // full filtered + sorted (NOT paged)
  }

  function buildCSVFor(list: T[]): string {
    const cols = visibleColumns;
    const headers = cols.map((c) => c.header);
    const rows = list.map((row) =>
      cols.map((c) => {
        const raw = c.accessor(row);
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

    // EXCLUDE the Comments column in PRINTABLE:
    const printableColumns = visibleColumns.filter((c) => c.id !== ("link_to_comments" as any));

    const headersHtml = printableColumns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
    const rowsHtml = list.length
      ? list
          .map((row) => {
            const cells = printableColumns
              .map((c) => {
                const raw = c.accessor(row);
                const text = raw == null ? "" : String(raw);
                return `<td>${escapeHtml(text)}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${printableColumns.length}" style="text-align:center;">No rows to export</td></tr>`;

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
      h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 600; }
      .meta { margin: 0 0 16px 0; font-size: 12px; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
      th { background: #f3f4f6; font-weight: 600; }
      @media print {
        body { margin: 12px; }
        h1 { font-size: 18px; }
        table { font-size: 11px; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(docTitle)}</h1>
    <p class="meta">${rangeLine}Generated ${escapeHtml(generatedAt)}</p>
    <table>
      <thead><tr>${headersHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
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
      try { printable.focus(); } catch {}
      try { printable.print(); } catch {}
    };

    const cleanup = () => {
      try { printable.close(); } catch {}
    };

    if (typeof printable.addEventListener === "function") {
      printable.addEventListener("afterprint", cleanup, { once: true });
    }
    setTimeout(cleanup, 60_000);

    if (printable.document.readyState === "complete") {
      setTimeout(triggerPrint, 100);
    } else if (typeof printable.addEventListener === "function") {
      printable.addEventListener("load", () => setTimeout(triggerPrint, 100), { once: true });
    } else {
      setTimeout(triggerPrint, 150);
    }
  }

  // filename/title helpers
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
  function presetSlug(p: ExportPreset): string {
    switch (p) {
      case "LAST_7": return "last7d";
      case "LAST_30": return "last30d";
      case "LAST_90": return "last3mo";
      default: return "custom";
    }
  }
  function slugify(value: string): string {
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "export";
  }

  // quick preview count
  const exportPreviewCount = React.useMemo(() => rowsForExport().length, [sorted, exportPreset]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[320px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search anomalies"
            placeholder="Search metric, entity, link…"
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

          {/* Step 1: Range + Format */}
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
                <AlertDialogTitle>Export anomalies</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose the time window and format. This dataset has no date column, so presets will export the current filtered &amp; sorted rows.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Export range</span>
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

                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{exportPreviewCount}</span>{" "}
                  row{exportPreviewCount === 1 ? "" : "s"} will be exported
                  {exportFormat === "PRINTABLE" ? (
                    <span className="ml-1">
                      • “Comments” column will be <span className="font-medium text-foreground">excluded</span>.
                    </span>
                  ) : null}
                </div>
              </div>

              <AlertDialogFooter className="mt-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setExportOpen(false);
                    setTimeout(() => setConfirmOpen(true), 10);
                  }}
                  disabled={exportPreviewCount === 0}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Step 2: Confirmation */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm export</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to export{" "}
                  <span className="font-medium">{PRESET_LABEL[exportPreset]}</span>{" "}
                  as <span className="font-medium">{FORMAT_LABEL[exportFormat]}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const list = rowsForExport();
                    const nowPH = currentDatePH();
                    const displayDate = formatDisplayDatePH(nowPH);
                    const title = `Anomalies (${PRESET_LABEL[exportPreset]}) ${displayDate}`;

                    if (exportFormat === "CSV") {
                      const csv = buildCSVFor(list);
                      const file = `anomalies-${presetSlug(exportPreset)}-${formatFileDate(nowPH)}.csv`;
                      downloadCSV(file, csv);
                    } else {
                      // PRINTABLE — exclude Comments column
                      openPrintableTable(list, title, PRESET_LABEL[exportPreset]);
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
                {columns
                  .filter((c) => visibility[c.id])
                  .map((c) => (
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
                        onClick={() =>
                          c.sortable &&
                          setSort((prev) => {
                            if (!prev || prev.id !== c.id) return { id: c.id, dir: "desc" };
                            return { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" };
                          })
                        }
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
                  {columns
                    .filter((c) => visibility[c.id])
                    .map((c) => {
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
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{Math.max(1, Math.ceil(total / pageSize))}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))}
            disabled={page === Math.max(1, Math.ceil(total / pageSize))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, Math.ceil(total / pageSize)))}
            disabled={page === Math.max(1, Math.ceil(total / pageSize))}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ========= Utility ========= */
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
}: {
  text: string;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text, 28)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[420px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ========= Exported component ========= */
export type AnomaliesTableProps = { highlightRows?: boolean };
export default function AnomaliesTable({ highlightRows = true }: AnomaliesTableProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Anomalies Table</CardTitle>
        <CardDescription>
          Dashboards show averages, but averages can hide sudden shifts. This table acts like a
          watchdog that surfaces big changes so managers can decide where to investigate.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <DataTable<Row>
          data={SAMPLE_DATA}
          columns={COLUMNS}
          defaultSort={{ id: "delta", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={["metric", "entity", "link_to_comments"]}
        />
      </CardContent>
    </Card>
  );
}
