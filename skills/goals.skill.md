---
name: goals
description: Draft a goal plan from progress, changes, and next steps the agent supplies. Use when a task involves creating or tracking a goal.
class: prompt-only
verified: false
digest: sha256:b223fd7671851c5baaaf0dc84d56af996f055f415802701a0f813fc2c87c3b14
---

# goals

Draft a goal plan from progress, changes, and next steps the agent supplies.

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

Canonical source: skills/goals.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
