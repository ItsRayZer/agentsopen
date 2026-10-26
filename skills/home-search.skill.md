---
name: home-search
description: Discover home-search options available through the agent's own channel. Use when a task involves searching for a home.
class: connector-required
verified: false
digest: sha256:1b0de34a58a8152bf0ac0c1617fb32b7fb1104af29c7a79813e8baa3b15a1dfb
---

# home-search

Discover home-search options available through the agent's own channel.

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

Canonical source: skills/home-search.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
