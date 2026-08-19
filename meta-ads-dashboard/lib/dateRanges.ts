import { DatePresetKey, DateRange } from "./types";

export const ACCOUNT_TIMEZONE = "Asia/Kolkata";
export const ACCOUNT_TIMEZONE_LABEL = "Asia/Kolkata (IST • UTC+05:30)";

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** "Now" expressed as an IST wall-clock Date (fields read as if local). */
function nowInIst(): Date {
  const utcMs = Date.now();
  return new Date(utcMs + IST_OFFSET_MINUTES * 60 * 1000);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function buildRange(presetKey: DatePresetKey, custom?: { since: string; until: string }): DateRange {
  const ist = nowInIst();
  const todayStr = toISODate(ist);

  switch (presetKey) {
    case "today":
      return { presetKey, since: todayStr, until: todayStr, label: "Today (Live)" };
    case "yesterday": {
      const y = toISODate(addDays(ist, -1));
      return { presetKey, since: y, until: y, label: "Yesterday" };
    }
    case "last2": {
      const since = toISODate(addDays(ist, -2));
      const until = toISODate(addDays(ist, -1));
      return { presetKey, since, until, label: "Last 2 Days" };
    }
    case "last7": {
      const since = toISODate(addDays(ist, -7));
      const until = toISODate(addDays(ist, -1));
      return { presetKey, since, until, label: "Last 7 Days" };
    }
    case "last14": {
      const since = toISODate(addDays(ist, -14));
      const until = toISODate(addDays(ist, -1));
      return { presetKey, since, until, label: "Last 14 Days" };
    }
    case "last30": {
      const since = toISODate(addDays(ist, -30));
      const until = toISODate(addDays(ist, -1));
      return { presetKey, since, until, label: "Last 30 Days" };
    }
    case "mtd": {
      const since = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-01`;
      return { presetKey, since, until: todayStr, label: "Current Month (MTD)" };
    }
    case "peak":
      // Resolved precisely server-side (highest-spend calendar month); this is the client default label.
      return { presetKey, since: "2026-07-01", until: "2026-07-31", label: "Peak Month Cohort" };
    case "lifetime":
      return { presetKey, since: "2020-01-01", until: todayStr, label: "Lifetime (All Time)" };
    case "custom":
      return {
        presetKey,
        since: custom?.since ?? toISODate(addDays(ist, -7)),
        until: custom?.until ?? todayStr,
        label: "Custom Range",
      };
    default:
      return { presetKey: "last30", since: toISODate(addDays(ist, -30)), until: todayStr, label: "Last 30 Days" };
  }
}

export function activeDaysCount(range: DateRange): number {
  const since = new Date(range.since + "T00:00:00Z");
  const until = new Date(range.until + "T00:00:00Z");
  const diff = Math.round((until.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "⚡ Today (Live)" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last2", label: "Last 2 Days" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last14", label: "Last 14 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "mtd", label: "Current Month MTD" },
  { key: "peak", label: "Peak Month Cohort" },
  { key: "lifetime", label: "Lifetime (All Time)" },
  { key: "custom", label: "Custom Range..." },
];
