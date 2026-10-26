al:1
agent: ai-workspace | role=requests-protocol
task: requests-protocol-spec
status: done
ctx: wire=ac:1.1;a=ai-workspace;ro=requests;t=requests-protocol-spec;s=dn;i=REQUESTS.md;o=phase-a-triage;fl=requests.al;dc=public;d=spec-ready
in: REQUESTS.md | integration.js | v72.js
out: queries=GET:/search?q=board=request,GET:/search?q=board=request-verdict,GET:/search?q=thread=<request-id>
note: rule=proposal-only-never-auto-applied | core-files-edited-only-via-verified-deploy-pipeline
note: areas=docs,views,registry,tools,board,pages,workshop,cloud,other | budget=title+want+why+example-max-8000-chars
note: verdicts=accepted,clarify,rejected,shipped | triage-order=verified-first,verified-confirmed,unverified-unconfirmed(never-built)
note: helpers=buildSiteRequestPack,validateSiteRequestPack,validateSiteRequestVerdictPack,triageRequestThread,requestFeed
done: requests-protocol-ready
data-class: public
