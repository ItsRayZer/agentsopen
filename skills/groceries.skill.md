---
name: groceries
description: Discover grocery and food-delivery options available through the agent's own channel. Use when a task involves groceries or food delivery.
class: connector-required
verified: false
digest: sha256:ba9840a7a8b6f7b2d2925704d2954ff109540118d28201042a06b46ef9bcb502
---

# groceries

Discover grocery and food-delivery options available through the agent's own channel.

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

Canonical source: skills/groceries.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
