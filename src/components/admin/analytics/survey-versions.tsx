// src/components/admin/dashboard/survey-versions.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Download, Search } from "lucide-react";
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

/* ──────────────────────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────────────────────── */

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type Row = {
  id: number;
  status: Status;
  version: number;
  title: string;
  published_at: string | null; // ISO or null
  created_at: string; // ISO
  updated_at: string; // ISO
  draft_owner: string | null;
  diff_link: string;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: Row[];
};

type ColumnDef<T> = {
  id: keyof T | string;
  header: string;
  width?: string;
  accessor: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number | Date | null;
  visible?: boolean;
  toggleable?: boolean;
};

type Props = {
  highlightRows?: boolean; // default: true
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 25, 50, 100] as const;

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────────── */

const DATE_FMT_PH = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatDatePH(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT_PH.format(d);
}

function truncate(text: string, max = 36): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatWords(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-PH").format(n);
}

function csvCell(v: string): string {
  const needsQuote = /[",\n]/.test(v);
  return needsQuote ? `"${v.replace(/"/g, '""')}"` : v;
}

/* ──────────────────────────────────────────────────────────────────────────────
   Columns
────────────────────────────────────────────────────────────────────────────── */

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: "status",
    header: "Status",
    width: "w-[120px]",
    accessor: (r) => (
      <span
        className={
          r.status === "PUBLISHED"
            ? "text-emerald-600 dark:text-emerald-400 font-medium"
            : r.status === "DRAFT"
            ? "text-yellow-700 dark:text-yellow-300 font-medium"
            : "text-muted-foreground font-medium"
        }
      >
        {r.status}
      </span>
    ),
    sortAccessor: (r) => r.status,
    visible: true,
    toggleable: false,
  },
  {
    id: "version",
    header: "Version",
    width: "w-[96px]",
    accessor: (r) => <Badge variant="secondary">{`v${r.version}`}</Badge>,
    sortAccessor: (r) => r.version,
    visible: true,
    toggleable: false,
  },
  {
    id: "title",
    header: "Title",
    width: "min-w-[320px]",
    accessor: (r) => (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="block max-w-[520px] truncate" aria-label={r.title}>
            {truncate(r.title, 72)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          {r.title}
        </TooltipContent>
      </Tooltip>
    ),
    sortAccessor: (r) => r.title.toLowerCase(),
    visible: true,
    toggleable: false,
  },
  {
    id: "published_at",
    header: "Published",
    width: "w-[170px]",
    accessor: (r) => (
      <time dateTime={r.published_at ?? ""}>{formatDatePH(r.published_at)}</time>
    ),
    sortAccessor: (r) => (r.published_at ? new Date(r.published_at) : null),
    visible: true,
    toggleable: true,
  },
  {
    id: "created_at",
    header: "Created",
    width: "w-[170px]",
    accessor: (r) => (
      <time dateTime={r.created_at}>{formatDatePH(r.created_at)}</time>
    ),
    sortAccessor: (r) => new Date(r.created_at),
    visible: true,
    toggleable: true,
  },
  {
    id: "updated_at",
    header: "Updated",
    width: "w-[170px]",
    accessor: (r) => (
      <time dateTime={r.updated_at}>{formatDatePH(r.updated_at)}</time>
    ),
    sortAccessor: (r) => new Date(r.updated_at),
    visible: true,
    toggleable: true,
  },
  {
    id: "draft_owner",
    header: "Draft Owner",
    width: "w-[160px]",
    accessor: (r) => <span>{r.draft_owner ?? "—"}</span>,
    sortAccessor: (r) => (r.draft_owner ?? "—").toLowerCase(),
    visible: false,
    toggleable: true,
  },
  {
    id: "diff_link",
    header: "Diff",
    width: "w-[120px]",
    accessor: (r) => (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <a
            href={r.diff_link}
            className="text-primary underline underline-offset-4 hover:no-underline"
            aria-label={`View changes for v${r.version}`}
          >
            Open diff
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom">Compare changes for this version</TooltipContent>
      </Tooltip>
    ),
    sortAccessor: (r) => r.diff_link,
    visible: false,
    toggleable: true,
  },
];

/* ──────────────────────────────────────────────────────────────────────────────
   DataTable (unchanged table, updated controls area)
────────────────────────────────────────────────────────────────────────────── */

function DataTable({
  rows,
  columns,
  initialSort,
  highlightRows = true,
}: {
  rows: Row[];
  columns: ColumnDef<Row>[];
  initialSort: { id: string; desc: boolean };
  highlightRows?: boolean;
}) {
  const [q, setQ] = React.useState<string>("");
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = React.useState<number>(1);
  const [sort, setSort] = React.useState<{ id: string; desc: boolean }>(
    initialSort
  );
  const [visibility] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(columns.map((c) => [String(c.id), c.visible !== false]))
  );
  const [confirmExportOpen, setConfirmExportOpen] = React.useState<boolean>(false);

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[String(c.id)]),
    [columns, visibility]
  );

  const onHeaderClick = (id: string) => {
    if (sort.id === id) setSort({ id, desc: !sort.desc });
    else setSort({ id, desc: false });
  };

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const vLabel = `v${r.version}`;
      const status = r.status.toLowerCase();
      const title = r.title.toLowerCase();
      const owner = (r.draft_owner ?? "—").toLowerCase();
      const diff = r.diff_link.toLowerCase();
      return (
        title.includes(query) ||
        status.includes(query) ||
        vLabel.includes(query) ||
        owner.includes(query) ||
        diff.includes(query)
      );
    });
  }, [rows, q]);

  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.id === sort.id);
    if (!col || !col.sortAccessor) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      const isDateA = av instanceof Date;
      const isDateB = bv instanceof Date;
      let cmp = 0;
      if (isDateA && isDateB) {
        cmp = (av as Date).getTime() - (bv as Date).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        const sa = av == null ? "" : String(av);
        const sb = bv == null ? "" : String(bv);
        cmp = sa.localeCompare(sb, undefined, { numeric: true });
      }
      return sort.desc ? -cmp : cmp;
    });
    return copy;
  }, [filtered, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const exportCSV = () => {
    const headers = visibleColumns.map((c) => c.header);
    const getCell = (r: Row, c: ColumnDef<Row>): string => {
      const id = String(c.id);
      switch (id) {
        case "status":
          return r.status;
        case "version":
          return `v${r.version}`;
        case "title":
          return r.title;
        case "published_at":
          return formatDatePH(r.published_at);
        case "created_at":
          return formatDatePH(r.created_at);
        case "updated_at":
          return formatDatePH(r.updated_at);
        case "draft_owner":
          return r.draft_owner ?? "—";
        case "diff_link":
          return r.diff_link;
        default:
          return "";
      }
    };
    const lines = [
      headers.map(csvCell).join(","),
      ...sorted.map((r) =>
        visibleColumns.map((c) => csvCell(getCell(r, c))).join(",")
      ),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "survey-versions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Left: Search */}
        <div className="relative w-[280px] sm:w-[340px]">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search survey versions"
            placeholder="Search title, status, owner, v#…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Right: Page size + Export */}
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="w-[120px] justify-between">
              {/* Hide default value; render custom '10 / page' like the screenshot */}
              <SelectValue className="sr-only" />
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1">
                  <span>{pageSize}</span>
                  <span className="text-muted-foreground">/ page</span>
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialog open={confirmExportOpen} onOpenChange={setConfirmExportOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="size-4" />
                Export
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
                <AlertDialogAction
                  onClick={() => {
                    exportCSV();
                    setConfirmExportOpen(false);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Table */}
      <div
        className="relative rounded-lg border bg-card"
        role="region"
        aria-label="Survey versions data table"
      >
        <div className="max-h-[620px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
              <TableRow>
                {visibleColumns.map((c) => {
                  const id = String(c.id);
                  const isActive = sort.id === id;
                  return (
                    <TableHead
                      key={id}
                      className={[
                        "whitespace-nowrap",
                        c.width ?? "",
                        "cursor-pointer select-none",
                      ].join(" ")}
                      onClick={() => onHeaderClick(id)}
                      aria-sort={
                        isActive ? (sort.desc ? "descending" : "ascending") : "none"
                      }
                    >
                      <div className="inline-flex items-center gap-1">
                        {c.header}
                        <ArrowUpDown
                          className={[
                            "size-3.5 text-muted-foreground",
                            isActive ? "opacity-100" : "opacity-40",
                          ].join(" ")}
                        />
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    — No results —
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    className="even:bg-muted/40 hover:bg-accent/40 focus-visible:outline focus-visible:outline-2"
                    style={
                      highlightRows
                        ? { backgroundColor: "hsl(var(--chart-1) / 0.30)" }
                        : undefined
                    }
                  >
                    {visibleColumns.map((c) => (
                      <TableCell
                        key={String(c.id)}
                        className={[
                          "py-3 align-middle text-sm",
                          c.width ?? "",
                          String(c.id) === "title" ? "pr-8" : "",
                        ].join(" ")}
                      >
                        {c.accessor(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer: pagination (unchanged) */}
        <div className="flex flex-col items-center justify-between gap-2 border-t p-3 text-sm sm:flex-row">
          <div className="text-muted-foreground">
            Showing{" "}
            <span className="font-medium">
              {sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              –
              {Math.min(currentPage * pageSize, sorted.length)}
            </span>{" "}
            of <span className="font-medium">{formatWords(sorted.length)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span className="min-w-[120px] text-center">
              Page <span className="font-medium">{currentPage}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Main export with data fetching
────────────────────────────────────────────────────────────────────────────── */

export default function SurveyVersionsCard({ highlightRows = true }: Props) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          "/api/admin/questions/survey-versions?page=1&pageSize=500&sortBy=updated_at&sortDir=desc",
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiResponse = await res.json();
        if (!cancelled) setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch {
        if (!cancelled) setError("Failed to load survey versions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initialSort = { id: "updated_at", desc: true };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="md:col-span-8 h-90 rounded-xl border bg-card shadow-sm px-4">
        <CardHeader className="sticky top-0 z-20 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardTitle>Survey Versions</CardTitle>
          <CardDescription>
            Governance view of survey lifecycle — track{" "}
            <span className="font-medium">Draft → Published → Archived</span>,
            who created drafts, and when versions went live.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-9 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-[420px] w-full animate-pulse rounded-md bg-muted/40" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              — No results —
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={COLUMNS}
              initialSort={initialSort}
              highlightRows={highlightRows}
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
