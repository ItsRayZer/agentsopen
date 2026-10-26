---
name: event-tickets
description: Discover event and seat options available through the agent's own ticketing channel. Use when a task involves event tickets.
class: connector-required
verified: false
digest: sha256:94a7b53872e8ee7dc1b7307c40408f46dc31dc030f823e685868efdfb9fd5333
---

# event-tickets

Discover event and seat options available through the agent's own ticketing channel.

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

Canonical source: skills/event-tickets.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
