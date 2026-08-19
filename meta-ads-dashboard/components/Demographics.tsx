"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { AgeBreakdownRow, GenderBreakdownRow } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

interface DemographicsProps {
  age: AgeBreakdownRow[];
  gender: GenderBreakdownRow[];
  currency: string;
}

const GENDER_COLORS: Record<string, string> = {
  female: "#f43f5e",
  male: "#22d3ee",
  unknown: "#64748b",
};

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div className="mb-1 font-mono text-slate-400">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-semibold">{p.value?.toLocaleString?.("en-IN") ?? p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Demographics({ age, gender, currency }: DemographicsProps) {
  const totalLeads = age.reduce((s, a) => s + a.leads, 0);
  const totalPurchaseValue = age.reduce((s, a) => s + a.purchaseValue, 0);
  const totalGenderSpend = gender.reduce((s, g) => s + g.spend, 0);

  const genderPie = gender.map((g) => ({ name: capitalize(g.gender), value: g.spend, key: g.gender }));

  return (
    <GlassCard className="p-5 md:p-6" accent="rose">
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
        <Users className="h-5 w-5 text-rose-400" />
        Demographic &amp; Persona Deep Dive
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={age}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="age" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={45} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="spend" name="Spend" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Age Group</th>
                  <th className="px-3 py-2 font-medium">Spend</th>
                  <th className="px-3 py-2 font-medium">Leads</th>
                  <th className="px-3 py-2 font-medium">% Lead Share</th>
                  <th className="px-3 py-2 font-medium">Purchase Value</th>
                  <th className="px-3 py-2 font-medium">% Purchase Share</th>
                </tr>
              </thead>
              <tbody>
                {age.map((row) => (
                  <tr key={row.age} className="border-t border-white/5 text-slate-300">
                    <td className="px-3 py-2 font-medium text-slate-100">{row.age}</td>
                    <td className="px-3 py-2">{formatCurrency(row.spend, currency)}</td>
                    <td className="px-3 py-2">{formatNumber(row.leads)}</td>
                    <td className="px-3 py-2">{formatPercent(totalLeads > 0 ? (row.leads / totalLeads) * 100 : 0, 1)}</td>
                    <td className="px-3 py-2">{formatCurrency(row.purchaseValue, currency)}</td>
                    <td className="px-3 py-2">
                      {formatPercent(totalPurchaseValue > 0 ? (row.purchaseValue / totalPurchaseValue) * 100 : 0, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {genderPie.map((entry) => (
                    <Cell key={entry.key} fill={GENDER_COLORS[entry.key] ?? "#64748b"} stroke="none" />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            {gender.map((g) => (
              <div key={g.gender} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: GENDER_COLORS[g.gender] ?? "#64748b" }} />
                  {capitalize(g.gender)}
                </span>
                <span className="font-medium text-slate-100">
                  {formatPercent(totalGenderSpend > 0 ? (g.spend / totalGenderSpend) * 100 : 0, 1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
