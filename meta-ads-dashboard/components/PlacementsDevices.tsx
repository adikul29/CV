"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Smartphone, Globe } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { DeviceRow, PlacementRow } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { prettyDevice, prettyPlacement } from "@/lib/aggregate";

interface PlacementsDevicesProps {
  placements: PlacementRow[];
  devices: DeviceRow[];
  currency: string;
}

const DEVICE_COLORS: Record<string, string> = {
  mobile_app: "#f43f5e",
  mobile_web: "#fb923c",
  desktop: "#22d3ee",
  unknown: "#64748b",
};

function DarkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div style={{ color: p.color || p.fill }}>
        {p.payload.label ?? p.name}: <span className="font-semibold">{p.value?.toLocaleString?.("en-IN") ?? p.value}</span>
      </div>
    </div>
  );
}

export default function PlacementsDevices({ placements, devices, currency }: PlacementsDevicesProps) {
  const topPlacements = [...placements].filter((p) => p.spend > 0).slice(0, 8).map((p) => ({
    label: prettyPlacement(p.platform_position),
    spend: p.spend,
  }));
  const totalDeviceSpend = devices.reduce((s, d) => s + d.spend, 0);
  const devicePie = devices
    .filter((d) => d.spend > 0)
    .map((d) => ({ name: prettyDevice(d.device_platform), value: d.spend, key: d.device_platform }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GlassCard className="p-5 md:p-6" accent="cyan">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
          <Globe className="h-5 w-5 text-cyan-400" />
          Placements &amp; Ad Format Distribution
        </h3>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPlacements} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} tickLine={false} axisLine={false} width={150} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="spend" name="Spend" fill="#22d3ee" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-5 md:p-6" accent="rose">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100 md:text-lg">
          <Smartphone className="h-5 w-5 text-rose-400" />
          Device Platform Split
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={devicePie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                  {devicePie.map((entry) => (
                    <Cell key={entry.key} fill={DEVICE_COLORS[entry.key] ?? "#64748b"} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-center space-y-2">
            {devices
              .filter((d) => d.spend > 0)
              .map((d) => (
                <div key={d.device_platform} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: DEVICE_COLORS[d.device_platform] ?? "#64748b" }} />
                    {prettyDevice(d.device_platform)}
                  </span>
                  <span className="text-right">
                    <div className="font-semibold text-slate-100">
                      {formatPercent(totalDeviceSpend > 0 ? (d.spend / totalDeviceSpend) * 100 : 0, 1)}
                    </div>
                    <div className="text-[10px] text-slate-500">{formatCurrency(d.spend, currency)}</div>
                  </span>
                </div>
              ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
