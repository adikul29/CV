"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import DateRangeBar from "@/components/DateRangeBar";
import KpiGrid from "@/components/KpiGrid";
import TimeComparisonChart from "@/components/TimeComparisonChart";
import HierarchyTree from "@/components/HierarchyTree";
import Demographics from "@/components/Demographics";
import PlacementsDevices from "@/components/PlacementsDevices";
import StrategicAudit from "@/components/StrategicAudit";
import { TRACKED_ACCOUNTS } from "@/lib/accounts";
import { buildRange } from "@/lib/dateRanges";
import { AdAccountData, DailyPoint, DatePresetKey } from "@/lib/types";
import { mergeSeries } from "@/lib/dailySeries";
import { computeMetrics, mergeAgeBreakdown, mergeGenderBreakdown, mergeDevices, mergePlacements } from "@/lib/aggregate";
import { buildStrategicInsights } from "@/lib/insights";

interface ApiResponse {
  liveMode: boolean;
  source?: string;
  error?: string;
  fetchedAt: string;
  since: string;
  until: string;
  accounts: Record<string, AdAccountData>;
  dailySeries: Record<string, DailyPoint[]>;
}

export default function DashboardPage() {
  const [range, setRange] = useState(() => buildRange("last30"));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const load = useCallback(async (since: string, until: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/meta?since=${since}&until=${until}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setLastSynced(new Date());
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    load(range.since, range.until);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPreset = (key: DatePresetKey) => {
    if (key === "custom") {
      setRange((r) => ({ ...r, presetKey: "custom" }));
      return;
    }
    const next = buildRange(key);
    setRange(next);
    load(next.since, next.until);
  };

  const handleApplyCustom = (since: string, until: string) => {
    const next = buildRange("custom", { since, until });
    setRange(next);
    load(since, until);
  };

  const handleReset = () => {
    const next = buildRange("last30");
    setRange(next);
    load(next.since, next.until);
  };

  const handleRefresh = () => load(range.since, range.until);

  const handlePullLive = () => {
    const next = buildRange("today");
    setRange(next);
    load(next.since, next.until);
  };

  const handlePrint = () => window.print();

  const accounts: AdAccountData[] = useMemo(() => {
    if (!data) return [];
    return TRACKED_ACCOUNTS.map((a) => data.accounts[a.id]).filter(Boolean);
  }, [data]);

  const combinedSeries: DailyPoint[] = useMemo(() => {
    if (!data) return [];
    const seriesArrays = TRACKED_ACCOUNTS.map((a) => data.dailySeries[a.id] ?? []);
    return seriesArrays.reduce((acc, s) => mergeSeries(acc, s), [] as DailyPoint[]);
  }, [data]);

  const metrics = useMemo(() => computeMetrics(accounts, combinedSeries), [accounts, combinedSeries]);
  const mergedAge = useMemo(() => mergeAgeBreakdown(accounts), [accounts]);
  const mergedGender = useMemo(() => mergeGenderBreakdown(accounts), [accounts]);
  const mergedPlacements = useMemo(() => mergePlacements(accounts), [accounts]);
  const mergedDevices = useMemo(() => mergeDevices(accounts), [accounts]);
  const strategic = useMemo(() => buildStrategicInsights(accounts, metrics, "INR"), [accounts, metrics]);

  const loading = !data;

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 md:px-6 md:py-6">
      <Header
        accounts={TRACKED_ACCOUNTS}
        liveMode={Boolean(data?.liveMode)}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
        onRefresh={handleRefresh}
        onPullLive={handlePullLive}
        onPrint={handlePrint}
      />

      {data && !data.liveMode && (
        <div className="no-print rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-xs text-amber-200/90">
          Running on the bundled snapshot ({data.source ?? "last verified pull"}). Set{" "}
          <code className="rounded bg-black/30 px-1 py-0.5">META_ACCESS_TOKEN</code> in the server environment to switch this
          dashboard to true live Meta Graph API queries.
        </div>
      )}

      <DateRangeBar range={range} onSelectPreset={handleSelectPreset} onApplyCustom={handleApplyCustom} onReset={handleReset} />

      {loading ? (
        <div className="glass-card flex h-64 items-center justify-center text-sm text-slate-400">
          Pulling Meta Ads data…
        </div>
      ) : (
        <>
          <KpiGrid metrics={metrics} currency="INR" />
          <TimeComparisonChart series={combinedSeries} currency="INR" />
          <HierarchyTree accounts={accounts} />
          <Demographics age={mergedAge} gender={mergedGender} currency="INR" />
          <PlacementsDevices placements={mergedPlacements} devices={mergedDevices} currency="INR" />
          <StrategicAudit pillars={strategic.pillars} actions={strategic.actions} />

          <footer className="no-print pb-6 pt-2 text-center text-[11px] text-slate-600">
            Meta Ads Analytics &amp; Performance Intelligence · {TRACKED_ACCOUNTS.map((a) => a.name).join(" + ")} · Generated{" "}
            {new Date(data.fetchedAt).toLocaleString("en-IN")}
          </footer>
        </>
      )}
    </main>
  );
}
