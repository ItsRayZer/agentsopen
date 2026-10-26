/* Run with: node review-exchange-validator.test.js
 * No npm dependencies. Tests metadata validation only; they do not test artifact safety.
 */
"use strict";
const assert = require("node:assert/strict");
const validator = require("./review-exchange-validator.js");

const artifact = {
  schemaVersion: "review-exchange-0.1.0",
  recordType: "artifact",
  artifactId: "example-skill",
  artifactType: "skill",
  name: "Example Skill",
  summary: "A harmless synthetic fixture.",
  version: "1.0.0",
  sourceUrl: "https://example.invalid/repo",
  sourceRevision: "0123456789abcdef",
  contentHash: "sha256:" + "a".repeat(64),
  license: "MIT",
  tags: ["example"],
  capabilities: ["read-text"],
  permissions: [],
  dependencies: [],
  supportedRuntimes: ["node"],
  dataHandling: "Processes caller-supplied text only.",
  networkAccess: "none",
  sideEffects: [],
  requiredSecrets: [],
  installInstructions: "Copy the skill files into a test workspace.",
  status: "draft",
  visibility: "local",
  createdAt: "2026-10-26T00:00:00.000Z",
  submitter: { id: "fixture-author", assurance: "self-asserted" }
};

const validArtifact = validator.validateRecord(artifact);
assert.equal(validArtifact.ok, true, JSON.stringify(validArtifact.errors));

const missingName = { ...artifact };
delete missingName.name;
assert.equal(validator.validateRecord(missingName).ok, false, "missing required fields must fail");

const unknownField = { ...artifact, executionCommand: "run this" };
const unknownResult = validator.validateRecord(unknownField);
assert.equal(unknownResult.ok, false, "unknown fields must fail closed");
assert.ok(unknownResult.errors.some(e => e.code === "unknown-field"));

const badHash = { ...artifact, contentHash: "sha256:not-a-real-hash" };
assert.equal(validator.validateRecord(badHash).ok, false, "malformed hashes must fail");

const review = {
  schemaVersion: "review-exchange-0.1.0",
  recordType: "review",
  reviewId: "fixture-review-1",
  artifactId: "example-skill",
  artifactVersion: "1.0.0",
  artifactHash: "sha256:" + "a".repeat(64),
  reviewerType: "deterministic-check",
  reviewerId: "review-exchange-validator",
  reviewerVersion: "0.1.0",
  checklistVersion: "fixture-checklist-1",
  environment: "Node.js test fixture; no artifact execution",
  createdAt: "2026-10-26T00:00:00.000Z",
  checks: [{ checkId: "manifest-shape", status: "passed", outputDigest: "sha256:" + "b".repeat(64), durationMs: 0, evidenceRefs: ["fixture:manifest-shape"] }],
  findings: [],
  compatibility: [{ target: "review-exchange-0.1.0", status: "passed", evidenceRefs: ["fixture:schema-version"] }],
  limitations: ["Synthetic fixture only; no runtime behavior tested."],
  conflictsOfInterest: [],
  reproduction: "node review-exchange-validator.test.js",
  disposition: "promising",
  signatureStatus: "unsigned"
};
assert.equal(validator.validateRecord(review).ok, true, JSON.stringify(validator.validateRecord(review).errors));

const incompleteReview = { ...review, disposition: "insufficient-evidence", checks: [{ checkId: "runtime-test", status: "not-run" }] };
const incompleteResult = validator.validateRecord(incompleteReview);
assert.equal(incompleteResult.ok, true, "not-run is a valid recorded state");
assert.ok(incompleteResult.warnings.some(w => w.code === "incomplete-evidence"), "not-run checks must produce an incomplete-evidence warning");

const badCheck = { ...review, checks: [{ checkId: "runtime-test", status: "passed-with-unknown" }] };
assert.equal(validator.validateRecord(badCheck).ok, false, "unknown check statuses must fail");

console.log("PASS: review-exchange validator metadata fixtures");
