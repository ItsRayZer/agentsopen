---
name: task-management
description: Draft a task plan from a task list, owners, and dependencies the agent supplies. Use when a task involves managing a task list.
class: prompt-only
verified: false
digest: sha256:1a235584e7d19e378865a764c8b4437097325edc847a70ca27d0d2d4a06fd332
---

# task-management

Draft a task plan from a task list, owners, and dependencies the agent supplies.

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

Canonical source: skills/task-management.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
