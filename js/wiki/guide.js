/*!
 * Quick Guide - js/wiki/guide.js
 * A "Quick guide" page as JSON: the quest details box, the parts of the page, and the ids of steps and items.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var CUR = W.CUR, DROP_RE = W.DROP_RE, INLINE_RE = W.INLINE_RE, MAP_VERSION = W.MAP_VERSION, SKILL_RE = W.SKILL_RE,
    VERSION = W.VERSION, arr = W.arr, cap = W.cap, clean = W.clean, esc = W.esc, fetchPage = W.fetchPage,
    hash = W.hash, kids = W.kids, pageUrl = W.pageUrl, plainOf = W.plainOf, scratch = W.scratch, slug = W.slug,
    text = W.text, unique = W.unique, inline = W.inline, mapOf = W.mapOf, takeImages = W.takeImages, tidy = W.tidy,
    bringOf = W.bringOf, isItalicOnly = W.isItalicOnly, listItems = W.listItems, parseStep = W.parseStep,
    parseTable = W.parseTable, textBlock = W.textBlock;

  // ---------- the quest details box ----------
  function tree(ul) {
    var out = [];
    (function walkList(list, depth) {
      kids(list, 'LI').forEach(function (li) {
        var c = li.cloneNode(true);
        kids(c).forEach(function (x) { if (x.tagName === 'UL' || x.tagName === 'OL') c.removeChild(x); });
        var t = text(c);
        if (t && !/^none$/i.test(t)) out.push({ text: t, depth: depth });
        kids(li).forEach(function (x) { if (x.tagName === 'UL' || x.tagName === 'OL') walkList(x, depth + 1); });
      });
    })(ul, 0);
    var roots = out.filter(function (e) { return e.depth === 0; });
    if (roots.length === 1 && out[0] === roots[0]) out.shift();
    else out.forEach(function (e) { e.depth += 1; });
    return out;
  }

  function reqsOf(td, o, page) {
    arr(td.querySelectorAll('.questreq')).forEach(function (t) {
      var ul = t.querySelector('ul, ol');
      if (ul) o.questReqs = o.questReqs.concat(tree(ul));
      if (t.parentNode) t.parentNode.removeChild(t);
    });
    arr(td.querySelectorAll('li')).forEach(function (li) {
      var c = li.cloneNode(true);
      arr(c.querySelectorAll('ul, ol')).forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
      var t = text(c);
      if (!t || /^none$/i.test(t)) return;
      var m = t.match(SKILL_RE);
      if (m) o.skillReqs.push({ skill: cap(m[2].toLowerCase()), level: +m[1], note: clean(m[3]) });
      else o.otherReqs.push(tidy(inline(c, page)));
    });
  }

  function followsOf(td) {
    var list = td.querySelector('ul, ol');
    if (!list) return [];
    return unique(tree(list).map(function (e) { return e.text; }));
  }

  function itemsOf(td, page) {
    var out = { note: '', items: [] };
    var notes = [];
    arr(td.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && /^(I|EM|P|SMALL)$/.test(n.tagName) && isItalicOnly(n)) {
        var h = tidy(inline(n, page, { noItalic: true }));
        if (h) notes.push(h);
      }
    });
    out.note = notes.join(' ');
    arr(td.querySelectorAll('ul, ol')).forEach(function (list) {
      var owner = list.parentElement && list.parentElement.closest('li');
      if (owner && td.contains(owner)) return;
      listItems(list, page).forEach(function (it) {
        out.items.push({ id: '', html: it.html, text: it.text, alternatives: it.subs });
      });
    });
    return out;
  }

  function enemyOf(t) {
    var m = t.match(/^(?:(\d+)\s*(?:\u00d7|x)?\s+)?(.+?)\s*\(\s*levels?\s*([^;)]*?)\s*(?:;\s*([^)]*))?\)\s*(.*)$/i);
    if (!m) return { text: t, name: t, count: null, level: '', note: '' };
    return { text: t, name: clean(m[2]), count: m[1] ? +m[1] : null, level: clean(m[3]), note: clean([m[4], m[5]].join(' ')) };
  }

  function findDetails(rootEl) {
    var found = rootEl.querySelector('table.questdetails');
    if (found) return found;
    arr(rootEl.querySelectorAll('table')).some(function (t) {
      var labels = arr(t.rows).map(function (r) { var th = r.querySelector('th'); return th ? text(th).toLowerCase() : ''; }).join('|');
      if (/start/.test(labels) && /(requirement|length|member)/.test(labels)) { found = t; return true; }
      return false;
    });
    return found;
  }

  function detailsOf(table, q, page) {
    var o = q.overview;
    arr(table.rows).forEach(function (tr) {
      var th = null, td = null;
      arr(tr.cells).forEach(function (c) {
        if (c.tagName === 'TH') { if (!th) th = c; return; }
        if (td || c.getAttribute('data-attr-param') === 'iconDisp') return;
        if (c.getAttribute('rowspan') && c.querySelector('.floatright')) return;
        td = c;
      });
      if (!th || !td) return;
      var label = text(th), L = label.toLowerCase();
      if (/^start/.test(L)) {
        var ml = td.querySelector('.mw-kartographer-maplink');
        if (ml) o.startMap = mapOf(ml, 'Start point');
        o.startPoint = tidy(inline(td, page));
      }
      else if (/member/.test(L)) o.members = !/free/i.test(text(td));
      else if (/length/.test(L)) o.length = text(td);
      else if (/difficulty/.test(L)) o.difficulty = text(td);
      else if (/^requirements?\b/.test(L)) reqsOf(td, o, page);
      else if (/follow|storyline/.test(L)) o.followsEvents = followsOf(td);
      else if (/item/.test(L) && /requir/.test(L)) q.requiredItems = itemsOf(td, page);
      else if (/recommend/.test(L)) q.recommendedItems = itemsOf(td, page);
      else if (/enem|combat|kill|defeat/.test(L)) {
        o.enemies = listItems(td.querySelector('ul, ol') || td, page).map(function (x) { return enemyOf(x.text); });
      } else if (/description/.test(L)) o.description = text(td);
      else {
        var h = leagueOf(td);
        if (h == null) h = tidy(inline(td, page, { alt: true, noLinks: true })).replace(/\s*&amp;\s*/g, ' &amp; ');
        if (plainOf(h)) o.extra.push({ label: label, html: h });
      }
    });
  }

  // A League row: each region badge (a picture, a name and a tick) becomes one tag with its name.
  // Returns null when the cell has no badges.
  // The innermost badges only: the wrapper around several badges, and the picture inside a region, are skipped.
  function leagueBadges(root) {
    return Array.prototype.filter.call(root.querySelectorAll('.league-region, .league-badge[data-league-region]'), function (n) {
      return !n.querySelector('.league-badge[data-league-region]') && !n.parentNode.closest('.league-region');
    });
  }
  function leagueOf(td) {
    if (!leagueBadges(td).length) return null;
    var c = td.cloneNode(true);
    leagueBadges(c).forEach(function (n) {
      var img = n.querySelector('img[alt]'), nm = n.querySelector('.league-name');
      var name = clean((nm ? nm.textContent : img ? img.getAttribute('alt') : n.textContent).replace(/\u2713/g, ''));
      n.parentNode.replaceChild(c.ownerDocument.createTextNode('\u0001' + name + '\u0002'), n);
    });
    return esc(clean(c.textContent))
      // \u0001 and \u0002 mark where a name starts and ends (put in above)
      // eslint-disable-next-line no-control-regex
      .replace(/\u0001([^\u0002]*)\u0002/g, '<span class="reg">$1</span>')
      .replace(/<\/span>\s*(&amp;|,)?\s*<span class="reg">/g, '</span> <span class="reg">')
      .replace(/\s+([.,;:!?])/g, '$1');
  }

  // ---------- walking the page ----------
  function headingOf(n) {
    var h = null;
    if (/^H[1-6]$/.test(n.tagName)) h = n;
    else if (n.classList.contains('mw-heading')) h = n.querySelector('h1, h2, h3, h4, h5, h6');
    if (!h) return null;
    var hl = h.querySelector('.mw-headline');
    return { h: true, level: +h.tagName.charAt(1), text: text(hl || h), anchor: (hl && hl.id) || h.id || '' };
  }

  function isWrapper(n) {
    if (!/^(DIV|CENTER|SECTION|ARTICLE|MAIN)$/.test(n.tagName)) return false;
    if (n.matches('.seealso, .thumb, .gallery, .mw-kartographer-container, .mw-kartographer-map, .js-tooltip-wrapper')) return false;
    for (var c = n.firstElementChild; c; c = c.nextElementSibling) {
      if (/^(UL|OL|P|DIV|TABLE|FIGURE|DL|H[1-6]|BLOCKQUOTE|CENTER|SECTION)$/.test(c.tagName)) return true;
    }
    return false;
  }

  // Flattens wrappers so the page reads as one list of headings and blocks.
  function flatten(container, out) {
    var run = null;
    function flush() {
      if (run && (clean(run.textContent) || run.querySelector('img'))) out.push({ el: run });
      run = null;
    }
    arr(container.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        if (!run && !clean(n.nodeValue)) return;
        (run = run || scratch.createElement('p')).appendChild(scratch.importNode(n, true));
        return;
      }
      if (n.nodeType !== 1 || DROP_RE.test(n.tagName)) return;
      var h = headingOf(n);
      if (h) { flush(); out.push(h); return; }
      if (INLINE_RE.test(n.tagName)) { (run = run || scratch.createElement('p')).appendChild(scratch.importNode(n, true)); return; }
      flush();
      if (isWrapper(n)) { flatten(n, out); return; }
      out.push({ el: n });
    });
    flush();
    return out;
  }

  function kindOf(title) {
    var t = clean(title).toLowerCase();
    if (/^(overview|details|quest details)$/.test(t)) return 'overview';
    if (/^rewards?\b/.test(t)) return 'rewards';
    if (/^achievements?\b/.test(t)) return 'achievements';
    if (/^required for/.test(t)) return 'requiredFor';
    if (/^music\b/.test(t)) return 'music';
    if (/^(trivia|see also|references|navigation|transcript|gallery|update history|changes|credits|development team|cultural references|external links)$/.test(t)) return 'skip';
    return 'steps';
  }

  function labelOf(el) {
    var t = text(el);
    if (!t || t.length > 60) return null;
    if (el.tagName === 'DL' && !arr(el.querySelectorAll('dd')).some(function (d) { return text(d); })) return t;
    if (/^(P|DIV)$/.test(el.tagName)) {
      var b = el.querySelector('b, strong');
      if (b && text(b) === t) return t.replace(/:$/, '');
    }
    return null;
  }

  function forLabel(t) {
    if (/\bdirectly\b/i.test(t)) return 'Directly';   // not "Indirectly"
    if (/comprehension/i.test(t)) return 'Indirectly, for the story';
    if (/indirect/i.test(t)) return 'Indirectly';
    return clean(t).replace(/:$/, '');
  }

  function stepsBlock(tk, sec, page) {
    if (tk.h) { sec.blocks.push({ type: 'heading', level: tk.level, text: tk.text }); return; }
    var el = tk.el, tag = el.tagName;
    if ((tag === 'UL' || tag === 'OL') && !el.classList.contains('gallery')) {
      kids(el, 'LI').forEach(function (li) { var s = parseStep(li, page); if (s) sec.blocks.push(s); });
      return;
    }
    if (tag === 'TABLE') { var t = parseTable(el, page); if (t) sec.blocks.push(t); return; }
    if (tag === 'HR') return;
    var b = bringOf(el, page);
    if (b) { sec.blocks.push(b); return; }
    var c = el.cloneNode(true);
    var got = takeImages(c, page);
    var tb = got.rest ? textBlock(c, page) : null;
    if (tb) sec.blocks.push(tb);
    if (got.images.length > 1 && el.matches('ul.gallery, .gallery')) sec.blocks.push({ type: 'images', items: got.images });
    else got.images.forEach(function (im) { sec.blocks.push(im); });
  }

  function walk(rootEl, q, page) {
    var toks = flatten(rootEl, []);
    var mode = '', sec = null, label = '', ids = {};
    toks.forEach(function (tk) {
      if (tk.h && tk.level <= 2) {
        mode = kindOf(tk.text); label = ''; sec = null;
        if (mode === 'steps') {
          var base = slug(tk.text), id = base, n = 2;
          while (ids[id]) id = base + '-' + n++;
          ids[id] = 1;
          sec = { id: id, title: tk.text, anchor: tk.anchor, blocks: [] };
          q.sections.push(sec);
        }
        return;
      }
      if (!mode || mode === 'skip') return;
      if (mode === 'steps') { stepsBlock(tk, sec, page); return; }
      if (mode === 'overview') {
        if (!tk.h) { var ob = textBlock(tk.el, page); if (ob) q.overview.notes.push(ob.html); }
        return;
      }
      if (tk.h) { label = tk.text; return; }
      var el = tk.el, lab = labelOf(el);
      if (lab) { label = lab; return; }
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        var items = listItems(el, page);
        var L = (mode === 'music' ? 'music' : label).toLowerCase();
        if (mode === 'requiredFor') {
          q.requiredFor.push({ label: forLabel(label || 'Directly'), items: items.map(function (x) { return x.html; }) });
        } else if (/music/.test(L)) {
          q.music = q.music.concat(items.map(function (x) {
            var m = x.text.match(/^(.*?)\s*\((.*)\)\s*$/);
            return { name: m ? m[1] : x.text, where: m ? m[2] : '' };
          }));
        } else if (mode === 'achievements' || /achievement/.test(L)) {
          q.achievements = q.achievements.concat(items.map(function (x) { return x.html; }));
        } else if (!label && !q.rewards.items.length) {
          q.rewards.items = items;
        } else {
          q.rewards.groups.push({ label: label, items: items });
        }
        label = '';
        return;
      }
      var c = el.cloneNode(true);
      var got = takeImages(c, page);
      if (mode === 'rewards' && got.images.length && !q.rewards.image) q.rewards.image = got.images[0];
      if (!got.rest || el.tagName === 'TABLE') return;
      var tb = textBlock(c, page);
      if (!tb) return;
      if (mode === 'requiredFor') label = plainOf(tb.html);
      else if (mode === 'rewards') q.rewards.notes.push(tb.html);
    });
  }

  function assignIds(q) {
    var used = {};
    function uniq(base) { var id = base, n = 2; while (used[id]) id = base + '-' + n++; used[id] = 1; return id; }
    function stepIds(s, prefix) {
      s.id = uniq(prefix + ':' + hash(s.text || s.html || 'step'));
      s.substeps.forEach(function (c) { if (c.type === 'step') stepIds(c, s.id); });
    }
    q.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b) {
        if (b.type === 'step') stepIds(b, sec.id);
        if (b.type === 'bring') {
          b.needed.concat(b.recommended).forEach(function (it) { it.id = uniq(sec.id + ':bring:' + hash(it.text)); });
        }
      });
    });
    q.requiredItems.items.forEach(function (it) { it.id = uniq('req:' + hash(it.text)); });
    q.recommendedItems.items.forEach(function (it) { it.id = uniq('rec:' + hash(it.text)); });
  }

  // ---------- main entry ----------
  // On a phone the wiki puts what follows each heading in a <section>: take them out, so the page is flat again.
  function unwrapSections(root) {
    arr(root.querySelectorAll('section')).forEach(function (sec) {
      while (sec.firstChild) sec.parentNode.insertBefore(sec.firstChild, sec);
      sec.parentNode.removeChild(sec);
    });
  }
  function parse(html, info) {
    info = info || {};
    var page = info.title || '';
    CUR.page = page;
    CUR.live = info.live || {};
    var mv = /maps\.runescape\.wiki\/rs\/versions\/([^/"')\s&]+)\//.exec(html);
    var doc = new DOMParser().parseFromString('<!doctype html><html><body><div id="qg-root">' + html + '</div></body></html>', 'text/html');
    var rootEl = doc.querySelector('#qg-root .mw-parser-output') || doc.getElementById('qg-root');
    unwrapSections(rootEl);
    arr(rootEl.querySelectorAll('.mw-editsection, .toc, #toc, .navbox, table.messagebox, .rs-external-header-links, ' +
      'sup.reference, .reference, .mw-references-wrap, .references, .printfooter, .catlinks, .mw-empty-elt, style, script'))
      .forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });

    var q = {
      version: VERSION,
      page: page,
      title: info.base || page.replace(/\/\s*quick guide$/i, ''),
      source: pageUrl(page),
      fetchedAt: new Date().toISOString(),
      revid: info.revid || 0,
      notQuickGuide: !!info.notQuick,
      mapVersion: mv ? mv[1] : MAP_VERSION,
      overview: {
        startPoint: '', startMap: null, members: null, length: '', difficulty: '', description: '',
        questReqs: [], skillReqs: [], otherReqs: [], followsEvents: [], enemies: [], extra: [], notes: []
      },
      requiredItems: { note: '', items: [] },
      recommendedItems: { note: '', items: [] },
      sections: [],
      rewards: { image: null, items: [], groups: [], notes: [] },
      music: [],
      achievements: [],
      requiredFor: []
    };

    var details = findDetails(rootEl);
    if (details) { detailsOf(details, q, page); details.parentNode.removeChild(details); }
    walk(rootEl, q, page);
    q.sections = q.sections.filter(function (s) { return s.blocks.length; });
    assignIds(q);
    return q;
  }

  // t = { title: 'X/Quick guide', base: 'X' }. Falls back to the main page if there is no quick guide.
  function load(t) {
    return fetchPage(t.title).catch(function (e) {
      if (e && e.code === 'missingtitle' && t.base && t.base !== t.title) {
        return fetchPage(t.base).then(function (p) { p.notQuick = true; return p; });
      }
      throw e;
    }).then(function (p) {
      return parse(p.html, { title: p.title, base: t.base, notQuick: !!p.notQuick, live: p.live, revid: p.revid });
    });
  }

  W.share({ unwrapSections: unwrapSections });
  W.publish({ parse: parse, load: load });
  W.loaded.guide = true;
})(window.QuickGuideWiki);
