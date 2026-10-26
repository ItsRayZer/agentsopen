// AI Workspace v7.2 — Cloudflare cloud merge, additive layer on v7.1. LOCAL ONLY.
// FREE-ONLY: Cloudflare Workers free plan + KV, workers.dev only, public packs only.
// Local storage remains the primary store; cloud packs are published copies only.
// No private cloud storage, no auth, no key fields, no live model calls, no paid
// features, no kill button, no skill-switch. Private notes/prompts/snippets must
// never be published through this view.
(function () {
  'use strict';
  const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const sl = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
  const CLOUD_BASE = 'https://ai-workspace-cloud.mrabensojan.workers.dev';
  const OWN_KEY = 'ai-workspace_cloud_own';
  const IMPORTS_KEY = 'ai-workspace_cloud_imports';
  const MAX_PACK_BYTES = 102400;
  // Canonical secret-pattern mirror (site/secret-patterns.json, block tier only
  // blocks; email-address is WARNING tier only, never a block — Worker v2
  // behaviour, owner-accepted 2026-10-26: email warned-and-accepted, not
  // rejected. Patterns are named by rule so build-check can verify every
  // canonical rule name is present here. Hygiene check only, never a
  // general guarantee; values are never echoed.
  const BLOCK_PATTERNS = [
    { field: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { field: 'openai-key', re: /\bsk-[A-Za-z0-9]{12,}/ },
    { field: 'stripe-key', re: /\bsk_(live|test)_[A-Za-z0-9]{8,}/ },
    { field: 'github-token', re: /\bgh[pous]_[A-Za-z0-9]{20,}/ },
    { field: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}/ },
    { field: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
    { field: 'jwt', re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
    { field: 'api-key-assignment', re: /\bapi[_-]?key\s*[:=]\s*\S+/i },
    { field: 'access-token-assignment', re: /\b(access[_-]?token|client[_-]?secret)\s*[:=]\s*\S+/i },
    { field: 'password-assignment', re: /\bpassword\s*[:=]\s*\S+/i },
    { field: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9._-]{12,}/ },
  ];
  const WARNING_PATTERNS = [
    { field: 'email-address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  ];
  const TOKEN_KEY = 'ai-workspace_cloud_tokens';

  // ---------- Pure logic (node-testable) ----------
  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return String(text).length;
  }
  function validateCloudPack(pack, isPublic) {
    if (!isPublic) return { blocked: 'reason=not-marked-public | need=explicit-public-checkbox' };
    if (typeof pack !== 'string' || !pack.trimStart().startsWith('al:1')) {
      return { blocked: 'reason=pack-not-agentlang | need=pack-starting-with-al:1' };
    }
    if (byteLength(pack) > MAX_PACK_BYTES) {
      return { blocked: 'reason=pack-too-large | need=pack-under-100kb' };
    }
    // Data-class gate, compatible form (NOT Claude's dataclass: spelling):
    // a pack that carries a data-class line must be public to publish; a
    // pack with no data-class line is gated by the explicit public checkbox
    // above, which is the existing, live-tested publish flow. Blocking every
    // pack without a data-class line would break that flow, so it is not done.
    const dc = pack.match(/^data-class:\s*(\S+)/m);
    if (dc && dc[1] !== 'public') {
      return { blocked: 'reason=data-class-not-public | need=data-class: public-or-no-data-class-line' };
    }
    for (let i = 0; i < BLOCK_PATTERNS.length; i++) {
      if (BLOCK_PATTERNS[i].re.test(pack)) {
        return { blocked: 'reason=secret-pattern | need=public-pack-only | field=' + BLOCK_PATTERNS[i].field };
      }
    }
    const warnings = [];
    for (let i = 0; i < WARNING_PATTERNS.length; i++) {
      if (WARNING_PATTERNS[i].re.test(pack)) warnings.push(WARNING_PATTERNS[i].field);
    }
    return { ok: true, chars: pack.length, warnings };
  }
  function validateCloudId(id) {
    if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return { blocked: 'reason=pack-id-invalid | need=id-a-z-0-9-dash-underscore-max-64' };
    }
    return { ok: true, id };
  }
  function isOwnPack(ownIds, id) {
    return Array.isArray(ownIds) && ownIds.indexOf(id) !== -1;
  }
  function cloudPackAl(role, task, lines) {
    return ['al:1', 'agent: ai-workspace | role=' + role, 'task: ' + task + ' | status: done']
      .concat(lines || []).concat(['out: sync=local-only-by-default | cloud=cloudflare-free-public-packs-only | keys=none | paid-wired=none', 'next: cloud-list-or-import']);
  }
  function formatCloudList(list) {
    if (!list || !Array.isArray(list.packs)) return { blocked: 'reason=cloud-list-invalid | need=packs-array' };
    return {
      ok: true, count: list.packs.length,
      lines: list.packs.map((p) => 'note: cloud-pack id=' + sl(p.id) + ' | ts=' + sl(p.ts || p.createdAt || '') + ' | size=' + (p.size != null ? p.size : '')),
      note: 'kv-list-may-take-40s | direct-get-is-confirmation',
    };
  }
  function cloudImportRecord(pack) {
    const v = validateCloudPack(pack, true);
    if (v.blocked) return { blocked: v.blocked };
    return { ok: true, note: 'import-validated-al:1 | fed-to-agentlang-input | existing-validated-path' };
  }

  // ---------- DOM wiring (guarded) ----------
  function storeGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
  function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
  function setSync(text) { if ($('cloudSyncOut')) $('cloudSyncOut').textContent = text; }
  function setOut(text) { if ($('cloudOut')) $('cloudOut').textContent = text; }
  function cloud() { return (typeof window !== 'undefined' && window.AIWorkspaceCloud) ? window.AIWorkspaceCloud : null; }

  async function doPublish() {
    const pack = $('cloudPublishInput') ? $('cloudPublishInput').value : '';
    const isPublic = $('cloudPublicCheck') ? $('cloudPublicCheck').checked : false;
    const v = validateCloudPack(pack, isPublic);
    if (v.blocked) { setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + v.blocked); setSync('sync=local-only-by-default | cloud=unreachable'); return; }
    const api = cloud();
    if (!api) { setOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await api.publishPack(pack);
      const own = storeGet(OWN_KEY, []);
      if (out.id && own.indexOf(out.id) === -1) { own.push(out.id); storeSet(OWN_KEY, own); }
      // Worker v2 publish receipt carries a server delete token; store it
      // (id -> token) so delete can send it. Against Worker v1 there is no
      // token, and delete works tokenless as before — one UI, both Workers.
      if (out.id && out.deleteToken) {
        const toks = storeGet(TOKEN_KEY, {});
        toks[out.id] = out.deleteToken; storeSet(TOKEN_KEY, toks);
      }
      const warnLines = [];
      if (v.warnings && v.warnings.length) warnLines.push('out: warnings=' + v.warnings.join(',') + ' | tier=hygiene-only | note=not-a-block');
      if (out.warnings && out.warnings.length) warnLines.push('out: server-warnings=' + sl(out.warnings.map((w) => (w && w.field) || w).join(',')));
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-publish', [
        'out: published-id=' + sl(out.id) + ' | chars=' + v.chars + ' | warning=public-pack-only',
      ].concat(warnLines).concat([
        'out: note=kv-list-may-take-40s | direct-get-is-confirmation',
      ])).join('\n'));
    } catch (e) {
      const msg = String((e && e.message) || '');
      const cap = msg.indexOf('pack-cap-reached') >= 0;
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=' + (cap ? 'pack-cap-reached | need=delete-old-pack-or-raise-cap' : 'cloud-publish-failed | need=retry-or-stay-local') + ' | err=' + sl(msg));
    }
  }
  async function doList() {
    const api = cloud();
    if (!api) { setOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await api.listCloudPacks();
      const f = formatCloudList(out);
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-list', f.lines.concat([
        'out: count=' + f.count + ' | note=' + f.note,
      ])).join('\n'));
      if ($('cloudListOut')) {
        $('cloudListOut').textContent = (out.packs || []).map((p) => 'id=' + sl(p.id) + ' | ts=' + sl(p.ts || p.createdAt || '') + ' | size=' + (p.size != null ? p.size : '')).join('\n') || 'no-public-packs-listed';
      }
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-list-failed | need=retry-or-stay-local | err=' + sl(e && e.message));
    }
  }
  async function doImport() {
    const id = $('cloudImportId') ? $('cloudImportId').value.trim() : '';
    const v = validateCloudId(id);
    if (v.blocked) { setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + v.blocked); return; }
    const api = cloud();
    if (!api) { setOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await api.importCloudPack(id);
      const rec = cloudImportRecord(out.pack);
      if (rec.blocked) { setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + rec.blocked); return; }
      // Feed through the existing validated AgentLang path: place the pack in
      // the agentlang input and run its existing validate-and-show handler.
      if ($('alInput')) $('alInput').value = out.pack;
      if ($('alToLangBtn')) $('alToLangBtn').click();
      const imports = storeGet(IMPORTS_KEY, []);
      imports.push({ id, ts: new Date().toISOString() });
      storeSet(IMPORTS_KEY, imports);
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-import', [
        'out: imported-id=' + sl(id) + ' | chars=' + out.pack.length + ' | note=fed-to-agentlang-input-validated-path',
        'out: agentlang-out=see-agentlang-view',
      ]).join('\n'));
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-import-failed | need=valid-public-pack-id | err=' + sl(e && e.message));
    }
  }
  async function doDelete() {
    const id = $('cloudDeleteId') ? $('cloudDeleteId').value.trim() : '';
    const v = validateCloudId(id);
    if (v.blocked) { setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + v.blocked); return; }
    const own = storeGet(OWN_KEY, []);
    if (!isOwnPack(own, id)) {
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=not-own-pack | need=own-published-id');
      return;
    }
    const api = cloud();
    if (!api) { setOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const toks = storeGet(TOKEN_KEY, {});
      await api.deleteCloudPack(id, toks[id] || null);
      storeSet(OWN_KEY, own.filter((x) => x !== id));
      if (toks[id]) { delete toks[id]; storeSet(TOKEN_KEY, toks); }
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-delete', ['out: deleted-id=' + sl(id) + ' | note=own-pack-only']).join('\n'));
    } catch (e) {
      const msg = String((e && e.message) || '');
      const tokErr = msg.indexOf('delete-token-required') >= 0 ? 'delete-token-required | need=republish-to-get-token' : (msg.indexOf('delete-token-invalid') >= 0 ? 'delete-token-invalid | need=republish-to-get-token' : 'cloud-delete-failed | need=retry');
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=' + tokErr + ' | err=' + sl(msg));
    }
  }
  async function doHealth() {
    const api = cloud();
    if (!api) { setOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await api.health();
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-health', ['out: worker=' + sl(out.name) + ' | plan=' + sl(out.plan) + ' | storage=' + sl(out.storage) + ' | secrets=' + sl(out.secrets)]).join('\n'));
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-unreachable | need=retry-or-stay-local');
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const api = cloud();
      if (api && api.setBase) api.setBase(CLOUD_BASE);
      if ($('cloudPublishBtn')) $('cloudPublishBtn').onclick = doPublish;
      if ($('cloudListBtn')) $('cloudListBtn').onclick = doList;
      if ($('cloudImportBtn')) $('cloudImportBtn').onclick = doImport;
      if ($('cloudDeleteBtn')) $('cloudDeleteBtn').onclick = doDelete;
      if ($('cloudHealthBtn')) $('cloudHealthBtn').onclick = doHealth;
    });
  }

  if (typeof module !== 'undefined') module.exports = {
    CLOUD_BASE, MAX_PACK_BYTES, validateCloudPack, validateCloudId, isOwnPack,
    cloudPackAl, formatCloudList, cloudImportRecord,
  };
})();
