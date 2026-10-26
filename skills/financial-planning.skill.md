---
name: financial-planning
description: Draft a financial plan from a decision, supplied figures, and constraints. Use when a task involves a financial decision.
class: prompt-only
verified: false
digest: sha256:44f17464df60492668c0edbe5919c2d16310d8059abb86cabcddca87eca1b6ca
---

# financial-planning

Draft a financial plan from a decision, supplied figures, and constraints.

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

Canonical source: skills/financial-planning.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
