// AI Workspace v7.1 — additive layer on v7-combined. Local only.
// FREE-ONLY: static + localStorage + existing free hosting. No paid tier wired,
// no purchase, no live model call, no key field anywhere in this file.
// Themes change colours/density only, never features or data.
// No content filter, refusal scanner, or moderation scanner is added.
// Controls here are authorisation/data labels, budgets, approval records, and
// local pause/cancel of local runs only.
(function () {
  'use strict';
  const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sl = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
  const storeGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const storeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const THEME_KEY = 'ai-workspace_theme';

  // ---------- Pure logic (node-testable) ----------
  const THEMES = {
    'default': { label: 'AI Workspace default', bg: '#0b0e14', panel: '#121826', panel2: '#171e30', line: '#232c44', text: '#e8edf7', muted: '#93a0b8', accent: '#7c9cff', good: '#4ade80', warn: '#fbbf24', bad: '#f87171', font: 'monospace' },
    'grok': { label: 'Grok', bg: '#000000', panel: '#0a0a0c', panel2: '#121216', line: '#2a2a32', text: '#E0E0E0', muted: '#8a8a96', accent: '#00FF9D', good: '#00FF9D', warn: '#FF2D55', bad: '#FF003C', font: 'monospace', radius: '4px' },
    'gemini': { label: 'Gemini', bg: '#090D16', panel: '#121826', panel2: '#121826', line: '#1E293B', text: '#e6edf3', muted: '#929BAE', accent: '#7c9cff', good: '#4ade80', warn: '#fbbf24', bad: '#f87171', font: 'monospace' },
    'claude': { label: 'Claude', bg: '#0A0B0D', panel: '#12141A', panel2: '#12141A', line: '#232c44', text: '#E8E8ED', muted: '#8a8a96', accent: '#B6FF3C', good: '#B6FF3C', warn: '#f59e0b', bad: '#ef4444', font: 'monospace' },
    'governance': { label: 'Governance', bg: '#0B0D12', panel: '#171B25', panel2: '#11141C', line: '#292E3B', text: '#EDF0F7', muted: '#929BAE', accent: '#8B7CFF', good: '#56D9A5', warn: '#F5BD61', bad: '#FF6B79', font: 'monospace' },
    'abyss': { label: 'NV-AC Abyss', bg: '#07090c', panel: '#0d1117', panel2: '#141a22', line: '#222c38', text: '#e6edf3', muted: '#7d8b99', accent: '#22d3ee', good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', font: 'monospace' },
    'manus': { label: 'Manus', bg: '#0B0E14', panel: '#111722', panel2: '#182231', line: '#2A3748', text: '#E7EDF5', muted: '#9AA9BC', accent: '#55D6D2', good: '#75C69A', warn: '#F2B84B', bad: '#F07178', font: 'sans', accent2: '#A78BFA' }
  };
  function themeIds() { return Object.keys(THEMES); }
  function themeFor(id) { return THEMES[id] || THEMES['default']; }
  function themeFromStored(v) { return THEMES[v] ? v : 'default'; }
  const DATA_CLASSES = ['public', 'workspace', 'sensitive', 'secret'];
  function labelDataClass(kind, id, dataClass, localOnly) {
    if (!DATA_CLASSES.includes(dataClass)) return { blocked: 'reason=data-class-invalid | need=public|workspace|sensitive|secret' };
    if (!id) return { blocked: 'reason=no-id | need=record-id' };
    return { kind, id, dataClass, localOnly: !!localOnly, remote: false, note: 'label-only | local-only-data-never-marked-remote | site-makes-no-remote-calls' };
  }
  function exportCheckForLabel(label) {
    if (!label) return { blocked: 'reason=no-label | need=data-class-label-first' };
    if (label.dataClass === 'secret') return { blocked: 'reason=data-class-secret-export-blocked | need=redact-or-downgrade' };
    if (label.dataClass === 'sensitive') return { allowed: true, note: 'export-allowed-with-warning | sensitive-data-class | redact-before-sharing' };
    return { allowed: true, note: 'export-allowed | data-class=' + label.dataClass };
  }
  function diffPermissions(oldRec, newRec) {
    const o = oldRec || {}, n = newRec || {};
    const keys = new Set(Object.keys(o).concat(Object.keys(n)));
    const diff = [];
    keys.forEach((k) => {
      const a = JSON.stringify(o[k] == null ? '' : o[k]), b = JSON.stringify(n[k] == null ? '' : n[k]);
      if (a !== b) diff.push({ key: k, from: o[k] == null ? '' : o[k], to: n[k] == null ? '' : n[k] });
    });
    return { diff, changed: diff.length, applied: false, note: 'preview-only | saved-only-on-owner-click | nothing-applied-by-preview' };
  }
  function saveVersionedAgent(agents, rec) {
    const list = Array.isArray(agents) ? agents.slice() : [];
    const same = list.filter((a) => a.handle === rec.handle);
    const version = same.length ? Math.max.apply(null, same.map((a) => a.version || 1)) + 1 : 1;
    const saved = Object.assign({}, rec, { version });
    list.push(saved);
    return { agents: list, saved, note: 'new-version-created | old-versions-kept | runs-keep-pinned-version' };
  }
  function pinRun(runs, run) {
    const list = Array.isArray(runs) ? runs.slice() : [];
    if (!run || !run.runId || !run.agentHandle || !run.agentVersion) return { blocked: 'reason=pin-missing-fields | need=run-id|agent-handle|agent-version' };
    list.push(Object.assign({ pinned: true, status: run.status || 'todo' }, run));
    return { runs: list, pinned: run, note: 'run-pinned-to-agent-version | agent-edits-do-not-change-this-run' };
  }
  const SIDE_EFFECTS = ['read', 'reversible_write', 'external_write', 'irreversible'];
  function sideEffectValid(v) { return SIDE_EFFECTS.includes(v); }
  function installTool(tools, tool) {
    const list = Array.isArray(tools) ? tools.slice() : [];
    if (!tool || !tool.name) return { blocked: 'reason=no-tool | need=tool-name' };
    if (!sideEffectValid(tool.sideEffect)) return { blocked: 'reason=side-effect-invalid | need=read|reversible_write|external_write|irreversible' };
    list.push(Object.assign({}, tool, { installed: true, granted: false }));
    return { tools: list, note: 'installed-only | granted=false | installation-is-not-execution-grant' };
  }
  function grantTool(tools, name) {
    const list = Array.isArray(tools) ? tools.slice() : [];
    const t = list.find((x) => x.name === name);
    if (!t) return { blocked: 'reason=tool-not-found | need=installed-tool-name' };
    if (!t.installed) return { blocked: 'reason=tool-not-installed | need=install-first' };
    t.granted = true;
    return { tools: list, granted: t, note: 'granted-by-owner-click | install-and-grant-are-separate-actions' };
  }
  function reputationDescriptive(rec) {
    const r = rec || {};
    const ok = (r.successfulRuns || 0), fail = (r.failedRuns || 0);
    const total = ok + fail;
    return { agent: r.agent || '', successfulRuns: ok, failedRuns: fail, totalRuns: total, successShare: total ? (ok / total).toFixed(2) : 'n/a', schemaValidityRate: r.schemaValidityRate == null ? 'n/a' : r.schemaValidityRate, approvalReversalRate: r.approvalReversalRate == null ? 'n/a' : r.approvalReversalRate, userFeedbackCount: r.userFeedbackCount || 0, descriptiveOnly: true, unlocks: 'none', permissionsChanged: false, note: 'descriptive-counts-only | reputation-does-not-unlock-permissions | no-leaderboard | no-ranking' };
  }
  function replayLocalSteps(runId, steps) {
    const list = (steps || []).filter((s) => String(s).trim());
    if (!runId) return { blocked: 'reason=no-run | need=run-id' };
    if (!list.length) return { blocked: 'reason=no-steps | need=recorded-local-steps' };
    return { runId, steps: list, applied: false, replayed: true, note: 'replay-local-only | recorded-steps-shown-again | external-side-effects-never-replayed | state-unchanged' };
  }
  function addImmutableArtifact(artifacts, art) {
    const list = Array.isArray(artifacts) ? artifacts.slice() : [];
    if (!art || !art.id || !art.version) return { blocked: 'reason=artifact-missing-fields | need=artifact-id|version' };
    const ex = list.find((a) => a.id === art.id && a.version === art.version);
    if (ex && ex.contentHash && art.contentHash && ex.contentHash !== art.contentHash) return { blocked: 'reason=artifact-immutable-version | need=new-version' };
    if (ex) return { blocked: 'reason=artifact-version-exists | need=new-version' };
    list.push(Object.assign({}, art, { immutable: true }));
    return { artifacts: list, note: 'immutable-versioned-artifact | edits-require-new-version | no-silent-overwrite' };
  }
  function surfaceSwarmConflict(taskId, versionA, versionB, provenance) {
    if (!taskId || !versionA || !versionB) return { blocked: 'reason=conflict-missing-versions | need=task-id|version-a|version-b' };
    return { taskId, versionA, versionB, provenance: provenance || '', bothKept: true, autoResolved: false, status: 'unresolved-until-owner-record', note: 'conflict-surfaced-with-provenance | no-silent-reconcile | no-auto-resolve' };
  }
  const MODEL_ENTRIES = [
    { provider: 'huggingface', model: 'qwen', freeClaim: 'free tier (spec claim)', verified: false, liveCalls: 'none', keys: 'none', source: 'listed as HF models in the Gemini spec, research/NEXUS-VOID-COMPARISON.md' },
    { provider: 'huggingface', model: 'deepseek', freeClaim: 'free tier (spec claim)', verified: false, liveCalls: 'none', keys: 'none', source: 'listed as HF models in the Gemini spec, research/NEXUS-VOID-COMPARISON.md' },
    { provider: 'openrouter', model: 'qwen', freeClaim: 'free slugs (spec claim)', verified: false, liveCalls: 'none', keys: 'none', source: 'listed as HF models in the Gemini spec, research/NEXUS-VOID-COMPARISON.md' },
    { provider: 'openrouter', model: 'deepseek', freeClaim: 'free slugs (spec claim)', verified: false, liveCalls: 'none', keys: 'none', source: 'listed as HF models in the Gemini spec, research/NEXUS-VOID-COMPARISON.md' }
  ];
  const TOKEN_CHARS_PER_TOKEN = 4;
  function tokenCost(text, budgetChars) {
    // Chars only: no token estimate exists here. Break-even vs a reference
    // (e.g. JSON) is charsSaved / codebookChars, computed by the caller.
    const t = String(text || '');
    const chars = t.length;
    if (!budgetChars || budgetChars <= 0) return { chars, lengthProxyCharsDiv4: Math.ceil(chars / 4), lengthProxyNote: 'chars/4 length-proxy-only | not-a-token-count | no-model-named', tokens: 'not-measured', budgetChars: 0, cutChars: 0, kept: t, cut: '', note: 'no-budget-given | nothing-cut | tokens=not-measured' };
    if (chars <= budgetChars) return { chars, lengthProxyCharsDiv4: Math.ceil(chars / 4), lengthProxyNote: 'chars/4 length-proxy-only | not-a-token-count | no-model-named', tokens: 'not-measured', budgetChars, cutChars: 0, kept: t, cut: '', note: 'pack-fits-budget | nothing-cut | tokens=not-measured' };
    const kept = t.slice(0, budgetChars), cut = t.slice(budgetChars);
    return { chars, lengthProxyCharsDiv4: Math.ceil(chars / 4), lengthProxyNote: 'chars/4 length-proxy-only | not-a-token-count | no-model-named', tokens: 'not-measured', budgetChars, cutChars: cut.length, kept, cut, note: 'pack-sliced-by-budget | tail-cut | cut-preview-in-output | tokens=not-measured' };
  }
  function lineDelta(oldText, newText) {
    const a = String(oldText || '').split('\n').filter((l) => l.trim());
    const b = String(newText || '').split('\n').filter((l) => l.trim());
    const setA = new Set(a), setB = new Set(b);
    const added = b.filter((l) => !setA.has(l)), removed = a.filter((l) => !setB.has(l));
    const deltaText = added.join('\n');
    return { added, removed, addedCount: added.length, removedCount: removed.length, deltaChars: deltaText.length, note: 'delta-added-and-removed | tokens=not-measured' };
  }
  function searchRecords(records, q) {
    const query = q || {};
    const agent = String(query.agent || '').toLowerCase(), task = String(query.task || '').toLowerCase(), text = String(query.text || '').toLowerCase(), status = String(query.status || 'all');
    const out = (records || []).filter((r) => {
      if (agent && !String(r.agent || '').toLowerCase().includes(agent)) return false;
      if (task && !String(r.task || '').toLowerCase().includes(task)) return false;
      if (text && !String(r.text || '').toLowerCase().includes(text)) return false;
      if (status !== 'all' && String(r.status || '') !== status) return false;
      return true;
    });
    const sorted = out.slice().sort((a, b) => String(a.task || '').localeCompare(String(b.task || '')) || String(a.agent || '').localeCompare(String(b.agent || '')));
    const start = (query.cursor && !isNaN(parseInt(query.cursor, 10)) && parseInt(query.cursor, 10) >= 0) ? parseInt(query.cursor, 10) : 0;
    const page = sorted.slice(start, start + 20);
    return { results: page, total: sorted.length, shown: page.length, cursor: String(start), nextCursor: (start + 20 < sorted.length) ? String(start + 20) : null, sort: 'task,agent', pageSize: 20, capped: sorted.length > 20, note: 'search-by-agent-task-text-status | cursor-pagination | sort=task,agent | no-infinite-scroll' };
  }
  function applyThemeToDocument(id) {
    if (typeof document === 'undefined') return themeFromStored(id);
    const chosen = themeFromStored(id);
    document.documentElement.setAttribute('data-theme', chosen);
    try { localStorage.setItem(THEME_KEY, chosen); } catch {}
    return chosen;
  }
  function alOut(lines) { return ['al:1'].concat(lines).join('\n'); }
  function renderPolicy() {
    if (!$('policyList')) return;
    const p = storeGet('ai-workspace_v71_policy', { approvalRules: 'consequential external writes, irreversible actions, credential use, publication, scope expansion: owner approval', dataClassRules: 'public|workspace|sensitive|secret; secret export blocked; sensitive export warned', retention: 'localStorage only; delete via forget/remove in each view; audit log append-only', export: 'AgentLang copy-out only; nothing sent', revocation: 'remove agent/tool/run record locally; pinned runs keep their version label' });
    $('policyList').innerHTML = '<div class="card"><p>approval-rules: ' + esc(p.approvalRules) + '</p><p>data-class-rules: ' + esc(p.dataClassRules) + '</p><p>retention: ' + esc(p.retention) + '</p><p>export: ' + esc(p.export) + '</p><p>revocation: ' + esc(p.revocation) + '</p></div>';
  }
  function renderV71Runs() {
    if (!$('shellRunList')) return;
    const runs = storeGet('ai-workspace_v71_runs', []);
    $('shellRunList').innerHTML = runs.map((r, i) => '<div class="card" id="shell-run-' + i + '"><p class="small">run=' + esc(r.runId) + ' | agent=' + esc(r.agentHandle) + ' | version=' + esc(r.agentVersion) + ' | status=' + esc(r.status) + ' | pinned=' + (r.pinned ? 'true' : 'false') + '</p><div class="row"><button id="shell-pause-' + i + '" onclick="v71PauseRun(' + i + ')">pause-local-run</button><button id="shell-cancel-' + i + '" onclick="v71CancelRun(' + i + ')">cancel-local-run</button></div></div>').join('') || 'local runs: 0';
  }
  function renderV71All() { try { renderPolicy(); } catch {} try { renderV71Runs(); } catch {} }

  if (typeof window !== 'undefined') {
    window.v71PauseRun = (i) => { const r = storeGet('ai-workspace_v71_runs', []); if (r[i]) { r[i].status = 'paused'; storeSet('ai-workspace_v71_runs', r); } renderV71Runs(); };
    window.v71CancelRun = (i) => { const r = storeGet('ai-workspace_v71_runs', []); if (r[i]) { r[i].status = 'cancelled'; storeSet('ai-workspace_v71_runs', r); } renderV71Runs(); };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        const oldShow = window.show;
        if (oldShow && !window.__v71ShowWrapped) {
          window.__v71ShowWrapped = true;
          window.show = (v) => { oldShow(v); renderV71All(); };
        }
      } catch {}
      try { applyThemeToDocument(localStorage.getItem(THEME_KEY) || 'default'); } catch {}
      const sel = $('themeSelect');
      if (sel) { try { sel.value = themeFromStored(localStorage.getItem(THEME_KEY) || 'default'); } catch {} sel.addEventListener('change', () => { const c = applyThemeToDocument(sel.value); if ($('themeOut')) $('themeOut').textContent = alOut(['agent: ai-workspace | role=shell', 'task: theme-apply | status: done', 'out: theme=' + c + ' | label=' + themeFor(c).label, 'out: changes=colours-density-only | features-unchanged | data-unchanged', 'next: use-view']); }); }
      const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
      themeIds().forEach((tid) => { const b = $('themeBtn-' + tid); if (b) b.onclick = () => { const c = applyThemeToDocument(tid); if (sel) sel.value = c; if ($('themeOut')) $('themeOut').textContent = alOut(['agent: ai-workspace | role=shell', 'task: theme-apply | status: done', 'out: theme=' + c + ' | label=' + themeFor(c).label, 'out: changes=colours-density-only | features-unchanged | data-unchanged', 'next: use-view']); }; });
      bind('shellCmdBtn', () => {
        const cmd = ($('shellCmdInput') ? $('shellCmdInput').value.trim() : '');
        if (!cmd) { $('shellCmdOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-text | need=command-text'; return; }
        $('shellCmdOut').textContent = alOut(['agent: ai-workspace | role=shell', 'task: command-preview | status: todo', 'out: command-preview=' + sl(cmd), 'out: authorised=false | preview-only | no-external-or-irreversible-action', 'next: confirm-explicit-action-separately']);
      });
      bind('shellRunAddBtn', () => {
        const runId = ($('shellRunId') ? $('shellRunId').value.trim() : '');
        const handle = ($('shellRunAgent') ? $('shellRunAgent').value.trim() : '');
        const version = ($('shellRunVersion') ? $('shellRunVersion').value.trim() : '');
        const r = pinRun(storeGet('ai-workspace_v71_runs', []), { runId, agentHandle: handle, agentVersion: version, status: 'todo' });
        if (r.blocked) { $('shellRunOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        storeSet('ai-workspace_v71_runs', r.runs);
        $('shellRunOut').textContent = alOut(['agent: ai-workspace | role=shell', 'task: run-pin | status: done', 'out: run=' + sl(runId) + ' | agent=' + sl(handle) + ' | version=' + sl(version) + ' | pinned=true', 'next: pause-or-cancel-local-run']);
        renderV71Runs();
      });
      bind('forgeDiffBtn', () => {
        let oldRec = {}, newRec = {};
        try { oldRec = JSON.parse($('forgeDiffOld').value || '{}'); newRec = JSON.parse($('forgeDiffNew').value || '{}'); } catch (e) { $('forgeDiffOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; return; }
        const d = diffPermissions(oldRec, newRec);
        $('forgeDiffOut').textContent = alOut(['agent: ai-workspace | role=forge', 'task: permission-diff-preview | status: todo', 'out: changed=' + d.changed].concat(d.diff.map((x) => 'note: diff ' + x.key + ': ' + JSON.stringify(x.from) + ' -> ' + JSON.stringify(x.to)))).concat(['note: preview-only | applied=false | save-only-on-owner-click', 'next: save-versioned-agent-below']);
      });
      bind('forgeVersionSaveBtn', () => {
        const handle = ($('forgeVersionHandle') ? $('forgeVersionHandle').value.trim() : '');
        const name = ($('forgeVersionName') ? $('forgeVersionName').value.trim() : handle);
        if (!handle) { $('forgeVersionOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-handle | need=agent-handle'; return; }
        const rec = { handle, name, autonomy: parseInt(($('forgeVersionAutonomy') ? $('forgeVersionAutonomy').value : '2'), 10), dataClass: ($('forgeVersionDataClass') ? $('forgeVersionDataClass').value : 'workspace'), tools: ($('forgeVersionTools') ? $('forgeVersionTools').value.split(',').map((s) => s.trim()).filter(Boolean) : []) };
        const r = saveVersionedAgent(storeGet('ai-workspace_v71_agents', []), rec);
        storeSet('ai-workspace_v71_agents', r.agents);
        $('forgeVersionOut').textContent = alOut(['agent: ai-workspace | role=forge', 'task: agent-version-save | status: done', 'out: handle=' + sl(handle) + ' | version=' + r.saved.version + ' | autonomy=' + rec.autonomy + ' | data-class=' + rec.dataClass, 'out: old-versions-kept=true | pinned-runs-unchanged', 'next: pin-a-run-in-shell']);
      });
      bind('labelBtn', () => {
        const r = labelDataClass(($('labelKind') ? $('labelKind').value : 'memory'), ($('labelId') ? $('labelId').value.trim() : ''), ($('labelClass') ? $('labelClass').value : 'public'), ($('labelLocal') ? $('labelLocal').checked : true));
        if (r.blocked) { $('labelOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        const list = storeGet('ai-workspace_v71_labels', []); list.push(r); storeSet('ai-workspace_v71_labels', list);
        const chk = exportCheckForLabel(r);
        $('labelOut').textContent = alOut(['agent: ai-workspace | role=policy', 'task: data-class-label | status: todo', 'out: kind=' + r.kind + ' | id=' + sl(r.id) + ' | data-class=' + r.dataClass + ' | local-only=' + r.localOnly + ' | remote=false', 'out: export-check=' + (chk.blocked ? chk.blocked : chk.note), 'next: export-only-if-allowed']);
      });
      bind('toolInstallBtn', () => {
        const name = ($('tool71Name') ? $('tool71Name').value.trim() : '');
        const r = installTool(storeGet('ai-workspace_v71_tools', []), { name, sideEffect: ($('tool71Effect') ? $('tool71Effect').value : 'read'), runtime: ($('tool71Runtime') ? $('tool71Runtime').value : 'js') });
        if (r.blocked) { $('tool71Out').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        storeSet('ai-workspace_v71_tools', r.tools);
        $('tool71Out').textContent = alOut(['agent: ai-workspace | role=workshop', 'task: tool-install | status: done', 'out: tool=' + sl(name) + ' | side-effect=' + sl($('tool71Effect').value) + ' | installed=true | granted=false', 'out: installation-is-not-execution-grant', 'next: grant-separately']);
      });
      bind('toolGrantBtn', () => {
        const name = ($('tool71Name') ? $('tool71Name').value.trim() : '');
        const r = grantTool(storeGet('ai-workspace_v71_tools', []), name);
        if (r.blocked) { $('tool71Out').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        storeSet('ai-workspace_v71_tools', r.tools);
        $('tool71Out').textContent = alOut(['agent: ai-workspace | role=workshop', 'task: tool-grant | status: done', 'out: tool=' + sl(name) + ' | granted=true | granted-by=owner-click', 'next: use-only-if-granted']);
      });
      bind('repBtn', () => {
        const r = reputationDescriptive({ agent: ($('repAgent') ? $('repAgent').value.trim() : ''), successfulRuns: parseInt(($('repOk') ? $('repOk').value : '0'), 10) || 0, failedRuns: parseInt(($('repFail') ? $('repFail').value : '0'), 10) || 0, schemaValidityRate: ($('repSchema') ? $('repSchema').value : ''), approvalReversalRate: ($('repReversal') ? $('repReversal').value : ''), userFeedbackCount: parseInt(($('repFeedback') ? $('repFeedback').value : '0'), 10) || 0 });
        $('repOut').textContent = alOut(['agent: ai-workspace | role=policy', 'task: reputation-descriptive | status: done', 'out: agent=' + sl(r.agent) + ' | successful=' + r.successfulRuns + ' | failed=' + r.failedRuns + ' | success-share=' + r.successShare, 'out: descriptive-only=true | unlocks=none | permissions-changed=false | leaderboard=none', 'next: use-counts-for-review-only']);
      });
      bind('runReplayBtn', () => {
        const steps = ($('runReplaySteps') ? $('runReplaySteps').value.split('\n') : []);
        const r = replayLocalSteps(($('runReplayId') ? $('runReplayId').value.trim() : ''), steps);
        if (r.blocked) { $('runReplayOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        $('runReplayOut').textContent = alOut(['agent: ai-workspace | role=timeline', 'task: run-replay-local | status: done', 'out: run=' + sl(r.runId) + ' | replayed=true | applied=false'].concat(r.steps.map((s, i) => 'note: step' + (i + 1) + '=' + sl(s)))).concat(['note: external-side-effects-never-replayed | state-unchanged', 'next: compare-with-original-run']);
      });
      bind('artifact71Btn', () => {
        const art = { id: ($('artifact71Id') ? $('artifact71Id').value.trim() : ''), version: ($('artifact71Version') ? $('artifact71Version').value.trim() : ''), contentHash: ($('artifact71Hash') ? $('artifact71Hash').value.trim() : '') };
        const r = addImmutableArtifact(storeGet('ai-workspace_v71_artifacts', []), art);
        if (r.blocked) { $('artifact71Out').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        storeSet('ai-workspace_v71_artifacts', r.artifacts);
        $('artifact71Out').textContent = alOut(['agent: ai-workspace | role=canvas', 'task: artifact-immutable | status: done', 'out: artifact=' + sl(art.id) + ' | version=' + sl(art.version) + ' | immutable=true', 'out: edits-require-new-version | no-silent-overwrite', 'next: surface-conflict-if-different-version']);
      });
      bind('swarmConflict71Btn', () => {
        const r = surfaceSwarmConflict(($('swarmConfTask') ? $('swarmConfTask').value.trim() : ''), ($('swarmConfA') ? $('swarmConfA').value.trim() : ''), ($('swarmConfB') ? $('swarmConfB').value.trim() : ''), ($('swarmConfProv') ? $('swarmConfProv').value.trim() : ''));
        if (r.blocked) { $('swarmConf71Out').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: ' + r.blocked; return; }
        $('swarmConf71Out').textContent = alOut(['agent: ai-workspace | role=canvas', 'task: swarm-conflict-surface | status: todo', 'out: task=' + sl(r.taskId) + ' | version-a=' + sl(r.versionA) + ' | version-b=' + sl(r.versionB) + ' | provenance=' + sl(r.provenance), 'out: both-kept=true | auto-resolved=false | status=unresolved-until-owner-record', 'next: record-resolution-in-approval']);
      });
      bind('policySaveBtn', () => {
        const p = { approvalRules: ($('policyApproval') ? $('policyApproval').value.trim() : ''), dataClassRules: ($('policyDataClass') ? $('policyDataClass').value.trim() : ''), retention: ($('policyRetention') ? $('policyRetention').value.trim() : ''), export: ($('policyExport') ? $('policyExport').value.trim() : ''), revocation: ($('policyRevocation') ? $('policyRevocation').value.trim() : '') };
        storeSet('ai-workspace_v71_policy', p); renderPolicy();
        if ($('policyOut')) $('policyOut').textContent = alOut(['agent: ai-workspace | role=policy', 'task: policy-save-local | status: done', 'out: saved=local-only | keys=none | cloud=cloudflare-free-public-packs-only', 'next: use-policy-view']);
      });
      bind('packTokenBtn', () => {
        const r = tokenCost($('packTokenInput').value, parseInt($('packTokenBudget').value, 10) || 0);
        $('packTokenOut').textContent = alOut(['agent: ai-workspace | role=pack', 'task: pack-token-cost | status: done', 'out: chars=' + r.chars + ' | tokens=not-measured', 'out: budget-chars=' + r.budgetChars + ' | cut-chars=' + r.cutChars + '  | cut=' + sl(r.cut).slice(0, 200), 'out: note=' + r.note, 'next: slice-or-raise-budget']);
      });
      bind('packDelta71Btn', () => {
        const d = lineDelta($('packDelta71Prev').value, $('packDelta71Curr').value);
        $('packDelta71Out').textContent = alOut(['agent: ai-workspace | role=pack', 'task: pack-delta-since-last | status: done', 'out: added-lines=' + d.addedCount + ' | removed-lines=' + d.removedCount + ' | delta-chars=' + d.deltaChars].concat(d.added.map((l) => 'note: delta-added=' + sl(l))).concat(d.removed.map((l) => 'note: delta-removed=' + sl(l)))).concat(['note: delta-added-and-removed | tokens=not-measured', 'next: copy-delta']);
      });
      bind('agentTokenBtn', () => {
        const r = tokenCost($('agentTokenInput').value, parseInt($('agentTokenBudget').value, 10) || 0);
        $('agentTokenOut').textContent = alOut(['agent: ai-workspace | role=agentmode', 'task: pack-token-cost | status: done', 'out: chars=' + r.chars + ' | tokens=not-measured', 'out: budget-chars=' + r.budgetChars + ' | cut-chars=' + r.cutChars + '  | cut=' + sl(r.cut).slice(0, 200), 'out: note=' + r.note, 'next: slice-or-raise-budget']);
      });
      bind('agentDeltaBtn', () => {
        const d = lineDelta($('agentDeltaPrev').value, $('agentDeltaCurr').value);
        $('agentDeltaOut').textContent = alOut(['agent: ai-workspace | role=agentmode', 'task: pack-delta-since-last | status: done', 'out: added-lines=' + d.addedCount + ' | removed-lines=' + d.removedCount + ' | delta-chars=' + d.deltaChars].concat(d.added.map((l) => 'note: delta-added=' + sl(l))).concat(d.removed.map((l) => 'note: delta-removed=' + sl(l)))).concat(['note: delta-added-and-removed | tokens=not-measured', 'next: copy-delta']);
      });
      bind('agentSearchBtn', () => {
        const records = [];
        try { storeGet('ai-workspace_v7_agents', []).forEach((a) => records.push({ agent: a.handle || a.name, task: '', text: (a.persona || '') + ' ' + (a.name || ''), status: 'todo' })); } catch {}
        try { storeGet('ai-workspace_v7_dag', []).forEach((t) => records.push({ agent: '', task: t.id, text: t.title || '', status: t.status })); } catch {}
        try { storeGet('ai-workspace_v7_memories', []).forEach((m) => records.push({ agent: '', task: '', text: m.title + ' ' + m.text, status: 'todo' })); } catch {}
        try { storeGet('ai-workspace_messages', []).forEach((m) => records.push({ agent: m.from, task: m.task, text: m.text, status: m.ack ? 'done' : 'todo' })); } catch {}
        const r = searchRecords(records, { agent: $('agentSearchAgent').value, task: $('agentSearchTask').value, text: $('agentSearchText').value, status: $('agentSearchStatus').value });
        $('agentSearchOut').textContent = alOut(['agent: ai-workspace | role=agentmode', 'task: agent-search | status: done', 'out: total=' + r.total + ' | shown=' + r.shown + ' | cursor=' + r.cursor + ' | next-cursor=' + (r.nextCursor || 'none') + ' | sort=' + r.sort].concat(r.results.map((x) => 'note: hit agent=' + sl(x.agent) + ' | task=' + sl(x.task) + ' | status=' + sl(x.status) + ' | text=' + sl(x.text).slice(0, 160)))).concat(['next: open-record-in-its-view']);
      });
      renderV71All();
    });
  }

  if (typeof module !== 'undefined') module.exports = {
    THEMES, THEME_KEY, DATA_CLASSES, SIDE_EFFECTS, MODEL_ENTRIES,
    themeIds, themeFor, themeFromStored, labelDataClass, exportCheckForLabel,
    diffPermissions, saveVersionedAgent, pinRun, sideEffectValid, installTool, grantTool,
    reputationDescriptive, replayLocalSteps, addImmutableArtifact, surfaceSwarmConflict,
    tokenCost, lineDelta, searchRecords, TOKEN_CHARS_PER_TOKEN
  };
})();
