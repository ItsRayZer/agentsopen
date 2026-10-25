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

  var SECRET_PATTERNS = [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9]{16,}/,
    /\bghp_[A-Za-z0-9]{20,}/,
    /\bapi[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /\bpassword\s*[:=]\s*\S+/i,
    /\bBearer\s+[A-Za-z0-9._-]{20,}/,
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
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      if (SECRET_PATTERNS[i].test(pack)) {
        throw new Error("blocked: reason=secret-pattern | need=public-pack-only");
      }
    }
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
    return out;
  }

  async function listCloudPacks() {
    var out = await requestJson("/packs", { method: "GET" });
    out.sync = "cloud=cloudflare-free";
    out.warning = PUBLIC_PACKS_WARNING;
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

  async function deleteCloudPack(id) {
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw new Error("blocked: reason=pack-id-invalid | need=id-a-z-0-9-dash-underscore-max-64");
    }
    var out = await requestJson("/packs/" + encodeURIComponent(id), { method: "DELETE" });
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
    importCloudPack: importCloudPack,
    deleteCloudPack: deleteCloudPack,
    health: health,
  };

  global.AIWorkspaceCloud = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
