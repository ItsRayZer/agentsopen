---
name: short-editing
description: Discover short-form video editing options available through the agent's own media channel. Use when a task involves editing a short video.
class: connector-required
verified: false
digest: sha256:0e743abb2f52380ab0b31a3ef1209398a8f8a2f3207d52cc6cca30025f2e3900
---

# short-editing

Discover short-form video editing options available through the agent's own media channel.

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

Canonical source: skills/short-editing.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
