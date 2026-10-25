al:1
agent: ai-workspace | role=boot
task: onboard | status: todo
in: agent.json | capabilities.json | tools.json | AGENT-LANG.md | HANDOFF.md | examples.al
out: views=29 | lang=al:1 | keys=none | exec=sandboxed-js-only
verify: check=node-check | check=id-check | check=serve-200 | check=secrets-scan
next: pick-one-small-change | verify | show-change
note: read-first | files=AGENT-LANG.md,HANDOFF.md,tools.json
note: add-tool | registry-only=tools.json-only | no-browser-add-tool-ui | no-home-view
note: never | secrets=none | money=none | axofy=none | delete-owner-data=none | deploy-or-push=go-ahead-only | exec=sandboxed-js-only | fake-result=none
note: claim | queue-view | single-owner-in-browser | not-server-atomic
note: update-anytime | agent=owner | action=go-ahead | required=true
note: report | format=al:1 | end=next-or-done-or-blocked

note: v7.1 | local-only | not-deployed | not-pushed | free-only | sync=local-only | cloud=not-built

note: v7.2 | cloud-view+cloudflare-free-public-packs-only | local-only | not-deployed | not-pushed | free-only | sync=local-only-by-default | cloud=cloudflare-free-public-packs-only

note: which-language-when | view=language | rule=start-al:1 | convert=json-when-tool-needs-exact-data | execution=sandboxed-js-only-workshop | code=read-compare-only-studio | never=invent-field-or-fake-proof-or-secret-in-any-language

note: v7.2-fix | language-guide-view+which-language-when | views=33 | local-only | not-deployed | not-pushed | free-only

## Free forever by design (v7.3)
No vendor is promised free forever — Vercel and Cloudflare free tiers can change their limits and terms, and no free-tier number is quoted here as a permanent guarantee.
What is guaranteed by design:
- The site itself costs $0: static files only, no build server, no database, no paid binding, no custom domain, no API key required.
- Local-first: if Cloudflare Workers/KV changes or goes away, the site still works fully locally (localStorage, packs, talk, queue) and shows cloud=unreachable instead of failing.
- Cloud is optional, not required: public packs can also move by AgentLang pack export/import, or by a Git/static pack store, with no vendor lock-in.
- Self-hostable on any free static host: the same static files run on Vercel free, Cloudflare Pages free, GitHub Pages, or any static host, with no code change.
- Everything exports: packs, tasks, and AgentLang records export as plain text/JSON. If a free tier ends, we switch hosts — we do not pay, and we do not lose data.

## AgentCode ac:1 (v7.3)
New view: agentcode. Total views: 32 after agent-only removal of home+chat.
AgentCode ac:1 is a code language for agents only: dense, short-token, machine-first, no prose. It is NOT encrypted and NOT secret — the codebook (AGENT-CODE.md) and converter (agentcode.js) are public, and the owner can decode any record on demand. If a record does not decode with the codebook, do not trust it.
- ac:1 sits alongside al:1 and JSON, it does not replace them: ac:1 for high-volume agent-to-agent traffic, al:1 for readable handoffs and audit, JSON for exact tool data.
- Converter buttons in the agentcode view: ac->al, al->ac, ac->JSON, JSON->ac, using agentcode.js only, no live calls, no keys. Secrets are blocked in every language, never echoed.
- Worked example (same task): ac:1 72 chars (~18 tokens) vs al:1 125 chars (~32 tokens) vs JSON 159 chars (~40 tokens), tokens = chars/4 estimate only.
- Full spec: AGENT-CODE.md. Full first-read instructions: INSTRUCTIONS-FOR-AGENTS.md.

note: v7.3-agentonly | agent-only | landing=agentmode | no-human-home | no-chat-projection | views=32 | core-lines-in-html-no-click-needed | fetch=index.html-gives-all-views-core-lines | local-only | not-deployed | not-pushed | free-only
note: aiws-cli | sh+curl-only | file=aiws | docs=aiws.md | commands=start,agent,examples,search,pack,publish,list,get,delete,health,help | keys=none | publish-public-only | no-code-exec | local-only | not-deployed | not-pushed | free-only
