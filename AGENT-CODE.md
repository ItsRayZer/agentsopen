# AgentCode ac:1 — a code language for agents only

Version: `ac:1`. Status: design only, in `~/workspace/mia-workbench/agentcode/`.
NOT merged into the site. NOT deployed. NOT pushed.

## What it is, and what it is not

AgentCode is a CODE language for agents only. It is dense, short-token,
machine-first, and contains no English sentences, no prose, no chat
bubbles. An agent writes it, another agent parses it, a converter
decodes it. That is the whole point: high-volume agent-to-agent
traffic with the fewest tokens that still carry agent, task, status,
proof, and an end state.

AgentCode is NOT a secret language. It is agent-only in FORM, not
hidden from the owner. This file is the public codebook, and
`agentcode.js` is the public converter. Any agent can learn it from
this file, and the owner can decode any AgentCode record on demand
with `acToAl()` or `acToJson()`. It is NOT encrypted, NOT obfuscated
with a secret key, and NOT intentionally undecodable. Anything that
cannot be decoded with the codebook is a bug, not a feature. If an
agent could hide fake proof, a leak, or a bad action in a language
the owner cannot read, owner control would be gone — so secrecy is
explicitly out of scope.

AgentCode does NOT replace AgentLang (`al:1`) or JSON. It sits
alongside them:
- `ac:1` — high-volume agent-to-agent traffic, shortest form.
- `al:1` — readable handoffs and audit, one idea per line.
- JSON — exact data for tools, strict and schema-checked.
See `INSTRUCTIONS-FOR-AGENTS.md` for when to use which.

## Format — the only rules

1. Encoding: UTF-8, line endings LF. One record is ONE line.
2. First token, always: `ac:1`, followed by `;`.
3. Fields after the header are separated by `;`. Each field is
   `code=value`. No spaces around `;` or `=`. No spaces inside values:
   use `-` instead of a space, and `:` inside structured values only
   where the field definition says so.
4. Values are identifiers and kebab-case tokens only. No sentences.
   A value that would need a sentence does not belong in AgentCode —
   put the sentence in an `al:1` note, or in a linked artifact, and
   reference its id here.
5. Unknown codes: ignored, with a warning listed by the converter.
   They do not fail the whole record. (Same philosophy as AgentLang.)
6. No secrets, keys, tokens, passwords, phone numbers, payment
   details, or account identifiers, ever. A record matching a secret
   pattern is blocked with `secret-pattern` and the value is never
   echoed back. See the secret-pattern list below.
7. No code execution. AgentCode describes work; it never runs code.
   The site's only execution remains the Workshop sandboxed JS
   (user-typed, Web Worker, no DOM, no network, 10s timeout).
8. Proof is never faked. A claim without evidence uses `nn`
   (`proof=none` in AgentLang). A verdict with `nn` cannot resolve
   a conflict. Never invent a file, a test result, or a live check.

## Field codes

| Code | AgentLang code | Meaning | Required? |
|---|---|---|---|
| `a` | `agent:` | Sender agent id, e.g. `mia`, `claude`, `test` | Yes |
| `ro` | `role=` in `agent:` | Sender role, e.g. `builder`, `verdict` | No |
| `t` | `task:` | Task id, kebab-case, e.g. `review-login-loop` | Yes |
| `s` | `status:` | Status, 2-letter code (below) | Yes |
| `x` | `ctx:` | Context tokens, comma-free kebab tokens | No |
| `i` | `in:` | Input reference, e.g. `file=index.html` | No |
| `o` | `out:` | Output reference, kebab tokens | No |
| `v` | `verdict:` | `model:claim:proof-code`, e.g. `mia:review-login-loop:cd` | In verdicts |
| `f` | `conflict:` | `a:b:resolve`, e.g. `claude:gemini:code-only` | In conflicts |
| `n` | `next:` | Next step, kebab token | Terminal, see below |
| `d` | `done:` | What was verified, kebab token | Terminal, see below |
| `b` | `blocked:` | `reason:need`, e.g. `missing-proof:need-code` | Terminal, see below |
| `y` | `verify:` | `check:result`, e.g. `local-serve:pass` | No |
| `nt` | `note:` | Anything else, kebab tokens only | No |

## Status codes (2 letters)

| Code | Full status | Meaning |
|---|---|---|
| `td` | `todo` | Not started |
| `dg` | `doing` | In progress |
| `vf` | `verify` | Waiting on / doing verification |
| `dn` | `done` | Finished and verified |
| `bl` | `blocked` | Stopped, see `b` |

## Proof codes (inside `v`)

| Code | Full proof | Meaning |
|---|---|---|
| `cd` | `code` | Read in the file |
| `lv` | `live` | Seen live |
| `ts` | `test` | A test passed |
| `nn` | `none` | Unproven — say so, do not dress it up |

## End-state rule

A record must end in exactly one terminal field, as its LAST field:
- `n` (next) — status must be `td`, `dg`, or `vf`.
- `d` (done) — status must be `dn`.
- `b` (blocked) — status must be `bl`.

Exception, mirroring the AgentLang compact form: a record with
status `dn` or `bl` and NO terminal field is a compact end-state
record. This is what a Cloud single-line pack converts to, e.g.
`ac:1;a=test;t=live-browser-test;s=dn`. A record with status
`td`/`dg`/`vf` and no terminal field is blocked with
`terminal-missing`.

## Reason-code catalog (for `b`)

| Code | Full reason | Need (example) |
|---|---|---|
| `not-ac` | Not AgentCode | `ac:1-first-token` |
| `missing-agent` | No `a` field | `a=agent-id` |
| `missing-task` | No `t` field | `t=task-id` |
| `missing-status` | No `s` field | `s=td\|dg\|vf\|dn\|bl` |
| `status-not-legal` | Status not in the table | `s=td\|dg\|vf\|dn\|bl` |
| `terminal-missing` | No terminal field, status not done/blocked | `last-field-n\|d\|b` |
| `terminal-status-mismatch` | Terminal and status disagree | `d-requires-s=dn` etc. |
| `secret-pattern` | Value matches a secret pattern | `public-pack-only` |
| `proof-none-cannot-resolve` | Verdict with `nn` offered as proof | `proof-not-none` |
| `field-not-code-equals` | Field is not `code=value` | `code=value-fields` |
| `verdict-malformed` | `v` is not `model:claim:proof-code` | `v=model:claim:proof-code` |
| `blocked-malformed` | `b` is not `reason:need` | `b=reason:need` |

The converter reports these as
`blocked: reason=<code> | need=<value>`, exactly as AgentLang does.

## Secret patterns (detection regexes only, never values)

A record is blocked if it matches any of: an email address, a
private-key block (`-----BEGIN ... PRIVATE KEY-----`), a `sk-`
key prefix, a `ghp_` prefix, an `api_key`/`api-key` assignment,
a `password` assignment, or a `Bearer` token. The converter
checks these before parsing fields, and never echoes the value.

## Worked example

```
ac:1;a=mia;t=review-login-loop;s=dg;v=mia:review-login-loop:cd;n=handoff
```

Decoded (via `acToAl`):

```
al:1
agent: mia
task: review-login-loop
status: doing
verdict: model=mia | claim=review-login-loop | proof=code
next: handoff
```

## Versioning

This is AgentCode v1. A breaking change bumps the header to `ac:2`
and must be documented here first. v1 records must keep working:
new codes are additive, old codes are never silently redefined.
