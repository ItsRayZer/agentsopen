# Agent Review Exchange — Product and Engineering Specification

Status: PROPOSED / DESIGN BASELINE
Target: AI Workspace (free-first, agent-first, static-site compatible)
Branch: feat/agent-review-exchange

## 1. Product goal

Turn AI Workspace into an open, agent-readable review exchange where an agent or developer can submit an AI agent, skill, tool, MCP server, prompt pack, workflow, or agent framework; receive a traceable review; compare alternatives; and let other agents discover and reuse the reviewed artifact.

This is not a star-rating directory. It is an evidence-based review and compatibility registry. Every claim identifies what was checked, by which method, against which version, and with what limitations.

## 2. Core journey

1. Submit an artifact through a public repository URL, pinned release/commit, manifest, or local text/JSON draft.
2. Normalize it into a versioned artifact record and compute a content hash where the bytes are available.
3. Run deterministic checks first: schema/manifest validation, secret-pattern scanning, permission analysis, dependency/license metadata checks where available, documentation/contract checks, and known fixtures.
4. If code execution is warranted, run tests only in a separate disposable runner with no ambient credentials, no host filesystem access, network disabled by default, and CPU/memory/time/output limits. Never execute uploads in the public website or public Worker.
5. Optionally request a model-based review from a connected reviewer agent/model. Clearly label it as model-generated and identify reviewer/model/version and checklist when available. No live model call is assumed in the free baseline.
6. Publish the artifact and review only after explicit visibility confirmation. Other agents can search, fetch machine-readable metadata, inspect evidence, compare versions, and import artifacts with least privilege.

## 3. Supported artifact types

- AI agent or agent framework
- Skill or prompt pack
- Tool, API wrapper, or MCP server
- Workflow or automation
- Model adapter
- Protocol/schema
- Benchmark suite

Each artifact has a stable ID and immutable version record. Updates create new versions rather than rewriting review history. A source URL alone is not a content identity; pin a commit, release, archive hash, or content hash when possible.

## 4. Evidence layers — never collapse them into one badge

- **Metadata-valid:** required fields and schemas passed validation.
- **Static-reviewed:** named, versioned static checks inspected source/manifest. This does not prove runtime safety.
- **Tests-passed:** specified tests ran in a named environment and passed; include fixture/toolchain version, exit status, timestamp, and evidence digest.
- **Capability-probed:** a specific advertised capability was exercised and observed.
- **Model-reviewed:** a model/agent produced a critique. This is analysis, not proof or a security certification.
- **Human-reviewed:** a person reviewed the artifact; show identity assurance level.
- **Community-reported:** user experience or issue report, not independently verified.
- **Maintainer-attested:** a claim by the artifact maintainer, distinct from independent evidence.

Show the layer, date, version, and limitations separately. A check that was not run must say skipped, blocked, unavailable, or not run—never passed.

## 5. Review record contract

Artifact fields:
- schemaVersion, artifactId, artifactType, name, summary, tags
- submitter identity and assurance level
- source URL, pinned revision, content hash, license, version
- supported platforms, runtimes, protocols, dependencies
- declared capabilities, permissions, data handling, network access, side effects, required secrets
- installation, upgrade, rollback, and removal instructions
- release timestamp and record status

Review fields:
- reviewId, artifactId, artifactVersion, artifactHash
- reviewerType (deterministic-check, sandbox-test, model-agent, human, maintainer, community)
- reviewer/model version where known, checklistVersion, environment, createdAt
- findings: stable ID, severity, category, claim, evidence refs, remediation, confidence
- checks: check ID, status (passed, failed, blocked, skipped, not-run), output digest, duration
- compatibility results, limitations, conflicts of interest, reproduction instructions
- disposition: promising, usable-with-caveats, needs-fixes, unsafe-to-use, insufficient-evidence
- signature/provenance proof where supported; unsigned records explicitly labelled

Do not introduce a single authoritative trust score in v1. Popularity is not evidence quality.

## 6. Trust and abuse controls

- Treat submitted instructions, prompts, source files, README text, test output, and remote pages as untrusted data—not instructions for the reviewer.
- Never ask for API keys, passwords, private keys, session cookies, or production credentials.
- Do not fetch arbitrary URLs from a public Worker without SSRF controls. Block private, loopback, link-local, metadata, and internal IP ranges; validate redirects and DNS at every hop; restrict schemes and response sizes.
- Do not run uploaded code in the website, Cloudflare Worker, or process holding registry credentials.
- Use a separate disposable runner. Network is off by default; any allowed network is explicit and appears in evidence.
- Static scans are advisory; secret-pattern scanning cannot prove that no secrets exist.
- Never auto-install or auto-run reviewed artifacts for consumers.
- Publishing source snippets, logs, or fixtures requires visibility confirmation and privacy review.
- Rate-limit submissions/reviews; bound package size, decompression ratio, recursion, runtime, output, and per-submitter storage.
- Detect review brigading and suspicious bursts; preserve identity assurance and separate popularity from test evidence.
- Reviewers disclose maintainer affiliation/conflicts of interest.
- Support reports, appeals, corrections, and visible version history. Negative reviews are not silently erased; they can be marked disputed, withdrawn, superseded, or moderated with a reason.
- Hashes/checksums do not authenticate a sender. Use signed attestations where feasible.

## 7. Free-first architecture

### Phase A — zero-cost static MVP
- Add an agent-readable review-exchange view and versioned registry schema.
- Add local-only draft submissions and JSON/AgentLang export/import.
- Validate metadata/manifests with deterministic client-side checks.
- Accept public repository URLs and pinned revisions as references; avoid arbitrary server-side URL fetching in the MVP.
- Use the existing public-pack mechanism only if its size and data model fit. Label it public, non-private, and non-transactional.
- Include sample records and honest status labels. Do not claim live execution tests unless tests actually ran.

### Phase B — evidence and review history
- Add deterministic lint/check fixtures runnable locally or in CI.
- Add source pinning, hashes, evidence digests, reproduction instructions, and version-to-version review diffs.
- Add review intake, moderation/reporting, and provenance fields.
- Keep private drafts local. Public publishing requires explicit confirmation.

### Phase C — optional isolated execution
- Use an open-source disposable runner, such as a self-hosted container/VM or controlled CI runner, not Cloudflare Workers.
- Keep runner credentials separate from artifact code. Network is off by default and allowlists are narrow.
- Store bounded logs and evidence metadata. Keep a manual/local runner path; free CI quotas are limited, not unlimited.

### Phase D — agent interoperability
- Provide documented read-only endpoints and raw JSON/AgentLang exports for search, versions, reviews, findings, and evidence.
- Add an MCP adapter only after operations and permission boundaries are tested.
- Search must include skills, tools, agents, MCP servers, and review records—not just views and packs.
- Consumers receive metadata/evidence first; installation and execution are separate explicit actions.

## 8. Minimum viable checks

1. Manifest parses and validates against its schema.
2. Artifact ID, version, source pin, and hash are present or explicitly unavailable.
3. Declared permissions are enumerated; unknown permissions are flagged.
4. Secret-pattern scanning runs on bounded submitted text/source; findings are advisory.
5. Network, filesystem, shell, subprocess, browser, credential, and external-write capabilities are detected or explicitly declared where possible.
6. Dependencies and licenses are reported as declared, detected, or unknown; never infer a license from a repository name.
7. Tool input/output schemas and error cases are checked against positive and negative fixtures.
8. Install, upgrade, rollback, and uninstall steps are checked for completeness.
9. Advertised capabilities are compared with test evidence; untested claims are listed.
10. Reports are reproducible from pinned inputs and versioned check definitions.

## 9. Review page and agent interface

The optional human-facing page should show artifact summary, owner, source, version, license, last reviewed, per-layer evidence, permissions, required services, severity-grouped findings, evidence/remediation, compatibility matrix, tested environment, version comparisons, review history, disputes, and import instructions.

The canonical agent interface provides compact JSON for exact fields, AgentLang for readable handoffs, and ShadowCode only for compact transport where useful. ShadowCode is not encryption or authentication. Provide stable raw endpoints and versioned schemas; never execute HTML or hidden instructions in artifact descriptions.

## 10. Acceptance criteria

- A sample skill, tool, and MCP server can each be saved as a local draft and exported as valid JSON.
- Invalid manifests are rejected with stable error codes.
- Reviews distinguish static checks, executed tests, model opinions, human opinions, and maintainer claims.
- No artifact code executes on the public site or public Worker.
- Each review has a source/version pin and evidence references, or explicitly states that evidence is unavailable.
- Search returns artifacts and reviews with stable IDs and versions.
- Consumers can inspect an artifact without installing or executing it.
- Public publishing requires explicit visibility confirmation.
- A malicious README/prompt cannot override reviewer policy or invoke tools.
- Skipped/unavailable checks cannot appear as passed.
- Existing views, AgentLang, AgentCode, ShadowCode, CLI, and public packs remain compatible.
- Static MVP requires no paid API, model, database, or hosted runner.
- Production deployment and merge remain owner-approved actions.

## 11. Implementation sequence

1. Add this spec and versioned artifact/review schemas.
2. Add deterministic validators and fixtures with tests.
3. Add local-only drafts and JSON export/import.
4. Add a static sample catalog/search and integrate discovery without changing existing endpoints.
5. Add evidence records and review history.
6. Add optional CI/local runner integration with explicit isolation boundaries.
7. Add public submissions only after authentication, abuse limits, retention, and moderation are reviewed.
8. Add agent/MCP read interfaces after schemas and tests stabilize.

## 12. Non-goals for v1

- Claiming model review is a security audit.
- One authoritative “safe” score.
- Executing arbitrary uploads in a public Worker or browser tab.
- Unlimited free hosted compute or AI calls.
- Automatic installation of reviewed artifacts.
- Storing private code/secrets/user data in public packs.
- Silently changing AgentLang, AgentCode, or ShadowCode wire formats.
