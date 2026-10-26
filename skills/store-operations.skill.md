---
name: store-operations
description: Discover store record options available through the agent's own merchant channel. Use when a task involves a store record, product, order, or customer.
class: connector-required
verified: false
digest: sha256:d3ecb0a5e8a78d67fe41dfde8ef702e4f8f1419e199e224a636b88c03f1d513f
---

# store-operations

Discover store record options available through the agent's own merchant channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace moves no money and touches no merchant account; actions need the owner's merchant account and per-action approval

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

Canonical source: skills/store-operations.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
