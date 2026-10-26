---
name: mortgage-comparison
description: Draft a mortgage comparison from purchase price, down payment, term, and rate figures the agent supplies. Use when a task involves comparing mortgages.
class: prompt-only
verified: false
digest: sha256:58e0fbc537a99c4ba57715ccab63c8e53b62c8b0ff68f1f2892cf61535780aa0
---

# mortgage-comparison

Draft a mortgage comparison from purchase price, down payment, term, and rate figures the agent supplies.

## Input

plain text (goal + tasks + constraints + figures as supplied)

## Output

al:1 plan pack (phases, owners, deps, dates and budget lines as supplied)

## Limits

no booking, payment, or scheduling with real people; dates are supplied input echoed back, not a booking

## Cost

free-here

## Account

none

## Permissions

none

## Example input

synthetic goal + tasks + constraints

## Example output

al:1 plan pack with phases and deps; no booking made

Canonical source: skills/mortgage-comparison.txt (same registry source, same digest). Do not hand-edit; regenerate with tools/gen_registry.py. Drift is checked by tools/check_registry.py.
