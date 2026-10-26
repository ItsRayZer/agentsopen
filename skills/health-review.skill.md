---
name: health-review
description: Draft a clinician-visit preparation note from records and questions the agent supplies. Use when a task involves preparing for a clinician visit.
class: prompt-only
verified: false
digest: sha256:e47c6353c00fa75dd7ee60dc5029a3a9517dd14f17ebff632fee3c9121258101
---

# health-review

Draft a clinician-visit preparation note from records and questions the agent supplies.

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

Canonical source: skills/health-review.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
