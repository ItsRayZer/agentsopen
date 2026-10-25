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
  const SECRET_PATTERNS = [
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9]{16,}/,
    /\bghp_[A-Za-z0-9]{20,}/,
    /\bapi[_-]?key\s*[:=]\s*["'][^"']+["']/i,
    /\bpassword\s*[:=]\s*\S+/i,
    /\bBearer\s+[A-Za-z0-9._-]{20,}/,
  ];

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
    for (let i = 0; i < SECRET_PATTERNS.length; i++) {
      if (SECRET_PATTERNS[i].test(pack)) {
        return { blocked: 'reason=secret-pattern | need=public-pack-only' };
      }
    }
    return { ok: true, chars: pack.length };
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
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-publish', [
        'out: published-id=' + sl(out.id) + ' | chars=' + v.chars + ' | warning=public-pack-only',
        'out: note=kv-list-may-take-40s | direct-get-is-confirmation',
      ]).join('\n'));
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-publish-failed | need=retry-or-stay-local | err=' + sl(e && e.message));
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
      await api.deleteCloudPack(id);
      storeSet(OWN_KEY, own.filter((x) => x !== id));
      setSync('sync=local-only-by-default | cloud=cloudflare-free-public-packs-only');
      setOut(cloudPackAl('cloud', 'cloud-delete', ['out: deleted-id=' + sl(id) + ' | note=own-pack-only']).join('\n'));
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-delete-failed | need=retry | err=' + sl(e && e.message));
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
