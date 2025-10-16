// src/components/tables/survey-versions.tsx
"use client";

import * as React from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, Download, Search } from "lucide-react";

import { cn } from "@/lib/utils";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SurveyVersionRow = {
  id: number;
  status: Status;
  version: number;
  title: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  draft_owner: string | null;
  diff_link: string;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: SurveyVersionRow[];
};

type ColumnDef<T> = {
  id: string;
  header: string;
  width?: string;
  accessor: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number | Date | null;
  visible?: boolean;
};

type SortState = { id: string; desc: boolean };

type Props = {
  highlightRows?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const DATE_FORMAT_PH = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

const STATUS_CLASSES: Record<Status, string> = {
  PUBLISHED: "text-emerald-600 dark:text-emerald-400",
  DRAFT: "text-amber-600 dark:text-amber-400",
  ARCHIVED: "text-muted-foreground",
};

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return DATE_FORMAT_PH.format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value);
}

const COLUMN_DEFS: ColumnDef<SurveyVersionRow>[] = [
  {
    id: "status",
    header: "Status",
    width: "w-[140px]",
    accessor: (row) => (
      <span className={cn("font-medium uppercase tracking-tight", STATUS_CLASSES[row.status])}>
        {row.status.replace("_", " ")}
      </span>
    ),
    sortAccessor: (row) => row.status,
    visible: true,
  },
  {
    id: "version",
    header: "Version",
    width: "w-[120px]",
    accessor: (row) => <Badge variant="secondary">{`v${row.version}`}</Badge>,
    sortAccessor: (row) => row.version,
    visible: true,
  },
  {
    id: "title",
    header: "Title",
    accessor: (row) => (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span className="block max-w-[560px] truncate" title={row.title}>
            {row.title}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs">
          {row.title}
        </TooltipContent>
      </Tooltip>
    ),
    sortAccessor: (row) => row.title.toLowerCase(),
    visible: true,
  },
  {
    id: "published_at",
    header: "Published",
    width: "w-[190px]",
    accessor: (row) => <time dateTime={row.published_at ?? ""}>{formatDate(row.published_at)}</time>,
    sortAccessor: (row) => (row.published_at ? new Date(row.published_at) : null),
    visible: true,
  },
  {
    id: "created_at",
    header: "Created",
    width: "w-[190px]",
    accessor: (row) => <time dateTime={row.created_at}>{formatDate(row.created_at)}</time>,
    sortAccessor: (row) => new Date(row.created_at),
    visible: true,
  },
  {
    id: "updated_at",
    header: "Updated",
    width: "w-[190px]",
    accessor: (row) => <time dateTime={row.updated_at}>{formatDate(row.updated_at)}</time>,
    sortAccessor: (row) => new Date(row.updated_at),
    visible: true,
  },
  {
    id: "draft_owner",
    header: "Draft Owner",
    width: "w-[180px]",
    accessor: (row) => row.draft_owner ?? "--",
    sortAccessor: (row) => (row.draft_owner ?? "").toLowerCase(),
    visible: false,
  },
  {
    id: "diff_link",
    header: "Diff",
    width: "w-[140px]",
    accessor: (row) => (
      <a
        href={row.diff_link}
        className="text-primary underline underline-offset-4 hover:no-underline"
        aria-label={`Open diff for version ${row.version}`}
      >
        Open diff
      </a>
    ),
    sortAccessor: (row) => row.diff_link,
    visible: false,
  },
];

function DataTable({
  rows,
  columns,
  initialSort,
  highlightRows,
}: {
  rows: SurveyVersionRow[];
  columns: ColumnDef<SurveyVersionRow>[];
  initialSort: SortState;
  highlightRows: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = React.useState<number>(1);
  const [sort, setSort] = React.useState<SortState>(initialSort);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);

  const visibleColumns = React.useMemo(
    () => columns.filter((col) => col.visible !== false),
    [columns],
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const versionLabel = `v${row.version}`;
      const draftOwner = row.draft_owner ?? "";
      return (
        row.title.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        versionLabel.includes(query) ||
        draftOwner.toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  const sorted = React.useMemo(() => {
    const column = columns.find((col) => col.id === sort.id && col.sortAccessor);
    if (!column || !column.sortAccessor) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = column.sortAccessor!(a);
      const bv = column.sortAccessor!(b);

      if (av == null && bv == null) return 0;
      if (av == null) return sort.desc ? 1 : -1;
      if (bv == null) return sort.desc ? -1 : 1;

      if (av instanceof Date && bv instanceof Date) {
        const delta = av.getTime() - bv.getTime();
        return sort.desc ? -delta : delta;
      }

      if (typeof av === "number" && typeof bv === "number") {
        return sort.desc ? bv - av : av - bv;
      }

      const sa = String(av);
      const sb = String(bv);
      return sort.desc
        ? sb.localeCompare(sa, undefined, { numeric: true })
        : sa.localeCompare(sb, undefined, { numeric: true });
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
  }, [search, pageSize]);

  const handleSort = (id: string) => {
    setSort((prev) =>
      prev.id === id ? { id, desc: !prev.desc } : { id, desc: false }
    );
  };

  const exportCsv = () => {
    const headers = visibleColumns.map((col) => col.header);

    const lines = sorted.map((row) =>
      visibleColumns.map((col) => {
        const id = col.id;
        switch (id) {
          case "status":
            return row.status;
          case "version":
            return `v${row.version}`;
          case "title":
            return row.title;
          case "published_at":
            return formatDate(row.published_at);
          case "created_at":
            return formatDate(row.created_at);
          case "updated_at":
            return formatDate(row.updated_at);
          case "draft_owner":
            return row.draft_owner ?? "--";
          case "diff_link":
            return row.diff_link;
          default:
            return "";
        }
      }),
    );

    const csv = [headers, ...lines]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "survey-versions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const startIndex = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, sorted.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-[360px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, status, owner, version..."
            className="pl-8"
            aria-label="Search survey versions"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-[120px] justify-between">
              <SelectValue placeholder="Rows / page" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export visible rows?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will export the current filtered and sorted rows as CSV.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    exportCsv();
                    setExportDialogOpen(false);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="max-h-[620px] overflow-auto">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {visibleColumns.map((column) => {
                  const isActive = sort.id === column.id;
                  return (
                    <TableHead
                      key={column.id}
                      className={cn(
                        "whitespace-nowrap text-sm font-medium",
                        column.width,
                        column.sortAccessor && "cursor-pointer select-none"
                      )}
                      aria-sort={
                        column.sortAccessor
                          ? isActive
                            ? sort.desc
                              ? "descending"
                              : "ascending"
                            : "none"
                          : undefined
                      }
                      onClick={() => column.sortAccessor && handleSort(column.id)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {column.header}
                        {column.sortAccessor && (
                          <ArrowUpDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-opacity",
                              isActive ? "opacity-100" : "opacity-40"
                            )}
                          />
                        )}
                      </span>
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
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No survey versions found.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    className={cn(
                      "transition-colors focus-visible:outline focus-visible:outline-primary/60",
                      highlightRows ? "odd:bg-muted/40" : undefined
                    )}
                  >
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "py-3 text-sm align-middle",
                          column.width,
                          column.id === "title" && "pr-8"
                        )}
                      >
                        {column.accessor(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row">
          <div>
            Showing{" "}
            <span className="font-medium text-foreground">
              {startIndex === 0 ? 0 : startIndex}–{endIndex}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {formatNumber(sorted.length)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={currentPage === 1}>
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span className="px-2">
              Page <span className="font-medium text-foreground">{currentPage}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
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

export default function SurveyVersions({ highlightRows = true }: Props) {
  const [rows, setRows] = React.useState<SurveyVersionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          "/api/superadmin/reviews/survey-versions?page=1&pageSize=500&sortBy=updated_at&sortDir=desc",
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const payload: ApiResponse = await res.json();
        if (!cancelled) {
          setRows(Array.isArray(payload.rows) ? payload.rows : []);
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load survey versions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const initialSort: SortState = { id: "updated_at", desc: true };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="md:col-span-8 border bg-card shadow-sm px-4">
        <CardHeader>
          <CardTitle>Survey Versions</CardTitle>
          <CardDescription>
            Governance view of survey lifecycle &mdash; track Draft &rarr; Published &rarr; Archived, who created drafts, and when versions went live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-9 w-full animate-pulse rounded-md bg-muted/40" />
              <div className="h-[380px] w-full animate-pulse rounded-md bg-muted/30" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No survey versions available.
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={COLUMN_DEFS}
              initialSort={initialSort}
              highlightRows={highlightRows}
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
