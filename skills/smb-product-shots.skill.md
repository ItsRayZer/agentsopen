---
name: smb-product-shots
description: Discover product-shot editing options available through the agent's own media channel. Use when a task involves editing a product shot.
class: connector-required
verified: false
digest: sha256:4bb623d2d9775b3e3c83ade57d59e18f35d859dc1c9db9684243eba029ddcfe5
---

# smb-product-shots

Discover product-shot editing options available through the agent's own media channel.

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

Canonical source: skills/smb-product-shots.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
