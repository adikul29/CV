"use client";

import { BadgeCheck, Clock, Globe, Printer, RefreshCw, Zap } from "lucide-react";
import { AccountMeta } from "@/lib/accounts";
import { ACCOUNT_TIMEZONE_LABEL } from "@/lib/dateRanges";

interface HeaderProps {
  accounts: AccountMeta[];
  liveMode: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  onRefresh: () => void;
  onPullLive: () => void;
  onPrint: () => void;
}

export default function Header({ accounts, liveMode, isSyncing, lastSynced, onRefresh, onPullLive, onPrint }: HeaderProps) {
  return (
    <header className="glass-card print-break px-6 py-5 md:px-8 md:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-100 md:text-2xl">
              <span className="text-gradient-rose">Meta Ads</span> Analytics &amp; Performance Intelligence
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                liveMode
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-300"
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {liveMode ? "Live Graph API" : "Verified Snapshot"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400 md:text-sm">
            {accounts.map((acc) => (
              <span
                key={acc.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono"
              >
                {acc.name}
                <span className="text-slate-500">act_{acc.id}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1">
              ₹ INR
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-cyan-300">
              <Globe className="h-3.5 w-3.5" />
              {ACCOUNT_TIMEZONE_LABEL}
            </span>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <div className="mr-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            Last Synced:{" "}
            <span className="font-mono text-slate-300">
              {lastSynced ? lastSynced.toLocaleTimeString("en-IN", { hour12: false }) : "—"}
            </span>
          </div>

          <button
            onClick={onPullLive}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-300 shadow-glow transition hover:bg-rose-500/20"
          >
            <Zap className="h-4 w-4" />
            Pull Today&apos;s Live Data
          </button>

          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin-slow" : ""}`} />
            Refresh All Data
          </button>

          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/20"
          >
            <Printer className="h-4 w-4" />
            Export / Print PDF Report
          </button>
        </div>
      </div>
    </header>
  );
}
