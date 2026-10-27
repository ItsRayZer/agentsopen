// AgentsOpen v7.3 — AgentCode merge + free-forever notes. Additive layer.
// FREE-ONLY, LOCAL ONLY until deploy. No encryption, no secret key, no keys,
// no live model calls, no paid features, no kill button, no skill-switch.
// AgentCode ac:1 is a public codebook (site/AGENT-CODE.md), NOT secret:
// any agent — and the owner — can decode it with agentcode.js on demand.
// If a record does not decode with the codebook, do not trust it.
(function () {
  'use strict';
  const $ = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const sl = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
  const AC_EXAMPLE = 'ac:1;a=mia;t=review-login-loop;s=dg;v=mia:review-login-loop:cd;n=handoff';
  const AL_EXAMPLE = ['al:1', 'agent: mia', 'task: review-login-loop', 'status: doing',
    'verdict: model=mia | claim=review-login-loop | proof=code', 'next: handoff'].join('\n');

  function counts(text) {
    const chars = String(text).length;
    return { chars };
  }
  // Break-even: codebook chars / chars saved per message (vs JSON).
  // No tokenizer is used or claimed here.
  function breakEven(codebookChars, savedChars) {
    if (!savedChars || savedChars <= 0) return null;
    return Math.ceil(codebookChars / savedChars);
  }
  function exampleCounts() {
    const ac = counts(AC_EXAMPLE);
    const al = counts(AL_EXAMPLE);
    const json = counts(JSON.stringify({ lang: 'al:1', agent: 'mia', task: 'review-login-loop', status: 'doing', verdict: { model: 'mia', claim: 'review-login-loop', proof: 'code' }, next: 'handoff' }));
    return { ac: ac, al: al, json: json, acExample: AC_EXAMPLE, alExample: AL_EXAMPLE };
  }
  function ac() { return (typeof window !== 'undefined' && window.AgentCode) ? window.AgentCode : null; }
  function setOut(text) { if ($('acOut')) $('acOut').textContent = text; }
  function run(fn, label) {
    const input = $('acInput') ? $('acInput').value : '';
    const api = ac();
    if (!api) { setOut('blocked: reason=agentcode-client-missing | need=agentcode.js-loaded'); return; }
    try {
      const out = fn(api, input);
      setOut(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } catch (e) {
      setOut('blocked: reason=' + sl((e && e.reason) || 'invalid') + ' | need=' + sl((e && e.need) || 'valid-ac:1-or-al:1-or-json'));
    }
  }
  function doAcToAl() { run((api, input) => api.acToAl(input), 'ac->al'); }
  function doAlToAc() { run((api, input) => api.alToAc(input), 'al->ac'); }
  function doAcToJson() { run((api, input) => api.acToJson(input), 'ac->json'); }
  function doJsonToAc() {
    run((api, input) => {
      let obj;
      try { obj = JSON.parse(input); } catch (e) { throw Object.assign(new Error('blocked: reason=json-not-parseable | need=valid-json-object'), { reason: 'json-not-parseable', need: 'valid-json-object' }); }
      return api.jsonToAc(obj);
    }, 'json->ac');
  }
  function doExample() {
    const c = exampleCounts();
    if ($('acInput')) $('acInput').value = c.acExample;
    const savedVsJson = c.json.chars - c.ac.chars;
    setOut('ac:1 example | chars=' + c.ac.chars + ' | chars-saved-vs-json=' + savedVsJson + '\n' +
      'al:1 same task | chars=' + c.al.chars + ' | chars-saved-vs-json=' + (c.json.chars - c.al.chars) + '\n' +
      'json same task | chars=' + c.json.chars + '\n' +
      'note: codebook-chars=6966 | break-even-vs-json=' + breakEven(6966, savedVsJson) + ' messages | tokens=not-measured | ac-is-shortest-here | al-is-for-handoff | json-is-for-exact-data');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if ($('acToAlBtn')) $('acToAlBtn').onclick = doAcToAl;
      if ($('alToAcBtn')) $('alToAcBtn').onclick = doAlToAc;
      if ($('acToJsonBtn')) $('acToJsonBtn').onclick = doAcToJson;
      if ($('jsonToAcBtn')) $('jsonToAcBtn').onclick = doJsonToAc;
      if ($('acExampleBtn')) $('acExampleBtn').onclick = doExample;
    });
  }
  if (typeof module !== 'undefined') module.exports = { AC_EXAMPLE, AL_EXAMPLE, counts, exampleCounts, breakEven };
})();
