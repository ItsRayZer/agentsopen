---
name: hotel-booking
description: Discover stay options available through the agent's own channel. Use when a task involves booking a stay.
class: connector-required
verified: false
digest: sha256:ae4d0e011896a0dc98c8ec22346f33c58df0d7f3d9e57b4430500908c8e39693
---

# hotel-booking

Discover stay options available through the agent's own channel.

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

Canonical source: skills/hotel-booking.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
