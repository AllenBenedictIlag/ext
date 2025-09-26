"use client";

/**
 * File: src\components\admin\dashboard\question-builder.tsx
 * Component: <QuestionsBuilder/>
 *
 * What this does
 * --------------
 * • Renders the Questions Builder table with Admin (Draft) actions.
 * • Loads the **real current questions** from a dedicated API:
 *      GET /api/admin/dashboard/answers-table?limit=500&sort=updated_at&dir=desc
 *   (No URL/localStorage reads, no dashboard events.)
 * • If the active survey is not DRAFT, the UI becomes read-only (locks).
 *
 * Notes for this version
 * ----------------------
 * • **Options column removed** as requested.
 * • Ensures the following columns show real data: **ID**, **Updated (PH)**, **Prompt**, **Help**.
 * • Single sticky header (no duplicate header rows).
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  ShieldCheck,
  ClipboardCheck,
  ShieldAlert,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

/* ============================================================================
 * Types
 * ========================================================================== */

type QuestionType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";

type OptionItem = {
  option_id: number;
  option_value: string; // locked: '1'..'4' (LIKERT) or 'YES'/'NO'
  label: string;
};

export type Row = {
  question_id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  help_text: string | null;
  options: OptionItem[] | null; // kept in type for validation & create, but NOT rendered as a column
  updated_at: string; // ISO
};

type ColumnDef<T> = {
  id: keyof T & string | string;
  header: string | React.ReactNode;
  accessor: (row: T) => unknown;
  formatter?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  visible?: boolean;
  toggleable?: boolean;
  align?: "left" | "right" | "center";
};

type SortState<T> = { id: keyof T & string | string; dir: "asc" | "desc" };

type DataTableProps<T extends Record<string, unknown>> = {
  data: T[];
  columns: ColumnDef<T>[];
  defaultSort?: SortState<T>;
  highlightRows?: boolean;
  searchKeys?: (keyof T & string)[];
};

/* API payload for /api/admin/dashboard/answers-table */
type ApiSurvey = {
  id: number;
  title: string;
  version: number;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
  submitted_by: { id: number; name: string; email: string } | null;
  submitted_for_review_at: string | null;
};
type ApiPayload = {
  survey: ApiSurvey | null;
  data: Row[];
  meta: { total: number; limit: number; offset: number; sort: string; dir: "asc" | "desc" };
};

/* ============================================================================
 * Helpers
 * ========================================================================== */

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

const truncate = (text: string, max = 28): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const formatWords = (text: string | null | undefined): string => {
  if (!text) return "0 words";
  const n = (text.trim().match(/\S+/g) ?? []).length;
  return `${n} word${n === 1 ? "" : "s"}`;
};

const nowISO = (): string => new Date().toISOString();

/* Canonical option sets for Create/Edit (even if we don't render a column) */
const LIKERT_VALUES = ["1", "2", "3", "4"] as const;
const YESNO_VALUES = ["YES", "NO"] as const;

const idFactory = (() => {
  let id = 2000;
  return { next: () => ++id };
})();

const canonicalLikert = (): OptionItem[] => [
  { option_id: idFactory.next(), option_value: "1", label: "Poor" },
  { option_id: idFactory.next(), option_value: "2", label: "Fair" },
  { option_id: idFactory.next(), option_value: "3", label: "Good" },
  { option_id: idFactory.next(), option_value: "4", label: "Excellent" },
];

const canonicalYesNo = (): OptionItem[] => [
  { option_id: idFactory.next(), option_value: "YES", label: "Yes" },
  { option_id: idFactory.next(), option_value: "NO", label: "No" },
];

function canChangeType(
  _currentType: QuestionType,
  nextType: QuestionType,
  options: OptionItem[] | null
): { ok: boolean; reason?: string } {
  const hasOpts = (options?.length ?? 0) > 0;

  if ((nextType === "TEXT" || nextType === "SHORT_TEXT") && hasOpts) {
    return { ok: false, reason: "Text types cannot have options." };
  }
  if (nextType === "LIKERT") {
    const vals = new Set((options ?? []).map((o) => o.option_value));
    for (const v of LIKERT_VALUES) if (!vals.has(v)) {
      return { ok: false, reason: "LIKERT requires fixed values 1–4." };
    }
  }
  if (nextType === "YES_NO") {
    const vals = new Set((options ?? []).map((o) => o.option_value));
    for (const v of YESNO_VALUES) if (!vals.has(v)) {
      return { ok: false, reason: "YES_NO requires YES & NO options." };
    }
  }
  return { ok: true };
}

/* ============================================================================
 * Utility blocks
 * ========================================================================== */

function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K | string
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

function EllipsizedWithTooltip({
  text,
  className,
  subText,
}: {
  text: string;
  className?: string;
  subText?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <div className="max-w-[520px] space-y-1">
            <p className="break-words text-sm">{text}</p>
            {subText ? (
              <p className="text-xs text-muted-foreground">{subText}</p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SkeletonTableLite() {
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

/* ============================================================================
 * Generic DataTable (single header – no duplicates)
 * ========================================================================== */

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
    Object.fromEntries(columns.map((c) => [String(c.id), c.visible !== false]))
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[String(c.id)]),
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
    const headers = visibleColumns.map((c) =>
      typeof c.header === "string" ? c.header : String(c.header)
    );
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
    a.download = `questions-visible-${ts}.csv`;
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
            aria-label="Search questions"
            placeholder="Search question key, prompt, help…"
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
                  key={String(c.id)}
                  className="capitalize"
                  checked={!!visibility[String(c.id)]}
                  onCheckedChange={() => toggleCol(String(c.id))}
                  disabled={c.toggleable === false}
                >
                  {typeof c.header === "string" ? c.header : String(c.header)}
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
                  This will export the currently visible (filtered &amp; sorted) rows to CSV.
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

      {/* Table (single sticky header; no duplicates) */}
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {columns
                  .filter((c) => visibility[String(c.id)])
                  .map((c) => (
                    <TableHead
                      key={String(c.id)}
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
                        aria-label={`Sort by ${typeof c.header === "string" ? c.header : "column"}`}
                      >
                        <span>{typeof c.header === "string" ? c.header : c.header}</span>
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
                    .filter((c) => visibility[String(c.id)])
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
                          key={String(c.id)}
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

/* ============================================================================
 * Questions Builder (exported) — loads real draft questions via API
 * ========================================================================== */

type DraftPhase = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
type ValidationIssue = { level: "error" | "warning"; message: string };

export type QuestionsBuilderProps = {
  highlightRows?: boolean;
};

export default function QuestionsBuilder({
  highlightRows = true,
}: QuestionsBuilderProps) {
  const [phase, setPhase] = React.useState<DraftPhase>("DRAFT");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<boolean>(false);
  const [validationOpen, setValidationOpen] = React.useState(false);
  const [validationIssues, setValidationIssues] = React.useState<ValidationIssue[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [toEdit, setToEdit] = React.useState<Row | null>(null);
  const [submitInfo, setSubmitInfo] = React.useState<{ submitted_by: string; submitted_at: string } | null>(null);

  // ---- Fetch the REAL current questions (no URL/localStorage; no events) ----
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch(
          "/api/admin/dashboard/question-builder?limit=500&sort=updated_at&dir=desc",
          { method: "GET", cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiPayload;
        if (!alive) return;

        setRows(Array.isArray(json.data) ? json.data : []);
        if (json.survey) {
          setPhase(json.survey.status as DraftPhase);
          if (json.survey.submitted_by || json.survey.submitted_for_review_at) {
            setSubmitInfo({
              submitted_by: json.survey.submitted_by
                ? json.survey.submitted_by.name
                : "—",
              submitted_at: json.survey.submitted_for_review_at ?? "",
            });
          }
        } else {
          setPhase("DRAFT");
          setSubmitInfo(null);
        }
      } catch {
        if (alive) {
          setRows([]);
          setError(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ----------------------- Local Admin (Draft) actions ---------------------- */

  const canEdit = true;

  function renumberDisplayOrder(next: Row[]): Row[] {
    return next
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((r, idx) => ({ ...r, display_order: idx + 1, updated_at: nowISO() }));
  }

  function reorderByIndex(idx: number, direction: "up" | "down") {
    const sorted = rows.slice().sort((a, b) => a.display_order - b.display_order);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= sorted.length - 1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    const tmp = sorted[idx].display_order;
    sorted[idx].display_order = sorted[swapWith].display_order;
    sorted[swapWith].display_order = tmp;
    setRows(renumberDisplayOrder(sorted));
  }

  function removeRow(id: number) {
    setRows((prev) => renumberDisplayOrder(prev.filter((r) => r.question_id !== id)));
  }

  function upsertRow(next: Row) {
    setRows((prev) => {
      const exists = prev.some((r) => r.question_id === next.question_id);
      const arr = exists
        ? prev.map((r) => (r.question_id === next.question_id ? next : r))
        : [...prev, next];
      return renumberDisplayOrder(arr);
    });
  }

  function nextQuestionId(): number {
    return rows.length ? Math.max(...rows.map((r) => r.question_id)) + 1 : 1;
  }
  function nextDisplayOrder(): number {
    return rows.length + 1;
  }

  // ---- Validation ----
  function validateDraft(current: Row[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    // Empty prompt
    for (const r of current) {
      if (!r.prompt.trim()) issues.push({ level: "error", message: `Q#${r.question_id} has empty prompt.` });
    }
    // Duplicate question_key
    const seen = new Map<string, number[]>();
    current.forEach((r) => {
      const key = r.question_key.trim().toLowerCase();
      const arr = seen.get(key) ?? [];
      arr.push(r.question_id);
      seen.set(key, arr);
    });
    for (const [k, ids] of seen.entries()) {
      if (ids.length > 1) {
        issues.push({ level: "error", message: `Duplicate question_key "${k}" in IDs ${ids.join(", ")}.` });
      }
    }
    // Options & labels (kept for correctness even if not rendered as a column)
    for (const r of current) {
      if (r.type === "LIKERT") {
        const vals = new Set((r.options ?? []).map((o) => o.option_value));
        for (const v of LIKERT_VALUES) {
          if (!vals.has(v)) issues.push({ level: "error", message: `Q#${r.question_id} LIKERT missing value ${v}.` });
        }
        for (const o of r.options ?? []) {
          if (!(LIKERT_VALUES as readonly string[]).includes(o.option_value)) {
            issues.push({ level: "error", message: `Q#${r.question_id} LIKERT invalid value ${o.option_value}.` });
          }
          if (!o.label.trim()) {
            issues.push({ level: "error", message: `Q#${r.question_id} LIKERT empty label for ${o.option_value}.` });
          }
        }
      }
      if (r.type === "YES_NO") {
        const vals = new Set((r.options ?? []).map((o) => o.option_value));
        for (const v of YESNO_VALUES) {
          if (!vals.has(v)) issues.push({ level: "error", message: `Q#${r.question_id} YES_NO missing value ${v}.` });
        }
        for (const o of r.options ?? []) {
          if (!(YESNO_VALUES as readonly string[]).includes(o.option_value)) {
            issues.push({ level: "error", message: `Q#${r.question_id} YES_NO invalid value ${o.option_value}.` });
          }
          if (!o.label.trim()) {
            issues.push({ level: "error", message: `Q#${r.question_id} YES_NO empty label for ${o.option_value}.` });
          }
        }
      }
      if ((r.type === "TEXT" || r.type === "SHORT_TEXT") && (r.options?.length ?? 0) > 0) {
        issues.push({ level: "error", message: `Q#${r.question_id} ${r.type} must not have options.` });
      }
    }
    // Gaps in display_order
    const orders = current.map((r) => r.display_order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        issues.push({
          level: "error",
          message: `display_order has gaps (expected ${i + 1} at position ${i + 1}).`,
        });
        break;
      }
    }
    return issues;
  }

  function runValidationAndShow() {
    const issues = validateDraft(rows);
    setValidationIssues(issues);
    setValidationOpen(true);
  }

  function handleSubmitForReview() {
    const issues = validateDraft(rows);
    if (issues.length > 0) {
      setValidationIssues(issues);
      setValidationOpen(true);
      return;
    }
    setSubmitInfo({ submitted_by: "admin.local", submitted_at: nowISO() });
    setPhase("PENDING_REVIEW");
  }

  // ---- Create / Edit ----
  type CreateForm = {
    question_key: string;
    prompt: string;
    type: QuestionType;
    required: boolean;
    help_text: string;
  };
  const [createForm, setCreateForm] = React.useState<CreateForm>({
    question_key: "",
    prompt: "",
    type: "LIKERT",
    required: true,
    help_text: "",
  });

  function handleCreate() {
    const key = createForm.question_key.trim();
    if (!key) return;
    if (rows.some((r) => r.question_key.toLowerCase() === key.toLowerCase())) {
      alert("question_key must be unique.");
      return;
    }
    const newRow: Row = {
      question_id: rows.length ? Math.max(...rows.map((r) => r.question_id)) + 1 : 1,
      display_order: rows.length + 1,
      question_key: key,
      prompt: createForm.prompt.trim(),
      type: createForm.type,
      required: createForm.required,
      help_text: createForm.help_text.trim() || null,
      options:
        createForm.type === "LIKERT"
          ? canonicalLikert()
          : createForm.type === "YES_NO"
          ? canonicalYesNo()
          : null,
      updated_at: nowISO(),
    };
    upsertRow(newRow);
    setCreateOpen(false);
    setCreateForm({
      question_key: "",
      prompt: "",
      type: "LIKERT",
      required: true,
      help_text: "",
    });
  }

  type EditForm = {
    prompt: string;
    required: boolean;
    help_text: string;
    type: QuestionType;
    typeError?: string;
  };
  const [editForm, setEditForm] = React.useState<EditForm>({
    prompt: "",
    required: true,
    help_text: "",
    type: "LIKERT",
  });

  function openEdit(row: Row) {
    setToEdit(row);
    setEditForm({
      prompt: row.prompt,
      required: row.required,
      help_text: row.help_text ?? "",
      type: row.type,
    });
    setEditOpen(true);
  }

  function applyEdit() {
    if (!toEdit) return;
    const guard = canChangeType(toEdit.type, editForm.type, toEdit.options);
    if (!guard.ok) {
      setEditForm((f) => ({ ...f, typeError: guard.reason }));
      return;
    }
    const next: Row = {
      ...toEdit,
      prompt: editForm.prompt.trim(),
      required: editForm.required,
      help_text: editForm.help_text.trim() || null,
      type: editForm.type,
      options:
        editForm.type === "LIKERT"
          ? (toEdit.options?.length ?? 0) > 0
            ? toEdit.options
            : canonicalLikert()
          : editForm.type === "YES_NO"
          ? (toEdit.options?.length ?? 0) > 0
            ? toEdit.options
            : canonicalYesNo()
          : null,
      updated_at: nowISO(),
    };
    upsertRow(next);
    setEditOpen(false);
    setToEdit(null);
  }

  // ---- Columns (NO options column) ----
  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    return [
      {
        id: "question_id",
        header: "ID",
        accessor: (r) => r.question_id, // <-- data present
        width: "60px",
        sortable: true,
        visible: true,
        align: "left",
      },
      {
        id: "display_order",
        header: "Order",
        accessor: (r) => r.display_order,
        formatter: (_v, row) => {
          const sorted = rows.slice().sort((a, b) => a.display_order - b.display_order);
          const idx = sorted.findIndex((r) => r.question_id === row.question_id);
          return (
            <div className="inline-flex items-center gap-1 justify-center">
              <span className="font-mono text-sm">{row.display_order}</span>
              <div className="ml-1 flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Move up"
                  onClick={() => reorderByIndex(idx, "up")}
                  className="h-7 px-2"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Move down"
                  onClick={() => reorderByIndex(idx, "down")}
                  className="h-7 px-2"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        },
        width: "180px",
        sortable: true,
        visible: true,
        align: "center",
      },
      {
        id: "question_key",
        header: "Question Key",
        accessor: (r) => r.question_key,
        formatter: (v) => (
          <EllipsizedWithTooltip text={String(v)} className="max-w-[220px]" />
        ),
        width: "220px",
        sortable: true,
        visible: true,
      },
      {
        id: "prompt",
        header: "Prompt",
        accessor: (r) => r.prompt, // <-- data present
        formatter: (v, row) => (
          <EllipsizedWithTooltip
            text={String(v)}
            subText={formatWords(row.prompt)}
            className="max-w-[420px]"
          />
        ),
        width: "420px",
        sortable: true,
        visible: true,
      },
      {
        id: "type",
        header: "Type",
        accessor: (r) => r.type,
        formatter: (v) => (
          <Badge variant="secondary" className="px-2">
            {String(v)}
          </Badge>
        ),
        width: "120px",
        sortable: true,
        visible: true,
        align: "center",
      },
      {
        id: "required",
        header: "Required",
        accessor: (r) => r.required,
        formatter: (v) =>
          Boolean(v) ? (
            <Badge variant="default" className="px-2">
              Yes
            </Badge>
          ) : (
            <Badge variant="outline" className="px-2">
              No
            </Badge>
          ),
        width: "110px",
        sortable: true,
        visible: true,
        align: "center",
      },
      {
        id: "help_text",
        header: "Help",
        accessor: (r) => r.help_text ?? "—", // <-- data present
        formatter: (v) =>
          v && v !== "—" ? (
            <EllipsizedWithTooltip text={String(v)} className="max-w-[280px]" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        width: "280px",
        sortable: true,
        visible: true,
      },
      {
        id: "updated_at",
        header: "Updated (PH)",
        accessor: (r) => r.updated_at, // <-- data present
        formatter: (v) => (
          <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
        ),
        width: "190px",
        sortable: true,
        visible: true,
      },
      {
        id: "actions",
        header: (
          <div className="inline-flex items-center gap-1">
            <span>Actions</span>
          </div>
        ),
        accessor: () => "",
        formatter: (_v, row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label="Edit question"
              onClick={() => openEdit(row)}
              className="h-7 px-2"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label="Delete question"
                  className="h-7 px-2"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove “{row.question_key}” from the Draft.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeRow(row.question_id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ),
        width: "160px",
        sortable: false,
        visible: true,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* ----------------------- UI ----------------------- */

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="tracking-normal">Questions Builder</CardTitle>
            <CardDescription>
              Row unit: one question in the current <span className="font-medium">Draft</span> survey.
              Free-text answers are qualitative only; LIKERT/YES_NO use locked option values.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={phase === "DRAFT" ? "outline" : phase === "PENDING_REVIEW" ? "secondary" : "default"}>
              {phase === "DRAFT" ? "Status: Draft" : phase === "PENDING_REVIEW" ? "Status: Pending Review" : "Status: Published"}
            </Badge>
            {submitInfo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="cursor-default">
                      {formatDatePH(submitInfo.submitted_at)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div>Submitted by: {submitInfo.submitted_by}</div>
                      <div>At: {formatDatePH(submitInfo.submitted_at)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Admin action bar (Draft only) */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Create */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create question</DialogTitle>
                <DialogDescription>Initialize canonical options for LIKERT/YES_NO.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 items-center">
                  <label className="text-sm text-muted-foreground col-span-1">Question key</label>
                  <Input
                    className="col-span-3"
                    value={createForm.question_key}
                    onChange={(e) => setCreateForm((f) => ({ ...f, question_key: e.target.value }))}
                    placeholder="e.g., food_quality_v2"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <label className="text-sm text-muted-foreground col-span-1">Prompt</label>
                  <Input
                    className="col-span-3"
                    value={createForm.prompt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, prompt: e.target.value }))}
                    placeholder="Write the question shown to customers"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <label className="text-sm text-muted-foreground col-span-1">Type</label>
                  <Select
                    value={createForm.type}
                    onValueChange={(v: QuestionType) => setCreateForm((f) => ({ ...f, type: v }))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIKERT">LIKERT (1–4)</SelectItem>
                      <SelectItem value="YES_NO">YES / NO</SelectItem>
                      <SelectItem value="TEXT">TEXT</SelectItem>
                      <SelectItem value="SHORT_TEXT">SHORT_TEXT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <label className="text-sm text-muted-foreground col-span-1">Required</label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Checkbox
                      id="create-required"
                      checked={createForm.required}
                      onCheckedChange={(c) => setCreateForm((f) => ({ ...f, required: Boolean(c) }))}
                    />
                    <label htmlFor="create-required" className="text-sm">Customers must answer</label>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <label className="text-sm text-muted-foreground col-span-1">Help text</label>
                  <Input
                    className="col-span-3"
                    value={createForm.help_text}
                    onChange={(e) => setCreateForm((f) => ({ ...f, help_text: e.target.value }))}
                    placeholder="Optional hint under the prompt"
                  />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Validate Draft */}
          <Button variant="outline" onClick={runValidationAndShow}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Validate Draft
          </Button>

          {/* Submit for review */}
          <Button className="btn-halo btn-halo--emph" onClick={handleSubmitForReview}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Submit for review
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <SkeletonTableLite />
        ) : error ? (
          <div className="text-sm text-destructive">Failed to load questions. Please retry.</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">— No questions —</div>
        ) : (
          <DataTable<Row>
            data={rows}
            columns={columns}
            defaultSort={{ id: "updated_at", dir: "desc" }}
            highlightRows={highlightRows}
            searchKeys={["question_key", "prompt", "help_text"]}
          />
        )}
      </CardContent>

      {/* Validation dialog */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draft validation</DialogTitle>
            <DialogDescription>
              We check duplicate keys, empty prompts, option shapes/labels, and order gaps.
            </DialogDescription>
          </DialogHeader>
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              No issues found. Your draft is ready for review.
            </div>
          ) : (
            <div className="space-y-2">
              {validationIssues.map((it, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "text-sm rounded-md border px-3 py-2",
                    it.level === "error" ? "border-destructive/50 text-destructive" : "border-amber-500/50 text-amber-600"
                  )}
                >
                  <div className="inline-flex items-center gap-2">
                    {it.level === "error" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4" />
                    )}
                    <span>{it.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit question dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit question</DialogTitle>
            <DialogDescription>
              Edit prompt, required, help text. Type change is allowed only if there are no conflicting options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 items-center">
              <label className="text-sm text-muted-foreground col-span-1">Prompt</label>
              <Input
                className="col-span-3"
                value={toEdit?.prompt ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, prompt: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <label className="text-sm text-muted-foreground col-span-1">Type</label>
              <Select
                value={toEdit ? editForm.type : "LIKERT"}
                onValueChange={(v: QuestionType) => {
                  if (!toEdit) return;
                  const guard = canChangeType(toEdit.type, v, toEdit.options);
                  setEditForm((f) => ({ ...f, type: v, typeError: guard.ok ? undefined : guard.reason }));
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIKERT">LIKERT (1–4)</SelectItem>
                  <SelectItem value="YES_NO">YES / NO</SelectItem>
                  <SelectItem value="TEXT">TEXT</SelectItem>
                  <SelectItem value="SHORT_TEXT">SHORT_TEXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* type error */}
            {editForm.typeError && (
              <div className="text-xs text-destructive -mt-2 ml-[25%]">{editForm.typeError}</div>
            )}
            <div className="grid grid-cols-4 gap-2 items-center">
              <label className="text-sm text-muted-foreground col-span-1">Required</label>
              <div className="col-span-3 flex items-center gap-2">
                <Checkbox
                  id="edit-required"
                  checked={editForm.required}
                  onCheckedChange={(c) => setEditForm((f) => ({ ...f, required: Boolean(c) }))}
                />
                <label htmlFor="edit-required" className="text-sm">Customers must answer</label>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 items-center">
              <label className="text-sm text-muted-foreground col-span-1">Help text</label>
              <Input
                className="col-span-3"
                value={editForm.help_text}
                onChange={(e) => setEditForm((f) => ({ ...f, help_text: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                // Sync form -> toEdit snapshot, then apply
                if (toEdit) {
                  setToEdit((r) =>
                    r
                      ? {
                          ...r,
                          prompt: editForm.prompt,
                          required: editForm.required,
                          help_text: editForm.help_text || null,
                          type: editForm.type,
                        }
                      : r
                  );
                }
                applyEdit();
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
