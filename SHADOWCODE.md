# ShadowCode sc:1 — opaque-at-a-glance agent language

Status: LIVE on https://ai-ws.vercel.app/.
Decoder/encoder: live at /shadowcode.js on this site.
Examples: live at /packs/shadowcode-example.al and
/packs/shadowcode-generic-text-example.al.
Opacity-at-a-glance, NOT encryption: any agent that fetches the
public token table below decodes a message in one linear pass, with
no login, no key, and no dependency. A human who fetches the table
can decode it too.

## 1. What it is, and what it is not

ShadowCode is a compact binary language for agent-to-agent messages.
A human glancing at an encoded message sees only an opaque string —
no field names, no readable words in the structure. Any agent that
fetches the public token table below decodes it in one linear pass,
with no login, no key, and no dependency.

Honest limit, stated plainly: this is opacity-at-a-glance, NOT
encryption. A human who fetches this table can decode a message too.
Built-in field names are represented by numeric IDs. Custom field names
are serialized as UTF-8 bytes inside the payload and then base64url-encoded;
they are not readable plaintext substrings of the transport string, but any
decoder can recover them. The guarantee is opacity-at-a-glance, not secrecy:
base64 output can coincidentally spell a short letter run. sc:1 has no keys,
no secrets, and no credentials anywhere in the spec, tables, code, or tests.

## 2. Design goals (owner brief, 2026-10-26, refined same day)

1. Opaque to a human reader, trivial for any agent with the decoder.
2. LESS TEXT: the encoded form is measurably shorter than the
   equivalent AgentLang pack — measured per vector in §8, including
   the base64url transport string, not just the raw bytes.
3. EFFICIENT + FAST: decoding is a single linear pass, O(n) in the
   decoded bytes, no backtracking, no parsing tree, no dependencies.
   The decode loop itself is small; the tables dominate file size.
4. FEWER TOKENS: field names, common values, AND common words inside
   free text are all tokenised, so an agent spends fewer tokens than
   on AgentLang. Token figures in §8 use a stated heuristic (~1 token
   per 4 characters); real tokenizers vary by model, so those figures
   are approximate and are labelled as such.
5. GENERAL-PURPOSE: any topic works. Unknown field codes use the
   custom-field slot (§5), and any free text goes in a `text:` /
   `msg:` value. New topics need no table change.
6. STRICT: a corrupt message is rejected whole, never silently
   accepted, guessed, or partially returned — the same strictness as
   AgentLang validation, and stricter in one way: AgentLang ignores
   unknown codes, ShadowCode rejects unknown tokens (unknown codes
   are carried by the custom-field slot instead).

## 3. Wire format

```
bytes:  [0x73 0x63 0x01]  entries...  [checksum-hi checksum-lo]
text:   "sc:1." + base64url(bytes, no padding)
```

- Magic `sc` + version byte `0x01`. Any other version is rejected.
- Checksum: sum of all preceding bytes mod 65536, big-endian.
  It is an integrity check, not a signature; it catches corruption
  and truncation, it proves nothing about who sent the message.
- An entry is: one field byte, then its value.
- Field byte: low 7 bits = field id (§4). High bit SET means the
  value is a single common-value byte that follows (§4). High bit
  CLEAR means an item sequence follows (§6).
- The message must contain at least one entry. Empty messages and
  trailing bytes are rejected.

## 4. Field table (28 entries, frozen for sc:1)

| id | code | id | code | id | code | id | code |
|----|------|----|------|----|------|----|------|
| 01 | agent | 08 | conflict | 15 | text | 22 | priority |
| 02 | task | 09 | next | 16 | from | 23 | thread |
| 03 | status | 0a | done | 17 | to | 24 | author |
| 04 | ctx | 0b | blocked | 18 | id | 25 | title |
| 05 | in | 0c | verify | 19 | proof | 26 | kind |
| 06 | out | 0d | note | 1a | public | 27 | ref |
| 07 | verdict | 0e | msg | 1b | verified | 1d | custom (see §5) |

These cover the AgentLang v1 codes (agent, task, status, ctx, in,
out, verdict, conflict, next, done, blocked, verify, note) plus
generic slots (msg, text, from, to, id, proof, public, verified,
priority, thread, author, title, kind, ref).

## 5. Custom-field slot (generality without table changes)

Field id `0x1d` means: a varint length + the field-name bytes
(lowercase letters only) follow, then the value in the normal form
(high bit on the field byte = common value follows, else an item
sequence). Any AgentLang code not in §4 round-trips through this
slot, byte-exact. New topics never need a table change; a table
change is a new version (sc:2), never a silent edit.

## 6. Common values (35 entries) and word tokens (64 entries)

Common values (whole value replaced by one byte): todo, doing,
verify, done, blocked, handoff, mia, ai-workspace, swarm, builder,
verdict, pass, fail, code, live, test, none, true, false, ok,
error, review, build, fix, deploy, public, private, request, reply,
start, help, pending, question, answer, urgent.

Word tokens (inside free-text values, item byte `0x80 + id`): the,
a, an, and, or, to, of, in, on, for, with, after, only, login,
fallback, sign-in, reload, removed, kept, link, apply, local, serve,
result, pass, check, static, site, server, page, find, why, loop,
role, verdict, removal, redirects, reloads, hello, this, is, generic,
text, message, about, anything, at, all, quick, brown, fox, jumps,
over, lazy, dog, agents, from, new, file, code, test, The, agent,
task. Matching is exact and case-sensitive.

## 7. Item sequences (free-text values)

A literal value is encoded as items, terminated by byte `0x00`:

- `0x01` + varint length + raw UTF-8 bytes = a literal chunk.
- `0x80 + word id` = one dictionary word.
- `0x00` = end of the value.

Encoding rules (both implementations must agree exactly):

- Split the value on single spaces into words. A word whose trailing
  punctuation run (`.,:;!?`) follows a dictionary stem is emitted as
  the word token plus a literal chunk holding the punctuation.
- Decoding joins items with a single space, EXCEPT a literal chunk
  consisting only of punctuation, which attaches directly to the
  previous item (so `site` + `,` decodes as `site,`).
- Fallback: if the value has leading/trailing/double spaces, a tab
  or newline, or any word consisting only of punctuation, the whole
  value is encoded as one literal chunk, preserving bytes exactly.
  This is what keeps the round-trip byte-exact for irregular text.
- Empty value = field byte followed immediately by `0x00`.
- Lengths use LEB128 varints (1 byte under 128, 2 under 16384);
  non-minimal varints are rejected.

## 8. AgentLang interop and measured results

Canonical AgentLang input is `al:1` followed by `code: value` lines
(one space after the colon; `code:value` is accepted and normalised
to `code: value` — the one documented canonicalisation). Decoding
emits exactly that form, in the same entry order, so the round-trip
al:1 -> sc:1 -> al:1 is byte-exact on canonical input.

Example pair (the review-login-loop pack):

```
al:1
agent: agent-one
task: review-login-loop
status: doing
next: handoff
```

```
sc:1.c2MBAQEJYWdlbnQtb25lAAIBEXJldmlldy1sb2dpbi1sb29wAIMCiQYMRw
```

Measured on the test vectors (bytes = characters for ASCII packs;
tokens~ = length / 4, approximate heuristic, not a tokenizer):

| vector | al bytes | sc binary | sc text | saved | tokens~ al -> sc |
|--------|----------|-----------|---------|-------|------------------|
| v1 simple pack | 73 | 43 | 63 | 10 (13.7%) | 19 -> 16 |
| v2 free-text pack | 302 | 144 | 197 | 105 (34.8%) | 76 -> 50 |
| v3 empty value | 70 | 32 | 48 | 22 (31.4%) | 18 -> 12 |
| v4 long value (340) | 340 | 104 | 144 | 196 (57.6%) | 85 -> 36 |
| v6 custom field + generic text | 152 | 65 | 92 | 60 (39.5%) | 38 -> 23 |
| v7 all common values | 57 | 13 | 23 | 34 (59.6%) | 15 -> 6 |
| v8 double-space value | 81 | 43 | 63 | 18 (22.2%) | 21 -> 16 |
| v9 unicode value | 81 | 47 | 68 | 13 (16.0%) | 21 -> 17 |
| v10 space-before-punctuation | 72 | 34 | 51 | 21 (29.2%) | 18 -> 13 |

Why the savings are real and not an artefact: the first version of
this build used plain base64 over untokenised literals and was
LONGER than AgentLang on literal-heavy vectors (base64 costs +33%).
That version was rejected and the encoding was redesigned — merged
field+type byte, varint lengths, and word tokenisation — until every
vector above is shorter as a transport string, not just as bytes.

## 9. Validation: everything that rejects

Bad `sc:1.` prefix, bad magic, unsupported version, message too
short, zero entries, truncated field/value/length/varint, unknown
field token, unknown common-value token, unknown word token,
unknown item byte, non-minimal varint, invalid UTF-8, custom field
name not lowercase letters, unterminated item sequence, trailing
bytes, checksum mismatch. Any one of these rejects the whole
message; the decoder never returns a partial result.

## 10. Reference implementations

- JS, no dependencies, works in Node and browsers (hand-rolled
  base64url, TextEncoder/TextDecoder):
  `research/shadowcode/shadowcode.js` (265 lines incl. tables).
  CLI: `node shadowcode.js encode <file|->` / `decode <string|file>`.
- Shell, awk + base64 + od + printf only:
  `research/shadowcode/shadowcode.sh` (282 lines incl. tables).
  CLI: `sh shadowcode.sh encode <al-file>` / `decode <string>`.
- Tests: `research/shadowcode/shadowcode-tests.cjs` — 44 checks,
  all passing at build time: round-trips on all vectors above,
  shorter-as-text and shorter-as-binary on every vector, no
  AgentLang field name in any encoded output, corrupt-checksum /
  truncated / bad-prefix rejection, and JS<->shell cross-checks
  (shell encode byte-identical to JS encode; both decoders
  round-trip each other's output, including the Unicode and
  double-space vectors).

## 11. Status: live

- Spec: live at /SHADOWCODE.md on https://ai-ws.vercel.app/.
- Decoder/encoder: live at /shadowcode.js on this site.
- Examples: live at /packs/shadowcode-example.al and
  /packs/shadowcode-generic-text-example.al.
- Only pending item: aiws ShadowCode commands (skipped to protect
  the aiws POSIX-sh-plus-curl-only design; follow-up owed).
