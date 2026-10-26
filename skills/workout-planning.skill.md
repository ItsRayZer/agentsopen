---
name: workout-planning
description: Draft a workout plan note from goal, constraints, and routines the agent supplies. Use when a task involves planning a workout.
class: prompt-only
verified: false
digest: sha256:4d41d8881ff71f472403973622cc325e9992cca5c4330cda5d97aae8d154fbcf
---

# workout-planning

Draft a workout plan note from goal, constraints, and routines the agent supplies.

## Input

plain text (measurements/routines the agent supplies)

## Output

al:1 note pack (routine, measurements, questions for a clinician where relevant)

## Limits

no device read, no home-device control, no medical advice

## Cost

free-here

## Account

none

## Permissions

none

## Example input

synthetic measurements + routine

## Example output

al:1 note pack with routine and measurements; no diagnosis, no advice

Canonical source: skills/workout-planning.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
