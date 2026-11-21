/*!
 * Quick Guide - js/wiki/base.js
 * What the wiki reader shares: the wiki's address, small helpers, links, and one way to ask the wiki (askWiki).
 * The other files in js/wiki take what they need from window.QuickGuideWiki (W.share), and put what the app uses on
 * window.QuickGuide (W.publish). Each says it loaded in W.loaded.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function () {
  'use strict';

  var QG = window.QuickGuide = {};
  var W = window.QuickGuideWiki = {
    loaded: {},
    share: function (o) { Object.keys(o).forEach(function (k) { W[k] = o[k]; }); },
    publish: function (o) { Object.keys(o).forEach(function (k) { QG[k] = o[k]; }); }
  };

  var WIKI = 'https://runescape.wiki';
  var API = WIKI + '/api.php';
  var VERSION = 4;   // a new number makes saved guides read the wiki again
  // The wiki's map render as of Nov 2026. Pages carry the current one; this is only the fallback.
  var MAP_VERSION = '2026-10-12-a';
  // Context for the page being parsed (its title and its map marker data). guide.js fills it in for each page.
  var CUR = { page: '', live: {} };
  var MARK = '\u0001';

  var SKILLS = ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Runecrafting', 'Construction',
    'Dungeoneering', 'Constitution', 'Agility', 'Herblore', 'Thieving', 'Crafting', 'Fletching', 'Slayer',
    'Hunter', 'Divination', 'Necromancy', 'Mining', 'Smithing', 'Fishing', 'Cooking', 'Firemaking',
    'Woodcutting', 'Farming', 'Summoning', 'Invention', 'Archaeology'];
  var SKILL_RE = new RegExp('^(\\d{1,3})\\s*(' + SKILLS.join('|') + ')\\b\\s*(.*)$', 'i');
  var FAIRY_RE = /^[A-D][I-L][P-S]$/;
  var BLOCK_RE = /^(P|DIV|DD|DT|DL|UL|OL|FIGURE|BLOCKQUOTE|CENTER|SECTION|H[1-6]|TABLE|TBODY|THEAD|TR|TD|TH|CAPTION)$/;
  // (not only capitals: the tags of a drawing, <svg> and <math>, keep the small letters they are written in)
  var DROP_RE = /^(STYLE|SCRIPT|LINK|META|NOSCRIPT|TEMPLATE|BUTTON|INPUT|SELECT|TEXTAREA|SVG|MATH|AUDIO|VIDEO|IFRAME|OBJECT)$/i;
  var INLINE_RE = /^(A|B|STRONG|I|EM|SPAN|SMALL|BIG|SUP|SUB|BR|ABBR|CODE|KBD|U|S|FONT|IMG|BDI|BDO|Q|TIME|MARK|WBR)$/;

  // A document with no window: images put in it never load.
  var scratch = document.implementation.createHTMLDocument('qg');

  // ---------- small helpers ----------
  function clean(s) { return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]+/g, ' ').trim(); }
  function text(node) { return node ? clean(node.textContent) : ''; }
  function arr(list) { return Array.prototype.slice.call(list || []); }
  function kids(el, tag) { return arr(el.children).filter(function (c) { return !tag || c.tagName === tag; }); }
  function cap(s) { s = clean(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
    });
  }
  function slug(s) {
    return clean(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'part';
  }
  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }
  function plainOf(html) {
    var d = scratch.createElement('div');
    d.innerHTML = html || '';
    return text(d);
  }
  function unique(list) {
    var seen = {};
    return list.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
  }

  // ---------- links ----------
  function pageUrl(title, frag) {
    var path = encodeURIComponent(String(title).replace(/ /g, '_'))
      .replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',');
    return WIKI + '/w/' + path + (frag ? '#' + encodeURIComponent(frag) : '');
  }

  function absUrl(href, page) {
    href = clean(href);
    if (!href || /^(javascript|data|vbscript):/i.test(href)) return '';
    if (href.charAt(0) === '#') return page ? pageUrl(page, decodeSafe(href.slice(1))) : '';
    try {
      var u = new URL(href, WIKI + '/w/');
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (e) { return ''; }
  }

  function decodeSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

  // What the person typed -> the page to ask the wiki for.
  function titleFromInput(input) {
    var s = clean(input);
    if (!s) return { error: 'empty' };
    var title;
    if (/^(https?:\/\/|www\.)/i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(s)) {
      var u;
      try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return { error: 'bad-link' }; }
      var host = u.hostname.toLowerCase();
      if (host !== 'runescape.wiki' && host !== 'www.runescape.wiki') {
        return { error: /oldschool\.runescape\.wiki$/.test(host) ? 'osrs' : 'not-wiki' };
      }
      if (u.pathname.indexOf('/w/') === 0) title = decodeSafe(u.pathname.slice(3));
      else if (u.searchParams.get('title')) title = u.searchParams.get('title');
      else return { error: 'no-page' };
    } else {
      title = s;
    }
    title = clean(title.replace(/_/g, ' '));
    if (!title) return { error: 'no-page' };
    title = title.charAt(0).toUpperCase() + title.slice(1);
    var base = title.replace(/\/\s*quick guide$/i, '');
    return { base: base, title: base + '/Quick guide' };
  }
  // A page of HTML as a document, with the wiki's text in it.
  function docOf(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    return doc.querySelector('.mw-parser-output') || doc.body;
  }
  // One spelling for a quest name, so names from the game and from the wiki match: "Rune Mysteries" and "rune
  // mysteries!" are the same quest, and so are "Bar Crawl" and "Bar Crawl (miniquest)". Your saved quests are kept by it.
  function normName(s) {
    return clean(s).toLowerCase().replace(/\((quest|miniquest|saga)\)/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
  }

  // ---------- asking the wiki ----------
  function coded(code, message) { var e = new Error(message); e.code = code; return e; }
  // Fetches JSON, with a time limit: { ok, status, json (null when it is no JSON), retryAfter (seconds the server asks
  // to wait, or null) }. The time runs until the whole answer is read. Throws only for a time-out or a lost connection.
  function getJson(url, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || TIME_LIMIT) : 0;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' }).then(function (r) {
      return r.json().then(function (j) { return j; }, function (e) {
        if (e && e.name === 'AbortError') throw e;   // cut off while it came in: a time-out (below)
        return null;
      }).then(function (j) {
        clearTimeout(timer);
        return { ok: r.ok, status: r.status, json: j, retryAfter: r.headers && r.headers.get ? r.headers.get('Retry-After') : null };
      });
    }).then(null, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw coded('timeout', 'The wiki took too long to answer.');
      throw err;
    });
  }
  // How long the wiki gets for one answer (ms), and how many more parts of one answer the app asks for ("continue").
  var TIME_LIMIT = 25000, MAX_PARTS = 20;
  // Asks once more when the wiki is busy or the connection drops: it says "busy" with an error 429 or 5xx, or with an
  // answer that only holds an error ("maxlag", "ratelimited"). It waits first: as long as the wiki asks (at most 5
  // seconds), else a second. An answer that takes too long is not asked again.
  function askOnce(url) {
    function later(s) { return new Promise(function (go) { setTimeout(go, Math.min(Math.max(+s || 1, 1), 5) * 1000); }); }
    return getJson(url).then(function (r) {
      var code = r.json && r.json.error && r.json.error.code;
      if (r.status !== 429 && r.status < 500 && code !== 'maxlag' && code !== 'ratelimited') return r;
      return later(r.retryAfter).then(function () { return getJson(url); });
    }, function (e) {
      if (e && e.code === 'timeout') throw e;
      return later(1).then(function () { return getJson(url); });
    });
  }
  // The wiki's answer, or an error that says what went wrong: e.code "http" (an error status), "format" (no JSON), the
  // wiki's own code (like "missingtitle") with its words, "timeout", or the browser's own error for a lost connection.
  function checked(r) {
    if (!r.ok) throw coded('http', 'The wiki answered with error ' + r.status + '.');
    var j = r.json;
    if (!j || typeof j !== 'object') throw coded('format', 'The wiki sent something unexpected.');
    if (j.error) throw coded(j.error.code || 'wiki', j.error.info || 'The wiki could not answer.');
    return j;
  }
  // Two parts of a query's answer as one: the pages by their title, with what each part says about them.
  function joinParts(a, b) {
    var q = a.query = a.query || {}, more = b.query || {};
    ['normalized', 'redirects'].forEach(function (k) { if (more[k]) q[k] = (q[k] || []).concat(more[k]); });
    if (Array.isArray(more.pages)) {
      q.pages = q.pages || [];
      more.pages.forEach(function (p) {
        var had = q.pages.filter(function (x) { return x.title === p.title; })[0];
        if (had) Object.keys(p).forEach(function (k) { if (had[k] === undefined) had[k] = p[k]; }); else q.pages.push(p);
      });
    }
    return a;
  }
  // Asks the wiki's API (url: a whole api.php address) and gives its answer. A query whose answer comes in parts (the
  // wiki says "continue") is asked again for the rest, and the parts come back as one answer.
  function askWiki(url) {
    var parts = 0;
    function part(u, sofar) {
      return askOnce(u).then(checked).then(function (j) {
        var all = sofar ? joinParts(sofar, j) : j, more = j.continue;
        delete all.continue;
        if (!more || !/[?&]action=query(&|$)/.test(url) || ++parts >= MAX_PARTS) return all;
        return part(url + Object.keys(more).map(function (k) { return '&' + encodeURIComponent(k) + '=' + encodeURIComponent(more[k]); }).join(''), all);
      });
    }
    return part(url, null);
  }

  // Which of these page names the wiki has: { "<name>": the page it leads to }. Names it does not have are left out.
  function findPages(names) {
    var url = API + '?action=query&format=json&formatversion=2&redirects=1&origin=*&titles=' + encodeURIComponent(names.join('|'));
    // Like every read, the wiki gets 25 seconds (getJson): one answer that never comes cannot stop the ones after it.
    return askWiki(url).then(function (d) {
      var q = d.query, to = {}, has = {}, out = {};
      if (!q || !Array.isArray(q.pages)) throw coded('format', 'The wiki sent something unexpected.');
      // The wiki gives a name its first capital, then follows a redirect.
      (q.normalized || []).concat(q.redirects || []).forEach(function (x) { to[x.from] = x.to; });
      q.pages.forEach(function (p) { if (!p.missing && !p.invalid) has[p.title] = 1; });
      names.forEach(function (n) {
        var t = to[n] || n;
        t = to[t] || t;
        if (has[t]) out[n] = t;
      });
      return out;
    });
  }
  // Runs fn(item) for each item, a few at a time (parallel). Resolves when all are done; fn handles its own failures.
  function inTurns(items, fn, parallel) {
    var next = 0, ws = [];
    function worker() { return next < items.length ? Promise.resolve(fn(items[next++])).then(worker) : Promise.resolve(); }
    for (var w = 0; w < Math.min(parallel, items.length); w++) ws.push(worker());
    return Promise.all(ws);
  }
  // The page a title leads to in a query's answer: after the wiki's own capitals, then a redirect.
  function landed(q, t) {
    var to = {};
    (q.normalized || []).concat(q.redirects || []).forEach(function (x) { to[x.from] = x.to; });
    var a = to[t] || t;
    return to[a] || a;
  }
  // When pages last changed, 50 at a time, without reading them: { "<title>": { rev (its latest revision), edited (when
  // that was saved), touched (when the page last changed, with its lists and templates) } or { missing: true } }.
  // A batch that fails is left out, so its pages count as unknown.
  var INFO_BATCH = 50;
  function pageInfo(titles) {
    var out = {}, batches = [];
    for (var i = 0; i < titles.length; i += INFO_BATCH) batches.push(titles.slice(i, i + INFO_BATCH));
    return inTurns(batches, function (b) {
      var url = API + '?action=query&format=json&formatversion=2&redirects=1&origin=*&prop=info%7Crevisions&rvprop=ids%7Ctimestamp&titles=' +
        encodeURIComponent(b.join('|'));
      return askWiki(url).then(function (d) {
        var q = d.query, byTitle = {};
        if (!q || !Array.isArray(q.pages)) return;
        q.pages.forEach(function (p) { byTitle[p.title] = p; });
        b.forEach(function (t) {
          var p = byTitle[landed(q, t)], rv = p && p.revisions && p.revisions[0];
          if (!p) return;
          out[t] = p.missing ? { missing: true } : { rev: p.lastrevid || (rv && rv.revid) || 0, edited: (rv && rv.timestamp) || '', touched: p.touched || '' };
        });
      }, function () { /* unknown: read again */ });
    }, 2).then(function () { return out; });
  }
  // A page, rendered: { title, html, live (its map data), revid (the revision it is, to see later if it changed) }.
  function fetchPage(title) {
    var url = API + '?action=parse&format=json&formatversion=2&prop=text%7Cjsconfigvars%7Crevid&redirects=1' +
      '&disableeditsection=1&disablelimitreport=1&origin=*&page=' + encodeURIComponent(title);
    return askWiki(url).then(function (d) {
      if (!d.parse || typeof d.parse.text !== 'string') throw coded('format', 'The wiki sent something unexpected.');
      var cfg = d.parse.jsconfigvars || {};
      return { title: d.parse.title, html: d.parse.text, live: cfg.wgKartographerLiveData || {}, revid: d.parse.revid || 0 };
    });
  }

  W.share({ WIKI: WIKI, API: API, VERSION: VERSION, MAP_VERSION: MAP_VERSION, CUR: CUR, MARK: MARK, SKILLS: SKILLS, SKILL_RE: SKILL_RE,
    FAIRY_RE: FAIRY_RE, BLOCK_RE: BLOCK_RE, DROP_RE: DROP_RE, INLINE_RE: INLINE_RE, scratch: scratch, clean: clean, text: text, arr: arr,
    kids: kids, cap: cap, esc: esc, slug: slug, hash: hash, plainOf: plainOf, unique: unique, pageUrl: pageUrl, absUrl: absUrl,
    docOf: docOf, normName: normName, coded: coded, getJson: getJson, askWiki: askWiki, fetchPage: fetchPage, inTurns: inTurns,
    landed: landed, pageInfo: pageInfo });
  W.publish({ WIKI: WIKI, titleFromInput: titleFromInput, findPages: findPages, inTurns: inTurns, pageInfo: pageInfo,
    normName: normName, hash: hash, slug: slug, pageUrl: pageUrl });
  W.loaded.base = true;
})();
