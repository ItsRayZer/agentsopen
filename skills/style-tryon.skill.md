---
name: style-tryon
description: Discover style try-on options available through the agent's own media channel. Use when a task involves a style try-on.
class: connector-required
verified: false
digest: sha256:83d8a0d994e97d7bf49df47a3604f21ce6ab36f6d91dcb4752d98a732cf672a0
---

# style-tryon

Discover style try-on options available through the agent's own media channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace generates, edits, or renders no media; production happens in the agent's own media channel with its own approval

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

Canonical source: skills/style-tryon.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
