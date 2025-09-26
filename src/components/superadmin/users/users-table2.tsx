"use client";

/**
 * File: src\components\superadmin\reviews\users-table.tsx
 * Component: <UsersTable/>
 *
 * Users & Roles (Super Admin)
 * - Renders a production-ready data table for admin users.
 * - No fetching here; uses typed SAMPLE_DATA (≥ 12 rows) so it shows immediately.
 * - Features: sticky header, scroll area, zebra rows, hover, tooltips, search, sort,
 *   pagination, column visibility toggles, and Export CSV (with confirm dialog).
 *
 * Props:
 * - highlightRows?: boolean (default true) — when true, softly tint rows using --chart-1.
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

export type Role = "ADMIN" | "SUPER_ADMIN";
export type Status = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type Row = {
  admin_id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
  created_at: string; // ISO
  updated_at: string; // ISO
  last_login_at?: string | null; // optional (future)
};

type ColumnDef<T> = {
  id: keyof T & string;
  header: string;
  accessor: (row: T) => unknown;
  formatter?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  visible?: boolean;
  toggleable?: boolean; // allow hiding/showing via menu
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
    return iso ?? "—";
  }
}

const truncate = (text: string, max = 24): string =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

/** Tiny helper kept for parity with other tables (not heavily used here). */
const formatWords = (s: string): number =>
  s.trim().split(/\s+/).filter(Boolean).length;

/* Small tooltip wrapper for long text cells */
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
          <span className={cn("block truncate", className)}>{truncate(text)}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          <p className="max-w-[460px] break-words">{text}</p>
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
    id: "admin_id",
    header: "Admin ID",
    accessor: (r) => r.admin_id,
    width: "120px",
    sortable: true,
    visible: true,
    toggleable: false,
    align: "right",
  },
  {
    id: "name",
    header: "Name",
    accessor: (r) => r.name,
    formatter: (v) => <EllipsizedWithTooltip text={String(v)} className="max-w-[220px]" />,
    width: "220px",
    sortable: true,
    visible: true,
    toggleable: false,
  },
  {
    id: "email",
    header: "Email",
    accessor: (r) => r.email,
    formatter: (v) => <EllipsizedWithTooltip text={String(v)} className="max-w-[260px]" />,
    width: "260px",
    sortable: true,
    visible: true,
    toggleable: true,
  },
  {
    id: "role",
    header: "Role",
    accessor: (r) => r.role,
    formatter: (v) => (
      <Badge variant="secondary" className="px-2">
        {String(v) === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
      </Badge>
    ),
    width: "140px",
    sortable: true,
    visible: true,
    align: "center",
  },
  {
    id: "status",
    header: "Status",
    accessor: (r) => r.status,
    formatter: (v) => {
        const status = String(v) as Status;
        const variant: "default" | "secondary" | "destructive" | "outline" =
        status === "ACTIVE" ? "default" : status === "SUSPENDED" ? "destructive" : "outline";
        return <Badge variant={variant}>{status}</Badge>;
    },
    width: "140px",
    sortable: true,
    visible: true,
    align: "center",
  },
  {
    id: "created_at",
    header: "Created (PH)",
    accessor: (r) => r.created_at,
    formatter: (v) => <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>,
    width: "190px",
    sortable: true,
    visible: true,
  },
  {
    id: "updated_at",
    header: "Updated (PH)",
    accessor: (r) => r.updated_at,
    formatter: (v) => <span className="whitespace-nowrap">{formatDatePH(String(v))}</span>,
    width: "190px",
    sortable: true,
    visible: true,
  },
  {
    id: "last_login_at",
    header: "Last Login (PH)",
    accessor: (r) => r.last_login_at ?? "—",
    formatter: (v) =>
      v && v !== "—" ? <span className="whitespace-nowrap">{formatDatePH(String(v))}</span> : "—",
    width: "190px",
    sortable: true,
    visible: false, // optional (future)
    toggleable: true,
  },
];

/* =========================================================================
   SAMPLE_DATA (≥ 12 rows, realistic)
   ========================================================================= */

const SAMPLE_DATA: Row[] = [
  {
    admin_id: 1,
    name: "Ava Santos",
    email: "ava.santos@coffeecrave.local",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    created_at: "2024-12-15T09:20:00+08:00",
    updated_at: "2025-09-24T10:42:00+08:00",
    last_login_at: "2025-09-26T08:05:00+08:00",
  },
  {
    admin_id: 2,
    name: "Liam Reyes",
    email: "liam.reyes@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-01-03T13:10:00+08:00",
    updated_at: "2025-09-23T18:30:00+08:00",
    last_login_at: "2025-09-25T20:14:00+08:00",
  },
  {
    admin_id: 3,
    name: "Maya Dela Cruz",
    email: "maya.delacruz@coffeecrave.local",
    role: "ADMIN",
    status: "INACTIVE",
    created_at: "2025-02-10T08:15:00+08:00",
    updated_at: "2025-08-30T11:45:00+08:00",
    last_login_at: "2025-07-30T09:20:00+08:00",
  },
  {
    admin_id: 4,
    name: "Noah Tan",
    email: "noah.tan@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-03-05T14:00:00+08:00",
    updated_at: "2025-09-21T16:22:00+08:00",
    last_login_at: "2025-09-21T16:20:00+08:00",
  },
  {
    admin_id: 5,
    name: "Sophia Lim",
    email: "sophia.lim@coffeecrave.local",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    created_at: "2024-11-22T10:40:00+08:00",
    updated_at: "2025-09-25T09:10:00+08:00",
    last_login_at: "2025-09-26T09:12:00+08:00",
  },
  {
    admin_id: 6,
    name: "Ethan Garcia",
    email: "ethan.garcia@coffeecrave.local",
    role: "ADMIN",
    status: "SUSPENDED",
    created_at: "2025-04-19T12:05:00+08:00",
    updated_at: "2025-09-10T08:05:00+08:00",
    last_login_at: "2025-08-28T07:42:00+08:00",
  },
  {
    admin_id: 7,
    name: "Isla Bautista",
    email: "isla.bautista@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-05-02T09:55:00+08:00",
    updated_at: "2025-09-26T10:12:00+08:00",
    last_login_at: "2025-09-26T10:10:00+08:00",
  },
  {
    admin_id: 8,
    name: "Lucas Ong",
    email: "lucas.ong@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-05-21T11:00:00+08:00",
    updated_at: "2025-09-22T19:25:00+08:00",
    last_login_at: "2025-09-22T19:10:00+08:00",
  },
  {
    admin_id: 9,
    name: "Mia Navarro",
    email: "mia.navarro@coffeecrave.local",
    role: "ADMIN",
    status: "INACTIVE",
    created_at: "2025-06-10T08:35:00+08:00",
    updated_at: "2025-08-01T17:55:00+08:00",
    last_login_at: "2025-07-20T08:00:00+08:00",
  },
  {
    admin_id: 10,
    name: "Jacob Villanueva",
    email: "jacob.villanueva@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-06-28T15:18:00+08:00",
    updated_at: "2025-09-18T09:02:00+08:00",
    last_login_at: "2025-09-18T08:59:00+08:00",
  },
  {
    admin_id: 11,
    name: "Ella Ramos",
    email: "ella.ramos@coffeecrave.local",
    role: "ADMIN",
    status: "SUSPENDED",
    created_at: "2025-07-05T13:44:00+08:00",
    updated_at: "2025-09-05T12:15:00+08:00",
    last_login_at: "2025-08-31T21:33:00+08:00",
  },
  {
    admin_id: 12,
    name: "Maxine Co",
    email: "maxine.co@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-07-21T09:12:00+08:00",
    updated_at: "2025-09-20T18:40:00+08:00",
    last_login_at: "2025-09-24T07:50:00+08:00",
  },
  {
    admin_id: 13,
    name: "Andre Mercado",
    email: "andre.mercado@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-08-02T10:30:00+08:00",
    updated_at: "2025-09-26T11:05:00+08:00",
    last_login_at: "2025-09-26T11:00:00+08:00",
  },
  {
    admin_id: 14,
    name: "Bianca Uy",
    email: "bianca.uy@coffeecrave.local",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2025-08-18T16:10:00+08:00",
    updated_at: "2025-09-16T14:25:00+08:00",
    last_login_at: null,
  },
];

/* =========================================================================
   DataTable
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
    Object.fromEntries(columns.map((c) => [c.id, c.visible !== false])),
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[c.id]),
    [columns, visibility],
  );

  const SEARCH_KEYS: (keyof T & string)[] =
    searchKeys ?? (columns.map((c) => c.id) as (keyof T & string)[]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => {
      const fields = SEARCH_KEYS.map((k) =>
        getCell<T, typeof k>(columns, row, k),
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
      }),
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
            .join(","),
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
        <div className="relative w-full sm:max-w-[320px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search users"
            placeholder="Search name, email, or ID…"
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
                      c.align === "center" && "text-center",
                    )}
                  >
                    <button
                      onClick={() => onHeaderClick(c)}
                      className={cn(
                        "flex w-full items-center gap-1 text-left",
                        c.align === "right" && "justify-end",
                        c.align === "center" && "justify-center",
                        c.sortable ? "cursor-pointer select-none" : "cursor-default",
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
                    // zebra rows (disabled when highlightRows set to hard bg)
                    !highlightRows && "odd:bg-muted/30 even:bg-card",
                  )}
                  style={
                    highlightRows
                      ? { backgroundColor: "hsl(var(--chart-1) / 0.30)" }
                      : undefined
                  }
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
                          c.align === "center" && "text-center",
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
                          c.align === "center" && "text-center",
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

/* Utility to read a cell by id (for search) */
function getCell<T extends Record<string, unknown>, K extends keyof T & string>(
  cols: ColumnDef<T>[],
  row: T,
  id: K,
): unknown {
  const col = cols.find((c) => c.id === id);
  return col ? col.accessor(row) : undefined;
}

/* =========================================================================
   Exported Card Component
   ========================================================================= */

export type UsersTableProps = {
  highlightRows?: boolean;
};

export default function UsersTable2({ highlightRows = true }: UsersTableProps) {
  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader>
        <CardTitle className="tracking-normal">Users &amp; Roles (Super Admin)</CardTitle>
        <CardDescription>
          One row per admin user from <code>admins</code>. Use this table to review current
          roles and statuses; actions like Invite, Activate/Deactivate/Suspend, and Role change
          can be wired later to your API.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <DataTable<Row>
          data={SAMPLE_DATA}
          columns={COLUMNS}
          defaultSort={{ id: "updated_at", dir: "desc" }}
          highlightRows={highlightRows}
          searchKeys={["name", "email", "admin_id"]}
        />
      </CardContent>
    </Card>
  );
}
