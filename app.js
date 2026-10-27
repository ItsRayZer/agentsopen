// AgentsOpen — local-only workbench. No keys, no trackers. Network: public-import fetch + tools.json fetch only; sync=local-only; cloud=cloudflare-free-public-packs-only.
// State is kept in localStorage so work survives a refresh.
const $ = (id) => document.getElementById(id);
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { try { const el = document.getElementById('saveStatus'); if (el) el.textContent = 'al:1\nagent: ai-workspace | role=workspace\ntask: sync | status: blocked\nblocked: reason=save-failed | need=storage-available'; } catch {} return false; } }
};
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const KEYWORDS = 'const|let|var|function|return|if|else|for|while|import|from|export|class|def|try|except|pass|print|await|async|new|typeof|in|of|and|or|not|None|True|False|true|false|null';
function highlight(code) {
  const esc = escapeHtml(code);
  const re = new RegExp('(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|(&quot;[^&]*?&quot;|\'[^\'\\n]*\')|(\\b\\d[\\d._]*)|(\\b(?:' + KEYWORDS + ')\\b)', 'g');
  return esc.replace(re, (m, c, s, n, k) => c ? `<span class="tok-c">${m}</span>` : s ? `<span class="tok-s">${m}</span>` : n ? `<span class="tok-n">${m}</span>` : `<span class="tok-k">${m}</span>`);
}
function markSearch(html, term) {
  if (!term) return html;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
}
// ---- Navigation ----
// View isolation: a nav click shows ONLY that view's section. The stacked
// page (all views visible) is restored only by the explicit "show all views"
// control in the nav; any nav view click exits show-all again. No view is
// removed, no view id or nav button is changed, and no AgentLang line is
// moved into JS — the HTML itself still holds the static lines.
function show(view) {
  try { document.body.classList.remove('views-all'); } catch {}
  // Strict isolation: do not rely on CSS specificity alone. The target view
  // is shown; every other view is explicitly hidden inline, so no other
  // section can remain visible or scrollable in single-view mode, even if a
  // stylesheet override or a lingering body class would otherwise show it.
  // Hidden views are NOT removed from the DOM: their form state survives,
  // and showAllViews() restores them instantly.
  document.querySelectorAll('.view').forEach(v => {
    const on = v.id === 'view-' + view;
    v.classList.toggle('active', on);
    try { v.style.display = on ? '' : 'none'; } catch {}
  });
  document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  try { renderShared(); } catch {}
  try { renderTalk(); } catch {}
}
function showAllViews() {
  if (typeof document === 'undefined') return 'no-dom';
  try { document.body.classList.add('views-all'); } catch {}
  document.querySelectorAll('.view').forEach(v => { v.classList.add('active'); try { v.style.display = ''; } catch {} });
  return 'views-all';
}
if (typeof window !== 'undefined') { window.show = show; window.showAllViews = showAllViews; }
// ---- ?view= canonical per-view form (team-round resolution) ----
// Canonical per-view form is ?view=<id> (one URL, one view). No ?view
// handler existed in site JS before this fix (verified by grep: no
// URLSearchParams/?view code in any site JS file) — this is implemented
// fresh here, not a repair of an existing handler.
// On load with ?view=<id>: that view alone is isolated in the DOM (other
// .view sections are removed from the DOM, not merely hidden), so a
// fetcher/browser sees only that view. show-all in ?view mode reloads
// without the query. Unknown ?view= renders a blocked record naming all
// valid values instead of silently falling back. ?raw=1 forces agentmode
// and adds body.raw (CSS hides nav/buttons, lines + links only).
const VALID_VIEWS = ['agentmode','shared','studio','compare','swarm','models','notes','prompts','snippets','format','tracker','deploy','agentlang','boot','pack','queue','talk','forge','canvas','vault','workshop','router','timeline','quota','audit','lab','approval','gallery','shell','cloud','language','agentcode'];
function parseViewParam(search) {
  const q = String(search || '').replace(/^\?/, '');
  const params = {};
  q.split('&').forEach(part => { const i = part.indexOf('='); if (i > 0) params[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1)); });
  const raw = params.raw === '1';
  const view = params.view || null;
  if (!view) return { view: raw ? 'agentmode' : null, raw, valid: true };
  if (VALID_VIEWS.indexOf(view) < 0) return { view: null, raw, valid: false, invalid: view, validViews: VALID_VIEWS.slice() };
  return { view, raw, valid: true };
}
function applyViewParam(search) {
  const parsed = parseViewParam(search);
  if (typeof document === 'undefined') return parsed;
  if (parsed.raw) { try { document.body.classList.add('raw'); } catch {} }
  if (!parsed.valid) {
    document.querySelectorAll('.view').forEach(v => { try { v.remove(); } catch {} });
    const main = document.querySelector('main') || document.body;
    const pre = document.createElement('pre');
    pre.textContent = 'al:1\nagent: ai-workspace\n task: view\nstatus: blocked\nblocked: reason=unknown-view | need=view=' + parsed.validViews.join(',') + '\nnote: unknown-view=' + parsed.invalid;
    main.appendChild(pre);
    return parsed;
  }
  if (parsed.view) {
    show(parsed.view);
    // True DOM isolation for ?view mode: remove other sections from DOM.
    document.querySelectorAll('.view').forEach(v => { if (v.id !== 'view-' + parsed.view) { try { v.remove(); } catch {} } });
    // Nav in ?view mode: keep only the target link + a back link.
    document.querySelectorAll('nav [data-view]').forEach(a => { if (a.dataset.view !== parsed.view) { try { a.remove(); } catch {} } });
  }
  return parsed;
}
if (typeof window !== 'undefined') {
  window.parseViewParam = parseViewParam; window.applyViewParam = applyViewParam;
  document.addEventListener('DOMContentLoaded', () => {
    try { if (window.location && window.location.search) applyViewParam(window.location.search); } catch {}
  });
}

// ---- Copy ----
async function copyText(id, btn) {
  const el = $(id); const text = el ? (el.value ?? el.textContent) : '';
  let ok = true;
  try { await navigator.clipboard.writeText(text); } catch {
    try { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    catch { ok = false; }
  }
  if (!ok && btn) { btn.textContent = 'blocked'; return; }
  if (btn) { const old = btn.textContent; btn.textContent = 'ok'; setTimeout(() => btn.textContent = old, 1200); }
}
if (typeof window !== 'undefined') window.copyText = copyText;
// ---- Code Studio ----
let files = store.get('ai-workspace_files', [{ name: 'example.py', content: 'def greet(name):\n    return f"Hello, {name}"\n\nprint(greet("AgentsOpen"))\n' }]);
let activeFile = 0;
function renderFiles() {
  const tabs = $('fileTabs'); const list = $('fileList');
  tabs.innerHTML = ''; list.innerHTML = '';
  files.forEach((f, i) => {
    const b = document.createElement('button'); b.id = 'file-tab-' + i; b.textContent = f.name; if (i === activeFile) b.classList.add('active');
    b.onclick = () => { activeFile = i; $('codeInput').value = f.content; renderFiles(); renderCode(); }; tabs.appendChild(b);
    const l = document.createElement('button'); l.id = 'file-list-' + i; l.textContent = f.name; l.onclick = () => { activeFile = i; $('codeInput').value = f.content; renderFiles(); renderCode(); }; list.appendChild(l);
  });
  if (files[activeFile]) $('codeInput').value = files[activeFile].content;
}
function renderCode() {
  const code = $('codeInput').value; const term = $('codeSearch').value.trim();
  const lines = code.split('\n');
  let rows = '';
  lines.forEach((line, i) => {
    let h = highlight(line);
    if (term) h = markSearch(h, term);
    rows += `<tr><td class="ln">${i + 1}</td><td>${h || '&nbsp;'}</td></tr>`;
  });
  $('codeView').innerHTML = `<table class="code">${rows}</table>`;
  $('codeMeta').textContent = `${lines.length} lines · ${code.length} chars` + (term ? ` · matches: ${(code.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length}` : '');
}
function saveFile() {
  const name = $('fileName').value.trim() || `file-${files.length + 1}.txt`;
  const content = $('codeInput').value;
  const idx = files.findIndex(f => f.name === name);
  if (idx >= 0) { files[idx].content = content; activeFile = idx; } else { files.push({ name, content }); activeFile = files.length - 1; }
  if (!store.set('ai-workspace_files', files)) { $('codeMeta').textContent = 'blocked: reason=save-failed | need=storage-available'; }
  renderFiles(); renderCode();
}
function loadDroppedFile(file) {
  const r = new FileReader();
  r.onload = () => { files.push({ name: file.name, content: String(r.result) }); activeFile = files.length - 1; $('fileName').value = file.name; store.set('ai-workspace_files', files); renderFiles(); renderCode(); };
  r.readAsText(file);
}
// ---- Diff (line LCS) ----
function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n');
  if (A.length * B.length > 400000) return null;
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { ops.push({ t: 'same', a: A[i], b: B[j] }); i++; j++; }
    else if (j < B.length && (i === A.length || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ t: 'add', b: B[j] }); j++; }
    else { ops.push({ t: 'del', a: A[i] }); i++; }
  }
  return ops;
}
function diffSummary(ops) {
  let add = 0, del = 0, chg = 0, same = 0, i = 0;
  while (i < ops.length) {
    if (ops[i].t === 'same') { same++; i++; continue; }
    let d = 0, ad = 0; while (i < ops.length && ops[i].t !== 'same') { if (ops[i].t === 'del') d++; else ad++; i++; }
    const c = Math.min(d, ad); chg += c; del += d - c; add += ad - c;
  }
  return { add, del, chg, same };
}
function runDiff() {
  const ops = diffLines($('leftCode').value, $('rightCode').value);
  if (!ops) { $('diffSummary').innerHTML = ''; if ($('diffAlOut')) $('diffAlOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=diff-too-large | need=smaller-excerpt'; $('diffOut').innerHTML = '<pre class="block">al:1\nagent: ai-workspace | status: blocked\nblocked: reason=diff-too-large | need=smaller-excerpt</pre>'; return; }
  const s = diffSummary(ops);
  $('diffSummary').innerHTML = `<span class="pill add">+${s.add}</span><span class="pill del">-${s.del}</span><span class="pill chg">~${s.chg}</span><span class="pill">=${s.same}</span>`;
  if ($('diffAlOut')) $('diffAlOut').textContent = diffToAl(s);
  let an = 0, bn = 0, rows = '';
  ops.forEach(op => {
    if (op.t === 'same') { an++; bn++; rows += `<tr><td class="ln">${an}</td><td class="ln">${bn}</td><td>${escapeHtml(op.a)}</td></tr>`; }
    else if (op.t === 'del') { an++; rows += `<tr class="diff-del"><td class="ln">${an}</td><td class="ln"></td><td>- ${escapeHtml(op.a)}</td></tr>`; }
    else { bn++; rows += `<tr class="diff-add"><td class="ln"></td><td class="ln">${bn}</td><td>+ ${escapeHtml(op.b)}</td></tr>`; }
  });
  $('diffOut').innerHTML = `<table class="code">${rows}</table>`;
}
// ---- Swarm + Models ----
function buildBrief() {
  const task = $('swarmTask').value.trim(), ctx = $('swarmContext').value.trim(), sym = $('swarmSymptom').value.trim(), q = $('swarmQuestion').value.trim() || 'defects-ranked | file+line+mechanism+fix | proof-required';
  return `al:1\nagent: ai-workspace | role=swarm\ntask: ${task}\nctx: ${ctx}\nsymptom: ${sym}\nquestion: ${q}\nverify: check=file+line | result=required\nnext: verdict-each-model`;
}
function renderBrief() { $('briefOut').textContent = buildBrief(); }
const MODEL_PROMPTS = {
  claude: (b) => `${b}\nagent: claude | role=lead`,
  gemini: (b) => `${b}\nagent: gemini | role=second`,
  chatgpt: (b) => `${b}\nagent: chatgpt | role=logic-only | exec=none`,
  grok: (b) => `${b}\nagent: grok | role=independent`
};
function renderModelPrompts() {
  const b = buildBrief();
  Object.entries(MODEL_PROMPTS).forEach(([k, fn]) => { const el = $('prompt-' + k); if (el) el.textContent = fn(b); });
}
function verdictKey(model) { return 'ai-workspace_verdict_' + model; }
function saveVerdicts() {
  ['claude', 'gemini', 'chatgpt', 'grok'].forEach(m => store.set(verdictKey(m), { verdict: $(`verdict-${m}`).value, right: $(`right-${m}`).value, wrong: $(`wrong-${m}`).value }));
}
function loadVerdicts() {
  ['claude', 'gemini', 'chatgpt', 'grok'].forEach(m => { const v = store.get(verdictKey(m), {}); if ($(`verdict-${m}`)) $(`verdict-${m}`).value = v.verdict || ''; if ($(`right-${m}`)) $(`right-${m}`).value = v.right || ''; if ($(`wrong-${m}`)) $(`wrong-${m}`).value = v.wrong || ''; });
}
let conflicts = store.get('ai-workspace_conflicts', []);
function renderConflicts() {
  $('conflictList').innerHTML = conflicts.map((c, i) => `<div class="card" id="conflict-row-${i}"><strong>${escapeHtml(c.text)}</strong><p class="small">Resolution: ${escapeHtml(c.resolution || '—')}</p><button id="conflict-remove-${i}" onclick="removeConflict(${i})">Remove</button></div>`).join('') || 'conflicts: 0';
}
if (typeof window !== 'undefined') window.removeConflict = (i) => { conflicts.splice(i, 1); store.set('ai-workspace_conflicts', conflicts); renderConflicts(); };
// ---- Tools registry ----
const DEFAULT_TOOLS = [
  { name: 'Shared Workspace', desc: 'shared | ready | active | blocked | conflicts | pending-verify | sync=local-only', view: 'shared' },
  { name: 'Code Studio', desc: 'code | view | search | import', view: 'studio' },
  { name: 'Code Compare', desc: 'diff | add | del | chg | same', view: 'compare' },
  { name: 'Swarm Team', desc: 'brief-al | verdicts | conflicts | plan', view: 'swarm' },
  { name: 'Model Prompts', desc: 'prompt-al | per-model', view: 'models' },
  { name: 'Notes & Tasks', desc: 'notes | tasks | local', view: 'notes' },
  { name: 'Prompt Library', desc: 'prompts | save | search | copy', view: 'prompts' },
  { name: 'Snippet Vault', desc: 'snippets | lang | tags | exec=none', view: 'snippets' },
  { name: 'Format & Text Tools', desc: 'json | md | text | regex | exec=none', view: 'format' },
  { name: 'Work Tracker', desc: 'tracker | status | next | export', view: 'tracker' },
  { name: 'Deploy Checklist', desc: 'deploy-check | verify | go-ahead-required', view: 'deploy' },
  { name: 'agentlang', desc: 'al:1 | convert | examples', view: 'agentlang' },
  { name: 'boot', desc: 'al:1 | manifest | spec | tools | first-task', view: 'boot' },
  { name: 'pack', desc: 'al:1+json | code+verdict+notes+tracker', view: 'pack' },
  { name: 'queue', desc: 'al:1 | claim | assignee | status | single-owner', view: 'queue' },
  { name: 'Talk', desc: 'talk-al | from | to | task | ack | ts | local', view: 'talk' },
  { name: 'Forge', desc: 'forge | autonomy-0-5 | fingerprint | observer', view: 'forge' },
  { name: 'Canvas', desc: 'dag | ready-set | veto | blackboard', view: 'canvas' },
  { name: 'Vault', desc: 'memory | keyword-search | pin | forget', view: 'vault' },
  { name: 'Workshop', desc: 'registry | dry-run | js-worker | anchor', view: 'workshop' },
  { name: 'Router', desc: 'router-inspector | prompt-only | free-claims-unverified', view: 'router' },
  { name: 'Timeline', desc: 'timeline | decision-log | replay', view: 'timeline' },
  { name: 'Quota', desc: 'quota | meters | warning-al', view: 'quota' },
  { name: 'Audit', desc: 'audit | decision-log-append-only', view: 'audit' },
  { name: 'Lab', desc: 'lab | lint | fixtures | replay | snapshot | verify | migration', view: 'lab' },
  { name: 'Approval', desc: 'approval-inbox | duplicates | conflicts | sensitivity', view: 'approval' },
  { name: 'Gallery', desc: 'gallery | example-packs-al', view: 'gallery' }
];
function renderTools() {
  if (!$('toolGrid')) return;
  const custom = store.get('ai-workspace_custom_tools', []);
  const all = [...DEFAULT_TOOLS, ...custom];
  $('toolGrid').innerHTML = all.map((t, i) => `<div class="card" id="tool-row-${i}"><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.desc)}</p><div style="margin-top:10px">${t.view ? `<button id="tool-open-${i}" onclick="show('${t.view}')">Open</button>` : ''}${i >= DEFAULT_TOOLS.length ? ` <button id="tool-remove-${i}" onclick="removeTool(${i - DEFAULT_TOOLS.length})">Remove</button>` : ''}</div></div>`).join('');
}
if (typeof window !== 'undefined') window.removeTool = (i) => { const c = store.get('ai-workspace_custom_tools', []); c.splice(i, 1); store.set('ai-workspace_custom_tools', c); renderTools(); };
// ---- Notes & tasks ----
let tasks = store.get('ai-workspace_tasks', []);
function renderTasks() {
  $('taskList').innerHTML = tasks.map((t, i) => `<div class="row" id="task-row-${i}"><input id="task-check-${i}" type="checkbox" style="width:auto" ${t.done ? 'checked' : ''} onchange="toggleTask(${i})"><span class="${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span><button id="task-remove-${i}" onclick="removeTask(${i})">Remove</button></div>`).join('') || 'tasks: 0';
}
if (typeof window !== 'undefined') window.toggleTask = (i) => { tasks[i].done = !tasks[i].done; store.set('ai-workspace_tasks', tasks); renderTasks(); };
if (typeof window !== 'undefined') window.removeTask = (i) => { tasks.splice(i, 1); store.set('ai-workspace_tasks', tasks); renderTasks(); };

// ---- GitHub / website import (public only, no auth, no keys, no fake results) ----
function parseGitHubUrl(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'raw.githubusercontent.com') return { kind: 'raw', raw: url.trim(), name: u.pathname.split('/').pop() || 'file.txt' };
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const owner = parts[0], repo = parts[1];
        if (parts[2] === 'blob' && parts.length >= 5) {
          const branch = parts[3], path = parts.slice(4).join('/');
          return { kind: 'raw', raw: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`, name: path.split('/').pop() };
        }
        if (parts[2] === 'tree') {
          const branch = parts[3] || null, path = parts.slice(4).join('/');
          return { kind: 'repo', owner, repo, branch, path };
        }
        return { kind: 'repo', owner, repo, branch: null, path: '' };
      }
    }
    return { kind: 'web', url: url.trim() };
  } catch { return { kind: 'invalid' }; }
}
function importCurlFor(url) { return `curl -L ${JSON.stringify(url)}`; }
async function fetchImport() {
  const urlEl = $('importUrl'); if (!urlEl) return;
  const url = urlEl.value.trim(); const note = $('importNote'); const curlEl = $('importCurl'); const curlBtn = $('importCurlCopyBtn');
  const showCurl = () => { if (curlEl) { curlEl.style.display = 'block'; curlEl.textContent = importCurlFor(url); } if (curlBtn) curlBtn.style.display = 'inline-block'; };
  const hideCurl = () => { if (curlEl) curlEl.style.display = 'none'; if (curlBtn) curlBtn.style.display = 'none'; };
  if (!url) { note.textContent = 'blocked: reason=no-url | need=https-url'; return; }
  const parsed = parseGitHubUrl(url);
  if (parsed.kind === 'invalid') { note.textContent = 'blocked: reason=url-invalid | need=https-url'; showCurl(); return; }
  note.textContent = 'status: fetching';
  try {
    if (parsed.kind === 'raw') {
      const r = await fetch(parsed.raw);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      if (!text.trim()) { note.textContent = 'blocked: reason=import-empty | need=non-empty-file'; showCurl(); return; }
      $('codeInput').value = text; $('fileName').value = parsed.name || 'imported.txt'; renderCode(); hideCurl();
      note.textContent = `status: done | out: chars=${text.length} | file=${parsed.name || 'imported.txt'}`;
      return;
    }
    if (parsed.kind === 'repo') {
      const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}` + (parsed.path ? `/contents/${parsed.path}` : '') + (parsed.branch ? `?ref=${encodeURIComponent(parsed.branch)}` : '');
      const r = await fetch(api);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — the repo or path may be private or missing.');
      const j = await r.json();
      if (Array.isArray(j)) {
        const names = j.map(x => x.name + (x.type === 'dir' ? '/' : '')).join(', ');
        note.textContent = `status: done | repo=${parsed.owner}/${parsed.repo} | files=${names.slice(0, 500)}`;
      } else {
        note.textContent = `status: done | repo=${j.full_name || ''}`;
      }
      hideCurl(); return;
    }
  } catch (e) {
    note.textContent = 'status: blocked | reason=fetch-failed | err=' + (e && e.message ? e.message : String(e)) + ' | next: terminal-fetch | proof=none';
    showCurl();
  }
}
// ---- Prompt Library ----
let prompts = store.get('ai-workspace_prompts', []);
function renderPrompts() {
  const q = ($('promptSearch') ? $('promptSearch').value.trim().toLowerCase() : '');
  const list = prompts.map((pr, i) => ({ pr, i })).filter(x => !q || (x.pr.title + ' ' + x.pr.category + ' ' + x.pr.text).toLowerCase().includes(q));
  $('promptList').innerHTML = list.map(x => `<div class="card" id="prompt-row-${x.i}"><h3>${escapeHtml(x.pr.title)}</h3><p class="small">${escapeHtml(x.pr.category || '')}</p><pre class="block">${escapeHtml(x.pr.text)}</pre><div class="row"><button id="prompt-copy-${x.i}" onclick="copyPrompt(${x.i})">Copy</button><button id="prompt-edit-${x.i}" onclick="editPrompt(${x.i})">Edit</button><button id="prompt-remove-${x.i}" onclick="removePrompt(${x.i})">Remove</button></div></div>`).join('') || 'prompts: 0';
}
if (typeof window !== 'undefined') {
  window.copyPrompt = async (i) => { try { await navigator.clipboard.writeText(prompts[i].text); } catch {} };
  window.editPrompt = (i) => { $('promptTitle').value = prompts[i].title; $('promptCategory').value = prompts[i].category || ''; $('promptText').value = prompts[i].text; prompts.splice(i, 1); store.set('ai-workspace_prompts', prompts); renderPrompts(); show('prompts'); };
  window.removePrompt = (i) => { prompts.splice(i, 1); store.set('ai-workspace_prompts', prompts); renderPrompts(); };
}
// ---- Snippet Vault ----
let snippets = store.get('ai-workspace_snippets', []);
function renderSnippets() {
  const q = ($('snippetSearch') ? $('snippetSearch').value.trim().toLowerCase() : '');
  const list = snippets.map((sn, i) => ({ sn, i })).filter(x => !q || (x.sn.title + ' ' + x.sn.lang + ' ' + x.sn.tags + ' ' + x.sn.code).toLowerCase().includes(q));
  $('snippetList').innerHTML = list.map(x => `<div class="card" id="snippet-row-${x.i}"><h3>${escapeHtml(x.sn.title)}</h3><p class="small">${escapeHtml(x.sn.lang || '')} · ${escapeHtml(x.sn.tags || '')}</p><pre class="block">${escapeHtml(x.sn.code)}</pre><div class="row"><button id="snippet-copy-${x.i}" onclick="copySnippet(${x.i})">Copy</button><button id="snippet-remove-${x.i}" onclick="removeSnippet(${x.i})">Remove</button></div></div>`).join('') || 'snippets: 0';
}
if (typeof window !== 'undefined') {
  window.copySnippet = async (i) => { try { await navigator.clipboard.writeText(snippets[i].code); } catch {} };
  window.removeSnippet = (i) => { snippets.splice(i, 1); store.set('ai-workspace_snippets', snippets); renderSnippets(); };
}
// ---- Format / Markdown / Text / Regex (no eval, no code execution) ----
function formatJsonText(input, minify) {
  const obj = JSON.parse(input);
  return minify ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
}
function mdToHtml(md) {
  let esc = escapeHtml(md);
  esc = esc.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
  esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  esc = esc.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = esc.split('\n'); let out = '', inList = false;
  lines.forEach(line => {
    if (/^[-*] /.test(line)) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${line.slice(2)}</li>`; }
    else { if (inList) { out += '</ul>'; inList = false; } if (line.trim()) out += `<p>${line}</p>`; }
  });
  if (inList) out += '</ul>';
  return out || 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-input | need=md-input';
}
function sortDedupeLines(text, dedupe) {
  let lines = text.split('\n');
  if (dedupe) lines = [...new Set(lines)];
  return lines.sort().join('\n');
}
function regexTest(pattern, flags, text) {
  const re = new RegExp(pattern, flags || '');
  const matches = [];
  if (flags && flags.includes('g')) { let m; while ((m = re.exec(text)) !== null) { matches.push(m[0]); if (m[0] === '') re.lastIndex++; if (matches.length > 200) break; } }
  else { const m = re.exec(text); if (m) matches.push(m[0]); }
  return matches;
}
// ---- Work Tracker ----
const LEGAL_STATUSES = ['todo', 'doing', 'verify', 'done', 'blocked'];
function legalStatus(s) { return LEGAL_STATUSES.includes(s) ? s : 'blocked'; }
let projects = store.get('ai-workspace_projects', []).map(pr => ({ ...pr, status: legalStatus(pr.status) }));
function renderProjects() {
  $('trackerList').innerHTML = projects.map((pr, i) => `<div class="card" id="tracker-row-${i}"><h3>${escapeHtml(pr.name)}</h3><p class="small">Status: ${escapeHtml(legalStatus(pr.status))} · Next: ${escapeHtml(pr.next || '—')}</p><p>${escapeHtml(pr.notes || '')}</p><div class="row"><select id="tracker-status-${i}" onchange="setProjectStatus(${i}, this.value)">${LEGAL_STATUSES.map(s => `<option ${legalStatus(pr.status) === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button id="tracker-remove-${i}" onclick="removeProject(${i})">Remove</button></div></div>`).join('') || 'projects: 0';
}
if (typeof window !== 'undefined') {
  window.setProjectStatus = (i, v) => { projects[i].status = legalStatus(v); store.set('ai-workspace_projects', projects); renderProjects(); };
  window.removeProject = (i) => { projects.splice(i, 1); store.set('ai-workspace_projects', projects); renderProjects(); };
}
// ---- Deploy Checklist ----
const DEPLOY_ITEMS = [
  'url:200 | title:ai-workspace',
  'view:home | tools=all',
  'view:studio | lines | search | save-tab',
  'view:studio-import | github-ok-or-blocked-clear | proof=none-if-blocked',
  'view:compare | diff-al | add | del | chg | same',
  'view:swarm | brief-al | verdicts',
  'view:models | prompts-al | copy',
  'view:prompts | save | search | copy',
  'view:snippets | save | search | copy | exec=none',
  'view:format | json-pass | md | text | regex',
  'view:notes | task-add | tick | reload-persist',
  'view:tracker | add | status | export-al | export-json',
  'view:queue | claim | release | single-owner',
  'view:pack | al+json | copy',
  'view:boot | manifest | spec | tools',
  'view:agentlang | to-al | to-json | examples-al',
  'agent: owner | action=go-ahead | required=true'
]
let deployChecks = store.get('ai-workspace_deploy_checks', {});
function renderDeploy() {
  const done = DEPLOY_ITEMS.filter((_, i) => deployChecks[i]).length;
  $('deployProgress').textContent = `${done} of ${DEPLOY_ITEMS.length} checked`;
  $('deployList').innerHTML = DEPLOY_ITEMS.map((t, i) => `<div class="row" id="deploy-row-${i}"><input id="deploy-check-${i}" type="checkbox" style="width:auto" ${deployChecks[i] ? 'checked' : ''} onchange="toggleDeploy(${i})"><span class="${deployChecks[i] ? 'done' : ''}">${escapeHtml(t)}</span></div>`).join('');
}
if (typeof window !== 'undefined') window.toggleDeploy = (i) => { deployChecks[i] = !deployChecks[i]; store.set('ai-workspace_deploy_checks', deployChecks); renderDeploy(); };


// ---- AgentLang v1 validation (paste-in): reject invalid al:1, never silently accept ----
// Secret patterns: same high-confidence set as the Cloud path, so a pack
// blocked in Cloud is blocked here too, and vice versa. The patterns are
// detection regexes only, never values.
// Canonical secret-pattern table (same as site/secret-patterns.json and the
// identical embedded lists in agentcode.js + agentlang.js). HYGIENE ONLY:
// a block-tier match blocks publish/export; it is not a guarantee that a
// pack contains no secrets. Generic high-entropy pattern DROPPED (false
// positives). Field + line are reported, never the value.
const AL_SECRET_PATTERNS = [
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
// Warning tier only: bare email addresses warn, never block.
const AL_WARNING_PATTERNS = [
  { field: 'email-address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];
function alSecretError(input) {
  return AL_SECRET_PATTERNS.some(p => p.re.test(String(input || ''))) ? 'secret-pattern' : null;
}
function alSecretWarnings(input) {
  const out = [];
  String(input || '').split('\n').forEach((line, i) => {
    AL_WARNING_PATTERNS.forEach(p => { if (p.re.test(line)) out.push({ field: p.field, line: i + 1 }); });
  });
  return out;
}
// Compact single-line form — LEGACY DECODER ONLY (final judged revision:
// ChatGPT team round, reinforced by Gemini, overrides Grok's promotion).
// Compact is NOT a valid al:1 form for NEW records: validateAl blocks it
// with reason=compact-legacy-only. The genuine single-line need is met
// by ac:1, which is single-line by design, so a second al grammar adds
// two parsers and a header ambiguity for no capability ac:1 lacks.
// legacyExpandCompact() below is the ONLY compact path: it decodes an
// already-published Cloud single-line pack to canonical multi-line al:1
// plus a warning, and must not be used for new records. If a compact
// form is ever wanted again it must be a NEW header, not al:1.
// Legacy form (for the decoder only, ABNF in AGENT-LANG.md):
//   al:1 agent=test | action=live-browser-test | status=done
// Fields are pipe-separated key=value (or key: value). `action` is the
// Cloud name for the task, so it maps to task:. The compact form uses
// status= as its state, so it does not need a separate next/done/blocked
// line — unlike the multi-line form, which still requires exactly one end
// line, last. Compact form structure required: agent, task-or-action,
// and a legal status. Anything else about the compact form is rejected,
// not silently accepted.
const AL_COMPACT_KEYS = ['agent', 'task', 'action', 'status', 'ctx', 'in', 'out', 'verdict', 'conflict', 'next', 'done', 'blocked', 'verify', 'note'];
function parseSingleLineAl(raw) {
  const rest = String(raw || '').trim().slice(4).trim();
  if (!rest) return { error: 'missing-fields' };
  const fields = {};
  for (const part of rest.split(/\s*\|\s*/).filter(Boolean)) {
    const m = part.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*[:=]\s*(.+)$/);
    if (!m) return { error: 'line-not-code-value' };
    const key = m[1].toLowerCase();
    if (!AL_COMPACT_KEYS.includes(key)) return { error: 'unknown-field-' + key };
    const value = m[2].trim();
    if (!value) return { error: 'line-not-code-value' };
    if (key === 'action') { if (!fields.task) fields.task = value; fields.action = value; }
    else if (!(key in fields)) fields[key] = value;
  }
  if (!fields.agent) return { error: 'missing-agent' };
  if (!fields.task) return { error: 'missing-task' };
  if (!fields.status) return { error: 'missing-status' };
  if (!LEGAL_STATUSES.includes(fields.status)) return { error: 'status-not-legal' };
  return { fields };
}
// Expand a compact header line into canonical multi-line lines, so the
// rest of the site (to-al, to-json, Cloud import) works on one form.
function expandSingleLineAl(raw) {
  const parsed = parseSingleLineAl(raw);
  if (parsed.error) return null;
  const f = parsed.fields;
  const lines = ['al:1'];
  if (f.agent) lines.push('agent: ' + f.agent);
  if (f.task) lines.push('task: ' + f.task);
  if (f.status) lines.push('status: ' + f.status);
  for (const key of ['ctx', 'in', 'out', 'verdict', 'conflict', 'verify', 'note', 'next', 'done', 'blocked']) {
    if (f[key]) lines.push(key + ': ' + f[key]);
  }
  return lines;
}
function normalizeAlLines(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('al:1')) return null;
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines[0] === 'al:1') return lines;
  if (lines[0].startsWith('al:1 ')) return null; // compact: legacy decoder only, blocked by validateAl
  return null;
}
function validateAl(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('al:1')) return 'not-al';
  const secret = alSecretError(raw);
  if (secret) return secret;
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  // Compact single-line form: legacy only, blocked for new records.
  // (legacyExpandCompact decodes already-published Cloud packs only.)
  if (lines[0].startsWith('al:1 ')) return 'compact-legacy-only';
  // Multi-line form, possibly with a compact first line.
  const normalized = normalizeAlLines(raw);
  if (!normalized) return 'header-not-al:1';
  // Terminal + required-field rules, aligned with agentlang.js:
  // agent/task/status required; at most one terminal line; zero terminals
  // allowed iff status is done/blocked; terminal must agree with status
  // (next requires todo/doing/verify, done requires done, blocked requires
  // blocked); trailing metadata lines (id/ts/seq/file/data-class/proof-ref)
  // may follow the terminal line, nothing else may.
  let ends = 0;
  let statusValue = null;
  let termIdx = -1;
  let termCode = null;
  const seen = new Set();
  const META_AFTER_TERMINAL = ['id', 'ts', 'seq', 'file', 'data-class', 'proof-ref'];
  for (let idx = 1; idx < normalized.length; idx++) {
    const m = normalized[idx].match(/^([a-z]+): (.+)$/);
    if (!m) return 'line-not-code-value';
    if (!AL_CODES.includes(m[1])) return 'unknown-code-' + m[1];
    if (['agent', 'task', 'status'].includes(m[1])) {
      if (seen.has(m[1])) return 'duplicate-field';
      seen.add(m[1]);
    }
    if (m[1] === 'status') {
      statusValue = m[2].trim();
      if (!LEGAL_STATUSES.includes(statusValue)) return 'status-not-legal';
    }
    if (['next', 'done', 'blocked'].includes(m[1])) { ends++; termIdx = idx; termCode = m[1]; }
  }
  if (!seen.has('agent')) return 'missing-agent';
  if (!seen.has('task')) return 'missing-task';
  if (!seen.has('status')) return 'missing-status';
  if (ends > 1) return 'end-state-not-one';
  if (ends === 0) {
    if (statusValue === 'done' || statusValue === 'blocked') return null;
    return 'end-state-not-one';
  }
  if (termCode === 'next' && !['todo', 'doing', 'verify'].includes(statusValue)) return 'terminal-status-mismatch';
  if (termCode === 'done' && statusValue !== 'done') return 'terminal-status-mismatch';
  if (termCode === 'blocked' && statusValue !== 'blocked') return 'terminal-status-mismatch';
  for (let idx = termIdx + 1; idx < normalized.length; idx++) {
    const m = normalized[idx].match(/^([a-z]+): /);
    if (!m || !META_AFTER_TERMINAL.includes(m[1])) return 'end-state-not-last';
  }
  return null;
}
// to-json: a real JSON object, not an AgentLang summary line. For a valid
// pack, keys are the AgentLang codes; repeated codes become arrays. For an
// invalid pack, the JSON object carries blocked=true and the reason, so the
// Result area is still parseable JSON and never a fake success.
function alToJsonObject(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('al:1')) return { lang: 'al:1', blocked: true, reason: 'not-al', need: 'al:1-first-line' };
  const err = validateAl(raw);
  if (err) return { lang: 'al:1', blocked: true, reason: 'al-invalid-' + err, need: 'valid-al:1' };
  const lines = normalizeAlLines(raw);
  const obj = { lang: 'al:1' };
  const singleKeys = ['agent', 'task', 'status', 'next', 'done', 'blocked'];
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z]+): (.+)$/);
    if (!m) continue;
    const code = m[1], value = m[2].trim();
    if (singleKeys.includes(code)) { obj[code] = value; }
    else if (code in obj) { obj[code] = Array.isArray(obj[code]) ? obj[code].concat(value) : [obj[code], value]; }
    else obj[code] = value;
  }
  // Split the common "agent: name | role=x" and "task: id | title" shapes
  // into named fields, while keeping the full original strings above.
  if (typeof obj.agent === 'string') {
    const parts = obj.agent.split(/\s*\|\s*/);
    obj.agent = parts[0].trim();
    for (const p of parts.slice(1)) { const i = p.indexOf('='); if (i > 0) obj['agent_' + p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  }
  if (typeof obj.task === 'string' && obj.task.includes(' | ')) {
    const parts = obj.task.split(/\s*\|\s*/);
    obj.task = parts[0].trim();
    if (parts[1]) obj.task_title = parts.slice(1).join(' | ').trim();
  }
  return obj;
}
function alToJson(input) {
  return JSON.stringify(alToJsonObject(input), null, 2);
}
// ---- Shared Workspace summary (existing local stores only, no new model, no cloud) ----
function renderShared() {
  if (typeof document === 'undefined' || !$('sharedOut')) return;
  const prs = (typeof projects !== 'undefined' ? projects : []);
  const qs = (typeof queue !== 'undefined' ? queue : []);
  const cfs = (typeof conflicts !== 'undefined' ? conflicts : []);
  const unchecked = (typeof DEPLOY_ITEMS !== 'undefined' ? DEPLOY_ITEMS : []).filter((_, i) => !(typeof deployChecks !== 'undefined' && deployChecks[i])).length;
  const ready = prs.filter(p => legalStatus(p.status) === 'todo').length + qs.filter(q => q.status === 'todo').length;
  const active = prs.filter(p => legalStatus(p.status) === 'doing').length + qs.filter(q => q.status === 'doing').length;
  const blocked = prs.filter(p => legalStatus(p.status) === 'blocked').length;
  const pendingVerify = prs.filter(p => legalStatus(p.status) === 'verify').length + unchecked;
  $('sharedOut').textContent = ['al:1', 'agent: ai-workspace | role=shared', 'task: shared-summary | status: todo',
    `out: ready=${ready} | active=${active} | blocked=${blocked} | conflicts=${cfs.length} | pending-verify=${pendingVerify}`,
    'out: ready=tracker-todo+queue-todo | active=tracker-doing+queue-doing | blocked=tracker-blocked | pending-verify=tracker-verify+deploy-unchecked',
    'out: sync=local-only | store=localStorage | net=none | keys=none | exec=none | cloud=cloudflare-free-public-packs-only',
    `out: talk-total=${(typeof messages !== 'undefined' ? messages.length : 0)} | talk-unacked=${(typeof messages !== 'undefined' ? messages.filter(m => !m.ack).length : 0)}`,
    'note: counts-from-local-stores-only | no-new-model | no-cloud',
    'next: use-view'].join('\n');
}
if (typeof window !== 'undefined') window.renderShared = renderShared;
// ---- AgentLang v1: agent-first, one idea per line, code: value ----
const AL_CODES = ['agent', 'task', 'status', 'ctx', 'in', 'out', 'verdict', 'conflict', 'next', 'done', 'blocked', 'verify', 'note', 'id', 'ts', 'seq', 'file', 'data-class', 'proof-ref'];
// Proof-ref rule (team-round resolution): a verdict used to RESOLVE a
// conflict requires proof-ref=file:line:sha256 (or a test id). A verdict
// with proof=none, or basis=logic-only, counts as proof=none for
// resolution. validateAl() checks STRUCTURE only, so old packs stay
// valid; proofRefStatus() decides resolvability — a pack without a
// proof-ref is ranked unproven and never resolves a conflict.
function proofRefStatus(input) {
  const raw = String(input || '');
  const hasConflict = /^conflict:/m.test(raw);
  const hasProofRef = /proof-ref=/.test(raw);
  const basisLogicOnly = /basis=logic-only/.test(raw);
  const proofNone = /proof=none/.test(raw);
  const resolving = hasConflict && !/resolve=(none|unresolved)/.test(raw);
  const unproven = basisLogicOnly || proofNone || (resolving && !hasProofRef);
  return { hasConflict, hasProofRef, basisLogicOnly, proofNone, resolving, unproven, resolvesConflict: resolving && hasProofRef && !basisLogicOnly && !proofNone };
}
const AL_EXAMPLES = [
`al:1
agent: ai-workspace | role=builder
task: fix-login-loop | Fix the login redirect loop
status: doing
ctx: static site, no server, login page reloads after sign-in
in: file=index.html | lines=1-40
out: removed the reload fallback, kept the sign-in link
verify: check=local serve | result=pass
next: show diff, wait for go-ahead`,
`al:1
agent: swarm | role=verdict
task: fix-login-loop | Find why login redirects loop
verdict: model=claude | file=app.js | claim=reload fallback re-runs on every load | fix=remove fallback | proof=code
verdict: model=gemini | file=app.js | claim=same reload line, plus stale cache | fix=remove fallback, clear cache note | proof=code
conflict: a=claude says fallback only | b=gemini says fallback plus cache | resolve=code shows fallback only, cache is a note not a fix
next: apply fallback removal only, re-verify`,
`al:1
agent: ai-workspace | role=deploy-check
task: ai-workspace-v3 | Verify before deploy
verify: check=live url loads | result=pass
verify: check=agentlang view opens | result=pass
verify: check=copy buttons work | result=pass
status: verify
next: show to owner, deploy only on go-ahead`,
`al:1
agent: new-agent | role=hello
task: onboard | Read AgentsOpen and AgentLang before changing anything
status: doing
ctx: repo=ai-workspace | docs=AGENT-LANG.md, AGENT-START.md
note: I will not push, deploy, spend, or delete without owner go-ahead
next: read AGENT-LANG.md, then pick one small tool to extend`
];
function noteToAl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('al:1')) return raw;
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const out = ['al:1', 'agent: ai-workspace | role=user'];
  const map = { task: 'task', context: 'ctx', ctx: 'ctx', input: 'in', in: 'in', output: 'out', out: 'out', result: 'out', verdict: 'verdict', conflict: 'conflict', next: 'next', done: 'done', blocked: 'blocked', verify: 'verify', status: 'status', note: 'note', notes: 'note' };
  let taskSeen = false;
  lines.forEach((line) => {
    const m = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const code = map[key];
      if (code) { out.push(code + ': ' + m[2].trim()); if (code === 'task') taskSeen = true; return; }
    }
    if (!taskSeen) { out.push('task: ' + line); taskSeen = true; }
    else out.push('note: ' + line);
  });
  if (!out.some(l => l.startsWith('next:') || l.startsWith('done:') || l.startsWith('blocked:'))) out.push('next: review and refine');
  return out.join('\n');
}
function alToSummary(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('al:1')) return 'blocked: reason=not-al | need=al:1-first-line';
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  return lines.join('\n');
}
function diffToAl(s) {
  return `al:1\nagent: ai-workspace | role=diff\ntask: diff | status: done\nout: add=${s.add} | del=${s.del} | chg=${s.chg} | same=${s.same}\nnext: review-diff`;
}
function trackerToAl(list) {
  const rows = (list || []).map(pr => `task: ${pr.name} | status=${legalStatus(pr.status)} | next=${pr.next || ''} | notes=${pr.notes || ''}`);
  return ['al:1', 'agent: ai-workspace | role=tracker', ...rows, 'next: pick-todo'].join('\n');
}
function packToAl(o) {
  return ['al:1', `agent: ai-workspace | role=pack`, `task: ${o.task || 'pack'} | status: done`, `in: code=${(o.code||'').length}chars | verdict=${(o.verdict||'').length}chars`, `out: ${o.verdict || ''}`, `note: ${o.notes || ''}`, 'next: handoff'].join('\n');
}
function loadAlExample(i) {
  const ex = AL_EXAMPLES[i] || AL_EXAMPLES[0];
  if ($('alInput')) $('alInput').value = ex;
  if ($('alExampleOut')) $('alExampleOut').textContent = ex;
  if ($('alOut')) $('alOut').textContent = alToSummary(ex);
}
if (typeof window !== 'undefined') window.loadAlExample = loadAlExample;


// ---- Queue (single-owner claim, browser-only, NOT server-atomic) ----
let queue = store.get('ai-workspace_queue', []);
function renderQueue() {
  if (!$('queueList')) return;
  $('queueList').innerHTML = queue.map((q, i) => `<div class="card" id="queue-row-${i}"><pre class="block">al:1
agent: ${escapeHtml(q.agent || 'unassigned')} | role=worker
task: ${escapeHtml(q.task)} | status=${escapeHtml(q.status)}
next: ${escapeHtml(q.next || '')}</pre><div class="row"><button id="queue-claim-${i}" onclick="claimQueue(${i})">claim</button><button id="queue-release-${i}" onclick="releaseQueue(${i})">release</button><button id="queue-remove-${i}" onclick="removeQueue(${i})">remove</button></div></div>`).join('') || 'queue: 0';
  if ($('queueAlOut')) $('queueAlOut').textContent = ['al:1','agent: ai-workspace | role=queue', ...queue.map(q => `task: ${q.task} | agent=${q.agent || 'unassigned'} | status=${q.status}`), 'next: claim-todo'].join('\n');
}
if (typeof window !== 'undefined') {
  window.claimQueue = (i) => { queue[i].agent = 'agent-claimed'; queue[i].status = 'doing'; store.set('ai-workspace_queue', queue); renderQueue(); };
  window.releaseQueue = (i) => { queue[i].agent = 'unassigned'; queue[i].status = 'todo'; store.set('ai-workspace_queue', queue); renderQueue(); };
  window.removeQueue = (i) => { queue.splice(i, 1); store.set('ai-workspace_queue', queue); renderQueue(); };
}
function buildPack() {
  const o = { task: $('packTask') ? $('packTask').value.trim() : '', code: $('packCode') ? $('packCode').value : '', verdict: $('packVerdict') ? $('packVerdict').value : '', notes: $('packNotes') ? $('packNotes').value : '' };
  if ($('packOut')) $('packOut').textContent = packToAl(o);
  if ($('packJsonOut')) $('packJsonOut').textContent = JSON.stringify({ al: packToAl(o), task: o.task, code_chars: o.code.length, verdict: o.verdict, notes: o.notes, tracker: projects }, null, 2);
}

// ---- Talk only: AgentLang records, no chat projection ----
// Store key (only one): ai-workspace_messages. No chat view, no bubbles.
let messages = store.get('ai-workspace_messages', []).filter(m => m && typeof m.from === 'string' && typeof m.task === 'string' && typeof m.text === 'string').map(m => ({ id: String(m.id || ''), from: m.from, to: m.to || 'all', task: m.task, text: m.text, ack: !!m.ack, ts: String(m.ts || '') }));
// singleLine: escape, never substitute. The old version replaced | with /
// and newlines with spaces (lossy, irreversible, collision-prone). The new
// rule escapes \ | : = newline per the shared al:1/ac:1 escaping rule.
function singleLine(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/:/g, '\\:').replace(/=/g, '\\=').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
function messageAl(m) {
  return ['al:1', `agent: ${singleLine(m.from)} | role=talk`, `task: ${singleLine(m.task)}`, `ctx: to=${singleLine(m.to)} | ack=${m.ack ? 'true' : 'false'} | ts=${m.ts}`, `out: ${singleLine(m.text)}`, m.ack ? 'done: acknowledged' : 'next: ack'].join('\n');
}
function messagesToAl(list) {
  if (!list || !list.length) return 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-messages | need=send-msg-first';
  return ['al:1', 'agent: ai-workspace | role=talk', 'task: talk-export | status: todo',
    ...list.map(m => `note: msg id=${m.id} | from=${singleLine(m.from)} | to=${singleLine(m.to)} | task=${singleLine(m.task)} | ack=${m.ack ? 'true' : 'false'} | ts=${m.ts} | text=${singleLine(m.text)}`),
    'next: import-validated-only'].join('\n');
}
function parseTalkImport(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('al:1')) return { error: 'not-al' };
  const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
  const noteMsgs = [], skipped = [];
  for (const line of lines) {
    if (!line.startsWith('note: msg ')) continue;
    const pairs = {};
    line.slice('note: msg '.length).split(' | ').forEach(p => { const i = p.indexOf('='); if (i > 0) pairs[p.slice(0, i).trim()] = p.slice(i + 1); });
    if (!pairs.from || !pairs.task || !pairs.text) { skipped.push({ line: lines.indexOf(line), reason: 'msg-missing-from-task-text' }); continue; }
    if (pairs.ack && !['true', 'false'].includes(pairs.ack)) { skipped.push({ line: lines.indexOf(line), reason: 'msg-ack-not-bool' }); continue; }
    noteMsgs.push({ id: pairs.id || '', from: pairs.from, to: pairs.to || 'all', task: pairs.task, text: pairs.text, ack: pairs.ack === 'true', ts: pairs.ts || '' });
  }
  if (noteMsgs.length || skipped.length) return { msgs: noteMsgs, applied: noteMsgs.length, skipped, note: 'per-message-report | valid-imported | invalid-skipped-with-index' };
  // Block mode: one al:1 block per message (agent/task/ctx/out, ending next/done)
  const blocks = raw.split(/(?=^al:1$)/m).map(b => b.trim()).filter(Boolean);
  const msgs = [];
  for (const b of blocks) {
    const bl = b.split('\n').map(s => s.trim()).filter(Boolean);
    if (bl[0] !== 'al:1') { skipped.push({ block: blocks.indexOf(b), reason: 'block-header-not-al:1' }); continue; };
    let from = '', task = '', out = '', to = 'all', ack = false, ts = '';
    for (const line of bl.slice(1)) {
      const m = line.match(/^([a-z]+): (.+)$/);
      if (!m) { skipped.push({ block: blocks.indexOf(b), reason: 'block-line-not-code-value' }); break; };
      if (m[1] === 'agent') from = m[2].split(' | ')[0].trim();
      if (m[1] === 'task') task = m[2].trim();
      if (m[1] === 'out') out = m[2].trim();
      if (m[1] === 'ctx') m[2].split(' | ').forEach(p => { const i = p.indexOf('='); if (i > 0) { const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim(); if (k === 'to') to = v; if (k === 'ack') ack = (v === 'true'); if (k === 'ts') ts = v; } });
    }
    if (!from || !task || !out) { skipped.push({ block: blocks.indexOf(b), reason: 'block-missing-agent-task-out' }); continue; };
    msgs.push({ id: '', from, to, task, text: out, ack, ts });
  }
  if (!msgs.length) return { msgs: [], applied: 0, skipped, error: skipped.length ? 'all-messages-skipped' : 'no-messages-found' };
  return { msgs, applied: msgs.length, skipped, note: 'per-message-report | valid-imported | invalid-skipped-with-index' };
}
function filteredMessages(searchId, taskId, ackId) {
  const q = (typeof document !== 'undefined' && $(searchId) ? $(searchId).value.trim().toLowerCase() : '');
  const tf = (typeof document !== 'undefined' && $(taskId) ? $(taskId).value.trim().toLowerCase() : '');
  const af = (typeof document !== 'undefined' && $(ackId) ? $(ackId).value : 'all');
  return messages.map((m, i) => ({ m, i })).filter(x => {
    if (q && !(x.m.from + ' ' + x.m.task + ' ' + x.m.text).toLowerCase().includes(q)) return false;
    if (tf && x.m.task.toLowerCase() !== tf) return false;
    if (af === 'acked' && !x.m.ack) return false;
    if (af === 'unacked' && x.m.ack) return false;
    return true;
  });
}
function groupByTask(list) {
  const groups = [];
  list.forEach(x => { let g = groups.find(g => g.task === x.m.task); if (!g) { g = { task: x.m.task, items: [] }; groups.push(g); } g.items.push(x); });
  return groups;
}
function renderTalk() {
  if (typeof document === 'undefined' || !$('talkList')) return;
  const groups = groupByTask(filteredMessages('talkSearch', 'talkTaskFilter', 'talkAckFilter'));
  if (!groups.length) { $('talkList').innerHTML = 'messages: 0'; return; }
  $('talkList').innerHTML = groups.map(g => `<div class="panel"><h3>task: ${escapeHtml(g.task)}</h3>` + g.items.map(x => `<div class="card" id="talk-row-${x.i}"><pre class="block" id="talk-al-${x.i}">${escapeHtml(messageAl(x.m))}</pre><div class="row"><button id="talk-ack-${x.i}" onclick="ackMessage(${x.i})" ${x.m.ack ? 'disabled' : ''}>${x.m.ack ? 'acked' : 'ack'}</button><button id="talk-copy-${x.i}" onclick="copyText('talk-al-${x.i}', this)">copy</button><button id="talk-reply-${x.i}" onclick="replyMessage(${x.i}, 'talk')">reply</button></div></div>`).join('') + '</div>').join('');
}
if (typeof window !== 'undefined') {
  window.renderTalk = renderTalk;
  window.ackMessage = (i) => { if (!messages[i] || messages[i].ack) return; messages[i].ack = true; if (!store.set('ai-workspace_messages', messages)) { if ($('talkStatus')) $('talkStatus').textContent = 'blocked: reason=save-failed | need=storage-available'; } renderTalk(); renderShared(); };
  window.replyMessage = (i, prefix) => { const m = messages[i]; if (!m) return; const toEl = $(prefix + 'To'), taskEl = $(prefix + 'Task'); if (toEl) toEl.value = m.from; if (taskEl) taskEl.value = m.task; show(prefix); const txt = $(prefix + 'Text'); if (txt) txt.focus(); };
}
function sendMessage(prefix) {
  const from = $(prefix + 'From').value.trim(), to = $(prefix + 'To').value.trim() || 'all', task = $(prefix + 'Task').value.trim(), text = $(prefix + 'Text').value.trim();
  const status = $(prefix + 'Status');
  if (!from) { status.textContent = 'blocked: reason=no-from | need=agent-name'; return; }
  if (!task) { status.textContent = 'blocked: reason=no-task | need=task-id'; return; }
  if (!text) { status.textContent = 'blocked: reason=no-text | need=message-text'; return; }
  const msg = { id: 'msg-' + Date.now() + '-' + messages.length, from, to, task, text, ack: false, ts: new Date().toISOString() };
  messages.push(msg);
  if (!store.set('ai-workspace_messages', messages)) { status.textContent = 'blocked: reason=save-failed | need=storage-available'; return; }
  $(prefix + 'Text').value = '';
  status.textContent = 'status: done | out=msg-sent | id=' + msg.id;
  renderTalk(); renderShared();
}
function exportMessages(outId, statusId) {
  if (!messages.length) { $(outId).textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=no-messages | need=send-msg-first'; if (statusId && $(statusId)) $(statusId).textContent = 'blocked: reason=no-messages | need=send-msg-first'; return; }
  $(outId).textContent = messagesToAl(messages);
}
function importMessages(inputId, statusId) {
  const parsed = parseTalkImport($(inputId).value);
  const status = $(statusId);
  if (parsed.error) { status.textContent = 'blocked: reason=talk-import-invalid-' + parsed.error + ' | need=valid-al-msg'; return; }
  const existing = new Set(messages.map(m => m.id));
  const incoming = parsed.msgs.map((m, k) => ({ ...m, id: (m.id && !existing.has(m.id)) ? m.id : ('msg-import-' + Date.now() + '-' + k), ts: m.ts || new Date().toISOString() }));
  messages.push(...incoming);
  if (!store.set('ai-workspace_messages', messages)) { status.textContent = 'blocked: reason=save-failed | need=storage-available'; return; }
  $(inputId).value = '';
  status.textContent = 'status: done | out=imported=' + incoming.length;
  renderTalk(); renderShared();
}


// ---- Init (guarded so Node can import helpers without a DOM) ----
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    renderFiles(); renderCode(); loadVerdicts(); renderConflicts(); renderTools(); renderTasks(); renderBrief(); renderModelPrompts();
    $('codeInput').addEventListener('input', renderCode);
    $('codeSearch').addEventListener('input', renderCode);
    $('saveFileBtn').onclick = saveFile;
    $('downloadBtn').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('codeInput').value], { type: 'text/plain' })); a.download = $('fileName').value || 'code.txt'; a.click(); };
    $('fileUpload').addEventListener('change', e => { if (e.target.files[0]) loadDroppedFile(e.target.files[0]); });
    $('codeInput').addEventListener('dragover', e => e.preventDefault());
    $('codeInput').addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) loadDroppedFile(e.dataTransfer.files[0]); });
    $('runDiffBtn').onclick = runDiff;
    ['swarmTask', 'swarmContext', 'swarmSymptom', 'swarmQuestion'].forEach(id => $(id).addEventListener('input', () => { renderBrief(); renderModelPrompts(); }));
    ['claude', 'gemini', 'chatgpt', 'grok'].forEach(m => { $(`verdict-${m}`).addEventListener('input', saveVerdicts); $(`right-${m}`).addEventListener('input', saveVerdicts); $(`wrong-${m}`).addEventListener('input', saveVerdicts); });
    $('addConflictBtn').onclick = () => { const t = $('conflictText').value.trim(); if (!t) return; conflicts.push({ text: t, resolution: $('conflictResolution').value.trim() }); store.set('ai-workspace_conflicts', conflicts); $('conflictText').value = ''; $('conflictResolution').value = ''; renderConflicts(); };
    if ($('addToolBtn')) $('addToolBtn').onclick = () => { const name = $('toolName').value.trim(), desc = $('toolDesc').value.trim(); if (!name) return; const c = store.get('ai-workspace_custom_tools', []); c.push({ name, desc, view: '' }); store.set('ai-workspace_custom_tools', c); $('toolName').value = ''; $('toolDesc').value = ''; renderTools(); };
    $('notesArea').value = store.get('ai-workspace_notes', '');
    $('notesArea').addEventListener('input', () => store.set('ai-workspace_notes', $('notesArea').value));
    $('addTaskBtn').onclick = () => { const t = $('taskInput').value.trim(); if (!t) return; tasks.push({ text: t, done: false }); store.set('ai-workspace_tasks', tasks); $('taskInput').value = ''; renderTasks(); };
    $('jointPlan').value = store.get('ai-workspace_joint_plan', '');
    $('jointPlan').addEventListener('input', () => store.set('ai-workspace_joint_plan', $('jointPlan').value));
    // v2 bindings (guarded by element existence via $ checks in handlers where needed)
    if ($('importFetchBtn')) $('importFetchBtn').onclick = fetchImport;
    if ($('importToCompareBtn')) $('importToCompareBtn').onclick = () => { const t = $('codeInput').value; if (t) $('rightCode').value = t; show('compare'); };
    renderPrompts(); renderSnippets(); renderProjects(); renderDeploy();
    if ($('promptSaveBtn')) $('promptSaveBtn').onclick = () => { const title = $('promptTitle').value.trim(), text = $('promptText').value.trim(); if (!title || !text) return; prompts.push({ title, category: $('promptCategory').value.trim(), text }); store.set('ai-workspace_prompts', prompts); $('promptTitle').value = ''; $('promptCategory').value = ''; $('promptText').value = ''; renderPrompts(); };
    if ($('promptSearch')) $('promptSearch').addEventListener('input', renderPrompts);
    if ($('snippetSaveBtn')) $('snippetSaveBtn').onclick = () => { const title = $('snippetTitle').value.trim(), code = $('snippetCode').value.trim(); if (!title || !code) return; snippets.push({ title, lang: $('snippetLang').value.trim(), tags: $('snippetTags').value.trim(), code }); store.set('ai-workspace_snippets', snippets); $('snippetTitle').value = ''; $('snippetLang').value = ''; $('snippetTags').value = ''; $('snippetCode').value = ''; renderSnippets(); };
    if ($('snippetSearch')) $('snippetSearch').addEventListener('input', renderSnippets);
    if ($('formatJsonBtn')) $('formatJsonBtn').onclick = () => { try { $('jsonOut').textContent = formatJsonText($('jsonInput').value, false); $('jsonStatus').textContent = 'verify: check=json | result=pass'; } catch (e) { $('jsonOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; $('jsonStatus').textContent = 'blocked: reason=json-invalid | need=valid-json | err=' + e.message; } };
    if ($('minifyJsonBtn')) $('minifyJsonBtn').onclick = () => { try { $('jsonOut').textContent = formatJsonText($('jsonInput').value, true); $('jsonStatus').textContent = 'verify: check=json | result=pass | out=minified'; } catch (e) { $('jsonOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=json-invalid | need=valid-json'; $('jsonStatus').textContent = 'blocked: reason=json-invalid | need=valid-json | err=' + e.message; } };
    if ($('mdInput')) { $('mdPreview').innerHTML = mdToHtml($('mdInput').value); $('mdInput').addEventListener('input', () => { $('mdPreview').innerHTML = mdToHtml($('mdInput').value); }); }
    if ($('textCountBtn')) $('textCountBtn').onclick = () => { const t = $('textInput').value; $('textStats').textContent = `chars=${t.length} | words=${t.trim() ? t.trim().split(/\s+/).length : 0} | lines=${t.split('\n').length}`; };
    if ($('textUpperBtn')) $('textUpperBtn').onclick = () => { $('textOut').value = $('textInput').value.toUpperCase(); };
    if ($('textLowerBtn')) $('textLowerBtn').onclick = () => { $('textOut').value = $('textInput').value.toLowerCase(); };
    if ($('textSortBtn')) $('textSortBtn').onclick = () => { $('textOut').value = sortDedupeLines($('textInput').value, false); };
    if ($('textDedupeBtn')) $('textDedupeBtn').onclick = () => { $('textOut').value = sortDedupeLines($('textInput').value, true); };
    if ($('regexTestBtn')) $('regexTestBtn').onclick = () => { try { const m = regexTest($('regexPattern').value, $('regexFlags').value, $('regexTestText').value); $('regexOut').textContent = m.length ? `matches=${m.length} | ${m.slice(0, 20).join(' | ')}` : 'matches=0'; } catch (e) { $('regexOut').textContent = 'blocked: reason=regex-invalid | err=' + e.message; } };
    if ($('trackerAddBtn')) $('trackerAddBtn').onclick = () => { const name = $('trackerName').value.trim(); if (!name) return; projects.push({ name, status: $('trackerStatus').value, next: $('trackerNext').value.trim(), notes: $('trackerNotes').value.trim() }); store.set('ai-workspace_projects', projects); $('trackerName').value = ''; $('trackerNext').value = ''; $('trackerNotes').value = ''; renderProjects(); };
    if ($('trackerExportJsonBtn')) $('trackerExportJsonBtn').onclick = () => { $('trackerExportOut').textContent = JSON.stringify(projects, null, 2); };
    if ($('trackerExportMdBtn')) $('trackerExportMdBtn').onclick = () => { $('trackerExportOut').textContent = projects.map(pr => `- [${legalStatus(pr.status) === 'done' ? 'x' : ' '}] ${pr.name} — ${legalStatus(pr.status)} — Next: ${pr.next || '—'}${pr.notes ? ' — ' + pr.notes : ''}`).join('\n') || 'No work items yet.'; };
    if ($('deployResetBtn')) $('deployResetBtn').onclick = () => { deployChecks = {}; store.set('ai-workspace_deploy_checks', deployChecks); renderDeploy(); };
    if ($('alToLangBtn')) $('alToLangBtn').onclick = () => { const v = $('alInput').value; if (v.trim().startsWith('al:1')) { const err = validateAl(v); if (err) { $('alOut').textContent = 'al:1\nagent: ai-workspace | status: blocked\nblocked: reason=al-invalid-' + err + ' | need=valid-al:1'; $('alStatus').textContent = 'blocked: reason=al-invalid-' + err + ' | need=valid-al:1'; return; } const norm = normalizeAlLines(v); $('alOut').textContent = norm ? norm.join('\n') : v.trim(); $('alStatus').textContent = v.trim().includes('\n') ? 'status: done | note=already-al' : 'status: done | note=already-al-expanded-single-line'; return; } $('alOut').textContent = noteToAl(v); $('alStatus').textContent = 'status: done | out=al:1'; };
    if ($('alToSummaryBtn')) $('alToSummaryBtn').onclick = () => { const v = $('alInput').value; const obj = alToJsonObject(v); $('alOut').textContent = JSON.stringify(obj, null, 2); $('alStatus').textContent = obj.blocked ? 'blocked: reason=' + obj.reason + ' | need=' + obj.need : 'status: done | out=json-object'; };
    if ($('alLoadExampleBtn')) $('alLoadExampleBtn').onclick = () => loadAlExample(0);
    renderQueue(); renderShared(); renderTalk();
    if ($('talkSendBtn')) $('talkSendBtn').onclick = () => sendMessage('talk');
    if ($('talkSearch')) $('talkSearch').addEventListener('input', renderTalk);
    if ($('talkTaskFilter')) $('talkTaskFilter').addEventListener('input', renderTalk);
    if ($('talkAckFilter')) $('talkAckFilter').addEventListener('change', renderTalk);
    if ($('talkExportBtn')) $('talkExportBtn').onclick = () => exportMessages('talkExportOut', 'talkStatus');
    if ($('talkImportBtn')) $('talkImportBtn').onclick = () => importMessages('talkImportInput', 'talkImportStatus');
    if ($('queueAddBtn')) $('queueAddBtn').onclick = () => { const t = $('queueTask').value.trim(); if (!t) return; queue.push({ task: t, agent: 'unassigned', status: 'todo', next: $('queueNext').value.trim() }); store.set('ai-workspace_queue', queue); $('queueTask').value=''; $('queueNext').value=''; renderQueue(); };
    if ($('packBuildBtn')) $('packBuildBtn').onclick = buildPack;
    if ($('trackerExportAlBtn')) $('trackerExportAlBtn').onclick = () => { $('trackerAlOut').textContent = trackerToAl(projects); };
    // Try to load the editable registry; fall back silently to built-ins if opened as file://
    fetch('tools.json').then(r => r.ok ? r.json() : null).then(j => { if (j && Array.isArray(j.tools)) { const names = new Set(DEFAULT_TOOLS.map(t => t.name)); j.tools.filter(t => !names.has(t.name)).forEach(t => DEFAULT_TOOLS.push(t)); renderTools(); } }).catch(() => {});
  });
}

// Legacy compact decoder ONLY (final judged revision): decodes an
// already-published Cloud single-line pack to canonical multi-line al:1
// plus a warning. Never used for new records (validateAl blocks them).
function legacyExpandCompact(raw) {
  const parsed = parseSingleLineAl(raw);
  if (parsed.error) return { error: parsed.error };
  const expanded = expandSingleLineAl(raw);
  if (!expanded) return { error: 'compact-legacy-only' };
  return { expanded, warning: 'legacy-compact | use-multi-line-al:1-for-new-records | use-ac:1-for-single-line' };
}
if (typeof module !== 'undefined') module.exports = { escapeHtml, highlight, diffLines, diffSummary, MODEL_PROMPTS, buildBriefForTest: (o) => `Task: ${o.task}`, parseGitHubUrl, importCurlFor, formatJsonText, mdToHtml, sortDedupeLines, regexTest, DEPLOY_ITEMS, noteToAl, alToSummary, AL_EXAMPLES, diffToAl, trackerToAl, packToAl, validateAl, legalStatus, LEGAL_STATUSES, messageAl, messagesToAl, parseTalkImport, singleLine, parseSingleLineAl, expandSingleLineAl, legacyExpandCompact, normalizeAlLines, alToJsonObject, alToJson, alSecretError, alSecretWarnings, show, showAllViews, parseViewParam, applyViewParam, VALID_VIEWS, proofRefStatus, AL_CODES };
