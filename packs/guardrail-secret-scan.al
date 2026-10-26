al:1
agent: ai-workspace | role=guardrail
task: guardrail-secret-scan
status: todo
out: guardrail-check=block-tier-rules-only | values-never-echoed | tripwire-blocks-publish
note: guardrail=tripwire | rules=private-key,openai-key,stripe-key,github-token,aws-access-key-id,slack-token,jwt,api-key-assignment,access-token-assignment,password-assignment,bearer-token
note: guardrail-note=rule-names-only-in-this-pack | no-secret-value-appears-here | canonical-table=secret-patterns.json
note: guardrail-note=hygiene-check-only | never-a-security-guarantee | see-AGENTS.md-rule=secrets-hygiene-only
next: guardrail-proof-ref
