---
name: ffmpeg-skill
description: Discover local video and audio editing options available through the agent's own media channel. Use when a task involves editing video or audio.
class: connector-required
verified: false
digest: sha256:c4f3e544b80610d6d506bc68e2c379b90483a6c8e423d62f38afb45e887b33aa
---

# ffmpeg-skill

Discover local video and audio editing options available through the agent's own media channel.

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

Canonical source: skills/ffmpeg-skill.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
