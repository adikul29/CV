---
description: Runs the full generator-critic gauntlet loop to build a Meta ad campaign from a raw brief — Pipeboard (mcp__test_mcp_2) as primary builder, Meta's official MCP (mcp__meta_ads_official_mcp) as fallback, with the campaign-planner-auditor subagent planning and independently auditing at every stage via explicit MODE tags.
---

Campaign brief from user: $ARGUMENTS

Requires `.claude/agents/campaign-planner-auditor.md`. Tool names below are the
real registered names for this project: Pipeboard is `mcp__test_mcp_2__*` and
Meta's official MCP is `mcp__meta_ads_official_mcp__*`. Follow this sequence
exactly — do not skip the audit step or shortcut the fix order, even if the
build looks obviously correct.

Note on the Meta fallback tools: every `mcp__meta_ads_official_mcp__*` call
requires a `client_conversation_id` (one 20-char alphanumeric id reused across
all Meta calls in this run) and an `advertiser_request` (the user's own words).
Meta edits go through `ads_update_entity` with `entity_type` + `entity_id` +
a `fields` JSON object using Ads-API field names (`name`, `daily_budget`,
`status`, …), NOT the Pipeboard argument names.

## Step 1 — Plan
Spawn the `campaign-planner-auditor` subagent. The first line of its prompt must
be `MODE:PLAN`, followed by the full raw brief above, word for word — don't
summarize or pre-interpret it yourself first. Wait for its build task list and
acceptance checklist. Do not proceed to Step 2 without both.

## Step 2 — Build
Using `mcp__test_mcp_2__*` tools, execute the task list exactly as given, in order.

Hard rules for this step:
- Every campaign is created with **status PAUSED**. Never set anything to ACTIVE
  at any point in this process without explicit user confirmation at the very
  end.
- Use every literal value from the plan (audience IDs, budget figures, geo
  codes, objective) exactly as specified. Do not paraphrase, round, or "improve"
  a value the plan already made explicit.
- Record every entity ID you create — campaign, ad set(s), ad(s), creative(s) —
  as you go. You need them for the audit and for any fixes.
- If a single tool call fails outright during this first build pass, retry that
  one call once. If it fails again, note the exact error, keep building whatever
  else you can, and continue — don't abandon the whole build over one failed
  sub-step.

## Step 3 — Audit
Spawn the `campaign-planner-auditor` subagent. The first line of its prompt must
be `MODE:AUDIT`, followed by: the original raw brief, the acceptance checklist
from Step 1, and every entity ID from Step 2. This is a fresh call — it does not
see your build reasoning or the Step 1 call, only the checklist and the real
IDs. Wait for its JSON verdict.

## Step 4 — Fix loop (maximum 3 rounds total)
Work through the auditor's `issues` list in order:

- **If `type` is `CONTENT_ISSUE`:**
  1. Fix it by **editing the existing entity** using its `update_*` tool and the
     exact `fix_instruction` given. Never delete or recreate an entity that
     already has an ID — a fix is always an edit to something that exists.
  2. Try this with `mcp__test_mcp_2__*` first (e.g.
     `mcp__test_mcp_2__update_campaign` / `update_adset` / `update_ad`).
  3. If that edit call fails, retry it once more with Pipeboard.
  4. If it fails a second time, attempt the identical fix with
     `mcp__meta_ads_official_mcp__ads_update_entity` instead, targeting the same
     existing `entity_id` (map the field to its Ads-API name in `fields`) — not a
     new campaign.
  5. If the Meta MCP fallback also fails, mark this specific issue `UNRESOLVED`
     with the reason, and move to the next issue. Do not loop on one field
     indefinitely.

- **If `type` is `PROVIDER_GAP`:** skip the Pipeboard retry entirely — go
  straight to `mcp__meta_ads_official_mcp__*` for that one action. If the
  fallback also can't do it, mark `UNRESOLVED` with the reason (true capability
  gap on both providers).

- **Rate-limit safety:** one retry per failed call, then fall back — never retry
  a second time on the same provider. If any call returns a rate-limit or
  lockout error (e.g. error 80004), stop the fix loop for this round immediately
  and report back rather than continuing to call the API.

After applying whatever fixes succeeded, go back to **Step 3** for a fresh
re-audit. Repeat up to 3 total rounds, then stop regardless of outcome.

## Step 5 — Final report to the user
- If the final audit is a clean PASS: write
  `.claude/gauntlet-approved/<campaign_id>.json` containing
  `{"status":"PASS","campaign_id":"<id>","timestamp":"<iso8601>"}`. This file is
  what the PreToolUse activation hook checks — without it, activating this
  campaign is blocked regardless of what you report here. (The hook gates all
  three activation paths: Pipeboard `update_campaign` with status ACTIVE, Meta
  `ads_activate_entity`, and Meta `ads_update_entity` setting status ACTIVE.)
- State the campaign/ad set/ad IDs and confirm they're PAUSED, ready for review.
- If the final audit is a clean PASS: say so plainly, and ask for explicit
  confirmation before setting anything to ACTIVE.
- If anything is `UNRESOLVED`: list each one individually — what the brief asked
  for, what's actually in the campaign instead, why it couldn't be fixed
  (PROVIDER_GAP on both MCPs, or repeated failure with the error), and a
  concrete next step the user could take themselves (e.g. "create this Custom
  Audience manually in Ads Manager, then re-run just this fix" or "this needs a
  Commerce Manager product set that neither MCP can create — set that up first,
  then re-run").
- Never describe a campaign as fully matching the brief if any item is
  `UNRESOLVED`. Surface every gap explicitly — silence on a missed item is the
  one failure mode this whole loop exists to prevent.
