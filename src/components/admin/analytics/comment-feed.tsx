// src\components\admin\dashboard\comment-feed.tsx
"use client";

/**
 * CommentFeed — Full, filterable comment feed table (typed SAMPLE_DATA, client-side)
 * Stack: Next.js App Router (TS) + shadcn/ui + Tailwind
 * - No fetching here. Renders immediately from SAMPLE_DATA (≥ 12 rows).
 * - Sticky header, scrollable body, zebra rows, hover highlight, ellipsis + tooltips.
 * - Controls: Search, Page size (10/25/50/100), Column visibility, Export CSV (with confirm).
 * - Sorting: default date desc; also by receipt_number, question_key, survey_version.
 * - Pagination: client-side.
 * - Optional columns: words, length, has_keywords (toggleable).
 * - Row accent option: highlightRows (default true) → subtle chart-1 tint.
 * - Dates shown in Asia/Manila.
 */

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
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
import { cn } from "@/lib/utils";

/* =========================================================================
   Types
   ========================================================================= */

export type Row = {
  /** submissions.submitted_at (ISO) */
  date: string;
  /** receipts.receipt_number */
  receipt_number: string;
  /** questions.question_key */
  question_key: string;
  /** truncated answers.text_value (full shows in tooltip) */
  preview: string;
  /** surveys.version */
  survey_version: number;
  /** /admin/submissions/{submission_id} */
  link: string;
  /** Extras */
  length?: number; // characters
  words?: number; // word count
  has_keywords?: string[]; // e.g., ["speed","staff"]
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
  ariaLabel?: string;
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

/* =========================================================================
   Helpers (formatting, small utils)
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
    return iso ?? "—";
  }
};

const truncate = (text: string, max = 28): string => (text.length > max ? text.slice(0, max - 1) + "…" : text);

const countWords = (text: string): number => {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
};

const formatWords = (n: number | undefined): string => {
  if (n == null) return "—";
  return `${n} ${n === 1 ? "word" : "words"}`;
};

function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

function EllipsizedWithTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text, 40)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[480px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* =========================================================================
   Column definitions
   ========================================================================= */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "date",
    header: "Date (PH)",
    accessor: (r) => r.date,
    formatter: (v) => <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>,
    width: "180px",
    sortable: true,
    visible: true,
    ariaLabel: "Sort by date",
  },
  {
    id: "receipt_number",
    header: "Receipt #",
    accessor: (r) => r.receipt_number,
    formatter: (v) => <EllipsizedWithTooltip text={String(v)} className="max-w-[180px]" />,
    width: "200px",
    sortable: true,
    visible: true,
    toggleable: true,
    ariaLabel: "Sort by receipt number",
  },
  {
    id: "question_key",
    header: "Question Key",
    accessor: (r) => r.question_key,
    formatter: (v) => (
      <code className="rounded bg-muted/60 px-1 py-0.5 text-xs">{String(v)}</code>
    ),
    width: "180px",
    sortable: true,
    visible: true,
    toggleable: true,
    ariaLabel: "Sort by question key",
  },
  {
    id: "preview",
    header: "Preview",
    accessor: (r) => r.preview,
    formatter: (v) => <EllipsizedWithTooltip text={String(v)} className="max-w-[420px]" />,
    width: "520px",
    sortable: false,
    visible: true,
    toggleable: true,
  },
  {
    id: "survey_version",
    header: "Survey",
    accessor: (r) => r.survey_version,
    formatter: (v) => <Badge variant="secondary">v{String(v)}</Badge>,
    width: "88px",
    sortable: true,
    visible: true,
    align: "center",
    ariaLabel: "Sort by survey version",
  },
  {
    id: "words",
    header: "Words",
    accessor: (r) => r.words ?? countWords(r.preview),
    formatter: (v) => <span className="tabular-nums">{formatWords(Number(v))}</span>,
    width: "110px",
    sortable: true,
    visible: false,
    toggleable: true,
    align: "right",
  },
  {
    id: "length",
    header: "Length",
    accessor: (r) => r.length ?? r.preview.length,
    formatter: (v) => <span className="tabular-nums">{Number(v).toLocaleString()}</span>,
    width: "110px",
    sortable: true,
    visible: false,
    toggleable: true,
    align: "right",
  },
  {
    id: "has_keywords",
    header: "Tags",
    accessor: (r) => (r.has_keywords ?? []).join(", "),
    formatter: (_v, row) =>
      row.has_keywords?.length ? (
        <div className="flex flex-wrap gap-1">
          {row.has_keywords.map((k) => (
            <Badge key={k} variant="outline" className="px-2">
              {k}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    width: "220px",
    sortable: false,
    visible: false,
    toggleable: true,
  },
  {
    id: "link",
    header: "Link",
    accessor: (r) => r.link,
    width: "120px",
    sortable: false,
    visible: true,
    toggleable: true,
  },
];

/* =========================================================================
   Demo data (≥ 12 rows)
   ========================================================================= */

const SAMPLE_DATA: Row[] = [
  {
    date: "2025-09-25T06:10:00+08:00",
    receipt_number: "XQZ-20250925-00018",
    question_key: "comments",
    preview:
      "Loved the cappuccino! Foam was perfect and the barista remembered my name. Music a bit loud near the counter.",
    survey_version: 3,
    link: "/admin/submissions/10018",
    words: 20,
    length: 116,
    has_keywords: ["taste", "staff", "ambience"],
  },
  {
    date: "2025-09-24T19:45:00+08:00",
    receipt_number: "BRW-20250924-00412",
    question_key: "suggestions",
    preview:
      "Please add non-dairy options for whipped cream. Oat milk was great though. Queue moved fast today.",
    survey_version: 3,
    link: "/admin/submissions/10012",
    words: 18,
    length: 107,
    has_keywords: ["menu", "speed"],
  },
  {
    date: "2025-09-24T09:12:00+08:00",
    receipt_number: "CAF-20250924-00077",
    question_key: "staff_service_comment",
    preview:
      "Kim was super friendly and explained the new beans clearly. Helped me pick something fruity.",
    survey_version: 3,
    link: "/admin/submissions/10007",
    words: 17,
    length: 104,
    has_keywords: ["staff"],
  },
  {
    date: "2025-09-23T21:06:00+08:00",
    receipt_number: "SIP-20250923-00231",
    question_key: "food_quality_comment",
    preview: "Croissant was warm and flaky, but the center was a little underbaked.",
    survey_version: 2,
    link: "/admin/submissions/9923",
    words: 14,
    length: 76,
    has_keywords: ["food"],
  },
  {
    date: "2025-09-23T14:38:00+08:00",
    receipt_number: "MUG-20250923-00104",
    question_key: "comments",
    preview:
      "Aircon vents blow directly onto table by the window. We moved to the corner. Coffee was excellent.",
    survey_version: 2,
    link: "/admin/submissions/9912",
    words: 23,
    length: 119,
    has_keywords: ["ambience", "layout", "taste"],
  },
  {
    date: "2025-09-23T08:02:00+08:00",
    receipt_number: "JAV-20250923-00011",
    question_key: "suggestions",
    preview:
      "Mobile signal is spotty at the back. Maybe add Wi-Fi extender? Like the plants, very calming.",
    survey_version: 2,
    link: "/admin/submissions/9905",
    words: 20,
    length: 116,
    has_keywords: ["wifi", "ambience"],
  },
  {
    date: "2025-09-22T20:40:00+08:00",
    receipt_number: "CAF-20250922-00300",
    question_key: "comments",
    preview:
      "My iced latte tasted a bit watery tonight. Might be too much ice. Staff handled my concern well.",
    survey_version: 2,
    link: "/admin/submissions/9877",
    words: 22,
    length: 125,
    has_keywords: ["taste", "staff"],
  },
  {
    date: "2025-09-22T13:27:00+08:00",
    receipt_number: "BRW-20250922-00122",
    question_key: "praise",
    preview:
      "Love the playlist during lunchtime—keeps energy up without being distracting. Keep it up!",
    survey_version: 2,
    link: "/admin/submissions/9861",
    words: 17,
    length: 104,
    has_keywords: ["ambience", "music"],
  },
  {
    date: "2025-09-22T07:55:00+08:00",
    receipt_number: "SIP-20250922-00009",
    question_key: "comments",
    preview:
      "Order accuracy improved a lot versus last week. My name was spelled right too ☺️.",
    survey_version: 2,
    link: "/admin/submissions/9855",
    words: 16,
    length: 92,
    has_keywords: ["accuracy", "staff"],
  },
  {
    date: "2025-09-21T18:33:00+08:00",
    receipt_number: "MUG-20250921-00202",
    question_key: "suggestions",
    preview:
      "Could you consider a smaller cup option for flat white? Current size is a bit heavy for me.",
    survey_version: 1,
    link: "/admin/submissions/9811",
    words: 21,
    length: 110,
    has_keywords: ["menu", "ergonomics"],
  },
  {
    date: "2025-09-21T11:20:00+08:00",
    receipt_number: "JAV-20250921-00066",
    question_key: "comments",
    preview:
      "Tables were clean and condiments stocked. Thank you! Cashier did not see me at first in the side queue.",
    survey_version: 1,
    link: "/admin/submissions/9788",
    words: 23,
    length: 126,
    has_keywords: ["cleanliness", "queue"],
  },
  {
    date: "2025-09-21T07:09:00+08:00",
    receipt_number: "XQZ-20250921-00003",
    question_key: "praise",
    preview:
      "Best espresso in the area. Bright and sweet. Please keep this roast!",
    survey_version: 1,
    link: "/admin/submissions/9777",
    words: 16,
    length: 74,
    has_keywords: ["taste"],
  },
  {
    date: "2025-09-20T20:41:00+08:00",
    receipt_number: "CAF-20250920-00331",
    question_key: "staff_service_comment",
    preview:
      "Team handled a difficult customer with patience. Impressive professionalism from the shift lead.",
    survey_version: 1,
    link: "/admin/submissions/9750",
    words: 18,
    length: 109,
    has_keywords: ["staff"],
  },
  {
    date: "2025-09-20T10:05:00+08:00",
    receipt_number: "BRW-20250920-00088",
    question_key: "food_quality_comment",
    preview:
      "Banana bread is back! Moist and not overly sweet—pairs great with americano.",
    survey_version: 1,
    link: "/admin/submissions/9720",
    words: 16,
    length: 92,
    has_keywords: ["food"],
  },
];

/* =========================================================================
   DataTable (client-side)
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);

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
    setSort((prev) => {
      if (!prev || prev.id !== c.id) return { id: c.id, dir: "desc" };
      return { id: c.id, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  };

  const toggleCol = (id: string) => setVisibility((v) => ({ ...v, [id]: !v[id] }));

  const exportCSV = () => {
    const headers = visibleColumns.map((c) => c.header);
    const rows = pageRows.map((row) =>
      visibleColumns.map((c) => {
        const raw = c.accessor(row);
        if (typeof raw === "string" && /\d{4}-\d{2}-\d{2}T/.test(raw)) return formatDatePH(raw);
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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
    a.href = url;
    a.download = `comment-feed-visible-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[340px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search comments"
            placeholder="Search receipt, question, preview…"
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
                  disabled={c.toggleable === false || c.visible === true && c.toggleable === undefined && (c.id === "date" || c.id === "receipt_number" || c.id === "preview")}
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

          {/* Confirm before CSV export */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                aria-label="Export visible rows to CSV"
                className="btn-halo btn-halo--emph"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export visible rows?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will export the currently visible (filtered &amp; sorted) rows on this page to CSV.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={exportCSV}>Continue</AlertDialogAction>
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
                      aria-label={c.ariaLabel ?? `Sort by ${c.header}`}
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
                    const isLink = c.id === "link" && renderLinkCell;
                    const content = isLink
                      ? renderLinkCell(row)
                      : c.formatter
                        ? c.formatter(raw, row)
                        : (
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

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing{" "}
          <span className="font-medium text-foreground">{total === 0 ? 0 : start + 1}–{end}</span>{" "}
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
   Main exported component
   ========================================================================= */

export type CommentFeedProps = {
  /** When true, applies a subtle chart-1-tinted background to rows. */
  highlightRows?: boolean;
};

export default function CommentFeed({ highlightRows = true }: CommentFeedProps) {
  const renderLinkCell = (row: Row) => (
    <Button variant="link" className="p-0 h-auto" asChild aria-label={`Open ${row.receipt_number}`}>
      <a href={row.link}>Open</a>
    </Button>
  );

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Comment Feed Table</CardTitle>
        <CardDescription>
          Numbers can’t tell the full story—this feed adds the customer’s voice without the chaos of raw text.
          Skim the latest comments, spot patterns, and jump to the related submission with a single click.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <DataTable<Row>
          data={SAMPLE_DATA}
          columns={COLUMNS}
          defaultSort={{ id: "date", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={["receipt_number", "question_key", "preview"]}
          renderLinkCell={renderLinkCell}
        />
      </CardContent>
    </Card>
  );
}
