al:1
agent: ai-workspace | role=self-test
task: first-task-self-test
status: todo
ctx: version=v7.3 | mode=read-only-safe | skill-plus-tool-together
in: agent.txt | skills.txt | skills/code-reviewer.txt | views/compare.txt
out: step-1=boot-fetch-agent-txt | step-2=discover-code-reviewer-in-skills-txt | step-3=read-skills-code-reviewer-txt | step-4=compare-verdict-bound-proof | step-5=convert-al-ac-roundtrip | step-6=slice-and-delta-pack | step-7=cloud-readonly-check | step-8=report-al1
note: template-only | run-the-steps-then-report | verified=false | self-test-path-decision=skills/code-reviewer.txt (catalog id, NOT a duplicate skills/code-review.txt)
next: run-self-test-steps
