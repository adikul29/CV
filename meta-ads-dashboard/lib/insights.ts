import { AdAccountData } from "./types";
import { DashboardMetrics, mergeAgeBreakdown, mergeGenderBreakdown } from "./aggregate";
import { formatCurrency, formatPercent, formatRoas } from "./format";

export interface Pillar {
  title: string;
  icon: "audience" | "checkout" | "funnel" | "scaling";
  headline: string;
  detail: string;
  stat: string;
}

export interface ActionItem {
  title: string;
  detail: string;
}

export interface ActionMatrix {
  immediate: ActionItem[];
  shortTerm: ActionItem[];
  mediumTerm: ActionItem[];
  ongoing: ActionItem[];
}

export function buildStrategicInsights(
  accounts: AdAccountData[],
  metrics: DashboardMetrics,
  currency: string
): { pillars: Pillar[]; actions: ActionMatrix } {
  const age = mergeAgeBreakdown(accounts);
  const gender = mergeGenderBreakdown(accounts);

  const bestGender = [...gender]
    .filter((g) => g.gender !== "unknown" && g.spend > 0)
    .sort((a, b) => (b.purchaseValue / Math.max(b.spend, 1)) - (a.purchaseValue / Math.max(a.spend, 1)))[0];
  const bestAge = [...age]
    .filter((a) => a.age !== "Unknown" && a.spend > 0)
    .sort((a, b) => b.purchaseValue / Math.max(b.spend, 1) - a.purchaseValue / Math.max(a.spend, 1))[0];
  const bestGenderRoas = bestGender ? bestGender.purchaseValue / Math.max(bestGender.spend, 1) : 0;

  const allCampaigns = accounts.flatMap((a) => a.campaigns);
  const totalCheckouts = allCampaigns.reduce((s, c) => s + c.initiatedCheckouts, 0);
  const totalPurchases = allCampaigns.reduce((s, c) => s + c.purchases, 0);
  const checkoutDropoff = totalCheckouts > 0 ? (1 - totalPurchases / totalCheckouts) * 100 : 0;

  const totalLeads = allCampaigns.reduce((s, c) => s + c.leads, 0);
  const leadToPurchaseRate = totalLeads > 0 ? (totalPurchases / totalLeads) * 100 : 0;

  const lookalikeWinners = allCampaigns
    .filter((c) => /LAL/i.test(c.name) && c.roas && c.roas > 1.5 && c.status === "ACTIVE")
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  const bestLookalike = lookalikeWinners[0];
  const scalableCampaigns = allCampaigns
    .filter((c) => c.status === "ACTIVE" && c.roas && c.roas >= 2)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));

  const pillars: Pillar[] = [
    {
      title: "Audience Persona Alpha",
      icon: "audience",
      headline: bestGender && bestAge ? `${capitalize(bestGender.gender)}, ${bestAge.age}` : "Insufficient data",
      detail: bestGender
        ? `${capitalize(bestGender.gender)} audiences return ${formatRoas(bestGenderRoas)} blended ROAS on ${formatCurrency(
            bestGender.spend,
            currency
          )} spend — the strongest efficiency cohort. Prioritize creative and budget toward this persona before broadening.`
        : "Not enough breakdown data to identify a lead persona yet.",
      stat: bestGender ? formatRoas(bestGenderRoas) + " ROAS" : "—",
    },
    {
      title: "Checkout Drop-off Recovery",
      icon: "checkout",
      headline: `${checkoutDropoff.toFixed(0)}% drop-off between checkout and purchase`,
      detail: `${totalCheckouts.toLocaleString("en-IN")} initiated checkouts produced only ${totalPurchases.toLocaleString(
        "en-IN"
      )} purchases. Deploy a DPA (dynamic product ads) retargeting ad set against checkout-initiators from the last 3–7 days with an incentive offer to recover this leak.`,
      stat: formatPercent(checkoutDropoff, 0),
    },
    {
      title: "Funnel Flywheel",
      icon: "funnel",
      headline: `${leadToPurchaseRate.toFixed(1)}% lead → purchase conversion`,
      detail: `${totalLeads.toLocaleString("en-IN")} leads captured across active lead-gen and webinar campaigns. Build a nurture retargeting flywheel (Custom Audience of engaged leads → 3-monthly-program sales creative) to compound this into the sales funnel instead of running leads and sales as separate tracks.`,
      stat: formatPercent(leadToPurchaseRate, 1),
    },
    {
      title: "Advantage+ Scaling Vector",
      icon: "scaling",
      headline: bestLookalike ? `Scale "${trimName(bestLookalike.name)}"` : scalableCampaigns[0] ? `Scale "${trimName(scalableCampaigns[0].name)}"` : "No clear scale candidate",
      detail: bestLookalike
        ? `This 1% Lookalike campaign is delivering ${formatRoas(bestLookalike.roas)} ROAS at ${formatCurrency(
            bestLookalike.spend,
            currency
          )} spend. Layer it into an Advantage+ Shopping Campaign (ASC) with the same creative set and let Meta's automation expand the lookalike seed audience for incremental volume.`
        : "Once an active campaign clears 2x ROAS at meaningful spend, migrate its top creative into an Advantage+ Shopping Campaign for automated scaling.",
      stat: bestLookalike ? formatRoas(bestLookalike.roas) + " ROAS" : scalableCampaigns[0] ? formatRoas(scalableCampaigns[0].roas) + " ROAS" : "—",
    },
  ];

  const topSpendCampaign = [...allCampaigns].sort((a, b) => b.spend - a.spend)[0];
  const highCplCampaign = [...allCampaigns]
    .filter((c) => c.status === "ACTIVE" && c.costPerLead)
    .sort((a, b) => (b.costPerLead ?? 0) - (a.costPerLead ?? 0))[0];

  const actions: ActionMatrix = {
    immediate: [
      {
        title: "Launch checkout-abandonment retargeting ad set",
        detail: `Target the ${totalCheckouts.toLocaleString("en-IN")} initiated-checkout, non-purchase pool with a 3–7 day DPA retargeting flow.`,
      },
      {
        title: "Pause/rebudget worst CPL active campaign",
        detail: highCplCampaign
          ? `"${trimName(highCplCampaign.name)}" is running at ${formatCurrency(highCplCampaign.costPerLead, currency)} CPL — cap the daily budget or pause pending creative refresh.`
          : "Review active campaigns for outlier CPL and cap spend.",
      },
    ],
    shortTerm: [
      {
        title: "Stand up Advantage+ Shopping Campaign",
        detail: bestLookalike
          ? `Clone "${trimName(bestLookalike.name)}" creative into an ASC to compound the ${formatRoas(bestLookalike.roas)} ROAS signal.`
          : "Identify the best 1% Lookalike performer once ROAS data matures, then port it into an ASC.",
      },
      {
        title: "Refresh creative on the top-spend campaign",
        detail: topSpendCampaign
          ? `"${trimName(topSpendCampaign.name)}" carries the largest share of budget (${formatCurrency(topSpendCampaign.spend, currency)}) — rotate in 2–3 new creative variants to fight fatigue.`
          : "Rotate creative on the highest-spend active campaign.",
      },
    ],
    mediumTerm: [
      {
        title: "Build a lead-nurture Custom Audience flywheel",
        detail: "Sync webinar/lead-gen converters into a Custom Audience feeding the 3-month program sales campaigns within 14 days of capture.",
      },
      {
        title: "Expand the Audience Persona Alpha cohort",
        detail: bestGender && bestAge
          ? `Build dedicated ad sets around ${capitalize(bestGender.gender)} ${bestAge.age} with tailored creative and a broader Advantage+ audience.`
          : "Once a clear top-ROAS cohort emerges, build dedicated ad sets around it.",
      },
    ],
    ongoing: [
      { title: "Weekly CPL / ROAS scorecard review", detail: "Review this dashboard weekly against the WoW comparison chart to catch efficiency drift early." },
      { title: "Quarterly placement & device re-allocation", detail: "Re-balance budget toward Reels/Stories placements and mobile app inventory as they continue outperforming static feed on CPM." },
    ],
  };

  return { pillars, actions };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function trimName(name: string, max = 42) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}
