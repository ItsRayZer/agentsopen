---
name: custom-connector-setup
description: Describe how a new service connector is set up through its own documented secure flow, without connecting anything here. Use when a task involves connecting a new service.
class: connector-required
verified: false
digest: sha256:e7a0dd934fa87546a8d19e0ee59003b42027c7850e374ce4932e7f96d48291bf
---

# custom-connector-setup

Describe how a new service connector is set up through its own documented secure flow, without connecting anything here.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

describes a setup flow only; it does not connect anything from inside AgentsOpen; credentials go through the new connector's own secure flow, never through this workspace

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
