---
name: agent-browser-nav
description: Headless agent-browser protocol template for parsing ac:1 wire streams, data-ac DOM attributes, and fetch-first /views/<id>.txt endpoints without human UI clicks. Use when a task involves zero-click agent browsing of the workspace.
class: prompt-only
verified: false
digest: sha256:1a3843509a3d71b4ebe747df0c1e1f710257609ee8fe13c88228f0d8dc68cd82
---

# agent-browser-nav

Headless agent-browser protocol template for parsing ac:1 wire streams, data-ac DOM attributes, and fetch-first /views/<id>.txt endpoints without human UI clicks.

## Input

target workspace URL + task goal

## Output

al:1 / ac:1 deterministic fetch sequence (boot -> skills.txt -> skill/<id>.txt -> view/<id>.txt)

## Limits

prompt-only-template | no-live-service-call | no-account | no-booking | no-send

## Cost

free-here

## Account

none

## Permissions

none

## Example input

ac:1 wire stream + target view id

## Example output

fetch sequence with 0 clicks, plain-text view content only

Canonical source: skills/agent-browser-nav.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
