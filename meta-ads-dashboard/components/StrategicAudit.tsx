import { ShieldCheck, Users2, ShoppingCart, RefreshCcw, Rocket, ListChecks } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { ActionMatrix, Pillar } from "@/lib/insights";

interface StrategicAuditProps {
  pillars: Pillar[];
  actions: ActionMatrix;
}

const ICONS: Record<Pillar["icon"], React.ElementType> = {
  audience: Users2,
  checkout: ShoppingCart,
  funnel: RefreshCcw,
  scaling: Rocket,
};

const ACCENT_COLORS: Record<Pillar["icon"], string> = {
  audience: "text-rose-400 border-rose-400/30 bg-rose-500/10",
  checkout: "text-amber-400 border-amber-400/30 bg-amber-500/10",
  funnel: "text-cyan-400 border-cyan-400/30 bg-cyan-500/10",
  scaling: "text-emerald-400 border-emerald-400/30 bg-emerald-500/10",
};

export default function StrategicAudit({ pillars, actions }: StrategicAuditProps) {
  return (
    <div className="space-y-4">
      <GlassCard className="p-5 md:p-6" accent="emerald">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Strategic Audit — 4-Pillar Scaling Roadmap
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <div key={p.title} className={`rounded-xl border p-4 ${ACCENT_COLORS[p.icon]}`}>
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5" />
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold">{p.stat}</span>
                </div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-300">{p.title}</div>
                <div className="mt-1 text-sm font-semibold text-slate-50">{p.headline}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300/90">{p.detail}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-5 md:p-6" accent="rose">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
          <ListChecks className="h-5 w-5 text-rose-400" />
          Prioritized Action Matrix
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionColumn title="Immediate" sub="Week 1" items={actions.immediate} color="rose" />
          <ActionColumn title="Short-Term" sub="Weeks 1–2" items={actions.shortTerm} color="amber" />
          <ActionColumn title="Medium-Term" sub="Weeks 2–3" items={actions.mediumTerm} color="cyan" />
          <ActionColumn title="Ongoing" sub="Scaling Cadence" items={actions.ongoing} color="emerald" />
        </div>
      </GlassCard>
    </div>
  );
}

function ActionColumn({
  title,
  sub,
  items,
  color,
}: {
  title: string;
  sub: string;
  items: { title: string; detail: string }[];
  color: "rose" | "amber" | "cyan" | "emerald";
}) {
  const dot: Record<string, string> = {
    rose: "bg-rose-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.title} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[color]}`} />
            <div>
              <div className="text-xs font-medium text-slate-200">{item.title}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
