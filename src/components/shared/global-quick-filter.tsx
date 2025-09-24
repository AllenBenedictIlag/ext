// src/components/shared/global-quick-filter.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

/* ---------- Types ---------- */
export type GlobalFilters = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  versionId: string | null; // kept for compatibility, always null here
};

type Props = {
  onChange?: (f: GlobalFilters) => void;
  syncUrl?: boolean;
  storageKey?: string;
  className?: string;
};

/* ---------- Constants ---------- */
const DEFAULT_STORAGE_KEY = "dashboard:filters";
const TZ = "Asia/Manila";
const MIN_DATE = new Date(2023, 9, 1); // Oct 1, 2023
const YEAR_START = 2023;

/* ---------- Time helpers ---------- */
function todayInManila(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}
function MAX_DATE() { return todayInManila(); }
function yearEnd() { return MAX_DATE().getFullYear() + 1; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(base: Date, n: number) {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function isAfterMonth(a: Date, b: Date) {
  return a.getFullYear() > b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() > b.getMonth());
}
function isBeforeMonth(a: Date, b: Date) {
  return a.getFullYear() < b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth());
}
function clampDate(d: Date, min: Date, max: Date) { return d < min ? min : d > max ? max : d; }
function yyyymmdd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function lastNDays(n: number) {
  const to = MAX_DATE();
  const from = new Date(to);
  from.setDate(from.getDate() - (n - 1));
  return { from: clampDate(from, MIN_DATE, to), to };
}
function last30d() { return lastNDays(30); }
function last7d()  { return lastNDays(7);  }
function last3mo() { const to = MAX_DATE(); const from = clampDate(addMonths(to, -3), MIN_DATE, to); return { from, to }; }
function parseUrlDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function readInitial(sp: URLSearchParams, storageKey: string): DateRange {
  const max = MAX_DATE();
  const uf = parseUrlDate(sp.get("from"));
  const ut = parseUrlDate(sp.get("to"));
  if (uf && ut) return { from: clampDate(uf, MIN_DATE, max), to: clampDate(ut, MIN_DATE, max) };
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const j = JSON.parse(saved) as GlobalFilters;
      const from = parseUrlDate(j.from);
      const to   = parseUrlDate(j.to);
      if (from && to) return { from: clampDate(from, MIN_DATE, max), to: clampDate(to, MIN_DATE, max) };
    }
  } catch {}
  const { from, to } = last30d();
  return { from, to };
}

/* ---------- Dual calendar ---------- */
function DualMonthCalendar({
  selected,
  onSelect,
  initialLeftMonth,
}: {
  selected: import("react-day-picker").DateRange | undefined;
  onSelect: (r: import("react-day-picker").DateRange | undefined) => void;
  initialLeftMonth: Date;
}) {
  const maxDate = MAX_DATE();
  const safeLeftInit = startOfMonth(clampDate(initialLeftMonth, MIN_DATE, addMonths(maxDate, -1)));
  const [leftMonth, setLeftMonth] = React.useState<Date>(safeLeftInit);
  const [rightMonth, setRightMonth] = React.useState<Date>(addMonths(safeLeftInit, 1));

  React.useEffect(() => {
    const maxLeft = addMonths(startOfMonth(maxDate), -1);
    const minLeft = startOfMonth(MIN_DATE);
    const newLeft = isBeforeMonth(leftMonth, minLeft) ? minLeft :
                    isAfterMonth(leftMonth, maxLeft) ? maxLeft : leftMonth;
    if (newLeft !== leftMonth) setLeftMonth(newLeft);

    const minRight = addMonths(newLeft, 1);
    const maxRight = startOfMonth(maxDate);
    const newRight = isBeforeMonth(rightMonth, minRight) ? minRight :
                     isAfterMonth(rightMonth, maxRight) ? maxRight : rightMonth;
    if (newRight !== rightMonth) setRightMonth(newRight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMonth, rightMonth, maxDate]);

  const handleLeftMonthChange = (m: Date) => {
    const maxLeft = addMonths(startOfMonth(maxDate), -1);
    const minLeft = startOfMonth(MIN_DATE);
    const clamped = isBeforeMonth(m, minLeft) ? minLeft : isAfterMonth(m, maxLeft) ? maxLeft : m;
    setLeftMonth(clamped);
    if (!isAfterMonth(rightMonth, clamped)) setRightMonth(addMonths(clamped, 1));
  };
  const handleRightMonthChange = (m: Date) => {
    const minRight = addMonths(startOfMonth(MIN_DATE), 1);
    const maxRight = startOfMonth(MAX_DATE());
    const clamped = isBeforeMonth(m, minRight) ? minRight : isAfterMonth(m, maxRight) ? maxRight : m;
    setRightMonth(clamped);
    if (!isAfterMonth(clamped, leftMonth)) setLeftMonth(addMonths(clamped, -1));
  };

  const left_toMonth    = addMonths(rightMonth, -1);
  const left_minMonth   = startOfMonth(MIN_DATE);
  const right_fromMonth = addMonths(leftMonth, 1);
  const right_maxMonth  = startOfMonth(MAX_DATE());
  const disabled = [{ before: MIN_DATE }, { after: MAX_DATE() }];

  return (
    <div className="flex gap-2 p-2">
      <div className="rounded-md border">
        <Calendar
          mode="range"
          month={leftMonth}
          onMonthChange={handleLeftMonthChange}
          selected={selected}
          onSelect={onSelect}
          numberOfMonths={1}
          captionLayout="dropdown"
          fromYear={YEAR_START}
          toYear={yearEnd()}
          fromMonth={left_minMonth}
          toMonth={left_toMonth}
          disabled={disabled as any}
          initialFocus
          className="border-t"
        />
      </div>
      <div className="rounded-md border">
        <Calendar
          mode="range"
          month={rightMonth}
          onMonthChange={handleRightMonthChange}
          selected={selected}
          onSelect={onSelect}
          numberOfMonths={1}
          captionLayout="dropdown"
          fromYear={YEAR_START}
          toYear={yearEnd()}
          fromMonth={right_fromMonth}
          toMonth={right_maxMonth}
          disabled={disabled as any}
          initialFocus
          className="border-t"
        />
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export function GlobalQuickFilter({
  onChange,
  syncUrl = true,
  storageKey = DEFAULT_STORAGE_KEY,
  className,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // committed (filters + window preview)
  const initCommitted = React.useMemo(() => readInitial(searchParams, storageKey), []); // eslint-disable-line
  const [rangeCommitted, setRangeCommitted] = React.useState<DateRange>(initCommitted);

  // draft (only inside dropdown)
  const [rangeDraft, setRangeDraft] = React.useState<DateRange>(initCommitted);

  // dropdown open
  const [open, setOpen] = React.useState(false);

  // preset vs custom
  const [mode, setMode] = React.useState<"preset" | "custom">("custom");
  const [presetKey, setPresetKey] = React.useState<"90d" | "30d" | "7d" | undefined>(undefined);

  // label text mode
  const [labelMode, setLabelMode] = React.useState<"custom" | "range">("custom");

  const committedFrom = rangeCommitted?.from ?? last30d().from;
  const committedTo   = rangeCommitted?.to   ?? last30d().to;

  const committedFromLabel = format(committedFrom, "LLL d, yyyy");
  const committedToLabel   = format(committedTo,   "LLL d, yyyy");

  function apply(
    next: { from: Date; to: Date },
    opts?: { source?: "dropdown" | "preset" | "reset" }
  ) {
    const max = MAX_DATE();
    const nf0 = next.from <= next.to ? next.from : next.to;
    const nt0 = next.from <= next.to ? next.to   : next.from;
    const nf = clampDate(nf0, MIN_DATE, max);
    const nt = clampDate(nt0, MIN_DATE, max);

    const filters: GlobalFilters = { from: yyyymmdd(nf), to: yyyymmdd(nt), versionId: null };

    try { localStorage.setItem(storageKey, JSON.stringify(filters)); } catch {}

    if (syncUrl) {
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.set("from", filters.from);
      sp.set("to", filters.to);
      sp.delete("version");
      router.replace(`?${sp.toString()}`);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dashboard:filters", { detail: filters }));
    }
    onChange?.(filters);

    setRangeCommitted({ from: nf, to: nt });

    // Label + Toggle rules
    if (opts?.source === "dropdown") {
      // user applied a custom range -> clear preset highlight & show range on button
      setMode("custom");
      setPresetKey(undefined);
      setLabelMode("range");
    } else if (opts?.source === "preset") {
      setMode("preset");
      setLabelMode("custom");
    } else {
      // reset -> no preset highlighted, label back to "Custom"
      setMode("custom");
      setPresetKey(undefined);
      setLabelMode("custom");
    }

    setOpen(false);
  }

  function setQuick(value: string) {
    let next;
    if (value === "90d") next = last3mo();
    else if (value === "30d") next = last30d();
    else if (value === "7d")  next = last7d();
    else return;

    setPresetKey(value as "90d" | "30d" | "7d");
    setMode("preset");
    setLabelMode("custom"); // preset = show "Custom"
    apply(next, { source: "preset" });
  }

  function reset() {
    const d = last30d();
    setPresetKey(undefined);   // clear highlight
    setMode("custom");
    setLabelMode("custom");
    apply(d, { source: "reset" });
  }

  // Copy committed -> draft when opening dropdown
  React.useEffect(() => { if (open) setRangeDraft(rangeCommitted); }, [open, rangeCommitted]);

  const customButtonText =
    labelMode === "range"
      ? `${format(committedFrom, "LLL d")} – ${format(committedTo, "LLL d")}`
      : "Custom";

  const max = MAX_DATE();

  // Radix/our ToggleGroup: use empty string "" to mean “no selection”.
  const groupValue: string = mode === "preset" && presetKey ? presetKey : "";

  return (
    <div
      className={[
        "w-full border-b -mt-4 bg-background backdrop-blur supports-[backdrop-filter]:bg-background/50",
        "px-4 lg:px-6 py-2 flex flex-wrap items-center gap-2",
        className ?? "",
      ].join(" ")}
      role="region"
      aria-label="Global quick filters"
    >
      {/* Window preview (committed) */}
      <div className="text-xs text-muted-foreground">
        <span className="inline-flex items-center rounded-md bg-muted px-3 py-1">
          Date Range:&nbsp;<strong className="ml-1">{committedFromLabel}</strong>
          &nbsp;→&nbsp;<strong>{committedToLabel}</strong>
        </span>
      </div>

      {/* Controls */}
      <div className="ml-auto flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={groupValue}
          onValueChange={setQuick}
          variant="outline"
          className="flex flex-wrap gap-0 rounded-xl border bg-card shadow-sm"
        >
          <ToggleGroupItem className="px-4" value="90d">Last 3 months</ToggleGroupItem>
          <ToggleGroupItem className="px-4" value="30d">Last 30 days</ToggleGroupItem>
          <ToggleGroupItem className="px-4" value="7d">Last 7 days</ToggleGroupItem>
        </ToggleGroup>

        {/* Custom dropdown */}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[172px] justify-between">
              <span className="truncate">{customButtonText}</span>
              <IconChevronDown className="ml-2 h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-auto p-0" align="end">
            <DualMonthCalendar
              selected={rangeDraft}
              onSelect={(r) => {
                if (!r) return;
                const nf = clampDate(r.from ?? rangeDraft.from ?? MIN_DATE, MIN_DATE, max);
                const nt = clampDate(r.to   ?? r.from ?? rangeDraft.to ?? max, MIN_DATE, max);
                setRangeDraft({ from: nf, to: nt }); // draft only
              }}
              initialLeftMonth={rangeDraft?.from ?? todayInManila()}
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              <div className="text-xs text-muted-foreground">
                {rangeDraft?.from ? format(rangeDraft.from, "LLL d, yyyy") : "—"} —{" "}
                {rangeDraft?.to ? format(rangeDraft.to, "LLL d, yyyy") : "—"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // NEW: also flip UI back to “Custom” and clear preset highlight.
                    setRangeDraft(rangeCommitted);
                    setLabelMode("custom");   // outside button shows "Custom"
                    setMode("custom");        // unselect ToggleGroup highlight
                    setPresetKey(undefined);
                  }}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // close without applying changes
                    setOpen(false);
                    setRangeDraft(rangeCommitted);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    apply(
                      {
                        from: rangeDraft?.from ?? last30d().from,
                        to: rangeDraft?.to ?? last30d().to,
                      },
                      { source: "dropdown" } // ensures ToggleGroup clears & label shows range
                    )
                  }
                >
                  Apply
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
{/* 
        <Button onClick={reset} title="Reset to last 30 days">
          <IconRefresh className="mr-2 h-4 w-4" />
          Reset
        </Button> */}
      </div>
    </div>
  );
}
