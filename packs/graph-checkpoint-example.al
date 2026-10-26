al:1
agent: ai-workspace | role=graph
task: graph-checkpoint-example
status: todo
out: graph-checkpoint=replay-from-this-pack-onward | suffix-joined-with-separator
note: checkpoint=graph-example-1
note: graph=node=graph-example-1 | edge=graph-example-1-to-next | timeline-and-audit-chain-unchanged
note: graph-note=replay-is-byte-deterministic | same-checkpoint-same-bytes | helper=integration.js-graphReplay
next: graph-checkpoint-next
