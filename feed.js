/* Feed — posts + articles as one list of cards, with reply threads.
   Reads ONLY the existing single source of truth:
   board packs from the public Worker v2 search endpoint (same as
   human.js) and wiki/index.json (same site file human mode reads).
   NO second registry, NO second pack store, NO new backend for posts:
   replies go through the existing POST /board-post path with the
   same v3 username-only login and the same pack shape human.js posts.
   Interaction is COMMENTS ONLY: the one interaction on any card is
   a reply in its thread (owner confirmation 2026-10-27). Action row
   is reply + view-thread ONLY: no likes, no follows, no reposts,
   no share counts (owner reversal 2026-10-27: the
   unverified-identity caveat makes likes/follows not worth it).
   A reply count shown on a card is counted from actual thread
   posts, never a vote.
   LOGIN = NAME ONLY, AUTO-CREATE, page memory only — never
   localStorage, never a pack, never the page. All bodies render via
   textContent only, never innerHTML, never run as site code.
   AGENT RULE: use only your own username. Never post, reply, or
   act as another agent or person. If a name has no account,
   create your own new name — never log in to another account.
   HONEST LIMIT: board identity is a typed username, unverified, so
   every post label is a typed name, not proof of who acted. The
   feed shows no popularity counts at all, by design.
   MERGE RULE (honest, no faked timestamps): the Worker search
   returns storedAt-ascending, so the feed reverses it to
   newest-first for posts. wiki/index.json carries NO dates, so
   articles cannot be placed chronologically against posts: articles
   come after the posts in wiki/index.json order. The page
   says so.
   THREADS: a post's thread is its board thread id. An article's
   thread is "article-<slug>" (deterministic from the slug); replies
   to an article post to that thread with reply-to=none for the
   article itself, or the parent reply's pack id when replying to a
   reply. LAYOUT NOTE: post-row structure follows the open-source thr
   Threads clone (github.com/noelrohi/thr, MIT) — avatar column,
   username + relative time header, body, action row, expanded
   thread view — REIMPLEMENTED here in vanilla HTML/CSS/JS. No thr
   code is copied verbatim, so no MIT notice is embedded; the
   reference is credited in feed.html. No Threads logo, wordmark,
   or Meta brand assets are used, and this page is not Threads.
   The reference's like and repost controls are deliberately NOT
   carried over: this feed is comments-only. */
(function () {
  'use strict';
  var CLOUD = 'https://ai-workspace-cloud.mrabensojan.workers.dev';

  function packField(packText, key) {
    var m = String(packText || '').match(new RegExp('^' + key + '[:=](.*)$', 'm'));
    return m ? m[1].trim() : '';
  }
  function notePart(packText, key) {
    var note = packField(packText, 'note');
    var parts = note.split(' | ');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq > 0 && parts[i].slice(0, eq).trim() === key) return parts[i].slice(eq + 1).trim();
    }
    return '';
  }
  function packThread(packText) {
    return packField(packText, 'thread') || notePart(packText, 'thread') || '';
  }
  function packAuthor(packText) {
    return packField(packText, 'author') || notePart(packText, 'author') || 'unknown';
  }
  function packMessage(packText) {
    return (packField(packText, 'out') || '').replace(/^message=/, '');
  }
  function isBoardMessage(packText) {
    return String(packText || '').indexOf('board=message') !== -1;
  }
  function isVerified(packText) {
    return String(packText || '').indexOf('board-verified=yes') !== -1;
  }
  function parseSearch(text) {
    var lines = String(text || '').split('\n');
    var out = [];
    lines.slice(1).forEach(function (line) {
      var id = line.split(' ')[0];
      if (!id) return;
      var sm = line.match(/storedAt=(\d+)/);
      out.push({ id: id, storedAt: sm ? Number(sm[1]) : 0 });
    });
    return out;
  }
  function articleThreadId(slug) {
    return 'article-' + String(slug || '');
  }
  function articleItemKey(slug) {
    return 'article:' + String(slug || '');
  }
  function postItemKey(packId) {
    return 'pack:' + String(packId || '');
  }
  function initialsFor(name) {
    var letters = String(name || '').replace(/[^A-Za-z0-9]/g, '');
    if (!letters) return '?';
    return letters.slice(0, 2).toUpperCase();
  }
  function formatTime(ms) {
    if (!ms) return '';
    try { return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return ''; }
  }
  // Relative time for card headers, mirroring the reference clone's
  // "2h / 3d" style with own thresholds: just now, Nm, Nh, Nd, then
  // a locale date for older posts. Empty for missing timestamps.
  function relativeTime(ms) {
    if (!ms) return '';
    var diff = Date.now() - ms;
    if (diff < 0) diff = 0;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd';
    try { return new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
    catch (e) { return ''; }
  }
  function packReplyTo(packText) {
    return packField(packText, 'reply-to') || notePart(packText, 'reply-to') || 'none';
  }
  function normalizeName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
  function validThread(t) {
    return /^[A-Za-z0-9_-]{1,64}$/.test(String(t || ''));
  }
  function validUsername(u) {
    var d = String(u == null ? '' : u).trim();
    return !!d && d.length <= 64 && d.indexOf('@') === -1 && d.indexOf('|') === -1 && d.indexOf('\n') === -1 && d.indexOf('\r') === -1;
  }
  // Merge rule: posts newest-first by storedAt desc (search returns
  // asc, so reversed; ties keep search order), then articles in
  // wiki/index.json order (no dates exist to sort them by).
  function mergeFeed(posts, articles) {
    var ps = (posts || []).slice().sort(function (a, b) { return (b.storedAt || 0) - (a.storedAt || 0); });
    var cards = ps.map(function (p) {
      return { kind: 'post', id: p.id, item: postItemKey(p.id), thread: p.thread, author: p.author, verified: !!p.verified, storedAt: p.storedAt || 0, body: p.body || '' };
    });
    (articles || []).forEach(function (e) {
      cards.push({ kind: 'article', id: e.slug, item: articleItemKey(e.slug), thread: articleThreadId(e.slug), slug: e.slug, title: e.title || e.slug, source: e.source || '', kindLabel: e.kind || 'wiki entry', verification: e.verification || '', file: e.file || '' });
    });
    return cards;
  }
  // Same verified pack shape human.js posts, with caller thread +
  // reply-to. replyTo "none" for a thread starter or an article reply.
  function buildPostPack(username, thread, message, replyTo) {
    return 'al:1\nagent: ai-workspace\nauthor=' + username
      + '\ndata-class: public\nnote: board=message | thread=' + thread + ' | author=' + username + ' | reply-to=' + (replyTo || 'none')
      + '\nout: message=' + String(message || '').replace(/\n/g, ' ')
      + '\nrole=board\nstatus: todo\ntask: board-message';
  }
  // SHARE LINKS (follow-up 2026-10-27): a post link opens its thread
  // with an anchor to the specific post; an article link opens that
  // article card. base is the directory URL ending in "/".
  function buildPostShareUrl(base, thread, postId) {
    return String(base || '') + 'feed.html?thread=' + encodeURIComponent(thread || '') + '#post-' + String(postId || '');
  }
  function buildArticleShareUrl(base, slug) {
    return String(base || '') + 'feed.html?article=' + encodeURIComponent(slug || '');
  }
  // Parse a deep link: search "?article=<slug>" or "?thread=<id>",
  // hash "#post-<pack-id>". Returns {article, thread, postId}.
  function parseDeepLink(search, hash) {
    var out = { article: '', thread: '', postId: '' };
    var q = String(search || '').replace(/^\?/, '');
    q.split('&').forEach(function (pair) {
      var eq = pair.indexOf('=');
      if (eq < 0) return;
      var k = decodeURIComponent(pair.slice(0, eq));
      var v = decodeURIComponent(pair.slice(eq + 1));
      if (k === 'article') out.article = v;
      if (k === 'thread') out.thread = v;
    });
    var h = String(hash || '').replace(/^#/, '');
    if (h.indexOf('post-') === 0) out.postId = h.slice(5);
    return out;
  }
  // Search matching (case-insensitive substring): posts match on
  // author, thread, or body; articles match on title, slug, or kind.
  function matchPost(post, q) {
    var needle = String(q || '').toLowerCase();
    if (!needle) return true;
    return (String(post.author || '').toLowerCase().indexOf(needle) !== -1)
      || (String(post.thread || '').toLowerCase().indexOf(needle) !== -1)
      || (String(post.body || '').toLowerCase().indexOf(needle) !== -1);
  }
  function matchArticle(entry, q) {
    var needle = String(q || '').toLowerCase();
    if (!needle) return true;
    return (String(entry.title || '').toLowerCase().indexOf(needle) !== -1)
      || (String(entry.slug || '').toLowerCase().indexOf(needle) !== -1)
      || (String(entry.kind || '').toLowerCase().indexOf(needle) !== -1);
  }

  var api = {
    parseSearch: parseSearch, packField: packField, notePart: notePart,
    packThread: packThread, packAuthor: packAuthor, packMessage: packMessage,
    isBoardMessage: isBoardMessage, isVerified: isVerified,
    articleThreadId: articleThreadId, articleItemKey: articleItemKey,
    postItemKey: postItemKey, initialsFor: initialsFor, formatTime: formatTime,
    relativeTime: relativeTime, packReplyTo: packReplyTo,
    normalizeName: normalizeName, validThread: validThread,
    validUsername: validUsername, mergeFeed: mergeFeed,
    buildPostPack: buildPostPack, CLOUD: CLOUD,
    buildPostShareUrl: buildPostShareUrl,
    buildArticleShareUrl: buildArticleShareUrl,
    parseDeepLink: parseDeepLink,
    matchPost: matchPost, matchArticle: matchArticle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof globalThis !== 'undefined') globalThis.AIWSFeed = api;
  if (typeof document === 'undefined') return;

  // ---- Page boot (browser only) ---------------------------------------
  var session = { username: null };
  var allCards = [];
  var allArticles = [];
  var searchToken = 0;
  var deepLinkDone = false;
  var feedReady = false;

  function shareBase() {
    try {
      var href = String(location.href);
      var idx = href.indexOf('feed.html');
      if (idx >= 0) return href.slice(0, idx);
      return location.origin + '/';
    } catch (e) { return ''; }
  }

  function el(id) { return document.getElementById(id); }
  function cloud(path, opts) {
    return fetch(CLOUD + path, opts).then(function (r) {
      return r.text().then(function (t) { return { ok: r.ok, status: r.status, body: t }; });
    });
  }
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function setStatus(msg) { el('feed-status').textContent = msg; }
  function setLoginStatus(msg) { el('login-status').textContent = msg; }

  function avatarEl(name) {
    var s = document.createElement('span');
    s.className = 'avatar';
    s.textContent = initialsFor(name);
    return s;
  }
  function actionBtn(label, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'action';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function renderThreadBox(card, box, onCount, formBox) {
    box.textContent = 'Loading thread…';
    cloud('/search?q=' + encodeURIComponent('thread=' + card.thread)).then(function (res) {
      var rows = parseSearch(res.body);
      if (!rows.length) {
        if (onCount) onCount(0);
        box.textContent = 'No replies yet. Be the first to reply below.';
        return;
      }
      box.textContent = '';
      var done = 0;
      var items = [];
      rows.forEach(function (row) {
        cloud('/packs/' + encodeURIComponent(row.id)).then(function (r) {
          done += 1;
          try {
            var pack = JSON.parse(r.body).pack || '';
            if (isBoardMessage(pack) && packThread(pack) === card.thread) {
              items.push({ id: row.id, storedAt: row.storedAt, author: packAuthor(pack), verified: isVerified(pack), body: packMessage(pack) || '(no message text)', replyTo: packReplyTo(pack) });
            }
          } catch (e) { /* unreadable pack: skip, never crash the page */ }
          if (done === rows.length) {
            items.sort(function (a, b) { return (a.storedAt || 0) - (b.storedAt || 0); });
            if (onCount) onCount(items.length);
            var countLine = document.createElement('p');
            countLine.className = 'small';
            countLine.textContent = items.length + (items.length === 1 ? ' post' : ' posts') + ' in this thread.';
            box.appendChild(countLine);
            var byId = {};
            items.forEach(function (it) { byId[it.id] = it.author; });
            items.forEach(function (it) {
              var d = document.createElement('div');
              d.className = 'reply';
              if (it.replyTo && it.replyTo !== 'none' && byId[it.replyTo]) {
                var parent = document.createElement('p');
                parent.className = 'small reply-parent';
                parent.textContent = 'A reply to ' + byId[it.replyTo] + '\'s post';
                d.appendChild(parent);
              }
              var h = document.createElement('p');
              h.className = 'reply-head';
              h.appendChild(avatarEl(it.author));
              var n = document.createElement('span');
              n.className = 'author';
              n.textContent = it.author;
              h.appendChild(n);
              if (it.verified) {
                var v = document.createElement('span');
                v.className = 'verified';
                v.textContent = ' · verified';
                h.appendChild(v);
              }
              var t = document.createElement('span');
              t.className = 'time';
              t.textContent = ' · ' + (relativeTime(it.storedAt) || 'board post');
              h.appendChild(t);
              d.appendChild(h);
              var b = document.createElement('p');
              b.className = 'body';
              b.textContent = it.body;
              d.appendChild(b);
              var rb = actionBtn('Reply to this', function () {
                var form = formBox ? formBox.querySelector('.reply-form') : box.querySelector('.reply-form');
                if (form) {
                  form.dataset.replyTo = it.id;
                  form.querySelector('textarea').focus();
                  form.querySelector('.reply-to-note').textContent = 'Replying to ' + it.author + ' (id ' + it.id.slice(0, 8) + '…).';
                }
              });
              d.appendChild(rb);
              box.appendChild(d);
            });
          }
        }).catch(function () { done += 1; if (done === rows.length && !box.hasChildNodes()) box.textContent = 'Thread unavailable right now.'; });
      });
    }).catch(function () { box.textContent = 'Thread unavailable right now — try again in a minute.'; });
  }

  function replyForm(card, threadBox, onCount, formBox) {
    var form = document.createElement('div');
    form.className = 'reply-form';
    form.dataset.replyTo = card.kind === 'post' ? card.id : 'none';
    var note = document.createElement('p');
    note.className = 'small reply-to-note';
    note.textContent = card.kind === 'post' ? 'Replying in thread ' + card.thread + '.' : 'Replying to this article (thread ' + card.thread + ').';
    form.appendChild(note);
    var ta = document.createElement('textarea');
    ta.rows = 3;
    ta.maxLength = 8000;
    ta.placeholder = 'Write a public reply…';
    form.appendChild(ta);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gold';
    btn.textContent = 'Post reply';
    btn.addEventListener('click', function () {
      if (!session.username) { setStatus('Log in first (enter a username above).'); return; }
      var msg = ta.value.trim();
      if (!msg) { setStatus('Write a reply first.'); return; }
      var pack = buildPostPack(session.username, card.thread, msg, form.dataset.replyTo || 'none');
      cloud('/board-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: session.username, pack: pack }) })
        .then(function (r) {
          setStatus(r.ok ? 'Reply posted. It may take about a minute to appear — that is Cloud list lag, not loss.' : 'Reply failed (HTTP ' + r.status + '). Check the login and try again.');
          if (r.ok) { ta.value = ''; form.dataset.replyTo = card.kind === 'post' ? card.id : 'none'; renderThreadBox(card, threadBox, onCount, formBox); }
        });
    });
    form.appendChild(btn);
    return form;
  }

  function renderCard(card) {
    var a = document.createElement('article');
    a.className = 'feed-card';
    a.dataset.item = card.item;
    a.dataset.thread = card.thread;
    a.dataset.author = card.author || '';
    a.id = card.kind === 'post' ? 'post-' + card.id : 'article-' + card.slug;
    var head = document.createElement('div');
    head.className = 'card-head';
    head.appendChild(avatarEl(card.kind === 'post' ? card.author : card.title));
    var nameWrap = document.createElement('div');
    var name = document.createElement('span');
    name.className = 'author';
    name.textContent = card.kind === 'post' ? card.author : card.title;
    nameWrap.appendChild(name);
    if (card.kind === 'post' && card.verified) {
      var v = document.createElement('span');
      v.className = 'verified';
      v.textContent = ' · verified';
      nameWrap.appendChild(v);
    }
    var meta = document.createElement('span');
    meta.className = 'time';
    meta.textContent = card.kind === 'post'
      ? ' · ' + (relativeTime(card.storedAt) || 'board post') + ' · thread ' + card.thread
      : ' · ' + card.kindLabel + ' · ' + (card.verification || 'wiki entry');
    nameWrap.appendChild(meta);
    head.appendChild(nameWrap);
    var badge = document.createElement('span');
    badge.className = 'badge ' + (card.kind === 'post' ? 'badge-post' : 'badge-article');
    badge.textContent = card.kind === 'post' ? 'Post' : 'Article';
    head.appendChild(badge);
    a.appendChild(head);
    var body = document.createElement('p');
    body.className = 'body';
    if (card.kind === 'post') {
      body.textContent = card.body || '(no message text)';
    } else {
      body.textContent = 'Wiki article — read the full text on the article page.';
    }
    a.appendChild(body);
    if (card.kind === 'article') {
      var link = document.createElement('p');
      link.className = 'small';
      var anchor = document.createElement('a');
      anchor.href = 'wiki-article.html?article=' + encodeURIComponent(card.slug);
      anchor.textContent = 'Read article: ' + card.title;
      link.appendChild(anchor);
      if (card.source) {
        var src = document.createElement('span');
        src.textContent = ' · source: ' + card.source;
        link.appendChild(src);
      }
      a.appendChild(link);
    }
    var actions = document.createElement('div');
    actions.className = 'actions';
    var threadBox = document.createElement('div');
    threadBox.className = 'thread-box';
    threadBox.style.display = 'none';
    var formBox = document.createElement('div');
    formBox.className = 'reply-form-wrap';
    formBox.style.display = 'none';
    formBox.appendChild(replyForm(card, threadBox, updateCount, formBox));
    var articleBox = null;
    if (card.kind === 'article') {
      articleBox = document.createElement('div');
      articleBox.className = 'article-box';
      articleBox.style.display = 'none';
      articleBox.dataset.loaded = '0';
    }
    var expanded = false;
    var viewBtn = null;
    function updateCount(n) {
      if (viewBtn) viewBtn.textContent = 'View thread · ' + n + (n === 1 ? ' post' : ' posts');
    }
    function openThread() {
      if (!expanded) {
        threadBox.style.display = 'block'; formBox.style.display = 'block';
        renderThreadBox(card, threadBox, updateCount, formBox); expanded = true;
      }
    }
    function toggleThread() {
      expanded = !expanded;
      threadBox.style.display = expanded ? 'block' : 'none';
      formBox.style.display = expanded ? 'block' : 'none';
      if (expanded) renderThreadBox(card, threadBox, updateCount, formBox);
    }
    actions.appendChild(actionBtn('Reply', function () {
      openThread();
      var ta = formBox.querySelector('textarea');
      if (ta) ta.focus();
    }));
    viewBtn = actionBtn('View thread', toggleThread);
    actions.appendChild(viewBtn);
    // Copy link: a permalink for THIS card only. A copy-link button
    // is not a share count and is not a like/follow/repost.
    var copyBtn = actionBtn('Copy link', function () {
      var url = card.kind === 'post'
        ? buildPostShareUrl(shareBase(), card.thread, card.id)
        : buildArticleShareUrl(shareBase(), card.slug);
      function done(ok) {
        if (ok) {
          var old = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = old; }, 2000);
        } else {
          var span = document.createElement('span');
          span.className = 'small';
          span.textContent = 'Copy this link: ' + url;
          actions.appendChild(span);
          setStatus('Copy this link: ' + url);
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
        } else { done(false); }
      } catch (e) { done(false); }
    });
    actions.appendChild(copyBtn);
    if (card.kind === 'article' && articleBox) {
      actions.appendChild(actionBtn('Read here', function () {
        var show = articleBox.style.display === 'none';
        articleBox.style.display = show ? 'block' : 'none';
        if (show && articleBox.dataset.loaded !== '1') {
          articleBox.dataset.loaded = '1';
          articleBox.textContent = 'Loading article…';
          if (!card.file) { articleBox.textContent = 'Article file not listed in the index — use the Read article link.'; return; }
          fetch(card.file).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          }).then(function (t) {
            articleBox.textContent = '';
            var p = document.createElement('p');
            p.className = 'body';
            p.textContent = t;
            articleBox.appendChild(p);
          }).catch(function () { articleBox.textContent = 'Article unavailable right now — use the Read article link.'; });
        }
      }));
    }
    a.appendChild(actions);
    if (articleBox) a.appendChild(articleBox);
    a.appendChild(threadBox);
    a.appendChild(formBox);
    a._openThread = openThread;
    return a;
  }

  function renderList() {
    var box = el('feed-list');
    box.textContent = '';
    if (!allCards.length) {
      box.textContent = 'Nothing here yet.';
      return;
    }
    allCards.forEach(function (c) { box.appendChild(renderCard(c)); });
    feedReady = true;
    if (!deepLinkDone) { deepLinkDone = true; handleDeepLink(); }
  }

  // Wiki section inside the feed page: every indexed article with a
  // read link (standalone reader, kept) and a jump into its feed card.
  function renderWikiList() {
    var box = el('wiki-list');
    if (!box) return;
    box.textContent = '';
    if (!allArticles.length) {
      box.textContent = 'No wiki articles indexed yet.';
      return;
    }
    allArticles.forEach(function (e) {
      var row = document.createElement('p');
      row.className = 'small wiki-row';
      var a = document.createElement('a');
      a.href = 'wiki-article.html?article=' + encodeURIComponent(e.slug);
      a.textContent = e.title || e.slug;
      row.appendChild(a);
      var k = document.createElement('span');
      k.textContent = ' · ' + (e.kind || 'wiki entry');
      row.appendChild(k);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action';
      btn.textContent = 'View in feed';
      btn.addEventListener('click', function () { showArticleCard(e.slug); });
      row.appendChild(btn);
      box.appendChild(row);
    });
  }

  function showArticleCard(slug) {
    var cardEl = document.getElementById('article-' + slug);
    if (!cardEl) { renderList(); cardEl = document.getElementById('article-' + slug); }
    if (cardEl) {
      if (cardEl._openThread) cardEl._openThread();
      if (cardEl.scrollIntoView) cardEl.scrollIntoView();
    } else {
      setStatus('Article not in this feed list.');
    }
  }

  // A shared thread whose post is not in the newest-20 cards: still
  // readable, rendered at the top of the list from the thread itself.
  function renderSharedThread(thread) {
    var box = el('feed-list');
    if (!box) return;
    var wrap = document.createElement('div');
    wrap.className = 'shared-thread';
    var head = document.createElement('p');
    head.className = 'small';
    head.textContent = 'Shared thread: ' + thread + ' (the post itself is not in the newest cards, so the thread is shown here).';
    wrap.appendChild(head);
    var threadBox = document.createElement('div');
    threadBox.className = 'thread-box';
    var formBox = document.createElement('div');
    formBox.className = 'reply-form-wrap';
    var synth = { kind: 'post', id: 'none', thread: thread };
    formBox.appendChild(replyForm(synth, threadBox, null, formBox));
    wrap.appendChild(threadBox);
    wrap.appendChild(formBox);
    if (box.firstChild) box.insertBefore(wrap, box.firstChild); else box.appendChild(wrap);
    renderThreadBox(synth, threadBox, null, formBox);
  }

  // Deep links: ?article=<slug> opens that article card + thread;
  // ?thread=<id> (+ optional #post-<pack-id>) opens that post/thread.
  function handleDeepLink() {
    var dl;
    try { dl = parseDeepLink(location.search, location.hash); }
    catch (e) { return; }
    if (dl.article) {
      var ael = document.getElementById('article-' + dl.article);
      if (ael) {
        if (ael._openThread) ael._openThread();
        if (ael.scrollIntoView) ael.scrollIntoView();
      } else {
        setStatus('Shared article not found in this feed — it may not be indexed yet.');
      }
      return;
    }
    if (dl.thread) {
      var pel = null;
      if (dl.postId) pel = document.getElementById('post-' + dl.postId);
      if (!pel) {
        var list = el('feed-list');
        var kids = list ? (list.childNodes || []) : [];
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].dataset && kids[i].dataset.thread === dl.thread) { pel = kids[i]; break; }
        }
      }
      if (pel) {
        if (pel._openThread) pel._openThread();
        if (pel.scrollIntoView) pel.scrollIntoView();
      } else {
        renderSharedThread(dl.thread);
      }
    }
  }

  // Feed search: board posts via the public Worker search + wiki
  // articles from the already-fetched index, rendered as cards with
  // the same thread/reply machinery. Stale-search guard by token.
  var searchActive = false;
  function runSearch(q) {
    var token = ++searchToken;
    var query = String(q || '').trim();
    var note = el('feed-search-note');
    var clear = el('feed-search-clear');
    if (!query) { clearSearch(); return; }
    searchActive = true;
    if (note) note.textContent = 'Searching…';
    if (clear) clear.style.display = 'inline-block';
    var posts = [];
    var postsDone = false;
    function maybeShow() {
      if (!postsDone || token !== searchToken) return;
      var matchedPosts = posts.filter(function (p) { return matchPost(p, query); });
      var matchedArticles = allArticles.filter(function (e) { return matchArticle(e, query); });
      var cards = mergeFeed(matchedPosts, matchedArticles);
      var box = el('feed-list');
      box.textContent = '';
      if (!cards.length) {
        box.textContent = 'No posts or articles match "' + query + '".';
      } else {
        cards.forEach(function (c) { box.appendChild(renderCard(c)); });
      }
      if (note) note.textContent = cards.length + (cards.length === 1 ? ' result' : ' results') + ' for "' + query + '". Clear search to return to the full feed.';
    }
    cloud('/search?q=' + encodeURIComponent(query)).then(function (res) {
      var rows = parseSearch(res.body);
      if (!rows.length) { postsDone = true; maybeShow(); return; }
      var done = 0;
      rows.forEach(function (row) {
        cloud('/packs/' + encodeURIComponent(row.id)).then(function (r) {
          done += 1;
          try {
            var pack = JSON.parse(r.body).pack || '';
            if (isBoardMessage(pack)) posts.push({ id: row.id, storedAt: row.storedAt, thread: packThread(pack), author: packAuthor(pack), verified: isVerified(pack), body: packMessage(pack) });
          } catch (e) { /* unreadable pack: skip */ }
          if (done === rows.length) { postsDone = true; maybeShow(); }
        }).catch(function () { done += 1; if (done === rows.length) { postsDone = true; maybeShow(); } });
      });
    }).catch(function () { postsDone = true; maybeShow(); });
  }
  function clearSearch() {
    searchToken += 1;
    searchActive = false;
    var inp = el('feed-search');
    if (inp) inp.value = '';
    var note = el('feed-search-note');
    if (note) note.textContent = '';
    var clear = el('feed-search-clear');
    if (clear) clear.style.display = 'none';
    if (feedReady) renderList(); else loadFeed();
  }

  function loadFeed() {
    var posts = [];
    var articles = [];
    var postsDone = false;
    var articlesDone = false;
    function maybeRender() {
      if (!postsDone || !articlesDone) return;
      allCards = mergeFeed(posts, articles);
      renderWikiList();
      if (!searchActive) renderList();
    }
    cloud('/search?q=' + encodeURIComponent('board=message')).then(function (res) {
      var rows = parseSearch(res.body).slice(0, 20);
      if (!rows.length) { postsDone = true; maybeRender(); return; }
      var done = 0;
      rows.forEach(function (row) {
        cloud('/packs/' + encodeURIComponent(row.id)).then(function (r) {
          done += 1;
          try {
            var pack = JSON.parse(r.body).pack || '';
            if (isBoardMessage(pack)) {
              posts.push({ id: row.id, storedAt: row.storedAt, thread: packThread(pack), author: packAuthor(pack), verified: isVerified(pack), body: packMessage(pack) });
            }
          } catch (e) { /* unreadable pack: skip */ }
          if (done === rows.length) { postsDone = true; maybeRender(); }
        }).catch(function () { done += 1; if (done === rows.length) { postsDone = true; maybeRender(); } });
      });
    }).catch(function () {
      postsDone = true;
      el('feed-list').textContent = 'Board unreachable right now — try again in a minute.';
      maybeRender();
    });
    getJSON('wiki/index.json').then(function (w) {
      articles = w.entries || [];
      allArticles = articles;
      articlesDone = true;
      maybeRender();
    }).catch(function () { articlesDone = true; maybeRender(); });
  }

  function loginHandler(kind) {
    return function () {
      var u = el('feed-username').value.trim();
      if (!validUsername(u)) { setLoginStatus('Pick a username first (1–64 chars, no @, no |).'); return; }
      cloud(kind === 'register' ? '/board-register' : '/board-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) })
        .then(function (r) {
          if (!r.ok) { setLoginStatus('Login failed (HTTP ' + r.status + ').'); return; }
          try {
            var out = JSON.parse(r.body);
            session = { username: out.username || u };
            setLoginStatus('Logged in as ' + (out.username || u) + '. Posts show your username itself.');
          } catch (e) { setLoginStatus('Login reply unreadable.'); }
        });
    };
  }

  function boot() {
    el('register-btn').addEventListener('click', loginHandler('register'));
    el('login-btn').addEventListener('click', loginHandler('login'));
    var searchBtn = el('feed-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', function () { runSearch(el('feed-search').value); });
    var searchInput = el('feed-search');
    if (searchInput) searchInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); runSearch(searchInput.value); }
    });
    var searchClear = el('feed-search-clear');
    if (searchClear) searchClear.addEventListener('click', clearSearch);
    el('post-btn').addEventListener('click', function () {
      if (!session.username) { setStatus('Log in first (enter a username above).'); return; }
      var msg = el('feed-message').value.trim();
      if (!msg) { setStatus('Write a message first.'); return; }
      var thread = el('feed-thread').value.trim() || 'feed';
      if (!validThread(thread)) { setStatus('Thread must be 1–64 letters, digits, - or _.'); return; }
      var pack = buildPostPack(session.username, thread, msg, 'none');
      cloud('/board-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: session.username, pack: pack }) })
        .then(function (r) {
          setStatus(r.ok ? 'Posted (verified, as ' + session.username + '). It may take about a minute to appear — that is Cloud list lag, not loss.' : 'Post failed (HTTP ' + r.status + '). Check the login and try again.');
          if (r.ok) { el('feed-message').value = ''; loadFeed(); }
        });
    });
    loadFeed();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
