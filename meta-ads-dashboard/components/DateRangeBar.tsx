"use client";

import { useState } from "react";
import { CalendarDays, RotateCcw } from "lucide-react";
import { DATE_PRESETS, activeDaysCount } from "@/lib/dateRanges";
import { DateRange, DatePresetKey } from "@/lib/types";

interface DateRangeBarProps {
  range: DateRange;
  onSelectPreset: (key: DatePresetKey) => void;
  onApplyCustom: (since: string, until: string) => void;
  onReset: () => void;
}

export default function DateRangeBar({ range, onSelectPreset, onApplyCustom, onReset }: DateRangeBarProps) {
  const [since, setSince] = useState(range.since);
  const [until, setUntil] = useState(range.until);

  return (
    <div className="glass-card print-break px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => onSelectPreset(preset.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition md:text-sm ${
              range.presetKey === preset.key
                ? "border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-glow"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays className="h-4 w-4" />
          From
        </div>
        <input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-rose-400/40"
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-rose-400/40"
        />
        <button
          onClick={() => onApplyCustom(since, until)}
          className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
        >
          Apply Range
        </button>
        <button
          onClick={() => {
            onReset();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 md:text-sm">
          <span className="font-mono text-slate-300">
            {range.since} → {range.until}
          </span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-emerald-300">
            {activeDaysCount(range)} active day{activeDaysCount(range) === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
