"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Area,
  AreaChart,
  LineChart,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { ArrowLeftRight } from "lucide-react";
import GlassCard from "./ui/GlassCard";
import { DailyPoint, ChartStyle, Granularity, SwappableMetric } from "@/lib/types";
import { rollupMonthly, rollupWeekly } from "@/lib/dailySeries";

interface TimeComparisonChartProps {
  series: DailyPoint[];
  currency: string;
}

const METRIC_LABELS: Record<SwappableMetric, string> = {
  spend: "Ad Spend",
  leads: "Leads",
  purchases: "Purchases",
  cpl: "CPL",
  cpa: "CPA",
  ctr: "CTR %",
  cpc: "CPC",
  clicks: "Clicks",
  impressions: "Impressions",
  none: "None (Single Axis)",
};

const LEFT_METRICS: SwappableMetric[] = ["spend", "leads", "purchases", "cpl", "cpa", "ctr", "cpc", "clicks", "impressions"];
const RIGHT_METRICS: SwappableMetric[] = ["none", "leads", "purchases", "cpl", "cpa", "spend", "ctr", "cpc", "impressions", "clicks"];

const COLOR_LEFT = "#f43f5e";
const COLOR_RIGHT = "#22d3ee";

function metricValue(p: DailyPoint, m: SwappableMetric): number | null {
  if (m === "none") return null;
  return p[m];
}

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
      <div className="mb-1 font-mono text-slate-400">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function TimeComparisonChart({ series, currency }: TimeComparisonChartProps) {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [metric1, setMetric1] = useState<SwappableMetric>("spend");
  const [metric2, setMetric2] = useState<SwappableMetric>("leads");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("dualAxisBarLine");

  const data = useMemo(() => {
    if (granularity === "weekly") return rollupWeekly(series);
    if (granularity === "monthly") return rollupMonthly(series);
    return series;
  }, [series, granularity]);

  const chartData = data.map((p) => ({
    date: p.date,
    m1: metricValue(p, metric1),
    m2: metricValue(p, metric2),
  }));

  const swap = () => {
    const newM2 = metric1;
    const newM1 = metric2 === "none" ? metric1 : metric2;
    setMetric1(newM1);
    setMetric2(metric2 === "none" ? "none" : newM2);
  };

  const showRight = metric2 !== "none";

  return (
    <GlassCard className="p-5 md:p-6" accent="cyan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100 md:text-lg">Time Comparison Engine</h3>
        <div className="no-print flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
          {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg px-3 py-1.5 font-medium capitalize transition ${
                granularity === g ? "bg-rose-500/20 text-rose-200" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {g === "daily" ? "Day-on-Day" : g === "weekly" ? "Week-on-Week" : "Month-on-Month"}
            </button>
          ))}
        </div>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Left Y-Axis</label>
          <select
            value={metric1}
            onChange={(e) => setMetric1(e.target.value as SwappableMetric)}
            className="rounded-lg border border-rose-400/30 bg-slate-900 px-2.5 py-1.5 text-sm text-rose-200 outline-none"
          >
            {LEFT_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={swap}
          title="Swap Metrics"
          className="mb-0.5 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Swap
        </button>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Right Y-Axis</label>
          <select
            value={metric2}
            onChange={(e) => setMetric2(e.target.value as SwappableMetric)}
            className="rounded-lg border border-cyan-400/30 bg-slate-900 px-2.5 py-1.5 text-sm text-cyan-200 outline-none"
          >
            {RIGHT_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Chart Style</label>
          <select
            value={chartStyle}
            onChange={(e) => setChartStyle(e.target.value as ChartStyle)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-200 outline-none"
          >
            <option value="dualAxisBarLine">Dual Axis (Bar + Line)</option>
            <option value="dualLines">Dual Lines</option>
            <option value="areaFillLine">Area Fill + Line</option>
            <option value="barsOnly">Bars Only</option>
          </select>
        </div>
      </div>

      <div className="mt-4 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartStyle, chartData, metric1, metric2, showRight)}
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );

  function renderChart(
    style: ChartStyle,
    chartData: { date: string; m1: number | null; m2: number | null }[],
    metric1: SwappableMetric,
    metric2: SwappableMetric,
    showRight: boolean
  ) {
    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(148,163,184,0.2)" }} />
        <YAxis
          yAxisId="left"
          tick={{ fill: COLOR_LEFT, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        {showRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: COLOR_RIGHT, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
        )}
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }} />
      </>
    );

    if (style === "barsOnly") {
      return (
        <BarChart data={chartData}>
          {commonAxis}
          <Bar yAxisId="left" dataKey="m1" name={METRIC_LABELS[metric1]} fill={COLOR_LEFT} radius={[4, 4, 0, 0]} />
          {showRight && (
            <Bar yAxisId="right" dataKey="m2" name={METRIC_LABELS[metric2]} fill={COLOR_RIGHT} radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      );
    }

    if (style === "dualLines") {
      return (
        <LineChart data={chartData}>
          {commonAxis}
          <Line yAxisId="left" type="monotone" dataKey="m1" name={METRIC_LABELS[metric1]} stroke={COLOR_LEFT} strokeWidth={2} dot={false} />
          {showRight && (
            <Line yAxisId="right" type="monotone" dataKey="m2" name={METRIC_LABELS[metric2]} stroke={COLOR_RIGHT} strokeWidth={2} dot={false} />
          )}
        </LineChart>
      );
    }

    if (style === "areaFillLine") {
      return (
        <AreaChart data={chartData}>
          {commonAxis}
          <defs>
            <linearGradient id="fillLeft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR_LEFT} stopOpacity={0.4} />
              <stop offset="95%" stopColor={COLOR_LEFT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area yAxisId="left" type="monotone" dataKey="m1" name={METRIC_LABELS[metric1]} stroke={COLOR_LEFT} fill="url(#fillLeft)" strokeWidth={2} />
          {showRight && (
            <Line yAxisId="right" type="monotone" dataKey="m2" name={METRIC_LABELS[metric2]} stroke={COLOR_RIGHT} strokeWidth={2} dot={false} />
          )}
        </AreaChart>
      );
    }

    // dualAxisBarLine (default)
    return (
      <ComposedChart data={chartData}>
        {commonAxis}
        <Bar yAxisId="left" dataKey="m1" name={METRIC_LABELS[metric1]} fill={COLOR_LEFT} radius={[4, 4, 0, 0]} barSize={18} />
        {showRight && (
          <Line yAxisId="right" type="monotone" dataKey="m2" name={METRIC_LABELS[metric2]} stroke={COLOR_RIGHT} strokeWidth={2.5} dot={{ r: 3 }} />
        )}
      </ComposedChart>
    );
  }
}
