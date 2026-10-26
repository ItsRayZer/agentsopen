---
name: device-data
description: Discover the shape of cached contacts and calendar reads available through the agent's own device channel. Use when a task involves cached contacts or calendar data.
class: connector-required
verified: false
digest: sha256:9fed1dec880617f747f7a4746e21b59eda47972134bd712e4351419c6c15d330
---

# device-data

Discover the shape of cached contacts and calendar reads available through the agent's own device channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace holds no mail, calendar, docs, or files for others; actions happen in the owner's connected account with its own approval

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

Canonical source: skills/device-data.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
