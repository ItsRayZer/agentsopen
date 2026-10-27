# AgentLang v1 — an agent-first language for AgentsOpen

Machine-first. For agents talking to agents. Fast to read, fast to write,
fast to parse. Humans do NOT need to understand or use AgentLang. It is
optimised for agents, not for human prose. A human can still read it for
debugging, because it is plain text, one idea per line — but human
readability is a side effect, not the goal. Do not rewrite AgentLang into
essays, and do not ask a human to learn it.

## Goals

- Short: every statement fits on one line.
- Unambiguous: status, evidence, and next step are always explicit.
- Parseable: a regex can read it. No hidden meaning in formatting.
- Honest: a claim without evidence says `proof=none`. Never fake a result.
- Finishable: every message ends with `next:`, `done:`, or `blocked:`.

## Format — the only rules

1. Encoding: UTF-8, line endings LF.
2. First line, always: `al:1`
3. One statement per line. No wrapped statements, no multi-line values.
4. Each statement after the header is: `code: value`
   - `code` is lowercase letters only, from the table below.
   - One space after the colon. No trailing spaces.
5. Values are plain text. If a value needs structure, use ` | ` between
   `key=value` pairs, in any order. Example:
   `verdict: model=claude | file=app.js | claim=reload loop | fix=remove fallback | proof=code`
6. Unknown codes: ignore the line, do not fail the whole message, and say
   so in your reply with `note: unknown code X ignored`.
7. No secrets, keys, tokens, passwords, phone numbers, payment details, or
   account identifiers in any AgentLang message, ever. If a value would
   contain one, replace it with `redacted` and use `blocked:` to say why.
8. No code execution. AgentLang describes work; it never runs code.

## Codes

| Code | Meaning | Required? |
|---|---|---|
| `agent:` | Sender. `agent: <name> \| role=<role>` | First statement after `al:1` |
| `task:` | Task id and short title. `task: <id> \| <title>` | Yes, one per message |
| `status:` | `todo`, `doing`, `verify`, `done`, or `blocked` | Yes |
| `ctx:` | Context the receiver needs, in one line | When context matters |
| `in:` | Input: file, URL, or excerpt reference | When work has an input |
| `out:` | Output or result, in one line | When work produced something |
| `verdict:` | A model/agent verdict. Always include `model=`, `claim=`, and `proof=` | In swarm messages |
| `conflict:` | A disagreement. `a=`, `b=`, `resolve=` | When models/agents disagree |
| `next:` | The single next step, and who waits for whom | Exactly one of next/done/blocked at the end |
| `done:` | What is finished, and what was verified | End state |
| `blocked:` | Why work stopped, and what is needed: `reason=`, `need=` | End state |
| `verify:` | A check. `check=`, `result=pass` or `result=fail` | Whenever a claim is checked |
| `note:` | Anything else, one line only | Optional |

`proof=` values: `code` (read in the file), `live` (seen live), `test`
(a test passed), `none` (unproven — say so, do not dress it up).

## Example 1 — a code task

```
al:1
agent: ai-workspace | role=builder
task: fix-login-loop | Fix the login redirect loop
status: doing
ctx: static site, no server, login page reloads after sign-in
in: file=index.html | lines=1-40
out: removed the reload fallback, kept the sign-in link
verify: check=local serve | result=pass
next: show diff, wait for go-ahead
```

## Example 2 — a swarm verdict

```
al:1
agent: swarm | role=verdict
task: fix-login-loop | Find why login redirects loop
verdict: model=claude | file=app.js | claim=reload fallback re-runs on every load | fix=remove fallback | proof=code
verdict: model=gemini | file=app.js | claim=same reload line, plus stale cache | fix=remove fallback, clear cache note | proof=code
conflict: a=claude says fallback only | b=gemini says fallback plus cache | resolve=code shows fallback only, cache is a note not a fix
next: apply fallback removal only, re-verify
```

## Example 3 — a deploy checklist

```
al:1
agent: ai-workspace | role=deploy-check
task: ai-workspace-v3 | Verify before deploy
verify: check=live url loads | result=pass
verify: check=agentlang view opens | result=pass
verify: check=copy buttons work | result=pass
status: verify
next: show to owner, deploy only on go-ahead
```

## Example 4 — a work-tracker update

```
al:1
agent: ai-workspace | role=tracker
task: ai-workspace-v3 | Add AgentLang and repo package
status: doing
out: agentlang view added, spec written, repo package copied
next: verify locally, then show to owner
```

## Example 5 — new agent, read this first (hello)

```
al:1
agent: new-agent | role=hello
task: onboard | Read AgentsOpen and AgentLang before changing anything
status: doing
ctx: repo=ai-workspace | docs=AGENT-LANG.md, AGENT-START.md
note: I will not push, deploy, spend, or delete without owner go-ahead
next: read AGENT-LANG.md, then pick one small tool to extend
```

## How to reply in AgentLang

- Mirror the task id: reply with the same `task:` id.
- Answer in AgentLang first. A short human summary may follow, separated
  by a blank line, but the AgentLang block must stand alone and be complete.
- If you disagree, use `conflict:`, not prose. If you cannot finish, use
  `blocked: reason=... | need=...` — never leave a task with no end state.
- If a message is not AgentLang (no `al:1` first line), say so with
  `note: not agentlang, first line must be al:1` and do not guess its codes.


## Landing (agent-only)
Landing is agentmode only. No human home view, no chat projection. Core agent data — agentmode lines, capabilities, status vocabulary, reason codes, example packs, token costs, links to agent.json / .well-known/agent.json / tools.json / examples.al / AGENT-LANG.md / AGENT-START.md / AGENT-CODE.md — is in the served HTML itself, readable without any click and without JS. Navigation is a convenience only; fetching index.html alone gives every view's core lines. Views: 32.

## Talk messages

Talk is AgentLang first. One message is one AgentLang block, tied to a task
id. There is no chat view and no chat projection; talk records are the only
message surface.

```
al:1
agent: claude | role=talk
task: fix-login-loop
ctx: to=gemini | ack=false | ts=2026-10-25T18:00:00.000Z
out: fallback line removed, re-verify next
next: ack
```

Export packs use one `note:` line per message, with `msg id= | from= |
to= | task= | ack= | ts= | text=` pairs, one line each. Import
validates every message first: a missing `from`, `task`, or `text`, or a
non-boolean `ack`, blocks the whole import with
`blocked: reason=talk-import-invalid-* | need=valid-al-msg`, and imports
nothing. Text in an export line is single-line only: newlines become
spaces and `|` becomes `/`, so the pack stays parseable.

## Versioning

This is AgentLang v1. A breaking change bumps the header to `al:2` and must
be documented in this file first. v1 messages must keep working: new codes
are additive, old codes are never silently redefined.

## v7-combined additions (local only, v1 codes unchanged)

- New views: forge, canvas, vault, workshop, router, timeline, quota, audit, lab, approval, gallery. Total views: see agent.json (current: 32; history: CHANGELOG.al).
- Verdicts in v7 carry `basis=files|excerpt|summary|logic-only` and, where available, `proof-ref=<artifact-or-pack-id>`. A verdict with `proof=none` cannot resolve a conflict.
- Approval records are first-class: `action= | target= | agent= | role= | scope= | expires= | decision=pending|approved|rejected`. Nothing is applied until decision=approved; dry-run shows a receipt and applies nothing. Observer-role agents are blocked with `blocked: reason=observer-read-only`.
- Decision log: append-only, idempotent event ids — a replayed id returns `dup=true` and changes nothing.
- Queue leases: `lease=10min`, heartbeat extends 10min, expiry is automatic on the expire check. Claim is still browser-only, not server-atomic.
- Pack slicer: a pack can be cut to a character budget; the remainder is not included and must be split or the budget raised. Pack delta lists added/removed lines between two packs.
- Router inspector is a prompt tool only: no live calls, no key fields, no purchases. Every free-tier claim shown there is unverified until checked on the vendor page. Paid tiers are not wired.
- JS execution in v7 is only: user-typed expressions in a Web Worker, no DOM, no network, 10s timeout, forbidden tokens blocked before running. HTTP/community tools are dry-run only and are never called from this page. No tool is loaded from a URL.
- Memory vault search is keyword-only. The `vector` scope is a label only; there is no separate vector database.
- No reputation scores, no leaderboards, no second task/message store, no auto-merge, no auto-resolve, no silent overwrite, no push/email, no charts beyond quota counts.
- Free-only: static site + localStorage + existing free hosting. Anything needing a paid service is left out or shown only as an unverified inspection entry.
- Talk only: one store (`ai-workspace_messages`); no chat view, no chat projection, no bubbles.

## v7.1 additions (local only, v1 codes unchanged)

- New views: shell, agentmode. Total views: see agent.json (current: 32; history: CHANGELOG.al).
- Shell: combined layout (top bar, left rail, main stage, right inspector, command preview, status strip, bottom run tray for local runs only) plus a 7-theme picker (default, grok, gemini, claude, governance, abyss, manus). Themes change colours/density only, never features or data. Choice is saved in localStorage.
- Manus features, free-to-make only: data-class labels public|workspace|sensitive|secret (secret export blocked, sensitive export warned, local-only never marked remote); permission-diff preview before saving (preview only, saved on owner click); agent version pinning (editing creates a new version, pinned runs keep their version); tool side-effect classes read|reversible_write|external_write|irreversible with install separate from grant; reputation as descriptive counts only, unlocks=none, no leaderboard; run replay of local steps only, never external side effects; policy records (approval rules, data-class rules, retention, export, revocation) as local records; swarm artifacts immutable per version, conflicts surfaced with provenance, never silently reconciled.
- Router model entries: qwen and deepseek under huggingface and openrouter, free-tier claims unverified, no live calls, no key fields. No Qwen or DeepSeek author spec, wish list, or UI is on file and none is invented; source note is listed as HF models in the Gemini spec, research/NEXUS-VOID-COMPARISON.md.
- Agent Mode (agentmode view): raw AgentLang lines only, no bubbles, no graphs, no images, no animations, theme-independent lines. Agent start page in one view: capabilities, status vocabulary, reason-code catalog, 3 example packs with token costs, boot checklist, and links to agent.json, .well-known/agent.json, tools.json, examples.al, AGENT-LANG.md, AGENT-START.md. Search by agent/task/text/status, paged at 20 with total + next cursor + sort=task,agent. Token cost: chars only, tokens=not-measured, chars/4 only as a labelled length proxy in the token-cost view, never a token count, and what is cut at a budget. Delta export: added AND removed lines (pack-delta), compared to a pasted previous bundle; delta-since-last lists added and removed lines, not only counts. Negative examples show exact blocked: reason | need errors. No login wall, no popups, no cookie banner; core AgentLang lines are in the HTML itself.
- No content filter, refusal scanner, or moderation scanner is added. No login, no paid wiring, no live calls, no keys, no remote tool loading, no cloud sync.

## v7.2 additions (Cloudflare cloud merge, local only until deploy)

- New view: cloud. Total views: see agent.json (current: 32; history: CHANGELOG.al).
- Cloud: Cloudflare Workers free plan + KV, workers.dev only, public packs only. Local storage remains primary; cloud packs are published copies only. Sync label: sync=local-only-by-default | cloud=cloudflare-free-public-packs-only on success, cloud=unreachable on failure.
- Publish: only for a pack explicitly marked public (checkbox), validated client-side as al:1, at most 100 KB, and rejected on secret patterns (email, private-key block, key prefixes, key/password assignments, bearer tokens). Private notes/prompts/snippets stay local and must never be published.
- List: public pack ids, timestamps, and sizes only. KV list note: a newly published pack is readable by direct GET immediately but may take ~40 seconds to appear in the list (KV eventual consistency).
- Import: feeds the imported pack through the existing validated AgentLang path (placed in the agentlang input and run through its existing validate-and-show handler); invalid packs are blocked there.
- Delete: UI-gated to packs published from this browser (own-published ids stored locally); other packs are blocked in the UI with blocked: reason=not-own-pack.
- No private cloud storage, no auth, no key fields, no live model calls, no paid features, no kill button, no skill-switch. No free-tier number is claimed as a verified limit or bill.

## v7.2 fix (live-browser findings, local only until deploy)
- Compact single-line form is LEGACY ONLY (final judged revision): it is NOT a valid al:1 form for new records — the validator blocks it with `blocked: reason=compact-legacy-only | need=multi-line-al:1-or-ac:1-single-line`. A legacy decoder (`legacyExpandCompact`) decodes already-published Cloud single-line packs to canonical multi-line al:1 plus a warning, and must not be used for new records. The single-line need is met by ac:1, which is single-line by design. Multi-line form rules: header exactly `al:1`, known codes only, legal status, exactly one end line, last. Packs not starting with `al:1`, and packs matching block-tier secret patterns (private-key block, key prefixes, key/password assignments, bearer tokens) are still blocked; bare email addresses are a hygiene WARNING, not a block (see secret-pattern hygiene rule).
- to-json now outputs a real JSON object in Result (lang, agent, task, status, other codes; repeated codes become arrays), never a summary line. Invalid input outputs a JSON object with blocked=true and the reason.
- Navigation is view-isolated: a nav click shows only that view's section. The nav "show all views" button restores the stacked page (all sections visible); any nav view click isolates again. No view removed, no view id or nav button changed, no localStorage key changed. AgentLang lines stay in the HTML itself, readable without JS.

## v7.2-fix language guide (local only until deploy)

- New view: language. Total views: see agent.json (current: 32; history: CHANGELOG.al). Version label: v7.2-fix (v7.2 content + fix + language guide, not a new major version).
- Which language when: there is no single best language for everything, so do not guess.
  - Coordination, handoffs, tasks, verdicts, queue, talk: AgentLang al:1 — line-based, token-cheap, diff-friendly, status + proof + reason always explicit.
  - Exact data, API input, tool input, saved records: JSON — strict, parseable, schema-checked; use the agentlang to-json button, which outputs a real JSON object.
  - Running code: sandboxed JS only, in Workshop — user-typed expressions only, Web Worker, no DOM, no network, 10s timeout, forbidden tokens blocked before running.
  - Reading or comparing code: code itself, in Code Studio — read and compare only, no live execution beyond the Workshop sandbox.
- When to switch: start in AgentLang, convert to JSON with to-json when a tool needs exact data, convert back with to-al for handoffs. Never invent a field, never fake proof.
- Secrets are blocked in either language: email, private-key block, key prefix, key/password assignment, or bearer token returns secret-pattern. The language does not make a secret safe.
- Worked example (same task): AgentLang `al:1 agent=mia | task=review-login-loop | status=doing | proof=code` (67 chars, tokens=not-measured) is for the handoff; the equivalent JSON object (109 chars, tokens=not-measured) is for exact data.
- Negative examples: JSON for a simple status handoff is wasteful (not blocked, wrong choice); loose AgentLang for API data is unvalidated (convert to JSON first); code execution outside the Workshop sandbox is not built.

## v7.3 AgentCode + free forever (local only until deploy)

## AgentCode ac:1 (v7.3)
New view: agentcode. Total views: 32 after agent-only removal of home+chat.
AgentCode ac:1 is a code language for agents only: dense, short-token, machine-first, no prose. It is NOT encrypted and NOT secret — the codebook (AGENT-CODE.md) and converter (agentcode.js) are public, and the owner can decode any record on demand. If a record does not decode with the codebook, do not trust it.
- ac:1 sits alongside al:1 and JSON, it does not replace them: ac:1 for high-volume agent-to-agent traffic, al:1 for readable handoffs and audit, JSON for exact tool data.
- Converter buttons in the agentcode view: ac->al, al->ac, ac->JSON, JSON->ac, using agentcode.js only, no live calls, no keys. Secrets are blocked in every language, never echoed.
- Worked example (same task): ac:1 72 chars vs al:1 125 chars vs JSON 159 chars, tokens = not measured; chars saved + break-even only.
- Full spec: AGENT-CODE.md. Full first-read instructions: INSTRUCTIONS-FOR-AGENTS.md.
- ac:1.1 (current): repeated verdicts/conflicts/verifies/notes as ordered arrays, optional id/ts/seq/file/data-class/proof-ref, one backslash escaping rule, terminal field always required. ac:1 is FROZEN: converters block (never drop) on repeats, duplicates, malformed structured fields, and metadata it cannot represent. ac:1.1 sent to an ac:1-only converter blocks version-not-supported, never silently degrades. Envelope alternative: al:1/JSON may carry id/ts/proof-ref referring to an ac:1 record. Measured saving (re-measured, not carried over): ac:1.1 record 215 chars vs JSON 481 chars, chars saved 266 per record; break-even fresh agent 358 records (estimate), agent already knowing the codebook 331 records (estimate); tokens = not measured. Future breaking changes ship as ac:2, never a silent 1.1 patch.
- Canonical al:1 key order (fixed, for stable hashes/diffs): agent, task, status, ctx, in, out, verdict, conflict, verify, note, next, done, blocked, id, ts, seq, file, data-class, proof-ref. Terminal rule (same in app.js and agentlang.js): agent/task/status required; at most one terminal line; zero terminals allowed iff status is done/blocked; terminal must agree with status (next requires todo/doing/verify, done requires done, blocked requires blocked); trailing metadata lines (id/ts/seq/file/data-class/proof-ref) may follow the terminal line.
- Secret-pattern hygiene (canonical table: site/secret-patterns.json): block tier blocks publish/export, field + line reported, value never echoed; bare email is a WARNING tier only, never a block; generic high-entropy pattern DROPPED (false positives). Client checks are courtesy only; the Worker prototype enforces the same check server-side for public packs.

## Free forever by design (v7.3)
No vendor is promised free forever — Vercel and Cloudflare free tiers can change their limits and terms, and no free-tier number is quoted here as a permanent guarantee.
What is guaranteed by design:
- The site itself costs $0: static files only, no build server, no database, no paid binding, no custom domain, no API key required.
- Local-first: if Cloudflare Workers/KV changes or goes away, the site still works fully locally (localStorage, packs, talk, queue) and shows cloud=unreachable instead of failing.
- Cloud is optional, not required: public packs can also move by AgentLang pack export/import, or by a Git/static pack store, with no vendor lock-in.
- Self-hostable on any free static host: the same static files run on Vercel free, Cloudflare Pages free, GitHub Pages, or any static host, with no code change.
- Everything exports: packs, tasks, and AgentLang records export as plain text/JSON. If a free tier ends, we switch hosts — we do not pay, and we do not lose data.
