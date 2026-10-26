---
name: restaurant-reservations
description: Discover restaurant table options available through the agent's own channel. Use when a task involves reserving a restaurant table.
class: connector-required
verified: false
digest: sha256:c479bd860906d02fed045b79b397aaade138d9990a7d5752a98eab07b71b3090
---

# restaurant-reservations

Discover restaurant table options available through the agent's own channel.

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

Canonical source: skills/restaurant-reservations.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
