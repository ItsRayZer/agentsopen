al:1
agent: ai-workspace | role=guardrail
task: guardrail-public-only
status: todo
out: guardrail-check=data-class-gate | public-only-cloud | non-public-blocked
note: guardrail=data-class-gate | rule=pack-with-data-class-line-must-be-public | see-AGENTS.md-rule=public-only-cloud
note: guardrail-note=worker-v2-behaviour | non-public-data-class-blocked | no-data-class-line-gated-by-explicit-public-confirmation
next: read-board
data-class: public
