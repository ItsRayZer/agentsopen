---
name: wide-research
description: Structure a wide research question into a research pack with proof-refs. Use when a task involves wide research across many inputs.
class: prompt-only
verified: false
digest: sha256:62bd3d5c1712af1a575cf04e002eb684cca485d0648af2913fb7ba93bfa4a2ee
---

# wide-research

Structure a wide research question into a research pack with proof-refs.

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

Canonical source: skills/wide-research.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
