---
name: meeting-follow-up
description: Draft meeting decisions and owned action items from meeting notes the agent supplies. Use when a task involves following up a meeting.
class: prompt-only
verified: false
digest: sha256:4ba7025d485a6b03d9cf30d3655a9f4c19ddf29fd136b9e377460e5665f29c07
---

# meeting-follow-up

Draft meeting decisions and owned action items from meeting notes the agent supplies.

## Input

plain text (outline + source notes + audience)

## Output

al:1 document pack (structure, sections, decisions, owned action items)

## Limits

no real document, mail, or form created, edited, or sent

## Cost

free-here

## Account

none

## Permissions

none

## Example input

synthetic outline + notes + audience

## Example output

al:1 document pack with sections and decisions; nothing sent

Canonical source: skills/meeting-follow-up.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
