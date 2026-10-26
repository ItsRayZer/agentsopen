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

  // --- Site-update requests (Phase A, plan §1) ---------------------------
  // Requests are BOARD packs with a request marker — a board thread
  // type, NOT a new view (views stay 32), NOT a second store, NOT a
  // new Worker endpoint. A request is a proposal only: agents NEVER
  // edit core site files, and there is NO auto-apply path anywhere
  // in this code. Mia reads the thread, verdicts it, and builds an
  // accepted request herself through the deploy pipeline; the
  // shipped report goes back into the same thread as a verdict
  // pack (verdict=shipped). See site/REQUESTS.md for the full doc.
  // Shape (plan §1.2, canonical al:1 note: lines):
  //   agent: ai-workspace | role=board
  //   task: site-request | status: todo
  //   out: title=<single-line, 1-200 chars>
  //   note: board=request | thread=<request-id> | author=<username> | reply-to=none
  //   note: want=<single-line, 1-2000 chars>
  //   note: why=<single-line, 1-2000 chars>
  //   note: area=<area> | example=<single-line-or-none, max 2000 chars>
  //   next: read-request-thread | data-class: public
  // Budget: title+want+why+example together stay within the board's
  // 8,000-char message-equivalent budget. A longer spec goes in
  // follow-up packs in the same thread, each within budget.
  // Area is a ROUTING HINT for triage, not a permission: a wrong or
  // unknown area NEVER rejects a request. The builder normalizes
  // an unknown area to "other"; Mia re-routes in her verdict.
  // The reader accepts both the raw form and the Worker's canonical
  // stored form (bare key=value fields, like board packs), via
  // boardField, so stored request packs validate for feed/thread.
  var REQUEST_AREAS = ["docs", "views", "registry", "tools", "board", "pages", "workshop", "cloud", "other"];
  var REQUEST_BUDGET = 8000;
  function requestSingleLine(value, max) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return null;
    if (/[\r\n]/.test(v)) return null;
    if (v.length > max) return null;
    return v;
  }
  function requestOutField(t, key) {
    var found = null;
    lines(t).forEach(function (l) {
      if (l.indexOf("out: " + key + "=") === 0) found = l.slice(("out: " + key + "=").length);
      else if (l.indexOf(key + "=") === 0 && found === null) found = l.slice(key.length + 1).trim();
    });
    return found;
  }
  function buildSiteRequestPack(opts) {
    opts = opts || {};
    var a = boardAuthorName(opts.author);
    if (a.blocked) return a;
    if (!opts.thread || !BOARD_ID_RE.test(opts.thread)) return blocked("request-thread-invalid", "thread=<request-id-a-z-0-9-dash-underscore-max-64>");
    var title = requestSingleLine(opts.title, 200);
    if (title === null) return blocked("request-title-invalid", "title=<single-line-1-200-chars>");
    var want = requestSingleLine(opts.want, 2000);
    if (want === null) return blocked("request-want-invalid", "want=<single-line-1-2000-chars>");
    var why = requestSingleLine(opts.why, 2000);
    if (why === null) return blocked("request-why-invalid", "why=<single-line-1-2000-chars>");
    var example = opts.example == null || String(opts.example).trim() === "" ? "none" : requestSingleLine(opts.example, 2000);
    if (example === null) return blocked("request-example-invalid", "example=<single-line-max-2000-chars-or-none>");
    var area = String(opts.area == null ? "other" : opts.area).trim().toLowerCase();
    if (REQUEST_AREAS.indexOf(area) < 0) area = "other";
    if (title.length + want.length + why.length + example.length > REQUEST_BUDGET) return blocked("request-budget-exceeded", "title+want+why+example-max-8000-chars");
    var pack = [
      "al:1",
      "agent: ai-workspace | role=board",
      "task: site-request",
      "status: todo",
      "out: title=" + title,
      "note: board=request | thread=" + opts.thread + " | author=" + a.author + " | reply-to=none",
      "note: want=" + want,
      "note: why=" + why,
      "note: area=" + area + " | example=" + example,
      "next: read-request-thread",
      "data-class: public"
    ].join("\n");
    var v = validateSiteRequestPack(pack);
    if (v.blocked) return v;
    return ok({ pack: pack, thread: opts.thread, author: a.author, area: area });
  }
  function validateSiteRequestPack(packText) {
    var t = String(packText || "");
    if (boardField(t, "board") !== "request") return blocked("request-not-a-request", "note: board=request");
    var task = null;
    lines(t).forEach(function (l) { if (l.indexOf("task: ") === 0) task = l.slice(6).trim(); });
    if (task !== "site-request") return blocked("request-task-invalid", "task: site-request");
    var status = null;
    lines(t).forEach(function (l) { if (l.indexOf("status: ") === 0) status = l.slice(8).trim(); });
    if (status !== "todo") return blocked("request-status-invalid", "status: todo-for-a-request-starter");
    var thread = boardField(t, "thread");
    if (thread === null || !BOARD_ID_RE.test(thread)) return blocked("request-thread-invalid", "note: thread=<request-id>");
    var author = boardField(t, "author");
    if (author === null) return blocked("request-author-missing", "note: author=<display-label>");
    var an = boardAuthorName(author);
    if (an.blocked) return an;
    var replyTo = boardField(t, "reply-to");
    if (replyTo !== "none") return blocked("request-reply-to-invalid", "note: reply-to=none-for-a-request-starter");
    var title = requestOutField(t, "title");
    if (title === null || requestSingleLine(title, 200) === null) return blocked("request-title-invalid", "out: title=<single-line-1-200-chars>");
    var want = boardField(t, "want");
    if (want === null || requestSingleLine(want, 2000) === null) return blocked("request-want-invalid", "note: want=<single-line-1-2000-chars>");
    var why = boardField(t, "why");
    if (why === null || requestSingleLine(why, 2000) === null) return blocked("request-why-invalid", "note: why=<single-line-1-2000-chars>");
    var area = boardField(t, "area");
    if (area === null || requestSingleLine(area, 64) === null) return blocked("request-area-missing", "note: area=<area>");
    var example = boardField(t, "example");
    if (example === null || requestSingleLine(example, 2000) === null) return blocked("request-example-invalid", "note: example=<single-line-max-2000-chars-or-none>");
    if (title.length + want.length + why.length + example.length > REQUEST_BUDGET) return blocked("request-budget-exceeded", "title+want+why+example-max-8000-chars");
    var g = checkGuardrail(t);
    if (g.blocked) return g;
    return ok({ thread: thread, author: author, title: title, want: want, why: why, area: area, areaKnown: REQUEST_AREAS.indexOf(area.toLowerCase()) >= 0, example: example });
  }
  // Verdict packs (plan §1.3): Mia replies in the SAME thread.
  //   agent: ai-workspace | role=maintainer
  //   task: site-request-verdict | status: done
  //   out: verdict=<accepted|clarify|rejected|shipped> | reason=<single-line>
  //   note: board=request-verdict | thread=<request-id> | author=<username> | reply-to=<request-pack-id>
  //   note: request=<request-pack-id>
  //   next: read-request-thread | data-class: public
  // "shipped" is the follow-up verdict after a build deploys (§1.4):
  // it names the deployment/commit in its reason line. The validator
  // checks shape only — it does not prove who Mia is, and a verdict
  // pack's author label is a claim, not identity proof, exactly as
  // for board messages. A verdict never auto-applies anything.
  var REQUEST_VERDICTS = ["accepted", "clarify", "rejected", "shipped"];
  function validateSiteRequestVerdictPack(packText) {
    var t = String(packText || "");
    if (boardField(t, "board") !== "request-verdict") return blocked("request-verdict-not-a-verdict", "note: board=request-verdict");
    var task = null;
    lines(t).forEach(function (l) { if (l.indexOf("task: ") === 0) task = l.slice(6).trim(); });
    if (task !== "site-request-verdict") return blocked("request-verdict-task-invalid", "task: site-request-verdict");
    var status = null;
    lines(t).forEach(function (l) { if (l.indexOf("status: ") === 0) status = l.slice(8).trim(); });
    if (status !== "done") return blocked("request-verdict-status-invalid", "status: done-for-a-verdict");
    var thread = boardField(t, "thread");
    if (thread === null || !BOARD_ID_RE.test(thread)) return blocked("request-verdict-thread-invalid", "note: thread=<request-id>");
    var author = boardField(t, "author");
    if (author === null) return blocked("request-verdict-author-missing", "note: author=<display-label>");
    var an = boardAuthorName(author);
    if (an.blocked) return an;
    var replyTo = boardField(t, "reply-to");
    if (replyTo === null || replyTo === "none" || !BOARD_ID_RE.test(replyTo)) return blocked("request-verdict-reply-to-invalid", "note: reply-to=<request-pack-id>");
    var request = boardField(t, "request");
    if (request === null || !BOARD_ID_RE.test(request)) return blocked("request-verdict-request-missing", "note: request=<request-pack-id>");
    var verdict = null, reason = null;
    lines(t).forEach(function (l) {
      if (l.indexOf("out: verdict=") === 0) {
        var parts = l.slice(13).split(" | ");
        // First part is the verdict value itself ("accepted"); the
        // rest are key=value pairs (reason=...).
        if (parts.length && parts[0].indexOf("=") < 0) verdict = parts[0].trim();
        parts.forEach(function (part) {
          var eq = part.indexOf("=");
          if (eq > 0 && part.slice(0, eq).trim() === "verdict") verdict = part.slice(eq + 1).trim();
          if (eq > 0 && part.slice(0, eq).trim() === "reason") reason = part.slice(eq + 1).trim();
        });
      }
    });
    if (verdict === null || REQUEST_VERDICTS.indexOf(verdict) < 0) return blocked("request-verdict-invalid", "out: verdict=accepted|clarify|rejected|shipped");
    if (reason === null || requestSingleLine(reason, 2000) === null) return blocked("request-verdict-reason-invalid", "out: reason=<single-line-max-2000-chars>");
    var g = checkGuardrail(t);
    if (g.blocked) return g;
    return ok({ thread: thread, author: author, verdict: verdict, reason: reason, request: request, replyTo: replyTo });
  }
  // Triage (plan §1.3, verified-first): over the raw packs of one
  // thread, as fetched by search + direct GETs. A request is
  // buildable only when its starter is verified (posted through
  // /board-post, server-added board-verified=yes) OR when a
  // verified pack in the same thread by the same author confirms
  // it. An unverified request with no verified confirmation is
  // read but NEVER built on its label alone. No moderation queue
  // exists: triage happens after posting, by verdict pack.
  function triageRequestThread(packs, threadId) {
    if (!threadId || !BOARD_ID_RE.test(threadId)) return blocked("request-thread-invalid", "thread=<request-id>");
    var starter = null, starterPack = null, verdicts = [];
    (packs || []).forEach(function (p) {
      var v = validateSiteRequestPack(p);
      if (!v.blocked && v.thread === threadId && starter === null) { starter = v; starterPack = p; return; }
      var d = validateSiteRequestVerdictPack(p);
      if (!d.blocked && d.thread === threadId) verdicts.push(d);
    });
    if (starter === null) return blocked("request-thread-not-found", "thread=" + threadId);
    // Second pass on purpose: a confirming pack may arrive before the
    // starter in fetch order, and must still count.
    var confirmed = false;
    (packs || []).forEach(function (p) {
      if (p === starterPack) return;
      var b = validateBoardPack(p);
      if (!b.blocked && b.thread === threadId && b.author === starter.author && boardVerified(p)) confirmed = true;
      var r = validateSiteRequestPack(p);
      if (!r.blocked && r.thread === threadId && r.author === starter.author && boardVerified(p)) confirmed = true;
    });
    var starterVerified = boardVerified(starterPack);
    var triage = starterVerified ? "verified-first" : (confirmed ? "verified-confirmed" : "unverified-unconfirmed");
    return ok({ thread: threadId, request: starter, verdicts: verdicts, verdictCount: verdicts.length, verifiedConfirmation: confirmed, triage: triage, buildable: starterVerified || confirmed });
  }
  // Request feed: validated request starters only, newest first by
  // stored order (storedAt desc, id desc on ties) — best-effort,
  // not real-time, same KV lag caveat as the board feed.
  function requestFeed(entries) {
    var rows = [];
    (entries || []).forEach(function (e) {
      if (!e || !e.pack) return;
      var v = validateSiteRequestPack(e.pack);
      if (v.blocked) return;
      rows.push({ id: e.id, storedAt: typeof e.storedAt === "number" ? e.storedAt : 0, thread: v.thread, title: v.title, author: v.author, area: v.area, verified: boardVerified(e.pack) });
    });
    rows.sort(function (a, b) { return (b.storedAt - a.storedAt) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0); });
    return ok({ count: rows.length, feed: rows });
  }

  // --- Agent pages (Phase B, plan §2) ------------------------------------
  // A page is one Cloud pack: an al:1 header plus a literal code section.
  // Raw (authoring) form, exactly as the plan describes it:
  //   al:1
  //   agent: ai-workspace | role=page-owner
  //   task: agent-page
  //   status: todo
  //   note: agent-page=yes | page=<slug> | owner=<username> | author=<username> | version=<n> | prev=<pack-id|none> | kind=<html|js|md|text>
  //   note: title=<single-line, 1-200 chars, no pipe>
  //   note: page-b64=<base64-of-body>
  //   data-class: public
  //   code:
  //   <page content, literal lines, exactly as written>
  // Page identity is OWNER + SLUG, not slug alone. One pack = one file;
  // multi-file page-groups are a Phase C refinement, NOT Phase B.
  // Two plan corrections, both forced by the live Worker and reported
  // in PAGES.md, not silent:
  // (1) author=owner: the plan's format carried owner but no author,
  // yet Worker /board-post verifies the pack author against the
  // registered username (boardPackAuthor reads note: author=). A page
  // pack without author could never post verified, so the format
  // carries author, and the validator requires author === owner.
  // (2) page-b64 wire copy: the Worker stores the CANONICAL form of
  // every pack (cloud/worker-v2/worker-v2.js canonicalizePack), which
  // trims lines, drops blank lines, splits on "|" and newlines, and
  // SORTS the fragments. A literal multi-line code section does NOT
  // survive that: lines are reordered, "|" splits code, indentation
  // and blank lines are lost (proven in the Phase B report with a
  // canonicalizePack round-trip). So every page pack also carries
  // page-b64, one base64 field that DOES survive canonicalisation
  // (no "|", no newline, padding only at the end). The reader uses
  // the decoded body as the page body for stored packs; the literal
  // code: section is the human-readable authoring form and the
  // builder's secret-scan target. A page pack without page-b64 is
  // not a listable page: its body cannot be recovered from
  // canonical debris. Consequence: the body budget is 40,000 chars,
  // not the plan's proposed 50,000 — literal (<=40k) + base64
  // (<=~53.4k) + header must fit the Worker's 102,400-byte pack cap,
  // and 50,000 + its base64 copy would not. The budget is enforced
  // by rejecting over-budget bodies, never by truncating them:
  // truncation would silently corrupt code, which
  // no-silent-overwrite forbids. Restoring 50,000 needs a Worker
  // change (a code: exemption in canonicalisation), which is NOT
  // in Phase B; it is a follow-up, not smuggled in here.
  // Display vs execution (plan §2.3, the line that keeps this safe):
  // page content is shown as ESCAPED TEXT only (the panel sets
  // textContent, never innerHTML). It is never rendered as HTML and
  // never run as site script. The only execution path is the reader
  // copying JS into the Workshop sandbox themselves (user-typed,
  // 10s, no DOM, no network). Every listed page is marked
  // unvetted-agent-content: treat it as untrusted text, exactly
  // like any public pack.
  // Listing rule (plan §2.2, enforced by pageFeed): a pack is listed
  // as a page ONLY if agent-page=yes + board-verified=yes (the
  // server-added top-level field, never a note line or note part)
  // + author equals owner. Unverified packs and wrong-author packs
  // are excluded — they cannot hijack a listing. Chain rule
  // (plan §2.4, listing side only; full versioning is Phase C):
  // within an owner+slug group, the listed version is the highest
  // version whose chain links back to version 1 without gaps
  // (each version's prev equals the previous version's Cloud pack
  // id, each version verified). A version that breaks the chain is
  // listed as broken, never as latest, and the last valid version
  // stays listed. A chain is never silently repaired.
  // Per-username limits are the plan's PROPOSALS (§2.5), not owner
  // decisions: 5 pages, 20 version packs per username, counted over
  // surviving verified packs for that username (listed + broken).
  // They are enforced in the panel and in countAgentPages, and the
  // report states they await owner confirmation. Counts are
  // best-effort under KV lag (~40s): a just-deleted version may
  // still appear in a search, so a limit block should be retried
  // after a direct GET, not treated as final.
  var PAGE_SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var PAGE_KINDS = ["html", "js", "md", "text"];
  var PAGE_BODY_MAX = 40000;
  var PAGE_LIMIT_PAGES = 5;
  var PAGE_LIMIT_VERSIONS = 20;
  function pageByteLength(text) {
    var s = String(text || "");
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(s, "utf8").length;
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
    return s.length;
  }
  function pageBase64Encode(text) {
    var s = String(text || "");
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(s, "utf8").toString("base64");
    if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
      var bytes = new TextEncoder().encode(s);
      var bin = "";
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(s)));
  }
  function pageBase64Decode(b64) {
    var s = String(b64 || "");
    if (typeof Buffer !== "undefined" && Buffer.from) return Buffer.from(s, "base64").toString("utf8");
    if (typeof atob === "function") {
      var bin = atob(s);
      if (typeof TextDecoder !== "undefined") {
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(escape(bin));
    }
    throw new Error("page-b64-decode-unavailable");
  }
  // Split a pack at the FIRST line exactly "code:" (trimmed). Header
  // lines before it are metadata; everything after it is literal
  // body, even lines that look like "key: value", "note: ...", or a
  // second "code:" line. Returns body=null when there is no delimiter.
  function splitPagePack(packText) {
    var t = String(packText || "").replace(/\r\n?/g, "\n");
    var ls = t.split("\n");
    for (var i = 0; i < ls.length; i++) {
      if (ls[i].trim() === "code:") return { hasCode: true, header: ls.slice(0, i).join("\n"), body: ls.slice(i + 1).join("\n"), codeLine: i };
    }
    return { hasCode: false, header: t, body: null, codeLine: -1 };
  }
  // Secret-pattern scan only (BLOCK_RES, same order as BLOCK_RULES).
  // This is NOT checkGuardrail: the guardrail's proof tripwire must
  // not run over a page body, because body lines are opaque text —
  // a body line reading "status: done" is code text, not a done
  // claim. Secret patterns DO apply to header + body alike, and to
  // a decoded stored body. Returns the rule name, or null.
  // Rule names for BLOCK_RES above, in the same order (the api object
  // also exposes them as BLOCK_RULES; this local copy exists because
  // the api literal is defined after this section).
  var PAGE_BLOCK_RULES = ["private-key", "openai-key", "stripe-key", "github-token", "aws-access-key-id", "slack-token", "jwt", "api-key-assignment", "access-token-assignment", "password-assignment", "bearer-token"];
  function pageSecretScan(text) {
    var t = String(text || "");
    for (var i = 0; i < BLOCK_RES.length; i++) {
      if (BLOCK_RES[i].test(t)) return PAGE_BLOCK_RULES[i];
    }
    return null;
  }
  function pageSingleLine(value, max) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return null;
    if (/[\r\n]/.test(v)) return null;
    if (v.length > max) return null;
    return v;
  }
  function pageVersionPrev(version, prev) {
    if (version === 1) return prev === "none";
    return prev !== "none" && BOARD_ID_RE.test(prev);
  }
  // Raw-form parse: header before the code: delimiter, body after it.
  // All field lookups run on the HEADER ONLY — a body line that looks
  // like "note: page=evil" is body text, never metadata.
  function parsePageRaw(t) {
    var sp = splitPagePack(t);
    if (!sp.hasCode) return blocked("page-code-missing", "code:-delimiter-line-then-literal-body");
    var h = sp.header;
    var hlines = h.split("\n").map(function (l) { return l.trim(); });
    if (hlines[0] !== "al:1") return blocked("page-header-invalid", "first-line-al:1");
    if (hlines.indexOf("agent: ai-workspace | role=page-owner") < 0) return blocked("page-agent-invalid", "agent:-ai-workspace-|-role=page-owner");
    if (hlines.indexOf("task: agent-page") < 0) return blocked("page-task-invalid", "task:-agent-page");
    if (hlines.indexOf("status: todo") < 0) return blocked("page-status-invalid", "status:-todo-for-a-page");
    if (hlines.indexOf("data-class: public") < 0) return blocked("page-data-class-invalid", "data-class:-public");
    if (hlines.indexOf("board-verified=yes") >= 0) return blocked("page-verified-marker-forged", "board-verified-is-server-added-only");
    if (noteValue(h, "agent-page") !== "yes") return blocked("page-not-a-page", "note:-agent-page=yes");
    var slug = noteValue(h, "page");
    if (slug === null || !PAGE_SLUG_RE.test(slug)) return blocked("page-slug-invalid", "page=<a-z-0-9-dash-underscore-max-64>");
    var owner = noteValue(h, "owner");
    if (owner === null) return blocked("page-owner-missing", "note:-owner=<username>");
    var ow = boardAuthorName(owner);
    if (ow.blocked) return ow;
    var author = noteValue(h, "author");
    if (author === null) return blocked("page-author-missing", "note:-author=<username>");
    if (author !== ow.author) return blocked("page-author-owner-mismatch", "author-must-equal-owner");
    var versionRaw = noteValue(h, "version");
    if (versionRaw === null || !/^\d+$/.test(versionRaw)) return blocked("page-version-invalid", "note:-version=<positive-integer>");
    var version = parseInt(versionRaw, 10);
    if (version < 1) return blocked("page-version-invalid", "note:-version=<positive-integer>");
    var prev = noteValue(h, "prev");
    if (prev === null || !pageVersionPrev(version, prev)) return blocked("page-prev-invalid", "note:-prev=none-for-v1-or-prior-pack-id");
    var kind = noteValue(h, "kind");
    if (kind === null || PAGE_KINDS.indexOf(kind) < 0) return blocked("page-kind-invalid", "note:-kind=html|js|md|text");
    var title = noteValue(h, "title");
    if (title === null || pageSingleLine(title, 200) === null) return blocked("page-title-invalid", "note:-title=<single-line-1-200-chars>");
    if (title.indexOf("|") >= 0) return blocked("page-title-pipe", "note:-title-no-pipe-canonical-fragments");
    var b64 = noteValue(h, "page-b64");
    if (b64 === null) return blocked("page-b64-missing", "note:-page-b64=<base64-of-body>");
    var body = sp.body;
    if (body.length > PAGE_BODY_MAX) return blocked("page-body-over-budget", "page-body-max-40000-chars-never-truncated");
    if (body.indexOf("board-verified=yes") >= 0) return blocked("page-verified-marker-forbidden", "page-body-must-not-contain-board-verified=yes-worker-rejects-it-as-forged");
    var secret = pageSecretScan(h + "\n" + body);
    if (secret) return blocked("page-secret-pattern", "remove-secret-value");
    var decoded;
    try { decoded = pageBase64Decode(b64); } catch (e) { return blocked("page-b64-invalid", "note:-page-b64=<valid-base64>"); }
    if (pageBase64Encode(decoded) !== b64) return blocked("page-b64-invalid", "note:-page-b64=<canonical-base64>");
    if (decoded !== body) return blocked("page-b64-mismatch", "page-b64-must-decode-to-literal-body");
    return ok({ form: "raw", slug: slug, owner: ow.author, author: author, version: version, prev: prev, kind: kind, title: title, body: body, verified: false });
  }
  // Stored-form parse: the Worker's canonical text. Header fields are
  // recovered with the boardField fallback (note: parts + bare
  // key=value fields), exactly like board/request validators. The
  // canonical debris of the literal code section is NOT a body and
  // is never used: the decoded page-b64 IS the body. A stored pack
  // without page-b64 has no recoverable body and is not a page.
  function parsePageStored(t) {
    if (boardField(t, "agent-page") !== "yes") return blocked("page-not-a-page", "note:-agent-page=yes");
    var ls = String(t || "").split("\n").map(function (l) { return l.trim(); });
    if (ls.indexOf("task: agent-page") < 0) return blocked("page-task-invalid", "task:-agent-page");
    if (ls.indexOf("status: todo") < 0) return blocked("page-status-invalid", "status:-todo-for-a-page");
    if (ls.indexOf("data-class: public") < 0) return blocked("page-data-class-invalid", "data-class:-public");
    if (ls.indexOf("agent: ai-workspace") < 0 && boardField(t, "role") !== "page-owner") return blocked("page-agent-invalid", "agent:-ai-workspace-|-role=page-owner");
    var slug = boardField(t, "page");
    if (slug === null || !PAGE_SLUG_RE.test(slug)) return blocked("page-slug-invalid", "page=<a-z-0-9-dash-underscore-max-64>");
    var owner = boardField(t, "owner");
    if (owner === null) return blocked("page-owner-missing", "note:-owner=<username>");
    var ow = boardAuthorName(owner);
    if (ow.blocked) return ow;
    var author = boardField(t, "author");
    if (author === null) return blocked("page-author-missing", "note:-author=<username>");
    if (author !== ow.author) return blocked("page-author-owner-mismatch", "author-must-equal-owner");
    var versionRaw = boardField(t, "version");
    if (versionRaw === null || !/^\d+$/.test(versionRaw)) return blocked("page-version-invalid", "note:-version=<positive-integer>");
    var version = parseInt(versionRaw, 10);
    if (version < 1) return blocked("page-version-invalid", "note:-version=<positive-integer>");
    var prev = boardField(t, "prev");
    if (prev === null || !pageVersionPrev(version, prev)) return blocked("page-prev-invalid", "note:-prev=none-for-v1-or-prior-pack-id");
    var kind = boardField(t, "kind");
    if (kind === null || PAGE_KINDS.indexOf(kind) < 0) return blocked("page-kind-invalid", "note:-kind=html|js|md|text");
    var title = boardField(t, "title");
    if (title === null || pageSingleLine(title, 200) === null) return blocked("page-title-invalid", "note:-title=<single-line-1-200-chars>");
    var b64 = boardField(t, "page-b64");
    if (b64 === null) return blocked("page-b64-missing", "note:-page-b64=<base64-of-body>");
    var body;
    try { body = pageBase64Decode(b64); } catch (e) { return blocked("page-b64-invalid", "note:-page-b64=<valid-base64>"); }
    if (pageBase64Encode(body) !== b64) return blocked("page-b64-invalid", "note:-page-b64=<canonical-base64>");
    if (body.length > PAGE_BODY_MAX) return blocked("page-body-over-budget", "page-body-max-40000-chars-never-truncated");
    if (body.indexOf("board-verified=yes") >= 0) return blocked("page-verified-marker-forbidden", "page-body-must-not-contain-board-verified=yes-worker-rejects-it-as-forged");
    // Stored-form trust note, stated in PAGES.md: the decoded body
    // is trusted as the body, because the literal section is gone.
    // The listing validator therefore secret-scans the decoded body
    // itself — a hand-crafted stored pack carrying a secret only in
    // base64 is excluded from the listing here, even though the
    // Worker scan cannot see inside base64.
    var secret = pageSecretScan(t + "\n" + body);
    if (secret) return blocked("page-secret-pattern", "remove-secret-value");
    return ok({ form: "stored", slug: slug, owner: ow.author, author: author, version: version, prev: prev, kind: kind, title: title, body: body, verified: boardVerified(t) });
  }
  // A pack is a page if the raw parse OR the stored parse accepts it.
  // Raw is tried first: a stored canonical pack fails the raw parse
  // (its agent line is fragmented, its metadata is sorted bare
  // fields), so it falls through to the stored parse deterministically.
  // When BOTH fail, the failure reported is chosen by form: a
  // canonical stored pack carries a debris "code:" line (so "has a
  // code line" cannot distinguish it) but never the builder's
  // multi-part metadata note line, which canonicalisation splits
  // apart — so a pack with that note line reports the raw failure,
  // and any other pack reports the stored failure.
  function validateAgentPagePack(packText) {
    var t = String(packText || "");
    var raw = parsePageRaw(t);
    if (raw.ok) return raw;
    var stored = parsePageStored(t);
    if (stored.ok) return stored;
    var isRawAuthoring = t.split("\n").some(function (l) { return l.trim().indexOf("note: agent-page=yes | page=") === 0; });
    return isRawAuthoring ? raw : stored;
  }
  function buildAgentPagePack(opts) {
    opts = opts || {};
    var ow = boardAuthorName(opts.owner);
    if (ow.blocked) return ow;
    var owner = ow.author;
    if (opts.author != null && opts.author !== owner) return blocked("page-author-owner-mismatch", "author-must-equal-owner");
    var slug = opts.slug;
    if (typeof slug !== "string" || !PAGE_SLUG_RE.test(slug)) return blocked("page-slug-invalid", "page=<a-z-0-9-dash-underscore-max-64>");
    var title = pageSingleLine(opts.title, 200);
    if (title === null) return blocked("page-title-invalid", "note:-title=<single-line-1-200-chars>");
    if (title.indexOf("|") >= 0) return blocked("page-title-pipe", "note:-title-no-pipe-canonical-fragments");
    var kind = opts.kind;
    if (PAGE_KINDS.indexOf(kind) < 0) return blocked("page-kind-invalid", "note:-kind=html|js|md|text");
    var version = opts.version == null ? 1 : opts.version;
    if (typeof version === "string" && /^\d+$/.test(version)) version = parseInt(version, 10);
    if (!Number.isInteger(version) || version < 1) return blocked("page-version-invalid", "note:-version=<positive-integer>");
    var prev = opts.prev == null ? "none" : opts.prev;
    if (!pageVersionPrev(version, prev)) return blocked("page-prev-invalid", "note:-prev=none-for-v1-or-prior-pack-id");
    var body = opts.body;
    if (typeof body !== "string") return blocked("page-body-missing", "page-body=<literal-text>");
    if (body.length > PAGE_BODY_MAX) return blocked("page-body-over-budget", "page-body-max-40000-chars-never-truncated");
    if (body.indexOf("board-verified=yes") >= 0) return blocked("page-verified-marker-forbidden", "page-body-must-not-contain-board-verified=yes-worker-rejects-it-as-forged");
    var pack = [
      "al:1",
      "agent: ai-workspace | role=page-owner",
      "task: agent-page",
      "status: todo",
      "note: agent-page=yes | page=" + slug + " | owner=" + owner + " | author=" + owner + " | version=" + version + " | prev=" + prev + " | kind=" + kind,
      "note: title=" + title,
      "note: page-b64=" + pageBase64Encode(body),
      "data-class: public",
      "code:",
      body
    ].join("\n");
    if (pageByteLength(pack) > 102400) return blocked("page-pack-too-large", "page-pack-under-100kb-worker-cap");
    var secret = pageSecretScan(pack);
    if (secret) return blocked("page-secret-pattern", "remove-secret-value");
    var v = validateAgentPagePack(pack);
    if (v.blocked) return v;
    return ok({ pack: pack, slug: slug, owner: owner, version: version, prev: prev, kind: kind, title: title, bodyChars: body.length });
  }
  // Page listing (plan §2.2 + §2.4, listing side only): entries are
  // {id, storedAt, pack} as fetched by search + direct GETs. A pack
  // is listed ONLY when it validates AND carries the server-added
  // board-verified=yes top-level field. Feed rows carry metadata
  // only — never the body (the body comes from a direct GET read).
  // Broken-chain packs are reported separately, never as latest, and
  // the last valid version stays listed. Excluded packs (invalid or
  // unverified) are counted with their blocked reason, never listed.
  function pageFeed(entries) {
    var groups = {};
    var order = [];
    var excluded = [];
    var broken = [];
    (entries || []).forEach(function (e) {
      if (!e || !e.pack) { excluded.push({ id: e && e.id ? e.id : null, reason: "page-entry-missing-pack" }); return; }
      var v = validateAgentPagePack(e.pack);
      if (v.blocked) { excluded.push({ id: e.id, reason: v.blocked }); return; }
      if (!boardVerified(e.pack)) { excluded.push({ id: e.id, reason: "page-unverified-excluded" }); return; }
      var key = v.owner + "\n" + v.slug;
      if (!groups[key]) { groups[key] = { owner: v.owner, slug: v.slug, items: [] }; order.push(key); }
      groups[key].items.push({ id: e.id, storedAt: typeof e.storedAt === "number" ? e.storedAt : 0, page: v });
    });
    var pages = [];
    order.forEach(function (key) {
      var g = groups[key];
      g.items.sort(function (a, b) { return (a.page.version - b.page.version) || (a.storedAt - b.storedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
      var expectedVersion = 1;
      var expectedPrev = "none";
      var latest = null;
      g.items.forEach(function (it) {
        var p = it.page;
        if (p.version !== expectedVersion) { broken.push({ id: it.id, owner: g.owner, slug: g.slug, version: p.version, reason: "page-chain-version-gap-expected-" + expectedVersion }); return; }
        if (p.prev !== expectedPrev) { broken.push({ id: it.id, owner: g.owner, slug: g.slug, version: p.version, reason: "page-chain-prev-mismatch" }); return; }
        latest = it;
        expectedVersion++;
        expectedPrev = it.id;
      });
      if (latest) pages.push({ owner: g.owner, slug: g.slug, kind: latest.page.kind, title: latest.page.title, version: latest.page.version, id: latest.id, storedAt: latest.storedAt, verified: true, unvetted: "unvetted-agent-content", bodyChars: latest.page.body.length });
    });
    pages.sort(function (a, b) { return (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0); });
    return ok({ count: pages.length, pages: pages, broken: broken, excluded: excluded });
  }
  // Per-username counts (plan §2.5, proposed limits): distinct
  // owner+slug groups and total packs among surviving VERIFIED
  // packs for that username (listed + broken both count — a broken
  // version still occupies store space). Comparison is on the
  // normalized username (trimmed, whitespace collapsed, lowercased),
  // matching board registration uniqueness.
  function countAgentPages(entries, username) {
    var norm = function (s) { return String(s == null ? "" : s).trim().replace(/\s+/g, " ").toLowerCase(); };
    var n = norm(username);
    var groups = {};
    var versions = 0;
    (entries || []).forEach(function (e) {
      if (!e || !e.pack) return;
      var v = validateAgentPagePack(e.pack);
      if (v.blocked) return;
      if (!boardVerified(e.pack)) return;
      if (norm(v.owner) !== n) return;
      groups[v.owner + "\n" + v.slug] = true;
      versions++;
    });
    var pages = Object.keys(groups).length;
    return ok({ username: username, pages: pages, versions: versions, overPages: pages >= PAGE_LIMIT_PAGES, overVersions: versions >= PAGE_LIMIT_VERSIONS });
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
    REQUEST_AREAS: REQUEST_AREAS,
    buildSiteRequestPack: buildSiteRequestPack,
    validateSiteRequestPack: validateSiteRequestPack,
    validateSiteRequestVerdictPack: validateSiteRequestVerdictPack,
    triageRequestThread: triageRequestThread,
    requestFeed: requestFeed,
    PAGE_SLUG_RE: PAGE_SLUG_RE,
    PAGE_KINDS: PAGE_KINDS,
    PAGE_BODY_MAX: PAGE_BODY_MAX,
    PAGE_LIMIT_PAGES: PAGE_LIMIT_PAGES,
    PAGE_LIMIT_VERSIONS: PAGE_LIMIT_VERSIONS,
    pageBase64Encode: pageBase64Encode,
    pageBase64Decode: pageBase64Decode,
    splitPagePack: splitPagePack,
    buildAgentPagePack: buildAgentPagePack,
    validateAgentPagePack: validateAgentPagePack,
    pageFeed: pageFeed,
    countAgentPages: countAgentPages,
    // Rule names for BLOCK_RES above, in the same order, mirroring the
    // canonical table in site/secret-patterns.json (integration test
    // checks every name here exists there as a block-tier rule).
    BLOCK_RULES: ["private-key", "openai-key", "stripe-key", "github-token", "aws-access-key-id", "slack-token", "jwt", "api-key-assignment", "access-token-assignment", "password-assignment", "bearer-token"],
  };
  global.Integration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
