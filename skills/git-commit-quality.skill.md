---
name: git-commit-quality
description: Review a commit message and diff against quality criteria and produce a verdict pack. Use when a task involves reviewing a commit.
class: prompt-only
verified: false
digest: sha256:3b3184e152824460bda09fa81010c86ff5fa9d5f9fac1fe7bc3271d3c5d7a6bc
---

# git-commit-quality

Review a commit message and diff against quality criteria and produce a verdict pack.

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

Canonical source: skills/git-commit-quality.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
