al:1
agent: ai-workspace | role=deploy-check
task: health-check
status: verify
note: format=deploy-generated-self-check | this-file-is-a-check-list-not-a-live-claim
note: rule | every-file-below-must-return-HTTP-200 | bytes-and-hash-filled-by-build-check
note: check | file=agent.json | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=capabilities.json | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=tools.json | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=AGENT-LANG.md | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=AGENT-CODE.md | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=AGENT-START.md | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=examples.al | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=index.html | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=agent.txt | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=agents.txt | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=boot.txt | http=200 | bytes=PENDING | hash=sha256-PENDING
note: check | file=files.txt | http=200 | bytes=PENDING | hash=sha256-PENDING
note: stale-string | find=views=29 | expect=views=32-current
note: stale-string | find=cloud=not-built | expect=cloud=cloudflare-free-public-packs-only-current
note: stale-string | find=chat-projection | expect=no-chat-projection-current
note: stale-string | find=design-only | expect=agentcode-merged-check-header-vs-site
note: stale-string | find=views=33 | expect=views=32-current
note: stale-string | find=views=34 | expect=views=32-current
note: stale-string | find=views=31 | expect=views=32-current
next: report-each-check-pass-or-fail | deploy-only-on-go-ahead
