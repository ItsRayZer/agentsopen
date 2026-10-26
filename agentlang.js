// AgentLang al:1 — standalone validator. Node-compatible, no dependencies.
// UMD: module.exports + globalThis.AgentLang.
// This file does NOT depend on agentcode.js. It validates al:1 packs,
// expands legacy compact Cloud packs, and computes canonical forms.
// It never loads, calls, or requires any other workspace file.
//
// VALID FORMS (plain): multi-line al:1 ONLY for new records. The compact
// single-line form ("al:1 agent=.. | ..") is REMOVED as a valid form.
// New compact input is blocked with reason=compact-legacy-only.
// Already-published Cloud packs in compact form are expanded ONLY by
// legacyExpandCompact(), which returns canonical multi-line al:1 PLUS a
// warning. If a compact form is ever wanted again it must use a NEW
// header, not al:1. ac:1 is single-line by design and already meets the
// single-line Cloud need, so a second al grammar is not carried forward.
//
// ABNF — SPEC NOTES (multiline al:1):
//   pack          = header *(LF line)
//   header        = "al:1"
//   line          = label ":" SP value
//   label         = "agent" / "task" / "status" / "ctx" / "in" / "out" /
//                   "verdict" / "conflict" / "verify" / "note" /
//                   "next" / "done" / "blocked" /
//                   "id" / "ts" / "seq" / "file" / "data-class" / "proof-ref"
//   agent-line    = "agent:" SP agent-id [" | role=" role]
//   verdict-line  = "verdict:" SP verdict-pairs
//   verdict-pairs = "model=" v " | claim=" v " | proof=" proof
//                   [" | basis=" v] [" | proof-ref=" v]
//                   [" | file=" v] [" | fix=" v]
//   conflict-line = "conflict:" SP "a=" v " | b=" v " | resolve=" v
//   verify-line   = "verify:" SP "check=" v " | result=" ("pass" / "fail")
//   blocked-line  = "blocked:" SP "reason=" v " | need=" v
//   proof         = "code" / "live" / "test" / "none"
//   status        = "todo" / "doing" / "verify" / "done" / "blocked"
//   v             = *(escaped-char / plain-char)
//   Terminal rule: exactly one of next/done/blocked, unless status is
//   done/blocked (end-state, terminal line optional). Status and
//   terminal must agree: next requires todo/doing/verify, done requires
//   done, blocked requires blocked. Trailing metadata lines
//   (id/ts/seq/file/data-class/proof-ref) may follow the terminal line.
//   Required lines: agent, task, status. Duplicate singleton lines block.
//   verdict/conflict/verify/note lines may repeat, in order.
//
// ABNF — LEGACY COMPACT ONLY (historical Cloud packs, NOT valid al:1):
//   legacy-pack = "al:1" SP pair *(" | " pair)
//   pair        = "agent=" id / "task=" id / "action=" id /
//                 "status=" status / "proof=" proof /
//                 "next=" v / "done=" v / "reason=" v / "need=" v
//   Discriminator: "al:1" followed by a space and a pair is compact;
//   "al:1" followed by a newline is multiline. A compact first line plus
//   further lines is mixed-compact-multiline and is rejected by both the
//   validator and the legacy decoder.
//   Legacy terminal rule: status done/blocked needs no terminal pair;
//   any other status needs exactly one of next/done/blocked, agreeing
//   with status. action= is a FROZEN alias for task=. proof= expands to
//   a synthetic verdict (model=agent, claim=task, proof=proof value).
//   Legacy packs expand to canonical multiline al:1 plus a warning;
//   they are never accepted as new records.
//
// CANONICAL ORDER (fixed key order on emit; repeats keep input order
// within one key): agent, task, status, ctx, in, out, verdict, conflict,
// verify, note, next, done, blocked, id, ts, seq, file, data-class,
// proof-ref. Within a verdict line, pair order is: model, claim, proof,
// basis, proof-ref, file, fix. Two packs with the same content in
// different input line orders canonicalise to the same string, so their
// hashes match. A canonical hash binds a record's bytes for comparison.
// It is a format binding, not an identity claim and not an approval by
// a person.
//
// ESCAPE RULE (backslash): in values, a backslash must be followed by one
// of | : = \ n and yields |, :, =, backslash, or newline respectively.
// A backslash before any other character, or a trailing backslash,
// blocks with bad-escape. Pair lines split on unescaped " | ".
// Plain-value lines (task, ctx, in, out, note, next, done, id, ts, seq,
// file, data-class, proof-ref, status) take the whole remainder of the
// line. Canonical emit escapes backslash, |, :, =, newline in pair
// values, and backslash, |, newline in plain values. Parsing unescapes
// all five anywhere, so emit-then-parse round-trips values exactly.
// Surrounding whitespace around lines and values is not significant.
//
// PROOF-REF RULE (enforced by code): a verdict's effective proof is
// "none" when its proof is "none" OR its basis is "logic-only", otherwise
// its proof value. basis never rewrites the stored proof. A verdict is
// resolving (canResolve) when its effective proof is not "none" OR it
// carries a proof-ref. A verdict with effective proof "none" and no
// proof-ref is unproven: it is flagged unproven-verdict-cannot-resolve
// and never resolves a conflict. conflictResolved is true when the
// record has a conflict and at least one resolving verdict, false when
// it has a conflict and no resolving verdict, and null when it has no
// conflict. Flags are not structural errors: a flagged record is
// structurally valid but its conflict is NOT resolved.
//
// ID / TS / SEQ: optional trailing lines. id is a pack identity: a
// second pack with the same id is a REPLAY and must be rejected by the
// consumer. createIdRegistry() returns a registry whose add(id) returns
// true for a new id and false for a replay; dedupeIds(ids) splits a list
// into kept ids and duplicates, preserving order. ts is free-form text
// (ISO-8601 recommended); it is checked non-empty only. seq, when
// present, must be a non-negative integer (sequence number).
//
// ENVELOPE NOTE: al:1 may carry id/ts/proof-ref (and the other trailing
// metadata) REFERRING to an ac:1 record. Those lines are envelope
// metadata, not ac:1 fields: converting such a pack to a bare ac:1
// string drops them, so use AgentCode.alToAcEnvelope, which returns
// { ac, envelope } with the metadata travelling alongside the ac:1
// string, never dropped.
//
// SECRETS (hygiene check only): same note as agentcode.js. The pattern
// list below is embedded IDENTICALLY in agentcode.js and here (no third
// runtime dependency, so both files stay standalone). agentlang-tests.js
// asserts the two embedded lists are deep-equal on every run; that
// equality check is the build check. The canonical pattern set is listed
// in the fix-build report so a shell mirror (aiws) can be checked
// against the same list. Hard patterns block with pattern class (rule) +
// field + line, NEVER the matched value. A bare email address is WARNING
// tier only, never a block. The generic high-entropy token pattern was
// DROPPED from the block list because it produced false positives on
// ordinary text. This check is not a guarantee that a pack contains no
// secrets, and it is not a content scanner. Server-side re-validation of
// public packs is a separate step (Worker prototype).
//
// MEASUREMENT POLICY: no token counts are published here. Tokens are
// unmeasured until a defined corpus is measured on a named tokenizer.
// Length comparisons use chars only, plus break-even record counts
// (labelled estimate). A characters-divided-by-four figure is not
// published here at all.
// MEASURED SNAPSHOT (measured 2026-10-26; recompute on every run via
// agentlang-tests.js). Record: ac:1.1 with id/ts/seq/file/data-class/
// proof-ref, two verdicts with basis+proof-ref, two notes.
//   ac:1.1 record: 215 chars. Same record as JSON: 481 chars.
//   chars saved vs JSON: 266 per record.
//   codebook bytes (site/AGENT-CODE.md): 6961.
//   guide bytes (site/AGENT-LANG.md): 18286.
//   converter bytes (site/agentcode.js): 69759.
//   break-even, fresh agent (codebook+guide+converter)/saving:
//     358 records (estimate).
//   break-even, agent already knowing the codebook (guide+converter)/saving:
//     331 records (estimate).
//   The saving does not vanish with the new fields, so ac:1.1 is kept;
//   keep-or-drop would otherwise have been left to the owner.
//   No ac:1.1 token-saving claim is made: tokens are unmeasured.
//   The old ac:1 example figure is NOT carried over to ac:1.1.
(function (global) {
  "use strict";

  var LEGAL_STATUS = ["todo", "doing", "verify", "done", "blocked"];
  var LEGAL_PROOF = ["code", "live", "test", "none"];
  var CANONICAL_ORDER = ["agent", "task", "status", "ctx", "in", "out",
    "verdict", "conflict", "verify", "note", "next", "done", "blocked",
    "id", "ts", "seq", "file", "data-class", "proof-ref"];
  var SINGLETON_LABELS = ["agent", "task", "status", "ctx", "in", "out",
    "next", "done", "blocked", "id", "ts", "seq", "file", "data-class", "proof-ref"];
  var REPEAT_LABELS = ["verdict", "conflict", "verify", "note"];
  var VERDICT_PAIR_KEYS = ["model", "claim", "proof", "basis", "proof-ref", "file", "fix"];

  // Secret patterns: IDENTICAL list to agentcode.js (same order, same
  // regex sources, same rule/tier). Keep both files in sync; the test
  // suite asserts deep equality. No generic high-entropy pattern here
  // (dropped: false positives). Bare email is warning tier only.
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
  function effectiveProof(v) {
    if (!v) return null;
    if (v.proof === "none" || v.basis === "logic-only") return "none";
    return v.proof;
  }

  // ---- escaping --------------------------------------------------------------
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
      if (eq <= 0) throw blocked("field-not-pair", "key=value-pairs", { field: "pair", line: lineNo });
      var k = unescapeAl(seg.slice(0, eq).trim());
      var v = unescapeAl(seg.slice(eq + 1).trim());
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        throw blocked("duplicate-field", k, { field: k, line: lineNo });
      }
      out[k] = v;
    }
    return out;
  }

  // ---- secret scan (runs FIRST, before header/structure checks) --------------
  function isCompactFirstLine(line) {
    return /^al:1\s+\S/.test(line);
  }
  function scanAlText(text) {
    var lines = String(text).split("\n");
    var warnings = [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li].trim();
      if (!line) continue;
      if (isCompactFirstLine(line)) {
        var pairs = line.slice(5).split(" | ");
        for (var pi = 0; pi < pairs.length; pi++) {
          var eq = pairs[pi].indexOf("=");
          var field = eq > 0 ? pairs[pi].slice(0, eq).trim() : "compact";
          var val = eq > 0 ? pairs[pi].slice(eq + 1).trim() : pairs[pi].trim();
          var hit = scanValue(val, field, li + 1);
          if (hit && hit.tier === "block") {
            throw blocked("secret-pattern", "public-pack-only",
              { field: hit.field, line: hit.line, rule: hit.rule });
          }
          if (hit) warnings.push("email-warning:" + field);
        }
        continue;
      }
      var colon = line.indexOf(":");
      var label = colon > 0 ? line.slice(0, colon).trim() : "line";
      var val2 = colon > 0 ? line.slice(colon + 1).trim() : line;
      var hit2 = scanValue(val2, label, li + 1);
      if (hit2 && hit2.tier === "block") {
        throw blocked("secret-pattern", "public-pack-only",
          { field: hit2.field, line: hit2.line, rule: hit2.rule });
      }
      if (hit2) warnings.push("email-warning:" + label);
    }
    return warnings;
  }
  function findSecret(text) {
    try {
      scanAlText(text);
      return null;
    } catch (e) {
      if (e.reason === "secret-pattern") {
        return { rule: e.rule, field: e.field, line: e.line };
      }
      throw e;
    }
  }

  // ---- parsing ---------------------------------------------------------------
  function parseAl(text) {
    if (typeof text !== "string" || !text.trim()) throw blocked("not-al", "al:1-first-line");
    var warnings = scanAlText(text);
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
    for (var li0 = 1; li0 < lines.length; li0++) {
      if (lines[li0].trim().indexOf("al:1") === 0) {
        throw blocked("mixed-compact-multiline", "one-form-only");
      }
    }
    var rec = { version: "al:1", verdicts: [], conflicts: [], verifies: [], notes: [] };
    var seen = {};
    for (var i = 1; i < lines.length; i++) {
      var lineNo = i + 1;
      var line = lines[i].trim();
      if (!line) continue;
      var colon = line.indexOf(":");
      if (colon <= 0) throw blocked("line-not-code-colon", "code:-value-lines", { field: "line", line: lineNo });
      var label = line.slice(0, colon).trim();
      var rest = line.slice(colon + 1).trim();
      if (CANONICAL_ORDER.indexOf(label) < 0) {
        throw blocked("unknown-label", label, { field: label, line: lineNo });
      }
      if (SINGLETON_LABELS.indexOf(label) >= 0) {
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
          if (VERDICT_PAIR_KEYS.indexOf(vk) < 0) {
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
        if (!rest) throw blocked("field-empty", "non-empty-value", { field: label, line: lineNo });
        var val = unescapeAl(rest);
        if (label === "seq") {
          if (!/^\d+$/.test(val)) {
            throw blocked("seq-malformed", "seq=non-negative-integer", { field: "seq", line: lineNo });
          }
          val = parseInt(val, 10);
        }
        if (label === "status" && LEGAL_STATUS.indexOf(val) < 0) {
          throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked", { field: "status", line: lineNo });
        }
        rec[label] = val;
      }
    }
    if (!rec.agent) throw blocked("missing-agent", "agent:-line");
    if (!rec.task) throw blocked("missing-task", "task:-line");
    if (!rec.status) throw blocked("missing-status", "status:-line");
    var tCount = (rec.next ? 1 : 0) + (rec.done ? 1 : 0) + (rec.blocked ? 1 : 0);
    if (tCount > 1) throw blocked("terminal-multiple", "one-of-next|done|blocked");
    if (tCount === 0) {
      if (rec.status !== "done" && rec.status !== "blocked") {
        throw blocked("terminal-missing", "next|done|blocked-line");
      }
    } else if (rec.next && (rec.status === "done" || rec.status === "blocked")) {
      throw blocked("terminal-status-mismatch", "next-requires-status=todo|doing|verify");
    } else if (rec.done && rec.status !== "done") {
      throw blocked("terminal-status-mismatch", "done-requires-status=done");
    } else if (rec.blocked && rec.status !== "blocked") {
      throw blocked("terminal-status-mismatch", "blocked-requires-status=blocked");
    }
    rec.warnings = warnings;
    return rec;
  }

  function analyseConflict(rec) {
    var verdicts = rec.verdicts.map(function (v, idx) {
      var canResolve = effectiveProof(v) !== "none" || !!v["proof-ref"];
      return { index: idx, effectiveProof: effectiveProof(v), canResolve: canResolve };
    });
    var flags = [];
    var conflictResolved = null;
    if (rec.conflicts.length > 0) {
      var anyResolving = false;
      for (var i = 0; i < verdicts.length; i++) {
        if (verdicts[i].canResolve) anyResolving = true;
        else flags.push("unproven-verdict-cannot-resolve");
      }
      if (verdicts.length === 0) flags.push("conflict-unresolved");
      conflictResolved = anyResolving;
    }
    return { verdicts: verdicts, flags: flags, conflictResolved: conflictResolved };
  }

  function validateAl(text) {
    try {
      var rec = parseAl(text);
      var analysis = analyseConflict(rec);
      return { valid: true, errors: [], flags: analysis.flags,
        warnings: rec.warnings || [], record: rec, analysis: analysis };
    } catch (e) {
      return { valid: false,
        errors: [{ reason: e.reason || "invalid", need: e.need || "",
          field: e.field, line: e.line, rule: e.rule }],
        flags: [], warnings: [], record: null, analysis: null };
    }
  }

  // ---- canonical form ----------------------------------------------------------
  function canonicalAl(recordOrText) {
    var rec = typeof recordOrText === "string" ? parseAl(recordOrText) : recordOrText;
    var lines = ["al:1"];
    lines.push("agent: " + escapeAlPlain(rec.agent) + (rec.role ? " | role=" + escapeAlPair(rec.role) : ""));
    lines.push("task: " + escapeAlPlain(rec.task));
    lines.push("status: " + rec.status);
    if (rec.ctx) lines.push("ctx: " + escapeAlPlain(rec.ctx));
    if (rec.in) lines.push("in: " + escapeAlPlain(rec.in));
    if (rec.out) lines.push("out: " + escapeAlPlain(rec.out));
    (rec.verdicts || []).forEach(function (v) {
      var s = "verdict: model=" + escapeAlPair(v.model) + " | claim=" + escapeAlPair(v.claim) +
        " | proof=" + v.proof;
      if (v.basis) s += " | basis=" + escapeAlPair(v.basis);
      if (v["proof-ref"]) s += " | proof-ref=" + escapeAlPair(v["proof-ref"]);
      if (v.file) s += " | file=" + escapeAlPair(v.file);
      if (v.fix) s += " | fix=" + escapeAlPair(v.fix);
      lines.push(s);
    });
    (rec.conflicts || []).forEach(function (c) {
      lines.push("conflict: a=" + escapeAlPair(c.a) + " | b=" + escapeAlPair(c.b) +
        " | resolve=" + escapeAlPair(c.resolve));
    });
    (rec.verifies || []).forEach(function (y) {
      lines.push("verify: check=" + escapeAlPair(y.check) + " | result=" + y.result);
    });
    (rec.notes || []).forEach(function (n) {
      lines.push("note: " + escapeAlPlain(n));
    });
    if (rec.next) lines.push("next: " + escapeAlPlain(rec.next));
    if (rec.done) lines.push("done: " + escapeAlPlain(rec.done));
    if (rec.blocked) {
      lines.push("blocked: reason=" + escapeAlPair(rec.blocked.reason) +
        " | need=" + escapeAlPair(rec.blocked.need));
    }
    if (rec.id) lines.push("id: " + escapeAlPlain(rec.id));
    if (rec.ts) lines.push("ts: " + escapeAlPlain(rec.ts));
    if (rec.seq !== undefined) lines.push("seq: " + escapeAlPlain(String(rec.seq)));
    if (rec.file) lines.push("file: " + escapeAlPlain(rec.file));
    if (rec["data-class"]) lines.push("data-class: " + escapeAlPlain(rec["data-class"]));
    if (rec["proof-ref"]) lines.push("proof-ref: " + escapeAlPlain(rec["proof-ref"]));
    return lines.join("\n");
  }

  // ---- ac representability -------------------------------------------------------
  // Returns null when the record can be represented in the target ac
  // version, else { reason, need }. reason is field-loss for a field with
  // no ac slot or no escaping in ac:1, and version-not-supported for
  // ac:1.1-only content (repeats, metadata, basis/proof-ref) under ac:1.
  // Check order: file/fix, then version features, then ac:1 value shapes.
  function fieldLossForAc(rec, target) {
    var verdicts = rec.verdicts || [];
    for (var i = 0; i < verdicts.length; i++) {
      if (verdicts[i].file) return { reason: "field-loss", need: "file" };
      if (verdicts[i].fix) return { reason: "field-loss", need: "fix" };
    }
    if (target === "ac:1") {
      if (verdicts.length > 1 || (rec.conflicts || []).length > 1 ||
          (rec.verifies || []).length > 1 || (rec.notes || []).length > 1) {
        return { reason: "version-not-supported", need: "ac:1.1" };
      }
      for (var bi = 0; bi < verdicts.length; bi++) {
        if (verdicts[bi].basis || verdicts[bi]["proof-ref"]) {
          return { reason: "version-not-supported", need: "ac:1.1" };
        }
      }
      if (rec.id || rec.ts || rec.seq !== undefined || rec.file ||
          rec["data-class"] || rec["proof-ref"]) {
        return { reason: "version-not-supported", need: "ac:1.1" };
      }
      var plain = [["agent", rec.agent], ["task", rec.task], ["role", rec.role],
        ["ctx", rec.ctx], ["in", rec.in], ["out", rec.out],
        ["next", rec.next], ["done", rec.done]];
      (rec.notes || []).forEach(function (n) { plain.push(["note", n]); });
      for (var pi = 0; pi < plain.length; pi++) {
        var pv = plain[pi][1];
        if (pv !== undefined && (pv.indexOf(";") >= 0 || pv.indexOf("\n") >= 0)) {
          return { reason: "field-loss", need: plain[pi][0] };
        }
      }
      var segs = [];
      verdicts.forEach(function (v) {
        segs.push(["verdict", v.model]); segs.push(["verdict", v.claim]);
      });
      (rec.conflicts || []).forEach(function (c) {
        segs.push(["conflict", c.a]); segs.push(["conflict", c.b]); segs.push(["conflict", c.resolve]);
      });
      (rec.verifies || []).forEach(function (y) { segs.push(["verify", y.check]); });
      if (rec.blocked) {
        segs.push(["blocked", rec.blocked.reason]); segs.push(["blocked", rec.blocked.need]);
      }
      for (var si2 = 0; si2 < segs.length; si2++) {
        if (segs[si2][1].indexOf(":") >= 0 || segs[si2][1].indexOf(";") >= 0) {
          return { reason: "field-loss", need: segs[si2][0] };
        }
      }
    }
    return null;
  }

  // ---- id dedup / replay -----------------------------------------------------------
  function createIdRegistry() {
    var seen = {};
    var count = 0;
    return {
      add: function (id) {
        if (seen[id]) return false; // replay: already seen, rejected
        seen[id] = true; count++;
        return true;
      },
      has: function (id) { return !!seen[id]; },
      size: function () { return count; },
    };
  }
  function dedupeIds(ids) {
    var kept = [], duplicates = [];
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      if (seen[ids[i]]) duplicates.push(ids[i]);
      else { seen[ids[i]] = true; kept.push(ids[i]); }
    }
    return { kept: kept, duplicates: duplicates };
  }

  // ---- legacy compact decoder (ONLY path for compact packs) -----------------------
  // Accepts ONLY the strict legacy grammar (see ABNF above). Returns
  // { al, warnings }. Throws on secrets, mixed forms, and invalid packs.
  // It must not be used for new records: write multi-line al:1 instead.
  function legacyExpandCompact(text) {
    if (typeof text !== "string" || !text.trim()) throw blocked("not-al", "al:1-first-line");
    var trimmed = text.trim();
    var lines = trimmed.split("\n");
    var first = lines[0].trim();
    if (!isCompactFirstLine(first)) throw blocked("not-legacy-compact", "al:1-compact-single-line");
    var hasMore = false;
    for (var mi = 1; mi < lines.length; mi++) if (lines[mi].trim()) hasMore = true;
    if (hasMore) throw blocked("mixed-compact-multiline", "one-form-only");
    // Secret scan first (pair-aware), before any expansion.
    var pairsRaw = first.slice(5).split(" | ");
    for (var pi = 0; pi < pairsRaw.length; pi++) {
      var eq0 = pairsRaw[pi].indexOf("=");
      var f0 = eq0 > 0 ? pairsRaw[pi].slice(0, eq0).trim() : "compact";
      var v0 = eq0 > 0 ? pairsRaw[pi].slice(eq0 + 1).trim() : pairsRaw[pi].trim();
      var hit0 = scanValue(v0, f0, 1);
      if (hit0 && hit0.tier === "block") {
        throw blocked("secret-pattern", "public-pack-only",
          { field: hit0.field, line: 1, rule: hit0.rule });
      }
    }
    var ALLOWED = ["agent", "task", "action", "status", "proof", "next", "done", "reason", "need"];
    var pairs = {};
    for (var i = 0; i < pairsRaw.length; i++) {
      var seg = pairsRaw[i].trim();
      if (!seg) continue;
      var eq = seg.indexOf("=");
      if (eq <= 0) throw blocked("field-not-pair", "key=value-pairs", { field: "compact", line: 1 });
      var k = seg.slice(0, eq).trim();
      var v = seg.slice(eq + 1).trim();
      if (ALLOWED.indexOf(k) < 0) throw blocked("unknown-compact-field", k, { field: k, line: 1 });
      if (!v) throw blocked("field-empty", "non-empty-value", { field: k, line: 1 });
      if (pairs[k] !== undefined) throw blocked("duplicate-field", k, { field: k, line: 1 });
      pairs[k] = v;
    }
    if (!pairs.agent) throw blocked("missing-agent", "agent=agent-id");
    var task = pairs.task;
    if (pairs.action !== undefined) {
      if (task !== undefined && task !== pairs.action) {
        throw blocked("duplicate-field", "task", { field: "task", line: 1 });
      }
      task = pairs.action;
    }
    if (!task) throw blocked("missing-task", "task=task-id");
    if (!pairs.status) throw blocked("missing-status", "status=todo|doing|verify|done|blocked");
    if (LEGAL_STATUS.indexOf(pairs.status) < 0) {
      throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked");
    }
    if (pairs.proof !== undefined && LEGAL_PROOF.indexOf(pairs.proof) < 0) {
      throw blocked("proof-not-legal", "proof=code|live|test|none");
    }
    var termCount = (pairs.next ? 1 : 0) + (pairs.done ? 1 : 0) + (pairs.reason ? 1 : 0);
    if (termCount > 1) throw blocked("terminal-multiple", "one-of-next|done|blocked");
    if (pairs.reason !== undefined && pairs.need === undefined) {
      throw blocked("blocked-incomplete", "blocked-reason=|need=");
    }
    if (termCount === 0) {
      if (pairs.status !== "done" && pairs.status !== "blocked") {
        throw blocked("terminal-missing", "next|done|blocked-pair");
      }
    } else if (pairs.next && (pairs.status === "done" || pairs.status === "blocked")) {
      throw blocked("terminal-status-mismatch", "next-requires-status=todo|doing|verify");
    } else if (pairs.done && pairs.status !== "done") {
      throw blocked("terminal-status-mismatch", "done-requires-status=done");
    } else if (pairs.reason && pairs.status !== "blocked") {
      throw blocked("terminal-status-mismatch", "blocked-requires-status=blocked");
    }
    var out = ["al:1"];
    out.push("agent: " + pairs.agent);
    out.push("task: " + task);
    out.push("status: " + pairs.status);
    if (pairs.proof !== undefined) {
      out.push("verdict: model=" + pairs.agent + " | claim=" + task + " | proof=" + pairs.proof);
    }
    if (pairs.next) out.push("next: " + pairs.next);
    if (pairs.done) out.push("done: " + pairs.done);
    if (pairs.reason) out.push("blocked: reason=" + pairs.reason + " | need=" + pairs.need);
    return {
      al: out.join("\n"),
      warnings: ["legacy-compact-expanded: this form is legacy only; write new records as multi-line al:1"],
    };
  }
  function isCompactForm(text) {
    if (typeof text !== "string") return false;
    var first = text.trim().split("\n")[0].trim();
    return isCompactFirstLine(first);
  }

  var api = {
    LEGAL_STATUS: LEGAL_STATUS, LEGAL_PROOF: LEGAL_PROOF,
    CANONICAL_ORDER: CANONICAL_ORDER,
    getSecretPatterns: getSecretPatterns, findSecret: findSecret,
    effectiveProof: effectiveProof,
    escapeAlPair: escapeAlPair, escapeAlPlain: escapeAlPlain, unescapeAl: unescapeAl,
    parseAl: parseAl, validateAl: validateAl, canonicalAl: canonicalAl,
    fieldLossForAc: fieldLossForAc,
    createIdRegistry: createIdRegistry, dedupeIds: dedupeIds,
    legacyExpandCompact: legacyExpandCompact, isCompactForm: isCompactForm,
  };
  global.AgentLang = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
