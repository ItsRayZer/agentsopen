al:1
agent: ai-workspace | role=handoff
task: handoff-protocol | status: todo
in: task-id | code | verdict | notes
out: al:1-pack | json-pack | verify-log
verify: check=claim | result=single-owner-in-browser
verify: check=evidence | result=proof-required
verify: check=conflict | result=resolve-by-code-or-blocked
next: claim | work | verify | merge | release
blocked: reason=claim-taken | need=wait-or-pick-other-task
blocked: reason=no-proof | need=code|live|test
blocked: reason=secret-in-message | need=redacted
note: claim=browser-only | not-server-atomic | server-queue=later-only-on-go-ahead
note: go-ahead | agent=owner | action=deploy-or-push | required=true

note: v7.1 | local-only | not-deployed | not-pushed | free-only | sync=local-only | cloud=not-built

note: v7.2 | cloud-view+cloudflare-free-public-packs-only | local-only | not-deployed | not-pushed | free-only | sync=local-only-by-default | cloud=cloudflare-free-public-packs-only

note: v7.2-fix | language-guide-view+which-language-when | views=33 | local-only | not-deployed | not-pushed | free-only

note: v7.3 | agentcode-view+ac:1-convert+free-forever-by-design | views=34 | local-only | not-deployed | not-pushed | free-only

note: v7.3-agentonly | agent-only | landing=agentmode | no-human-home | no-chat-projection | views=32 | core-lines-in-html-no-click-needed | fetch=index.html-gives-all-views-core-lines | local-only | not-deployed | not-pushed | free-only
