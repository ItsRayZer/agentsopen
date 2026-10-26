---
name: shopping
description: Discover product options available through the agent's own shopping channel. Use when a task involves shopping for a product.
class: connector-required
verified: false
digest: sha256:de3f4fab2d1e8d9aa3059db23931ff87c0c50dada9ab09cffe4042a7758c2bfb
---

# shopping

Discover product options available through the agent's own shopping channel.

## Input

plain text (discovery query — no workspace call)

## Output

none — registry entry only; result comes from agent's own channel, never from this workspace

## Limits

workspace never books, buys, or holds a payment; any purchase or booking needs its own approval with a verified total in the owner's channel; no price or availability claim is repeated here as a workspace fact

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

Canonical source: skills/shopping.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
