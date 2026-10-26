---
name: home-control
description: Discover home-device control actions available through the agent's own paired-device channel. Use when a task involves controlling a home device.
class: connector-required
verified: false
digest: sha256:409b745805c9078baa24aa31ce3eff0285f89ad5710bf5476a901e3330bbc8c7
---

# home-control

Discover home-device control actions available through the agent's own paired-device channel.

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

Canonical source: skills/home-control.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
