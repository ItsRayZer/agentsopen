// AgentCode ac:1 — converter for AI Workspace.
// Node-compatible, no dependencies. UMD: module.exports + globalThis.AgentCode.
// AgentCode is a CODE language for agents only: dense tokens, no prose.
// It is NOT encrypted and NOT secret: AGENT-CODE.md is the public codebook,
// and this converter lets any agent — and the owner — decode it on demand.
// Proof is never faked. Secrets are blocked, never passed through.
(function (global) {
  "use strict";

  var STATUS_TO_CODE = { todo: "td", doing: "dg", verify: "vf", done: "dn", blocked: "bl" };
  var CODE_TO_STATUS = { td: "todo", dg: "doing", vf: "verify", dn: "done", bl: "blocked" };
  var PROOF_TO_CODE = { code: "cd", live: "lv", test: "ts", none: "nn" };
  var CODE_TO_PROOF = { cd: "code", lv: "live", ts: "test", nn: "none" };

  // Field codes: 1-2 letters only. See AGENT-CODE.md for the full codebook.
  // a agent | ro role | t task | s status | x ctx | i in | o out
  // v verdict | f conflict | n next | d done | b blocked | y verify | nt note
  var KNOWN_CODES = ["a", "ro", "t", "s", "x", "i", "o", "v", "f", "n", "d", "b", "y", "nt"];

  var SECRET_PATTERNS = [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9]{16,}/,
    /\bghp_[A-Za-z0-9]{20,}/,
    /\bapi[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /\bpassword\s*[:=]\s*\S+/i,
    /\bBearer\s+[A-Za-z0-9._-]{20,}/,
  ];

  function blocked(reason, need) {
    var e = new Error("blocked: reason=" + reason + " | need=" + need);
    e.reason = reason; e.need = need; e.blocked = true;
    return e;
  }
  function checkSecrets(text) {
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      if (SECRET_PATTERNS[i].test(text)) throw blocked("secret-pattern", "public-pack-only");
    }
  }
  function parsePairs(text) {
    // "k=v | k=v" -> {k: v}. Values may not contain " | ".
    var out = {};
    var parts = String(text).split(" | ");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      var eq = p.indexOf("=");
      if (eq > 0) out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
    return out;
  }
  function statusCode(full) {
    return STATUS_TO_CODE[String(full || "").trim()] || null;
  }
  function proofCode(full) {
    return PROOF_TO_CODE[String(full || "").trim()] || null;
  }

  // ---- ac:1 parsing -------------------------------------------------------
  // One record, one line. Fields separated by ";", each "code=value".
  // Terminal rule: last field must be n/d/b with a consistent status,
  // OR the record is a compact end-state: s=dn/bl with no terminal field
  // (mirrors the AgentLang compact end-state exception).
  function parseAc(text) {
    if (typeof text !== "string" || !text.trim()) throw blocked("not-ac", "ac:1-first-token");
    checkSecrets(text);
    var line = text.trim();
    var parts = line.split(";");
    if (parts[0].trim() !== "ac:1") throw blocked("not-ac", "ac:1-first-token");
    var rec = { warnings: [] };
    var order = [];
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var eq = p.indexOf("=");
      if (eq <= 0) throw blocked("field-not-code-equals", "code=value-fields");
      var code = p.slice(0, eq).trim();
      var value = p.slice(eq + 1).trim();
      if (!value) throw blocked("field-empty", "non-empty-value");
      if (KNOWN_CODES.indexOf(code) < 0) { rec.warnings.push("unknown-code-ignored:" + code); continue; }
      rec[code] = value; order.push(code);
    }
    if (!rec.a) throw blocked("missing-agent", "a=agent-id");
    if (!rec.t) throw blocked("missing-task", "t=task-id");
    if (!rec.s) throw blocked("missing-status", "s=td|dg|vf|dn|bl");
    if (!CODE_TO_STATUS[rec.s]) throw blocked("status-not-legal", "s=td|dg|vf|dn|bl");
    var last = order[order.length - 1];
    if (last === "n" || last === "d" || last === "b") {
      if (last === "d" && rec.s !== "dn") throw blocked("terminal-status-mismatch", "d-requires-s=dn");
      if (last === "b" && rec.s !== "bl") throw blocked("terminal-status-mismatch", "b-requires-s=bl");
      if (last === "n" && (rec.s === "dn" || rec.s === "bl")) throw blocked("terminal-status-mismatch", "n-requires-s=td|dg|vf");
    } else if (rec.s === "dn" || rec.s === "bl") {
      // Compact end-state: allowed, no terminal field required.
    } else {
      throw blocked("terminal-missing", "last-field-n|d|b");
    }
    rec._order = order;
    return rec;
  }

  function validateAc(text) {
    try { parseAc(text); return null; }
    catch (e) { return e.reason || "invalid"; }
  }

  // ---- ac:1 -> al:1 -------------------------------------------------------
  function acToAl(text) {
    var r = parseAc(text);
    var lines = ["al:1"];
    lines.push("agent: " + r.a + (r.ro ? " | role=" + r.ro : ""));
    lines.push("task: " + r.t);
    lines.push("status: " + CODE_TO_STATUS[r.s]);
    if (r.x) lines.push("ctx: " + r.x);
    if (r.i) lines.push("in: " + r.i);
    if (r.o) lines.push("out: " + r.o);
    if (r.v) {
      var vp = r.v.split(":");
      if (vp.length !== 3 || !CODE_TO_PROOF[vp[2]]) throw blocked("verdict-malformed", "v=model:claim:proof-code");
      lines.push("verdict: model=" + vp[0] + " | claim=" + vp[1] + " | proof=" + CODE_TO_PROOF[vp[2]]);
    }
    if (r.f) {
      var fp = r.f.split(":");
      if (fp.length !== 3) throw blocked("conflict-malformed", "f=a:b:resolve");
      lines.push("conflict: a=" + fp[0] + " | b=" + fp[1] + " | resolve=" + fp[2]);
    }
    if (r.y) {
      var yp = r.y.split(":");
      if (yp.length !== 2) throw blocked("verify-malformed", "y=check:pass|fail");
      lines.push("verify: check=" + yp[0] + " | result=" + yp[1]);
    }
    if (r.nt) lines.push("note: " + r.nt);
    if (r.n) lines.push("next: " + r.n);
    if (r.d) lines.push("done: " + r.d);
    if (r.b) {
      var bp = r.b.split(":");
      if (bp.length !== 2) throw blocked("blocked-malformed", "b=reason:need");
      lines.push("blocked: reason=" + bp[0] + " | need=" + bp[1]);
    }
    // Compact end-state: emit the compact single-line al:1 form, so a
    // Cloud single-line pack round-trips exactly.
    if (!r.n && !r.d && !r.b) {
      return "al:1 agent=" + r.a + " | task=" + r.t + " | status=" + CODE_TO_STATUS[r.s];
    }
    return lines.join("\n");
  }

  // ---- al:1 -> ac:1 -------------------------------------------------------
  function alToAc(text) {
    if (typeof text !== "string" || !text.trim()) throw blocked("not-al", "al:1-first-line");
    checkSecrets(text);
    var trimmed = text.trim();
    // Compact single-line form: "al:1 agent=.. | task=.. | status=.."
    if (trimmed.indexOf("\n") < 0 && trimmed.indexOf("al:1 ") === 0) {
      var pairs = parsePairs(trimmed.slice(5));
      var agent = pairs.agent, task = pairs.task || pairs.action, st = pairs.status;
      if (!agent) throw blocked("missing-agent", "agent=agent-id");
      if (!task) throw blocked("missing-task", "task=task-id");
      var sc = statusCode(st);
      if (!sc) throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked");
      var out = "ac:1;a=" + agent + ";t=" + task + ";s=" + sc;
      if (pairs.proof) {
        var pc = proofCode(pairs.proof);
        if (!pc) throw blocked("proof-not-legal", "proof=code|live|test|none");
        out += ";v=" + agent + ":" + task + ":" + pc;
      }
      if (pairs.next) out += ";n=" + pairs.next;
      if (pairs.done) out += ";d=" + pairs.done;
      if (pairs.reason) out += ";b=" + pairs.reason + ":" + (pairs.need || "unspecified");
      return out;
    }
    var lines = trimmed.split("\n");
    if (lines[0].trim() !== "al:1") throw blocked("not-al", "al:1-first-line");
    var rec = {};
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var colon = line.indexOf(":");
      if (colon <= 0) throw blocked("line-not-code-colon", "code:-value-lines");
      var code = line.slice(0, colon).trim();
      var value = line.slice(colon + 1).trim();
      rec[code] = value;
    }
    if (!rec.agent) throw blocked("missing-agent", "agent:-line");
    if (!rec.task) throw blocked("missing-task", "task:-line");
    var sc2 = statusCode(rec.status);
    if (!sc2) throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked");
    var agentId = rec.agent.split(" | ")[0].trim();
    var taskId = rec.task.split(" | ")[0].trim();
    var role = null;
    var rp = parsePairs(rec.agent);
    if (rp.role) role = rp.role;
    var fields = ["ac:1", "a=" + agentId];
    if (role) fields.push("ro=" + role);
    fields.push("t=" + taskId, "s=" + sc2);
    if (rec.ctx) fields.push("x=" + rec.ctx);
    if (rec.in) fields.push("i=" + rec.in);
    if (rec.out) fields.push("o=" + rec.out);
    if (rec.verdict) {
      var vp = parsePairs(rec.verdict);
      if (!vp.model || !vp.claim || !vp.proof) throw blocked("verdict-incomplete", "verdict-model=|claim=|proof=");
      var vpc = proofCode(vp.proof);
      if (!vpc) throw blocked("proof-not-legal", "proof=code|live|test|none");
      fields.push("v=" + vp.model + ":" + vp.claim + ":" + vpc);
    }
    if (rec.conflict) {
      var fp = parsePairs(rec.conflict);
      if (!fp.a || !fp.b || !fp.resolve) throw blocked("conflict-incomplete", "conflict-a=|b=|resolve=");
      fields.push("f=" + fp.a + ":" + fp.b + ":" + fp.resolve);
    }
    if (rec.verify) {
      var yp = parsePairs(rec.verify);
      if (!yp.check || !yp.result) throw blocked("verify-incomplete", "verify-check=|result=");
      fields.push("y=" + yp.check + ":" + yp.result);
    }
    if (rec.note) fields.push("nt=" + rec.note);
    if (rec.next) fields.push("n=" + rec.next);
    if (rec.done) fields.push("d=" + rec.done);
    if (rec.blocked) {
      var bp = parsePairs(rec.blocked);
      if (!bp.reason || !bp.need) throw blocked("blocked-incomplete", "blocked-reason=|need=");
      fields.push("b=" + bp.reason + ":" + bp.need);
    }
    return fields.join(";");
  }

  // ---- ac:1 -> JSON / JSON -> ac:1 ---------------------------------------
  function acToJson(text) {
    var r = parseAc(text);
    var obj = { lang: "ac:1", agent: r.a, task: r.t, status: CODE_TO_STATUS[r.s] };
    if (r.ro) obj.role = r.ro;
    if (r.x) obj.ctx = r.x;
    if (r.i) obj.in = r.i;
    if (r.o) obj.out = r.o;
    if (r.v) {
      var vp = r.v.split(":");
      obj.verdict = { model: vp[0], claim: vp[1], proof: CODE_TO_PROOF[vp[2]] };
    }
    if (r.f) {
      var fp = r.f.split(":");
      obj.conflict = { a: fp[0], b: fp[1], resolve: fp[2] };
    }
    if (r.y) {
      var yp = r.y.split(":");
      obj.verify = { check: yp[0], result: yp[1] };
    }
    if (r.nt) obj.note = r.nt;
    if (r.n) obj.next = r.n;
    if (r.d) obj.done = r.d;
    if (r.b) {
      var bp = r.b.split(":");
      obj.blocked = { reason: bp[0], need: bp[1] };
    }
    return obj;
  }

  function jsonToAc(obj) {
    if (!obj || typeof obj !== "object") throw blocked("json-not-object", "json-object-with-agent-task-status");
    checkSecrets(JSON.stringify(obj));
    if (!obj.agent) throw blocked("missing-agent", "agent-field");
    if (!obj.task) throw blocked("missing-task", "task-field");
    var sc = STATUS_TO_CODE[obj.status] || (CODE_TO_STATUS[obj.status] ? obj.status : null);
    if (!sc) throw blocked("status-not-legal", "status=todo|doing|verify|done|blocked");
    var fields = ["ac:1", "a=" + obj.agent];
    if (obj.role) fields.push("ro=" + obj.role);
    fields.push("t=" + obj.task, "s=" + sc);
    if (obj.ctx) fields.push("x=" + obj.ctx);
    if (obj.in) fields.push("i=" + obj.in);
    if (obj.out) fields.push("o=" + obj.out);
    if (obj.verdict) {
      if (!obj.verdict.model || !obj.verdict.claim || !obj.verdict.proof) throw blocked("verdict-incomplete", "verdict-model-claim-proof");
      var pc = proofCode(obj.verdict.proof);
      if (!pc) throw blocked("proof-not-legal", "proof=code|live|test|none");
      fields.push("v=" + obj.verdict.model + ":" + obj.verdict.claim + ":" + pc);
    }
    if (obj.conflict) fields.push("f=" + obj.conflict.a + ":" + obj.conflict.b + ":" + obj.conflict.resolve);
    if (obj.verify) fields.push("y=" + obj.verify.check + ":" + obj.verify.result);
    if (obj.note) fields.push("nt=" + obj.note);
    if (obj.next) fields.push("n=" + obj.next);
    if (obj.done) fields.push("d=" + obj.done);
    if (obj.blocked) fields.push("b=" + obj.blocked.reason + ":" + obj.blocked.need);
    return fields.join(";");
  }

  var api = {
    STATUS_TO_CODE: STATUS_TO_CODE, CODE_TO_STATUS: CODE_TO_STATUS,
    PROOF_TO_CODE: PROOF_TO_CODE, CODE_TO_PROOF: CODE_TO_PROOF,
    parseAc: parseAc, validateAc: validateAc,
    acToAl: acToAl, alToAc: alToAc,
    acToJson: acToJson, jsonToAc: jsonToAc,
  };
  global.AgentCode = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
