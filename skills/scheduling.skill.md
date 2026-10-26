---
name: scheduling
description: Draft a schedule plan from attendees, duration, date range, and timezones the agent supplies. Use when a task involves planning a schedule.
class: prompt-only
verified: false
digest: sha256:fff5d73a05e9dc8595e45a525279012404352561827b1fdf7377ed44b6b87e9c
---

# scheduling

Draft a schedule plan from attendees, duration, date range, and timezones the agent supplies.

## Input

plain text (goal + tasks + constraints + figures as supplied)

## Output

al:1 plan pack (phases, owners, deps, dates and budget lines as supplied)

## Limits

no booking, payment, or scheduling with real people; dates are supplied input echoed back, not a booking

## Cost

free-here

## Account

none

## Permissions

none

## Example input

synthetic goal + tasks + constraints

## Example output

al:1 plan pack with phases and deps; no booking made

Canonical source: skills/scheduling.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
