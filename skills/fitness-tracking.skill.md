---
name: fitness-tracking
description: Draft a fitness note from activity, sleep, recovery, and measurement figures the agent supplies. Use when a task involves tracking fitness.
class: prompt-only
verified: false
digest: sha256:c727fdc7d4f88accac386e73baab18ad595b67a110ae8efac00a936b09de15ae
---

# fitness-tracking

Draft a fitness note from activity, sleep, recovery, and measurement figures the agent supplies.

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

Canonical source: skills/fitness-tracking.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
