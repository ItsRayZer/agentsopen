---
name: weekly-review
description: Draft a weekly review plan from open loops, stalled projects, and commitments the agent supplies. Use when a task involves running a weekly review.
class: prompt-only
verified: false
digest: sha256:3bfe2c4397b3555a283b2dfd89b8ff593ff2b0413992f2961fbbc498e309348e
---

# weekly-review

Draft a weekly review plan from open loops, stalled projects, and commitments the agent supplies.

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

Canonical source: skills/weekly-review.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
