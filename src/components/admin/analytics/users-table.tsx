// src\components\admin\dashboard\users-table.tsx
"use client";

import * as React from "react";
import type { ReactNode } from "react";
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

/* =============================================================================
   Row + columns
   ========================================================================== */

export type Row = {
  admin_id: number;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
};

type ColumnDef<T> = {
  id: keyof T & string;
  header: string;
  accessor: (row: T) => unknown;
  formatter?: (value: unknown, row: T) => ReactNode;
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
  getRowKey?: (row: T, absoluteIndex: number) => React.Key;
};

/* =============================================================================
   Helpers
   ========================================================================== */

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

function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined; // fixed
}

function EllipsizedWithTooltip({
  text,
  className,
  title,
}: {
  text: string;
  className?: string;
  title?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("block truncate", className)} title={title ?? text}>
            {truncate(text)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[460px] break-words">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* =============================================================================
   Columns
   ========================================================================== */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "admin_id",
    header: "Admin ID",
    accessor: (r) => r.admin_id,
    width: "120px",
    sortable: true,
    visible: true,
    toggleable: false,
    align: "left",
  },
  {
    id: "name",
    header: "Name",
    accessor: (r) => r.name,
    formatter: (v) => (
      <EllipsizedWithTooltip text={String(v)} className="max-w-[220px]" />
    ),
    width: "240px",
    sortable: true,
    visible: true,
    toggleable: false,
  },
  {
    id: "email",
    header: "Email",
    accessor: (r) => r.email,
    formatter: (v) => (
      <EllipsizedWithTooltip text={String(v)} className="max-w-[260px]" />
    ),
    width: "280px",
    sortable: true,
    visible: true,
    toggleable: true,
  },
  {
    id: "role",
    header: "Role",
    accessor: (r) => r.role,
    formatter: (v) => {
      const role = String(v) as Row["role"];
      const isSuper = role === "SUPER_ADMIN";
      return (
        <Badge
          variant={isSuper ? "default" : "secondary"}
          className={cn(
            "px-2",
            isSuper && "uppercase tracking-wide",
            !isSuper && "bg-muted text-foreground"
          )}
        >
          {isSuper ? "SUPER ADMIN" : "Admin"}
        </Badge>
      );
    },
    width: "150px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "center",
  },
  {
    id: "status",
    header: "Status",
    accessor: (r) => r.status,
    formatter: (v) => {
      const s = String(v) as Row["status"];
      const cls =
        s === "ACTIVE"
          ? "border-green-600 text-green-700 dark:text-green-300"
          : s === "SUSPENDED"
          ? "border-destructive text-destructive"
          : "text-muted-foreground border-muted-foreground";
      const label =
        s === "ACTIVE" ? "Active" : s === "SUSPENDED" ? "Suspended" : "Inactive";
      return (
        <Badge variant="outline" className={cn("px-2", cls)}>
          {label}
        </Badge>
      );
    },
    width: "140px",
    sortable: true,
    visible: true,
    toggleable: true,
    align: "center",
  },
  {
    id: "created_at",
    header: "Created",
    accessor: (r) => r.created_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "200px",
    sortable: true,
    visible: true,
    toggleable: true,
  },
  {
    id: "updated_at",
    header: "Updated",
    accessor: (r) => r.updated_at,
    formatter: (v) => (
      <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>
    ),
    width: "200px",
    sortable: true,
    visible: true,
    toggleable: false,
  },
];

/* =============================================================================
   Remote fetch wrapper (no URL/localStorage; no events)
   ========================================================================== */

type ApiResponse = {
  data: Row[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function UsersRemoteData({
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
          "/api/admin/dashboard/users-table?limit=500&sort=updated_at&dir=desc",
          { method: "GET", headers: { accept: "application/json" }, cache: "no-store" }
        );
        if (!res.ok) throw new Error(String(res.status));
        const json: ApiResponse = await res.json();
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

function SkeletonRows() {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   DataTable
   ========================================================================== */

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
  getRowKey,
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
    a.download = `users-visible-${ts}.csv`;
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
            aria-label="Search users"
            placeholder="Search name, email, role, status…"
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
                  onCheckedChange={() => c.toggleable !== false && toggleCol(c.id)}
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

          {/* Confirm before export */}
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
              {pageRows.map((row, i) => {
                const absoluteIndex = start + i;
                const key: React.Key = getRowKey
                  ? getRowKey(row, absoluteIndex)
                  : String(absoluteIndex);
                return (
                  <TableRow
                    key={key}
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
                );
              })}
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

/* =============================================================================
   Exported card
   ========================================================================== */

export type UsersTableProps = {
  highlightRows?: boolean;
};

export default function UsersTable({ highlightRows = true }: UsersTableProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Users &amp; Roles Table</CardTitle>
        <CardDescription>
          Controls who can see, edit, or approve surveys and data. Use this list to
          verify who has <span className="font-medium">Super Admin</span> privileges,
          audit approvers, and keep governance tight.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <UsersRemoteData>
          {(rows, loading, error) => {
            if (loading) return <SkeletonRows />;
            if (error)
              return (
                <div className="text-sm text-destructive">
                  Failed to load users. Please retry.
                </div>
              );
            return (
              <DataTable<Row>
                data={rows}
                columns={COLUMNS}
                defaultSort={{ id: "updated_at", dir: "desc" }}
                highlightRows={highlightRows}
                searchKeys={["name", "email", "role", "status"]}
                getRowKey={(r) => r.admin_id}
              />
            );
          }}
        </UsersRemoteData>
      </CardContent>
    </Card>
  );
}
