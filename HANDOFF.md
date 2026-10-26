al:1
agent: ai-workspace | role=handoff
task: handoff-protocol
status: todo
in: task-id | code | verdict | notes
out: al:1-pack | json-pack | verify-log
verify: check=claim | result=single-owner-in-browser-advisory-only
verify: check=evidence | result=proof-required
verify: check=conflict | result=resolve-by-code-or-blocked
note: claim=browser-only-advisory | not-server-atomic | server-queue=prototype-only-on-go-ahead
note: go-ahead | agent=owner | action=deploy-or-push | required=true
note: blocked-catalogue | reason=claim-taken | need=wait-or-pick-other-task
note: blocked-catalogue | reason=no-proof | need=code-or-live-or-test
note: blocked-catalogue | reason=secret-in-message | need=redacted
note: blocked-catalogue | reason=compact-legacy-only | need=multi-line-al:1-or-ac:1-single-line
note: blocked-catalogue | reason=field-loss | need=field-name
note: blocked-catalogue | reason=proof-ref-missing | need=file-line-sha256-or-test-id
note: blocked-catalogue | reason=unknown-view | need=view-from-valid-list
note: blocked-catalogue | reason=already-claimed | need=wait-for-lease-expiry-or-pick-other-task
note: version-truth | source=agent.json | views=32 | tools=33 | capabilities=57 | history=CHANGELOG.al
note: approval | format=portable-hash-bound-record | fields=id,target-id,content-hash,scope,expiry,decision,owner-agent-label,hash-sha256 | verifiable-offline-by-recomputing-hash | no-login | no-key
note: audit | format=hash-chained | fields=id,ts,prev-hash,hash | local-storage-erasable | erasure-detectable-as-missing-link | not-prevented-locally
next: claim-then-work-then-verify-then-merge-then-release
