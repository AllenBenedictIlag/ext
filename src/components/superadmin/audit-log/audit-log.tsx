"use client";

import * as React from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Columns3, Download, Search,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/* ---------- Types ---------- */
export type AuditAction =
  | "SIGN_IN"
  | "DRAFT_EDIT"
  | "SUBMIT_FOR_REVIEW"
  | "PUBLISH"
  | "ARCHIVE"
  | "ROLE_CHANGE"
  | "EXPORT";

export type Row = {
  time: string;              // ISO
  actor: string;
  action: AuditAction;
  target: string;
  notes: string;
  ip?: string | null;
  user_agent?: string | null;
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
    return iso ?? "—";
  }
};

const truncate = (text: string, max = 24): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const formatWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const ACTION_LABEL: Record<AuditAction, string> = {
  SIGN_IN: "Sign In",
  DRAFT_EDIT: "Draft Edit",
  SUBMIT_FOR_REVIEW: "Submit for Review",
  PUBLISH: "Publish",
  ARCHIVE: "Archive",
  ROLE_CHANGE: "Role Change",
  EXPORT: "Export",
};

function actionBadge(a: AuditAction) {
  const variantClass =
    a === "EXPORT" ? "bg-muted text-foreground"
    : a === "ARCHIVE" ? "bg-[hsl(var(--destructive)/.12)] text-destructive"
    : a === "PUBLISH" ? "bg-[hsl(var(--chart-4)/.25)] text-foreground"
    : a === "SUBMIT_FOR_REVIEW" ? "bg-[hsl(var(--chart-2)/.25)] text-foreground"
    : a === "DRAFT_EDIT" ? "bg-[hsl(var(--chart-5)/.25)] text-foreground"
    : a === "ROLE_CHANGE" ? "bg-[hsl(var(--chart-9)/.20)] text-foreground"
    : "bg-secondary text-secondary-foreground";
  return <Badge variant="secondary" className={cn("px-2", variantClass)}>{ACTION_LABEL[a]}</Badge>;
}

function EllipsizedWithTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)}>{truncate(text)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[520px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------- Columns ---------- */
const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "time",
    header: "Time",
    accessor: r => r.time,
    formatter: v => <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>,
    width: "180px",
    sortable: true,
    visible: true,
  },
  {
    id: "actor",
    header: "Actor",
    accessor: r => r.actor,
    formatter: v => <span className="whitespace-nowrap">{String(v)}</span>,
    width: "180px",
    sortable: true,
    visible: true,
  },
  {
    id: "action",
    header: "Action",
    accessor: r => r.action,
    formatter: (_v, row) => actionBadge(row.action),
    width: "170px",
    sortable: true,
    visible: true,
    align: "center",
  },
  {
    id: "target",
    header: "Target",
    accessor: r => r.target,
    formatter: v => <EllipsizedWithTooltip text={String(v)} className="max-w-[260px]" />,
    width: "280px",
    sortable: true,
    visible: true,
  },
  {
    id: "notes",
    header: "Notes",
    accessor: r => r.notes,
    formatter: v => <EllipsizedWithTooltip text={String(v)} className="max-w-[420px]" />,
    width: "420px",
    sortable: false,
    visible: true,
    toggleable: true,
  },
  {
    id: "ip",
    header: "IP",
    accessor: r => r.ip ?? "—",
    formatter: v => <span className="whitespace-nowrap">{String(v)}</span>,
    width: "140px",
    sortable: true,
    visible: false,
    toggleable: true,
  },
  {
    id: "user_agent",
    header: "User Agent",
    accessor: r => r.user_agent ?? "—",
    formatter: v => <EllipsizedWithTooltip text={String(v)} className="max-w-[360px]" />,
    width: "380px",
    sortable: false,
    visible: false,
    toggleable: true,
  },
  {
    id: "notes_words" as keyof Row & string,
    header: "Words",
    accessor: r => formatWords(r.notes),
    formatter: v => <span className="tabular-nums">{String(v)}</span>,
    width: "90px",
    sortable: true,
    visible: false,
    toggleable: true,
    align: "right",
  },
];

/* ---------- DataTable (client search/sort/pagination) ---------- */
function DataTable<T extends Record<string, unknown>>({
  data, columns, defaultSort, highlightRows = true, searchKeys,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
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
    a.download = `audit-log-visible-${ts}.csv`;
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
            aria-label="Search audit log"
            placeholder="Search actor, action, target, notes…"
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
                        setSort((prev) => {
                          if (!prev || prev.id !== c.id)
                            return { id: c.id, dir: "desc" };
                          return {
                            id: c.id,
                            dir: prev.dir === "desc" ? "asc" : "desc",
                          };
                        });
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
                  key={i}
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

/* ---------- Utility ---------- */
function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

/* ---------- Remote loader + Card ---------- */
function useAuditLogData() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/superadmin/audit-log/audit-log?limit=500&sort=time&dir=desc", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { data: Row[] } = await res.json();
        if (!alive) return;
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (alive) setError("Failed to load audit log.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { rows, loading, error };
}

export type AuditLogProps = { highlightRows?: boolean };

export default function AuditLog({ highlightRows = true }: AuditLogProps) {
  const { rows, loading, error } = useAuditLogData();

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Audit Log</CardTitle>
        <CardDescription>
          Who did what, and when. Use this for compliance and trust—e.g., see who archived a survey or exported data.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
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
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <DataTable<Row>
            data={rows}
            columns={COLUMNS}
            defaultSort={{ id: "time", dir: "desc" }}
            highlightRows={highlightRows}
            searchKeys={["actor", "action", "target", "notes", "ip", "user_agent"]}
          />
        )}
      </CardContent>
    </Card>
  );
}
