---
name: wearables-comms
description: Discover call and text options available through the agent's own wearable-device channel. Use when a task involves a call or text from a wearable device.
class: connector-required
verified: false
digest: sha256:f131b6b346697d7b1a62a677a7a635e17a0cc6a189b417d3538023a1399b121a
---

# wearables-comms

Discover call and text options available through the agent's own wearable-device channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace reads or controls nothing; actions need the owner's paired device and per-action approval, especially control actions

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

Canonical source: skills/wearables-comms.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
