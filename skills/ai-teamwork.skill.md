---
name: ai-teamwork
description: Discover multi-model debugging options available through the agent's own external-model channels. Use when a task involves debugging with a team of external models.
class: connector-required
verified: false
digest: sha256:7510b3b29fbd226bd9f6a3d16f32871a0877974a517c9e3650ebeb1441d09c34
---

# ai-teamwork

Discover multi-model debugging options available through the agent's own external-model channels.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace calls no model; debate or generation happens through the agent's own external-model channels with its own approval

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

Canonical source: skills/ai-teamwork.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
