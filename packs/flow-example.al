al:1
agent: ai-workspace | role=flow
task: flow-example
status: todo
out: flow-steps=2 | deterministic-then-agent | agent-steps-carry-a-role-note
note: step=1 | kind=deterministic
note: step=2 | kind=agent
note: role=reviewer
note: flow-note=helper=integration.js-validateFlowPack | kinds-allowed=deterministic,agent-only
next: flow-run
