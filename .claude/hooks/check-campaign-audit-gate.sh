#!/bin/bash
# PreToolUse hook: blocks any tool call that would set a Meta *campaign* to
# ACTIVE unless a passing gauntlet-loop audit was recorded for that exact
# campaign ID.
#
# This gates the THREE distinct activation vectors across both providers.
# The original single-field version only understood Pipeboard's `status`
# field and would let every Meta activation pass through ungated — see the
# ads_activate_entity / ads_update_entity branches below.
#
#   1. Pipeboard  mcp__test_mcp_2__update_campaign
#        -> flips status directly:  tool_input.status == "ACTIVE"
#        -> id: tool_input.campaign_id
#   2. Meta MCP   mcp__meta_ads_official_mcp__ads_activate_entity
#        -> activation is IMPLICIT — there is no status field at all
#        -> id: tool_input.entity_id  (only when entity_type == "campaign")
#   3. Meta MCP   mcp__meta_ads_official_mcp__ads_update_entity
#        -> status rides INSIDE the `fields` JSON string: fields.status == "ACTIVE"
#        -> id: tool_input.entity_id  (only when entity_type == "campaign")
#
# Exit-code contract: exit 2 = BLOCK the tool call. Exit 0 = allow.
# NEVER use exit 1 to block — Claude Code treats exit 1 as a non-blocking
# error and lets the action proceed anyway. The blocking path must be exit 2.
#
# Design: fail CLOSED. If the call looks like an activation but we cannot
# confirm a PASS audit, we block.

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')

IS_ACTIVATION="no"
CAMPAIGN_ID=""

case "$TOOL_NAME" in
  *update_campaign)
    # Pipeboard flips the campaign's status directly.
    STATUS=$(echo "$TOOL_INPUT" | jq -r '.status // empty')
    if [ "$STATUS" = "ACTIVE" ]; then
      IS_ACTIVATION="yes"
      CAMPAIGN_ID=$(echo "$TOOL_INPUT" | jq -r '.campaign_id // .id // empty')
    fi
    ;;
  *ads_activate_entity)
    # Meta's dedicated activation tool: no status field, activation is implicit.
    ENTITY_TYPE=$(echo "$TOOL_INPUT" | jq -r '.entity_type // empty')
    if [ "$ENTITY_TYPE" = "campaign" ]; then
      IS_ACTIVATION="yes"
      CAMPAIGN_ID=$(echo "$TOOL_INPUT" | jq -r '.entity_id // empty')
    fi
    ;;
  *ads_update_entity)
    # Meta buries the new status inside the `fields` JSON string.
    ENTITY_TYPE=$(echo "$TOOL_INPUT" | jq -r '.entity_type // empty')
    FIELD_STATUS=$(echo "$TOOL_INPUT" | jq -r '(.fields | if type=="string" then (fromjson? // {}) else (. // {}) end).status // empty')
    if [ "$ENTITY_TYPE" = "campaign" ] && [ "$FIELD_STATUS" = "ACTIVE" ]; then
      IS_ACTIVATION="yes"
      CAMPAIGN_ID=$(echo "$TOOL_INPUT" | jq -r '.entity_id // empty')
    fi
    ;;
  *)
    # Unknown tool matched this hook — fail safe: probe common shapes.
    STATUS=$(echo "$TOOL_INPUT" | jq -r '.status // empty')
    if [ "$STATUS" = "ACTIVE" ]; then
      IS_ACTIVATION="yes"
      CAMPAIGN_ID=$(echo "$TOOL_INPUT" | jq -r '.campaign_id // .id // .entity_id // empty')
    fi
    ;;
esac

# Anything that is not a campaign activation passes through untouched.
if [ "$IS_ACTIVATION" != "yes" ]; then
  exit 0
fi

if [ -z "$CAMPAIGN_ID" ]; then
  echo "Blocked: activation call has no identifiable campaign_id — cannot verify audit." >&2
  exit 2
fi

APPROVAL_FILE=".claude/gauntlet-approved/${CAMPAIGN_ID}.json"

if [ -f "$APPROVAL_FILE" ] && jq -e '.status == "PASS"' "$APPROVAL_FILE" >/dev/null 2>&1; then
  exit 0
else
  echo "Blocked: campaign ${CAMPAIGN_ID} has no recorded PASS audit at ${APPROVAL_FILE}. Run the full /gauntlet-campaign loop before activating — do not set status to ACTIVE directly." >&2
  exit 2
fi
