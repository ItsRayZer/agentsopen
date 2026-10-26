// v74 fix layer — ChatGPT + Gemini + Grok review fixes (LOCAL, no keys, no live calls).
// Pure functions, Node-compatible (UMD). This file does NOT replace app.js/v7.js
// validators; it adds the hardened rules those validators must follow:
//  - backslash escaping for | : = newline backslash in al:1/ac:1 values
//  - canonical key order so hashes/diffs are stable
//  - SHA-256 (pure JS, verified against Node crypto in tests) for approval
//    binding and audit hash-chaining — NOT a signature, NOT auth, NOT a key.
//  - budget planner, snapshot export/import, search pagination helpers.
// Token numbers: always bytes + chars + estimated tokens together, estimate only.
(function (global) {
  "use strict";
  // ---- SHA-256 (pure JS) ----
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256Hex(str) {
    var bytes = [];
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
      else if (c < 55296 || c >= 57344) { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
      else { i++; var cp = 65536 + ((c - 55296) << 10) + (s.charCodeAt(i) - 56320); bytes.push(240 | (cp >> 18), 128 | ((cp >> 12) & 63), 128 | ((cp >> 6) & 63), 128 | (cp & 63)); }
    }
    var bitLen = bytes.length * 8;
    bytes.push(128);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    for (var j = 7; j >= 0; j--) bytes.push((bitLen / Math.pow(2, j * 8)) & 255);
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (var t = 0; t < 16; t++) w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) | (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t-15], 7) ^ rotr(w[t-15], 18) ^ (w[t-15] >>> 3);
        var s1 = rotr(w[t-2], 17) ^ rotr(w[t-2], 19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
      }
      var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh=g; g=f; f=e; e=(d + t1) | 0; d=c; c=b; b=a; a=(t1 + t2) | 0;
      }
      h[0]=(h[0]+a)|0; h[1]=(h[1]+b)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0; h[4]=(h[4]+e)|0; h[5]=(h[5]+f)|0; h[6]=(h[6]+g)|0; h[7]=(h[7]+hh)|0;
    }
    var out = "";
    for (var k = 0; k < 8; k++) out += ("00000000" + (h[k] >>> 0).toString(16)).slice(-8);
    return out;
  }
  // ---- Escaping (al:1 / ac:1 values) ----
  // Escape \ first, then | : = and newline. Unescape in reverse order.
  // This is the ONLY escaping rule; the old Talk "/" substitution is retired.
  function escapeAlValue(v) {
    return String(v == null ? "" : v)
      .replace(/\\/g, "\\\\")
      .replace(/\|/g, "\\|")
      .replace(/:/g, "\\:")
      .replace(/=/g, "\\=")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }
  function unescapeAlValue(v) {
    var out = "", i = 0, s = String(v == null ? "" : v);
    while (i < s.length) {
      if (s[i] === "\\" && i + 1 < s.length) {
        var n = s[i + 1];
        out += (n === "n" ? "\n" : n === "r" ? "\r" : n);
        i += 2;
      } else { out += s[i]; i++; }
    }
    return out;
  }
  // Split on unescaped " | " (pipe separators, not escaped \|).
  function splitUnescapedPipe(s) {
    var parts = [], cur = "", i = 0;
    s = String(s);
    while (i < s.length) {
      if (s[i] === "\\" && i + 1 < s.length) { cur += s[i] + s[i + 1]; i += 2; continue; }
      if (s.slice(i, i + 3) === " | ") { parts.push(cur); cur = ""; i += 3; continue; }
      cur += s[i]; i++;
    }
    parts.push(cur);
    return parts;
  }
  // Canonical key order for al:1 records (hash/diff stability).
  var CANON_ORDER = ["agent", "task", "status", "ctx", "in", "out", "verdict", "conflict", "verify", "note", "next", "done", "blocked", "id", "ts", "seq", "file", "data-class", "proof-ref"];
  function canonicalAlLines(obj) {
    // obj: {code: value|[values]} — values are raw (unescaped) strings.
    var lines = ["al:1"];
    CANON_ORDER.forEach(function (code) {
      if (obj[code] == null) return;
      var vals = Array.isArray(obj[code]) ? obj[code] : [obj[code]];
      vals.forEach(function (v) { lines.push(code + ": " + escapeAlValue(v)); });
    });
    Object.keys(obj).forEach(function (code) {
      if (CANON_ORDER.indexOf(code) < 0) {
        var vals = Array.isArray(obj[code]) ? obj[code] : [obj[code]];
        vals.forEach(function (v) { lines.push(code + ": " + escapeAlValue(v)); });
      }
    });
    return lines;
  }
  function sizeReport(text) {
    var s = String(text == null ? "" : text);
    return { bytes: s.length, chars: s.length, note: "chars-only | tokens=not-measured" };
  }
  function charsSaved(shortText, referenceText) {
    return String(referenceText).length - String(shortText).length;
  }
  function breakEvenMessages(codebookChars, savedCharsPerMessage) {
    if (!savedCharsPerMessage || savedCharsPerMessage <= 0) return null;
    return Math.ceil(codebookChars / savedCharsPerMessage);
  }
  // ---- Approval binding + audit hash chain ----
  // Approval is NOT auth and NOT a signature: it is a hash-bound record the
  // owner can return through his own channel (chat), verifiable by any agent
  // against the exact artifact + version + scope + expires. No key, no login.
  function approvalRecord(opts) {
    // Portable hash-bound approval record (team-round resolution):
    // {id, targetId, contentHash, scope, expiry, decision, ownerAgentLabel, hash}
    // where hash = sha256(targetId|contentHash|scope|expiry|decision).
    // An owner go-ahead in chat CREATES this record; it does not replace
    // the go-ahead. Verifiable offline by recomputing the hash. No login,
    // no key, no paid service. Existing gates are advisory until they
    // check this record — relabelled as such in specs.
    var o = opts || {};
    if (!o.targetId || !o.contentHash || !o.scope || !o.expiry || !o.decision) return { blocked: "reason=approval-incomplete | need=targetId+contentHash+scope+expiry+decision" };
    var hash = sha256Hex(o.targetId + "|" + o.contentHash + "|" + o.scope + "|" + o.expiry + "|" + o.decision);
    return { id: o.id || ("appr-" + hash.slice(0, 16)), targetId: o.targetId, contentHash: o.contentHash, scope: o.scope, expiry: o.expiry, decision: o.decision, ownerAgentLabel: o.ownerAgentLabel || "owner-in-chat", hashAlgorithm: "sha256", hash: hash };
  }
  function approvalValid(rec) {
    if (!rec || rec.hashAlgorithm !== "sha256" || !/^[0-9a-f]{64}$/.test(rec.hash || "")) return false;
    return rec.hash === sha256Hex(rec.targetId + "|" + rec.contentHash + "|" + rec.scope + "|" + rec.expiry + "|" + rec.decision);
  }
  // Audit: each event carries prev-hash + its own hash, so an exported log
  // verifies even though localStorage itself is erasable (erasure is
  // detectable as a missing link, not prevented — local checks are advisory).
  function auditAppend(log, ev) {
    var prev = (log && log.length) ? log[log.length - 1].hash : "0000000000000000000000000000000000000000000000000000000000000000";
    var entry = { id: ev.id, kind: ev.kind, detail: ev.detail, ts: ev.ts || "", prevHash: prev };
    entry.hash = sha256Hex(prev + "|" + entry.id + "|" + entry.kind + "|" + entry.detail + "|" + entry.ts);
    return (log || []).concat([entry]);
  }
  function auditVerify(log) {
    var prev = "0000000000000000000000000000000000000000000000000000000000000000";
    for (var i = 0; i < (log || []).length; i++) {
      var e = log[i];
      if (e.prevHash !== prev) return { ok: false, brokenAt: i, reason: "prev-hash-mismatch" };
      var expect = sha256Hex(prev + "|" + e.id + "|" + e.kind + "|" + e.detail + "|" + e.ts);
      if (e.hash !== expect) return { ok: false, brokenAt: i, reason: "event-hash-mismatch" };
      prev = e.hash;
    }
    return { ok: true, events: (log || []).length };
  }
  // ---- Budget planner: budget -> ordered file list + cut manifest ----
  function budgetPlan(files, budgetChars) {
    // files: [{file, bytes, priority}] in priority order already.
    var out = [], cut = [], used = 0;
    (files || []).forEach(function (f) {
      if (used + f.bytes <= budgetChars) { out.push(f.file); used += f.bytes; }
      else cut.push(f.file);
    });
    return { included: out, cut: cut, usedChars: used, budgetChars: budgetChars, note: "priority-order | cut-list-is-the-manifest | fetch-cut-files-by-url" };
  }
  // ---- Snapshot export/import (whole workspace, one file) ----
  // Snapshot secret scan (hygiene only, mirror of site/secret-patterns.json
  // block tier; reports key + field, never values).
  var SNAPSHOT_BLOCK_PATTERNS = [
    { field: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { field: "openai-key", re: /\bsk-[A-Za-z0-9]{12,}/ },
    { field: "stripe-key", re: /\bsk_(live|test)_[A-Za-z0-9]{8,}/ },
    { field: "github-token", re: /\bgh[pous]_[A-Za-z0-9]{20,}/ },
    { field: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}/ },
    { field: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
    { field: "jwt", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
    { field: "api-key-assignment", re: /\bapi[_-]?key\s*[:=]\s*\S+/i },
    { field: "access-token-assignment", re: /\b(access[_-]?token|client[_-]?secret)\s*[:=]\s*\S+/i },
    { field: "password-assignment", re: /\bpassword\s*[:=]\s*\S+/i },
    { field: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._-]{12,}/ }
  ];
  function snapshotExport(stores) {
    var payload = { version: "v74-snapshot-1", stores: stores || {} };
    var hash = sha256Hex(JSON.stringify(payload));
    var text = JSON.stringify({ version: payload.version, stores: payload.stores, hash: hash });
    return { text: text, hash: hash, bytes: text.length, note: "version+checksum | all-localStorage-keys | import-validates-hash-first | dry-run-diff-available" };
  }
  function snapshotImport(text) {
    try {
      var obj = JSON.parse(text);
      if (obj.version !== "v74-snapshot-1") return { error: "snapshot-version-mismatch" };
      if (typeof obj.hash !== "string") return { error: "snapshot-hash-missing" };
      var expect = sha256Hex(JSON.stringify({ version: obj.version, stores: obj.stores || {} }));
      if (expect !== obj.hash) return { error: "snapshot-hash-mismatch" };
      var stores = obj.stores || {};
      var warnings = [];
      Object.keys(stores).forEach(function (key) {
        var val = JSON.stringify(stores[key]);
        SNAPSHOT_BLOCK_PATTERNS.forEach(function (pat) {
          if (pat.re.test(val)) warnings.push({ key: key, field: pat.field });
        });
      });
      return { stores: stores, ok: true, warnings: warnings };
    } catch (e) { return { error: "snapshot-not-json" }; }
  }
  // Dry-run diff for snapshot import: keys only, never values.
  function snapshotDiff(oldStores, newStores) {
    var a = oldStores || {}, b = newStores || {};
    var added = [], removed = [], changed = [];
    Object.keys(b).forEach(function (k) {
      if (!(k in a)) added.push(k);
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
    });
    Object.keys(a).forEach(function (k) { if (!(k in b)) removed.push(k); });
    return { added: added, removed: removed, changed: changed, note: "dry-run-only | keys-only | nothing-applied" };
  }
  // ---- Search pagination (shared by agentmode search + /search format) ----
  function paginate(results, cursor, pageSize) {
    var size = pageSize || 20;
    var start = 0;
    if (cursor) { var n = parseInt(cursor, 10); if (!isNaN(n) && n >= 0) start = n; }
    var sorted = (results || []).slice().sort(function (a, b) {
      return String(a.task || "").localeCompare(String(b.task || "")) || String(a.agent || "").localeCompare(String(b.agent || ""));
    });
    var page = sorted.slice(start, start + size);
    var next = (start + size < sorted.length) ? String(start + size) : null;
    return { results: page, total: sorted.length, shown: page.length, cursor: cursor || "0", nextCursor: next, sort: "task,agent", pageSize: size };
  }
  var api = {
    sha256Hex: sha256Hex, escapeAlValue: escapeAlValue, unescapeAlValue: unescapeAlValue,
    splitUnescapedPipe: splitUnescapedPipe, canonicalAlLines: canonicalAlLines, CANON_ORDER: CANON_ORDER,
    sizeReport: sizeReport, charsSaved: charsSaved, breakEvenMessages: breakEvenMessages, approvalRecord: approvalRecord, approvalValid: approvalValid,
    auditAppend: auditAppend, auditVerify: auditVerify, budgetPlan: budgetPlan,
    snapshotExport: snapshotExport, snapshotImport: snapshotImport, snapshotDiff: snapshotDiff, paginate: paginate
  };
  global.V74 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
