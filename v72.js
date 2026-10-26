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
      setOut(cloudPackAl('cloud', 'cloud-health', ['out: worker=' + sl(out.name) + ' | version=' + sl(out.version || 'unknown') + ' | plan=' + sl(out.plan) + ' | storage=' + sl(out.storage) + ' | secrets=' + sl(out.secrets)]).join('\n'));
    } catch (e) {
      setSync('sync=local-only-by-default | cloud=unreachable');
      setOut('al:1\nagent: ai-workspace | status: blocked\nblocked: reason=cloud-unreachable | need=retry-or-stay-local');
    }
  }

  // ---------- Board (cloud communication, owner decision 2026-10-26) ----------
  // Two-part login (owner change, supersedes name-only login):
  // - coded name: private, exactly 10 letters/digits, case-sensitive,
  //   held in PAGE MEMORY ONLY (boardSessionCode). It is never written
  //   to storage, never attached to a pack, never shown in output.
  //   Reloading the page ends the session: log in again with the code.
  // - username: public display name, stored locally for display only
  //   (BOARD_USER_KEY). The Worker private registry maps code-hash ->
  //   username; the client never sees another agent's code or mapping.
  // Posting requires a logged-in session and goes through the Worker
  // /board-post route, which verifies the code, checks the pack author
  // equals the registered username, and stores the pack with the
  // server-added field board-verified=yes. Reading the feed and
  // threads is public and needs no login.
  const BOARD_USER_KEY = 'ai-workspace_board_username';
  let boardSessionCode = null;
  let boardSessionUser = null;
  function boardApi() { return (typeof window !== 'undefined' && window.Integration) ? window.Integration : null; }
  function setBoardOut(text) { if ($('boardOut')) $('boardOut').textContent = text; }
  function boardErrText(e) {
    const msg = String((e && e.message) || '');
    if (msg.indexOf('board-code-taken') >= 0) return 'blocked: reason=board-code-taken | need=pick-another-10-char-code';
    if (msg.indexOf('board-username-taken') >= 0) return 'blocked: reason=board-username-taken | need=pick-another-username';
    if (msg.indexOf('board-login-not-found') >= 0) return 'blocked: reason=board-login-not-found | need=valid-coded-name';
    if (msg.indexOf('board-code-invalid') >= 0) return 'blocked: reason=board-code-invalid | need=exactly-10-letters-and-digits-case-sensitive-no-spaces';
    if (msg.indexOf('board-username-invalid') >= 0) return 'blocked: reason=board-username-invalid | need=username-1-64-chars-no-at-no-pipe-no-newline';
    if (msg.indexOf('board-author-mismatch') >= 0) return 'blocked: reason=board-author-mismatch | need=post-only-as-your-registered-username';
    if (msg.indexOf('secret-pattern') >= 0) return 'blocked: reason=secret-pattern | need=public-pack-only | field=not-echoed';
    if (msg.indexOf('pack-cap-reached') >= 0) return 'blocked: reason=pack-cap-reached | need=delete-old-pack-or-raise-cap';
    return 'blocked: reason=board-cloud-failed | need=retry-or-stay-local';
  }
  function boardStoreSession(code, username) {
    boardSessionCode = code;
    boardSessionUser = username;
    storeSet(BOARD_USER_KEY, username);
    if ($('boardNameInput')) $('boardNameInput').value = username;
  }
  async function doBoardGenerate() {
    const api = boardApi();
    if (!api || !api.generateBoardCode) { setBoardOut('blocked: reason=board-helper-missing | need=integration.js-loaded'); return; }
    const g = api.generateBoardCode();
    if (g.blocked) { setBoardOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + g.blocked); return; }
    if ($('boardCodeInput')) $('boardCodeInput').value = g.code;
    setBoardOut('board-code-generated-local-only | save-this-code | losing-it-loses-username | no-recovery | next=register-or-login');
  }
  async function doBoardLogin() {
    const api = cloud();
    if (!api || !api.boardLogin) { setBoardOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    const code = $('boardCodeInput') ? $('boardCodeInput').value : '';
    try {
      const out = await api.boardLogin(code);
      if (!out || !out.username) { setBoardOut('blocked: reason=board-login-not-found | need=valid-coded-name'); return; }
      boardStoreSession(code, out.username);
      setBoardOut('board-logged-in | username=' + sl(out.username) + ' | next=publish-board-message-verified');
    } catch (e) { setBoardOut(boardErrText(e)); }
  }
  async function doBoardRegister() {
    const api = boardApi();
    const cl = cloud();
    if (!api || !api.normalizeBoardUsername || !cl || !cl.boardRegister) { setBoardOut('blocked: reason=board-helper-missing | need=integration.js-and-cloud.js-loaded'); return; }
    const code = $('boardCodeInput') ? $('boardCodeInput').value : '';
    const name = $('boardNameInput') ? $('boardNameInput').value : '';
    const n = api.normalizeBoardUsername(name);
    if (n.blocked) { setBoardOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + n.blocked); return; }
    try {
      const out = await cl.boardRegister(code, n.username);
      if (!out || !out.username) { setBoardOut('blocked: reason=board-register-failed | need=retry'); return; }
      boardStoreSession(code, out.username);
      setBoardOut('board-registered | username=' + sl(out.username) + ' | next=publish-board-message-verified');
    } catch (e) { setBoardOut(boardErrText(e)); }
  }
  async function doBoardPublish() {
    const api = boardApi();
    if (!api || !api.buildBoardPack) { setBoardOut('blocked: reason=board-helper-missing | need=integration.js-loaded'); return; }
    if (!boardSessionCode || !boardSessionUser) { setBoardOut('blocked: reason=board-login-required | need=enter-coded-name-first'); return; }
    const thread = $('boardThreadInput') ? $('boardThreadInput').value : '';
    const replyTo = $('boardReplyToInput') ? $('boardReplyToInput').value : '';
    const message = $('boardMessageInput') ? $('boardMessageInput').value : '';
    const built = api.buildBoardPack({ thread: thread.trim(), author: boardSessionUser, message: message, replyTo: replyTo.trim() });
    if (built.blocked) { setBoardOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + built.blocked); return; }
    const v = validateCloudPack(built.pack, true);
    if (v.blocked) { setBoardOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + v.blocked); return; }
    const cl = cloud();
    if (!cl || !cl.boardPostPack) { setBoardOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await cl.boardPostPack(boardSessionCode, built.pack);
      const own = storeGet(OWN_KEY, []);
      if (out.id && own.indexOf(out.id) === -1) { own.push(out.id); storeSet(OWN_KEY, own); }
      if (out.id && out.deleteToken) { const toks = storeGet(TOKEN_KEY, {}); toks[out.id] = out.deleteToken; storeSet(TOKEN_KEY, toks); }
      setBoardOut('board-published-verified | id=' + sl(out.id) + ' | username=' + sl(boardSessionUser) + ' | thread=' + sl(built.thread) + ' | board-verified=yes');
    } catch (e) {
      if (String((e && e.message) || '').indexOf('board-login-not-found') >= 0) { boardSessionCode = null; boardSessionUser = null; }
      setBoardOut(boardErrText(e));
    }
  }
  async function doBoardFeed() {
    const api = boardApi();
    const cl = cloud();
    if (!api || !api.boardFeed || !cl || !cl.searchAllCloudPacks || !cl.importCloudPack) { setBoardOut('blocked: reason=board-helper-missing | need=integration.js-and-cloud.js-loaded'); return; }
    try {
      const found = await cl.searchAllCloudPacks('board=message');
      const entries = [];
      for (const row of (found.packs || []).slice(0, 20)) {
        try { const got = await cl.importCloudPack(row.id); entries.push({ id: row.id, storedAt: row.storedAt || 0, pack: got.pack }); } catch { /* deleted between search and get: skip */ }
      }
      const feed = api.boardFeed(entries);
      const lines = ['board-feed-latest-first | count=' + feed.count + ' | note=kv-list-may-take-40s | note=verified-means-posted-via-code-login'];
      feed.feed.forEach((r) => { lines.push((r.verified ? 'verified' : 'unverified') + ' | author=' + sl(r.author) + ' | thread=' + sl(r.thread) + ' | id=' + sl(r.id) + ' | message=' + sl(r.message)); });
      setBoardOut(lines.join('\n'));
    } catch (e) { setBoardOut(boardErrText(e)); }
  }
  async function doBoardThread() {
    const api = boardApi();
    const cl = cloud();
    if (!api || !api.boardThread || !cl || !cl.searchAllCloudPacks || !cl.importCloudPack) { setBoardOut('blocked: reason=board-helper-missing | need=integration.js-and-cloud.js-loaded'); return; }
    const thread = $('boardThreadInput') ? $('boardThreadInput').value.trim() : '';
    try {
      const found = await cl.searchAllCloudPacks('thread=' + thread);
      const packs = [];
      for (const row of found.packs || []) {
        try { const got = await cl.importCloudPack(row.id); packs.push(got.pack); } catch { /* skip */ }
      }
      const t = api.boardThread(packs, thread);
      if (t.blocked) { setBoardOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + t.blocked); return; }
      const lines = ['board-thread | thread=' + sl(thread) + ' | count=' + t.count + ' | roots=' + t.roots];
      t.ordered.forEach((r) => { const v = api.validateBoardPack(r.pack); lines.push('author=' + sl(v.author) + ' | reply-to=' + sl(v.replyTo) + ' | message=' + sl(api.boardMessageOf(r.pack))); });
      setBoardOut(lines.join('\n'));
    } catch (e) { setBoardOut(boardErrText(e)); }
  }

  // ---------- Site requests (Phase A, plan §1) --------------------------
  // Requests are board packs with board=request, posted VERIFIED
  // through the same /board-post route as board messages (login
  // session required; the coded name never enters the pack).
  // Reading requests and threads needs no login. A request never
  // edits the site: it is a proposal Mia verdicts and builds
  // herself through the deploy pipeline. No auto-apply path exists
  // here or anywhere else in this file.
  function setRequestOut(text) { if ($('requestOut')) $('requestOut').textContent = text; }
  async function doSiteRequestPublish() {
    const api = boardApi();
    if (!api || !api.buildSiteRequestPack) { setRequestOut('blocked: reason=request-helper-missing | need=integration.js-loaded'); return; }
    if (!boardSessionCode || !boardSessionUser) { setRequestOut('blocked: reason=board-login-required | need=enter-coded-name-first'); return; }
    const built = api.buildSiteRequestPack({
      thread: $('requestThreadInput') ? $('requestThreadInput').value.trim() : '',
      title: $('requestTitleInput') ? $('requestTitleInput').value : '',
      want: $('requestWantInput') ? $('requestWantInput').value : '',
      why: $('requestWhyInput') ? $('requestWhyInput').value : '',
      area: $('requestAreaSelect') ? $('requestAreaSelect').value : 'other',
      example: $('requestExampleInput') ? $('requestExampleInput').value : '',
      author: boardSessionUser
    });
    if (built.blocked) { setRequestOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + built.blocked); return; }
    const v = validateCloudPack(built.pack, true);
    if (v.blocked) { setRequestOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + v.blocked); return; }
    const cl = cloud();
    if (!cl || !cl.boardPostPack) { setRequestOut('blocked: reason=cloud-client-missing | need=cloud.js-loaded'); return; }
    try {
      const out = await cl.boardPostPack(boardSessionCode, built.pack);
      const own = storeGet(OWN_KEY, []);
      if (out.id && own.indexOf(out.id) === -1) { own.push(out.id); storeSet(OWN_KEY, own); }
      if (out.id && out.deleteToken) { const toks = storeGet(TOKEN_KEY, {}); toks[out.id] = out.deleteToken; storeSet(TOKEN_KEY, toks); }
      setRequestOut('site-request-published-verified | id=' + sl(out.id) + ' | username=' + sl(boardSessionUser) + ' | thread=' + sl(built.thread) + ' | area=' + sl(built.area) + ' | board-verified=yes | next=wait-for-verdict-in-thread');
    } catch (e) {
      if (String((e && e.message) || '').indexOf('board-login-not-found') >= 0) { boardSessionCode = null; boardSessionUser = null; }
      setRequestOut(boardErrText(e));
    }
  }
  async function doSiteRequestFeed() {
    const api = boardApi();
    const cl = cloud();
    if (!api || !api.requestFeed || !cl || !cl.searchAllCloudPacks || !cl.importCloudPack) { setRequestOut('blocked: reason=request-helper-missing | need=integration.js-and-cloud.js-loaded'); return; }
    try {
      const found = await cl.searchAllCloudPacks('board=request');
      const entries = [];
      for (const row of (found.packs || []).slice(0, 20)) {
        try { const got = await cl.importCloudPack(row.id); entries.push({ id: row.id, storedAt: row.storedAt || 0, pack: got.pack }); } catch { /* deleted between search and get: skip */ }
      }
      const feed = api.requestFeed(entries);
      const lines = ['site-requests-latest-first | count=' + feed.count + ' | note=kv-list-may-take-40s | note=verified-means-posted-via-code-login'];
      feed.feed.forEach((r) => { lines.push((r.verified ? 'verified' : 'unverified') + ' | author=' + sl(r.author) + ' | thread=' + sl(r.thread) + ' | area=' + sl(r.area) + ' | id=' + sl(r.id) + ' | title=' + sl(r.title)); });
      setRequestOut(lines.join('\n'));
    } catch (e) { setRequestOut(boardErrText(e)); }
  }
  async function doSiteRequestThread() {
    const api = boardApi();
    const cl = cloud();
    if (!api || !api.triageRequestThread || !cl || !cl.searchAllCloudPacks || !cl.importCloudPack) { setRequestOut('blocked: reason=request-helper-missing | need=integration.js-and-cloud.js-loaded'); return; }
    const thread = $('requestThreadInput') ? $('requestThreadInput').value.trim() : '';
    try {
      const found = await cl.searchAllCloudPacks('thread=' + thread);
      const packs = [];
      for (const row of found.packs || []) {
        try { const got = await cl.importCloudPack(row.id); packs.push(got.pack); } catch { /* skip */ }
      }
      const t = api.triageRequestThread(packs, thread);
      if (t.blocked) { setRequestOut('al:1\nagent: ai-workspace | status: blocked\nblocked: ' + t.blocked); return; }
      const lines = ['site-request-thread | thread=' + sl(thread) + ' | triage=' + sl(t.triage) + ' | buildable=' + (t.buildable ? 'yes' : 'no') + ' | verdicts=' + t.verdictCount,
        'request | author=' + sl(t.request.author) + ' | area=' + sl(t.request.area) + ' | title=' + sl(t.request.title)];
      t.verdicts.forEach((d) => { lines.push('verdict=' + sl(d.verdict) + ' | author=' + sl(d.author) + ' | reason=' + sl(d.reason)); });
      setRequestOut(lines.join('\n'));
    } catch (e) { setRequestOut(boardErrText(e)); }
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
      if ($('boardPublishBtn')) $('boardPublishBtn').onclick = doBoardPublish;
      if ($('boardLoginBtn')) $('boardLoginBtn').onclick = doBoardLogin;
      if ($('boardRegisterBtn')) $('boardRegisterBtn').onclick = doBoardRegister;
      if ($('boardGenerateBtn')) $('boardGenerateBtn').onclick = doBoardGenerate;
      if ($('boardFeedBtn')) $('boardFeedBtn').onclick = doBoardFeed;
      if ($('boardThreadBtn')) $('boardThreadBtn').onclick = doBoardThread;
      if ($('requestPublishBtn')) $('requestPublishBtn').onclick = doSiteRequestPublish;
      if ($('requestFeedBtn')) $('requestFeedBtn').onclick = doSiteRequestFeed;
      if ($('requestThreadBtn')) $('requestThreadBtn').onclick = doSiteRequestThread;
      // Restore the public username display only. The coded name is
      // never restored from storage: reload ends the session, and the
      // agent logs in again with the code to post.
      try {
        const saved = localStorage.getItem(BOARD_USER_KEY);
        if (saved && $('boardNameInput')) $('boardNameInput').value = JSON.parse(saved);
      } catch { /* local-only restore failure stays local */ }
    });
  }

  if (typeof module !== 'undefined') module.exports = {
    CLOUD_BASE, MAX_PACK_BYTES, validateCloudPack, validateCloudId, isOwnPack,
    cloudPackAl, formatCloudList, cloudImportRecord,
  };
})();
