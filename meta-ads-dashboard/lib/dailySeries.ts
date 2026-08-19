import { AdAccountData, DailyPoint } from "./types";

/** Deterministic pseudo-random generator (mulberry32) so the synthetic daily
 * split is stable across renders/builds instead of reshuffling on refresh. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Derives a stable, weekday-weighted 30-day daily series that sums back to
 * the account's real last-30d totals. Used only as the offline/snapshot
 * fallback so the date-range filter and DoD/WoW/MoM charts stay reactive
 * when no live META_ACCESS_TOKEN is configured. When a live token is set,
 * the /api/meta route fetches true per-day Graph API insights instead.
 */
export function buildDailySeries(account: AdAccountData, endDateISO: string): DailyPoint[] {
  const totalSpend = account.campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = account.campaigns.reduce((s, c) => s + c.leads, 0);
  const totalPurchases = account.campaigns.reduce((s, c) => s + c.purchases, 0);
  const totalRevenue = account.campaigns.reduce((s, c) => s + c.purchaseValue, 0);
  const totalClicks = account.campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = account.campaigns.reduce((s, c) => s + c.impressions, 0);

  const rand = mulberry32(seedFromString(account.id));
  const end = new Date(endDateISO + "T00:00:00Z");

  const weights: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    const weekendBoost = dow === 0 || dow === 6 ? 1.15 : 1.0;
    const jitter = 0.6 + rand() * 0.8;
    weights.push(weekendBoost * jitter);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const points: DailyPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    const share = weights[i] / weightSum;
    const spend = totalSpend * share;
    const leads = totalLeads * share;
    const purchases = totalPurchases * share;
    const revenue = totalRevenue * share;
    const clicks = totalClicks * share;
    const impressions = totalImpressions * share;
    points.push({
      date: d.toISOString().slice(0, 10),
      spend: round2(spend),
      leads: round0(leads),
      purchases: round0(purchases),
      revenue: round2(revenue),
      clicks: round0(clicks),
      impressions: round0(impressions),
      cpl: leads > 0 ? round2(spend / leads) : 0,
      cpa: purchases > 0 ? round2(spend / purchases) : 0,
      ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
      cpc: clicks > 0 ? round2(spend / clicks) : 0,
    });
  }
  return points;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round0(n: number) {
  return Math.round(n);
}

export function sliceSeries(series: DailyPoint[], since: string, until: string): DailyPoint[] {
  return series.filter((p) => p.date >= since && p.date <= until);
}

export function mergeSeries(a: DailyPoint[], b: DailyPoint[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const p of [...a, ...b]) {
    const existing = map.get(p.date);
    if (!existing) {
      map.set(p.date, { ...p });
    } else {
      existing.spend += p.spend;
      existing.leads += p.leads;
      existing.purchases += p.purchases;
      existing.revenue += p.revenue;
      existing.clicks += p.clicks;
      existing.impressions += p.impressions;
      existing.cpl = existing.leads > 0 ? round2(existing.spend / existing.leads) : 0;
      existing.cpa = existing.purchases > 0 ? round2(existing.spend / existing.purchases) : 0;
      existing.ctr = existing.impressions > 0 ? round2((existing.clicks / existing.impressions) * 100) : 0;
      existing.cpc = existing.clicks > 0 ? round2(existing.spend / existing.clicks) : 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function rollupWeekly(series: DailyPoint[]): DailyPoint[] {
  return rollupBy(series, (d) => {
    const date = new Date(d + "T00:00:00Z");
    const day = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
    return "Wk of " + monday.toISOString().slice(0, 10);
  });
}

export function rollupMonthly(series: DailyPoint[]): DailyPoint[] {
  return rollupBy(series, (d) => d.slice(0, 7));
}

function rollupBy(series: DailyPoint[], keyFn: (date: string) => string): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const p of series) {
    const key = keyFn(p.date);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...p, date: key });
    } else {
      existing.spend += p.spend;
      existing.leads += p.leads;
      existing.purchases += p.purchases;
      existing.revenue += p.revenue;
      existing.clicks += p.clicks;
      existing.impressions += p.impressions;
    }
  }
  for (const v of map.values()) {
    v.cpl = v.leads > 0 ? round2(v.spend / v.leads) : 0;
    v.cpa = v.purchases > 0 ? round2(v.spend / v.purchases) : 0;
    v.ctr = v.impressions > 0 ? round2((v.clicks / v.impressions) * 100) : 0;
    v.cpc = v.clicks > 0 ? round2(v.spend / v.clicks) : 0;
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
