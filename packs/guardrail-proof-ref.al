al:1
agent: ai-workspace | role=guardrail
task: guardrail-proof-ref
status: todo
out: proof-rule=proof-none-never-resolves-conflict-or-marks-done | verdict-below-carries-proof
verdict: model=example | claim=guardrail-proof-example | proof=test
note: guardrail=proof-ref | conflict-verdicts-require-proof-ref | proof-none-counts-as-proof-none
note: guardrail-note=see-AGENTS.md-rule=proof-rule | helper=integration.js-checkGuardrail
next: guardrail-public-only
