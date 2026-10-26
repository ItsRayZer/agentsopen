al:1
agent: ai-workspace | role=evaluation
task: evaluation-example
status: todo
out: {"verdict": "pass", "proof": "test"}
note: schema=eval-example-v1 | required=verdict,proof | schema-valid=pass
note: eval-note=computed-from-out-json | claimed-must-equal-computed | helper=integration.js-validateEvaluationPack
next: evaluation-report
