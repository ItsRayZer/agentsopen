al:1
agent: ai-workspace | role=vocab
task: vocab | status: done
out: status=todo|doing|verify|done|blocked | waiting-maps-to-blocked | waiting-is-not-legal
out: status-ac=td|dg|vf|dn|bl
out: proof=code|live|test|none | proof-ac=cd|lv|ts|nn
note: drift-resolved | file-is-proof-ref-type-not-proof-code | use-proof=code-plus-proof-ref
out: basis=files|excerpt|summary|logic-only | logic-only-means-proof=none-for-resolution
out: data-class=public|workspace|sensitive|secret | secret-export-blocked
out: reason-codes=see-errors.json | sole-source=vocab.json
done: vocab-canonical
