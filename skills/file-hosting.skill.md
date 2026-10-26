---
name: file-hosting
description: Discover file-sharing options available through the agent's own channel. Use when a task involves sharing a file.
class: connector-required
verified: false
digest: sha256:e8706d9b8a430d8d37cfed3da4774c8bb1767ce06665841febe2d8f6499adbe2
---

# file-hosting

Discover file-sharing options available through the agent's own channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace holds no mail, calendar, docs, or files for others; actions happen in the owner's connected account with its own approval

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

Canonical source: skills/file-hosting.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
