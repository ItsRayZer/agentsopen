/* Wiki article reader — Wikipedia-style presentation only.
   The .txt files stay the agent-readable originals; this script only
   presents them. All content renders via textContent, never innerHTML.
   Same single source of truth: wiki/index.json + wiki/*.txt files. */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function para(parent, s, cls) {
    var p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = s;
    parent.appendChild(p);
    return p;
  }
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function getText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  function renderIndex(entries) {
    var box = el('article-index');
    box.textContent = '';
    var articles = entries.filter(function (e) { return e.kind === 'wikipedia-article'; });
    var summaries = entries.filter(function (e) { return e.kind !== 'wikipedia-article'; });
    function group(title, list) {
      var h = document.createElement('h3');
      h.textContent = title + ' (' + list.length + ')';
      box.appendChild(h);
      list.forEach(function (e) {
        var p = document.createElement('p');
        var a = document.createElement('a');
        a.href = 'wiki-article.html?article=' + encodeURIComponent(e.slug);
        a.textContent = e.title || e.slug;
        p.appendChild(a);
        box.appendChild(p);
      });
    }
    group('Wikipedia articles', articles);
    group('Original summaries', summaries);
  }

  function renderArticle(entry, txt) {
    el('crumb').textContent = entry.title || entry.slug;
    el('article-title').textContent = entry.title || entry.slug;
    el('article-meta').textContent = (entry.kind === 'wikipedia-article' ? 'Wikipedia article' : 'Original summary')
      + ' · ' + (entry.bytes || '') + ' bytes · file: ' + entry.file;
    // Body is everything after the literal "body:" line; the al:1 header
    // above it is metadata, not article prose.
    var idx = txt.indexOf('\nbody:\n');
    var body = idx !== -1 ? txt.slice(idx + 7) : txt;
    // Drop a leading seed note in brackets; it is provenance, not prose.
    body = body.replace(/^\[Seed note:[^\]]*\]\s*/s, '');
    var paragraphs = body.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var lead = paragraphs.shift() || '';
    el('article-lead').textContent = lead;
    var box = el('article-body');
    box.textContent = '';
    paragraphs.forEach(function (s) { para(box, s); });
    var refs = el('references');
    refs.hidden = false;
    var list = el('reference-list');
    list.textContent = '';
    if (entry.source) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = entry.source;
      a.textContent = entry.source;
      li.appendChild(a);
      list.appendChild(li);
    }
    el('licence-note').textContent = entry.kind === 'wikipedia-article'
      ? 'Licence: CC BY-SA 4.0 — this text is from Wikipedia, attributed to Wikipedia contributors, shared under CC BY-SA 4.0.'
      : 'Licence: original summary — this text is NOT from Wikipedia and is NOT covered by the CC BY-SA claim.';
    el('verification-note').textContent = (entry.verification === 'not-mia-verified' || !entry.verification)
      ? 'Verification: not Mia-verified. Claims reused from this article without an independent proof ref must be labelled unproven.'
      : 'Verification: ' + entry.verification;
    var raw = el('raw-link');
    raw.href = entry.file;
    raw.textContent = entry.file;
    el('index-section').hidden = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var slug = new URLSearchParams(window.location.search).get('article') || '';
    getJSON('wiki/index.json').then(function (w) {
      var entries = w.entries || [];
      renderIndex(entries);
      if (!slug) {
        el('article-meta').textContent = 'Pick an article below. English only.';
        return;
      }
      var entry = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].slug === slug) { entry = entries[i]; break; }
      }
      if (!entry) {
        el('article-meta').textContent = 'No article with that slug. Pick one below.';
        return;
      }
      return getText(entry.file).then(function (txt) { renderArticle(entry, txt); });
    }).catch(function () {
      el('article-meta').textContent = 'Wiki index unavailable right now.';
      el('article-index').textContent = 'Wiki index unavailable right now.';
    });
  });
})();
