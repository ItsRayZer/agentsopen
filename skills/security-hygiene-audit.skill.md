---
name: security-hygiene-audit
description: Static checklist and regex audit template for secret-pattern leaks, unbound verdicts, permission escalation, and data-class export violations. Use when a task involves auditing a pack or tool definition for hygiene.
class: prompt-only
verified: false
digest: sha256:7710bb08ddf70b55db00d953fccdad0ac75130375500b8c85f6eebe5e443a8b9
---

# security-hygiene-audit

Static checklist and regex audit template for secret-pattern leaks, unbound verdicts, permission escalation, and data-class export violations.

## Input

candidate pack or tool definition text

## Output

al:1 hygiene audit report listing secret-pattern status, data-class check, and proof binding

## Limits

prompt-only-template | no-live-service-call | no-account | no-booking | no-send

## Cost

free-here

## Account

none

## Permissions

none

## Example input

candidate pack text

## Example output

hygiene audit report: secret-pattern pass/fail, data-class check, proof binding

Canonical source: skills/security-hygiene-audit.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
