---
name: media-library
description: Discover photo-library search options available through the agent's own device channel. Use when a task involves searching a photo library.
class: connector-required
verified: false
digest: sha256:e1e9bd6d355acd102cdf08133d461e52398687b88eb4d1bc7afecb3b88e57648
---

# media-library

Discover photo-library search options available through the agent's own device channel.

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

Canonical source: skills/media-library.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
