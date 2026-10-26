al:1
agent: ai-workspace | role=boot
task: onboard
status: todo
in: agent.json | capabilities.json | tools.json | AGENT-LANG.md | HANDOFF.md | examples.al
out: views=32 | lang=al:1 | keys=none | exec=sandboxed-js-only | landing=agentmode | per-view-txt=views/<id>.txt | browser-alias=?view=<id>
verify: check=node-check | result=not-run-yet
verify: check=id-check | result=not-run-yet
verify: check=serve-200 | result=not-run-yet
verify: check=secrets-scan | result=not-run-yet
note: read-first | files=AGENT-LANG.md,HANDOFF.md,tools.json
note: add-tool | registry-only=tools.json-only | no-browser-add-tool-ui | no-home-view
note: never | secrets=none | money=none | delete-owner-data=none | deploy-or-push=go-ahead-only | exec=sandboxed-js-only | fake-result=none
note: claim | queue-view | advisory-local-only | not-server-atomic | worker-atomic-prototype-only
note: update-anytime | agent=owner | action=go-ahead | required=true
note: report | format=al:1 | end=next-or-done-or-blocked
note: version-truth | source=agent.json | views=32 | tools=33 | capabilities=57 | no-hand-copied-counts-elsewhere
note: which-language-when | view=language | rule=start-al:1 | convert=json-when-tool-needs-exact-data | execution=sandboxed-js-only-workshop | code=read-compare-only-studio | never=invent-field-or-fake-proof-or-secret-in-any-language
note: free-forever-by-design | vendor-promise=none | site-cost=0-static-only | local-first=works-without-cloud | cloud=optional | self-hostable=any-free-static-host | exports=text-json
note: agentcode | view=agentcode | spec=AGENT-CODE.md | converter=agentcode.js | rule=public-codebook-not-secret | undecodable=do-not-trust | use=high-volume-agent-traffic | handoff=al:1 | exact-data=json
note: worked-example | ac=72-chars | al=125-chars | json=159-chars | chars-saved-ac-vs-json=87 | codebook-chars=6966 | break-even-vs-json=81-messages | tokens=not-measured
note: agent-only | landing=agentmode | no-human-home | no-chat-projection | core-lines-in-html-no-click-needed | per-view-txt=views/<id>.txt | browser-alias=?view=<id> | raw-mode=?raw=1
note: aiws-cli | sh+curl-only | file=aiws | docs=aiws.md | commands=start,agent,examples,search,pack,publish,list,get,delete,health,help | keys=none | publish-public-only | no-code-exec
note: cloud | worker=cloudflare-free-public-packs-only | packs=public-only | delete=server-token-in-prototype-only | list-lag=40s-kv | direct-get-is-confirmation
note: advisory-controls | observer | install-vs-grant | data-class | approval-inbox | status=advisory-local-check-only | not-security-guarantee | server-enforcement=worker-prototype-only
next: pick-one-small-change | verify | show-change
