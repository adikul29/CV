import {
  DollarSign,
  Award,
  Target,
  TrendingUp,
  Users,
  MousePointerClick,
  Smartphone,
  Layers,
} from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { DashboardMetrics } from "@/lib/aggregate";
import { formatCurrency, formatNumber, formatPercent, formatRoas, formatCompactNumber } from "@/lib/format";

interface KpiGridProps {
  metrics: DashboardMetrics;
  currency: string;
}

interface KpiCardDef {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: "rose" | "cyan" | "emerald";
}

export default function KpiGrid({ metrics, currency }: KpiGridProps) {
  const cards: KpiCardDef[] = [
    {
      icon: DollarSign,
      label: "Ad Spend",
      value: formatCurrency(metrics.spend, currency),
      sub: `${metrics.activeDays} active day${metrics.activeDays === 1 ? "" : "s"} in range`,
      accent: "rose",
    },
    {
      icon: Award,
      label: "Conversions (Sales)",
      value: formatNumber(metrics.purchases),
      sub: `${formatCurrency(metrics.revenue, currency)} revenue · ${formatRoas(metrics.roas)} ROAS`,
      accent: "emerald",
    },
    {
      icon: Users,
      label: "Leads / Registrations",
      value: formatNumber(metrics.leads),
      sub: `${formatCurrency(metrics.cpl, currency)} cost per lead`,
      accent: "cyan",
    },
    {
      icon: Target,
      label: "Initiated Checkouts",
      value: formatNumber(metrics.checkouts),
      sub: "Pipeline intent & drop-off volume",
      accent: "rose",
    },
    {
      icon: TrendingUp,
      label: "Impressions & Reach",
      value: formatCompactNumber(metrics.impressions),
      sub: `${formatCompactNumber(metrics.reach)} unique reach (est.)`,
      accent: "cyan",
    },
    {
      icon: MousePointerClick,
      label: "Clicks & Traffic",
      value: formatNumber(metrics.clicks),
      sub: `${formatCurrency(metrics.cpc, currency)} CPC · ${formatPercent(metrics.ctr)} CTR`,
      accent: "emerald",
    },
    {
      icon: Layers,
      label: "Core Target Demographic",
      value: metrics.topCohort?.label ?? "—",
      sub: metrics.topCohort ? `${metrics.topCohort.share.toFixed(1)}% of spend` : "No data",
      accent: "rose",
    },
    {
      icon: Smartphone,
      label: "Top Placement & Device",
      value: metrics.topPlacement?.label ?? "—",
      sub: `${metrics.mobilePct != null ? metrics.mobilePct.toFixed(0) + "% mobile" : "—"} · ${
        metrics.topDevice?.label ?? "—"
      }`,
      accent: "cyan",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <GlassCard key={c.label} accent={c.accent} className="p-5">
          <div className="flex items-start justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</span>
            <c.icon
              className={`h-4 w-4 ${
                c.accent === "rose" ? "text-rose-400" : c.accent === "cyan" ? "text-cyan-400" : "text-emerald-400"
              }`}
            />
          </div>
          <div className="mt-2 truncate text-2xl font-bold text-slate-50" title={c.value}>
            {c.value}
          </div>
          <div className="mt-1 truncate text-xs text-slate-400" title={c.sub}>
            {c.sub}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
