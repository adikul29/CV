import { NextRequest, NextResponse } from "next/server";
import { TRACKED_ACCOUNTS } from "@/lib/accounts";
import { fetchAccountLive, fetchDailySeriesLive, hasLiveToken } from "@/lib/metaGraph";
import { buildDailySeries, sliceSeries } from "@/lib/dailySeries";
import { AdAccountData, MetaAdsSeed } from "@/lib/types";
import seed from "@/lib/seed/meta-ads-seed.json";

export const dynamic = "force-dynamic";

function todayIsoIst(): string {
  const IST_OFFSET_MINUTES = 5 * 60 + 30;
  const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") ?? "2026-07-20";
  const until = searchParams.get("until") ?? todayIsoIst();

  if (hasLiveToken()) {
    try {
      const accountsData = await Promise.all(TRACKED_ACCOUNTS.map((a) => fetchAccountLive(a, since, until)));
      const dailySeriesRaw = await Promise.all(TRACKED_ACCOUNTS.map((a) => fetchDailySeriesLive(a, since, until)));

      const accounts: Record<string, AdAccountData> = {};
      const dailySeries: Record<string, any> = {};
      TRACKED_ACCOUNTS.forEach((a, i) => {
        accounts[a.id] = accountsData[i];
        dailySeries[a.id] = dailySeriesRaw[i];
      });

      return NextResponse.json({
        liveMode: true,
        fetchedAt: new Date().toISOString(),
        source: "Meta Graph API (live)",
        since,
        until,
        accounts,
        dailySeries,
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          liveMode: false,
          error: String(err?.message ?? err),
          fallback: true,
          ...buildSnapshotPayload(since, until),
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({
    liveMode: false,
    source: "Snapshot pulled via Meta Ads MCP — set META_ACCESS_TOKEN for true live queries",
    ...buildSnapshotPayload(since, until),
  });
}

function buildSnapshotPayload(since: string, until: string) {
  const typedSeed = seed as unknown as MetaAdsSeed;
  const today = todayIsoIst();
  const dailySeries: Record<string, any> = {};
  for (const account of Object.values(typedSeed.accounts)) {
    const full = buildDailySeries(account, today);
    dailySeries[account.id] = sliceSeries(full, since, until);
  }
  return {
    fetchedAt: typedSeed.generatedAt,
    since,
    until,
    accounts: typedSeed.accounts,
    dailySeries,
  };
}
