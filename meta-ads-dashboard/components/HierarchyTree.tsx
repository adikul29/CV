"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Layers, Megaphone, Rocket } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { AdAccountData, Ad, AdSet, Campaign } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/format";

interface HierarchyTreeProps {
  accounts: AdAccountData[];
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  PAUSED: "border-slate-400/30 bg-slate-400/10 text-slate-400",
  ARCHIVED: "border-slate-500/30 bg-slate-500/10 text-slate-500",
  DELETED: "border-red-400/30 bg-red-400/10 text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PAUSED}`}>
      {status}
    </span>
  );
}

function adsManagerLink(accountId: string, kind: "campaign" | "adset" | "ad", id: string) {
  const param = kind === "campaign" ? "selected_campaign_ids" : kind === "adset" ? "selected_adset_ids" : "selected_ad_ids";
  return `https://adsmanager.facebook.com/adsmanager/manage/${kind}s?act=${accountId}&${param}=${id}`;
}

export default function HierarchyTree({ accounts }: HierarchyTreeProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  const toggleCampaign = (id: string) =>
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAdset = (id: string) =>
    setExpandedAdsets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <GlassCard className="p-5 md:p-6" accent="rose">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
          <Layers className="h-5 w-5 text-rose-400" />
          Campaign → Ad Set → Creative Hierarchy
        </h3>
        <label className="no-print flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-rose-500"
          />
          Show zero-spend / inactive campaigns
        </label>
      </div>

      <div className="mt-4 space-y-6">
        {accounts.map((account) => {
          const campaigns = [...account.campaigns]
            .filter((c) => showInactive || c.spend > 0)
            .sort((a, b) => b.spend - a.spend);
          return (
            <div key={account.id}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Rocket className="h-3.5 w-3.5 text-cyan-400" />
                {account.name} <span className="font-mono text-slate-600">act_{account.id}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                {campaigns.map((c) => (
                  <CampaignRow
                    key={c.id}
                    account={account}
                    campaign={c}
                    expanded={expandedCampaigns.has(c.id)}
                    onToggle={() => toggleCampaign(c.id)}
                    expandedAdsets={expandedAdsets}
                    onToggleAdset={toggleAdset}
                  />
                ))}
                {campaigns.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">No campaigns match the current filter.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function CampaignRow({
  account,
  campaign,
  expanded,
  onToggle,
  expandedAdsets,
  onToggleAdset,
}: {
  account: AdAccountData;
  campaign: Campaign;
  expanded: boolean;
  onToggle: () => void;
  expandedAdsets: Set<string>;
  onToggleAdset: (id: string) => void;
}) {
  const adsets = useMemo(() => account.adsets.filter((a) => a.campaignId === campaign.id), [account.adsets, campaign.id]);

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.05]"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{campaign.name}</span>
            <StatusBadge status={campaign.status} />
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
              {campaign.objective.replace("OUTCOME_", "")}
            </span>
          </div>
        </div>
        <div className="hidden shrink-0 grid-cols-4 gap-4 text-right text-xs md:grid">
          <Metric label="Spend" value={formatCurrency(campaign.spend, account.currency)} />
          <Metric label="Leads" value={formatNumber(campaign.leads)} />
          <Metric label="Sales" value={formatNumber(campaign.purchases)} />
          <Metric label="ROAS" value={formatRoas(campaign.roas)} />
        </div>
      </button>

      {expanded && (
        <div className="bg-black/20 px-4 pb-3 pt-1 md:pl-10">
          {adsets.length === 0 && <div className="py-2 text-xs text-slate-500">No ad set detail captured for this campaign.</div>}
          {adsets.map((adset) => (
            <AdSetRow
              key={adset.id}
              account={account}
              adset={adset}
              expanded={expandedAdsets.has(adset.id)}
              onToggle={() => onToggleAdset(adset.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdSetRow({
  account,
  adset,
  expanded,
  onToggle,
}: {
  account: AdAccountData;
  adset: AdSet;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ads = useMemo(() => account.ads.filter((a) => a.adsetId === adset.id), [account.ads, adset.id]);
  const t = adset.targeting;
  const geo = t.cities?.length ? t.cities.slice(0, 3).join(", ") + (t.cities.length > 3 ? "…" : "") : t.countries?.join(", ") ?? "—";

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02]">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04]">
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-slate-200">{adset.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>🎯 {t.ageMin ?? "—"}–{t.ageMax ?? "—"} · {(t.genders?.length ? t.genders.join("/") : "All genders")}</span>
            <span>📍 {geo}</span>
            {t.customAudiences?.length ? <span>👥 {t.customAudiences[0]}{t.customAudiences.length > 1 ? ` +${t.customAudiences.length - 1}` : ""}</span> : null}
            <span>⚙ {adset.optimizationGoal ?? "—"}</span>
          </div>
        </div>
        <div className="hidden shrink-0 grid-cols-2 gap-4 text-right text-xs sm:grid">
          <Metric label="Spend" value={formatCurrency(adset.spend, account.currency)} />
          <Metric label="CPL" value={formatCurrency(adset.costPerLead, account.currency)} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-white/5 px-3 py-2 pl-8">
          {ads.length === 0 && <div className="py-1 text-xs text-slate-500">No ad-level rows captured for this ad set.</div>}
          {ads.map((ad) => (
            <AdRow key={ad.id} account={account} ad={ad} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdRow({ account, ad }: { account: AdAccountData; ad: Ad }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/5 bg-black/20 px-3 py-2">
      <Megaphone className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-slate-200">{ad.name}</span>
          <StatusBadge status={ad.status} />
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          Creative ID: <span className="font-mono">{ad.creativeId ?? "—"}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-right text-[11px] sm:grid-cols-4">
        <Metric label="Spend" value={formatCurrency(ad.spend, account.currency)} compact />
        <Metric label="Leads" value={formatNumber(ad.leads)} compact />
        <Metric label="CTR" value={formatPercent(ad.ctr)} compact />
        <Metric label="CPC" value={formatCurrency(ad.cpc, account.currency)} compact />
      </div>
      <a
        href={adsManagerLink(account.id, "ad", ad.id)}
        target="_blank"
        rel="noreferrer"
        className="no-print inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-300 transition hover:bg-cyan-400/20"
      >
        Preview <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function Metric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <div className={`text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>{label}</div>
      <div className={`font-semibold text-slate-200 ${compact ? "text-[11px]" : "text-xs"}`}>{value}</div>
    </div>
  );
}
