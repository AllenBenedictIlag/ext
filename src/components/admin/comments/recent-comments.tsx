// src\components\admin\comments\recent-comments.tsx
"use client";

import * as React from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Download, Search, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
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

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

export type Row = {
  comment_id: number;
  submitted_at: string; // ISO
  receipt_number: string;
  // prompt is not shown in table
  prompt?: string | null;
  preview: string;
  words?: number | null;
  // survey_title is optional label for dialog header
  survey_title?: string | null;
  survey_version: number;
  submission_link: string;
};

type SortKey = "submitted_at" | "receipt_number" | "survey_version" | "comment_id";
type SortDir = "asc" | "desc";

type Column = {
  id: keyof Row;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (row: Row) => React.ReactNode;
  sortValue?: (row: Row) => number | string;
  ariaLabel?: string;
};

/* ---------- API (list) ---------- */
type ApiRow = {
  comment_id: number;
  submitted_at: string;
  receipt_number: string;
  prompt: string | null;
  preview: string;
  words: number | null;
  survey_title: string | null;
  survey_version: number;
  submission_link: string;
};
type ApiResponse = {
  window: { from: string; to: string };
  rows: ApiRow[];
  meta: { limit: number; offset: number; count: number };
};

/* ---------- API (detail dialog) ---------- */
type QaItem = {
  question_id: number;
  question_key: string;
  display_order: number;
  prompt: string;
  question_type: "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
  text_value: string | null;
  option_value: string | null;
  option_label: string | null;
};
type SubmissionDetail = {
  submission_id: number;
  receipt_number: string;
  survey_title: string | null;
  survey_version: number;
  submitted_at: string;
  items: QaItem[];
};

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

function formatDatePH(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function formatWords(n?: number | null): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-PH");
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function EllipsisWithTooltip(props: { text: string; className?: string; maxChars?: number }) {
  const { text, className, maxChars = 160 } = props;
  const short = truncate(text, maxChars);
  const showTooltip = short !== text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={["block whitespace-nowrap overflow-hidden text-ellipsis", className].filter(Boolean).join(" ")}
          title={!showTooltip ? text : undefined}
        >
          {short}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[520px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/* ========================================================================== */
/* Sample rows (render immediately)                                           */
/* ========================================================================== */

const SAMPLE_DATA: Row[] = [
  {
    comment_id: 10051,
    submitted_at: "2025-09-21T00:15:00.000Z",
    receipt_number: "CCQ-284931",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Loved the cappuccino! Milk was silky and the shot tasted sweet—not bitter at all. Keep it up!",
    words: 20,
    survey_title: "Main Shop CX",
    survey_version: 3,
    submission_link: "/admin/submissions/10051",
  },
  {
    comment_id: 10052,
    submitted_at: "2025-09-21T00:20:00.000Z",
    receipt_number: "CCQ-284777",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Barista was friendly but the queue moved slowly. Maybe add one more during morning rush.",
    words: 18,
    survey_title: "Main Shop CX",
    survey_version: 3,
    submission_link: "/admin/submissions/10052",
  },
  {
    comment_id: 10053,
    submitted_at: "2025-09-20T12:05:00.000Z",
    receipt_number: "CCQ-283622",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Blueberry muffin was dry today. I usually like it here but this one tasted like it sat too long.",
    words: 22,
    survey_title: "Main Shop CX",
    survey_version: 3,
    submission_link: "/admin/submissions/10053",
  },
  {
    comment_id: 10054,
    submitted_at: "2025-09-20T07:31:00.000Z",
    receipt_number: "CCQ-283510",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Got my name and size wrong again. Not a big deal, but it happens often—please double check.",
    words: 22,
    survey_title: "Main Shop CX",
    survey_version: 3,
    submission_link: "/admin/submissions/10054",
  },
  {
    comment_id: 10055,
    submitted_at: "2025-09-19T10:45:00.000Z",
    receipt_number: "CCQ-282941",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Tables were sticky near the window seating. Staff cleaned after a few minutes when asked.",
    words: 17,
    survey_title: "Main Shop CX",
    survey_version: 2,
    submission_link: "/admin/submissions/10055",
  },
  {
    comment_id: 10056,
    submitted_at: "2025-09-19T02:10:00.000Z",
    receipt_number: "CCQ-282512",
    prompt: "Any additional comments or suggestions?",
    preview:
      "The aircon was broken for two days. Today felt humid and warm—hard to stay and work.",
    words: 20,
    survey_title: "Main Shop CX",
    survey_version: 2,
    submission_link: "/admin/submissions/10056",
  },
  {
    comment_id: 10057,
    submitted_at: "2025-09-18T13:55:00.000Z",
    receipt_number: "CCQ-281903",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Great playlist at night. Not too loud, and it actually made the place feel cozy. Nice touch!",
    words: 22,
    survey_title: "Main Shop CX",
    survey_version: 2,
    submission_link: "/admin/submissions/10057",
  },
  {
    comment_id: 10058,
    submitted_at: "2025-09-18T01:22:00.000Z",
    receipt_number: "CCQ-281431",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Wi-Fi was spotty around 9 AM. It would connect but then drop every few minutes.",
    words: 18,
    survey_title: "Main Shop CX",
    survey_version: 2,
    submission_link: "/admin/submissions/10058",
  },
  {
    comment_id: 10059,
    submitted_at: "2025-09-17T11:05:00.000Z",
    receipt_number: "CCQ-280990",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Yes! I live nearby and like the consistency. Hoping for a loyalty card or stamp soon.",
    words: 21,
    survey_title: "Main Shop CX",
    survey_version: 1,
    submission_link: "/admin/submissions/10059",
  },
  {
    comment_id: 10060,
    submitted_at: "2025-09-16T23:35:00.000Z",
    receipt_number: "CCQ-280512",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Flat white was on the bitter side. I think the espresso was pulled long.",
    words: 16,
    survey_title: "Main Shop CX",
    survey_version: 1,
    submission_link: "/admin/submissions/10060",
  },
  {
    comment_id: 10061,
    submitted_at: "2025-09-16T08:48:00.000Z",
    receipt_number: "CCQ-279901",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Super helpful with my complicated order. They even suggested a better milk option.",
    words: 18,
    survey_title: "Main Shop CX",
    survey_version: 1,
    submission_link: "/admin/submissions/10061",
  },
  {
    comment_id: 10062,
    submitted_at: "2025-09-16T00:05:00.000Z",
    receipt_number: "CCQ-279522",
    prompt: "Any additional comments or suggestions?",
    preview:
      "Restroom was out of tissue in the morning. Got restocked by lunch time.",
    words: 15,
    survey_title: "Main Shop CX",
    survey_version: 1,
    submission_link: "/admin/submissions/10062",
  },
];

/* ========================================================================== */
/* Column definitions (Prompt & Survey removed)                               */
/* ========================================================================== */

const COLUMN_DEFS: Column[] = [
  { id: "comment_id", header: "Comment ID", width: "9rem", sortable: true, sortValue: (r) => r.comment_id },
  {
    id: "submitted_at",
    header: "Submitted (PH)",
    width: "14rem",
    sortable: true,
    sortValue: (r) => new Date(r.submitted_at).getTime(),
    render: (r) => <time dateTime={r.submitted_at}>{formatDatePH(r.submitted_at)}</time>,
  },
  { id: "receipt_number", header: "Receipt", width: "11rem", sortable: true, sortValue: (r) => r.receipt_number },
  {
    id: "preview",
    header: "Snippet",
    width: "36rem",
    render: (r) => <EllipsisWithTooltip text={r.preview} className="max-w-[34rem]" />,
  },
  { id: "words", header: "Words", width: "6rem", render: (r) => <span>{formatWords(r.words)}</span> },
  {
    id: "survey_version",
    header: "Ver",
    width: "6rem",
    sortable: true,
    sortValue: (r) => r.survey_version,
    render: (r) => <Badge variant="outline">v{r.survey_version}</Badge>,
  },
  {
    id: "submission_link",
    header: "Link",
    width: "8rem",
  },
];

/* ========================================================================== */
/* Fetch + GlobalQuickFilter wiring                                           */
/* ========================================================================== */

function getInitialRange(): { from: string; to: string } {
  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && to) return { from, to };

  try {
    const saved = localStorage.getItem("dashboard:filters");
    if (saved) {
      const j = JSON.parse(saved) as { from?: string; to?: string };
      if (j.from && j.to) return { from: j.from, to: j.to };
    }
  } catch {}

  // PH last 30 days
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const end = new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const y = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: y(start), to: y(end) };
}

/* ========================================================================== */
/* DataTable                                                                  */
/* ========================================================================== */

function DataTable(props: {
  rows: Row[];
  columns: Column[];
  selectedId?: number | null;        // accent selected row
  onOpenRow?: (row: Row) => void;    // open dialog
}) {
  const { rows, columns, selectedId = null, onOpenRow } = props;

  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<SortKey>("submitted_at");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // Filter (receipt_number + snippet only)
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.receipt_number} ${r.preview}`.toLowerCase().includes(q));
  }, [rows, query]);

  // Sort
  const sorted = React.useMemo(() => {
    const col = columns.find((c) => c.id === sortKey);
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (col?.sortValue) {
        av = col.sortValue(a);
        bv = col.sortValue(b);
      } else {
        switch (sortKey) {
          case "submitted_at":
            av = new Date(a.submitted_at).getTime();
            bv = new Date(b.submitted_at).getTime();
            break;
          case "receipt_number":
            av = a.receipt_number;
            bv = b.receipt_number;
            break;
          case "survey_version":
            av = a.survey_version;
            bv = b.survey_version;
            break;
          case "comment_id":
            av = a.comment_id;
            bv = b.comment_id;
            break;
        }
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [filtered, columns, sortKey, sortDir]);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  React.useEffect(() => { setPage(1); }, [query, pageSize]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "submitted_at" ? "desc" : "asc"); }
  }
  function headerSortIcon(k: SortKey) {
    if (sortKey !== k) return <ArrowUpDown className="h-4 w-4" aria-hidden />;
    return sortDir === "asc" ? <ArrowUp className="h-4 w-4" aria-hidden /> : <ArrowDown className="h-4 w-4" aria-hidden />;
  }

  function getCellRaw(c: Column, r: Row): string {
    switch (c.id) {
      case "submitted_at": return formatDatePH(r.submitted_at);
      case "survey_version": return `v${r.survey_version}`;
      case "submission_link": return r.submission_link;
      case "words": return r.words != null ? String(r.words) : "";
      default: return String(r[c.id] ?? "");
    }
  }
  function csvEscape(v: string): string {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }
  function buildCSV() {
    const headers = columns.map((c) => c.header);
    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(","));
    for (const r of sorted) lines.push(columns.map((c) => csvEscape(getCellRaw(c, r))).join(","));
    return lines.join("\r\n");
  }

  const headerCells = columns.map((c) => {
    const isSortable =
      c.sortable &&
      (c.id === "submitted_at" || c.id === "receipt_number" || c.id === "survey_version" || c.id === "comment_id");
    const key = String(c.id);
    return (
      <TableHead key={key} className="bg-card" style={c.width ? { width: c.width, maxWidth: c.width } : undefined}>
        {isSortable ? (
          <button
            className="inline-flex items-center gap-2 text-left font-medium hover:underline focus-visible:outline-none"
            onClick={() => toggleSort(c.id as SortKey)}
            aria-label={c.ariaLabel ?? `Sort by ${c.header}`}
            aria-sort={sortKey === c.id ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
          >
            {c.header}
            {headerSortIcon(c.id as SortKey)}
          </button>
        ) : (
          <span className="font-medium">{c.header}</span>
        )}
      </TableHead>
    );
  });

  const bodyRows = paged.map((r) => {
    const selected = selectedId === r.comment_id;
    return (
      <TableRow
        key={r.comment_id}
        className={[
          selected ? "bg-[hsl(var(--chart-1)/0.30)]" : "odd:bg-muted/30",
          "hover:bg-muted/50 focus-within:bg-muted/50 transition-colors",
        ].join(" ")}
        tabIndex={0}
        aria-label={`Row for comment ${r.comment_id}`}
      >
        {columns.map((c) => {
          const key = String(c.id);
          if (c.id === "submission_link") {
            return (
              <TableCell
                key={key}
                className="align-top whitespace-nowrap"
                style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
              >
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  aria-label={`Open submission ${r.comment_id}`}
                  onClick={() => onOpenRow?.(r)}
                >
                  Open
                </Button>
              </TableCell>
            );
          }
          return (
            <TableCell
              key={key}
              className="align-top whitespace-nowrap"
              style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
            >
              {c.render ? c.render(r) : (
                <span className="block truncate">
                  {String((r as Record<string, unknown>)[key] ?? "—")}
                </span>
              )}
            </TableCell>
          );
        })}
      </TableRow>
    );
  });

  /* ----- Export confirm dialog (AlertDialog) ----- */
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-[360px]" aria-label="Search recent comments">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt or snippet…"
            className="pl-8"
            aria-label="Search input"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[120px]" aria-label="Select page size">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2" aria-label="Export visible rows to CSV">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export visible rows?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will export the currently visible (filtered & sorted) rows to CSV.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const csv = buildCSV();
                    downloadCSV("recent-comments.csv", csv);
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
      <div className="rounded-md border" role="region" aria-label="Recent comments table">
        <div className="max-h-[640px] min-h-[560px] overflow-y-auto">
          <Table>
            <caption className="sr-only">Recent comments spotlight feed</caption>
            {/* Sticky header */}
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">{headerCells}</TableRow>
            </TableHeader>
            <TableBody>{bodyRows}</TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{total === 0 ? 0 : start + 1}</span> to{" "}
          <span className="font-medium">{Math.min(total, start + pageSize)}</span> of{" "}
          <span className="font-medium">{total}</span> comments
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm">
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
          </span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Main component with dialog                                                 */
/* ========================================================================== */

export default function RecentComments() {
  const [range, setRange] = React.useState(getInitialRange);
  const [serverRows, setServerRows] = React.useState<Row[] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Dialog state
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [detail, setDetail] = React.useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  async function fetchList(f: { from: string; to: string }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/comments/recent-comments?from=${f.from}&to=${f.to}&limit=250`,
        { cache: "no-store" }
      );
      const json: ApiResponse = await res.json();
      const mapped: Row[] = json.rows.map((r) => ({
        comment_id: r.comment_id,
        submitted_at: r.submitted_at,
        receipt_number: r.receipt_number,
        prompt: r.prompt,
        preview: r.preview,
        words: r.words,
        survey_title: r.survey_title,
        survey_version: r.survey_version,
        submission_link: r.submission_link,
      }));
      setServerRows(mapped);
      setRange(json.window);
    } catch {
      setServerRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetail(row: Row) {
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/admin/comments/recent-comments/summary?receiptNumber=${encodeURIComponent(
          row.receipt_number
        )}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as SubmissionDetail;
      setDetail(json);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  // initial fetch
  React.useEffect(() => {
    fetchList(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // subscribe to GlobalQuickFilter
  React.useEffect(() => {
    function onFilters(e: Event) {
      const detailEvt = (e as CustomEvent<{ from: string; to: string }>).detail;
      if (!detailEvt) return;
      setRange(detailEvt);
      fetchList(detailEvt);
    }
    window.addEventListener("dashboard:filters", onFilters as EventListener);
    return () => window.removeEventListener("dashboard:filters", onFilters as EventListener);
  }, []);

  const rowsToShow = serverRows == null ? SAMPLE_DATA : serverRows;
  const footer = `${range.from} → ${range.to}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="md:col-span-8 rounded-xl border bg-card px-4 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl tracking-normal">Recent Comments</CardTitle>
          <CardDescription className="text-sm">
            A live list of recent comment snippets, showing date and a link to the submission. This keeps managers grounded in real voices—not just metrics.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading && serverRows == null ? (
            <div className="w-full h-[600px] animate-pulse rounded-md bg-muted/40" aria-label="Loading comments…" />
          ) : (
            <DataTable
              rows={rowsToShow}
              columns={COLUMN_DEFS}
              selectedId={selected?.comment_id ?? null}
              onOpenRow={(row) => {
                setSelected(row);
                setOpen(true);
                fetchDetail(row);
              }}
            />
          )}
        </CardContent>

        <CardFooter className="px-6 text-xs text-muted-foreground">
          <p>{footer}</p>
        </CardFooter>
      </Card>

      {/* Submission Q&A dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setSelected(null);
            setDetail(null);
          }
        }}
      >
        {/* Flex column so body can scroll; capped height */}
        <DialogContent className="max-w-4xl w-[92vw] max-h-[75vh] p-0 overflow-hidden flex flex-col">
          {/* Sticky header with Close button */}
          <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b px-6 py-4">
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Receipt <span className="font-medium">{selected?.receipt_number ?? "—"}</span> ·{" "}
              <span>{selected ? formatDatePH(selected.submitted_at) : "—"}</span>{" "}
              {selected?.survey_version != null && (
                <Badge variant="outline" className="ml-2">v{selected.survey_version}</Badge>
              )}
            </DialogDescription>
            <DialogClose asChild>
              <button
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 focus-visible:outline-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {detailLoading ? (
              <div className="h-[240px] w-full animate-pulse rounded-md bg-muted/40" />
            ) : !detail ? (
              <div className="text-sm text-muted-foreground">— Unable to load submission —</div>
            ) : (
              <div className="grid gap-3 pb-6">
                {detail.items.map((it) => {
                  const isComment = it.question_key === "comments";
                  const answer =
                    it.text_value?.trim()?.length
                      ? it.text_value
                      : (it.option_label ?? it.option_value ?? "—");
                  return (
                    <div
                      key={it.question_id}
                      className={[
                        "rounded-md border p-3",
                        isComment ? "bg-[hsl(var(--chart-1)/0.30)]" : "",
                      ].join(" ")}
                    >
                      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {it.question_key}
                      </div>
                      <div className="mb-2 text-sm font-medium">{it.prompt}</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Close button */}
          <div className="border-t px-6 py-3 flex justify-end">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
