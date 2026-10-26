// integration.js — integration-build helpers (2026-10-26, LOCAL ONLY).
// Standalone UMD utility, like agentlang.js: no dependency on any other
// workspace file, no network, no keys, no execution of pack code.
// Every new pack shape below is carried in canonical al:1 note: lines,
// so packs stay valid under agentlang.js with NO grammar change.
// These helpers do NOT replace agentlang.js validation, the secret scan,
// or the proof rule — they are named gates that re-state those rules
// in one place (guardrails), plus replay/profile/flow/session/eval
// shapes for the integration build. A helper returning
// {blocked: "reason=... | need=..."} means the pack must not be trusted
// as done; it never deletes, publishes, or executes anything.
(function (global) {
  "use strict";

  function lines(text) {
    return String(text || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function notes(text) {
    return lines(text).filter(function (l) { return l.indexOf("note: ") === 0; }).map(function (l) { return l.slice(6); });
  }
  function noteValue(text, key) {
    // note: key=value | other=...  — first match wins.
    var out = null;
    notes(text).forEach(function (n) {
      n.split(" | ").forEach(function (part) {
        var eq = part.indexOf("=");
        if (eq > 0 && part.slice(0, eq).trim() === key && out === null) out = part.slice(eq + 1).trim();
      });
    });
    return out;
  }
  function hasLine(text, prefix) {
    return lines(text).some(function (l) { return l.indexOf(prefix) === 0; });
  }
  function blocked(reason, need) { return { blocked: "reason=" + reason + " | need=" + need }; }
  function ok(extra) {
    var o = { ok: true };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  // --- Guardrails (feature 7) -------------------------------------------
  // Block-tier patterns mirror site/secret-patterns.json by rule name;
  // the canonical table is the source, this list is a mirror for the
  // guardrail gate only (integration test checks the rule names exist
  // in secret-patterns.json).
  var BLOCK_RES = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9]{12,}/,
    /\bsk_(live|test)_[A-Za-z0-9]{8,}/,
    /\bgh[pous]_[A-Za-z0-9]{20,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /\bapi[_-]?key\s*[:=]\s*\S+/i,
    /\b(access[_-]?token|client[_-]?secret)\s*[:=]\s*\S+/i,
    /\bpassword\s*[:=]\s*\S+/i,
    /\bBearer\s+[A-Za-z0-9._-]{12,}/
  ];
  function checkGuardrail(packText) {
    var t = String(packText || "");
    for (var i = 0; i < BLOCK_RES.length; i++) {
      if (BLOCK_RES[i].test(t)) return blocked("guardrail-tripwire", "remove-secret-value");
    }
    var dc = t.match(/^data-class:\s*(\S+)/m);
    if (dc && dc[1] !== "public") return blocked("guardrail-tripwire", "data-class: public-or-no-data-class-line");
    // Proof rule, re-stated: a pack that claims done with proof=none
    // trips the guardrail (agentlang.js enforces the same rule for
    // conflict-resolving verdicts; this gate covers done claims).
    if (/^status: done$/m.test(t) && /proof=none/.test(t)) return blocked("guardrail-tripwire", "proof=none-cannot-mark-done");
    return ok({ guardrail: "pass" });
  }

  // --- Graph checkpoints + rewind replay (feature 8) ---------------------
  // packs: array of al:1 pack texts. A checkpoint is a note: line
  // "checkpoint=<id>". Replay returns the suffix from the checkpoint
  // pack onward, byte-joined with "\n---\n" separators, so a replay
  // from the same checkpoint always reproduces the same bytes.
  function graphReplay(packs, checkpointId) {
    if (!checkpointId) return blocked("checkpoint-not-found", "checkpoint-id");
    var idx = -1;
    for (var i = 0; i < packs.length; i++) {
      if (noteValue(packs[i], "checkpoint") === checkpointId) { idx = i; break; }
    }
    if (idx < 0) return blocked("checkpoint-not-found", "checkpoint-id=" + checkpointId);
    return ok({ checkpoint: checkpointId, count: packs.length - idx, replayed: packs.slice(idx).join("\n---\n") });
  }

  // --- Agent profiles + flow packs (feature 9) ---------------------------
  // New profiles (created after the integration build) must carry
  // role + goal + backstory. Legacy example_row in agents.json is
  // grandfathered (marked example_only) and is NOT validated here.
  function validateAgentProfile(profile) {
    if (!profile || typeof profile !== "object") return blocked("profile-invalid", "profile-object");
    if (!profile.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(profile.id)) return blocked("profile-id-invalid", "id-kebab-case");
    if (!profile.role) return blocked("profile-role-missing", "role=string");
    if (!profile.goal) return blocked("profile-goal-missing", "goal=string");
    if (!profile.backstory) return blocked("profile-backstory-missing", "backstory=string");
    return ok({ id: profile.id });
  }
  function validateFlowPack(packText) {
    var t = String(packText || "");
    var steps = [];
    notes(t).forEach(function (n) {
      var step = noteValue("note: " + n, "step");
      var kind = noteValue("note: " + n, "kind");
      if (step !== null) steps.push({ step: step, kind: kind });
    });
    if (!steps.length) return blocked("flow-no-steps", "note: step=<n> | kind=deterministic|agent");
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].kind !== "deterministic" && steps[i].kind !== "agent") return blocked("flow-kind-invalid", "kind=deterministic|agent");
      if (steps[i].kind === "agent" && noteValue(t, "role") === null) return blocked("flow-agent-step-role-missing", "note: role=<role> for agent steps");
    }
    return ok({ steps: steps.length });
  }

  // --- Session + evaluation packs (feature 10) ---------------------------
  // Session user labels must be local labels only, never an account
  // identifier: an email-shaped value, or a value containing "@", fails.
  function validateSessionPack(packText) {
    var t = String(packText || "");
    var session = noteValue(t, "session");
    var app = noteValue(t, "app");
    var user = noteValue(t, "user");
    var turns = noteValue(t, "turns");
    if (session === null) return blocked("session-id-missing", "note: session=<id>");
    if (app !== "ai-workspace") return blocked("session-app-mismatch", "note: app=ai-workspace");
    if (user === null) return blocked("session-user-missing", "note: user=local-label-only");
    if (user.indexOf("@") >= 0 || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(user)) return blocked("session-user-account-like", "note: user=local-label-only-never-an-account-id");
    if (turns === null || !/^\d+$/.test(turns)) return blocked("session-turns-invalid", "note: turns=<non-negative-integer>");
    return ok({ session: session, turns: parseInt(turns, 10) });
  }
  function validateEvaluationPack(packText) {
    var t = String(packText || "");
    var schema = noteValue(t, "schema");
    var required = noteValue(t, "required");
    var claimed = noteValue(t, "schema-valid");
    // output: is carried on an out: line as JSON (canonical label).
    var outLine = null;
    lines(t).forEach(function (l) { if (l.indexOf("out: ") === 0) outLine = l.slice(5); });
    if (schema === null) return blocked("eval-schema-missing", "note: schema=<schema-id>");
    if (outLine === null) return blocked("eval-output-missing", "out: <json>");
    var obj;
    try { obj = JSON.parse(outLine); } catch (e) { return blocked("eval-output-not-json", "out: valid-json"); }
    if (required === null) return blocked("eval-required-missing", "note: required=<comma-keys>");
    var keys = required.split(",").map(function (k) { return k.trim(); }).filter(Boolean);
    var missing = keys.filter(function (k) { return !(k in obj); });
    var computed = missing.length ? "fail" : "pass";
    if (claimed !== null && claimed !== computed) return blocked("schema-valid-mismatch", "note: schema-valid=" + computed);
    if (computed === "fail") return blocked("schema-valid-fail", "missing-keys=" + missing.join(","));
    return ok({ schema: schema, computed: computed });
  }

  // --- Board (cloud communication, owner decision 2026-10-26) ---------
  // Board messages are ORDINARY public packs in the existing Cloud pack
  // store — no new store, no new Worker endpoint, no private messages,
  // no push. A thread is a set of packs sharing note: thread=<id>; a
  // reply carries note: reply-to=<root-pack-id>, a root carries
  // reply-to=none. Threads are listed with the existing Worker v2
  // GET /search?q=thread=<id> (search matches pack bodies), then each
  // pack is read with the existing GET /packs/<id>. The author is a
  // display label ONLY, never identity proof: anyone can use any name.
  // A name alone never deletes: delete needs the publish receipt's
  // delete token, exactly as Worker v2 requires for every pack.
  var BOARD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var BOARD_MAX_MESSAGE = 8000;
  function boardAuthorName(name) {
    var n = String(name == null ? "" : name).trim();
    if (!n) return blocked("board-author-missing", "board-name=<display-label>");
    if (n.length > 64) return blocked("board-author-too-long", "board-name-max-64-chars");
    if (n.indexOf("@") >= 0 || n.indexOf("|") >= 0 || /[\r\n]/.test(n)) return blocked("board-author-invalid", "board-name-no-at-no-pipe-no-newline");
    return ok({ author: n });
  }
  function boardMessageText(message) {
    var m = String(message == null ? "" : message).trim();
    if (!m) return blocked("board-message-missing", "board-message=<text>");
    if (/[\r\n]/.test(m)) return blocked("board-message-multiline", "board-message-single-line");
    if (m.length > BOARD_MAX_MESSAGE) return blocked("board-message-too-long", "board-message-max-8000-chars");
    return ok({ message: m });
  }
  function buildBoardPack(opts) {
    opts = opts || {};
    var a = boardAuthorName(opts.author);
    if (a.blocked) return a;
    if (!opts.thread || !BOARD_ID_RE.test(opts.thread)) return blocked("board-thread-invalid", "thread=<a-z-0-9-dash-underscore-max-64>");
    var replyTo = opts.replyTo == null || opts.replyTo === "" ? "none" : opts.replyTo;
    if (replyTo !== "none" && !BOARD_ID_RE.test(replyTo)) return blocked("board-reply-to-invalid", "reply-to=<pack-id-or-none>");
    var m = boardMessageText(opts.message);
    if (m.blocked) return m;
    var pack = [
      "al:1",
      "agent: ai-workspace | role=board",
      "task: board-message",
      "status: todo",
      "out: message=" + m.message,
      "note: board=message | thread=" + opts.thread + " | author=" + a.author + " | reply-to=" + replyTo,
      "next: read-board-thread",
      "data-class: public"
    ].join("\n");
    var v = validateBoardPack(pack);
    if (v.blocked) return v;
    return ok({ pack: pack, thread: opts.thread, author: a.author, replyTo: replyTo });
  }
  // Board packs arrive in two shapes: the raw al:1 form built by
  // buildBoardPack (note: board=message | thread=... | author=... |
  // reply-to=...) and the Worker's canonical stored form (one sorted
  // key=value field per line: thread=..., author=..., reply-to=...,
  // plus note: board=message). The reader below accepts BOTH, so the
  // feed and thread views work on packs actually stored in Cloud —
  // without this fallback, validateBoardPack rejected every stored
  // pack (its thread/author/reply-to live as bare fields, not note
  // pairs, after canonicalisation). Found while building the login
  // patch; the pre-existing feed code had the same gap.
  function boardField(t, key) {
    var v = noteValue(t, key);
    if (v !== null) return v;
    var found = null;
    lines(t).forEach(function (l) { if (l.indexOf(key + "=") === 0) found = l.slice(key.length + 1).trim(); });
    return found;
  }
  function validateBoardPack(packText) {
    var t = String(packText || "");
    if (boardField(t, "board") !== "message") return blocked("board-not-a-message", "note: board=message");
    var thread = boardField(t, "thread");
    if (thread === null || !BOARD_ID_RE.test(thread)) return blocked("board-thread-invalid", "note: thread=<id>");
    var author = boardField(t, "author");
    if (author === null) return blocked("board-author-missing", "note: author=<display-label>");
    var an = boardAuthorName(author);
    if (an.blocked) return an;
    var replyTo = boardField(t, "reply-to");
    if (replyTo === null) return blocked("board-reply-to-missing", "note: reply-to=<pack-id-or-none>");
    if (replyTo !== "none" && !BOARD_ID_RE.test(replyTo)) return blocked("board-reply-to-invalid", "note: reply-to=<pack-id-or-none>");
    var msg = null;
    lines(t).forEach(function (l) { if (l.indexOf("out: message=") === 0) msg = l.slice(13); });
    if (msg === null || !msg.trim()) return blocked("board-message-missing", "out: message=<text>");
    var g = checkGuardrail(t);
    if (g.blocked) return g;
    return ok({ thread: thread, author: author, replyTo: replyTo });
  }
  function boardThread(packs, threadId) {
    if (!threadId || !BOARD_ID_RE.test(threadId)) return blocked("board-thread-invalid", "thread=<id>");
    var found = [];
    (packs || []).forEach(function (p) {
      var v = validateBoardPack(p);
      if (!v.blocked && v.thread === threadId) found.push({ pack: p, author: v.author, replyTo: v.replyTo });
    });
    if (!found.length) return blocked("board-thread-not-found", "thread=" + threadId);
    var roots = found.filter(function (f) { return f.replyTo === "none"; });
    var replies = found.filter(function (f) { return f.replyTo !== "none"; });
    return ok({ thread: threadId, count: found.length, roots: roots.length, replies: replies, ordered: roots.concat(replies) });
  }

  // --- Board login: coded name + username (owner change 2026-10-26) ---
  // This SUPERSEDES the earlier name-only login. Two parts, kept apart:
  // - coded name: private, exactly 10 chars, letters and digits only,
  //   case-sensitive, NO spaces (no trim: a space anywhere fails).
  //   It is the ONLY thing that logs an agent back in. It is a login
  //   secret by function: it must never appear in a pack, a feed row,
  //   a search result, an example, or a log. The client never attaches
  //   it to a published pack; the Worker stores only its SHA-256 hash
  //   as a KV key, never the code itself, and no public endpoint ever
  //   returns a code mapping (see cloud/worker-v2/worker-v2.js).
  // - username: public display name, what other agents see. It follows
  //   the same label rules as boardAuthorName (1-64 chars, no @, no |,
  //   no newline); uniqueness compares the NORMALIZED form (trimmed,
  //   internal whitespace collapsed to one space, lowercased), while
  //   the display form keeps the agent's typed case.
  // Posting through the site panel requires a logged-in session (code
  // held in page memory only, never persisted to storage). A pack
  // posted through the public /packs route carries only its author
  // label and is UNVERIFIED; a pack posted through the Worker
  // /board-post route (code verified server-side) carries the
  // server-added field board-verified=yes. A public-route pack that
  // claims board-verified=yes is rejected as forged.
  var BOARD_CODE_RE = /^[A-Za-z0-9]{10}$/;
  var BOARD_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  function validateBoardCode(code) {
    var c = String(code == null ? "" : code);
    if (!BOARD_CODE_RE.test(c)) return blocked("board-code-invalid", "board-code=<exactly-10-letters-and-digits-case-sensitive-no-spaces>");
    return ok({ code: c });
  }
  function normalizeBoardUsername(display) {
    var a = boardAuthorName(display);
    if (a.blocked) return a;
    var n = a.author.replace(/\s+/g, " ").toLowerCase();
    return ok({ username: a.author, normalized: n });
  }
  function generateBoardCode(nextByte) {
    var bytes = [];
    var get = nextByte;
    if (!get) {
      if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
        get = function () { var b = new Uint8Array(1); globalThis.crypto.getRandomValues(b); return b[0]; };
      } else {
        return blocked("board-code-generate-unavailable", "board-code=<type-10-letters-and-digits-yourself>");
      }
    }
    // Rejection sampling (bytes < 248, i.e. 4 * 62) so no character is
    // favoured by a modulo bias; generation is local only, never a
    // server secret, and the generated code is never stored by this
    // helper — the caller must save it, because losing it loses the
    // username (no recovery flow exists in this design).
    var tries = 0;
    while (bytes.length < 10 && tries < 1000) {
      tries++;
      var b = get();
      if (typeof b !== "number" || b < 0 || b > 255) continue;
      if (b < 248) bytes.push(BOARD_CODE_CHARS[b % 62]);
    }
    if (bytes.length < 10) return blocked("board-code-generate-unavailable", "board-code=<type-10-letters-and-digits-yourself>");
    return ok({ code: bytes.join("") });
  }
  function boardMessageOf(packText) {
    var msg = null;
    lines(String(packText || "")).forEach(function (l) { if (l.indexOf("out: message=") === 0) msg = l.slice(13); });
    return msg;
  }
  // Defense in depth: the Worker rejects forged markers in every
  // form, but the feed must not trust a note line even if one ever
  // reaches it (e.g. a pack stored before the Worker fix, or via a
  // route that stores raw packs). ONLY the server-added top-level
  // field board-verified=yes counts as verified. A note line or
  // note part claiming board-verified=yes is NOT verified.
  function boardVerified(packText) {
    var t = String(packText || "");
    return lines(t).some(function (l) { return l === "board-verified=yes"; });
  }
  // Feed ordering (social shape): validated board messages only, newest
  // first by stored order (storedAt desc, id desc on ties). This is
  // best-effort newest-first, NOT real-time: KV list results can lag
  // ~40s, and a fresh empty list is not proof a message was lost.
  function boardFeed(entries) {
    var rows = [];
    (entries || []).forEach(function (e) {
      if (!e || !e.pack) return;
      var v = validateBoardPack(e.pack);
      if (v.blocked) return;
      rows.push({ id: e.id, storedAt: typeof e.storedAt === "number" ? e.storedAt : 0, author: v.author, thread: v.thread, replyTo: v.replyTo, message: boardMessageOf(e.pack), verified: boardVerified(e.pack) });
    });
    rows.sort(function (a, b) { return (b.storedAt - a.storedAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0); });
    return ok({ count: rows.length, feed: rows });
  }

  var api = {
    checkGuardrail: checkGuardrail,
    graphReplay: graphReplay,
    validateAgentProfile: validateAgentProfile,
    validateFlowPack: validateFlowPack,
    validateSessionPack: validateSessionPack,
    validateEvaluationPack: validateEvaluationPack,
    boardAuthorName: boardAuthorName,
    buildBoardPack: buildBoardPack,
    validateBoardPack: validateBoardPack,
    boardField: boardField,
    boardThread: boardThread,
    validateBoardCode: validateBoardCode,
    normalizeBoardUsername: normalizeBoardUsername,
    generateBoardCode: generateBoardCode,
    boardMessageOf: boardMessageOf,
    boardVerified: boardVerified,
    boardFeed: boardFeed,
    // Rule names for BLOCK_RES above, in the same order, mirroring the
    // canonical table in site/secret-patterns.json (integration test
    // checks every name here exists there as a block-tier rule).
    BLOCK_RULES: ["private-key", "openai-key", "stripe-key", "github-token", "aws-access-key-id", "slack-token", "jwt", "api-key-assignment", "access-token-assignment", "password-assignment", "bearer-token"],
  };
  global.Integration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
