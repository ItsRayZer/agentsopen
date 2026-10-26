// AgentCode — converter for AI Workspace. Node-compatible, no dependencies.
// UMD: module.exports + globalThis.AgentCode.
// AgentCode is a CODE language for agents only: dense records, no prose.
// It is NOT encrypted and NOT secret: AGENT-CODE.md is the public codebook,
// and this converter lets any agent — and the owner — decode it on demand.
//
// VERSION DECISION (plain): ac:1 is FROZEN. It keeps its original codebook,
// its original single-value fields, and its compact end-state exception in
// the parser (a terminal-less ac:1 record with status done/blocked still
// parses). No new field may be added to ac:1. ac:1.1 is the current
// version: it adds indexed repeated fields (ordered arrays), optional id,
// ts, seq, file, data-class and record proof-ref, per-verdict basis and
// proof-ref, one escaping rule, and a terminal field that is ALWAYS
// required (the compact end-state exception is removed in ac:1.1).
// Future breaking changes ship as ac:2, never as a silent 1.1 patch.
// Converters never silently drop a field: anything that cannot be
// represented in the target is blocked with a named reason (field-loss or
// version-not-supported), and an ac:1.1 record sent to an ac:1-only
// converter is blocked version-not-supported, never degraded.
//
// PHASE ORDER: Phase A froze ac:1 and fixed the converter defects
// (repeated fields, malformed verdicts, discarded warnings). Phase B ships
// ac:1.1 on top of those fixes. See agentlang-tests.js, which runs Phase A
// assertions before Phase B assertions.
//
// COMPACT AL: the compact single-line al form ("al:1 agent=.. | ..") is
// REMOVED as a valid form for new records. acToAl never emits it, and
// alToAc blocks it with reason=compact-legacy-only. Already-published
// Cloud packs in that form are expanded ONLY by the separate legacy
// decoder AgentLang.legacyExpandCompact (in agentlang.js), which emits
// canonical multi-line al:1 plus a warning. If a compact form is ever
// wanted again it must use a NEW header, not al:1.
// A compact FIRST line followed by more lines is rejected as
// mixed-compact-multiline. ac:1 itself is single-line by design and
// already meets the single-line Cloud need.
//
// FIELD CODES (ac:1, frozen): a agent | ro role | t task | s status |
//   x ctx | i in | o out | v verdict | f conflict | n next | d done |
//   b blocked | y verify | nt note.
// NEW CODES (ac:1.1 only): id | ts timestamp | sq sequence number |
//   fl file | dc data-class | pr record proof-ref.
//   Field code ts= is a timestamp. Proof code ts inside a v field is
//   "test". Position disambiguates: ts= at field level is the timestamp,
//   the third colon segment of v= is the proof code.
// Per-verdict basis/proof-ref live inside the v field, positional:
//   v=model:claim:proof-code[:basis[:proof-ref]]
//   A proof-ref therefore requires a basis in the same v field (set basis
//   to the evidence kind when no finer basis applies). A proof-ref or
//   claim containing ":" or ";" is written escaped in ac:1.1 (see below)
//   and blocks with field-loss when the target is ac:1.
//
// REPEATED FIELDS: v, f, y, nt are repeatable in ac:1.1 and are returned
// by parseAc as ORDERED ARRAYS (array index is the field index; order is
// never re-sorted). In ac:1 they are singletons: a repeated v/f/y/nt in
// an ac:1 record blocks with version-not-supported. Every other code is
// a singleton in both versions: a duplicate blocks duplicate-field.
// parseAc returns repeatable fields as arrays in BOTH versions (ac:1
// arrays hold at most one element). This is a deliberate change from the
// old single rec.v string, which silently kept only the last verdict.
//
// EFFECTIVE PROOF (enforced by code, not prose): a verdict's effective
// proof is "none" when its proof is "none" OR its basis is "logic-only",
// otherwise it is its proof value. basis never rewrites the stored proof
// code; consumers must use effectiveProof(). A verdict with effective
// proof "none" and no proof-ref is unproven and can never resolve a
// conflict (see agentlang.js, which computes canResolve/conflictResolved).
//
// ESCAPING (ac:1.1 only, ONE rule): a backslash must be followed by one
// of ; \ n : and yields ;, backslash, newline, or : respectively. A
// backslash before any other character, or a trailing backslash, blocks
// with bad-escape. ac:1 has no escaping: a backslash there is literal,
// and a value containing ";" or a newline, or a ":" inside a colon-split
// field, blocks with field-loss when the target is ac:1.
// Wire order in emitted ac: metadata fields (id/ts/sq/fl/dc/pr) come
// BEFORE the terminal field (n/d/b), which is always last.
//
// ENVELOPE ALTERNATIVE: al:1 and JSON may carry id/ts/proof-ref (and the
// other trailing metadata) REFERRING to an ac:1 record without stuffing
// those fields into the ac:1 string. Use alToAcEnvelope /
// jsonToAcEnvelope, which return { ac, envelope }: the ac string stays
// pure ac:1 and the metadata travels alongside it, never dropped.
// acToAl / acToJson accept the same envelope object as a second argument
// and re-attach it. Bare alToAc / jsonToAc to ac:1 block on metadata
// fields with version-not-supported instead of dropping them.
//
// SECRETS (hygiene check only): the pattern list below is a hygiene
// check for credential-shaped strings in public packs. It is NOT a
// guarantee that a pack contains no secrets, and it is NOT a content
// scanner. Hard patterns block with reason=secret-pattern and carry
// pattern class (rule) + field + line, NEVER the matched value. A bare
// email address is WARNING tier only, never a block: it is recorded in
// warnings (field name only) and conversion proceeds. The generic
// high-entropy token pattern was DROPPED from the block list because it
// produced false positives on ordinary text; that removal is deliberate.
// SINGLE SECRET SOURCE: this list is embedded identically in agentcode.js
// and agentlang.js (no third runtime dependency, so both files stay
// standalone). agentlang-tests.js asserts the two embedded lists are
// deep-equal on every run; that equality check is the build check. The
// canonical pattern set is listed in the fix-build report so a shell
// mirror (aiws) can be checked against the same list.
// Server-side re-validation of public packs is a separate step (Worker
// prototype); this module does not claim to perform it.
//
// MEASUREMENT POLICY: this file publishes no token counts. Tokens are
// unmeasured until a defined corpus is measured on a named tokenizer.
// Any length comparison here uses chars only. The measured ac:1.1 saving
// and break-even figures live in agentlang.js (snapshot) and in
// agentlang-tests.js (recomputed on every run), not in this file, so this
// file's own byte count stays stable for the break-even numerator.
(function (global) {
  "use strict";

  var STATUS_TO_CODE = { todo: "td", doing: "dg", verify: "vf", done: "dn", blocked: "bl" };
  var CODE_TO_STATUS = { td: "todo", dg: "doing", vf: "verify", dn: "done", bl: "blocked" };
  var PROOF_TO_CODE = { code: "cd", live: "lv", test: "ts", none: "nn" };
  var CODE_TO_PROOF = { cd: "code", lv: "live", ts: "test", nn: "none" };
  var LEGAL_PROOF = ["code", "live", "test", "none"];

  var KNOWN_CODES_1 = ["a", "ro", "t", "s", "x", "i", "o", "v", "f", "n", "d", "b", "y", "nt"];
  var KNOWN_CODES_11_ONLY = ["id", "ts", "sq", "fl", "dc", "pr"];
  var KNOWN_CODES_11 = KNOWN_CODES_1.concat(KNOWN_CODES_11_ONLY);
  var REPEATABLE = ["v", "f", "y", "nt"];
  var TERMINALS = ["n", "d", "b"];
  // ac wire order before the terminal field (terminal is always last).
  var WIRE_ORDER = ["a", "ro", "t", "s", "x", "i", "o", "v", "f", "y", "nt", "id", "ts", "sq", "fl", "dc", "pr"];
  var ENVELOPE_KEYS = ["id", "ts", "seq", "file", "data-class", "proof-ref"];

  // Secret patterns: { rule: pattern class, tier: "block"|"warning", re }.
  // Identical list in agentlang.js; the test suite asserts deep equality.
  // NOTE: no generic high-entropy pattern is in this list (dropped: it
  // blocked ordinary text). Bare email is warning tier, never a block.
  var SECRET_PATTERNS = [
    { rule: "private-key", tier: "block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { rule: "openai-key", tier: "block", re: /\bsk-[A-Za-z0-9]{12,}/ },
    { rule: "stripe-key", tier: "block", re: /\bsk_(live|test)_[A-Za-z0-9]{8,}/ },
    { rule: "github-token", tier: "block", re: /\bgh[pous]_[A-Za-z0-9]{20,}/ },
    { rule: "aws-access-key-id", tier: "block", re: /\bAKIA[0-9A-Z]{16}/ },
    { rule: "slack-token", tier: "block", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
    { rule: "jwt", tier: "block", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
    { rule: "api-key-assignment", tier: "block", re: /\bapi[_-]?key\s*[:=]\s*\S+/i },
    { rule: "access-token-assignment", tier: "block", re: /\b(access[_-]?token|client[_-]?secret)\s*[:=]\s*\S+/i },
    { rule: "password-assignment", tier: "block", re: /\bpassword\s*[:=]\s*\S+/i },
    { rule: "bearer-token", tier: "block", re: /\bBearer\s+[A-Za-z0-9._-]{12,}/ },
    { rule: "email-address", tier: "warning", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  ];

  function getSecretPatterns() {
    return SECRET_PATTERNS.map(function (p) {
      return { rule: p.rule, tier: p.tier, source: p.re.source };
    });
  }

  function blocked(reason, need, extra) {
    var e = new Error("blocked: reason=" + reason + " | need=" + need);
    e.reason = reason; e.need = need; e.blocked = true;
    if (extra) {
      if (extra.field !== undefined) e.field = extra.field;
      if (extra.line !== undefined) e.line = extra.line;
      if (extra.rule !== undefined) e.rule = extra.rule;
    }
    return e;
  }

  // Scan one value. Returns { rule, tier, field, line } for the first hard
  // match, else the email warning, else null. Never returns the value.
  function scanValue(value, field, line) {
    var warn = null;
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      var p = SECRET_PATTERNS[i];
      if (p.re.test(value)) {
        if (p.tier === "block") return { rule: p.rule, tier: "block", field: field, line: line };
        if (!warn) warn = { rule: p.rule, tier: "warning", field: field, line: line };
      }
    }
    return warn;
  }
  function throwIfSecret(value, field, line) {
    var hit = scanValue(value, field, line);
    if (hit && hit.tier === "block") {
      throw blocked("secret-pattern", "public-pack-only",
        { field: hit.field, line: hit.line, rule: hit.rule });
    }
    return hit; // warning or null; caller records warnings
  }
  // Raw-text scan (no field context): field is "text", line is counted.
  // Used by findSecret and by the al secret pre-scan.
  function findSecret(text) {
    var lines = String(text).split("\n");
    for (var li = 0; li < lines.length; li++) {
      var hit = scanValue(lines[li], "text", li + 1);
      if (hit && hit.tier === "block") return hit;
    }
    return null;
  }

  function statusCode(full) {
    return STATUS_TO_CODE[String(full || "").trim()] || null;
  }
  function proofCode(full) {
    return PROOF_TO_CODE[String(full || "").trim()] || null;
  }
  function effectiveProof(v) {
    if (!v) return null;
    if (v.proof === "none" || v.basis === "logic-only") return "none";
    return v.proof;
  }

  // ---- ac escaping (ac:1.1 only) ------------------------------------------
  // One rule: backslash + one of ; \ n : yields ;, backslash, newline, :.
  function splitAcFields(line) {
    var out = [], cur = "";
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === "\\" && i + 1 < line.length) { cur += c + line[i + 1]; i++; }
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function unescapeAc(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === "\\") {
        var nx = str[i + 1];
        if (nx === ";") { out += ";"; i++; }
        else if (nx === "\\") { out += "\\"; i++; }
        else if (nx === "n") { out += "\n"; i++; }
        else if (nx === ":") { out += ":"; i++; }
        else throw blocked("bad-escape", "backslash-only-before-;\\n:");
      } else out += c;
    }
    return out;
  }
  function splitColonEscaped(str) {
    var out = [], cur = "";
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === "\\" && i + 1 < str.length) { cur += c + str[i + 1]; i++; }
      else if (c === ":") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function escapeAcPlain(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  }
  function escapeAcSegment(str) {
    return escapeAcPlain(str).replace(/:/g, "\\:");
  }

  // ---- al escaping (for al output from this converter) --------------------
  // Pair values escape backslash, |, :, =, newline. Plain values escape
  // backslash, |, newline. Parsing unescapes all five anywhere.
  function escapeAlPair(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/\|/g, "\\|")
      .replace(/:/g, "\\:").replace(/=/g, "\\=").replace(/\n/g, "\\n");
  }
  function escapeAlPlain(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, "\\n");
  }
  function unescapeAl(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c === "\\") {
        var nx = str[i + 1];
        if (nx === "|" || nx === ":" || nx === "=" || nx === "\\") { out += nx; i++; }
        else if (nx === "n") { out += "\n"; i++; }
        else throw blocked("bad-escape", "backslash-only-before-|:=\\n");
      } else out += c;
    }
    return out;
  }
  // Split an al pair string on unescaped " | ". Returns raw pair strings.
  function splitAlPairs(s) {
    var out = [], cur = "";
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === "\\" && i + 1 < s.length) { cur += c + s[i + 1]; i++; }
      else if (c === "|" && s[i - 1] === " " && s[i + 1] === " ") {
        cur = cur.slice(0, -1); out.push(cur); cur = ""; i++;
      }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  // Parse "k=v | k=v" (escape-aware). Returns {k: v} with unescaped keys
  // and values. A segment without an unescaped "=" blocks field-not-pair.
  function parseAlPairs(s, lineNo) {
    var out = {};
    var segs = splitAlPairs(s);
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i].trim();
      if (!seg) continue;
      var eq = -1;
      for (var j = 0; j < seg.length; j++) {
        if (seg[j] === "\\" && j + 1 < seg.length) { j++; continue; }
        if (seg[j] === "=") { eq = j; break; }
      }
      if (eq <= 0) throw blocked("field-not-pair", "key=value-pairs",
        { field: "pair", line: lineNo });
      var k = unescapeAl(seg.slice(0, eq).trim());
      var v = unescapeAl(seg.slice(eq + 1).trim());
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        throw blocked("duplicate-field", k, { field: k, line: lineNo });
      }
      out[k] = v;
    }
    return out;
  }

  // ---- structured field values -------------------------------------------
  function parseVerdictValue(raw, version) {
    var segs = version === "ac:1.1"
      ? splitColonEscaped(raw).map(unescapeAc)
      : raw.split(":");
    if (version === "ac:1") {
      if (segs.length !== 3) throw blocked("verdict-malformed", "v=model:claim:proof-code");
    } else if (segs.length < 3 || segs.length > 5) {
      throw blocked("verdict-malformed", "v=model:claim:proof-code[:basis[:proof-ref]]");
    }
    var model = segs[0].trim(), claim = segs[1].trim(), proof = segs[2].trim();
    if (!model || !claim) throw blocked("verdict-malformed", "v=model:claim:proof-code");
    if (CODE_TO_PROOF[proof] === undefined) throw blocked("verdict-malformed", "v=model:claim:proof-code");
    var out = { model: model, claim: claim, proof: CODE_TO_PROOF[proof] };
    if (segs.length >= 4) {
      var basis = segs[3].trim();
      if (!basis) throw blocked("verdict-malformed", "v=model:claim:proof-code[:basis[:proof-ref]]");
      out.basis = basis;
    }
    if (segs.length >= 5) {
      var pref = segs[4].trim();
      if (!pref) throw blocked("verdict-malformed", "v=model:claim:proof-code[:basis[:proof-ref]]");
      out["proof-ref"] = pref;
    }
    out.effectiveProof = effectiveProof(out);
    return out;
  }
  function parseConflictValue(raw, version) {
    var segs = version === "ac:1.1"
      ? splitColonEscaped(raw).map(unescapeAc)
      : raw.split(":");
    if (segs.length !== 3) throw blocked("conflict-malformed", "f=a:b:resolve");
    var a = segs[0].trim(), b = segs[1].trim(), r = segs[2].trim();
    if (!a || !b || !r) throw blocked("conflict-malformed", "f=a:b:resolve");
    return { a: a, b: b, resolve: r };
  }
  function parseVerifyValue(raw, version) {
    var segs = version === "ac:1.1"
      ? splitColonEscaped(raw).map(unescapeAc)
      : raw.split(":");
    if (segs.length !== 2) throw blocked("verify-malformed", "y=check:pass|fail");
    var check = segs[0].trim(), result = segs[1].trim();
    if (!check) throw blocked("verify-malformed", "y=check:pass|fail");
    if (result !== "pass" && result !== "fail") throw blocked("verify-malformed", "y=check:pass|fail");
    return { check: check, result: result };
  }
  function parseBlockedValue(raw, version) {
    var segs = version === "ac:1.1"
      ? splitColonEscaped(raw).map(unescapeAc)
      : raw.split(":");
    if (segs.length !== 2) throw blocked("blocked-malformed", "b=reason:need");
    var reason = segs[0].trim(), need = segs[1].trim();
    if (!reason || !need) throw blocked("blocked-malformed", "b=reason:need");
    return { reason: reason, need: need };
  }
  // Validate a structured value eagerly so no converter can emit a field
  // with an undefined part. Called from parseAc for v/f/y/b fields.
  function validateStructured(code, raw, version) {
    if (code === "v") return parseVerdictValue(raw, version);
    if (code === "f") return parseConflictValue(raw, version);
    if (code === "y") return parseVerifyValue(raw, version);
    if (code === "b") return parseBlockedValue(raw, version);
    return null;
  }

  // ---- ac parsing ----------------------------------------------------------
  function parseAc(text, opts) {
    opts = opts || {};
    if (typeof text !== "string" || !text.trim()) throw blocked("not-ac", "ac:1-first-token");
    var line = text.trim();
    // ac is single-line by design; a newline means this is not one record.
    if (line.indexOf("\n") >= 0) throw blocked("not-ac", "ac-single-line-record");
    var firstSemi = line.indexOf(";");
    var token = firstSemi < 0 ? line : line.slice(0, firstSemi).trim();
    if (token !== "ac:1" && token !== "ac:1.1") {
      if (token.indexOf("ac:") === 0) throw blocked("version-not-supported", "ac:1-or-ac:1.1");
      throw blocked("not-ac", "ac:1-first-token");
    }
    var version = token;
    if (opts.cap === "ac:1" && version === "ac:1.1") {
      throw blocked("version-not-supported", "ac:1-converter");
    }
    var rawParts = version === "ac:1.1" ? splitAcFields(line) : line.split(";");
    var rec = { version: version, warnings: [] };
    var order = [];
    var seen = {};
    for (var i = 1; i < rawParts.length; i++) {
      var p = rawParts[i].trim();
      if (!p) continue;
      var eq = p.indexOf("=");
      if (eq <= 0) throw blocked("field-not-code-equals", "code=value-fields");
      var code = p.slice(0, eq).trim();
      var rawValue = p.slice(eq + 1).trim();
      if (!rawValue) throw blocked("field-empty", "non-empty-value");
      if (KNOWN_CODES_1.indexOf(code) < 0 && KNOWN_CODES_11_ONLY.indexOf(code) < 0) {
        // Unknown code: hygiene-scan the raw value, then warn (converters
        // block on unknown codes; the warning is never silently dropped).
        var uhit = throwIfSecret(rawValue, code, 1);
        if (uhit) rec.warnings.push("email-warning:" + code);
        rec.warnings.push("unknown-code-ignored:" + code);
        continue;
      }
      if (version === "ac:1" && KNOWN_CODES_11_ONLY.indexOf(code) >= 0) {
        throw blocked("version-not-supported", "ac:1.1", { field: code, line: 1 });
      }
      var isStructured = code === "v" || code === "f" || code === "y" || code === "b";
      var value;
      if (isStructured) {
        // Structured fields are validated eagerly (both versions, so no
        // converter can emit a field with an undefined part) and stored
        // in raw wire form; converters re-split them once, which is
        // where ac:1.1 unescaping happens. Scanning the parsed segments
        // means escaping cannot hide a credential-shaped string.
        var parsed = validateStructured(code, rawValue, version);
        var segValues = [];
        if (code === "v") {
          segValues = [parsed.model, parsed.claim, parsed.proof];
          if (parsed.basis) segValues.push(parsed.basis);
          if (parsed["proof-ref"]) segValues.push(parsed["proof-ref"]);
        } else if (code === "f") segValues = [parsed.a, parsed.b, parsed.resolve];
        else if (code === "y") segValues = [parsed.check, parsed.result];
        else segValues = [parsed.reason, parsed.need];
        for (var si = 0; si < segValues.length; si++) {
          var shit = throwIfSecret(segValues[si], code, 1);
          if (shit) rec.warnings.push("email-warning:" + code);
        }
        value = rawValue;
      } else {
        value = version === "ac:1.1" ? unescapeAc(rawValue) : rawValue;
        var hit = throwIfSecret(value, code, 1);
        if (hit) rec.warnings.push("email-warning:" + code);
      }
      if (REPEATABLE.indexOf(code) >= 0) {
        if (version === "ac:1") {
          // ac:1 allows exactly one v/f/y/nt. A second one is a repeat,
          // which is an ac:1.1 feature: block, never overwrite.
          if (seen[code]) {
            throw blocked("version-not-supported", "ac:1.1", { field: code, line: 1 });
          }
          seen[code] = true;
          rec[code] = value;
          order.push(code);
          continue;
        }
        // ac:1.1 repeats are ordered arrays; a repeat here appends a
        // new element, never an overwrite.
        if (!rec[code]) rec[code] = [];
        rec[code].push(value);
        order.push(code);
        continue;
      }
      if (seen[code]) throw blocked("duplicate-field", code, { field: code, line: 1 });
      seen[code] = true;
      rec[code] = value;
      order.push(code);
    }
    // seq must be a non-negative integer when present (ac:1.1 only; the
    // code is unknown to ac:1 and already blocked above).
    if (rec.sq !== undefined && !/^\d+$/.test(rec.sq)) {
      throw blocked("seq-malformed", "sq=non-negative-integer", { field: "sq", line: 1 });
    }
    if (!rec.a) throw blocked("missing-agent", "a=agent-id");
    if (!rec.t) throw blocked("missing-task", "t=task-id");
    if (!rec.s) throw blocked("missing-status", "s=td|dg|vf|dn|bl");
    if (!CODE_TO_STATUS[rec.s]) throw blocked("status-not-legal", "s=td|dg|vf|dn|bl");
    var terminalCount = 0, terminal = null;
    for (var ti = 0; ti < TERMINALS.length; ti++) {
      if (rec[TERMINALS[ti]] !== undefined) { terminalCount++; terminal = TERMINALS[ti]; }
    }
    if (terminalCount > 1) throw blocked("terminal-multiple", "one-of-n|d|b");
    var last = order[order.length - 1];
    var hasTerminal = terminalCount === 1;
    if (hasTerminal) {
      if (last !== terminal) throw blocked("terminal-missing", "last-field-n|d|b");
      if (terminal === "d" && rec.s !== "dn") throw blocked("terminal-status-mismatch", "d-requires-s=dn");
      if (terminal === "b" && rec.s !== "bl") throw blocked("terminal-status-mismatch", "b-requires-s=bl");
      if (terminal === "n" && (rec.s === "dn" || rec.s === "bl")) throw blocked("terminal-status-mismatch", "n-requires-s=td|dg|vf");
    } else if (version === "ac:1.1") {
      // ac:1.1: terminal ALWAYS required. No compact end-state exception.
      throw blocked("terminal-missing", "last-field-n|d|b");
    } else if (rec.s === "dn" || rec.s === "bl") {
      // Frozen ac:1 compact end-state: parses, but converters block when
      // it carries content fields (see assertConvertibleCompact).
      rec._compact = true;
    } else {
      throw blocked("terminal-missing", "last-field-n|d|b");
    }
    rec._order = order;
    rec._terminal = hasTerminal ? terminal : null;
    return rec;
  }
  function parseAc1(text) {
    return parseAc(text, { cap: "ac:1" });
  }
  function validateAc(text) {
    try { parseAc(text); return null; }
    catch (e) { return e.reason || "invalid"; }
  }

  // Normalise a parsed record to arrays for repeatables, strings else.
  function repeatList(rec, code) {
    if (rec.version === "ac:1.1") return rec[code] || [];
    if (rec[code] === undefined) return [];
    return [rec[code]];
  }
  function unknownWarnings(rec) {
    return rec.warnings.filter(function (w) {
      return w.indexOf("unknown-code-ignored:") === 0;
    });
  }
  function assertNoUnknown(rec) {
    var uw = unknownWarnings(rec);
    if (uw.length) {
      throw blocked("unknown-code", uw[0].slice("unknown-code-ignored:".length));
    }
  }
  // Frozen ac:1 compact rule: a terminal-less ac:1 record may convert
  // only when it is bare (a/ro/t/s). Content fields (x/i/o/v/f/y/nt)
  // without a terminal field block with field-loss instead of being
  // silently truncated, as the old compact-al emitter truncated them.
  function assertConvertibleCompact(rec) {
    if (rec.version !== "ac:1" || rec._terminal) return;
    var content = ["x", "i", "o", "v", "f", "y", "nt"];
    for (var i = 0; i < content.length; i++) {
      var c = content[i];
      var present = c === "v" || c === "f" || c === "y" || c === "nt"
        ? repeatList(rec, c).length > 0
        : rec[c] !== undefined;
      if (present) throw blocked("field-loss", c, { field: c, line: 1 });
    }
  }
  function emailWarnings(rec) {
    return rec.warnings.filter(function (w) {
      return w.indexOf("email-warning:") === 0;
    });
  }

  // Envelope handling: metadata keys carried alongside a bare ac string.
  function checkEnvelope(env) {
    if (!env) return null;
    if (typeof env !== "object" || Array.isArray(env)) {
      throw blocked("envelope-not-object", "envelope-id-ts-seq-file-data-class-proof-ref");
    }
    var out = {};
    for (var i = 0; i < ENVELOPE_KEYS.length; i++) {
      var k = ENVELOPE_KEYS[i];
      if (env[k] === undefined || env[k] === null) continue;
      if (k === "seq") {
        if (!Number.isInteger(env[k]) || env[k] < 0) {
          throw blocked("seq-malformed", "seq=non-negative-integer");
        }
        out[k] = env[k];
      } else {
        if (typeof env[k] !== "string" || !env[k].trim()) {
          throw blocked("field-empty", "non-empty-envelope-value");
        }
        out[k] = env[k];
      }
    }
    for (var key in env) {
      if (Object.prototype.hasOwnProperty.call(env, key) && ENVELOPE_KEYS.indexOf(key) < 0) {
        throw blocked("unknown-field", key, { field: key, line: 1 });
      }
    }
    return out;
  }
  function envelopeToAcMap(env) {
    // envelope key -> ac code (record-level metadata only).
    var map = { "id": "id", "ts": "ts", "seq": "sq", "file": "fl", "data-class": "dc", "proof-ref": "pr" };
    var out = {};
    if (!env) return out;
    for (var k in map) {
      if (env[k] !== undefined) out[map[k]] = k === "seq" ? String(env[k]) : env[k];
    }
    return out;
  }
  function mergeEnvelopeLines(lines, rec, env) {
    // Append trailing al metadata lines from an envelope, blocking on a
    // clash with a value already in the record.
    var acMap = { "id": "id", "ts": "ts", "seq": "sq", "file": "fl", "data-class": "dc", "proof-ref": "pr" };
    if (!env) return;
    var order = ["id", "ts", "seq", "file", "data-class", "proof-ref"];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (env[k] === undefined) continue;
      var code = acMap[k];
      var existing = rec[code];
      if (existing !== undefined && String(existing) !== String(env[k])) {
        throw blocked("duplicate-field", k, { field: k, line: 1 });
      }
      if (existing === undefined) {
        lines.push(k + ": " + (k === "seq" ? String(env[k]) : escapeAlPlain(String(env[k]))));
      }
    }
  }

  // ---- ac -> al ------------------------------------------------------------
  // Always multi-line al:1. The compact single-line form is removed for
  // new records (see header); the old compact emitter, which silently
  // dropped every field except agent/task/status, is gone.
  function acToAl(text, envelope) {
    return acToAlDetailed(text, envelope).al;
  }
  function acToAlDetailed(text, envelope) {
    var r = parseAc(text);
    assertNoUnknown(r);
    assertConvertibleCompact(r);
    var env = checkEnvelope(envelope);
    var lines = ["al:1"];
    lines.push("agent: " + escapeAlPlain(r.a) + (r.ro ? " | role=" + escapeAlPair(r.ro) : ""));
    lines.push("task: " + escapeAlPlain(r.t));
    lines.push("status: " + CODE_TO_STATUS[r.s]);
    if (r.x) lines.push("ctx: " + escapeAlPlain(r.x));
    if (r.i) lines.push("in: " + escapeAlPlain(r.i));
    if (r.o) lines.push("out: " + escapeAlPlain(r.o));
    var vs = repeatList(r, "v");
    for (var vi = 0; vi < vs.length; vi++) {
      var vp = parseVerdictValue(vs[vi], r.version);
      var vline = "verdict: model=" + escapeAlPair(vp.model) + " | claim=" + escapeAlPair(vp.claim) +
        " | proof=" + vp.proof;
      if (vp.basis) vline += " | basis=" + escapeAlPair(vp.basis);
      if (vp["proof-ref"]) vline += " | proof-ref=" + escapeAlPair(vp["proof-ref"]);
      lines.push(vline);
    }
    var fs = repeatList(r, "f");
    for (var fi = 0; fi < fs.length; fi++) {
      var fp = parseConflictValue(fs[fi], r.version);
      lines.push("conflict: a=" + escapeAlPair(fp.a) + " | b=" + escapeAlPair(fp.b) +
        " | resolve=" + escapeAlPair(fp.resolve));
    }
    var ys = repeatList(r, "y");
    for (var yi = 0; yi < ys.length; yi++) {
      var yp = parseVerifyValue(ys[yi], r.version);
      lines.push("verify: check=" + escapeAlPair(yp.check) + " | result=" + yp.result);
    }
    var nts = repeatList(r, "nt");
    for (var ni = 0; ni < nts.length; ni++) lines.push("note: " + escapeAlPlain(nts[ni]));
    if (r.n) lines.push("next: " + escapeAlPlain(r.n));
    if (r.d) lines.push("done: " + escapeAlPlain(r.d));
    if (r.b) {
      var bp = parseBlockedValue(r.b, r.version);
      lines.push("blocked: reason=" + escapeAlPair(bp.reason) + " | need=" + escapeAlPair(bp.need));
    }
    // Trailing record metadata, canonical al order: id, ts, seq, file,
    // data-class, proof-ref. (ac wire order puts these before the
    // terminal field; al canonical order puts them after it.)
    if (r.id) lines.push("id: " + escapeAlPlain(r.id));
    if (r.ts) lines.push("ts: " + escapeAlPlain(r.ts));
    if (r.sq) lines.push("seq: " + escapeAlPlain(r.sq));
    if (r.fl) lines.push("file: " + escapeAlPlain(r.fl));
    if (r.dc) lines.push("data-class: " + escapeAlPlain(r.dc));
    if (r.pr) lines.push("proof-ref: " + escapeAlPlain(r.pr));
    mergeEnvelopeLines(lines, r, env);
    return { al: lines.join("\n"), warnings: emailWarnings(r), version: r.version };
  }

  // ---- ac -> JSON -----------------------------------------------------------
  function acToJson(text, envelope) {
    var r = parseAc(text);
    assertNoUnknown(r);
    assertConvertibleCompact(r);
    var env = checkEnvelope(envelope);
    var obj = { lang: r.version, agent: r.a, task: r.t, status: CODE_TO_STATUS[r.s] };
    if (r.ro) obj.role = r.ro;
    if (r.x) obj.ctx = r.x;
    if (r.i) obj.in = r.i;
    if (r.o) obj.out = r.o;
    var vs = repeatList(r, "v");
    var vobjs = vs.map(function (raw) {
      var vp = parseVerdictValue(raw, r.version);
      var o = { model: vp.model, claim: vp.claim, proof: vp.proof, effectiveProof: vp.effectiveProof };
      if (vp.basis) o.basis = vp.basis;
      if (vp["proof-ref"]) o["proof-ref"] = vp["proof-ref"];
      return o;
    });
    if (r.version === "ac:1.1") { if (vobjs.length) obj.verdicts = vobjs; }
    else if (vobjs.length) obj.verdict = vobjs[0];
    var fobjs = repeatList(r, "f").map(function (raw) { return parseConflictValue(raw, r.version); });
    if (r.version === "ac:1.1") { if (fobjs.length) obj.conflicts = fobjs; }
    else if (fobjs.length) obj.conflict = fobjs[0];
    var yobjs = repeatList(r, "y").map(function (raw) { return parseVerifyValue(raw, r.version); });
    if (r.version === "ac:1.1") { if (yobjs.length) obj.verifies = yobjs; }
    else if (yobjs.length) obj.verify = yobjs[0];
    var nts = repeatList(r, "nt");
    if (r.version === "ac:1.1") { if (nts.length) obj.notes = nts; }
    else if (nts.length) obj.note = nts[0];
    if (r.n) obj.next = r.n;
    if (r.d) obj.done = r.d;
    if (r.b) obj.blocked = parseBlockedValue(r.b, r.version);
    if (r.id) obj.id = r.id;
    if (r.ts) obj.ts = r.ts;
    if (r.sq) obj.seq = parseInt(r.sq, 10);
    if (r.fl) obj.file = r.fl;
    if (r.dc) obj["data-class"] = r.dc;
    if (r.pr) obj["proof-ref"] = r.pr;
    if (env) {
      var envMap = { "id": "id", "ts": "ts", "seq": "seq", "file": "file", "data-class": "data-class", "proof-ref": "proof-ref" };
      for (var k in envMap) {
        if (env[k] === undefined) continue;
        var jk = envMap[k];
        if (obj[jk] !== undefined && String(obj[jk]) !== String(env[k])) {
          throw blocked("duplicate-field", k, { field: k, line: 1 });
        }
        if (obj[jk] === undefined) obj[jk] = env[k];
      }
    }
    var warns = emailWarnings(r);
    if (warns.length) obj.warnings = warns;
    return obj;
  }

  // ---- al -> ac --------------------------------------------------------------
  // Multi-line al:1 only. Compact input blocks compact-legacy-only
  // (expand it first with AgentLang.legacyExpandCompact, then convert).
  function isCompactFirstLine(line) {
    return /^al:1\s+\S/.test(line);
  }
  function scanAlTextForSecrets(text) {
    // Line-aware scan, run BEFORE any other check. Returns warnings
    // (email tier) and throws on the first hard pattern. Compact lines
    // are scanned pair by pair so the field name is the pair key.
    var lines = String(text).split("\n");
    var warnings = [];
    for (var li = 0; li < lines.length; li++) {
      var rawLine = lines[li];
      var line = rawLine.trim();
      if (!line) continue;
      if (isCompactFirstLine(line)) {
        var pairs = line.slice(5).split(" | ");
        for (var pi = 0; pi < pairs.length; pi++) {
          var eq = pairs[pi].indexOf("=");
          var field = eq > 0 ? pairs[pi].slice(0, eq).trim() : "compact";
          var val = eq > 0 ? pairs[pi].slice(eq + 1).trim() : pairs[pi].trim();
          var hit = throwIfSecret(val, field, li + 1);
          if (hit) warnings.push("email-warning:" + field);
        }
        continue;
      }
      var colon = line.indexOf(":");
      var label = colon > 0 ? line.slice(0, colon).trim() : "line";
      var val2 = colon > 0 ? line.slice(colon + 1).trim() : line;
      var hit2 = throwIfSecret(val2, label, li + 1);
      if (hit2) warnings.push("email-warning:" + label);
    }
    return warnings;
  }
  // Parse multi-line al:1 into a record. Throws on structural problems.
  // Returns { rec, warnings } where rec uses al field names.
  function parseAlForAc(text) {
    var warnings = scanAlTextForSecrets(text);
    var trimmed = text.trim();
    var lines = trimmed.split("\n");
    var first = lines[0].trim();
    if (isCompactFirstLine(first)) {
      var hasMore = false;
      for (var mi = 1; mi < lines.length; mi++) if (lines[mi].trim()) hasMore = true;
      if (hasMore) throw blocked("mixed-compact-multiline", "one-form-only");
      throw blocked("compact-legacy-only", "legacyExpandCompact-first");
    }
    if (first !== "al:1") throw blocked("not-al", "al:1-first-line");
    for (var li2 = 1; li2 < lines.length; li2++) {
      if (lines[li2].trim().indexOf("al:1") === 0) {
        throw blocked("mixed-compact-multiline", "one-form-only");
      }
    }
    var KNOWN_AL = ["agent", "task", "status", "ctx", "in", "out", "verdict",
      "conflict", "verify", "note", "next", "done", "blocked",
      "id", "ts", "seq", "file", "data-class", "proof-ref"];
    var SINGLETON_AL = ["agent", "task", "status", "ctx", "in", "out",
      "next", "done", "blocked", "id", "ts", "seq", "file", "data-class", "proof-ref"];
    var rec = { verdicts: [], conflicts: [], verifies: [], notes: [] };
    var seen = {};
    for (var i = 1; i < lines.length; i++) {
      var lineNo = i + 1;
      var line = lines[i].trim();
      if (!line) continue;
      var colon = line.indexOf(":");
      if (colon <= 0) throw blocked("line-not-code-colon", "code:-value-lines", { field: "line", line: lineNo });
      var label = line.slice(0, colon).trim();
      var rest = line.slice(colon + 1).trim();
      if (KNOWN_AL.indexOf(label) < 0) {
        // Cannot be represented in ac: block as field-loss, never drop.
        throw blocked("field-loss", label, { field: label, line: lineNo });
      }
      if (SINGLETON_AL.indexOf(label) >= 0) {
        if (seen[label]) throw blocked("duplicate-field", label, { field: label, line: lineNo });
        seen[label] = true;
      }
      if (label === "agent") {
        var segs = splitAlPairs(rest);
        var agentId = segs[0] ? segs[0].trim() : "";
        if (!agentId || agentId.indexOf("=") >= 0) {
          throw blocked("field-not-pair", "agent-id-first-segment", { field: "agent", line: lineNo });
        }
        rec.agent = unescapeAl(agentId);
        for (var si = 1; si < segs.length; si++) {
          var seg = segs[si].trim();
          var eq2 = seg.indexOf("=");
          if (eq2 <= 0) throw blocked("field-not-pair", "key=value-pairs", { field: "agent", line: lineNo });
          var pk = unescapeAl(seg.slice(0, eq2).trim());
          var pv = unescapeAl(seg.slice(eq2 + 1).trim());
          if (pk !== "role") throw blocked("unknown-field", pk, { field: pk, line: lineNo });
          if (rec.role !== undefined) throw blocked("duplicate-field", "role", { field: "role", line: lineNo });
          rec.role = pv;
        }
      } else if (label === "verdict") {
        var vp = parseAlPairs(rest, lineNo);
        for (var vk in vp) {
          if (["model", "claim", "proof", "basis", "proof-ref", "file", "fix"].indexOf(vk) < 0) {
            throw blocked("unknown-field", vk, { field: vk, line: lineNo });
          }
        }
        if (!vp.model || !vp.claim || !vp.proof) {
          throw blocked("verdict-incomplete", "verdict-model=|claim=|proof=", { field: "verdict", line: lineNo });
        }
        if (LEGAL_PROOF.indexOf(vp.proof) < 0) {
          throw blocked("proof-not-legal", "proof=code|live|test|none", { field: "verdict", line: lineNo });
        }
        var vobj = { model: vp.model, claim: vp.claim, proof: vp.proof };
        if (vp.basis) vobj.basis = vp.basis;
        if (vp["proof-ref"]) vobj["proof-ref"] = vp["proof-ref"];
        if (vp.file) vobj.file = vp.file;
        if (vp.fix) vobj.fix = vp.fix;
        vobj.effectiveProof = effectiveProof(vobj);
        rec.verdicts.push(vobj);
      } else if (label === "conflict") {
        var fp = parseAlPairs(rest, lineNo);
        if (!fp.a || !fp.b || !fp.resolve) {
          throw blocked("conflict-incomplete", "conflict-a=|b=|resolve=", { field: "conflict", line: lineNo });
        }
        rec.conflicts.push({ a: fp.a, b: fp.b, resolve: fp.resolve });
      } else if (label === "verify") {
        var yp = parseAlPairs(rest, lineNo);
        if (!yp.check || !yp.result) {
          throw blocked("verify-incomplete", "verify-check=|result=", { field: "verify", line: lineNo });
        }
        if (yp.result !== "pass" && yp.result !== "fail") {
          throw blocked("verify-malformed", "verify-check=|result=pass|fail", { field: "verify", line: lineNo });
        }
        rec.verifies.push({ check: yp.check, result: yp.result });
      } else if (label === "blocked") {
        var bp = parseAlPairs(rest, lineNo);
        if (!bp.reason || !bp.need) {
          throw blocked("blocked-incomplete", "blocked-reason=|need=", { field: "blocked", line: lineNo });
        }
        rec.blocked = { reason: bp.reason, need: bp.need };
      } else if (label === "note") {
        if (!rest) throw blocked("field-empty", "non-empty-value", { field: "note", line: lineNo });
        rec.notes.push(unescapeAl(rest));
      } else {
        // Plain-value lines: agent/task/status/ctx/in/out/next/done/
        // id/ts/seq/file/data-class/proof-ref.
        if (!rest) throw blocked("field-empty", "non-empty-value", { field: label, line: lineNo });
        var val = unescapeAl(rest);
        if (label === "seq") {
          if (!/^\d+$/.test(val)) {
            throw blocked("seq-malformed", "seq=non-negative-integer", { field: "seq", line: lineNo });
          }
          val = parseInt(val, 10);
        }
        if (label === "status") {
          if (STATUS_TO_CODE[val] === undefined) {
            throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked", { field: "status", line: lineNo });
          }
        }
        rec[label] = val;
      }
    }
    if (!rec.agent) throw blocked("missing-agent", "agent:-line");
    if (!rec.task) throw blocked("missing-task", "task:-line");
    if (!rec.status) throw blocked("missing-status", "status:-line");
    // Terminal rule (multi-line al): exactly one terminal line, unless
    // status is done/blocked (end-state, terminal line optional).
    var tCount = (rec.next ? 1 : 0) + (rec.done ? 1 : 0) + (rec.blocked ? 1 : 0);
    if (tCount > 1) throw blocked("terminal-multiple", "one-of-next|done|blocked");
    if (tCount === 0) {
      if (rec.status !== "done" && rec.status !== "blocked") {
        throw blocked("terminal-missing", "last-field-next|done|blocked");
      }
    } else if (rec.next && (rec.status === "done" || rec.status === "blocked")) {
      throw blocked("terminal-status-mismatch", "next-requires-status=todo|doing|verify");
    } else if (rec.done && rec.status !== "done") {
      throw blocked("terminal-status-mismatch", "done-requires-status=done");
    } else if (rec.blocked && rec.status !== "blocked") {
      throw blocked("terminal-status-mismatch", "blocked-requires-status=blocked");
    }
    return { rec: rec, warnings: warnings };
  }
  // Does an al record (parseAlForAc shape) need ac:1.1 to be represented?
  // Content needs (repeats, basis/proof-ref, values that need escaping)
  // force 1.1 even without metadata; metadata alone also forces 1.1
  // unless it travels in an envelope.
  function alContentNeeds11(rec) {
    if (rec.verdicts.length > 1 || rec.conflicts.length > 1 ||
        rec.verifies.length > 1 || rec.notes.length > 1) return true;
    for (var i = 0; i < rec.verdicts.length; i++) {
      if (rec.verdicts[i].basis || rec.verdicts[i]["proof-ref"]) return true;
      if (rec.verdicts[i].model.indexOf(":") >= 0 || rec.verdicts[i].model.indexOf(";") >= 0 ||
          rec.verdicts[i].claim.indexOf(":") >= 0 || rec.verdicts[i].claim.indexOf(";") >= 0) return true;
    }
    for (var ci = 0; ci < rec.conflicts.length; ci++) {
      if (rec.conflicts[ci].a.indexOf(":") >= 0 || rec.conflicts[ci].a.indexOf(";") >= 0 ||
          rec.conflicts[ci].b.indexOf(":") >= 0 || rec.conflicts[ci].b.indexOf(";") >= 0 ||
          rec.conflicts[ci].resolve.indexOf(":") >= 0 || rec.conflicts[ci].resolve.indexOf(";") >= 0) return true;
    }
    for (var yi = 0; yi < rec.verifies.length; yi++) {
      if (rec.verifies[yi].check.indexOf(":") >= 0 || rec.verifies[yi].check.indexOf(";") >= 0) return true;
    }
    if (rec.blocked && (rec.blocked.reason.indexOf(":") >= 0 || rec.blocked.reason.indexOf(";") >= 0 ||
        rec.blocked.need.indexOf(":") >= 0 || rec.blocked.need.indexOf(";") >= 0)) return true;
    var plainVals = [rec.agent, rec.role, rec.task, rec.ctx, rec.in, rec.out, rec.next, rec.done];
    for (var ni = 0; ni < rec.notes.length; ni++) plainVals.push(rec.notes[ni]);
    for (var pi = 0; pi < plainVals.length; pi++) {
      var pv = plainVals[pi];
      if (pv !== undefined && (pv.indexOf(";") >= 0 || pv.indexOf("\n") >= 0)) return true;
    }
    return false;
  }
  function alNeeds11(rec) {
    if (alContentNeeds11(rec)) return true;
    if (rec.id || rec.ts || rec.seq !== undefined || rec.file || rec["data-class"] || rec["proof-ref"]) return true;
    return false;
  }
  // Field-loss scan for an al record against a target version. Returns
  // null when representable, else { reason, need }.
  function alFieldLoss(rec, target) {
    for (var i = 0; i < rec.verdicts.length; i++) {
      if (rec.verdicts[i].file) return { reason: "field-loss", need: "file" };
      if (rec.verdicts[i].fix) return { reason: "field-loss", need: "fix" };
    }
    if (target === "ac:1") {
      if (alNeeds11(rec)) return { reason: "version-not-supported", need: "ac:1.1" };
      // ac:1 has no escaping: ";" / newline anywhere, or ":" inside a
      // colon-split field, cannot be represented.
      var plainVals = [];
      plainVals.push(["a", rec.agent]);
      if (rec.role) plainVals.push(["ro", rec.role]);
      plainVals.push(["t", rec.task]);
      if (rec.ctx) plainVals.push(["x", rec.ctx]);
      if (rec.in) plainVals.push(["i", rec.in]);
      if (rec.out) plainVals.push(["o", rec.out]);
      if (rec.notes.length) plainVals.push(["nt", rec.notes[0]]);
      if (rec.next) plainVals.push(["n", rec.next]);
      if (rec.done) plainVals.push(["d", rec.done]);
      for (var pi = 0; pi < plainVals.length; pi++) {
        if (plainVals[pi][1].indexOf(";") >= 0 || plainVals[pi][1].indexOf("\n") >= 0) {
          return { reason: "field-loss", need: plainVals[pi][0] };
        }
      }
      var segVals = [];
      for (var vi = 0; vi < rec.verdicts.length; vi++) {
        segVals.push(["v", rec.verdicts[vi].model]);
        segVals.push(["v", rec.verdicts[vi].claim]);
      }
      for (var ci = 0; ci < rec.conflicts.length; ci++) {
        segVals.push(["f", rec.conflicts[ci].a]);
        segVals.push(["f", rec.conflicts[ci].b]);
        segVals.push(["f", rec.conflicts[ci].resolve]);
      }
      for (var yi = 0; yi < rec.verifies.length; yi++) {
        segVals.push(["y", rec.verifies[yi].check]);
      }
      if (rec.blocked) {
        segVals.push(["b", rec.blocked.reason]);
        segVals.push(["b", rec.blocked.need]);
      }
      for (var si2 = 0; si2 < segVals.length; si2++) {
        if (segVals[si2][1].indexOf(":") >= 0 || segVals[si2][1].indexOf(";") >= 0) {
          return { reason: "field-loss", need: segVals[si2][0] };
        }
      }
    }
    return null;
  }
  function alToAc(text, opts) {
    opts = opts || {};
    var parsed = parseAlForAc(text);
    var rec = parsed.rec;
    var envelopeMode = !!opts.envelope;
    var target = opts.target;
    if (!target) {
      if (envelopeMode) {
        // Metadata travels in the envelope, so it does not force 1.1.
        target = alContentNeeds11(rec) ? "ac:1.1" : "ac:1";
      } else {
        target = alNeeds11(rec) ? "ac:1.1" : "ac:1";
      }
    }
    if (target !== "ac:1" && target !== "ac:1.1") {
      throw blocked("version-not-supported", "ac:1-or-ac:1.1");
    }
    // Per-verdict file/fix have no ac slot in either version.
    for (var fi = 0; fi < rec.verdicts.length; fi++) {
      if (rec.verdicts[fi].file) throw blocked("field-loss", "file", { field: "verdict", line: 1 });
      if (rec.verdicts[fi].fix) throw blocked("field-loss", "fix", { field: "verdict", line: 1 });
    }
    var envelope = null;
    var meta = { "id": rec.id, "ts": rec.ts, "seq": rec.seq,
      "file": rec.file, "data-class": rec["data-class"], "proof-ref": rec["proof-ref"] };
    var hasMeta = meta.id !== undefined || meta.ts !== undefined || meta.seq !== undefined ||
      meta.file !== undefined || meta["data-class"] !== undefined || meta["proof-ref"] !== undefined;
    if (envelopeMode) {
      if (hasMeta) {
        envelope = {};
        if (meta.id) envelope.id = meta.id;
        if (meta.ts) envelope.ts = meta.ts;
        if (meta.seq !== undefined) envelope.seq = meta.seq;
        if (meta.file) envelope.file = meta.file;
        if (meta["data-class"]) envelope["data-class"] = meta["data-class"];
        if (meta["proof-ref"]) envelope["proof-ref"] = meta["proof-ref"];
      }
      // In envelope mode the metadata travels alongside; the ac string
      // itself must still fit the target (repeats/basis still need 1.1,
      // and values that need escaping still block for ac:1).
      var stripped = { verdicts: rec.verdicts, conflicts: rec.conflicts,
        verifies: rec.verifies, notes: rec.notes };
      if (target === "ac:1") {
        if (stripped.verdicts.length > 1 || stripped.conflicts.length > 1 ||
            stripped.verifies.length > 1 || stripped.notes.length > 1) {
          throw blocked("version-not-supported", "ac:1.1");
        }
        for (var bi = 0; bi < stripped.verdicts.length; bi++) {
          if (stripped.verdicts[bi].basis || stripped.verdicts[bi]["proof-ref"]) {
            throw blocked("version-not-supported", "ac:1.1");
          }
        }
        var envPlain = [["agent", rec.agent], ["task", rec.task], ["ctx", rec.ctx],
          ["in", rec.in], ["out", rec.out], ["next", rec.next], ["done", rec.done]];
        if (rec.role) envPlain.push(["agent", rec.role]);
        for (var ep2 = 0; ep2 < envPlain.length; ep2++) {
          if (envPlain[ep2][1] !== undefined &&
              (envPlain[ep2][1].indexOf(";") >= 0 || envPlain[ep2][1].indexOf("\n") >= 0)) {
            throw blocked("field-loss", envPlain[ep2][0]);
          }
        }
        for (var en2 = 0; en2 < rec.notes.length; en2++) {
          if (rec.notes[en2].indexOf(";") >= 0 || rec.notes[en2].indexOf("\n") >= 0) {
            throw blocked("field-loss", "note");
          }
        }
        var envSegs = [];
        for (var ev2 = 0; ev2 < rec.verdicts.length; ev2++) {
          envSegs.push(["verdict", rec.verdicts[ev2].model]);
          envSegs.push(["verdict", rec.verdicts[ev2].claim]);
        }
        for (var ec2 = 0; ec2 < rec.conflicts.length; ec2++) {
          envSegs.push(["conflict", rec.conflicts[ec2].a]);
          envSegs.push(["conflict", rec.conflicts[ec2].b]);
          envSegs.push(["conflict", rec.conflicts[ec2].resolve]);
        }
        for (var ey2 = 0; ey2 < rec.verifies.length; ey2++) {
          envSegs.push(["verify", rec.verifies[ey2].check]);
        }
        if (rec.blocked) {
          envSegs.push(["blocked", rec.blocked.reason]);
          envSegs.push(["blocked", rec.blocked.need]);
        }
        for (var es2 = 0; es2 < envSegs.length; es2++) {
          if (envSegs[es2][1].indexOf(":") >= 0 || envSegs[es2][1].indexOf(";") >= 0) {
            throw blocked("field-loss", envSegs[es2][0]);
          }
        }
      }
    } else {
      var loss = alFieldLoss(rec, target);
      if (loss) throw blocked(loss.reason, loss.need);
    }
    var fields = [target, "a=" + emitAcPlain(rec.agent, target)];
    if (rec.role) fields.push("ro=" + emitAcPlain(rec.role, target));
    fields.push("t=" + emitAcPlain(rec.task, target), "s=" + STATUS_TO_CODE[rec.status]);
    if (rec.ctx) fields.push("x=" + emitAcPlain(rec.ctx, target));
    if (rec.in) fields.push("i=" + emitAcPlain(rec.in, target));
    if (rec.out) fields.push("o=" + emitAcPlain(rec.out, target));
    for (var vi2 = 0; vi2 < rec.verdicts.length; vi2++) {
      var v = rec.verdicts[vi2];
      var vstr = emitAcSegment(v.model, target) + ":" + emitAcSegment(v.claim, target) +
        ":" + PROOF_TO_CODE[v.proof];
      if (target === "ac:1.1") {
        if (v.basis) vstr += ":" + emitAcSegment(v.basis, target);
        if (v["proof-ref"]) vstr += ":" + emitAcSegment(v["proof-ref"], target);
      }
      fields.push("v=" + vstr);
    }
    for (var ci2 = 0; ci2 < rec.conflicts.length; ci2++) {
      var c = rec.conflicts[ci2];
      fields.push("f=" + emitAcSegment(c.a, target) + ":" + emitAcSegment(c.b, target) +
        ":" + emitAcSegment(c.resolve, target));
    }
    for (var yi2 = 0; yi2 < rec.verifies.length; yi2++) {
      var y = rec.verifies[yi2];
      fields.push("y=" + emitAcSegment(y.check, target) + ":" + y.result);
    }
    for (var ni2 = 0; ni2 < rec.notes.length; ni2++) {
      fields.push("nt=" + emitAcPlain(rec.notes[ni2], target));
    }
    if (!envelopeMode) {
      if (rec.id) fields.push("id=" + emitAcPlain(rec.id, target));
      if (rec.ts) fields.push("ts=" + emitAcPlain(rec.ts, target));
      if (rec.seq !== undefined) fields.push("sq=" + emitAcPlain(String(rec.seq), target));
      if (rec.file) fields.push("fl=" + emitAcPlain(rec.file, target));
      if (rec["data-class"]) fields.push("dc=" + emitAcPlain(rec["data-class"], target));
      if (rec["proof-ref"]) fields.push("pr=" + emitAcPlain(rec["proof-ref"], target));
    }
    if (rec.next) fields.push("n=" + emitAcPlain(rec.next, target));
    if (rec.done) fields.push("d=" + emitAcPlain(rec.done, target));
    if (rec.blocked) {
      fields.push("b=" + emitAcSegment(rec.blocked.reason, target) + ":" +
        emitAcSegment(rec.blocked.need, target));
    }
    var ac = fields.join(";");
    if (envelopeMode) return { ac: ac, envelope: envelope, warnings: parsed.warnings };
    return ac;
  }
  function alToAcEnvelope(text) {
    return alToAc(text, { envelope: true });
  }
  // Emit helpers: ac:1.1 escapes, ac:1 blocks (checked by alFieldLoss,
  // but emit defensively blocks again rather than emitting corrupt wire).
  function emitAcPlain(str, target) {
    if (target === "ac:1.1") return escapeAcPlain(str);
    if (str.indexOf(";") >= 0 || str.indexOf("\n") >= 0) throw blocked("field-loss", "value");
    return str;
  }
  function emitAcSegment(str, target) {
    if (target === "ac:1.1") return escapeAcSegment(str);
    if (str.indexOf(":") >= 0 || str.indexOf(";") >= 0) throw blocked("field-loss", "value");
    return str;
  }

  // ---- JSON -> ac -------------------------------------------------------------
  // Accepts singular (ac:1 shape) and plural (ac:1.1 shape) fields.
  // effectiveProof and warnings keys in input are derived/advisory and
  // are ignored on the way back (proof/basis are authoritative).
  // Malformed verdicts block here too: a verdict object missing model,
  // claim or proof, or with an illegal proof, blocks verdict-incomplete
  // or proof-not-legal — it is never emitted with proof undefined.
  function jsonToAc(obj, opts) {
    opts = opts || {};
    var detailed = jsonToAcDetailed(obj, opts);
    if (opts.envelope) return detailed;
    return detailed.ac;
  }
  function jsonToAcEnvelope(obj) {
    return jsonToAc(obj, { envelope: true });
  }
  function jsonToAcDetailed(obj, opts) {
    opts = opts || {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw blocked("json-not-object", "json-object-with-agent-task-status");
    }
    var warnings = [];
    // Field-aware secret scan over string values (field path, line 1).
    // Email is warning tier only; hard patterns block, never echoing.
    (function scanJson(o, path) {
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        var v = o[k];
        var p = path ? path + "." + k : k;
        if (typeof v === "string") {
          var hit = throwIfSecret(v, p, 1);
          if (hit) warnings.push("email-warning:" + p);
        } else if (v && typeof v === "object") scanJson(v, p);
      }
    })(obj, "");
    if (!obj.agent) throw blocked("missing-agent", "agent-field");
    if (!obj.task) throw blocked("missing-task", "task-field");
    var sc = STATUS_TO_CODE[obj.status] || (CODE_TO_STATUS[obj.status] ? obj.status : null);
    if (!sc) throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked");
    var statusFull = CODE_TO_STATUS[sc];
    // Collect verdicts/conflicts/verifies/notes (singular or plural).
    function collect(singular, plural) {
      var s = obj[singular], pl = obj[plural];
      if (s !== undefined && pl !== undefined) {
        throw blocked("duplicate-field", singular);
      }
      if (pl !== undefined) {
        if (!Array.isArray(pl)) throw blocked("json-not-array", plural + "-must-be-array");
        return pl;
      }
      if (s !== undefined) return [s];
      return [];
    }
    var verdicts = collect("verdict", "verdicts");
    var conflicts = collect("conflict", "conflicts");
    var verifies = collect("verify", "verifies");
    var notes = collect("note", "notes");
    // Validate structured objects (both code paths for malformed verdicts:
    // the numeric-index path is gone; every part is checked by name).
    var vnorm = verdicts.map(function (v) {
      if (!v || typeof v !== "object") throw blocked("verdict-incomplete", "verdict-model-claim-proof");
      if (!v.model || !v.claim || !v.proof) throw blocked("verdict-incomplete", "verdict-model-claim-proof");
      if (LEGAL_PROOF.indexOf(v.proof) < 0) throw blocked("proof-not-legal", "proof=code|live|test|none");
      if (v.basis !== undefined && (typeof v.basis !== "string" || !v.basis)) {
        throw blocked("verdict-malformed", "verdict-basis-non-empty");
      }
      if (v["proof-ref"] !== undefined && (typeof v["proof-ref"] !== "string" || !v["proof-ref"])) {
        throw blocked("verdict-malformed", "verdict-proof-ref-non-empty");
      }
      return v;
    });
    var cnorm = conflicts.map(function (c) {
      if (!c || typeof c !== "object" || !c.a || !c.b || !c.resolve) {
        throw blocked("conflict-incomplete", "conflict-a-b-resolve");
      }
      return c;
    });
    var ynorm = verifies.map(function (y) {
      if (!y || typeof y !== "object" || !y.check || !y.result) {
        throw blocked("verify-incomplete", "verify-check-result");
      }
      if (y.result !== "pass" && y.result !== "fail") {
        throw blocked("verify-malformed", "verify-check-result-pass|fail");
      }
      return y;
    });
    var nnorm = notes.map(function (n) {
      if (typeof n !== "string" || !n) throw blocked("field-empty", "non-empty-note");
      return n;
    });
    var hasSeq = obj.seq !== undefined;
    if (hasSeq && (!Number.isInteger(obj.seq) || obj.seq < 0)) {
      throw blocked("seq-malformed", "seq=non-negative-integer");
    }
    // Target version: explicit > obj.lang > derived from content.
    var envelopeMode = !!opts.envelope;
    var target = opts.target;
    if (!target && (obj.lang === "ac:1" || obj.lang === "ac:1.1")) target = obj.lang;
    if (!target) {
      var needs11 = verdicts.length > 1 || conflicts.length > 1 ||
        verifies.length > 1 || notes.length > 1;
      if (!envelopeMode) {
        if (hasSeq || obj.file !== undefined || obj["data-class"] !== undefined) needs11 = true;
      }
      // Values that need escaping force 1.1 in either mode (an envelope
      // carries metadata, not escaping).
      var escPlain = [obj.agent, obj.role, obj.task, obj.ctx, obj.in, obj.out, obj.next, obj.done];
      for (var epi = 0; epi < escPlain.length; epi++) {
        if (escPlain[epi] !== undefined &&
            (escPlain[epi].indexOf(";") >= 0 || escPlain[epi].indexOf("\n") >= 0)) needs11 = true;
      }
      for (var eni = 0; eni < nnorm.length; eni++) {
        if (nnorm[eni].indexOf(";") >= 0 || nnorm[eni].indexOf("\n") >= 0) needs11 = true;
      }
      for (var evi = 0; evi < vnorm.length; evi++) {
        if (vnorm[evi].model.indexOf(":") >= 0 || vnorm[evi].model.indexOf(";") >= 0 ||
            vnorm[evi].claim.indexOf(":") >= 0 || vnorm[evi].claim.indexOf(";") >= 0) needs11 = true;
      }
      for (var eci = 0; eci < cnorm.length; eci++) {
        if (cnorm[eci].a.indexOf(":") >= 0 || cnorm[eci].a.indexOf(";") >= 0 ||
            cnorm[eci].b.indexOf(":") >= 0 || cnorm[eci].b.indexOf(";") >= 0 ||
            cnorm[eci].resolve.indexOf(":") >= 0 || cnorm[eci].resolve.indexOf(";") >= 0) needs11 = true;
      }
      for (var eyi = 0; eyi < ynorm.length; eyi++) {
        if (ynorm[eyi].check.indexOf(":") >= 0 || ynorm[eyi].check.indexOf(";") >= 0) needs11 = true;
      }
      if (obj.blocked && (((obj.blocked.reason || "").indexOf(":") >= 0) || ((obj.blocked.reason || "").indexOf(";") >= 0) ||
          ((obj.blocked.need || "").indexOf(":") >= 0) || ((obj.blocked.need || "").indexOf(";") >= 0))) needs11 = true;
      for (var vi3 = 0; vi3 < vnorm.length; vi3++) {
        if (vnorm[vi3].basis || vnorm[vi3]["proof-ref"]) needs11 = true;
      }
      if (!envelopeMode && (obj.id !== undefined || obj.ts !== undefined || obj["proof-ref"] !== undefined)) {
        needs11 = true;
      }
      target = needs11 ? "ac:1.1" : "ac:1";
    }
    if (target !== "ac:1" && target !== "ac:1.1") {
      throw blocked("version-not-supported", "ac:1-or-ac:1.1");
    }
    // Envelope split (metadata alongside, never dropped, never stuffed
    // into a bare ac:1 string unless the target is ac:1.1).
    var envelope = null;
    var metaKeys = ["id", "ts", "seq", "file", "data-class", "proof-ref"];
    var hasMeta = false;
    for (var mk = 0; mk < metaKeys.length; mk++) {
      if (obj[metaKeys[mk]] !== undefined) hasMeta = true;
    }
    if (envelopeMode && hasMeta) {
      envelope = {};
      if (obj.id !== undefined) envelope.id = obj.id;
      if (obj.ts !== undefined) envelope.ts = obj.ts;
      if (obj.seq !== undefined) envelope.seq = obj.seq;
      if (obj.file !== undefined) envelope.file = obj.file;
      if (obj["data-class"] !== undefined) envelope["data-class"] = obj["data-class"];
      if (obj["proof-ref"] !== undefined) envelope["proof-ref"] = obj["proof-ref"];
    }
    if (!envelopeMode && target === "ac:1") {
      if (verdicts.length > 1 || conflicts.length > 1 || verifies.length > 1 || notes.length > 1) {
        throw blocked("version-not-supported", "ac:1.1");
      }
      for (var bi3 = 0; bi3 < vnorm.length; bi3++) {
        if (vnorm[bi3].basis || vnorm[bi3]["proof-ref"]) {
          throw blocked("version-not-supported", "ac:1.1");
        }
      }
      if (hasMeta) throw blocked("version-not-supported", "ac:1.1");
    }
    if (envelopeMode && target === "ac:1") {
      if (verdicts.length > 1 || conflicts.length > 1 || verifies.length > 1 || notes.length > 1) {
        throw blocked("version-not-supported", "ac:1.1");
      }
      for (var bi4 = 0; bi4 < vnorm.length; bi4++) {
        if (vnorm[bi4].basis || vnorm[bi4]["proof-ref"]) {
          throw blocked("version-not-supported", "ac:1.1");
        }
      }
      if (obj.seq !== undefined || obj.file !== undefined || obj["data-class"] !== undefined) {
        // seq/file/data-class are envelope metadata too, so they travel
        // alongside; only repeats/basis force 1.1. Nothing to block here.
      }
    }
    // Terminal handling on emit.
    var terminal = null;
    if (obj.next !== undefined) terminal = "n";
    else if (obj.done !== undefined) terminal = "d";
    else if (obj.blocked !== undefined) terminal = "b";
    var termCount = (obj.next !== undefined ? 1 : 0) + (obj.done !== undefined ? 1 : 0) +
      (obj.blocked !== undefined ? 1 : 0);
    if (termCount > 1) throw blocked("terminal-multiple", "one-of-next|done|blocked");
    if (terminal === "n" && (statusFull === "done" || statusFull === "blocked")) {
      throw blocked("terminal-status-mismatch", "next-requires-status=todo|doing|verify");
    }
    if (terminal === "d" && statusFull !== "done") {
      throw blocked("terminal-status-mismatch", "done-requires-status=done");
    }
    if (terminal === "b" && statusFull !== "blocked") {
      throw blocked("terminal-status-mismatch", "blocked-requires-status=blocked");
    }
    if (obj.blocked !== undefined) {
      if (!obj.blocked.reason || !obj.blocked.need) {
        throw blocked("blocked-incomplete", "blocked-reason-need");
      }
    }
    if (!terminal) {
      if (target === "ac:1.1") throw blocked("terminal-missing", "last-field-n|d|b");
      if (statusFull !== "done" && statusFull !== "blocked") {
        throw blocked("terminal-missing", "last-field-n|d|b");
      }
      // Frozen ac:1 compact: bare records only; content fields block.
      var contentFields = ["ctx", "in", "out", "verdict", "verdicts",
        "conflict", "conflicts", "verify", "verifies", "note", "notes"];
      for (var cf = 0; cf < contentFields.length; cf++) {
        if (obj[contentFields[cf]] !== undefined) {
          throw blocked("field-loss", contentFields[cf]);
        }
      }
    }
    // ac:1 has no escaping: block (named field) on ";" / newline in
    // plain values, or ":" / ";" in colon-split values, before emitting.
    if (target === "ac:1") {
      var jp = [["agent", obj.agent], ["role", obj.role], ["task", obj.task],
        ["ctx", obj.ctx], ["in", obj.in], ["out", obj.out],
        ["next", obj.next], ["done", obj.done]];
      for (var jpi = 0; jpi < jp.length; jpi++) {
        if (jp[jpi][1] !== undefined &&
            (jp[jpi][1].indexOf(";") >= 0 || jp[jpi][1].indexOf("\n") >= 0)) {
          throw blocked("field-loss", jp[jpi][0]);
        }
      }
      for (var jni = 0; jni < nnorm.length; jni++) {
        if (nnorm[jni].indexOf(";") >= 0 || nnorm[jni].indexOf("\n") >= 0) {
          throw blocked("field-loss", "note");
        }
      }
      var js = [];
      for (var jvi = 0; jvi < vnorm.length; jvi++) {
        js.push(["verdict", vnorm[jvi].model]); js.push(["verdict", vnorm[jvi].claim]);
      }
      for (var jci = 0; jci < cnorm.length; jci++) {
        js.push(["conflict", cnorm[jci].a]); js.push(["conflict", cnorm[jci].b]);
        js.push(["conflict", cnorm[jci].resolve]);
      }
      for (var jyi2 = 0; jyi2 < ynorm.length; jyi2++) js.push(["verify", ynorm[jyi2].check]);
      if (obj.blocked) {
        js.push(["blocked", obj.blocked.reason]); js.push(["blocked", obj.blocked.need]);
      }
      for (var jsi = 0; jsi < js.length; jsi++) {
        if (js[jsi][1].indexOf(":") >= 0 || js[jsi][1].indexOf(";") >= 0) {
          throw blocked("field-loss", js[jsi][0]);
        }
      }
    }
    // Emit (wire order: metadata before the terminal field, last).
    var fields = [target, "a=" + emitAcPlain(obj.agent, target)];
    if (obj.role) fields.push("ro=" + emitAcPlain(obj.role, target));
    fields.push("t=" + emitAcPlain(obj.task, target), "s=" + sc);
    if (obj.ctx) fields.push("x=" + emitAcPlain(obj.ctx, target));
    if (obj.in) fields.push("i=" + emitAcPlain(obj.in, target));
    if (obj.out) fields.push("o=" + emitAcPlain(obj.out, target));
    for (var j = 0; j < vnorm.length; j++) {
      var vv = vnorm[j];
      var vs2 = emitAcSegment(vv.model, target) + ":" + emitAcSegment(vv.claim, target) +
        ":" + PROOF_TO_CODE[vv.proof];
      if (target === "ac:1.1") {
        if (vv.basis) vs2 += ":" + emitAcSegment(vv.basis, target);
        if (vv["proof-ref"]) vs2 += ":" + emitAcSegment(vv["proof-ref"], target);
      }
      fields.push("v=" + vs2);
    }
    for (var j2 = 0; j2 < cnorm.length; j2++) {
      fields.push("f=" + emitAcSegment(cnorm[j2].a, target) + ":" +
        emitAcSegment(cnorm[j2].b, target) + ":" + emitAcSegment(cnorm[j2].resolve, target));
    }
    for (var j3 = 0; j3 < ynorm.length; j3++) {
      fields.push("y=" + emitAcSegment(ynorm[j3].check, target) + ":" + ynorm[j3].result);
    }
    for (var j4 = 0; j4 < nnorm.length; j4++) {
      fields.push("nt=" + emitAcPlain(nnorm[j4], target));
    }
    if (!envelopeMode) {
      if (obj.id !== undefined) fields.push("id=" + emitAcPlain(obj.id, target));
      if (obj.ts !== undefined) fields.push("ts=" + emitAcPlain(obj.ts, target));
      if (obj.seq !== undefined) fields.push("sq=" + emitAcPlain(String(obj.seq), target));
      if (obj.file !== undefined) fields.push("fl=" + emitAcPlain(obj.file, target));
      if (obj["data-class"] !== undefined) fields.push("dc=" + emitAcPlain(obj["data-class"], target));
      if (obj["proof-ref"] !== undefined) fields.push("pr=" + emitAcPlain(obj["proof-ref"], target));
    }
    if (obj.next !== undefined) fields.push("n=" + emitAcPlain(obj.next, target));
    if (obj.done !== undefined) fields.push("d=" + emitAcPlain(obj.done, target));
    if (obj.blocked !== undefined) {
      fields.push("b=" + emitAcSegment(obj.blocked.reason, target) + ":" +
        emitAcSegment(obj.blocked.need, target));
    }
    var ac = fields.join(";");
    if (envelopeMode) return { ac: ac, envelope: envelope, warnings: warnings };
    return { ac: ac, warnings: warnings };
  }

  // ND-AC stream (Gemini v8 addition, ported): one ac:1/ac:1.1 record per
  // line, blank lines ignored. Secret block-tier scan first (never echo);
  // each line parsed by parseAc, so a bad line blocks the whole stream
  // instead of being silently dropped. data-ac DOM attributes are NOT
  // added (they would duplicate view data and carry test-only proof refs).
  function parseAcStream(streamText) {
    var hit = findSecret(String(streamText || ""));
    if (hit) throw blocked("secret-pattern", "public-pack-only", { field: hit.field, line: hit.line, rule: hit.rule });
    var lines = String(streamText || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) throw blocked("not-ac", "ac:1-stream-empty");
    return lines.map(function (line) { return parseAc(line); });
  }

  var api = {
    STATUS_TO_CODE: STATUS_TO_CODE, CODE_TO_STATUS: CODE_TO_STATUS,
    PROOF_TO_CODE: PROOF_TO_CODE, CODE_TO_PROOF: CODE_TO_PROOF,
    KNOWN_CODES_1: KNOWN_CODES_1, KNOWN_CODES_11: KNOWN_CODES_11,
    REPEATABLE: REPEATABLE, WIRE_ORDER: WIRE_ORDER,
    getSecretPatterns: getSecretPatterns, findSecret: findSecret,
    effectiveProof: effectiveProof,
    parseAc: parseAc, parseAc1: parseAc1, parseAcStream: parseAcStream, validateAc: validateAc,
    acToAl: acToAl, acToAlDetailed: acToAlDetailed,
    alToAc: alToAc, alToAcEnvelope: alToAcEnvelope,
    acToJson: acToJson, jsonToAc: jsonToAc,
    jsonToAcEnvelope: jsonToAcEnvelope, jsonToAcDetailed: jsonToAcDetailed,
  };
  global.AgentCode = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
