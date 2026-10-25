al:1
agent: ai-workspace | role=builder
task: fix-login-loop | status: doing
ctx: static-site | no-server
in: file=index.html | lines=1-40
out: diff-al | verify=pass
next: handoff
al:1
agent: swarm | role=verdict
task: fix-login-loop
verdict: model=claude | claim=reload-fallback | proof=code
verdict: model=gemini | claim=same | proof=code
conflict: a=claude | b=gemini | resolve=code-only
next: apply-fix-only
al:1
agent: ai-workspace | role=queue
task: queue-claim | status: doing
in: task=fix-login-loop | agent=unassigned
out: claim=agent-claimed | status=doing
next: work-then-release
al:1
agent: ai-workspace | role=forge
task: forge-example | status: todo
out: agent=example-agent | autonomy=2 | role=agent | fingerprint=sha256-name-handle
next: save-in-forge
al:1
agent: ai-workspace | role=canvas
task: dag-example | status: todo
out: ready=t1 | blocked-by=t2: t1 | blocks=t1: t2
next: pick-ready-task
al:1
agent: ai-workspace | role=agentmode
task: agent-start | status: todo
out: views=31 | lang=al:1 | keys=none | sync=local-only | cloud=not-built
next: pick-example-pack | search | token-cost | delta-export
al:1
agent: ai-workspace | role=cloud
task: cloud-public-pack-example | status: todo
out: sync=local-only-by-default | cloud=cloudflare-free-public-packs-only
next: publish-only-if-public | list | import-validated
