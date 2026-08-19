export type CampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  objective: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  leads: number;
  costPerLead: number | null;
  initiatedCheckouts: number;
  purchaseValue: number;
  purchases: number;
  roas: number | null;
  resultIndicator: string;
}

export interface AdSetTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: (string | number)[];
  cities?: string[];
  regions?: string[];
  countries?: string[] | null;
  customAudiences?: string[];
  publisherPlatforms?: string[];
}

export interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  status: CampaignStatus;
  optimizationGoal?: string;
  spend: number;
  leads: number;
  costPerLead: number | null;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  targeting: AdSetTargeting;
}

export interface Ad {
  id: string;
  name: string;
  adsetId: string;
  campaignId: string;
  status: CampaignStatus;
  creativeId?: string;
  spend: number;
  leads: number;
  costPerLead: number | null;
  purchaseValue: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
}

export interface AgeBreakdownRow {
  age: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  initiatedCheckouts: number;
  purchaseValue: number;
}

export interface GenderBreakdownRow {
  gender: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  initiatedCheckouts: number;
  purchaseValue: number;
}

export interface PlacementRow {
  platform_position: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface DeviceRow {
  device_platform: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface AdAccountData {
  id: string;
  name: string;
  business: string;
  currency: string;
  campaigns: Campaign[];
  adsets: AdSet[];
  ads: Ad[];
  ageBreakdown: AgeBreakdownRow[];
  genderBreakdown: GenderBreakdownRow[];
  placements: PlacementRow[];
  devices: DeviceRow[];
}

export interface MetaAdsSeed {
  generatedAt: string;
  accounts: Record<string, AdAccountData>;
}

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "last2"
  | "last7"
  | "last14"
  | "last30"
  | "mtd"
  | "peak"
  | "lifetime"
  | "custom";

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
  presetKey: DatePresetKey;
  label: string;
}

export type Granularity = "daily" | "weekly" | "monthly";

export type SwappableMetric =
  | "spend"
  | "leads"
  | "purchases"
  | "cpl"
  | "cpa"
  | "ctr"
  | "cpc"
  | "clicks"
  | "impressions"
  | "none";

export type ChartStyle = "dualAxisBarLine" | "dualLines" | "areaFillLine" | "barsOnly";

export interface DailyPoint {
  date: string;
  spend: number;
  leads: number;
  purchases: number;
  revenue: number;
  clicks: number;
  impressions: number;
  cpl: number;
  cpa: number;
  ctr: number;
  cpc: number;
}
