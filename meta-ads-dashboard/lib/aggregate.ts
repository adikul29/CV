import { AdAccountData, AgeBreakdownRow, DailyPoint, DeviceRow, GenderBreakdownRow, PlacementRow } from "./types";

export function mergeAgeBreakdown(accounts: AdAccountData[]): AgeBreakdownRow[] {
  const map = new Map<string, AgeBreakdownRow>();
  for (const acc of accounts) {
    for (const row of acc.ageBreakdown) {
      const existing = map.get(row.age);
      if (!existing) map.set(row.age, { ...row });
      else {
        existing.spend += row.spend;
        existing.impressions += row.impressions;
        existing.reach += row.reach;
        existing.clicks += row.clicks;
        existing.leads += row.leads;
        existing.initiatedCheckouts += row.initiatedCheckouts;
        existing.purchaseValue += row.purchaseValue;
      }
    }
  }
  const order = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "Unknown"];
  return Array.from(map.values()).sort((a, b) => order.indexOf(a.age) - order.indexOf(b.age));
}

export function mergeGenderBreakdown(accounts: AdAccountData[]): GenderBreakdownRow[] {
  const map = new Map<string, GenderBreakdownRow>();
  for (const acc of accounts) {
    for (const row of acc.genderBreakdown) {
      const existing = map.get(row.gender);
      if (!existing) map.set(row.gender, { ...row });
      else {
        existing.spend += row.spend;
        existing.impressions += row.impressions;
        existing.reach += row.reach;
        existing.clicks += row.clicks;
        existing.leads += row.leads;
        existing.initiatedCheckouts += row.initiatedCheckouts;
        existing.purchaseValue += row.purchaseValue;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

export function mergePlacements(accounts: AdAccountData[]): PlacementRow[] {
  const map = new Map<string, PlacementRow>();
  for (const acc of accounts) {
    for (const row of acc.placements) {
      const existing = map.get(row.platform_position);
      if (!existing) map.set(row.platform_position, { ...row });
      else {
        existing.spend += row.spend;
        existing.impressions += row.impressions;
        existing.reach += row.reach;
        existing.clicks += row.clicks;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

export function mergeDevices(accounts: AdAccountData[]): DeviceRow[] {
  const map = new Map<string, DeviceRow>();
  for (const acc of accounts) {
    for (const row of acc.devices) {
      const existing = map.get(row.device_platform);
      if (!existing) map.set(row.device_platform, { ...row });
      else {
        existing.spend += row.spend;
        existing.impressions += row.impressions;
        existing.reach += row.reach;
        existing.clicks += row.clicks;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

export interface DashboardMetrics {
  spend: number;
  activeDays: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  leads: number;
  cpl: number | null;
  checkouts: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number | null;
  ctr: number | null;
  topCohort: { label: string; share: number } | null;
  topPlacement: { label: string; share: number } | null;
  topDevice: { label: string; share: number } | null;
  mobilePct: number | null;
}

export function computeMetrics(accounts: AdAccountData[], combinedSeries: DailyPoint[]): DashboardMetrics {
  const spend = sum(combinedSeries, "spend");
  const leads = sum(combinedSeries, "leads");
  const purchases = sum(combinedSeries, "purchases");
  const revenue = sum(combinedSeries, "revenue");
  const clicks = sum(combinedSeries, "clicks");
  const impressions = sum(combinedSeries, "impressions");
  const activeDays = combinedSeries.filter((p) => p.spend > 0).length;

  const totalCampaignImpressions = accounts.reduce(
    (s, a) => s + a.campaigns.reduce((x, c) => x + c.impressions, 0),
    0
  );
  const totalCampaignReach = accounts.reduce((s, a) => s + a.campaigns.reduce((x, c) => x + c.reach, 0), 0);
  const reachRatio = totalCampaignImpressions > 0 ? impressions / totalCampaignImpressions : 0;
  const reach = Math.round(totalCampaignReach * Math.min(1, reachRatio || 1));

  const totalCampaignCheckouts = accounts.reduce(
    (s, a) => s + a.campaigns.reduce((x, c) => x + c.initiatedCheckouts, 0),
    0
  );
  const checkouts = Math.round(totalCampaignCheckouts * Math.min(1, reachRatio || 1));

  // Top demographic cohort (age x gender) by spend, merged across accounts.
  const cohortSpend = new Map<string, number>();
  let ageTotalSpend = 0;
  for (const acc of accounts) {
    for (const row of acc.ageBreakdown) {
      if (row.age === "Unknown") continue;
      ageTotalSpend += row.spend;
    }
  }
  for (const acc of accounts) {
    const topGender = [...acc.genderBreakdown].filter((g) => g.gender !== "unknown").sort((a, b) => b.spend - a.spend)[0];
    for (const row of acc.ageBreakdown) {
      if (row.age === "Unknown") continue;
      const label = `${row.age} · ${topGender ? capitalize(topGender.gender) : "All"}`;
      cohortSpend.set(label, (cohortSpend.get(label) ?? 0) + row.spend);
    }
  }
  const topCohortEntry = [...cohortSpend.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCohort = topCohortEntry
    ? { label: topCohortEntry[0], share: ageTotalSpend > 0 ? (topCohortEntry[1] / ageTotalSpend) * 100 : 0 }
    : null;

  // Top placement by spend, merged.
  const placementSpend = new Map<string, number>();
  let placementTotalSpend = 0;
  for (const acc of accounts) {
    for (const row of acc.placements) {
      placementSpend.set(row.platform_position, (placementSpend.get(row.platform_position) ?? 0) + row.spend);
      placementTotalSpend += row.spend;
    }
  }
  const topPlacementEntry = [...placementSpend.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPlacement = topPlacementEntry
    ? {
        label: prettyPlacement(topPlacementEntry[0]),
        share: placementTotalSpend > 0 ? (topPlacementEntry[1] / placementTotalSpend) * 100 : 0,
      }
    : null;

  // Devices + mobile %.
  const deviceSpend = new Map<string, number>();
  let deviceTotalSpend = 0;
  for (const acc of accounts) {
    for (const row of acc.devices) {
      deviceSpend.set(row.device_platform, (deviceSpend.get(row.device_platform) ?? 0) + row.spend);
      deviceTotalSpend += row.spend;
    }
  }
  const topDeviceEntry = [...deviceSpend.entries()].sort((a, b) => b[1] - a[1])[0];
  const topDevice = topDeviceEntry
    ? {
        label: prettyDevice(topDeviceEntry[0]),
        share: deviceTotalSpend > 0 ? (topDeviceEntry[1] / deviceTotalSpend) * 100 : 0,
      }
    : null;
  const mobileSpend = (deviceSpend.get("mobile_app") ?? 0) + (deviceSpend.get("mobile_web") ?? 0);
  const mobilePct = deviceTotalSpend > 0 ? (mobileSpend / deviceTotalSpend) * 100 : null;

  return {
    spend: round2(spend),
    activeDays,
    purchases: Math.round(purchases),
    revenue: round2(revenue),
    roas: spend > 0 ? round2(revenue / spend) : null,
    leads: Math.round(leads),
    cpl: leads > 0 ? round2(spend / leads) : null,
    checkouts,
    impressions: Math.round(impressions),
    reach,
    clicks: Math.round(clicks),
    cpc: clicks > 0 ? round2(spend / clicks) : null,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : null,
    topCohort,
    topPlacement,
    topDevice,
    mobilePct,
  };
}

export function prettyPlacement(raw: string): string {
  const map: Record<string, string> = {
    an_classic: "Audience Network Classic",
    facebook_reels: "Facebook Reels",
    facebook_reels_overlay: "Facebook Reels Overlay",
    facebook_stories: "Facebook Stories",
    feed: "Facebook Feed",
    instagram_reels: "Instagram Reels (9:16)",
    instagram_stories: "Instagram Stories",
    instagram_explore_grid_home: "Instagram Explore",
    instagram_search: "Instagram Search",
    instream_video: "In-Stream Video",
    marketplace: "Marketplace",
    rewarded_video: "Rewarded Video",
    right_hand_column: "Right Hand Column",
    facebook_notification: "Facebook Notifications",
    facebook_profile_feed: "Facebook Profile Feed",
    search: "Search",
    status: "Status",
    threads_feed: "Threads Feed",
    messenger_stories: "Messenger Stories",
    unknown: "Unattributed",
  };
  return map[raw] ?? raw;
}

export function prettyDevice(raw: string): string {
  const map: Record<string, string> = {
    mobile_app: "Mobile App",
    mobile_web: "Mobile Web",
    desktop: "Desktop",
    unknown: "Unattributed",
  };
  return map[raw] ?? raw;
}

function sum(series: DailyPoint[], key: keyof DailyPoint): number {
  return series.reduce((s, p) => s + (Number(p[key]) || 0), 0);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
