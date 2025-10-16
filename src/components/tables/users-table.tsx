// src/components/superadmin/users/users-table.tsx
"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ArrowUpDown,
  Columns3,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Loader2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  LIGHT OVERLAY MODALS (Radix wrappers with non-blocking close)             */
/* -------------------------------------------------------------------------- */
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/** Light (blurred) AlertDialog */
const LA = {
  Root: AlertDialogPrimitive.Root,
  Trigger: AlertDialogPrimitive.Trigger,
  Portal: AlertDialogPrimitive.Portal,
  Cancel: AlertDialogPrimitive.Cancel,
  Action: AlertDialogPrimitive.Action,
  Title: AlertDialogPrimitive.Title,
  Description: AlertDialogPrimitive.Description,
  Content: React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
  >(function LightAlertDialogContent({ className, ...props }, ref) {
    return (
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=closed]:pointer-events-none"
          )}
        />
        <AlertDialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "gap-4 rounded-lg border bg-card p-6 shadow-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            className
          )}
          {...props}
        />
      </AlertDialogPrimitive.Portal>
    );
  }),
};

/** Light (blurred) Dialog — used for Invite */
const LD = {
  Root: DialogPrimitive.Root,
  Trigger: DialogPrimitive.Trigger,
  Portal: DialogPrimitive.Portal,
  Title: DialogPrimitive.Title,
  Description: DialogPrimitive.Description,
  Content: React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
      modal?: boolean;
    }
  >(function LightDialogContent({ className, modal = true, ...props }, ref) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50",
            modal ? "bg-background/70 backdrop-blur-sm" : "bg-transparent",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=closed]:pointer-events-none"
          )}
        />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "gap-4 rounded-lg border bg-card p-6 shadow-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            className
          )}
          {...props}
        />
      </DialogPrimitive.Portal>
    );
  }),
};

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                     */
/* -------------------------------------------------------------------------- */

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
  rightActions?: React.ReactNode;
  /** Per-row actions rendered into the last cell */
  renderActions?: (row: T) => React.ReactNode;
  /** Optional: override export title/filename slug */
  exportTitle?: string;
  /** Optional: exclude certain columns from export */
  exportExcludeColumns?: (keyof T & string)[];
};

/* -------------------------------------------------------------------------- */
/*  HELPERS                                                                   */
/* -------------------------------------------------------------------------- */

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
  return col ? col.accessor(row) : undefined;
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
    <span className={cn("block truncate", className)} title={title ?? text}>
      {truncate(text)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  INVITE DIALOG                                                             */
/* -------------------------------------------------------------------------- */

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvited: () => Promise<void> | void;
}) {
  const [firstName, setFirst] = React.useState("");
  const [lastName, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [busy, setBusy] = React.useState(false);
  const [tempShown, setTempShown] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/users/users-table", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          role,
          send_later: true,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: Row;
        temp_password?: string;
      };
      if (res.ok && json.temp_password) {
        setTempShown(json.temp_password);
        await onInvited();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <LD.Root open={open} onOpenChange={onOpenChange}>
      <LD.Content>
        <div className="space-y-2">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Invite a new admin
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            Creates a user with a temporary password (shown after creation). You
            can send an email later.
          </DialogPrimitive.Description>
        </div>

        <div className="mt-3 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLast(e.target.value)}
            />
          </div>
          <Input
            type="email"
            placeholder="email@domain.tld"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Select value={role} onValueChange={(v) => setRole(v as Row["role"])}>
              <SelectTrigger className="w-[180px]" aria-label="Role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tempShown && (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-1 font-medium">Temporary password</div>
              <code className="select-all">{tempShown}</code>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="btn-halo btn-halo--emph">
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </LD.Content>
    </LD.Root>
  );
}

/* -------------------------------------------------------------------------- */
/*  DATATABLE (SCROLL-ONLY) + SIMPLE TWO-STEP EXPORT (NO DATE RANGE)          */
/* -------------------------------------------------------------------------- */

function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  highlightRows = true,
  searchKeys,
  getRowKey,
  rightActions,
  renderActions,
  exportTitle = "Users",
  exportExcludeColumns = [],
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState<string>("");
  const [sort, setSort] = React.useState<SortState<T> | undefined>(defaultSort);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(
    Object.fromEntries(columns.map((c) => [c.id, c.visible !== false]))
  );

  // ---- Export (Two-step: choose format → confirm). No date ranges.
  const [exportOpen, setExportOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  type ExportFormat = "CSV" | "PRINTABLE";
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("CSV");
  const FORMAT_LABEL: Record<ExportFormat, string> = {
    CSV: "CSV file",
    PRINTABLE: "Printable table (PDF via print dialog)",
  };

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[c.id]),
    [columns, visibility]
  );
  const exportExcludeSet = React.useMemo(
    () => new Set(exportExcludeColumns),
    [exportExcludeColumns]
  );
  const exportColumns = React.useMemo(() => {
    const filtered = visibleColumns.filter(
      (c) => !exportExcludeSet.has(c.id as keyof T & string)
    );
    return filtered.length > 0 ? filtered : visibleColumns;
  }, [visibleColumns, exportExcludeSet]);

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

  const toggleCol = (id: string) =>
    setVisibility((v) => ({ ...v, [id]: !v[id] }));

  // ---- Export helpers (no date filters; always export "sorted")
  const exportPreviewCount = sorted.length;

  async function logExport(meta: {
    resource: string;
    format: string;
    rowCount: number;
    columns: string[];
    query: string;
  }) {
    try {
      await fetch("/api/superadmin/audit/log-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(meta),
      });
    } catch {
      // non-blocking
    }
  }

  function buildCSVFor(list: T[]): string {
    const cols = exportColumns.length ? exportColumns : visibleColumns;
    const headers = cols.map((c) => c.header);
    const rows = list.map((row) =>
      cols.map((c) => {
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
    return csv;
  }

  function downloadCSV(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return match;
      }
    });
  }

  function currentDatePH(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  }
  function formatDisplayDatePH(d: Date): string {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    }).format(d);
  }
  function formatFileDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  function slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "export";
  }

  function openPrintableTable(list: T[], docTitle: string) {
    if (typeof window === "undefined") return;
    const cols = exportColumns.length ? exportColumns : visibleColumns;
    const headersHtml = cols.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
    const rowsHtml = list.length
      ? list
          .map((row) => {
            const cells = cols
              .map((c) => {
                const raw = c.accessor(row);
                let text: string;
                if (typeof raw === "string" && /\d{4}-\d{2}-\d{2}T/.test(raw)) {
                  text = formatDatePH(raw);
                } else if (raw == null) {
                  text = "";
                } else {
                  text = String(raw);
                }
                return `<td>${escapeHtml(text)}</td>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${cols.length}" style="text-align:center;">No rows to export</td></tr>`;
    const generatedAt = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(docTitle)}</title>
    <style>
      :root { color-scheme: light; }
      body {
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        margin: 24px;
        color: #1f2937;
        background: #fff;
      }
      h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 600; }
      .meta { margin: 0 0 16px 0; font-size: 12px; color: #4b5563; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
      th { background: #f3f4f6; font-weight: 600; }
      @media print { body { margin: 12px; } h1 { font-size: 18px; } table { font-size: 11px; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(docTitle)}</h1>
    <p class="meta">Generated ${escapeHtml(generatedAt)}</p>
    <table>
      <thead><tr>${headersHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;

    const printable = window.open("", "_blank");
    if (!printable) {
      console.warn("Unable to open printable export window.");
      return;
    }
    printable.document.open();
    printable.document.write(html);
    printable.document.close();
    printable.document.title = docTitle;

    const triggerPrint = () => {
      try {
        printable.focus();
      } catch {}
      try {
        printable.print();
      } catch {}
    };

    const cleanup = () => {
      try {
        printable.close();
      } catch {}
    };

    if (typeof printable.addEventListener === "function") {
      printable.addEventListener("afterprint", cleanup, { once: true });
    }
    setTimeout(cleanup, 60_000);

    if (printable.document.readyState === "complete") {
      setTimeout(triggerPrint, 100);
    } else if (typeof printable.addEventListener === "function") {
      printable.addEventListener(
        "load",
        () => {
          setTimeout(triggerPrint, 100);
        },
        { once: true }
      );
    } else {
      setTimeout(triggerPrint, 150);
    }
  }

  // ---- UI
  return (
    <div className="space-y-3">
      {/* Controls (no pagination) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[360px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search users"
            placeholder="Search name, email, role, status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          {rightActions}

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
                  onCheckedChange={() =>
                    c.toggleable !== false && toggleCol(c.id)
                  }
                  disabled={c.toggleable === false}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Step 1: Choose format (no date range) */}
          <Button
            variant="default"
            size="sm"
            aria-label="Export rows"
            className="btn-halo btn-halo--emph"
            onClick={() => setExportOpen(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <LA.Root
            open={exportOpen}
            onOpenChange={(o) => {
              setExportOpen(o);
              if (!o) setConfirmOpen(false);
            }}
          >
            <LA.Content onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <LA.Title className="text-lg font-semibold">Export users</LA.Title>
                <LA.Description className="text-sm text-muted-foreground">
                  Exports the current table <strong>filter &amp; sort</strong> (no date range).
                </LA.Description>
              </div>

              <div className="grid gap-4 mt-2">
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Format</span>
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                    <SelectTrigger className="w-full border-2 border-primary/70 hover:border-primary data-[state=open]:border-primary focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-primary/30 shadow-lg">
                      <SelectItem value="CSV">CSV (.csv)</SelectItem>
                      <SelectItem value="PRINTABLE">Printable table (PDF via print)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{exportPreviewCount}</span>{" "}
                  row{exportPreviewCount === 1 ? "" : "s"} will be exported
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <LA.Cancel asChild>
                  <Button variant="outline">Cancel</Button>
                </LA.Cancel>
                <Button
                  onClick={() => {
                    setExportOpen(false);
                    setTimeout(() => setConfirmOpen(true), 10);
                  }}
                  className="btn-halo"
                  disabled={exportPreviewCount === 0}
                >
                  Continue
                </Button>
              </div>
            </LA.Content>
          </LA.Root>

          {/* Step 2: Confirm */}
          <LA.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
            <LA.Content onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <LA.Title className="text-lg font-semibold">Confirm export</LA.Title>
                <LA.Description className="text-sm text-muted-foreground">
                  Export current filtered &amp; sorted rows as{" "}
                  <span className="font-medium">{FORMAT_LABEL[exportFormat]}</span>?
                </LA.Description>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <LA.Cancel asChild>
                  <Button variant="outline">Back</Button>
                </LA.Cancel>
                <LA.Action asChild>
                  <Button
                    className="btn-halo btn-halo--emph"
                    onClick={async () => {
                      const list = sorted;
                      const nowPH = currentDatePH();
                      const displayDate = formatDisplayDatePH(nowPH);
                      const docTitle = `${exportTitle} (Export) ${displayDate}`;

                      if (exportFormat === "CSV") {
                        const csv = buildCSVFor(list);
                        const fileName = `${slugify(exportTitle)}-export-${formatFileDate(nowPH)}.csv`;
                        downloadCSV(fileName, csv);
                        await logExport({
                          resource: "users",
                          format: "csv",
                          rowCount: list.length,
                          columns: exportColumns.map((c) => String(c.id)),
                          query,
                        });
                      } else {
                        openPrintableTable(list, docTitle);
                        await logExport({
                          resource: "users",
                          format: "printable",
                          rowCount: list.length,
                          columns: exportColumns.map((c) => String(c.id)),
                          query,
                        });
                      }

                      setConfirmOpen(false);
                    }}
                  >
                    Yes, export
                  </Button>
                </LA.Action>
              </div>
            </LA.Content>
          </LA.Root>
        </div>
      </div>

      {/* Table (scroll-only) */}
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-[680px] overflow-auto">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {columns
                  .filter((c) => visibility[c.id])
                  .map((c) => (
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
                        onClick={() =>
                          c.sortable &&
                          setSort((prev) => {
                            if (!prev || prev.id !== c.id) {
                              return { id: c.id, dir: "desc" };
                            }
                            return {
                              id: c.id,
                              dir: prev.dir === "desc" ? "asc" : "desc",
                            };
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-1 text-left",
                          c.align === "right" && "justify-end",
                          c.align === "center" && "justify-center",
                          c.sortable ? "cursor-pointer select-none" : "cursor-default"
                        )}
                        aria-label={`Sort by ${c.header}`}
                      >
                        <span>{c.header}</span>
                        {c.sortable && (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                {/* actions column */}
                <TableHead className="w-[64px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, i) => {
                const key: React.Key = getRowKey ? getRowKey(row, i) : String(i);
                return (
                  <TableRow
                    key={key}
                    className={cn(
                      "hover:bg-accent/30 focus-within:bg-accent/30",
                      "odd:bg-muted/30 even:bg-card",
                      highlightRows && "bg-[hsl(var(--chart-1)/0.30)]/10"
                    )}
                  >
                    {columns
                      .filter((c) => visibility[c.id])
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

                    {/* Actions cell */}
                    <TableCell className="align-middle text-right">
                      {renderActions?.(row)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  REMOTE FETCH with SOFT REVALIDATION + MUTATE (no table reload)            */
/* -------------------------------------------------------------------------- */

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
  children: (
    rows: Row[],
    loading: boolean, // first load only
    error: boolean,
    refetch: (opts?: { soft?: boolean }) => void,
    mutate: (updater: (prev: Row[]) => Row[]) => void,
    fetching: boolean // soft background revalidation
  ) => React.ReactNode;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetching, setFetching] = React.useState(false);
  const [error, setError] = React.useState(false);

  const refetch = React.useCallback(async (opts?: { soft?: boolean }) => {
    try {
      opts?.soft ? setFetching(true) : setLoading(true);
      setError(false);
      const res = await fetch(
        "/api/superadmin/users/users-table?limit=500&sort=updated_at&dir=desc",
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(String(res.status));
      const json: ApiResponse = await res.json();
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError(true);
    } finally {
      opts?.soft ? setFetching(false) : setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const mutate = React.useCallback(
    (updater: (prev: Row[]) => Row[]) => setRows((prev) => updater(prev)),
    []
  );

  return <>{children(rows, loading, error, refetch, mutate, fetching)}</>;
}

function SkeletonRows() {
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

/* -------------------------------------------------------------------------- */
/*  MAIN COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

export type UsersTableProps = {
  highlightRows?: boolean;
};

export default function UsersTable({ highlightRows = true }: UsersTableProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);

  // unified confirm state
  const [confirm, setConfirm] = React.useState<{
    kind: "status" | "role" | "reset" | "revoke";
    row: Row | null;
    next?: string;
  }>({ kind: "status", row: null, next: undefined });

  const [busy, setBusy] = React.useState(false);
  const [tempShown, setTempShown] = React.useState<string | null>(null);

  // Helper: open dialog after dropdown has fully closed (prevents frozen UI)
  const openAfterMenuClose = (fn: () => void) => () => {
    setTimeout(fn, 0);
  };

  async function doPost(payload: object) {
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin/users/users-table", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as unknown;
      return { ok: res.ok, json };
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      {/* <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="tracking-normal">Users &amp; Roles (Super Admin)</CardTitle>
          <CardDescription>
            Manage who can access Admin and Super Admin functions. Invite users, change roles, revoke access, and control status.
          </CardDescription>
        </div>
      </CardHeader> */}
      <CardContent className="pb-4 flex-col">
        <UsersRemoteData>
          {(rows, loading, error, refetch, mutate, fetching) => {
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

            const rightActions = (
              <div className="flex items-center gap-2">
                {fetching && <Loader2 className="h-4 w-4 animate-spin opacity-60" aria-hidden />}
                {/* <Button
                  size="sm"
                  className="btn-halo btn-halo--emph"
                  onClick={() => setInviteOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Invite
                </Button> */}
              </div>
            );

            if (loading && rows.length === 0) return <SkeletonRows />;
            if (error)
              return (
                <div className="text-sm text-destructive">
                  Failed to load users. Please retry.
                </div>
              );

            return (
              <>
                <DataTable<Row>
                  data={rows}
                  columns={COLUMNS}
                  defaultSort={{ id: "updated_at", dir: "desc" }}
                  highlightRows={highlightRows}
                  searchKeys={["name", "email", "role", "status"]}
                  getRowKey={(r) => r.admin_id}
                  rightActions={rightActions}
                  renderActions={(r) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Manage user</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "role", row: r, next: "ADMIN" })
                          )}
                        >
                          Set role: Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "role", row: r, next: "SUPER_ADMIN" })
                          )}
                        >
                          Set role: Super Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "status", row: r, next: "ACTIVE" })
                          )}
                        >
                          Mark Active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "status", row: r, next: "INACTIVE" })
                          )}
                        >
                          Mark Inactive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "status", row: r, next: "SUSPENDED" })
                          )}
                        >
                          Mark Suspended
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "reset", row: r })
                          )}
                        >
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={openAfterMenuClose(() =>
                            setConfirm({ kind: "revoke", row: r })
                          )}
                        >
                          Revoke access (suspend + logout)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  exportTitle="Users"
                />

                {/* INVITE
                <InviteDialog
                  open={inviteOpen}
                  onOpenChange={(o) => setInviteOpen(o)}
                  onInvited={() => refetch({ soft: true })}
                /> */}

                {/* GLOBAL CONFIRM */}
                <LA.Root
                  open={!!confirm.row}
                  onOpenChange={(o) => !o && setConfirm({ kind: "status", row: null })}
                >
                  <LA.Content onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="space-y-2">
                      <LA.Title className="text-lg font-semibold">
                        {confirm.kind === "status" && `Change status to ${confirm.next}`}
                        {confirm.kind === "role" &&
                          `Change role to ${confirm.next === "SUPER_ADMIN" ? "Super Admin" : "Admin"}`}
                        {confirm.kind === "reset" && `Reset password`}
                        {confirm.kind === "revoke" && `Revoke access (suspend + logout)`}
                      </LA.Title>
                      <LA.Description className="text-sm text-muted-foreground">
                        {confirm.kind === "reset"
                          ? "A new temporary password will be generated."
                          : confirm.kind === "revoke"
                          ? "This will set status to SUSPENDED and attempt to sign out all active sessions."
                          : "This will update the selected user immediately."}
                      </LA.Description>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <LA.Cancel asChild>
                        <Button variant="outline" disabled={busy}>
                          Cancel
                        </Button>
                      </LA.Cancel>
                      <LA.Action asChild>
                        <Button
                          disabled={busy}
                          onClick={async () => {
                            if (!confirm.row) return;

                            const id = confirm.row.admin_id;
                            const now = new Date().toISOString();

                            if (confirm.kind === "status" && confirm.next) {
                              // optimistic status
                              mutate((prev) =>
                                prev.map((r) =>
                                  r.admin_id === id
                                    ? { ...r, status: confirm.next as Row["status"], updated_at: now }
                                    : r
                                )
                              );
                              await doPost({
                                action: "update_status",
                                admin_id: id,
                                status: confirm.next,
                              });
                            } else if (confirm.kind === "role" && confirm.next) {
                              // optimistic role
                              mutate((prev) =>
                                prev.map((r) =>
                                  r.admin_id === id
                                    ? { ...r, role: confirm.next as Row["role"], updated_at: now }
                                    : r
                                )
                              );
                              await doPost({
                                action: "change_role",
                                admin_id: id,
                                role: confirm.next,
                              });
                            } else if (confirm.kind === "reset") {
                              const { ok, json } = await doPost({
                                action: "reset_password",
                                admin_id: id,
                              });
                              if (ok && (json as { temp_password?: string }).temp_password) {
                                setTempShown((json as { temp_password: string }).temp_password);
                              }
                            } else if (confirm.kind === "revoke") {
                              // optimistic revoke => suspended
                              mutate((prev) =>
                                prev.map((r) =>
                                  r.admin_id === id
                                    ? { ...r, status: "SUSPENDED", updated_at: now }
                                    : r
                                )
                              );
                              await doPost({
                                action: "revoke_access",
                                admin_id: id,
                              });
                            }

                            setConfirm({ kind: "status", row: null });
                            // background revalidate (no skeleton flash)
                            void refetch({ soft: true });
                          }}
                          className="btn-halo btn-halo--emph"
                        >
                          {busy ? "Working…" : "Continue"}
                        </Button>
                      </LA.Action>
                    </div>
                  </LA.Content>
                </LA.Root>

                {/* TEMP PASSWORD DISPLAY AFTER RESET */}
                <LA.Root
                  open={tempShown != null}
                  onOpenChange={(o) => !o && setTempShown(null)}
                >
                  <LA.Content>
                    <div className="space-y-2">
                      <LA.Title className="text-lg font-semibold">
                        Temporary password
                      </LA.Title>
                      <LA.Description className="text-sm">
                        <code className="select-all">{tempShown ?? ""}</code>
                      </LA.Description>
                    </div>
                    <div className="mt-4 flex items-center justify-end">
                      <LA.Action asChild>
                        <Button onClick={() => setTempShown(null)}>Close</Button>
                      </LA.Action>
                    </div>
                  </LA.Content>
                </LA.Root>
              </>
            );
          }}
        </UsersRemoteData>
      </CardContent>
    </Card>
  );
}
