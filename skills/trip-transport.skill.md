---
name: trip-transport
description: Discover trip-transport options available through the agent's own travel channel. Use when a task involves getting around on a trip.
class: connector-required
verified: false
digest: sha256:9c1af2b4f39067bb877b5bb5b7735acc47a00e9a997b200e4d446fc636cfdd35
---

# trip-transport

Discover trip-transport options available through the agent's own travel channel.

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

Canonical source: skills/trip-transport.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
