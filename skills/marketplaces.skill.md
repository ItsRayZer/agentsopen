---
name: marketplaces
description: Discover resale marketplace options available through the agent's own channel. Use when a task involves a resale marketplace.
class: connector-required
verified: false
digest: sha256:ec533ad8498671bd0929db8394b121ceaa782d7c3cf928ad7da53292bf609469
---

# marketplaces

Discover resale marketplace options available through the agent's own channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace never books, buys, or holds a payment; any purchase or booking needs its own approval with a verified total in the owner's channel; no price or availability claim is repeated here as a workspace fact

## Cost

unknown-elsewhere

## Account

owner-channel

## Permissions

none

## Example input

discovery query in the agent's own channel

## Example output

registry entry only — no workspace output; agent uses its own channel with its own approval

Canonical source: skills/marketplaces.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
