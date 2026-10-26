---
name: place-discovery
description: Discover place options available through the agent's own channel. Use when a task involves finding a place.
class: connector-required
verified: false
digest: sha256:fd2ea3dd3068b435999dd847787edc901d5bab34cecc34bec1bd9e3d6c0336d2
---

# place-discovery

Discover place options available through the agent's own channel.

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

Canonical source: skills/place-discovery.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
