// src\components\admin\dashboard\answers-table.tsx
"use client";

/**
 * Answers Table (Sample Data)
 * - Production-ready client component for Next.js App Router (TypeScript)
 * - shadcn/ui + Tailwind
 * - No fetching; renders from typed SAMPLE_DATA (>=12 rows)
 * - Sticky header, scroll body, zebra rows, hover highlight, tooltips, search, sort, pagination,
 *   column visibility toggles, page size, and CSV export (with AlertDialog confirmation)
 */

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

/* =========================================================================
   Types
   ========================================================================= */

export type AnswerType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

export type Row = {
  submission_id: number; // answers.submission_id
  question_key: string; // questions.question_key
  type: AnswerType; // questions.question_type
  answer: string; // option label for scaled/yes-no OR text_value for text
  required: boolean; // questions.required
  created_at: string; // answers.created_at (ISO)
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

const truncate = (text: string, max = 28): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const formatWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

/* Small utility to pull raw cell value for searching */
function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

/* Tooltip wrapper for ellipsized text */
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
          <p className="max-w-[520px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* =========================================================================
   Columns
   ========================================================================= */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "submission_id",
    header: "Submission ID",
    accessor: (r) => r.submission_id,
    width: "140px",
    sortable: true,
    visible: true,
    align: "right",
  },
  {
    id: "question_key",
    header: "Question Key",
    accessor: (r) => r.question_key,
    formatter: (v) => (
      <EllipsizedWithTooltip text={String(v)} className="max-w-[200px]" />
    ),
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
      const pretty = val
        .replace("_", " ")
        .toLowerCase()
        .replace(/(^|\s)\S/g, (t) => t.toUpperCase());
      return (
        <Badge variant="secondary" className="px-2">
          {pretty}
        </Badge>
      );
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
    formatter: (v, row) => {
      const text = String(v ?? "");
      const isFreeText = row.type === "TEXT" || row.type === "SHORT_TEXT";
      const words = isFreeText ? formatWords(text) : undefined;
      return (
        <div className="flex items-center gap-2">
          <EllipsizedWithTooltip text={text} className="max-w-[360px]" />
          {isFreeText && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {words} {words === 1 ? "word" : "words"}
            </span>
          )}
        </div>
      );
    },
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
        <Badge className="px-2" variant="outline">
          Required
        </Badge>
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
    header: "Answered At (PH)",
    accessor: (r) => r.created_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "200px",
    sortable: true,
    visible: true,
  },
];

/* =========================================================================
   DataTable (search, sort, pagination, column visibility, export CSV w/ confirm)
   ========================================================================= */

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

  const toggleCol = (id: string) =>
    setVisibility((v) => ({ ...v, [id]: !v[id] }));

  const exportCSV = () => {
    const headers = visibleColumns.map((c) => c.header);
    const rows = pageRows.map((row) =>
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

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
    a.href = url;
    a.download = `answers-visible-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

          {/* Export CSV with confirmation */}
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
                  This will export the currently visible (filtered &amp; sorted) rows on
                  this page to CSV.
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
                  key={`${row.submission_id}-${row.question_key}-${i}`}
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
   SAMPLE_DATA (>= 12 rows, realistic)
   ========================================================================= */

const SAMPLE_DATA: Row[] = [
  {
    submission_id: 12045,
    question_key: "overall_satisfaction",
    type: "LIKERT",
    answer: "4 — Very Satisfied",
    required: true,
    created_at: "2025-09-24T10:22:00.000Z",
  },
  {
    submission_id: 12045,
    question_key: "staff_service",
    type: "LIKERT",
    answer: "3 — Satisfied",
    required: true,
    created_at: "2025-09-24T10:22:10.000Z",
  },
  {
    submission_id: 12045,
    question_key: "order_accuracy",
    type: "YES_NO",
    answer: "Yes",
    required: true,
    created_at: "2025-09-24T10:22:20.000Z",
  },
  {
    submission_id: 12045,
    question_key: "comments",
    type: "TEXT",
    answer:
      "Place was clean and cozy. Barista was friendly, but the queue moved a bit slow during lunch.",
    required: false,
    created_at: "2025-09-24T10:22:35.000Z",
  },
  {
    submission_id: 12044,
    question_key: "overall_satisfaction",
    type: "LIKERT",
    answer: "2 — Unsatisfied",
    required: true,
    created_at: "2025-09-24T09:15:05.000Z",
  },
  {
    submission_id: 12044,
    question_key: "food_quality",
    type: "LIKERT",
    answer: "2 — Unsatisfied",
    required: true,
    created_at: "2025-09-24T09:15:12.000Z",
  },
  {
    submission_id: 12044,
    question_key: "comments",
    type: "SHORT_TEXT",
    answer: "Croissant felt stale today.",
    required: false,
    created_at: "2025-09-24T09:15:25.000Z",
  },
  {
    submission_id: 12043,
    question_key: "overall_satisfaction",
    type: "LIKERT",
    answer: "3 — Satisfied",
    required: true,
    created_at: "2025-09-23T15:42:00.000Z",
  },
  {
    submission_id: 12043,
    question_key: "revisit_intent",
    type: "YES_NO",
    answer: "Yes",
    required: true,
    created_at: "2025-09-23T15:42:10.000Z",
  },
  {
    submission_id: 12043,
    question_key: "comments",
    type: "TEXT",
    answer:
      "Loved the new seasonal latte! Please keep it a bit less sweet if possible.",
    required: false,
    created_at: "2025-09-23T15:42:25.000Z",
  },
  {
    submission_id: 12042,
    question_key: "order_accuracy",
    type: "YES_NO",
    answer: "No",
    required: true,
    created_at: "2025-09-22T07:05:30.000Z",
  },
  {
    submission_id: 12042,
    question_key: "comments",
    type: "TEXT",
    answer:
      "Order came out with whole milk instead of almond milk. Staff remade it quickly, thanks!",
    required: false,
    created_at: "2025-09-22T07:06:05.000Z",
  },
  {
    submission_id: 12041,
    question_key: "food_quality",
    type: "LIKERT",
    answer: "4 — Very Satisfied",
    required: true,
    created_at: "2025-09-21T11:18:45.000Z",
  },
  {
    submission_id: 12041,
    question_key: "comments",
    type: "SHORT_TEXT",
    answer: "Banana bread was perfect.",
    required: false,
    created_at: "2025-09-21T11:19:10.000Z",
  },
  {
    submission_id: 12040,
    question_key: "staff_service",
    type: "LIKERT",
    answer: "4 — Very Satisfied",
    required: true,
    created_at: "2025-09-20T13:33:00.000Z",
  },
  {
    submission_id: 12039,
    question_key: "overall_satisfaction",
    type: "LIKERT",
    answer: "1 — Very Unsatisfied",
    required: true,
    created_at: "2025-09-19T08:02:00.000Z",
  },
];

/* =========================================================================
   Main Card (export default)
   ========================================================================= */

export type AnswersTableCardProps = {
  highlightRows?: boolean; // default true
};

export default function AnswersTableCard({
  highlightRows = true,
}: AnswersTableCardProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Answers Table</CardTitle>
        <CardDescription>
          <span className="block">
            <strong>Why important:</strong> It’s the rawest level of truth — every survey
            answer as captured. Without this, you can’t debug why a metric looks wrong.
          </span>
          <span className="block">
            <strong>Use:</strong> Essential for ad-hoc analysis. If management asks, “What
            exactly are people writing in text boxes about cleanliness?”, this is where
            you find the verbatim responses. It also helps detect bad data (e.g., if
            required answers are blank, you know the system misfired).
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <DataTable<Row>
          data={SAMPLE_DATA}
          columns={COLUMNS}
          defaultSort={{ id: "created_at", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={["submission_id", "question_key", "answer"]}
        />
      </CardContent>
    </Card>
  );
}
