// ai-workspace-cloud client — merged in v7.2 (site/cloud.js, wired via cloud view + v72.js).
// PUBLIC PACKS ONLY — this snippet sends packs to a public, unauthenticated
// Worker. Private notes, prompts, snippets, and personal data must stay local
// and must never be passed to publishPack().
//
// Usage in the site (after merge):
//   AIWorkspaceCloud.setBase("https://ai-workspace-cloud.mrabensojan.workers.dev");
//   (setBase is optional — BASE above already holds the live URL.)
//   await AIWorkspaceCloud.publishPack(pack);
//   const list = await AIWorkspaceCloud.listCloudPacks();
//   const pack = await AIWorkspaceCloud.importCloudPack(list.packs[0].id);

(function (global) {
  "use strict";

  var PUBLIC_PACKS_WARNING =
    "Public packs only — private notes/prompts/snippets stay local, never publish them here.";

  // Live public workers.dev URL, deployed on the free plan.
  var BASE = "https://ai-workspace-cloud.mrabensojan.workers.dev";

  var MAX_PACK_BYTES = 102400;

  // Canonical secret-pattern mirror (site/secret-patterns.json). Block tier
  // blocks; email-address is WARNING tier only, never a block (Worker v2
  // behaviour, owner-accepted 2026-10-26). Hygiene check only, never a
  // general guarantee; values are never echoed. Named by rule so the build
  // check can verify every canonical rule name is present.
  var BLOCK_PATTERNS = [
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
  var WARNING_PATTERNS = [
    { field: "email-address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ }
  ];

  function byteLength(text) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(text).length;
    }
    return text.length;
  }

  function validatePack(pack) {
    if (typeof pack !== "string" || !pack.trimStart().startsWith("al:1")) {
      throw new Error("blocked: reason=pack-not-agentlang | need=pack-starting-with-al:1");
    }
    if (byteLength(pack) > MAX_PACK_BYTES) {
      throw new Error("blocked: reason=pack-too-large | need=pack-under-100kb");
    }
    for (var i = 0; i < BLOCK_PATTERNS.length; i++) {
      if (BLOCK_PATTERNS[i].re.test(pack)) {
        throw new Error("blocked: reason=secret-pattern | need=public-pack-only | field=" + BLOCK_PATTERNS[i].field);
      }
    }
  }

  function clientWarnings(pack) {
    var out = [];
    for (var i = 0; i < WARNING_PATTERNS.length; i++) {
      if (WARNING_PATTERNS[i].re.test(pack)) out.push(WARNING_PATTERNS[i].field);
    }
    return out;
  }

  function dataClassNotPublic(pack) {
    var m = String(pack).match(/^data-class:\s*(\S+)/m);
    return !!(m && m[1] !== "public");
  }

  async function requestJson(path, options) {
    var res;
    try {
      res = await fetch(BASE + path, options);
    } catch (e) {
      throw new Error("cloud=unreachable");
    }
    if (!res.ok) {
      var text = "";
      try {
        text = await res.text();
      } catch (e) {
        text = "";
      }
      throw new Error("cloud=cloudflare-free | http=" + res.status + " | " + text.slice(0, 200));
    }
    return res.json();
  }

  async function publishPack(pack, id) {
    validatePack(pack);
    // Data-class gate, compatible form: a pack carrying a data-class line
    // must be public; a pack with no data-class line is gated by the
    // caller's explicit public confirmation (v72 checkbox / aiws public=true).
    if (dataClassNotPublic(pack)) {
      throw new Error("blocked: reason=data-class-not-public | need=data-class: public-or-no-data-class-line");
    }
    var body = { pack: pack };
    if (id) {
      body.id = id;
    }
    var out = await requestJson("/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    out.sync = "cloud=cloudflare-free";
    out.warning = PUBLIC_PACKS_WARNING;
    out.clientWarnings = clientWarnings(pack);
    // Worker v2 receipt fields (deleteToken, warnings) pass through
    // untouched; Worker v1 simply has no such fields, which is fine.
    return out;
  }

  async function listCloudPacks() {
    var out = await requestJson("/packs", { method: "GET" });
    out.sync = "cloud=cloudflare-free";
    out.warning = PUBLIC_PACKS_WARNING;
    return out;
  }

  // Worker v2 search (metadata rows only, page 20, cursor). Board use:
  // searchCloudPacks("thread=<thread-id>") lists one thread's packs by
  // body match, then importCloudPack(id) reads each message. No new
  // endpoint: this is the existing GET /search route. NOTE: Worker v2
  // /search returns PLAIN TEXT lines (total=... nextCursor=... then
  // one row per pack), not JSON, so this parser reads text. A JSON
  // body (older mocks) is accepted as a fallback and normalised to
  // the same shape, so callers never depend on the wire format.
  function parseSearchText(text) {
    var lines = String(text || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var total = 0, nextCursor = "";
    var packs = [];
    lines.forEach(function (l) {
      var tm = l.match(/^total=(\d+).*nextCursor=(\S*)/);
      if (tm) { total = parseInt(tm[1], 10); nextCursor = tm[2] || ""; return; }
      var rm = l.match(/^(\S+) storedAt=(\d+) sizeBytes=(\d+) sizeChars=(\d+) supersedes=(\S+)$/);
      if (rm) packs.push({ id: rm[1], storedAt: parseInt(rm[2], 10), sizeBytes: parseInt(rm[3], 10), sizeChars: parseInt(rm[4], 10), supersedes: rm[5] === "none" ? null : rm[5] });
    });
    return { total: total, nextCursor: nextCursor, packs: packs };
  }
  async function requestText(path, options) {
    var res;
    try {
      res = await fetch(BASE + path, options);
    } catch (e) {
      throw new Error("cloud=unreachable");
    }
    if (!res.ok) {
      var text = "";
      try {
        text = await res.text();
      } catch (e) {
        text = "";
      }
      throw new Error("cloud=cloudflare-free | http=" + res.status + " | " + text.slice(0, 200));
    }
    return res.text();
  }
  async function searchCloudPacks(q, cursor) {
    var path = "/search?q=" + encodeURIComponent(q || "");
    if (cursor) path += "&cursor=" + encodeURIComponent(cursor);
    var out;
    try {
      out = parseSearchText(await requestText(path, { method: "GET" }));
    } catch (e) {
      // Fallback for JSON-shaped responses (older mocks / future JSON):
      // reuse requestJson only if the text path failed to produce rows
      // AND the error is a parse failure, never to hide an HTTP error.
      if (String(e && e.message).indexOf("cloud=cloudflare-free | http=") === 0) throw e;
      var j = await requestJson(path, { method: "GET" });
      out = { total: (j && j.total) || (j && j.packs ? j.packs.length : 0), nextCursor: (j && j.nextCursor) || "", packs: (j && j.packs) || [] };
    }
    out.sync = "cloud=cloudflare-free";
    out.warning = PUBLIC_PACKS_WARNING;
    return out;
  }
  // All search pages for one query (cap 100 packs, page 20, so at most
  // 10 pages are ever fetched). Used by the board feed and thread
  // views; KV lag means a fresh page is best-effort, not real-time.
  async function searchAllCloudPacks(q) {
    var all = [], cursor = "", total = 0, pages = 0;
    do {
      var page = await searchCloudPacks(q, cursor);
      total = page.total || total;
      all = all.concat(page.packs || []);
      cursor = page.nextCursor || "";
      pages++;
    } while (cursor && pages < 10);
    return { total: total, packs: all };
  }
  // Board login routes (Worker v2 private registry, prototype + live
  // after the parent redeploys it). The coded name is sent ONLY here,
  // never in a pack, never in a feed row, never in a log. Responses
  // carry the username ONLY — never the code, never its hash, never
  // a mapping list.
  async function boardLogin(code) {
    var out = await requestJson("/board-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code }) });
    return out;
  }
  async function boardRegister(code, username) {
    var out = await requestJson("/board-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, username: username }) });
    return out;
  }
  // Verified board post: the Worker checks the code against the
  // private registry, checks the pack author equals the registered
  // username, and only then stores the pack with the server-added
  // field board-verified=yes. A pack posted through public /packs
  // carries no such field and is UNVERIFIED by design.
  async function boardPostPack(code, pack) {
    var out = await requestJson("/board-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, pack: pack }) });
    return out;
  }

  async function importCloudPack(id) {
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw new Error("blocked: reason=pack-id-invalid | need=id-a-z-0-9-dash-underscore-max-64");
    }
    var out = await requestJson("/packs/" + encodeURIComponent(id), { method: "GET" });
    validatePack(out.pack);
    out.sync = "cloud=cloudflare-free";
    out.warning = PUBLIC_PACKS_WARNING;
    return out;
  }

  async function deleteCloudPack(id, token) {
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw new Error("blocked: reason=pack-id-invalid | need=id-a-z-0-9-dash-underscore-max-64");
    }
    // Worker v2 requires X-Delete-Token from the publish receipt; Worker v1
    // accepts anyone-with-id and ignores the header. Sending the token when
    // present, and omitting it when absent, makes one client work against
    // both Workers across the site-first deploy order.
    var headers = {};
    if (token) headers["X-Delete-Token"] = token;
    var out = await requestJson("/packs/" + encodeURIComponent(id), { method: "DELETE", headers: headers });
    out.sync = "cloud=cloudflare-free";
    return out;
  }

  async function health() {
    var out = await requestJson("/", { method: "GET" });
    out.sync = "cloud=cloudflare-free";
    return out;
  }

  var api = {
    PUBLIC_PACKS_WARNING: PUBLIC_PACKS_WARNING,
    setBase: function (url) {
      BASE = String(url).replace(/\/+$/, "");
    },
    getBase: function () {
      return BASE;
    },
    publishPack: publishPack,
    listCloudPacks: listCloudPacks,
    searchCloudPacks: searchCloudPacks,
    searchAllCloudPacks: searchAllCloudPacks,
    parseSearchText: parseSearchText,
    boardLogin: boardLogin,
    boardRegister: boardRegister,
    boardPostPack: boardPostPack,
    importCloudPack: importCloudPack,
    deleteCloudPack: deleteCloudPack,
    health: health,
  };

  global.AIWorkspaceCloud = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
