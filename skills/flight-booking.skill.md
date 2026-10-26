---
name: flight-booking
description: Discover flight options available through the agent's own flight channel. Use when a task involves booking a flight.
class: connector-required
verified: false
digest: sha256:e50b590c1fa72cdf54e9ffc5981ec1843fd531994782957e8809c7827336522d
---

# flight-booking

Discover flight options available through the agent's own flight channel.

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

Canonical source: skills/flight-booking.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
