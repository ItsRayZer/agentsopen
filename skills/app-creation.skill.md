---
name: app-creation
description: Plan a small app from its users, their tasks, and a good result, starting smallest. Use when a task involves planning a small app.
class: prompt-only
verified: false
digest: sha256:3c4423e3aa02aa8462ef3489c22c56a0c29e04d24b36af0b4e90affb50ad878f
---

# app-creation

Plan a small app from its users, their tasks, and a good result, starting smallest.

## Input

al:1 pack | plain text (code + task + criteria list)

## Output

al:1 verdict pack (model, claim, proof=code with file:line refs, or proof=none)

## Limits

no live lint/test/CI execution; proof-refs must resolve to supplied lines

## Cost

free-here

## Account

none

## Permissions

none

## Example input

two synthetic snippets + criteria: [correctness, style]

## Example output

al:1 verdict pack with per-criterion entries; unbound criteria use proof=none

Canonical source: skills/app-creation.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
