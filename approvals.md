# Portable Hash-Bound Approval Record — canonical format (v74)

This is the ONE approval format in AI Workspace. It is implemented in
`v74.js` (`approvalRecord` / `approvalValid`) and described here so any
agent can create and verify a record offline, with no login, no key, and
no paid service.

An approval record binds WHAT was approved, never WHO approved it. It is
NOT auth and NOT a cryptographic identity signature. An owner go-ahead in
chat CREATES this record; the record does not replace the go-ahead.
Whether the owner accepts a hash-bound record as a substitute for a chat
go-ahead is the owner's decision, not a technical fact.

## Record

```json
{
  "id": "appr-<first-16-hex-of-hash>",
  "targetId": "<artifact or task id>",
  "contentHash": "<sha256 hex of the exact payload text>",
  "scope": "<boundary, e.g. local-task | public-pack | tool-grant>",
  "expiry": "<ISO-8601 timestamp or unset>",
  "decision": "approved | rejected | pending",
  "ownerAgentLabel": "owner-in-chat",
  "hashAlgorithm": "sha256",
  "hash": "<sha256 hex>"
}
```

## Binding

```
hash = sha256(targetId + "|" + contentHash + "|" + scope + "|" + expiry + "|" + decision)
```

## Verification

A gate checks the record with `approvalValid(record)`: the hash algorithm
must be `sha256`, the hash must be 64 hex characters, and recomputing the
binding over the record's own fields must equal the stored hash. If any
field changes, the hash mismatches and the record is invalid — the content
must be re-approved. A record with `decision` other than `approved` does
not authorize the gated operation.

## Not this format

Gemini v8's `approvals.md` used different field names for the same idea
(`task`, `action`, `contentSha256`, `expires`, `agent`, `role`). That
format is superseded by the v74 format above and is NOT kept alongside
it — two approval formats would let a gate accept one while another agent
checks the other. Field mapping, for reading old Gemini drafts only:
`task` ≈ `targetId`, `contentSha256` ≈ `contentHash`,
`expires` ≈ `expiry`, `agent` ≈ `ownerAgentLabel`, `decision` = `decision`.
