import { Ad, AdSet, AdAccountData, Campaign, AgeBreakdownRow, GenderBreakdownRow, PlacementRow, DeviceRow } from "./types";
import { AccountMeta } from "./accounts";

const GRAPH_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function hasLiveToken(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN);
}

interface GraphAction {
  action_type: string;
  value: string;
}

async function graphGet<T = any>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not configured on the server.");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meta Graph API ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

const LEAD_TYPES = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen.other",
];
const PURCHASE_TYPES = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase", "onsite_conversion.purchase"];
const CHECKOUT_TYPES = ["omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout"];

function pickAction(actions: GraphAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const t of types) {
    const found = actions.find((a) => a.action_type === t);
    if (found) return parseFloat(found.value) || 0;
  }
  return 0;
}

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas";

export async function fetchCampaignsLive(account: AccountMeta, since: string, until: string): Promise<Campaign[]> {
  const timeRange = JSON.stringify({ since, until });
  const [insightsRes, metaRes] = await Promise.all([
    graphGet<{ data: any[] }>(`/act_${account.id}/insights`, {
      level: "campaign",
      time_range: timeRange,
      fields: "campaign_id,campaign_name," + INSIGHT_FIELDS,
      limit: "500",
    }),
    graphGet<{ data: any[] }>(`/act_${account.id}/campaigns`, {
      fields: "id,name,status,objective",
      limit: "500",
    }),
  ]);

  const metaById = new Map(metaRes.data.map((c) => [c.id, c]));

  return insightsRes.data.map((row): Campaign => {
    const meta = metaById.get(row.campaign_id) ?? {};
    const spend = parseFloat(row.spend ?? "0") || 0;
    const leads = pickAction(row.actions, LEAD_TYPES);
    const purchases = pickAction(row.actions, PURCHASE_TYPES);
    const checkouts = pickAction(row.actions, CHECKOUT_TYPES);
    const purchaseValue = pickAction(row.action_values, PURCHASE_TYPES);
    const roas = Array.isArray(row.purchase_roas) && row.purchase_roas[0] ? parseFloat(row.purchase_roas[0].value) : null;
    return {
      id: row.campaign_id,
      name: row.campaign_name,
      status: (meta as any).status ?? "ACTIVE",
      objective: (meta as any).objective ?? "—",
      spend: round2(spend),
      impressions: parseInt(row.impressions ?? "0", 10),
      reach: parseInt(row.reach ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      ctr: row.ctr ? parseFloat(row.ctr) : null,
      cpc: row.cpc ? parseFloat(row.cpc) : null,
      cpm: row.cpm ? parseFloat(row.cpm) : null,
      leads: Math.round(leads),
      costPerLead: leads > 0 ? round2(spend / leads) : null,
      initiatedCheckouts: Math.round(checkouts),
      purchaseValue: round2(purchaseValue),
      purchases: Math.round(purchases),
      roas,
      resultIndicator: "",
    };
  });
}

export async function fetchAdSetsLive(account: AccountMeta, since: string, until: string): Promise<AdSet[]> {
  const timeRange = JSON.stringify({ since, until });
  const [insightsRes, metaRes] = await Promise.all([
    graphGet<{ data: any[] }>(`/act_${account.id}/insights`, {
      level: "adset",
      time_range: timeRange,
      fields: "adset_id,campaign_id," + INSIGHT_FIELDS,
      limit: "500",
    }),
    graphGet<{ data: any[] }>(`/act_${account.id}/adsets`, {
      fields: "id,name,campaign_id,status,optimization_goal,targeting",
      limit: "500",
    }),
  ]);
  const metaById = new Map(metaRes.data.map((a) => [a.id, a]));

  return insightsRes.data.map((row): AdSet => {
    const meta: any = metaById.get(row.adset_id) ?? {};
    const spend = parseFloat(row.spend ?? "0") || 0;
    const leads = pickAction(row.actions, LEAD_TYPES);
    const purchaseValue = pickAction(row.action_values, PURCHASE_TYPES);
    const t = meta.targeting ?? {};
    return {
      id: row.adset_id,
      name: meta.name ?? row.adset_id,
      campaignId: row.campaign_id,
      status: meta.status ?? "ACTIVE",
      optimizationGoal: meta.optimization_goal,
      spend: round2(spend),
      leads: Math.round(leads),
      costPerLead: leads > 0 ? round2(spend / leads) : null,
      purchaseValue: round2(purchaseValue),
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      targeting: {
        ageMin: t.age_min,
        ageMax: t.age_max,
        genders: t.genders,
        cities: Object.values(t.geo_locations?.cities ?? {}).map((c: any) => c.name),
        regions: Object.values(t.geo_locations?.regions ?? {}).map((r: any) => r.name),
        countries: t.geo_locations?.countries ?? null,
        customAudiences: Object.values(t.custom_audiences ?? {}).map((c: any) => c.name),
        publisherPlatforms: Object.values(t.publisher_platforms ?? {}),
      },
    };
  });
}

export async function fetchAdsLive(account: AccountMeta, since: string, until: string): Promise<Ad[]> {
  const timeRange = JSON.stringify({ since, until });
  const [insightsRes, metaRes] = await Promise.all([
    graphGet<{ data: any[] }>(`/act_${account.id}/insights`, {
      level: "ad",
      time_range: timeRange,
      fields: "ad_id,adset_id,campaign_id," + INSIGHT_FIELDS,
      limit: "500",
    }),
    graphGet<{ data: any[] }>(`/act_${account.id}/ads`, {
      fields: "id,name,status,creative{id}",
      limit: "500",
    }),
  ]);
  const metaById = new Map(metaRes.data.map((a) => [a.id, a]));

  return insightsRes.data.map((row): Ad => {
    const meta: any = metaById.get(row.ad_id) ?? {};
    const spend = parseFloat(row.spend ?? "0") || 0;
    const leads = pickAction(row.actions, LEAD_TYPES);
    const purchaseValue = pickAction(row.action_values, PURCHASE_TYPES);
    return {
      id: row.ad_id,
      name: meta.name ?? row.ad_id,
      adsetId: row.adset_id,
      campaignId: row.campaign_id,
      status: meta.status ?? "ACTIVE",
      creativeId: meta.creative?.id,
      spend: round2(spend),
      leads: Math.round(leads),
      costPerLead: leads > 0 ? round2(spend / leads) : null,
      purchaseValue: round2(purchaseValue),
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      ctr: row.ctr ? parseFloat(row.ctr) : null,
      cpc: row.cpc ? parseFloat(row.cpc) : null,
    };
  });
}

async function fetchBreakdown(account: AccountMeta, since: string, until: string, breakdown: string) {
  const timeRange = JSON.stringify({ since, until });
  const res = await graphGet<{ data: any[] }>(`/act_${account.id}/insights`, {
    level: "account",
    time_range: timeRange,
    breakdowns: breakdown,
    fields: "spend,impressions,reach,clicks,actions,action_values",
    limit: "500",
  });
  return res.data;
}

export async function fetchAgeBreakdownLive(account: AccountMeta, since: string, until: string): Promise<AgeBreakdownRow[]> {
  const rows = await fetchBreakdown(account, since, until, "age");
  return rows.map((r) => ({
    age: r.age,
    spend: round2(parseFloat(r.spend ?? "0")),
    impressions: parseInt(r.impressions ?? "0", 10),
    reach: parseInt(r.reach ?? "0", 10),
    clicks: parseInt(r.clicks ?? "0", 10),
    leads: Math.round(pickAction(r.actions, LEAD_TYPES)),
    initiatedCheckouts: Math.round(pickAction(r.actions, CHECKOUT_TYPES)),
    purchaseValue: round2(pickAction(r.action_values, PURCHASE_TYPES)),
  }));
}

export async function fetchGenderBreakdownLive(account: AccountMeta, since: string, until: string): Promise<GenderBreakdownRow[]> {
  const rows = await fetchBreakdown(account, since, until, "gender");
  return rows.map((r) => ({
    gender: r.gender,
    spend: round2(parseFloat(r.spend ?? "0")),
    impressions: parseInt(r.impressions ?? "0", 10),
    reach: parseInt(r.reach ?? "0", 10),
    clicks: parseInt(r.clicks ?? "0", 10),
    leads: Math.round(pickAction(r.actions, LEAD_TYPES)),
    initiatedCheckouts: Math.round(pickAction(r.actions, CHECKOUT_TYPES)),
    purchaseValue: round2(pickAction(r.action_values, PURCHASE_TYPES)),
  }));
}

export async function fetchPlacementsLive(account: AccountMeta, since: string, until: string): Promise<PlacementRow[]> {
  const rows = await fetchBreakdown(account, since, until, "platform_position");
  return rows.map((r) => ({
    platform_position: r.platform_position,
    spend: round2(parseFloat(r.spend ?? "0")),
    impressions: parseInt(r.impressions ?? "0", 10),
    reach: parseInt(r.reach ?? "0", 10),
    clicks: parseInt(r.clicks ?? "0", 10),
  }));
}

export async function fetchDevicesLive(account: AccountMeta, since: string, until: string): Promise<DeviceRow[]> {
  const rows = await fetchBreakdown(account, since, until, "device_platform");
  return rows.map((r) => ({
    device_platform: r.device_platform,
    spend: round2(parseFloat(r.spend ?? "0")),
    impressions: parseInt(r.impressions ?? "0", 10),
    reach: parseInt(r.reach ?? "0", 10),
    clicks: parseInt(r.clicks ?? "0", 10),
  }));
}

export async function fetchAccountLive(account: AccountMeta, since: string, until: string): Promise<AdAccountData> {
  const [campaigns, adsets, ads, ageBreakdown, genderBreakdown, placements, devices] = await Promise.all([
    fetchCampaignsLive(account, since, until),
    fetchAdSetsLive(account, since, until),
    fetchAdsLive(account, since, until),
    fetchAgeBreakdownLive(account, since, until),
    fetchGenderBreakdownLive(account, since, until),
    fetchPlacementsLive(account, since, until),
    fetchDevicesLive(account, since, until),
  ]);
  return {
    id: account.id,
    name: account.name,
    business: account.business,
    currency: account.currency,
    campaigns,
    adsets,
    ads,
    ageBreakdown,
    genderBreakdown,
    placements,
    devices,
  };
}

/** Fetches daily (time_increment=1) spend/leads/purchases/clicks/impressions for the Time Comparison chart. */
export async function fetchDailySeriesLive(account: AccountMeta, since: string, until: string) {
  const timeRange = JSON.stringify({ since, until });
  const res = await graphGet<{ data: any[] }>(`/act_${account.id}/insights`, {
    level: "account",
    time_range: timeRange,
    time_increment: "1",
    fields: "spend,impressions,clicks,actions,action_values",
    limit: "500",
  });
  return res.data.map((row) => {
    const spend = parseFloat(row.spend ?? "0") || 0;
    const leads = pickAction(row.actions, LEAD_TYPES);
    const purchases = pickAction(row.actions, PURCHASE_TYPES);
    const revenue = pickAction(row.action_values, PURCHASE_TYPES);
    const clicks = parseInt(row.clicks ?? "0", 10);
    const impressions = parseInt(row.impressions ?? "0", 10);
    return {
      date: row.date_start,
      spend: round2(spend),
      leads: Math.round(leads),
      purchases: Math.round(purchases),
      revenue: round2(revenue),
      clicks,
      impressions,
      cpl: leads > 0 ? round2(spend / leads) : 0,
      cpa: purchases > 0 ? round2(spend / purchases) : 0,
      ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
      cpc: clicks > 0 ? round2(spend / clicks) : 0,
    };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
