---
name: code-reviewer
description: Review code against a supplied criteria list and produce a verdict pack. Use when a task involves code review, diff analysis, or fix planning.
class: prompt-only
verified: false
digest: sha256:23f21d0391abe0dc915db5b53ade763c2cd61d06e33f31fc714bf66fac3df485
---

# code-reviewer

Review code against a supplied criteria list and produce a verdict pack.

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

Canonical source: skills/code-reviewer.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
