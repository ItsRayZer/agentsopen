---
name: messaging
description: Discover messaging options available through the agent's own connected account channel. Use when a task involves messaging another person.
class: connector-required
verified: false
digest: sha256:6b9c5547f67a65eb34b537cf15316351536c53b08f903cec2151881c0dfd351c
---

# messaging

Discover messaging options available through the agent's own connected account channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace never sends and never pretends to be a real person; any send needs per-person/per-wording owner approval in the owner's channel

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

Canonical source: skills/messaging.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
