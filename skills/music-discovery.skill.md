---
name: music-discovery
description: Discover music search and playback options available through the agent's own channel. Use when a task involves finding music.
class: connector-required
verified: false
digest: sha256:a2a3d8ed8d281f446ca9f3ea574d75010a94b5fddf3b6338b94ceaff835d463c
---

# music-discovery

Discover music search and playback options available through the agent's own channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace holds no media and plays nothing; playback, library, and search happen in the owner's connected account or device

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

Canonical source: skills/music-discovery.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
