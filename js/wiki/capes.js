/*!
 * Quick Guide - js/wiki/capes.js
 * Capes: the master quest, completionist and trimmed completionist capes, and what each achievement needs.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var API = W.API, SKILLS = W.SKILLS, SKILL_RE = W.SKILL_RE, WIKI = W.WIKI, arr = W.arr, askWiki = W.askWiki,
    clean = W.clean, docOf = W.docOf, fetchPage = W.fetchPage, hash = W.hash, inTurns = W.inTurns, landed = W.landed,
    pageInfo = W.pageInfo, pageUrl = W.pageUrl, text = W.text, skillReqs = W.skillReqs;

  // ---------- Capes: the master quest, completionist and trimmed completionist capes ----------
  // Each cape is an achievement made of other achievements. Its "(achievement)" page has them all in one table, each
  // with its category (Lore, Skills, Exploration, …). Where to buy a cape and its picture do not change: they are here.
  var CAPE_VERSION = 2;   // a new number makes saved capes read the wiki again
  function capeImage(file) { return WIKI + '/images/thumb/' + encodeURIComponent(file) + '/96px-' + encodeURIComponent(file); }
  var CAPES = [
    { key: 'mqc', name: 'Master quest cape', page: 'Master Quest Cape (achievement)', levelsPage: 'Master quest cape',
      image: capeImage('Master_quest_cape_detail.png'), buy: 'Buy it from Curator Haig Halen in the Varrock Museum, for 120,000 coins.' },
    { key: 'comp', name: 'Completionist cape', page: 'Completionist Cape (achievement)', skillsPage: 'Master Skiller',
      image: capeImage('Completionist_cape_detail.png'), buy: 'Buy it from the Museum guard, on the top floor of the Varrock Museum, for 5,000,000 coins.' },
    { key: 'trim', name: 'Trimmed completionist cape', page: 'Trimmed Completionist Cape (achievement)',
      image: capeImage('Completionist_cape_(t)_detail.png'), buy: 'Buy it from the Museum guard, on the top floor of the Varrock Museum, for 5,000,000 coins.' }
  ];
  function capeOf(key) { return CAPES.filter(function (c) { return c.key === key; })[0]; }
  // The achievements of a cape: [{ id, name, page, desc, members, cat, sub }], in the wiki's order. page: the
  // achievement's own wiki page, where its needs and tip are (see loadDetails).
  function parseCape(html, key) {
    var c = capeOf(key), out = [];
    var table = docOf(html).querySelector('table.achievements-table');
    if (c && table) {
      var rows = arr(table.querySelectorAll('tr')), cols = rows.length ? arr(rows[0].children).map(function (x) { return text(x).toLowerCase(); }) : [];
      var ci = function (re) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return -1; };
      var cName = ci(/^name/), cDesc = ci(/^description/), cMem = ci(/^members/), cCat = ci(/^category/), cSub = ci(/^subcategory/);
      rows.slice(1).forEach(function (tr) {
        var td = tr.children, name = cName >= 0 && td[cName] ? text(td[cName]) : '';
        if (!name) return;
        var sub = cSub >= 0 && td[cSub] ? text(td[cSub]) : '', link = td[cName].querySelector('a[title]');
        out.push({
          id: tr.getAttribute('data-rowid') || hash(name), name: name, page: link ? clean(link.getAttribute('title')) : name,
          // "(X/5)" is the game's count: the app counts the achievement as one tick
          desc: cDesc >= 0 && td[cDesc] ? text(td[cDesc]).replace(/\s*\(X\/[\d,]+\)\s*$/, '') : '',
          members: cMem >= 0 && td[cMem] ? /member|p2p/i.test(td[cMem].innerHTML) : null,
          cat: cCat >= 0 && td[cCat] ? text(td[cCat]) || 'Other' : 'Other',
          sub: /^n\/?a$/i.test(sub) ? '' : sub
        });
      });
    }
    if (!out.length) { var e = new Error('This page has no achievements.'); e.code = 'format'; throw e; }
    return { version: CAPE_VERSION, key: key, name: c.name, page: c.page, source: pageUrl(c.page), fetchedAt: new Date().toISOString(),
      cheevos: out, levels: [], skiller: [] };
  }
  // The lowest skill levels a cape needs (the "Minimum skill level" table of its page): [{ skill, level }]
  function minLevels(html) {
    var h = docOf(html).querySelector('#Minimum_skill_level'), table = null;
    if (!h) return [];
    for (var n = (h.closest('.mw-heading') || h).nextElementSibling; n && !table; n = n.nextElementSibling) {
      if (n.tagName === 'TABLE') table = n;
      else if (/^H[1-6]$/.test(n.tagName) || n.classList.contains('mw-heading')) break;
    }
    if (!table) return [];
    return arr(table.querySelectorAll('tr')).map(function (tr) {
      var td = tr.querySelectorAll('td'), a = td.length > 1 ? td[0].querySelector('a[title]') : null;
      var skill = a ? clean(a.getAttribute('title')) : td.length > 1 ? text(td[0]) : '', level = td.length > 1 ? parseInt(text(td[1]), 10) : 0;
      return skill && level ? { skill: skill, level: level } : null;
    }).filter(Boolean);
  }
  // ---------- an achievement's own page: what it needs, which capes it counts for, and a tip ----------
  // The infobox of an achievement's page lists what it needs ("requirements": quests, levels, other things) and the
  // capes it counts for (mqc, comp, trimmed = yes); its first paragraph says how to do it. The app reads both for 20
  // pages at a time (the most the wiki gives first paragraphs for): the first section's wikitext, and its text.
  var DETAIL_BATCH = 20, DETAIL_PARALLEL = 3, CAPE_FLAGS = { mqc: 'mqc', comp: 'comp', trimmed: 'trim' };
  // The parts of a template or link, split on the "|" that are not inside another {{…}} or [[…]].
  function topParts(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var two = s.substr(i, 2);
      if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
      if ((two === '}}' || two === ']]') && depth > 0) { depth--; cur += two; i++; continue; }
      if (s[i] === '|' && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += s[i];
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  // Wikitext as plain words: "{{Skillreq|Magic|93}}" is "93 Magic", "[[A|B]]" is "B", other templates go.
  // Takes out everything a pattern finds, again and again until nothing is left of it (what is inside another one
  // only shows once the outer one is gone).
  function without(s, re, to) {
    var prev;
    do { prev = s; s = s.replace(re, to || ''); } while (s !== prev);
    return s;
  }
  function wikiWords(s) {
    // footnotes, line breaks and pictures are no words
    s = without(s, /<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>/gi);
    s = without(s, /<br\s*\/?>/gi, ' ');
    s = without(s, /\[\[\s*(?:file|image)\s*:[^[\]]*\]\]/gi);
    s = s.replace(/\{\{\s*(?:skillreq|achievement requirement)\s*\|([^|}=]+)\|(\d+)[^}]*\}\}/gi, function (m, k, n) { return n + ' ' + k.trim(); })
      .replace(/\{\{\s*s?cl\s*\|([^|}]*)\|?([^}]*)\}\}/gi, function (m, a, b) { return a || b; })
      .replace(/\{\{\s*sl\s*\|\|?([^|}]*)[^}]*\}\}/gi, '$1')
      .replace(/\{\{\s*boostable\s*\}\}/gi, '(boostable)');
    // any other template, also one inside another
    s = without(s, /\{\{[^{}]*\}\}/g)
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/'''?/g, '');
    return clean(s).replace(/[\s.]+$/, '');
  }
  // What an achievement needs, from its infobox: { skills: [{ skill, level, boost }], links: [{ name, partial }],
  // oneOf: [{ text, any: [[{ skill, level }]] }], other: [text] }.
  // links: lines that are one link (nearly always a quest, "(partial)" when part of it is enough). oneOf: "one of these"
  // made of levels only, so the app can tell if you have one ("90 Fishing + 90 Slayer or 90 Prayer": any of the groups).
  // other: the rest, as words.
  // One parameter of the infobox: its text up to the next "|" or the end of the infobox (not counting those inside
  // a template or a link, which can go on over more lines).
  function infoboxParam(wt, name) {
    var m = new RegExp('\\n\\|\\s*' + name + '\\s*=', 'i').exec(wt || '');
    if (!m) return '';
    var rest = wt.slice(m.index + m[0].length), depth = 0, out = '';
    for (var i = 0; i < rest.length; i++) {
      var two = rest.substr(i, 2);
      if (two === '{{' || two === '[[') { depth++; out += two; i++; continue; }
      if (two === '}}' || two === ']]') { if (!depth) break; depth--; out += two; i++; continue; }
      if (rest[i] === '|' && !depth) break;
      out += rest[i];
    }
    return out;
  }
  // Wikitext without its comments ("<!-- … -->"). They are taken out until none is left, so "<!<!-- -->--" does not
  // leave a "<!--" behind; one that is not closed runs to the end.
  function noComments(s) {
    var prev;
    do { prev = s; s = s.replace(/<!--[\s\S]*?-->/g, ''); } while (s !== prev);
    var open = s.indexOf('<!--');
    return open < 0 ? s : s.slice(0, open);
  }
  function cheevoNeeds(wt) {
    // (comments go first: a "|" inside one is not the end of the requirements)
    var req = infoboxParam(noComments(wt || ''), 'requirements'), out = { skills: [], links: [], oneOf: [], other: [] };
    if (!req.trim()) return out;
    // one item per "*" line; a template that goes on over more lines stays one item
    var items = [], depth = 0;
    noComments(req).split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      if (depth === 0 && (t.charAt(0) === '*' || !items.length)) items.push(t.replace(/^\*\s*/, ''));
      else items[items.length - 1] += ' ' + t;
      depth += (t.match(/\{\{/g) || []).length - (t.match(/\}\}/g) || []).length;
      if (depth < 0) depth = 0;
    });
    items.forEach(function (t) {
      t = t.trim();
      if (!t || /^none\.?$/i.test(t) || t.charAt(0) === '|' || /^\{\{\s*list of/i.test(t) || /^see\b/i.test(t)) return;
      var or = /^\{\{\s*achievement requirement\s*\|([\s\S]*)\}\}$/i.exec(t);
      if (or) {
        // one of these; a part that is a list needs all of it ("90 Fishing + 90 Slayer")
        var raw = topParts(or[1]).filter(function (x) { return !/^or\s*=/i.test(x); }).map(function (x) {
          return x.split(/(?:^|\s+)\*\s*/).filter(function (y) { return y.trim(); });
        }).filter(function (x) { return x.length; });
        var parts = raw.map(function (x) { return x.map(wikiWords).filter(Boolean).join(' + '); }).filter(Boolean);
        if (!parts.length) return;
        // a level: a template ("{{Skillreq|Fishing|90}}") or words ("90 Fishing")
        var lv = /^\{\{\s*(?:skillreq|achievement requirement)\s*\|([^|}=]+)\|(\d+)[^}]*\}\}$/i;
        var level = function (y) {
          var m2 = lv.exec(y.trim()), m3 = m2 ? null : SKILL_RE.exec(wikiWords(y));
          if (m2) return { skill: clean(m2[1]), level: +m2[2] };
          if (m3 && !m3[3]) return { skill: SKILLS.filter(function (k) { return k.toLowerCase() === m3[2].toLowerCase(); })[0], level: +m3[1] };
          return null;
        };
        var any = raw.map(function (x) { return x.map(level); });
        if (any.every(function (g) { return g.every(Boolean); })) out.oneOf.push({ text: parts.join(' or '), any: any });
        else out.other.push(parts.join(' or '));
        return;
      }
      if (/^(\{\{\s*skillreq\s*\|[^}]*\}\}\s*)+(\{\{\s*boostable\s*(\|[^}]*)?\}\}\s*)?$/i.test(t)) {
        var boost = /\{\{\s*boostable\s*\}\}/i.test(t), re = /\{\{\s*skillreq\s*\|([^|}]+)\|(\d+)[^}]*\}\}/gi, s2;
        while ((s2 = re.exec(t))) out.skills.push({ skill: s2[1].trim(), level: +s2[2], boost: boost });
        // One written another way ("{{Skillreq|Magic|level=93}}", "{{Skillreq|Combat}}") is kept as words.
        t.match(/\{\{\s*skillreq\s*\|[^}]*\}\}/gi).forEach(function (one) {
          if (/^\{\{\s*skillreq\s*\|[^|}]+\|\d+/i.test(one)) return;
          var bits = one.replace(/^\{\{\s*skillreq\s*\|/i, '').replace(/\}\}$/, '').split('|').map(function (b) { return clean(b.replace(/^[^=]*=/, '')); }).filter(Boolean);
          var num = bits.filter(function (b) { return /^\d+$/.test(b); })[0], name = bits.filter(function (b) { return !/^\d+$/.test(b); })[0];
          if (name) out.other.push((num ? num + ' ' : '') + name);
        });
        return;
      }
      var link = /^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*(\(partial\))?\.?$/i.exec(t);
      if (link) { out.links.push({ name: clean(link[1]), partial: !!link[2] }); return; }
      var w = wikiWords(t);
      if (w) out.other.push(w);
    });
    return out;
  }
  // The capes an achievement counts for, from its infobox: ['mqc', 'comp'].
  function cheevoCapes(wt) {
    var out = [], re = /\n\|\s*(mqc|comp|trimmed)\s*=\s*yes\b/gi, m;
    while ((m = re.exec(wt || ''))) { var k = CAPE_FLAGS[m[1].toLowerCase()]; if (out.indexOf(k) < 0) out.push(k); }
    return out;
  }
  // The tip: the page's first paragraph, without "X is an achievement that requires the player to".
  function cheevoTip(html) {
    var paras = (html || '').match(/<p[\s>][\s\S]*?<\/p>/g) || [], first = '';
    for (var i = 0; i < paras.length && !first; i++) if (text(docOf(paras[i]))) first = paras[i];
    var cut = first.replace(/^<p[^>]*>\s*<b>[\s\S]*?<\/b>\s*(?:\([^)]*\)\s*)?is an?\s+(?:[A-Za-z-]+\s+)?achievement\s+(?:that|which|where|in which)\s+(?:requires?|asks?|involves?|tasks?)\s+(?:the\s+)?(?:player|players|you)\s+to\s+/i, '<p>');
    var t = first ? text(docOf(cut)) : '';
    return cut !== first && t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }
  // Reads the needs, capes and tip of these pages: { "<page>": { skills, links, other, also, tip } }. A batch that
  // fails is left out (its achievements just have no details).
  function loadDetails(pages) {
    var batches = [], out = {};
    for (var i = 0; i < pages.length; i += DETAIL_BATCH) batches.push(pages.slice(i, i + DETAIL_BATCH));
    function one(titles) {
      var url = API + '?action=query&format=json&formatversion=2&redirects=1&origin=*&prop=revisions%7Cextracts&rvprop=content%7Cids&rvslots=main' +
        '&rvsection=0&exintro=1&exlimit=' + DETAIL_BATCH + '&titles=' + encodeURIComponent(titles.join('|'));
      return askWiki(url).then(function (d) {
        var q = d.query, byTitle = {};
        if (!q || !Array.isArray(q.pages)) return;
        q.pages.forEach(function (p) { byTitle[p.title] = p; });
        titles.forEach(function (t) {
          var p = byTitle[landed(q, t)], rev = p && p.revisions && p.revisions[0];
          var wt = rev ? (rev.slots && rev.slots.main ? rev.slots.main.content : rev.content) || '' : '';
          if (!p || (!wt && !p.extract)) return;
          var d = cheevoNeeds(wt);
          d.also = cheevoCapes(wt);
          d.tip = cheevoTip(p.extract);
          d.rev = (rev && rev.revid) || 0;
          out[t] = d;
        });
      }, function () { /* this batch has no details */ });
    }
    return inTurns(batches, one, DETAIL_PARALLEL).then(function () { return out; });
  }
  // Each achievement with its details: skills, links, oneOf, other, also (the other capes it counts for), tip, and rev
  // (the revision of its page they come from).
  function addDetails(cape, details) {
    cape.cheevos.forEach(function (x) {
      var d = details[x.page];
      if (!d) return;
      x.skills = d.skills; x.links = d.links; x.oneOf = d.oneOf; x.other = d.other; x.tip = d.tip; x.rev = d.rev;
      x.also = d.also.filter(function (k) { return k !== cape.key; });
    });
    return cape;
  }
  // Reads a cape: its achievements, the page with its levels when it has one, and each achievement's details.
  // Without the levels page or the details it still works. old: the cape as it was saved; an achievement whose page was
  // not edited since keeps its details, so only new and edited pages are read again. info: what pageInfo said about
  // those pages, when it was asked already.
  // What could not be read this time is kept from old: the levels, and the details of an achievement. A cape that
  // misses its levels page says so (partial), so the next update reads it again.
  function loadCape(key, old, info) {
    var c = capeOf(key);
    if (!c) { var e = new Error('There is no such cape.'); e.code = 'format'; return Promise.reject(e); }
    var kept = old || {};
    var more = c.levelsPage ? fetchPage(c.levelsPage).then(function (p) { return { levels: minLevels(p.html) }; }, function () { return { levels: kept.levels, partial: true }; }) :
      c.skillsPage ? fetchPage(c.skillsPage).then(function (p) { return { skiller: skillReqs(p.html) }; }, function () { return { skiller: kept.skiller, partial: true }; }) : Promise.resolve({});
    return Promise.all([fetchPage(c.page), more]).then(function (r) {
      var cape = parseCape(r[0].html, key), had = {}, pages = [];
      cape.revid = r[0].revid;
      if (r[1].levels) cape.levels = r[1].levels;
      if (r[1].skiller) cape.skiller = r[1].skiller;
      if (r[1].partial) cape.partial = true;
      ((old && old.cheevos) || []).forEach(function (x) { if (x.rev && x.tip != null) had[x.page] = x; });
      cape.cheevos.forEach(function (x) { if (pages.indexOf(x.page) < 0) pages.push(x.page); });
      var known = pages.filter(function (p) { return had[p]; });
      return (info ? Promise.resolve(info) : pageInfo(known)).then(function (info) {
        var d = {}, read = pages.filter(function (p) {
          var x = had[p], i = info[p];
          if (!x || !i || !i.rev || i.rev !== x.rev) return true;
          d[p] = { skills: x.skills, links: x.links, oneOf: x.oneOf, other: x.other, tip: x.tip, rev: x.rev, also: (x.also || []).concat([key]) };
          return false;
        });
        return loadDetails(read).then(function (nd) {
          read.forEach(function (p) {
            var x = had[p];
            // Not read this time: what was saved stays (with its old revision, so the next update asks again).
            if (nd[p]) d[p] = nd[p];
            else if (x) d[p] = { skills: x.skills, links: x.links, oneOf: x.oneOf, other: x.other, tip: x.tip, rev: x.rev, also: (x.also || []).concat([key]) };
          });
          return addDetails(cape, d);
        });
      });
    });
  }

  W.publish({ CAPES: CAPES, CAPE_VERSION: CAPE_VERSION, parseCape: parseCape, minLevels: minLevels, cheevoNeeds: cheevoNeeds, cheevoCapes: cheevoCapes, cheevoTip: cheevoTip, loadCape: loadCape, noComments: noComments });
  W.loaded.capes = true;
})(window.QuickGuideWiki);
