---
name: deep-research
description: Structure a research question into a research pack with proof-refs. Use when a task involves research, source synthesis, or conflict tracking.
class: prompt-only
verified: false
digest: sha256:ce20941c97eef47c9d5b363cd6974fc830cd5e304241cfdabd8e81d21ce07860
---

# deep-research

Structure a research question into a research pack with proof-refs.

## Input

plain text (question + source list + proof rule)

## Output

al:1 research pack (claims with proof-ref file:line:sha256 or test id)

## Limits

no live page fetch, no search engine, no model call

## Cost

free-here

## Account

none

## Permissions

none

## Example input

question + sources: [local files only]

## Example output

al:1 research pack; unbound claims ranked unproven; conflicts kept in both versions

Canonical source: skills/deep-research.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
