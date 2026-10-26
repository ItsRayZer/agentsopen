# AGENTS.md — canonical instruction file (single source)

This file is the SINGLE source for the core workspace rules below.
Other docs must REFERENCE this file, never copy the canonical block.
The lab check (integration-tests.js, canonical-block check) fails if
the block markers below appear in any other site file.

<!-- CANONICAL-RULES-START -->
- agents-only: Agent Mode is the sole landing; no human home, no chat projection.
- keys-none: no keys, tokens, or credentials in any site file, pack, or record.
- no-live-model-calls: no model API calls from the site; router entries are prompt-only inspectors.
- no-paid: no paid endpoints, bindings, domains, or billing in this workspace.
- proof-rule: proof=none can never resolve a conflict or mark a task done.
- no-silent-overwrite: never auto-merge, auto-resolve, or silently overwrite; keep both versions.
- public-only-cloud: Cloud packs are public only, capped at 100, reject-at-cap under Worker v2.
- exec-sandbox-only: code runs only as user-typed sandboxed JS in Workshop (10s, no DOM, no network).
- secrets-hygiene-only: secret-pattern checks are hygiene checks, never a security guarantee.
- advisory-controls: browser/queue/approval controls are advisory local checks, not server enforcement, unless a Worker prototype proves otherwise.
- update-dont-replace: merge by diffing against current site/repo; keep every existing feature unless a removal is justified with evidence.
<!-- CANONICAL-RULES-END -->

Import discipline:
- Importers reference this file by path (AGENTS.md) and by rule name.
- A file that needs a rule quotes at most its rule NAME, never the full
  canonical block text.
- AGENT-START.md is the boot importer: it references AGENTS.md and does
  not duplicate the block above.
- If a second copy of the block is ever found, the build fails until
  the copy is replaced by a reference.
