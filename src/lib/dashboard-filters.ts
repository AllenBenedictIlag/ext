import type { DateRangeChoice } from "@/types/settings";

export const DASHBOARD_FILTER_STORAGE_KEY = "dashboard:filters";

const TZ = "Asia/Manila";
const MIN_DATE = new Date(2023, 9, 1); // Oct 1, 2023

function todayInManila(): Date {
  const nowPH = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  return new Date(nowPH.getFullYear(), nowPH.getMonth(), nowPH.getDate(), 0, 0, 0, 0);
}

function shiftMonths(base: Date, months: number) {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function formatYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDefaultDateRange(choice: DateRangeChoice | null | undefined) {
  if (!choice) return null;

  const to = todayInManila();
  let from = new Date(to);

  if (choice === "LAST_7") {
    from.setDate(from.getDate() - 6);
  } else if (choice === "LAST_30") {
    from.setDate(from.getDate() - 29);
  } else if (choice === "LAST_90") {
    from.setDate(from.getDate() - 89);
  } else if (choice === "LAST_365") {
    from = shiftMonths(from, -12);
  } else {
    return null;
  }

  if (from.getTime() < MIN_DATE.getTime()) {
    from = new Date(MIN_DATE.getTime());
  }

  return { from, to };
}

export function persistDefaultDateRange(choice: DateRangeChoice | null | undefined) {
  if (typeof window === "undefined") return;
  const range = buildDefaultDateRange(choice);
  if (!range) return;

  try {
    localStorage.setItem(
      DASHBOARD_FILTER_STORAGE_KEY,
      JSON.stringify({
        from: formatYMD(range.from),
        to: formatYMD(range.to),
        versionId: null,
      })
    );
  } catch {
    // ignore persistence failures (e.g., private mode)
  }
}
