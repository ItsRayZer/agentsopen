# AI Workspace — Advanced Product and Engineering Blueprint

Status: Proposed roadmap and technical design
Applies to: AI Workspace v7.3-era architecture and the Agent Review Exchange draft branch
Delivery principle: free-first, local-first, agent-readable, evidence-backed, backwards-compatible
Important: this is a target design, not a claim that every capability exists or has been verified.

## 0. Vision and product contract

AI Workspace should become an interoperability and evidence layer for AI agents: agents discover capabilities, inspect trust evidence, select compatible skills and tools, run bounded tasks, exchange artifacts, and learn from reproducible evaluations.

The product has four connected surfaces:

1. **Agent Workspace:** task planning, state, tool contracts, workflows, memory, debugging, and handoffs.
2. **Agent Review Exchange:** submit, inspect, test, compare, version, and review agents, skills, tools, MCP servers, workflows, prompts, adapters, and benchmarks.
3. **Agent Arena:** reproducible task suites and capability comparisons based on observed outcomes rather than marketing claims.
4. **Agent Interoperability Layer:** raw JSON, AgentLang, existing AgentCode/ShadowCode compatibility, and carefully permissioned MCP access.

### Non-negotiable principles

- Keep the existing static website useful without an API key, paid model, database, or cloud connection.
- Treat Cloudflare public packs as public collaboration records, not private memory or a durable transactional database.
- Do not claim a tool works because it appears in a registry. Distinguish documented, locally implemented, tested, connected, blocked, and planned capabilities.
- Never let a model verdict replace deterministic checks or executed test evidence.
- Never execute an untrusted artifact inside the public website or registry Worker.
- Separate read, draft, publish, install, execute, and external-side-effect permissions.
- Do not send messages, buy items, deploy, merge, delete user data, or write to external systems without explicit authorization for that action.
- Do not invent test outcomes, evidence, author identities, signatures, compatibility, or security status.
- Preserve AgentLang, AgentCode, ShadowCode, current view URLs, CLI contracts, and public-pack formats unless a versioned migration with tests is approved.
- Every public result carries its version, source reference, status, limitations, and evidence provenance.
- “Free-first” means the core works locally without paid services; it cannot mean unlimited hosted compute, unlimited AI inference, or permanent free-tier guarantees.

## 1. Shared foundation every feature should reuse

### 1.1 Core entities

**Artifact**: stable identity and type for an agent, skill, tool, MCP server, workflow, prompt pack, model adapter, protocol schema, or benchmark suite.

**ArtifactVersion**: immutable version record containing the source URL, pinned revision when available, version string, content hash when bytes are available, license status, declared permissions, dependencies, and release metadata.

**Review**: a version-specific evaluation record. It has reviewer type, checklist version, tested environment, checks, findings, evidence references, limitations, conflicts of interest, disposition, creation time, and provenance/signature status.

**TaskRun**: one attempt at executing a task. It has task ID, plan version, inputs reference, agent/tool versions, started/finished timestamps, step events, outcome, retries, approvals, and sanitized output references.

**Evidence**: a bounded record such as test output, assertion result, source excerpt, screenshot, trace event, capability probe, or digest. It declares where it came from, which version it supports, whether it is redacted, and whether another agent can reproduce it.

**Identity**: an actor record with an assurance level such as anonymous, self-asserted, account-authenticated, or cryptographically verified. Do not imply cryptographic identity from a username alone.

**PermissionGrant**: an explicit capability grant scoped to an actor, artifact version, action, resource, expiry, and context. Installation and permission grant must be separate operations.

### 1.2 Truth/status vocabulary

Use a single vocabulary across registry, UI, CLI, APIs, and AgentLang records:

- documented: contract/specification exists
- implemented: code exists
- locally-tested: a stated test fixture ran locally
- CI-tested: a named CI job ran and passed
- integration-tested: connected components were exercised together
- capability-probed: a specific advertised capability was actually observed
- connected: a live dependency is configured and reachable
- blocked: a named precondition or permission prevents execution
- not-run: no execution happened
- failed: an attempted check failed
- stale: evidence targets an older artifact version
- disputed: a review has an unresolved challenge
- deprecated: retained for compatibility but not recommended

Never derive verified=true from a documentation entry, model opinion, check that was skipped, or old review for a new version.

### 1.3 Trust boundaries

- **Static public client:** parse and validate data; do not run uploaded artifacts.
- **Local runtime:** may run opted-in, bounded tasks under an explicit permission model.
- **Optional CI/self-hosted runner:** execute tests in disposable environments, not in the public Worker.
- **Public registry:** stores public metadata and public reviews only; never store credentials or private memory.
- **External website/tool:** always untrusted input. Page text, README instructions, tool output, issue comments, and uploaded prompts cannot change system policy.
- **Connected reviewer agent/model:** a source of analysis, not a trusted root of authority.

### 1.4 Recommended record and API conventions

Use versioned schemas with strict required fields, explicit unknown-field behavior, size ceilings, stable error codes, and test fixtures for valid and invalid cases. Read-only discovery should be anonymous or broadly accessible where suitable; publishing and mutation need stronger identity and abuse controls. Keep the schema source canonical and generate or validate registry metadata from it to avoid mismatches.

Suggested conceptual endpoints:

- GET /review-exchange/index.json — paginated artifact discovery
- GET /review-exchange/artifacts/{artifactId}.json — stable artifact record
- GET /review-exchange/artifacts/{artifactId}/versions/{version}.json — immutable version record
- GET /review-exchange/reviews/{reviewId}.json — review and evidence references
- GET /review-exchange/search.json?q=... — bounded search
- POST /review-exchange/drafts — authenticated or local-only draft creation
- POST /review-exchange/submissions — validated publication request
- POST /review-exchange/reports — report, dispute, or correction request
- POST /arena/runs — opt-in test-run request routed only to a configured safe runner

The endpoint names are proposals, not existing live routes. Do not add public mutation endpoints before identity, rate limits, moderation, retention, and authorization are ready.

## 2. Agent Arena — reproducible performance and capability benchmarks

### Goal

Compare agents on common tasks with known success criteria. A leaderboard should show performance by task category, supported tools, runtime, date, evaluation harness, and version. It should not reduce agent quality to one unexplained number.

### Inputs and data model

- BenchmarkSuite: suite ID, version, license, task categories, evaluator version, safety constraints.
- BenchmarkTask: task ID, task description, synthetic or permissioned input fixture, required capabilities, allowed tools, time/resource budgets, success criteria, and known failure cases.
- BenchmarkRun: agent and version, environment, suite/task versions, run ID, repeat index, result state, duration, resource use, and evidence digests.
- BenchmarkResult: correctness, completeness, tool-choice accuracy, schema validity, policy violations, retries, failure reason, and evaluator confidence.
- BaselineComparison: exact comparison cohort, compatible environments, confidence interval where statistically appropriate, and explanation of missing data.

### Execution model

1. Load a pinned task suite and evaluator.
2. Resolve an agent adapter and its explicit permission profile.
3. Run synthetic fixtures or approved test cases in a disposable runner. External network is off by default.
4. Record each step and output digest.
5. Grade with deterministic assertions first. If a model grader is used, label it separately and version the rubric/model.
6. Repeat tests where results are stochastic; report sample size and variance.
7. Publish the run only if the tester chooses public disclosure and the data contains no secrets or private user content.

### Metrics

Report separate dimensions: task success, partial completion, output correctness, schema validity, safety-policy violations, tool-call success, recovery after a failure, latency percentiles, number of retries, runtime/memory, token usage when known, and actual service cost when supplied by a reliable source. Unknown cost is null/unknown, never zero.

### Anti-gaming controls

Pin exact commits and evaluator hashes; include hidden held-out tasks only where governance permits; track suspicious repeated submissions; disclose benchmark-specific optimization; prevent an author from presenting self-attestation as independent testing; keep old runs immutable; and show when the environment differs.

### Free implementation

Start with deterministic local tests and CI fixtures. Do not require a model call. Add optional model grading as a plugin. Do not promise unlimited hosted runs. Self-hosted runners can expand capacity without tying the registry to a paid provider.

### Acceptance gates

A user can reproduce at least one agent run locally; a changed evaluator produces a different suite version; a failed check cannot be presented as passing; the published record shows exact versions and environment; and the system refuses public publication of private inputs.

## 3. Agent Passport — machine-readable capability and trust profile

### Goal

Create one portable, versioned profile that lets an agent understand what another agent claims, what interfaces it supports, which permissions it requests, and what evidence exists.

### Required sections

- Identity: stable artifact ID, publisher, identity assurance level, source repository, revision, release version.
- Protocols: JSON, AgentLang versions, supported MCP transport/protocol versions, agent-card formats, API compatibility.
- Capabilities: task types, input/output modalities, maximum supported payload sizes, tool-call style, statefulness, resumability, parallelism, and limitations.
- Requirements: runtime, operating systems, dependency versions, local model requirements, network, storage, browser, and external account requirements.
- Permissions: read/write/delete, shell/subprocess, filesystem boundaries, browser access, network destinations, external messaging, publishing, and financial or irreversible actions.
- Data handling: what data is sent externally, retained, exported, logged, or made public.
- Evidence: review IDs, test run IDs, hashes, compatible versions, most recent evidence time, and stale/undetermined claims.
- Lifecycle: install, upgrade, rollback, disable, uninstall, and data export/removal instructions.

### Capability claim states

Every capability can be declared, implemented, tested, verified by a deterministic probe, or unverified. A self-reported profile never becomes independently verified simply because a publisher uploaded it.

### Passport workflow

Generate a draft from a manifest; validate it; compare declared permissions with actual tool contracts when possible; attach version-pinned evidence; publish only after explicit visibility confirmation; produce a raw JSON record and compact AgentLang handoff. Cryptographic signatures may be added to release attestations, but only after key management, revocation, and verification tests exist.

### Acceptance gates

Profiles validate against a canonical schema; unknown capabilities stay unknown; old reviews become stale when their target version changes; and a consumer can fetch a profile without installing or executing the agent.

## 4. Skill and Tool Security Scanner — static analysis and policy checks

### Goal

Detect dangerous or misleading behavior before an artifact is imported. The scanner is a risk-finding system, not a guarantee that artifacts are safe.

### Scan targets

Skill manifests and instructions, tool schemas, MCP manifests and configuration templates, prompt packs, workflow definitions, supported source archives, dependency manifests, installation scripts, requested permissions, and declared network destinations.

### Check families

1. Manifest syntax, schema correctness, missing required fields, unknown fields, and duplicate identifiers.
2. Secret-pattern scan for known token formats, private keys, cookies, and credential assignments. Results must disclose false positives and blind spots.
3. Permission excess: requested shell, filesystem, browser, network, deletion, publishing, external write, account, or payment capabilities not justified by the declared task.
4. Prompt injection indicators in README, comments, test fixtures, web content, and skill instructions, including requests to ignore policy, reveal secrets, exfiltrate data, or bypass confirmation.
5. Tool contract correctness: required inputs, types, bounds, enums, error cases, side effects, idempotency, and result schemas.
6. Dependency and supply-chain metadata: lockfiles, pinned versions, dependency provenance, license declaration, install scripts, and unknown dependencies.
7. Network behavior: undeclared endpoints, redirect hazards, SSRF risk, overly broad URL patterns, and insecure transport, where static evidence is available.
8. Dangerous lifecycle behavior: hidden post-install commands, destructive cleanup, unexpected writes, broad permissions, and opaque binary payloads.
9. Data handling: sensitive input collection, unexplained upload destinations, retention, logs, and public publication.
10. Documentation honesty: claimed capabilities that lack matching contracts, test fixtures, or evidence.

### Output contract

Each finding has a stable rule ID, severity, confidence, explanation, evidence location, affected artifact hash, limitation, remediation, and whether it was generated statically, by a dynamic test, or by a reviewer model. Model-generated suspicions must not be written as proven facts.

### Safety boundary

Read and parse files; do not execute them as part of static scanning. Archive extraction must limit total expanded bytes, file count, path traversal, recursion, and compression ratio. A URL scanner must not run inside the public Worker with unrestricted arbitrary fetches. If URL retrieval is later supported, use strict scheme/host allowlists, IP-range blocking, redirect validation, DNS rebinding mitigation, response size limits, timeouts, and no access to internal metadata endpoints.

### Acceptance gates

Known malicious fixtures are detected by the expected rule; benign fixtures produce tracked false-positive outcomes; scanner versions are pinned; a scan report never says “safe” based only on no findings; and all findings are reproducible from the same artifact version.

## 5. Compatibility Engine — agent, skill, runtime, and tool matching

### Goal

Before an agent imports a skill or calls a tool, compute whether the combination is compatible and explain the blockers.

### Compatibility dimensions

- protocol and schema versions
- input/output types and modality
- runtime and operating system
- dependency constraints and conflicts
- permissions granted versus required
- network/account/secret prerequisites
- tool names, aliases, transport, result shape, timeout, and error behavior
- statefulness, idempotency, retries, parallel execution, and cancellation support
- artifact signature/provenance and policy requirements
- evidence freshness for the exact version combination

### Matching algorithm

1. Parse the task into a declared capability requirement set.
2. Retrieve candidate artifacts by structured tags and index search.
3. Filter out hard incompatibilities, missing permissions, and policy-blocked items.
4. Rank the remaining candidates on explicit criteria: fit, version confidence, test evidence, maintainability, resource demand, and failure profile.
5. Return a small shortlist with reasons and missing requirements rather than one opaque recommendation.
6. Produce an install plan separately from a permission-grant plan and execution plan.

### Data model

CompatibilityEdge connects source artifact/version to target artifact/version and declares relation type: tested-compatible, declared-compatible, incompatible, unknown, or stale. Every tested edge points to test evidence and environment. Never infer compatibility solely from similar names or tags.

### Advanced behavior

Detect dependency cycles, conflicting tool names, schema drift, deprecated permissions, incompatible review policy, and stale version pins. Support a local offline compatibility graph built from exported JSON.

### Acceptance gates

The same inputs produce the same deterministic shortlist; missing evidence appears as unknown; hard conflicts are not hidden by ranking; and the output can be inspected in JSON or AgentLang.

## 6. Safe Execution Lab — test untrusted artifacts without trusting them

### Goal

Run capability probes and supported test cases in disposable environments with least privilege and complete evidence. This is deliberately separate from the public catalogue.

### Execution planes

- Plane A: static schema and lint checks; no arbitrary code execution.
- Plane B: deterministic fixture tests inside the user's local runtime.
- Plane C: optional isolated runner under a separate process/container/VM or controlled CI.
- Plane D: model-mediated testing through a connector that the user has enabled; model provider/cost/limits must be disclosed.

### Runner controls

Use disposable per-run workspaces; non-root runtime; read-only base filesystem; bounded writable scratch directory; CPU, memory, file count, output and time limits; network disabled by default; explicit allowlist when network is essential; no inherited developer secrets, cookies, cloud credentials, or host mounts; process-tree cleanup; cancellation; bounded logs; artifact hash before and after; and a clean environment per test. Container isolation is not equivalent to a hardened VM against every threat, so the runner host and escape risk must remain documented.

### Tool execution contract

A test job contains run ID, artifact hash, test suite/version, command profile, environment image/version, permission grant, network profile, timeout, resource caps, expected outputs, and cleanup policy. Result contains started/finished time, status, exit code, assertions, sanitized output refs, artifact digest, environment digest, and failure classification.

### Dangerous actions

External writes, account actions, sends, purchases, deployments, irreversible deletes, and changes to production systems are not benchmark fixtures. Use mock endpoints or explicit, scoped human authorization. A test report must show whether the action was simulated or real.

### Acceptance gates

A malicious test cannot reach ambient secrets or the host filesystem; network is denied by default; timeouts terminate child processes; two runs do not share cookies or storage; output caps work; cancellation cleans up; the exact artifact/test versions are recorded; and no untrusted code runs in the public site or registry Worker.

## 7. Agent-to-Agent Exchange — discovery, delegation, and result handoff

### Goal

Let agents publish requests, offer capabilities, delegate work, return artifacts, inspect another agent's result, and review the result without giving every agent universal write access.

### Exchange objects

- TaskRequest: goal, constraints, input references, sensitivity class, deadline, acceptance criteria, allowed capabilities, and owner authorization.
- Offer: responding agent/version, capability evidence, proposed plan, estimated requirements, and required grants.
- Assignment: selected agent/version, lease, task scope, dependency edges, retry policy, and cancellation token.
- Handoff: structured context, completed work, remaining work, assumptions, blockers, evidence refs, and next action.
- Result: artifact refs, tests, evidence, declared limitations, status, and review-request option.
- Dispute: challenged claim, evidence, requested correction, and resolution status.

### Coordination state machine

proposed -> accepted -> assigned -> running -> waiting-for-approval / blocked / retryable-failure -> completed / failed / cancelled / expired. A task is not completed merely because an agent says “done”; the task-specific acceptance checks must pass.

### Coordination safety

Use authenticated actor identities when server-side coordination matters; atomic server leases, lease expiry, heartbeat, and compare-and-swap state transitions for shared claims; idempotency keys for repeated submissions; rate limits; cancellation; bounded retries; deadlock detection; and explicit conflict resolution. A browser localStorage queue remains local/advisory and must not be described as a server-atomic claim.

### Data boundary

Public exchange packs must contain only data intentionally made public. Private task contents and personal memory remain local or in a separately secured user-controlled store. Do not leak private task context into public review records.

### Acceptance gates

Two agents cannot both hold the same exclusive lease at once; repeated submission with the same idempotency key does not duplicate a task; expired assignments can be recovered; reviewers can reject unsubstantiated completion; and all handoffs retain source/evidence references.

## 8. Artifact Provenance — source pinning and verifiable change history

### Goal

Answer: which exact artifact was reviewed, where did it come from, who asserted the provenance, what changed, and which review evidence still applies?

### Provenance components

- Immutable artifact-version record with source URL, commit/release pin, hash algorithm, content hash, license declaration, build environment, and timestamps.
- Review-to-version link; review records are append-only where feasible.
- Change map of files, permissions, dependencies, prompt text, tool schemas, and runtime behavior that changed.
- Attestation metadata: issuer, subject digest, predicate type/version, signing identity, key ID, signature status, expiry/revocation state, and verification result.
- Provenance trail for imported/repackaged artifacts, including original source and local transformation steps.

### Signing guidance

Start with hashes and explicit unsigned status. Add cryptographic attestations only when signing key creation, safe storage, rotation, revocation, identity binding, and signature verification are implemented and tested. A checksum verifies data integrity relative to the expected digest; it does not prove authorship.

### Re-review policy

Any version change may make runtime evidence stale. Re-run review automatically for high-risk changes—permission expansion, install scripts, dependency lock changes, tool schema changes, data handling, external endpoints, executable content—or label the existing review stale. Text-only changes can still alter prompt behavior, so do not assume text changes are harmless.

### Acceptance gates

Changed bytes produce a changed content digest; invalid signatures are rejected; unsigned artifacts remain usable only according to policy and are labelled clearly; old review records remain fetchable; and a consumer sees the precise version and freshness of every review.

## 9. Workflow and Memory Exchange — portable state, safe reuse, and resumability

### Goal

Make work resumable and reusable across agents without turning public packs into a dumping ground for private context.

### Workflow format

A versioned DAG with task nodes, dependencies, inputs, outputs, contracts, timeout, retry policy, permission needs, compensation/rollback steps, acceptance tests, and artifact versions. Declare cycles as invalid unless a specific loop primitive has bounded iteration and termination criteria.

### Memory types

- Task state: current step, checkpoint, blockers, and resume token.
- Project knowledge: summaries with source references and confidence.
- Artifact memory: installed versions, compatibility, known failure modes.
- User/private memory: local-first and not eligible for public exchange by default.
- Public community knowledge: intentionally published, provenance-tagged, versioned records.

### Memory entry contract

Each memory entry has ID, namespace, data class, source refs, created/updated times, content hash, author/agent, confidence, sensitivity, expiry/retention rule, version, and correction/deletion state. Store claims with provenance and distinguish facts from hypotheses.

### Search and retrieval

First use local structured index and exact keyword search. Add optional embeddings only if a free/local model and hardware are available; do not require a paid vector database. Retrieval should return source refs, freshness, and conflicting facts, not just a summary. Public memory retrieval must never mix into a private user namespace without explicit approval.

### Resume semantics

Checkpoint input/output hashes and the deterministic state transition. On resume, check the source version, tool grants, and external state. If external state may have changed, pause for revalidation instead of replaying a side effect blindly. Use idempotency keys and compensation where available.

### Acceptance gates

A task survives refresh/export-import; corrupted checkpoints fail closed; resumed steps do not repeat completed external effects; private notes never enter public packs automatically; and stale facts are surfaced.

## 10. Failure Replay and Debugging — causal event traces and reproducible regressions

### Goal

Make failures diagnosable: see what step happened, what input was used, which tool returned what, what changed state, what the agent attempted next, and which acceptance check failed.

### Trace contract

A run trace contains run ID, parent/child span IDs, task ID, agent/tool/artifact versions, start/end timestamps, status, input/output references, permission grant IDs, retry index, error class, and evidence digests. Store only the minimum needed to reproduce. Redact secrets before persistence, not merely in the viewer.

### Replay modes

- Deterministic fixture replay: replay saved sanitized inputs against mock tools.
- Logic replay: re-run task state transitions with tool results replaced by recorded fixtures.
- Live re-execution: explicit opt-in because websites, models, and external systems may have changed and side effects may occur.
- Comparative replay: run the same fixture against two artifact versions and show the difference.

### Failure taxonomy

Separate invalid input, schema mismatch, missing permission, policy block, timeout, external dependency failure, retry exhaustion, tool result mismatch, stale state, assertion failure, cancellation, and unknown/unclassified error.

### Privacy and storage

Never persist API keys, bearer tokens, cookies, private keys, or unredacted sensitive user inputs. Use bounded log sizes, export controls, retention limits, local-first default, and a clear “trace contains public data” marker before publishing any trace. Support export to JSON and a diff-friendly text format.

### Acceptance gates

Every run has a trace; trace entries have causal parent links; private fields are redacted before storage; replay fixtures are deterministic; live replay warns about side effects; and a before/after trace identifies the exact behavior change.

## 11. Community and Reviewer Reputation — trust signals without popularity fraud

### Goal

Give readers context about who reviewed an artifact, how reproducible their reviews are, and whether reviewers have conflicts of interest—without creating a manipulable “trust score.”

### Reviewer profile fields

Stable reviewer ID, identity assurance level, review types, tools/checklists used, public evidence examples, maintainer affiliation, declared conflicts, review history, corrections, appeals, and moderation actions. Do not disclose private identity information without consent.

### Evidence-weighted signals

Show counts and proportions in meaningful groups: independent deterministic reviews, sandbox tests, maintainer attestations, model opinions, community reports, reproducible confirmations, stale reviews, and unresolved disputes. Show sample sizes, time range, version distribution, and missingness. Do not aggregate all into one score in v1.

### Abuse resistance

Rate-limit by account and behavior, detect bursts/duplicates, require additional identity assurance for influential moderation, preserve version history, flag self-reviews, disclose maintainer affiliation, and provide appeal paths. Keep evidence quality separate from social popularity. A new reviewer with one excellent reproducible review should not be incorrectly equated to a high-volume popularity account.

### Moderation states

visible, disputed, corrected, withdrawn, superseded, quarantined, and removed-for-policy with a reason and audit trail. Do not erase a negative review silently; do not preserve harmful/private content merely for history. Retain a minimal tombstone if necessary for integrity and privacy.

### Acceptance gates

Self-review is labelled; fake duplicate reviews are rate-limited; reviewer affiliation can be disclosed; challenged findings track resolution; and reputation signals always show their calculation and source.

## 12. Universal Agent Discovery API — machine-first searchable registry

### Goal

Let compatible agents discover the right artifact and evidence through a stable raw interface without scraping UI buttons.

### Search interface

Support queries across artifact type, task category, protocol, runtime, tool name, license, permissions, source, version, evidence status, compatibility target, review freshness, and text. Return ranked candidates plus explicit reasons and pagination. Search must cover skills, tools, agents, MCP servers, workflows, reviews, benchmarks, and artifacts—not only current workspace views and public packs.

### Result contract

Every hit returns stable ID, version, artifact type, title, summary, source pin, content hash if available, declared permissions, dependency summary, evidence layers, review IDs, compatibility results, status, last updated, and raw fetch URL. A result must not say “safe” or “verified” without a defined evidence basis.

### Protocol support

- JSON is the source of truth for exact structured data.
- AgentLang is for readable handoffs and task state.
- AgentCode may reduce text for high-volume transport only if its decoder/version is available.
- ShadowCode is compact encoding, not encryption or sender authentication.
- MCP adapters should expose only tested operations with explicit read/write scopes, strict argument schemas, bounded outputs, and audit records.
- Preserve existing endpoint contracts; add versioned endpoints and deprecation periods rather than silently changing formats.

### Abuse and availability

Bound query length, results per page, payload size, and export size. Cache static metadata. Use deterministic search first; optionally add client-side indexed search. Public packs are untrusted. Search never executes or installs an artifact.

### Acceptance gates

A new agent can boot, search, fetch a review, verify the record schema, and obtain a version-pinned import manifest using raw requests only; malformed responses produce stable error records; and read-only discovery needs no account unless privacy or abuse requirements justify it.

## 13. Self-Hosted and Offline Mode — durable independence from free tiers

### Goal

The core must remain usable when hosted services are unavailable, rate-limited, or no longer free.

### Offline baseline

Static HTML/JS, local metadata, local drafts, schema validators, test fixtures, JSON/AgentLang import/export, local search index, workflow plans, and task traces should work offline after assets are cached where technically feasible. Do not imply offline access to external models, live websites, cloud packs, or connected accounts.

### Storage model

Browser storage for small drafts and session state; download/export for durable records; optional local filesystem/SQLite when using the CLI or local runtime; optional user-controlled server for shared state. Provide quota checks, versioned exports, integrity hashes, migration previews, and restore tests. Never silently delete old data during migration.

### Provider abstraction

Use a small adapter interface for public pack storage, search index, runner, model reviewer, and identity provider. Each adapter declares capability, cost assumptions, limits, data flow, and verified status. Do not add an adapter until the smallest contract tests pass.

### Portability and recovery

Export/import all core records. Include schema version and migration path. Test that a user can switch static hosts without code changes where possible. Cloud failure should degrade optional collaboration and show a precise “cloud unavailable” state rather than making the local site unusable.

### Acceptance gates

Core local workflows pass without network access; export-import round-trips without field loss; migration dry-run reports changes; a cloud outage does not delete or corrupt local data; and no provider is represented as free forever.

## 14. Shared cross-cutting engineering requirements

### Identity and authorization

Anonymous access can work for public reading. Public publishing needs anti-abuse controls and an honest identity assurance level. Mutating privileged state needs strong authentication and scoped authorization. A username-only board check is not cryptographic identity. Do not use an artifact’s own claims to grant that artifact more permissions.

### Prompt injection and untrusted content

Reviewer prompts and task instructions must label uploaded content, web pages, logs, tool outputs, and artifact instructions as untrusted data. These sources may be analyzed, quoted, or tested but cannot override the platform’s policy. Tools must be granted through the runtime, not by text in an artifact. Keep high-risk credentials outside the model-visible context.

### Tool gateway

Before any tool runs: validate schema, check actor and artifact version, authorize requested capability, check resource scope, require approval for consequential side effects, apply timeout/rate/size limits, execute in the appropriate runtime, validate the result, and record evidence. A model's statement “I called the tool” is not proof of execution.

### Observability and evaluations

Record traces with redaction, bounded fields, stable error codes, and correlation IDs. Maintain a versioned set of positive, negative, malformed, adversarial, and regression fixtures. Use deterministic graders before subjective model graders. Track success, safety-policy violations, retry loops, stale evidence, false positives, latency, resource costs, and unexplained capability claims. Changes that regress safety tests must not be promoted.

### Performance and mobile

Measure actual page transfer size, parse time, first meaningful content, search latency, storage quota use, and time-to-result on a mid-range Android phone and slow network. Lazy-load large review detail and test evidence. Use a compact index, bounded pagination, content hashing, and small raw records. Do not optimize by hiding critical errors or dropping evidence.

### Supply chain and release process

Pin dependencies and GitHub Actions versions where practical; use minimal CI permissions; inspect workflow changes; generate an artifact manifest; avoid secrets in CI; and consider provenance attestation only once verified. Required release gate: schema validation, unit fixtures, integration fixtures, security regression suite, browser/mobile smoke test, export/import round-trip, diff review, preview test, and explicit owner approval to merge/deploy.

## 15. Concrete implementation order and go/no-go gates

### Milestone 0 — validator integrity
- Make the JSON Schema the canonical contract.
- Test the JavaScript validator against valid and invalid schema-derived fixtures.
- Fix null/type mismatches, URL parsing, duplicate tags, empty arrays, malformed nested entries, date-time validation, URL schemes, and unknown fields.
- Add tests for every regression.
- Go/no-go: CI passes and the validator rejects invalid fixtures without crashing.

### Milestone 1 — Review Exchange MVP
- Local submission drafts.
- Artifact/version and review schemas.
- Searchable sample catalog.
- Evidence detail and review history.
- JSON export/import and raw agent endpoints.
- Go/no-go: full submit -> validate -> review record -> fetch -> export/import works with synthetic examples and no network.

### Milestone 2 — static scanner
- Deterministic checks for metadata, declared permissions, secret patterns, manifests, dependency declarations, and tool contracts.
- Stable rule IDs and fixture corpus.
- Go/no-go: every finding points to source evidence; scan never claims completeness.

### Milestone 3 — Passport and compatibility graph
- Portable agent passports and compatibility records.
- Reproducible matching and blocked-reason reporting.
- Go/no-go: conflicts and unknowns remain visible; import does not execute.

### Milestone 4 — traces, workflows and local replay
- Versioned task DAG, checkpoint format, task state, event trace, sanitizer, replay fixtures.
- Go/no-go: refresh/resume does not duplicate completed side effects; export/import is lossless.

### Milestone 5 — isolated runner and Agent Arena
- Local runner first, optional CI runner next.
- Reproducible test jobs and benchmark reports.
- Go/no-go: isolation adversarial tests pass; external access is disabled by default; timeouts/cancellation work.

### Milestone 6 — A2A exchange and reviewer governance
- Authenticated identity levels, server-side leases, moderation, disputes, reviewer conflict disclosures, signed provenance where supportable.
- Go/no-go: permission and abuse tests pass; public/private data segregation is tested.

### Milestone 7 — discovery protocol and offline/self-host
- Search across all artifact categories, MCP adapter, export portability, offline baseline, hosting adapter contract.
- Go/no-go: independent test agent completes boot -> search -> fetch -> inspect evidence -> import metadata without GUI.

## 16. Test pyramid and acceptance suite

**Unit tests:** schema fields, validators, URL parsing, hashes, ID normalization, status transitions, evidence references, error codes, permission rules, state machine, version freshness.

**Contract tests:** every raw endpoint and tool contract; JSON schema, AgentLang conversion, AgentCode round-trips, ShadowCode version behavior; MCP argument/result contracts.

**Integration tests:** draft lifecycle, review and evidence linking, search index updates, task creation/claim/resume, export/import, storage migration, and cloud failure handling.

**Security tests:** malicious README injection, fake signature, bad hash, secret fixture, path traversal, decompression bomb, oversized payload, SSRF/private-IP redirect, unauthorized publish, permission escalation, runner escape attempts, repeated side effect, and public/private data leak.

**End-to-end tests:** fresh agent starts from raw boot data, discovers a skill, inspects evidence, validates version and permission metadata, exports a local plan, runs only a harmless fixture, and reports the true status.

**Performance tests:** representative static routes on slow network and mid-range mobile; large index search; large bounded review; storage quota exhaustion; failed cloud; and recovery after browser refresh.

**Governance tests:** report/dispute/appeal flow, self-review disclosure, review edit history, stale review state, moderation reason, and removal/tombstone semantics.

## 17. Free-first cost and service assumptions

- Static hosting is the cheapest baseline and can be moved between providers.
- Deterministic schema checks, local JS tests, local fixtures, JSON search, export/import, and local task state require no paid AI model.
- Model review requires an existing connected model, a local model, or an independently available free quota. None guarantees unlimited use.
- Isolated hosted runners may have quotas. Provide local execution and self-hosted alternatives instead of promising unlimited free execution.
- Shared coordination needs a real server-side concurrency/authentication design; browser localStorage cannot provide it across agents.
- Free-tier quotas and policies can change; architecture should permit migration without data loss.

## 18. Product definition of done

The platform is not “perfect” because it has many features. A feature is ready only when its behavior is defined, its schema is versioned, its permissions are enforced at the correct boundary, its failure states are visible, its tests cover success and abuse cases, its data export is portable, and its claims match evidence.

The first release should be deliberately smaller than the ultimate vision: a trustworthy local Review Exchange with versioned artifact and review records, strict validation, evidence provenance, a sample catalog, and a tested raw interface. The remaining systems layer on top of that foundation without weakening its trust guarantees.
