# Meta Ads Analytics & Performance Intelligence Dashboard

Executive Meta Ads dashboard for the **Slow Burn Method** ad accounts
(`act_1002719109265256` "SBM 2" and `act_1204405088105936` "Slow burn Method
Meta"), built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and
Recharts, in a dark cyber-glass aesthetic.

## What's real vs. what's a snapshot

There is no "pipeboard" MCP connected in this workspace, so this app talks to
the **official Meta Marketing Graph API** instead:

- `lib/seed/meta-ads-seed.json` is a **real, live pull** of both ad accounts
  (campaigns, ad sets, ads, age/gender demographics, placements, devices)
  captured on **2026-08-19** via the Meta Ads MCP tool available to this
  session. It ships as an offline fallback so the dashboard renders fully
  without any credentials.
- `app/api/meta/route.ts` checks for a `META_ACCESS_TOKEN` env var on the
  server. **If it's set**, every request hits `graph.facebook.com` directly
  for the exact selected date range (`liveMode: true` in the API response,
  shown as a "Live Graph API" badge in the header). **If it's not set**, the
  route falls back to the bundled snapshot and derives a date-range-reactive
  daily series from it (`liveMode: false`, "Verified Snapshot" badge) so the
  date filters and DoD/WoW/MoM chart still respond meaningfully offline.

## Getting a live token

1. In Meta Business Settings → System Users, create/use a system user with
   `ads_read` access to both ad accounts above.
2. Generate a token and copy it into `.env.local`:
   ```
   cp .env.local.example .env.local
   # then edit .env.local and paste your token into META_ACCESS_TOKEN=
   ```
3. Restart the dev server. The header badge flips to "Live Graph API" and
   every date-range change, "Pull Today's Live Data", and "Refresh All Data"
   click now queries Meta directly.

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

```bash
npm run build && npm start   # production build
```

## Structure

- `app/page.tsx` – top-level client component: date-range state, data
  fetching, PDF export trigger.
- `app/api/meta/route.ts` – server route: live Graph API fetch or seed
  fallback, both normalized to the same shape.
- `lib/metaGraph.ts` – Graph API client (campaigns/adsets/ads/breakdowns).
- `lib/dailySeries.ts` – daily time-series builder + weekly/monthly rollups
  used by the Time Comparison Engine.
- `lib/aggregate.ts` / `lib/insights.ts` – KPI + strategic-audit derivations.
- `components/` – Header, DateRangeBar, KpiGrid, TimeComparisonChart,
  HierarchyTree, Demographics, PlacementsDevices, StrategicAudit.

## PDF export

The "Export / Print PDF Report" button calls `window.print()`. `app/globals.css`
forces `-webkit-print-color-adjust: exact` and hides `.no-print` controls so
saved PDFs keep the dark theme, borders, and chart colors intact.
