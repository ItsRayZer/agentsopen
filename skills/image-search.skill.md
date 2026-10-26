---
name: image-search
description: Structure an image-search question into a research pack with proof-refs. Use when a task involves finding public images for research.
class: prompt-only
verified: false
digest: sha256:c478f88dd8995690ad7bc87fc27aa86ebb4524fe1197bd3343faa96432e32662
---

# image-search

Structure an image-search question into a research pack with proof-refs.

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

Canonical source: skills/image-search.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
