---
name: email-management
description: Discover the shape of mailbox work available through the agent's own connected mail channel. Use when a task involves mailbox work.
class: connector-required
verified: false
digest: sha256:c53034d1727c5659ebffcf5b47efb5212e9a6a85149ac0af65fceabcd61abe94
---

# email-management

Discover the shape of mailbox work available through the agent's own connected mail channel.

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

Canonical source: skills/email-management.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
