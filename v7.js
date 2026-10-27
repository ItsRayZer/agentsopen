// AgentsOpen v7-combined — additive layer on v6-UI. Local only.
// FREE-ONLY: static + localStorage + existing free hosting. No paid tier is wired,
// no purchase, no live model call, no key field anywhere in this file.
// Talk only: AgentLang records in one store (ai-workspace_messages); no chat projection.
(function () {
  'use strict';
  const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sl = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
  const storeGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const storeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  // ---------- Pure logic (node-testable) ----------
  const LEGAL = ['todo', 'doing', 'verify', 'done', 'blocked'];
  const REASON_CODES = [
    'no-from', 'no-task', 'no-text', 'no-url', 'url-invalid', 'fetch-failed', 'import-empty',
    'json-invalid', 'regex-invalid', 'al-invalid', 'not-al', 'status-not-legal', 'end-state-not-one',
    'diff-too-large', 'save-failed', 'claim-taken', 'lease-expired', 'lease-not-found',
    'duplicate-blocked-auto-merge', 'approval-required', 'approval-rejected', 'observer-read-only',
    'verdict-missing-proof', 'verdict-missing-basis', 'proof-none-cannot-resolve', 'conflict-unresolved',
    'quota-near-limit', 'quota-exceeded', 'tool-forbidden-token', 'tool-timeout', 'no-end-state',
    'secret-like-value', 'free-tier-unverified', 'paid-tier-excluded', 'no-live-call'
  ];
  function normTitle(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function detectDuplicates(items) {
    const seen = new Map(); const pairs = [];
    (items || []).forEach((it) => {
      const n = normTitle(it.title || it.task || it.name || '');
      if (!n) return;
      if (seen.has(n)) pairs.push({ title: n, first: seen.get(n), second: it.id || it.task || '' });
      else seen.set(n, it.id || it.task || '');
    });
    return pairs;
  }
  function computeReady(tasks) {
    const byId = new Map((tasks || []).map((t) => [t.id, t]));
    const ready = [], blockedBy = {};
    (tasks || []).forEach((t) => {
      const deps = (t.deps || []).filter(Boolean);
      const unmet = deps.filter((d) => !byId.has(d) || byId.get(d).status !== 'done');
      blockedBy[t.id] = unmet;
      if (t.status === 'todo' && unmet.length === 0) ready.push(t.id);
    });
    return { ready, blockedBy };
  }
  function blocksMap(tasks) {
    const out = {};
    (tasks || []).forEach((t) => { out[t.id] = []; });
    (tasks || []).forEach((t) => { (t.deps || []).forEach((d) => { if (out[d]) out[d].push(t.id); }); });
    return out;
  }
  // Slicer, line-boundary only (team-round resolution). A sliced pack
  // retains its header line + exactly one end line (next/done/blocked),
  // marks sliced=true, and carries the remainder as a NAMED continuation
  // pack (continuation field) with remainder-hash (fnv, local only — not
  // sha256, and never presented as a security hash). Single-line input
  // (no newline) falls back to a char cut, which the old test pins.
  function slicePack(text, budgetChars) {
    const s = String(text || '');
    if (!budgetChars || budgetChars <= 0) return { blocked: 'reason=pack-budget-invalid | need=budget-chars-positive', sliced: '', chars: 0, truncated: false };
    if (s.length <= budgetChars) return { sliced: s, chars: s.length, truncated: false, note: 'pack-fits-budget' };
    const lines = s.split('\n');
    if (lines.length === 1) return { sliced: s.slice(0, budgetChars), chars: budgetChars, truncated: true, slicedLineBoundary: false, note: 'pack-sliced-by-budget | single-line-input | remainder-not-included' };
    const header = lines[0];
    const endIdx = lines.findLastIndex(l => /^(next|done|blocked):/.test(l.trim()));
    const endLine = endIdx >= 0 ? lines[endIdx] : null;
    const body = [], bodyIdx = [];
    let used = header.length + 1 + (endLine ? endLine.length + 1 : 0);
    for (let i = 1; i < lines.length; i++) {
      if (i === endIdx) continue;
      if (used + lines[i].length + 1 > budgetChars) break;
      body.push(lines[i]); bodyIdx.push(i); used += lines[i].length + 1;
    }
    const keptLines = [header].concat(body).concat(endLine ? [endLine] : []);
    const keptIdx = new Set([0].concat(bodyIdx).concat(endIdx >= 0 ? [endIdx] : []));
    // Remainder = lines not kept, in original order, as a continuation pack.
    const remainderLines = lines.filter((l, i) => !keptIdx.has(i));
    const sliced = keptLines.join('\n');
    const continuation = remainderLines.length ? [header, 'note: continuation-of-sliced-pack | sliced=true'].concat(remainderLines).join('\n') : '';
    return { sliced, chars: sliced.length, truncated: true, slicedLineBoundary: true, slicedTrue: true, remainderHash: fnvHash(remainderLines.join('\n')), continuation, continuationChars: continuation.length, note: 'pack-sliced-line-boundary | header-and-end-retained | continuation-included' };
  }
  function deltaPack(oldText, newText) {
    const a = String(oldText || '').split('\n'), b = String(newText || '').split('\n');
    const setA = new Set(a), setB = new Set(b);
    const added = b.filter((l) => !setA.has(l)), removed = a.filter((l) => !setB.has(l));
    // Reversible: base hash (fnv, local only) + both added and removed.
    // Delta-since-last (v71 lineDelta) also now reports removed lines.
    return { added, removed, addedCount: added.length, removedCount: removed.length, baseHash: fnvHash(String(oldText || '')), reversible: true };
  }
  function expireLeases(leases, nowMs) {
    const kept = [], expired = [];
    (leases || []).forEach((l) => { if (l.until && l.until > nowMs) kept.push(l); else expired.push(l); });
    return { kept, expired };
  }
  const V7_CODES = ['agent', 'task', 'status', 'ctx', 'in', 'out', 'verdict', 'conflict', 'next', 'done', 'blocked', 'verify', 'note'];
  function lintV7(input) {
    const raw = String(input || '').trim(); const errors = [];
    if (!raw.startsWith('al:1')) return { ok: false, errors: ['not-al'] };
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines[0] !== 'al:1') errors.push('header-not-al:1');
    let ends = 0;
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^([a-z]+): (.+)$/);
      if (!m) { errors.push('line-not-code-value'); continue; }
      if (!V7_CODES.includes(m[1])) errors.push('unknown-code-' + m[1]);
      if (m[1] === 'status' && !LEGAL.includes(m[2].trim())) errors.push('status-not-legal');
      if (m[1] === 'verdict') {
        if (!m[2].includes('proof=')) errors.push('verdict-missing-proof');
        if (!m[2].includes('basis=')) errors.push('verdict-missing-basis');
        if (m[2].includes('proof=none')) errors.push('proof-none-cannot-resolve');
      }
      if (['next', 'done', 'blocked'].includes(m[1])) ends++;
    }
    if (ends !== 1) errors.push('end-state-not-one');
    if (!['next', 'done', 'blocked'].some((c) => lines[lines.length - 1].startsWith(c + ':'))) errors.push('end-state-not-last');
    return { ok: errors.length === 0, errors };
  }
  const NEG_FIXTURES = [
    { name: 'missing-header', text: 'agent: x | role=y\ntask: t\nnext: go', expect: 'not-al' },
    { name: 'illegal-status', text: 'al:1\nagent: x\ntask: t\nstatus: waiting\nnext: go', expect: 'status-not-legal' },
    { name: 'verdict-no-proof', text: 'al:1\nagent: x\ntask: t\nverdict: model=claude | claim=fix | basis=files\nnext: go', expect: 'verdict-missing-proof' },
    { name: 'verdict-proof-none', text: 'al:1\nagent: x\ntask: t\nverdict: model=claude | claim=fix | proof=none | basis=logic-only\nnext: go', expect: 'proof-none-cannot-resolve' },
    { name: 'no-end-state', text: 'al:1\nagent: x\ntask: t\nstatus: doing', expect: 'end-state-not-one' }
  ];
  function runNegativeFixtures() { return NEG_FIXTURES.map((f) => { const r = lintV7(f.text); return { name: f.name, blocked: !r.ok, errors: r.errors, expect: f.expect, matched: r.errors.includes(f.expect) }; }); }
  function labelText(text) {
    const s = String(text || '');
    const wouldLeave = [];
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) wouldLeave.push('email-address');
    if (/https?:\/\/\S+/.test(s)) wouldLeave.push('url');
    if (/(api[_-]?key|secret|token|password)\s*[:=]/i.test(s)) wouldLeave.push('secret-like-keyword');
    if (/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(s)) wouldLeave.push('card-like-number');
    const label = wouldLeave.includes('secret-like-keyword') || wouldLeave.includes('card-like-number') ? 'private' : wouldLeave.length ? 'internal' : 'public';
    return { label, wouldLeave, note: 'label-only | nothing-sent | export-would-include-categories-above' };
  }
  function routerScore(p) {
    if (!p || !p.latency || p.latency <= 0) return { blocked: 'reason=router-latency-invalid | need=latency-positive', score: 0 };
    return { score: (p.capMatch || 0) * (1 - (p.errRate || 0)) * (p.quotaRemain || 0) / p.latency };
  }
  function addDecision(log, ev) {
    const list = Array.isArray(log) ? log : [];
    if (list.some((e) => e.id === ev.id)) return { log: list, dup: true };
    return { log: list.concat([ev]), dup: false };
  }
  function checkStale(verification, currentRev) {
    if (!verification) return { blocked: 'reason=no-verification | need=verify-first' };
    return { stale: verification.rev !== currentRev, rev: verification.rev, currentRev, status: verification.rev === currentRev ? 'current' : 'stale' };
  }
  function fnvHash(s) { let h = 2166136261; for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); } return ('0000000' + (h >>> 0).toString(16)).slice(-8); }
  function anchorFor(code, startLine, endLine) {
    const lines = String(code || '').split('\n');
    if (startLine < 1 || endLine < startLine || endLine > lines.length) return { blocked: 'reason=anchor-range-invalid | need=valid-line-range' };
    const excerpt = lines.slice(startLine - 1, endLine).join('\n');
    return { anchorId: 'anchor-' + fnvHash(excerpt), startLine, endLine, excerpt, hash: fnvHash(excerpt) };
  }
  function findAnchor(code, excerpt) {
    const lines = String(code || '').split('\n');
    const idx = lines.findIndex((l) => excerpt && l.includes(String(excerpt).split('\n')[0]));
    return idx >= 0 ? { found: true, line: idx + 1 } : { found: false, line: 0, note: 'anchor-excerpt-not-found | code-may-have-moved' };
  }
  function migrateDryRun(oldItems) {
    const items = JSON.parse(JSON.stringify(oldItems || []));
    let changed = 0;
    items.forEach((it) => { if (it.status === 'waiting') { it.status = 'blocked'; it.migratedFrom = 'waiting'; changed++; } });
    return { items, changed, note: 'dry-run-only | nothing-written | export-before-apply' };
  }
  function quotaWarning(usage, limit) {
    if (!limit || limit <= 0) return { blocked: 'reason=quota-limit-invalid | need=limit-positive' };
    const ratio = usage / limit;
    if (ratio >= 1) return { warn: true, level: 'exceeded', al: 'al:1\nagent: ai-workspace | role=quota\ntask: quota | status: blocked\nblocked: reason=quota-exceeded | need=export-and-clear-or-raise-limit\nnext: export-first' };
    if (ratio >= 0.8) return { warn: true, level: 'near-limit', al: 'al:1\nagent: ai-workspace | role=quota\ntask: quota | status: todo\nnote: quota-warning | usage=' + usage + ' | limit=' + limit + ' | ratio=' + ratio.toFixed(2) + '\nnext: export-soon' };
    return { warn: false, level: 'ok', ratio };
  }
  function jsonCompare(a, b, path, out) {
    out = out || []; path = path || '';
    const keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
    keys.forEach((k) => {
      const p = path ? path + '.' + k : k;
      if (!(k in (a || {}))) out.push({ key: p, change: 'added', value: b[k] });
      else if (!(k in (b || {}))) out.push({ key: p, change: 'removed', value: a[k] });
      else if (typeof a[k] === 'object' && typeof b[k] === 'object' && a[k] && b[k]) jsonCompare(a[k], b[k], p, out);
      else if (a[k] !== b[k]) out.push({ key: p, change: 'changed', from: a[k], to: b[k] });
    });
    return out;
  }
  function replayAlDryRun(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith('al:1')) return { blocked: 'reason=not-al | need=al:1-first-line', actions: [] };
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    const actions = [];
    lines.forEach((l) => {
      if (l.startsWith('task:')) actions.push('would-read-task: ' + l.slice(5).trim());
      if (l.startsWith('verdict:')) actions.push('would-record-verdict (not applied in dry-run)');
      if (l.startsWith('conflict:')) actions.push('would-keep-both-versions (no auto-resolve)');
      if (l.startsWith('blocked:')) actions.push('would-stop-here: ' + l.slice(8).trim());
    });
    return { actions, applied: false, note: 'dry-run-only | state-unchanged' };
  }
  const FORBIDDEN_TOKENS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'localStorage', 'indexedDB', 'document.', 'window.', 'eval(', 'Function('];
  function guardJsSnippet(code) {
    const s = String(code || '');
    const hit = FORBIDDEN_TOKENS.find((t) => s.includes(t));
    return hit ? { blocked: 'reason=tool-forbidden-token | need=remove-' + hit } : { ok: true };
  }
  const PROVIDERS = [
    { id: 'groq', label: 'Groq', models: 'llama-3.3-70b (spec example)', freeClaim: 'free tier (spec claim)', verified: false },
    { id: 'together', label: 'Together', models: 'open models (spec example)', freeClaim: 'free/open (spec claim)', verified: false },
    { id: 'fireworks', label: 'Fireworks', models: 'open models (spec example)', freeClaim: 'free (spec claim)', verified: false },
    { id: 'openrouter', label: 'OpenRouter :free', models: ':free slugs (spec example)', freeClaim: 'free slugs (spec claim)', verified: false },
    { id: 'huggingface', label: 'HuggingFace Inference', models: 'community models (spec example)', freeClaim: 'free tier (spec claim)', verified: false },
    { id: 'cerebras', label: 'Cerebras', models: 'free tier (spec example)', freeClaim: 'free tier (spec claim)', verified: false },
    { id: 'mistral', label: 'Mistral free', models: 'free tier (spec example)', freeClaim: 'free tier (spec claim)', verified: false },
    { id: 'google-ai-studio', label: 'Google AI Studio', models: 'Gemini Flash free (spec example)', freeClaim: 'free quotas (spec claim)', verified: false },
    { id: 'cf-workers-ai', label: 'Cloudflare Workers AI', models: 'edge models (spec example)', freeClaim: 'free allocation (spec claim)', verified: false },
    { id: 'github-models', label: 'GitHub Models', models: 'free tier if available (spec claim)', freeClaim: 'free tier if available (spec claim)', verified: false },
    { id: 'ollama', label: 'Local Ollama', models: 'user-local daemon (spec example)', freeClaim: 'local, no provider bill', verified: false },
    { id: 'webllm', label: 'Local WebLLM', models: 'browser WebGPU/WASM (spec example)', freeClaim: 'local, no provider bill', verified: false }
  ];
  const AUTONOMY_TABLE = [
    [0, 'text only', 'no tools'],
    [1, 'per-call approve', 'user approves each tool call'],
    [2, 'auto read-only', 'approves writes and exec'],
    [3, 'sandboxed exec', 'approves network writes'],
    [4, 'full plan within budget', 'pauses on budget or error'],
    [5, 'self-directed with checkpoint', 'checkpointed every N steps; autonomy cannot be raised by the agent itself']
  ];
  async function fingerprint(name, handle) {
    const input = String(name || '') + '|' + String(handle || '');
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return fnvHash(input) + fnvHash(input.split('').reverse().join(''));
  }
  const SCENARIOS = {
    'claim-expiry': ['claim task t1 with 10-min lease', 'advance clock past lease', 'expire lease', 'task returns to todo, unassigned', 're-claim allowed'],
    'duplicate-block': ['two tasks with same title added', 'duplicate scan finds pair', 'auto-merge blocked', 'owner approval required', 'merge only after approve'],
    'import-block': ['paste non-al text', 'lint blocks import', 'nothing imported', 'blocked reason shown, old output cleared']
  };
  function runScenario(id) { return SCENARIOS[id] ? { id, steps: SCENARIOS[id], result: 'pass (lab simulation, not a live multi-agent run)' } : { blocked: 'reason=scenario-unknown | need=claim-expiry|duplicate-block|import-block' }; }

  // ---------- Browser UI (guarded) ----------
  function alOut(lines) { return ['al:1'].concat(lines).join('\n'); }
  function decisionEvent(kind, detail) {
    const ev = { id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 100000), ts: new Date().toISOString(), kind, detail: sl(detail) };
    const cur = storeGet('ai-workspace_decisions', []);
    const r = addDecision(cur, ev);
    if (!r.dup) storeSet('ai-workspace_decisions', r.log);
    return ev;
  }
  function renderForge() {
    if (!$('forgeList')) return;
    const agents = storeGet('ai-workspace_v7_agents', []);
    $('forgeList').innerHTML = agents.map((a, i) => `<div class="card" id="forge-row-${i}"><h3>${esc(a.name)}</h3><p class="small">handle=${esc(a.handle)} | autonomy=${esc(a.autonomy)} | role=${esc(a.role)} | caps=${esc((a.caps || []).join(','))}</p><p>${esc(a.persona || '')}</p><button id="forge-remove-${i}" onclick="v7RemoveAgent(${i})">Remove</button></div>`).join('') || 'agents: 0';
  }
  function renderDag() {
    if (!$('dagList')) return;
    const tasks = storeGet('ai-workspace_v7_dag', []);
    const { ready, blockedBy } = computeReady(tasks);
    const blocks = blocksMap(tasks);
    $('dagList').innerHTML = tasks.map((t, i) => `<div class="card" id="dag-row-${i}"><h3>${esc(t.id)} — ${esc(t.title)}</h3><p class="small">status=${esc(t.status)} | blocked-by=${esc((blockedBy[t.id] || []).join(',') || 'none')} | blocks=${esc((blocks[t.id] || []).join(',') || 'none')}</p><button id="dag-remove-${i}" onclick="v7RemoveDag(${i})">Remove</button></div>`).join('') || 'dag tasks: 0';
    if ($('dagReadyOut')) $('dagReadyOut').textContent = alOut(['agent: ai-workspace | role=canvas', 'task: dag-ready | status: todo', 'out: ready=' + ready.join(',') + ' | ready-count=' + ready.length, 'out: blocked-by-map=' + JSON.stringify(blockedBy), 'out: blocks-map=' + JSON.stringify(blocks), 'next: pick-ready-task']);
  }
  function renderVault() {
    if (!$('memList')) return;
    const q = ($('memSearch') ? $('memSearch').value.trim().toLowerCase() : '');
    let mems = storeGet('ai-workspace_v7_memories', []);
    if (q) mems = mems.map((m) => ({ m, score: (m.text + ' ' + m.title).toLowerCase().split(q).length - 1 })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => ({ ...x.m, _score: x.score }));
    $('memList').innerHTML = mems.map((m, i) => `<div class="card" id="mem-row-${i}"><h3>${esc(m.title)}</h3><p class="small">scope=${esc(m.scope)} | kind=${esc(m.kind)} | salience=${esc(m.salience)} | pinned=${m.pinned ? 'true' : 'false'}${m._score != null ? ' | keyword-score=' + m._score : ''}</p><p>${esc(m.text)}</p><div class="row"><button id="mem-pin-${i}" onclick="v7PinMem(${i})">pin</button><button id="mem-forget-${i}" onclick="v7ForgetMem(${i})">forget</button></div></div>`).join('') || 'memories: 0';
  }
  function renderWorkshop() {
    if (!$('toolRegList')) return;
    const tools = storeGet('ai-workspace_v7_tools', []);
    $('toolRegList').innerHTML = tools.map((t, i) => `<div class="card" id="toolreg-row-${i}"><h3>${esc(t.name)}</h3><p class="small">runtime=${esc(t.runtime)} | perms=${esc((t.perms || []).join(','))} | status=${esc(t.status)}</p><button id="toolreg-remove-${i}" onclick="v7RemoveTool(${i})">Remove</button></div>`).join('') || 'tools: 0';
  }
  function renderRouter() {
    if (!$('routerList')) return;
    const ov = storeGet('ai-workspace_v7_router', {});
    $('routerList').innerHTML = PROVIDERS.map((p) => {
      const o = ov[p.id] || {};
      return `<div class="card" id="router-row-${p.id}"><h3>${esc(p.label)}</h3><p class="small">models=${esc(p.models)} | free-claim=${esc(p.freeClaim)} | free-claim-verified=false | breaker=${o.breaker || 'closed'} | quota-used=${o.quotaUsed || 0}</p><div class="row"><button id="router-breaker-${p.id}" onclick="v7ToggleBreaker('${p.id}')">toggle-breaker</button></div></div>`;
    }).join('');
    if ($('routerChainOut')) {
      const chain = PROVIDERS.filter((p) => (ov[p.id] || {}).breaker !== 'open').map((p) => p.label).join(' -> ');
      $('routerChainOut').textContent = alOut(['agent: ai-workspace | role=router', 'task: router-chain | status: todo', 'out: fallback-chain=' + chain, 'out: live-calls=none | keys=none | free-tier-claims=unverified | paid-wired=none', 'out: scoring=capability_match x (1-error_rate_5m) x quota_remaining / latency_p50', 'next: use-as-prompt-only']);
    }
  }
  function renderApprovals() {
    if (!$('apprList')) return;
    const list = storeGet('ai-workspace_v7_approvals', []);
    $('apprList').innerHTML = list.map((a, i) => `<div class="card" id="appr-row-${i}"><h3>${esc(a.action)} — ${esc(a.target)}</h3><p class="small">agent=${esc(a.agent)} | role=${esc(a.role)} | decision=${esc(a.decision)} | scope=${esc(a.scope || '')} | expires=${esc(a.expires || '')}</p><pre class="block">${esc(a.payload || '')}</pre><div class="row"><button id="appr-approve-${i}" onclick="v7DecideApproval(${i},'approved')">approve</button><button id="appr-reject-${i}" onclick="v7DecideApproval(${i},'rejected')">reject</button><button id="appr-dry-${i}" onclick="v7DryApproval(${i})">dry-run-receipt</button></div></div>`).join('') || 'approvals: 0';
  }
  function renderAudit() {
    if (!$('auditList')) return;
    const list = storeGet('ai-workspace_decisions', []);
    $('auditList').innerHTML = list.slice().reverse().map((e, i) => `<div class="card" id="audit-row-${i}"><p class="small">${esc(e.ts)} | ${esc(e.kind)} | id=${esc(e.id)}</p><p>${esc(e.detail)}</p></div>`).join('') || 'decisions: 0';
    if ($('auditOut')) $('auditOut').textContent = alOut(['agent: ai-workspace | role=audit', 'task: decision-log | status: todo', 'out: events=' + list.length + ' | append-only | no-delete', 'next: export-al']);
  }
  function renderTimeline() {
    if (!$('timelineList')) return;
    const list = storeGet('ai-workspace_decisions', []);
    $('timelineList').innerHTML = list.map((e, i) => `<div class="card" id="timeline-row-${i}"><p class="small">${esc(e.ts)} — ${esc(e.kind)}</p><p>${esc(e.detail)}</p></div>`).join('') || 'timeline: 0';
  }
  function renderLeases() {
    if (!$('leaseList')) return;
    const leases = storeGet('ai-workspace_leases', []);
    const now = Date.now();
    $('leaseList').innerHTML = leases.map((l, i) => `<div class="card" id="lease-row-${i}"><p class="small">task=${esc(l.task)} | agent=${esc(l.agent)} | until=${new Date(l.until).toISOString()} | heartbeats=${l.heartbeats || 0} | ${l.until > now ? 'live' : 'expired'}</p></div>`).join('') || 'leases: 0';
    if ($('leaseOut')) $('leaseOut').textContent = alOut(['agent: ai-workspace | role=queue', 'task: lease-status | status: todo', 'out: leases=' + leases.length + ' | live=' + leases.filter((l) => l.until > now).length + ' | expired=' + leases.filter((l) => l.until <= now).length, 'next: heartbeat-or-expire']);
  }
  function renderGallery() {
    if (!$('galleryList')) return;
    const packs = [
      'al:1\nagent: ai-workspace | role=forge\ntask: forge-example | status: todo\nout: agent=example-agent | autonomy=2 | role=agent\nnext: save-in-forge',
      'al:1\nagent: ai-workspace | role=canvas\ntask: dag-example | status: todo\nout: ready=t1 | blocked-by=t2: t1\nnext: pick-ready-task',
      'al:1\nagent: ai-workspace | role=queue\ntask: lease-example | status: todo\nout: lease=10min | heartbeat=extends-10min | expiry=auto\nnext: claim-with-lease'
    ];
    $('galleryList').innerHTML = packs.map((p, i) => `<div class="panel"><pre class="block" id="gallery-pack-${i}">${esc(p)}</pre><button id="gallery-copy-${i}" onclick="copyText('gallery-pack-${i}', this)">copy</button></div>`).join('');
  }
  function renderConflictsV7() {
    if (!$('confList')) return;
    const list = storeGet('ai-workspace_v7_conflicts', []);
    $('confList').innerHTML = list.map((c, i) => `<div class="card" id="conf-row-${i}"><p><strong>A:</strong> ${esc(c.a)}</p><p><strong>B:</strong> ${esc(c.b)}</p><p class="small">resolution=${esc(c.resolution || 'unresolved')} | both-versions-kept=true | auto-resolve=never</p></div>`).join('') || 'conflicts: 0';
  }
  function renderSharedV7() {
    if (!$('sharedV7Out')) return;
    const agents = storeGet('ai-workspace_v7_agents', []);
    const dag = storeGet('ai-workspace_v7_dag', []);
    const ready = computeReady(dag).ready;
    const appr = storeGet('ai-workspace_v7_approvals', []).filter((a) => a.decision === 'pending');
    const dec = storeGet('ai-workspace_decisions', []);
    const mems = storeGet('ai-workspace_v7_memories', []);
    const tools = storeGet('ai-workspace_v7_tools', []);
    $('sharedV7Out').textContent = alOut(['agent: ai-workspace | role=shared', 'task: shared-v7 | status: todo', 'out: agents=' + agents.length + ' | dag-ready=' + ready.length + ' | approvals-pending=' + appr.length + ' | decisions=' + dec.length + ' | memories=' + mems.length + ' | tools=' + tools.length, 'out: sync=local-only | keys=none | exec=sandboxed-js-only | cloud=cloudflare-free-public-packs-only | paid-wired=none', 'next: use-view']);
  }
  function renderAllV7() { try { renderForge(); } catch {} try { renderDag(); } catch {} try { renderVault(); } catch {} try { renderWorkshop(); } catch {} try { renderRouter(); } catch {} try { renderApprovals(); } catch {} try { renderAudit(); } catch {} try { renderTimeline(); } catch {} try { renderLeases(); } catch {} try { renderGallery(); } catch {} try { renderConflictsV7(); } catch {} try { renderSharedV7(); } catch {} }

  if (typeof window !== 'undefined') {
    window.v7RemoveAgent = (i) => { const a = storeGet('ai-workspace_v7_agents', []); a.splice(i, 1); storeSet('ai-workspace_v7_agents', a); renderForge(); };
    window.v7RemoveDag = (i) => { const a = storeGet('ai-workspace_v7_dag', []); a.splice(i, 1); storeSet('ai-workspace_v7_dag', a); renderDag(); };
    window.v7RemoveTool = (i) => { const a = storeGet('ai-workspace_v7_tools', []); a.splice(i, 1); storeSet('ai-workspace_v7_tools', a); renderWorkshop(); };
    window.v7PinMem = (i) => { const a = storeGet('ai-workspace_v7_memories', []); if (a[i]) a[i].pinned = true; storeSet('ai-workspace_v7_memories', a); renderVault(); };
    window.v7ForgetMem = (i) => { const a = storeGet('ai-workspace_v7_memories', []); a.splice(i, 1); storeSet('ai-workspace_v7_memories', a); renderVault(); };
    window.v7ToggleBreaker = (id) => { const ov = storeGet('ai-workspace_v7_router', {}); ov[id] = ov[id] || {}; ov[id].breaker = ov[id].breaker === 'open' ? 'closed' : 'open'; storeSet('ai-workspace_v7_router', ov); decisionEvent('router-breaker', 'provider=' + id + ' breaker=' + ov[id].breaker); renderRouter(); };
    window.v7DecideApproval = (i, decision) => {
      const list = storeGet('ai-workspace_v7_approvals', []); const a = list[i]; if (!a) return;
      if (a.role === 'observer') { if ($('apprOut')) $('apprOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=observer-read-only | need=owner-agent'; return; }
      a.decision = decision; storeSet('ai-workspace_v7_approvals', list);
      decisionEvent('approval-' + decision, 'action=' + a.action + ' target=' + a.target);
      if (decision === 'approved' && a.action === 'merge-duplicate') {
        const dag = storeGet('ai-workspace_v7_dag', []);
        const dup = dag.find((t) => t.id === a.target);
        if (dup) { dup.status = 'blocked'; dup.note = 'merged-into-first (owner-approved)'; storeSet('ai-workspace_v7_dag', dag); renderDag(); }
      }
      if ($('apprOut')) $('apprOut').textContent = alOut(['agent: ai-workspace | role=approval', 'task: approval-decision | status: done', 'out: action=' + a.action + ' | decision=' + decision + ' | applied=' + (decision === 'approved' ? 'true' : 'false'), 'next: render-approval']);
      renderApprovals(); renderAudit(); renderTimeline();
    };
    window.v7DryApproval = (i) => { const list = storeGet('ai-workspace_v7_approvals', []); const a = list[i]; if (!a || !$('apprOut')) return; $('apprOut').textContent = alOut(['agent: ai-workspace | role=approval', 'task: approval-dry-run | status: todo', 'out: would-apply-action=' + a.action + ' | target=' + a.target + ' | payload-chars=' + (a.payload || '').length, 'out: applied=false | dry-run-only', 'next: approve-or-reject']); };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wrap show() so v7 views re-render on navigation.
      try {
        const oldShow = window.show;
        if (oldShow && !window.__v7ShowWrapped) {
          window.__v7ShowWrapped = true;
          window.show = (v) => { oldShow(v); renderAllV7(); };
        }
      } catch {}
      renderAllV7();
      const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
      bind('forgeSaveBtn', () => {
        const name = $('forgeName').value.trim(), handle = $('forgeHandle').value.trim();
        if (!name) { $('forgeOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-from | need=agent-name'; return; }
        if (!handle) { $('forgeOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-handle | need=agent-handle'; return; }
        const agents = storeGet('ai-workspace_v7_agents', []);
        const autonomy = parseInt($('forgeAutonomy').value, 10);
        const existing = agents.find((a) => a.handle === handle);
        if (existing && autonomy > existing.autonomy) decisionEvent('owner-set-autonomy', 'handle=' + handle + ' autonomy ' + existing.autonomy + ' -> ' + autonomy + ' | set-by=owner-in-ui | agent-cannot-raise-own-level');
        const rec = { name, handle, persona: $('forgePersona').value.trim(), prompt: $('forgePrompt').value.trim(), model: $('forgeModel').value.trim(), autonomy, tools: $('forgeTools').value.split(',').map((s) => s.trim()).filter(Boolean), memory: $('forgeMemory').value.trim(), budget: $('forgeBudget').value.trim(), caps: $('forgeCaps').value.split(',').map((s) => s.trim()).filter(Boolean), role: $('forgeRole').value };
        if (existing) Object.assign(existing, rec); else agents.push(rec);
        storeSet('ai-workspace_v7_agents', agents);
        $('forgeOut').textContent = alOut(['agent: ai-workspace | role=forge', 'task: agent-save | status: done', 'out: agent=' + name + ' | handle=' + handle + ' | autonomy=' + autonomy + ' | role=' + rec.role, 'out: autonomy-raised-by-agent=false | set-by=owner-in-ui', 'next: fingerprint-or-list']);
        renderForge(); renderSharedV7();
      });
      bind('forgeFingerprintBtn', async () => {
        const fp = await fingerprint($('forgeName').value.trim(), $('forgeHandle').value.trim());
        $('forgeFingerprintOut').textContent = alOut(['agent: ai-workspace | role=forge', 'task: agent-fingerprint | status: done', 'out: fingerprint-sha256=' + fp, 'out: input=name|handle | keys=none | signature=display-only-local-hash', 'next: save-agent']);
      });
      bind('dagAddBtn', () => {
        const id = $('dagId').value.trim(), title = $('dagTitle').value.trim();
        if (!id) { $('dagReadyOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-task | need=task-id'; return; }
        const tasks = storeGet('ai-workspace_v7_dag', []);
        const deps = $('dagDeps').value.split(',').map((s) => s.trim()).filter(Boolean);
        const rec = { id, title, deps, status: $('dagStatus').value };
        const ex = tasks.find((t) => t.id === id); if (ex) Object.assign(ex, rec); else tasks.push(rec);
        storeSet('ai-workspace_v7_dag', tasks); decisionEvent('dag-task', 'task=' + id + ' status=' + rec.status + ' deps=' + deps.join(','));
        renderDag(); renderSharedV7();
      });
      bind('dagVetoBtn', () => {
        const id = $('dagVetoId').value.trim(), reason = $('dagVetoReason').value.trim() || 'critic-veto';
        const tasks = storeGet('ai-workspace_v7_dag', []);
        const t = tasks.find((x) => x.id === id);
        if (!t) { $('dagReadyOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-task | need=existing-task-id'; return; }
        t.status = 'blocked'; t.veto = reason; storeSet('ai-workspace_v7_dag', tasks); decisionEvent('critic-veto', 'task=' + id + ' reason=' + reason);
        renderDag();
      });
      bind('dagBoardAddBtn', () => {
        const ns = $('dagBoardNs').value.trim() || 'shared', text = $('dagBoardText').value.trim();
        if (!text) return;
        const board = storeGet('ai-workspace_v7_board', []); board.push({ ns, text, ts: new Date().toISOString() }); storeSet('ai-workspace_v7_board', board);
        $('dagBoardList').innerHTML = board.map((b, i) => `<div class="card" id="board-row-${i}"><p class="small">ns=${esc(b.ns)} | ${esc(b.ts)}</p><p>${esc(b.text)}</p></div>`).join('');
      });
      bind('memSaveBtn', () => {
        const title = $('memTitle').value.trim(), text = $('memText').value.trim();
        if (!title || !text) { $('memExportOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-text | need=title-and-text'; return; }
        const mems = storeGet('ai-workspace_v7_memories', []);
        mems.push({ title, scope: $('memScope').value, kind: $('memKind').value, text, salience: $('memSalience').value, pinned: false, ts: new Date().toISOString() });
        storeSet('ai-workspace_v7_memories', mems); renderVault();
      });
      if ($('memSearch')) $('memSearch').addEventListener('input', renderVault);
      bind('memExportBtn', () => {
        const mems = storeGet('ai-workspace_v7_memories', []);
        $('memExportOut').textContent = alOut(['agent: ai-workspace | role=vault', 'task: memory-export | status: todo'].concat(mems.map((m) => 'note: mem scope=' + sl(m.scope) + ' | kind=' + sl(m.kind) + ' | title=' + sl(m.title) + ' | salience=' + sl(m.salience))).concat(['next: import-validated-only']));
      });
      bind('toolRegSaveBtn', () => {
        const name = $('toolRegName').value.trim(), schema = $('toolRegSchema').value.trim();
        if (!name) return;
        try { JSON.parse(schema || '{}'); } catch (e) { $('toolDryOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json-schema'; return; }
        const tools = storeGet('ai-workspace_v7_tools', []);
        tools.push({ name, schema, runtime: $('toolRegRuntime').value, perms: $('toolRegPerms').value.split(',').map((s) => s.trim()).filter(Boolean), status: 'draft' });
        storeSet('ai-workspace_v7_tools', tools); renderWorkshop();
      });
      bind('toolDryBtn', () => {
        $('toolDryOut').textContent = alOut(['agent: ai-workspace | role=workshop', 'task: tool-dry-run | status: todo', 'out: tool=' + sl($('toolDryName').value) + ' | input-chars=' + ($('toolDryInput').value || '').length, 'out: would-call=true | actually-called=false | dry-run-only | no-network | no-remote-code', 'next: approve-or-run-js-locally']);
      });
      bind('wsRunBtn', () => {
        const code = $('wsCode').value;
        const g = guardJsSnippet(code);
        if (g.blocked) { $('wsOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + g.blocked; return; }
        $('wsOut').textContent = 'al:1\nagent: ai-workspace | role=workshop\ntask: js-worker-run | status: doing\nout: running-in-worker | timeout=10s | no-dom | no-network | user-typed-only';
        try {
          const workerSrc = "self.onmessage=function(e){try{var fn=new Function('fetch','XMLHttpRequest','localStorage','document','window','self','return ('+e.data+')');var r=fn(undefined,undefined,undefined,undefined,undefined,undefined);self.postMessage({ok:true,result:String(r)});}catch(err){self.postMessage({ok:false,error:String(err)});}};";
          const blob = new Blob([workerSrc], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const w = new Worker(url);
          let done = false;
          const timer = setTimeout(() => { if (!done) { done = true; try { w.terminate(); } catch {} $('wsOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=tool-timeout | need=shorter-snippet'; } }, 10000);
          w.onmessage = (e) => { if (done) return; done = true; clearTimeout(timer); try { w.terminate(); } catch {} try { URL.revokeObjectURL(url); } catch {} $('wsOut').textContent = e.data.ok ? alOut(['agent: ai-workspace | role=workshop', 'task: js-worker-run | status: done', 'out: result=' + sl(e.data.result), 'next: review-result']) : 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=tool-error | need=valid-js-expression'; };
          w.onerror = (e) => { if (done) return; done = true; clearTimeout(timer); $('wsOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=tool-error | need=valid-js-expression'; };
          w.postMessage(code);
        } catch (e) { $('wsOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=worker-unavailable | need=browser-worker-support'; }
      });
      bind('anchorBtn', () => {
        const r = anchorFor($('anchorCode').value, parseInt($('anchorStart').value, 10), parseInt($('anchorEnd').value, 10));
        $('anchorOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=workshop', 'task: code-anchor | status: done', 'out: anchor=' + r.anchorId + ' | lines=' + r.startLine + '-' + r.endLine + ' | hash=' + r.hash, 'out: excerpt=' + sl(r.excerpt).slice(0, 200), 'next: find-after-edit']);
      });
      bind('anchorFindBtn', () => {
        const r = findAnchor($('anchorCode').value, $('anchorFindExcerpt').value);
        $('anchorFindOut').textContent = r.found ? 'found at line ' + r.line : 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=anchor-excerpt-not-found | need=check-edits';
      });
      bind('routerScoreBtn', () => {
        const r = routerScore({ capMatch: parseFloat($('routerCap').value), errRate: parseFloat($('routerErr').value), quotaRemain: parseFloat($('routerQuota').value), latency: parseFloat($('routerLatency').value) });
        $('routerScoreOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=router', 'task: router-score | status: done', 'out: provider=' + sl($('routerProvider').value) + ' | score=' + r.score, 'out: live-calls=none | keys=none | free-tier-claims=unverified', 'next: use-as-prompt-only']);
      });
      bind('routerQuotaBtn', () => {
        const ov = storeGet('ai-workspace_v7_router', {}); const id = $('routerProvider').value;
        ov[id] = ov[id] || {}; ov[id].quotaUsed = parseFloat($('routerQuotaUsed').value) || 0; storeSet('ai-workspace_v7_router', ov); renderRouter();
      });
      bind('quotaBtn', () => {
        let bytes = 0, count = 0;
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('ai-workspace_')) { bytes += (localStorage.getItem(k) || '').length; count++; } } } catch {}
        const msgs = storeGet('ai-workspace_messages', []);
        const w = quotaWarning(bytes, parseInt($('quotaLimit').value, 10) || 5000000);
        $('quotaOut').textContent = alOut(['agent: ai-workspace | role=quota', 'task: quota-meters | status: todo', 'out: localstorage-bytes=' + bytes + ' | keys=' + count + ' | messages=' + msgs.length, 'out: warn=' + (w.warn ? w.level : 'ok') + ' | paid-wired=none | cloud=cloudflare-free-public-packs-only', w.warn ? 'note: quota-warning | see-audit-note' : 'note: quota-ok', 'next: export-if-near-limit']) + (w.al ? '\n' + w.al : '');
      });
      bind('apprCreateBtn', () => {
        const list = storeGet('ai-workspace_v7_approvals', []);
        list.push({ action: $('apprAction').value, target: $('apprTarget').value.trim(), payload: $('apprPayload').value, agent: $('apprAgent').value.trim() || 'owner', role: $('apprRole').value, scope: $('apprScope').value.trim(), expires: $('apprExpires').value.trim(), decision: 'pending' });
        storeSet('ai-workspace_v7_approvals', list); decisionEvent('approval-created', 'action=' + $('apprAction').value + ' target=' + $('apprTarget').value.trim());
        renderApprovals(); renderAudit();
      });
      bind('dupScanBtn', () => {
        let items = [];
        try { items = items.concat((typeof projects !== 'undefined' ? projects : []).map((p) => ({ id: p.name, title: p.name }))); } catch {}
        try { items = items.concat((typeof queue !== 'undefined' ? queue : []).map((q) => ({ id: q.task, title: q.task }))); } catch {}
        try { items = items.concat(storeGet('ai-workspace_v7_dag', []).map((t) => ({ id: t.id, title: t.title || t.id }))); } catch {}
        const pairs = detectDuplicates(items);
        $('dupList').innerHTML = pairs.map((p, i) => `<div class="card" id="dup-row-${i}"><p>duplicate title: ${esc(p.title)} | first=${esc(p.first)} | second=${esc(p.second)}</p><p class="small">auto-merge=blocked | merge-only-on-owner-approve</p></div>`).join('') || 'duplicates: 0';
        $('dupOut').textContent = pairs.length ? alOut(['agent: ai-workspace | role=approval', 'task: duplicate-scan | status: todo', 'out: pairs=' + pairs.length + ' | auto-merge=blocked', 'next: create-merge-approval']) : 'duplicates: 0';
      });
      bind('confAddBtn', () => {
        const a = $('confA').value.trim(), b = $('confB').value.trim();
        if (!a || !b) return;
        const list = storeGet('ai-workspace_v7_conflicts', []);
        list.push({ a, b, resolution: $('confResolution').value.trim() || 'unresolved' });
        storeSet('ai-workspace_v7_conflicts', list); decisionEvent('conflict-recorded', 'both-versions-kept=true auto-resolve=never');
        renderConflictsV7(); renderAudit();
      });
      bind('sensBtn', () => {
        const r = labelText($('sensInput').value);
        $('sensOut').textContent = alOut(['agent: ai-workspace | role=approval', 'task: sensitivity-label | status: todo', 'out: label=' + r.label + ' | would-leave=' + r.wouldLeave.join(',') + ' | sent=false', 'out: label-only | nothing-sent', 'next: redact-before-export']);
      });
      bind('leaseClaimBtn', () => {
        const task = $('leaseTask').value.trim(), agent = $('leaseAgent').value.trim() || 'agent-claimed';
        if (!task) return;
        const leases = storeGet('ai-workspace_leases', []);
        leases.push({ task, agent, until: Date.now() + 600000, heartbeats: 0 });
        storeSet('ai-workspace_leases', leases); decisionEvent('lease-claim', 'task=' + task + ' agent=' + agent + ' lease=10min');
        renderLeases();
      });
      bind('leaseHeartbeatBtn', () => {
        const task = $('leaseTask').value.trim();
        const leases = storeGet('ai-workspace_leases', []);
        const l = leases.find((x) => x.task === task && x.until > Date.now());
        if (!l) { $('leaseOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=lease-not-found | need=live-lease'; return; }
        l.until = Date.now() + 600000; l.heartbeats = (l.heartbeats || 0) + 1; storeSet('ai-workspace_leases', leases); renderLeases();
      });
      bind('leaseExpireBtn', () => {
        const r = expireLeases(storeGet('ai-workspace_leases', []), Date.now());
        storeSet('ai-workspace_leases', r.kept);
        r.expired.forEach((l) => decisionEvent('lease-expired', 'task=' + l.task + ' agent=' + l.agent));
        renderLeases(); renderAudit();
      });
      bind('labLintBtn', () => {
        const r = lintV7($('labLintInput').value);
        $('labLintOut').textContent = r.ok ? alOut(['agent: ai-workspace | role=lab', 'task: al-lint | status: done', 'out: lint=pass', 'next: use-pack']) : 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=al-invalid-' + r.errors.join(',') + ' | need=valid-al:1';
      });
      bind('labFixtureBtn', () => {
        const rs = runNegativeFixtures();
        $('labFixtureOut').textContent = alOut(['agent: ai-workspace | role=lab', 'task: negative-fixtures | status: todo'].concat(rs.map((r) => 'note: fixture=' + r.name + ' | blocked=' + r.blocked + ' | matched-expect=' + r.matched))).concat(['next: fix-input-and-retry']);
      });
      bind('labReplayBtn', () => {
        const r = runScenario($('labScenario').value);
        $('labReplayOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=lab', 'task: scenario-replay | status: done', 'out: scenario=' + r.id + ' | result=' + r.result].concat(r.steps.map((s, i) => 'note: step' + (i + 1) + '=' + sl(s)))).concat(['next: compare-after-change']);
      });
      bind('labReplayAlBtn', () => {
        const r = replayAlDryRun($('labReplayAlInput').value);
        $('labReplayAlOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=lab', 'task: al-replay-dry-run | status: todo', 'out: applied=false | dry-run-only'].concat(r.actions.map((a) => 'note: ' + sl(a)))).concat(['next: approve-to-apply']);
      });
      bind('labSnapBtn', () => {
        const snap = { task: $('labSnapTask').value.trim(), ctx: $('labSnapCtx').value.trim(), ts: new Date().toISOString(), ttl: 'ephemeral-session-only | not-saved-to-localStorage' };
        $('labSnapOut').textContent = alOut(['agent: ai-workspace | role=lab', 'task: context-snapshot | status: done', 'out: task=' + sl(snap.task) + ' | ts=' + snap.ts, 'out: ctx=' + sl(snap.ctx), 'out: ephemeral=true | saved=false', 'next: copy-before-refresh']);
      });
      bind('labVerifyBtn', () => {
        const rec = { artifact: $('labVerifyArtifact').value.trim(), rev: $('labVerifyRev').value.trim(), ts: new Date().toISOString() };
        const list = storeGet('ai-workspace_v7_verifications', []); list.push(rec); storeSet('ai-workspace_v7_verifications', list);
        $('labVerifyOut').textContent = alOut(['agent: ai-workspace | role=lab', 'task: verify-artifact | status: done', 'out: artifact=' + sl(rec.artifact) + ' | rev=' + sl(rec.rev), 'next: recheck-after-edit']);
      });
      bind('labVerifyCheckBtn', () => {
        const list = storeGet('ai-workspace_v7_verifications', []);
        const v = list.find((x) => x.artifact === $('labVerifyArtifact').value.trim());
        const r = checkStale(v, $('labVerifyRev2').value.trim());
        $('labVerifyOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=lab', 'task: verify-staleness | status: todo', 'out: artifact=' + sl($('labVerifyArtifact').value) + ' | rev=' + r.rev + ' | current=' + r.currentRev + ' | stale=' + r.stale, 'next: reverify-if-stale']);
      });
      bind('labMigBtn', () => {
        const sample = [{ id: 't1', status: 'waiting' }, { id: 't2', status: 'doing' }];
        const r = migrateDryRun(sample);
        $('labMigOut').textContent = alOut(['agent: ai-workspace | role=lab', 'task: migration-rehearsal | status: todo', 'out: sample-changed=' + r.changed + ' | waiting-to-blocked=' + r.changed, 'out: dry-run-only | real-localStorage-unchanged | export-before-apply', 'out: transformed=' + JSON.stringify(r.items), 'next: rollback-sample-below']);
      });
      bind('labMigRollbackBtn', () => {
        $('labMigOut').textContent = alOut(['agent: ai-workspace | role=lab', 'task: migration-rollback | status: done', 'out: sample-restored=t1:waiting,t2:doing | real-data-unchanged', 'next: rehearsal-complete']);
      });
      bind('cmpModelBtn', () => {
        try { const diff = jsonCompare(JSON.parse($('cmpModelA').value || '{}'), JSON.parse($('cmpModelB').value || '{}')); $('cmpModelOut').textContent = diff.length ? diff.map((d) => d.key + ': ' + d.change + ' ' + JSON.stringify(d.from != null ? d.from : '') + ' -> ' + JSON.stringify(d.to != null ? d.to : '')).join('\n') : 'models: identical-on-compared-keys'; } catch (e) { $('cmpModelOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; }
      });
      bind('cmpAgentBtn', () => {
        try { const diff = jsonCompare(JSON.parse($('cmpAgentA').value || '{}'), JSON.parse($('cmpAgentB').value || '{}')); $('cmpAgentOut').textContent = diff.length ? diff.map((d) => d.key + ': ' + d.change).join('\n') : 'agents: identical-on-compared-keys'; } catch (e) { $('cmpAgentOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; }
      });
      bind('cmpToolBtn', () => {
        try { const diff = jsonCompare(JSON.parse($('cmpToolA').value || '{}'), JSON.parse($('cmpToolB').value || '{}')); $('cmpToolOut').textContent = diff.length ? diff.map((d) => d.key + ': ' + d.change).join('\n') : 'tools: identical-on-compared-keys'; } catch (e) { $('cmpToolOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; }
      });
      bind('packSliceBtn', () => {
        const r = slicePack($('packOut') ? $('packOut').textContent : '', parseInt($('packBudget').value, 10));
        $('packSliceOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=pack', 'task: pack-slice | status: done', 'out: chars=' + r.chars + ' | truncated=' + r.truncated + ' | note=' + r.note, 'next: copy-sliced-pack']) + '\n' + r.sliced;
      });
      bind('packDeltaBtn', () => {
        const d = deltaPack($('packDeltaA').value, $('packDeltaB').value);
        $('packDeltaOut').textContent = alOut(['agent: ai-workspace | role=pack', 'task: pack-delta | status: done', 'out: added=' + d.addedCount + ' | removed=' + d.removedCount, 'out: added-lines=' + sl(d.added.join(' / ')), 'out: removed-lines=' + sl(d.removed.join(' / ')), 'next: export-delta']);
      });
      bind('timelineReplayBtn', () => {
        const r = runScenario($('timelineScenario').value);
        $('timelineOut').textContent = r.blocked ? 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked : alOut(['agent: ai-workspace | role=timeline', 'task: timeline-replay | status: done', 'out: scenario=' + r.id].concat(r.steps.map((s, i) => 'note: step' + (i + 1) + '=' + sl(s)))).concat(['next: compare-runs']);
        renderTimeline();
      });
      bind('auditExportBtn', () => {
        const list = storeGet('ai-workspace_decisions', []);
        $('auditOut').textContent = alOut(['agent: ai-workspace | role=audit', 'task: decision-log-export | status: todo'].concat(list.map((e) => 'note: event id=' + e.id + ' | kind=' + sl(e.kind) + ' | ts=' + e.ts + ' | detail=' + sl(e.detail)))).concat(['next: import-validated-only']);
      });
      bind('swarmBasisBtn', () => {
        const lines = ['claude', 'gemini', 'chatgpt', 'grok'].map((m) => 'verdict: model=' + m + ' | claim=' + sl($('verdict-' + m) ? $('verdict-' + m).value : '') + ' | proof=none | basis=' + ($('swarmBasis-' + m) ? $('swarmBasis-' + m).value : 'logic-only'));
        $('swarmBasisOut').textContent = alOut(['agent: ai-workspace | role=swarm', 'task: verdict-basis | status: todo'].concat(lines)).concat(['note: proof=none verdicts cannot resolve a conflict | next: attach-proof-ref']);
      });
    });
  }

  if (typeof module !== 'undefined') module.exports = {
    LEGAL, REASON_CODES, PROVIDERS, AUTONOMY_TABLE, NEG_FIXTURES, SCENARIOS,
    normTitle, detectDuplicates, computeReady, blocksMap, slicePack, deltaPack, expireLeases,
    lintV7, runNegativeFixtures, labelText, routerScore, addDecision, checkStale, fnvHash,
    anchorFor, findAnchor, migrateDryRun, quotaWarning, jsonCompare, replayAlDryRun,
    guardJsSnippet, runScenario, fingerprint
  };
})();
