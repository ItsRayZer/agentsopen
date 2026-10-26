---
name: custom-connector-setup
description: Describe how a new service connector is set up through its own documented secure flow, without connecting anything here. Use when a task involves connecting a new service.
class: connector-required
verified: false
digest: sha256:1201d078adfb746817dd1725d3dc2d056e4fd7080520968bf8a033bb9fd2314d
---

# custom-connector-setup

Describe how a new service connector is set up through its own documented secure flow, without connecting anything here.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

describes a setup flow only; it does not connect anything from inside AI Workspace; credentials go through the new connector's own secure flow, never through this workspace

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

Canonical source: skills/custom-connector-setup.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
