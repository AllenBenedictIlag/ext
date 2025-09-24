// src\components\admin\dashboard\receipts-table.tsx
"use client";

/**
 * Receipts Table (SAMPLE_DATA, client-only)
 * - Production-ready React component for Next.js App Router (TypeScript)
 * - shadcn/ui + Tailwind
 * - No fetching; renders immediately with typed SAMPLE_DATA (>= 12 rows)
 * - Sticky header, scrollable body, zebra rows, hover highlight, ellipsis + tooltips
 * - Controls: Search, Page size (10/25/50/100), Column visibility, Export CSV (with AlertDialog)
 * - Sorting & pagination (client-side)
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

export type Row = {
  /** 1) receipts.receipt_number */
  receipt_number: string;
  /** 2) receipts.issued_at (ISO) */
  issued_at: string;
  /** 3) receipts.expires_at (ISO) */
  expires_at: string;
  /** 4) receipts.used_at (ISO | null) */
  used_at: string | null;
  /** 5) derived status */
  status: Status;
  /** 6) TIMESTAMPDIFF(DAY, issued_at, used_at) when used, else null */
  days_to_use: number | null;
  /** 7) join submissions by receipt_id (unique if used) */
  submission_id: number | null;
  /** 8) TIMESTAMPDIFF(DAY, issued_at, NOW()) */
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
  /** Provide a stable key generator to avoid relying on unknown fields */
  rowKey?: (row: T, index: number) => string | number;
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

const formatWords = (n: number): string => `${n.toLocaleString()} words`;

/** date math */
const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
const diffDays = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));

/** derive status */
const deriveStatus = (row: Pick<Row, "used_at" | "expires_at">, now = new Date()): Status => {
  if (row.used_at) return "USED";
  const exp = new Date(row.expires_at);
  return now.getTime() > exp.getTime() ? "EXPIRED_UNUSED" : "NOT_USED";
};

/** compute days_to_use + age_days on the fly to keep SAMPLE_DATA realistic any day */
const withDerived = (rows: Omit<Row, "status" | "days_to_use" | "age_days">[]): Row[] => {
  const now = new Date();
  return rows.map((r) => {
    const status = deriveStatus(r, now);
    const days_to_use =
      r.used_at ? diffDays(new Date(r.used_at), new Date(r.issued_at)) : null;
    const age_days = diffDays(now, new Date(r.issued_at));
    return { ...r, status, days_to_use, age_days };
  });
};

/* =========================================================================
   SAMPLE_DATA (>= 12 rows, realistic mix)
   ========================================================================= */

const SAMPLE_DATA: Row[] = withDerived([
  {
    receipt_number: "QXZ-482019",
    issued_at: addDays(new Date(), -1).toISOString(),
    expires_at: addDays(new Date(), 6).toISOString(),
    used_at: addDays(new Date(), -1).toISOString(), // used same day
    submission_id: 7001001,
  },
  {
    receipt_number: "JRM-882771",
    issued_at: addDays(new Date(), -2).toISOString(),
    expires_at: addDays(new Date(), 5).toISOString(),
    used_at: null, // not yet used
    submission_id: null,
  },
  {
    receipt_number: "KTA-105339",
    issued_at: addDays(new Date(), -10).toISOString(),
    expires_at: addDays(new Date(), -3).toISOString(), // expired
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "BRN-773401",
    issued_at: addDays(new Date(), -4).toISOString(),
    expires_at: addDays(new Date(), 3).toISOString(),
    used_at: addDays(new Date(), -2).toISOString(),
    submission_id: 7001002,
  },
  {
    receipt_number: "LMA-553210",
    issued_at: addDays(new Date(), -14).toISOString(),
    expires_at: addDays(new Date(), -7).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "VPK-229941",
    issued_at: addDays(new Date(), -6).toISOString(),
    expires_at: addDays(new Date(), 1).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "RFE-440882",
    issued_at: addDays(new Date(), -3).toISOString(),
    expires_at: addDays(new Date(), 4).toISOString(),
    used_at: addDays(new Date(), -1).toISOString(),
    submission_id: 7001003,
  },
  {
    receipt_number: "CPD-908321",
    issued_at: addDays(new Date(), -20).toISOString(),
    expires_at: addDays(new Date(), -13).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "NQH-337710",
    issued_at: addDays(new Date(), -7).toISOString(),
    expires_at: addDays(new Date(), 0).toISOString(),
    used_at: addDays(new Date(), -6).toISOString(),
    submission_id: 7001004,
  },
  {
    receipt_number: "ZTU-661204",
    issued_at: addDays(new Date(), -11).toISOString(),
    expires_at: addDays(new Date(), -4).toISOString(),
    used_at: addDays(new Date(), -8).toISOString(), // used before expiry
    submission_id: 7001005,
  },
  {
    receipt_number: "MPR-770014",
    issued_at: addDays(new Date(), -1).toISOString(),
    expires_at: addDays(new Date(), 6).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "HAC-550991",
    issued_at: addDays(new Date(), -8).toISOString(),
    expires_at: addDays(new Date(), -1).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "DLS-101777",
    issued_at: addDays(new Date(), -5).toISOString(),
    expires_at: addDays(new Date(), 2).toISOString(),
    used_at: addDays(new Date(), -4).toISOString(),
    submission_id: 7001006,
  },
  {
    receipt_number: "EKO-412398",
    issued_at: addDays(new Date(), -9).toISOString(),
    expires_at: addDays(new Date(), -2).toISOString(),
    used_at: null,
    submission_id: null,
  },
  {
    receipt_number: "WAV-210034",
    issued_at: addDays(new Date(), -2).toISOString(),
    expires_at: addDays(new Date(), 5).toISOString(),
    used_at: null,
    submission_id: null,
  },
]);

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
  if (status === "USED") {
    return <Badge className="px-2">USED</Badge>;
  }
  if (status === "EXPIRED_UNUSED") {
    return <Badge variant="destructive" className="px-2">EXPIRED</Badge>;
  }
  return <Badge variant="secondary" className="px-2">NOT USED</Badge>;
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
    header: "Issued (PH)",
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
    header: "Expires (PH)",
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
    header: "Used At (PH)",
    accessor: (r) => r.used_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">
        {v ? formatDatePH(String(v)) : "—"}
      </span>
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
   DataTable (search, sort, column visibility, pagination, export CSV w/ confirm)
   ========================================================================= */

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
  rowKey,
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

  const toggleCol = (id: string) => setVisibility((v) => ({ ...v, [id]: !v[id] }));

  const exportCSV = () => {
    const headers = visibleColumns.map((c) => c.header);
    const rows = pageRows.map((row, idx) =>
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
    a.download = `receipts-visible-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <DataTable<Row>
          data={SAMPLE_DATA}
          columns={COLUMNS}
          defaultSort={{ id: "issued_at", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={["receipt_number", "status"]}
          rowKey={(r) => r.receipt_number}
        />
      </CardContent>
    </Card>
  );
}
