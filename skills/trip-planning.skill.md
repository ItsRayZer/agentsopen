---
name: trip-planning
description: Discover trip-planning options available through the agent's own travel channel. Use when a task involves planning a trip.
class: connector-required
verified: false
digest: sha256:dc5c94813ed4217a54fc96897b2878d528a456cb11bf32113c3b6a1607e81793
---

# trip-planning

Discover trip-planning options available through the agent's own travel channel.

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

Canonical source: skills/trip-planning.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
