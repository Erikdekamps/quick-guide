/*!
 * Quick Guide - parser.js
 * Reads a RuneScape Wiki "Quick guide" page and turns it into plain JSON.
 * Guide text and images belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (root) {
  'use strict';

  var WIKI = 'https://runescape.wiki';
  var API = WIKI + '/api.php';
  var VERSION = 2;
  // The wiki's map render as of Nov 2026. Pages carry the current one; this is only the fallback.
  var MAP_VERSION = '2026-10-12-a';
  // Context for the page being parsed (its title and its map marker data).
  var CUR = { page: '', live: {} };
  var MARK = '\u0001';

  var SKILLS = ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Runecrafting', 'Construction',
    'Dungeoneering', 'Constitution', 'Agility', 'Herblore', 'Thieving', 'Crafting', 'Fletching', 'Slayer',
    'Hunter', 'Divination', 'Necromancy', 'Mining', 'Smithing', 'Fishing', 'Cooking', 'Firemaking',
    'Woodcutting', 'Farming', 'Summoning', 'Invention', 'Archaeology'];
  var SKILL_RE = new RegExp('^(\\d{1,3})\\s*(' + SKILLS.join('|') + ')\\b\\s*(.*)$', 'i');
  var FAIRY_RE = /^[A-D][I-L][P-S]$/;
  var BLOCK_RE = /^(P|DIV|DD|DT|DL|UL|OL|FIGURE|BLOCKQUOTE|CENTER|SECTION|H[1-6]|TABLE|TBODY|THEAD|TR|TD|TH|CAPTION)$/;
  var DROP_RE = /^(STYLE|SCRIPT|LINK|META|NOSCRIPT|TEMPLATE|BUTTON|INPUT|SELECT|TEXTAREA|SVG|AUDIO|VIDEO|IFRAME|OBJECT)$/;
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

  // ---------- fetching ----------
  function fetchPage(title) {
    var q = 'action=parse&format=json&formatversion=2&prop=text%7Cjsconfigvars&redirects=1' +
      '&disableeditsection=1&disablelimitreport=1&origin=*&page=' + encodeURIComponent(title);
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : 0;
    return fetch(API + '?' + q, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) { var e = new Error('The wiki answered with error ' + r.status + '.'); e.code = 'http'; throw e; }
        return r.json();
      })
      .then(function (d) {
        clearTimeout(timer);
        if (d && d.error) { var e = new Error(d.error.info || 'The wiki could not find that page.'); e.code = d.error.code; throw e; }
        if (!d || !d.parse || typeof d.parse.text !== 'string') {
          var e2 = new Error('The wiki sent something unexpected.'); e2.code = 'format'; throw e2;
        }
        var cfg = d.parse.jsconfigvars || {};
        return { title: d.parse.title, html: d.parse.text, live: cfg.wgKartographerLiveData || {} };
      }, function (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') { var e = new Error('The wiki took too long to answer.'); e.code = 'timeout'; throw e; }
        throw err;
      });
  }

  // t = { title: 'X/Quick guide', base: 'X' }. Falls back to the main page if there is no quick guide.
  function load(t) {
    return fetchPage(t.title).catch(function (e) {
      if (e && e.code === 'missingtitle' && t.base && t.base !== t.title) {
        return fetchPage(t.base).then(function (p) { p.notQuick = true; return p; });
      }
      throw e;
    }).then(function (p) {
      return parse(p.html, { title: p.title, base: t.base, notQuick: !!p.notQuick, live: p.live });
    });
  }

  // ---------- inline HTML: only a small, safe set of tags survives ----------
  function inline(node, page, o) {
    o = o || {};
    var out = '';
    var list = node.childNodes;
    for (var i = 0; i < list.length; i++) out += inlineOne(list[i], page, o);
    return out;
  }

  function isHidden(n) {
    if (n.classList.contains('hidden')) return true;
    var st = n.getAttribute('style');
    return !!(st && /display\s*:\s*none/i.test(st));
  }

  // "fairy ring code DJP" written without bold still gets the code chip.
  function codes(s) {
    return s.replace(/\b(fairy rings?(?: code)?:?\s+)([A-D][I-L][P-S])\b/gi, '$1<span class="code">$2</span>');
  }

  function inlineOne(n, page, o) {
    if (n.nodeType === 3) return codes(esc(n.nodeValue));
    if (n.nodeType !== 1) return '';
    var tag = n.tagName, inner;
    if (DROP_RE.test(tag) || isHidden(n)) return '';
    if (n.classList.contains('mw-kartographer-maplink') && /show on map/i.test(text(n))) return '';
    switch (tag) {
      case 'A':
        inner = inline(n, page, o);
        if (!clean(inner.replace(/<[^>]*>/g, '')) && inner.indexOf('<img') < 0) return '';
        var href = o.noLinks ? '' : absUrl(n.getAttribute('href'), page);
        return href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + inner + '</a>' : inner;
      case 'B': case 'STRONG':
        var bt = text(n);
        if (FAIRY_RE.test(bt)) return '<span class="code">' + esc(bt) + '</span>';
        inner = inline(n, page, o);
        return clean(inner) ? '<b>' + inner + '</b>' : inner;
      case 'I': case 'EM':
        inner = inline(n, page, o);
        return (o.noItalic || !clean(inner)) ? inner : '<i>' + inner + '</i>';
      case 'BR':
        return '<br>';
      case 'SUP':
        var st = text(n);
        if (/^\[\d+\]$/.test(st) || /^#\d+$/.test(st)) return '';
        if (/^\[(UK|US)\]$/.test(st)) return st;
        return '<sup>' + inline(n, page, o) + '</sup>';
      case 'SUB':
        return '<sub>' + inline(n, page, o) + '</sub>';
      case 'IMG':
        if (o.alt) return esc(clean(n.getAttribute('alt')));
        return o.images ? imgTag(n) : '';
      case 'LI':
        return '<br>\u2022 ' + inline(n, page, o) + '<br>';
      default:
        inner = inline(n, page, o);
        return BLOCK_RE.test(tag) ? '<br>' + inner + '<br>' : inner;
    }
  }

  function imgTag(img) {
    var src = absUrl(img.getAttribute('src'));
    if (!src) return '';
    var w = parseInt(img.getAttribute('width'), 10) || 0;
    var h = parseInt(img.getAttribute('height'), 10) || 0;
    return '<img src="' + esc(src) + '" alt="' + esc(clean(img.getAttribute('alt'))) + '"' +
      (w ? ' width="' + w + '"' : '') + (h ? ' height="' + h + '"' : '') + ' loading="lazy" decoding="async">';
  }

  // Tidy spacing and punctuation left behind after pulling bits out.
  function tidy(html) {
    var s = String(html || '')
      .replace(/\s*\[UK\]\s*/g, ' (UK) / ').replace(/\s*\[US\]/g, ' (US)')
      .replace(/[ \t\r\n\u00a0]+/g, ' ')
      .replace(/(?:\s*<br>\s*){2,}/g, '<br>')
      .replace(/^(?:\s*<br>)+|(?:<br>\s*)+$/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+([.,;:!?])(?=\s|$|<)/g, '$1')
      .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
      .replace(/^[,;]\s*/, '')
      .replace(/\b(CAUTION|WARNING|IMPORTANT)\b:?/g, '<span class="caution">$&</span>')
      .trim();
    return fixParens(s);
  }

  // Drop brackets that lost their partner.
  function fixParens(html) {
    if (html.indexOf('(') < 0 && html.indexOf(')') < 0) return html;
    var box = scratch.createElement('div');
    box.innerHTML = html;
    var walker = scratch.createTreeWalker(box, 4 /* NodeFilter.SHOW_TEXT */);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var open = [], bad = [];
    nodes.forEach(function (n, ni) {
      for (var i = 0; i < n.nodeValue.length; i++) {
        var ch = n.nodeValue.charAt(i);
        if (ch === '(') open.push([ni, i]);
        else if (ch === ')') { if (open.length) open.pop(); else bad.push([ni, i]); }
      }
    });
    bad = bad.concat(open);
    if (!bad.length) return html;
    bad.sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; }).forEach(function (p) {
      var n = nodes[p[0]];
      n.nodeValue = n.nodeValue.slice(0, p[1]) + n.nodeValue.slice(p[1] + 1);
    });
    return box.innerHTML.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])(?=\s|$|<)/g, '$1').trim();
  }

  // ---------- maps ----------
  // A wiki map (mapframe or "Show on map" link). Game x is longitude, game y is latitude.
  // Markers and shapes come from the page's map data (wgKartographerLiveData).
  function mapOf(a, caption) {
    function num(k, d) { var v = parseFloat(a.getAttribute('data-' + k)); return isFinite(v) ? v : d; }
    var groups = [], features = [];
    try { groups = JSON.parse(a.getAttribute('data-overlays') || '[]'); } catch (e) { groups = []; }
    function add(f) {
      if (!f || typeof f !== 'object') return;
      if (f.type === 'FeatureCollection' && Array.isArray(f.features)) { f.features.forEach(add); return; }
      if (f.type === 'Feature' && f.geometry) features.push(f);
    }
    (Array.isArray(groups) ? groups : []).forEach(function (g) {
      var list = CUR.live ? CUR.live[g] : null;
      (Array.isArray(list) ? list : list ? [list] : []).forEach(add);
    });
    var st = /maps\.runescape\.wiki\/rs\/versions\/([^\/"')\s&]+)\//.exec(a.getAttribute('style') || '');
    return {
      type: 'map', caption: caption || '',
      lat: num('lat', 3200), lon: num('lon', 3200), zoom: num('zoom', 2),
      plane: num('plane', 0), mapId: num('mapid', 28),
      version: st ? st[1] : '', features: features,
      href: CUR.page ? pageUrl(CUR.page) : ''
    };
  }

  // ---------- images ----------
  function imageOf(n, page) {
    var img = n.tagName === 'IMG' ? n : n.querySelector('img');
    var capEl = n.querySelector && n.querySelector('figcaption, .thumbcaption, .gallerytext');
    var caption = capEl ? text(capEl) : '';
    var mapEl = n.matches('.mw-kartographer-map, .mw-kartographer-container[data-lat]') ? n : n.querySelector('.mw-kartographer-map');
    if (mapEl) return mapOf(mapEl, caption);
    if (!img) return null;
    var src = absUrl(img.getAttribute('src'));
    if (!src) return null;
    var link = n.tagName === 'A' ? n : n.querySelector('a.mw-file-description, a.image, a[href*="/w/File:"]');
    return {
      type: 'image',
      src: src,
      width: parseInt(img.getAttribute('width'), 10) || null,
      height: parseInt(img.getAttribute('height'), 10) || null,
      alt: clean(img.getAttribute('alt')),
      caption: caption,
      href: link ? absUrl(link.getAttribute('href'), page) : ''
    };
  }

  // Pulls big pictures, maps and galleries out of el (they show in their own boxes).
  function takeImages(el, page) {
    var found = [];
    var SEL = 'figure, .thumb, .mw-kartographer-container, .mw-kartographer-map, ul.gallery, .gallery';
    function grab(n) {
      if (n.matches('ul.gallery, .gallery')) {
        arr(n.querySelectorAll('.gallerybox')).forEach(function (b) { var im = imageOf(b, page); if (im) found.push(im); });
      } else {
        var im = imageOf(n, page);
        if (im) found.push(im);
      }
    }
    if (el.matches(SEL)) { grab(el); return { images: found, rest: false }; }
    arr(el.querySelectorAll(SEL)).forEach(function (n) {
      if (!el.contains(n)) return;
      grab(n);
      n.parentNode.removeChild(n);
    });
    arr(el.querySelectorAll('img')).forEach(function (img) {
      if (!el.contains(img)) return;
      if ((parseInt(img.getAttribute('width'), 10) || 0) < 100) return;
      var holder = img.closest('span[typeof], a.mw-file-description, a.image') || img;
      if (!el.contains(holder)) holder = img;
      var im = imageOf(holder, page);
      if (im) found.push(im);
      holder.parentNode.removeChild(holder);
    });
    return { images: found, rest: true };
  }

  // ---------- chat options ----------
  function normKey(k) {
    k = clean(k).replace(/^\[|\]$/g, '');
    if (/^varies$/i.test(k) || k === '?') return '?';
    if (/^any$/i.test(k) || k === '~') return '~';
    if (/^(accept|\u2713|\u2714|\u2611)$/i.test(k)) return '\u2713';
    return k;
  }

  // Replaces each chat in el by a marker and returns the options in order.
  function takeChats(el) {
    var groups = [];
    var wrappers = arr(el.querySelectorAll('.js-tooltip-wrapper'));
    arr(el.querySelectorAll('.chat-options')).forEach(function (c) {
      if (!el.contains(c)) return;
      var opts = [], toggle = null, n = c.nextElementSibling;
      while (n && !toggle) {
        if (n.matches('.chat-options-dialogue')) toggle = n;
        else if (n.matches('.chat-options')) break;
        n = n.nextElementSibling;
      }
      var name = toggle ? toggle.getAttribute('data-tooltip-name') : '';
      var wrap = null;
      if (name) wrappers.forEach(function (w) { if (w.getAttribute('data-tooltip-for') === name) wrap = w; });
      if (wrap) {
        arr(wrap.querySelectorAll('tr')).forEach(function (tr) {
          var cells = arr(tr.children).filter(function (x) { return x.tagName === 'TD' || x.tagName === 'TH'; });
          if (cells.length >= 2) opts.push({ key: normKey(text(cells[0])), text: text(cells[1]) });
          else if (cells.length === 1 && text(cells[0])) opts.push({ key: '', text: text(cells[0]) });
        });
      }
      if (!opts.length) {
        arr(c.querySelectorAll('.chat-options-underline')).forEach(function (u) {
          opts.push({ key: normKey(text(u)), text: clean(u.getAttribute('title')) });
        });
      }
      if (!opts.length) {
        text(c).replace(/[()]/g, '').split(/[\u2022\u00b7]/).forEach(function (k) {
          k = clean(k);
          if (k) opts.push({ key: normKey(k), text: '' });
        });
      }
      c.parentNode.replaceChild(el.ownerDocument.createTextNode(MARK + groups.length + MARK), c);
      if (toggle && toggle.parentNode) toggle.parentNode.removeChild(toggle);
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      groups.push(opts);
    });
    arr(el.querySelectorAll('.chat-options-dialogue, .js-tooltip-wrapper')).forEach(function (x) {
      if (x.parentNode) x.parentNode.removeChild(x);
    });
    return groups;
  }

  // Splits step text around the chat markers. Short text between two chats becomes the
  // label of the second chat ("If you finished ...", "Or", "Then with Lucien").
  function splitChats(raw, groups) {
    if (!groups.length) return { html: raw, dialogue: [] };
    var parts = raw.split(new RegExp(MARK + '(\\d+)' + MARK));
    var segs = [], order = [];
    parts.forEach(function (p, i) { if (i % 2) order.push(+p); else segs.push(p); });
    var dialogue = order.map(function (gi) { return { when: null, options: groups[gi] || [] }; });
    var keep = segs.slice();
    for (var k = 1; k < dialogue.length; k++) {
      var p = plainOf(segs[k]);
      var lab = p.replace(/^[\s(,;:.\u2014\u2013-]+|[\s(,;:\u2014\u2013-]+$/g, '');
      if (!lab) continue;
      if (/^or$/i.test(lab)) { dialogue[k].when = 'Or'; keep[k] = ''; continue; }
      if (lab.length <= 90) {
        dialogue[k].when = cap(lab.replace(/[.:]+$/, ''));
        keep[k] = '';
        if (p.indexOf('(') >= 0 && p.indexOf(')') < 0 && keep[k + 1] != null) {
          keep[k + 1] = keep[k + 1].replace(/^(\s*(?:<[^>]+>\s*)*)\)/, '$1');
        }
      }
    }
    var lastSeg = segs.length - 1, lastChat = dialogue.length - 1;
    var tail = plainOf(keep[lastSeg]).replace(/^[\s,;)]+/, '');
    if (lastChat >= 1 && /^(if|unless|when)\b/i.test(tail) && tail.length <= 90) {
      var w = tail.replace(/[.\s]+$/, '');
      var prev = dialogue[lastChat].when;
      dialogue[lastChat].when = prev === 'Or' ? 'Or, ' + w : prev ? prev + ', ' + w : cap(w);
      keep[lastSeg] = '';
    }
    return { html: keep.join(' '), dialogue: dialogue };
  }

  // ---------- blocks ----------
  function parseTable(t, page) {
    if (t.matches('.navbox, .questdetails, .messagebox')) return null;
    var head = [], rows = [];
    arr(t.rows).forEach(function (tr) {
      var cells = arr(tr.cells);
      if (!cells.length) return;
      var data = cells.map(function (c) { return tidy(inline(c, page, { images: true })); });
      var allHead = cells.every(function (c) { return c.tagName === 'TH'; });
      if (allHead && !rows.length && !head.length) head = data;
      else if (data.some(function (x) { return x; })) rows.push(data);
    });
    if (!rows.length && !head.length) return null;
    var capEl = t.querySelector('caption');
    var label = capEl ? text(capEl) : head.map(plainOf).filter(Boolean).slice(0, 2).join(' \u00b7 ');
    return { type: 'table', label: label || 'Table', head: head, rows: rows };
  }

  function isItalicOnly(el) {
    if (!text(el)) return false;
    var c = el.cloneNode(true);
    arr(c.querySelectorAll('i, em')).forEach(function (x) { x.parentNode.removeChild(x); });
    if (c.tagName === 'I' || c.tagName === 'EM') return true;
    return !text(c).replace(/[\s.,;:()\-\u2013\u2014]/g, '');
  }

  function textBlock(el, page) {
    var italic = isItalicOnly(el);
    var html = tidy(inline(el, page, { noItalic: italic }));
    var plain = plainOf(html);
    if (!plain) return null;
    if (/^(WARNING|CAUTION|IMPORTANT)\b/.test(plain)) return { type: 'warning', html: html };
    if (italic || el.tagName === 'BLOCKQUOTE') return { type: 'note', html: html };
    return { type: 'text', html: html };
  }

  function labelKey(t) {
    t = clean(t).replace(/:$/, '').toLowerCase();
    if (/^(items? )?(needed|required|requirements?)$/.test(t)) return 'needed';
    if (/^(items? )?recommended$/.test(t)) return 'recommended';
    return null;
  }

  // "Needed: ... Recommended: ..." lines at the top of a part.
  function bringOf(el, page) {
    var nodes = arr(el.childNodes);
    if (nodes.length === 1 && nodes[0].nodeType === 1 && /^(P|DIV)$/.test(nodes[0].tagName)) nodes = arr(nodes[0].childNodes);
    var first = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && !clean(nodes[i].nodeValue)) continue;
      first = nodes[i]; break;
    }
    if (!first || first.nodeType !== 1 || !/^(B|STRONG)$/.test(first.tagName) || !labelKey(text(first))) return null;
    var parts = {}, cur = null, buf = '';
    function flush() { if (cur) parts[cur] = tidy(buf.replace(/^\s*:\s*/, '')); buf = ''; }
    nodes.forEach(function (n) {
      if (n.nodeType === 1 && /^(B|STRONG)$/.test(n.tagName) && labelKey(text(n))) {
        flush(); cur = labelKey(text(n)); return;
      }
      if (cur) buf += inlineOne(n, page, {});
    });
    flush();
    if (!parts.needed && !parts.recommended) return null;
    function items(h) {
      return h ? splitList(h).map(function (x) { return { id: '', html: x, text: plainOf(x) }; }) : [];
    }
    return { type: 'bring', needed: items(parts.needed), recommended: items(parts.recommended) };
  }

  // Splits "Logs, ring of charos (a) or 5,000 coins, runes: air, mind, water" into separate items.
  // Commas inside brackets, links or numbers never split. Bits like "but more is preferable"
  // stay with the item before them; short bits after a "...:" list stay together.
  var GLUE = /^(but|or|where|which|who|whose|that|so|then|there|it|its|this|these|those|they|you|we|plus|as|if|unless|though|although|because|while|otherwise|preferably|ideally|especially|including|except|even|e\.g\.|i\.e\.|such as)\b/i;
  function capFirst(h) { return h.replace(/^((?:\s*<[^>]+>)*\s*)([a-z])/, function (m, a, b) { return a + b.toUpperCase(); }); }
  function splitList(html) {
    var pieces = [], cur = '', depth = 0, paren = 0, i = 0;
    function cut(kind) { pieces.push({ html: cur, kind: kind }); cur = ''; }
    while (i < html.length) {
      var ch = html.charAt(i);
      if (ch === '<') {
        var end = html.indexOf('>', i);
        if (end < 0) end = html.length - 1;
        var tag = html.slice(i, end + 1);
        i = end + 1;
        if (/^<br\b/i.test(tag)) { if (depth === 0) { cut('stop'); continue; } }
        else if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
        else if (!/\/>$/.test(tag) && !/^<(img|wbr)\b/i.test(tag)) depth++;
        cur += tag;
        continue;
      }
      if (ch === '(') paren++;
      else if (ch === ')') paren = Math.max(0, paren - 1);
      if (depth === 0 && paren === 0) {
        if (ch === ',' && !(/\d/.test(html.charAt(i - 1)) && /\d/.test(html.charAt(i + 1)))) { cut('comma'); i++; continue; }
        if (ch === '.' && /^\s+[A-Z]/.test(html.slice(i + 1, i + 4))) { cur += ch; cut('stop'); i++; continue; }
      }
      cur += ch;
      i++;
    }
    cut('end');
    var out = [], sentence = [];
    function flush() {
      var merged = [];
      sentence.forEach(function (frag) {
        var t = plainOf(frag);
        if (!t) return;
        var last = merged.length - 1;
        var words = t.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean).length;
        if (last >= 0 && (GLUE.test(t) || (words <= 2 && plainOf(merged[last]).indexOf(':') >= 0))) {
          merged[last] = merged[last] + ', ' + frag.trim();
          return;
        }
        merged.push(frag.trim().replace(/^and\s+/i, ''));
      });
      merged.forEach(function (m) {
        var h = tidy(m);
        if (plainOf(h).split(/\s+/).length <= 8) h = h.replace(/\.\s*$/, '');
        if (plainOf(h)) out.push(capFirst(h));
      });
      sentence = [];
    }
    pieces.forEach(function (p) { sentence.push(p.html); if (p.kind !== 'comma') flush(); });
    return out;
  }

  // One list item -> one step (with chat options, pictures and sub-steps).
  function parseStep(li, page) {
    var el = li.cloneNode(true);
    var subLis = [];
    arr(el.querySelectorAll('ul, ol')).forEach(function (list) {
      if (!el.contains(list) || list.matches('.gallery')) return;
      var owner = list.parentElement && list.parentElement.closest('li');
      if (owner !== el) return;
      kids(list, 'LI').forEach(function (c) { subLis.push(c); });
      list.parentNode.removeChild(list);
    });
    var images = takeImages(el, page).images;
    arr(el.querySelectorAll('.mw-kartographer-maplink')).forEach(function (a) {
      var label = text(a);
      images.push(mapOf(a, !label || /show on map/i.test(label) ? 'Map' : label));
    });
    var chats = takeChats(el);
    var tables = [];
    arr(el.querySelectorAll('table')).forEach(function (t) {
      if (!el.contains(t)) return;
      var tb = parseTable(t, page);
      if (tb) tables.push(tb);
      t.parentNode.removeChild(t);
    });
    var split = splitChats(inline(el, page, {}), chats);
    var html = tidy(split.html);
    var plain = plainOf(html);
    var subs = subLis.map(function (s) { return parseStep(s, page); }).filter(Boolean);
    if (!plain && !split.dialogue.length && !images.length && !tables.length && !subs.length) return null;
    if (/^(WARNING|CAUTION|IMPORTANT)\b/.test(plain) && !split.dialogue.length) {
      return { type: 'warning', html: html };
    }
    return {
      type: 'step', id: '', html: html, text: plain,
      dialogue: split.dialogue, images: images, tables: tables, substeps: subs
    };
  }

  function listItems(list, page) {
    return kids(list, 'LI').map(function (li) {
      var c = li.cloneNode(true), subs = [];
      arr(c.querySelectorAll('ul, ol')).forEach(function (s) {
        if (!c.contains(s)) return;
        if (s.parentElement && s.parentElement.closest('li') === c) {
          kids(s, 'LI').forEach(function (x) { var h = tidy(inline(x, page)); if (plainOf(h)) subs.push(h); });
          s.parentNode.removeChild(s);
        }
      });
      var html = tidy(inline(c, page));
      return { html: html, text: plainOf(html), subs: subs };
    }).filter(function (x) { return x.text && !/^none$/i.test(x.text); });
  }

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
        var h = tidy(inline(td, page, { alt: true, noLinks: true })).replace(/\s*&amp;\s*/g, ' &amp; ');
        if (plainOf(h)) o.extra.push({ label: label, html: h });
      }
    });
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
    if (/^(trivia|see also|references|navigation|transcript|gallery|update history|changes)$/.test(t)) return 'skip';
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
    if (/directly/i.test(t)) return 'Directly';
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
  function parse(html, info) {
    info = info || {};
    var page = info.title || '';
    CUR = { page: page, live: info.live || {} };
    var mv = /maps\.runescape\.wiki\/rs\/versions\/([^\/"')\s&]+)\//.exec(html);
    var doc = new DOMParser().parseFromString('<!doctype html><html><body><div id="qg-root">' + html + '</div></body></html>', 'text/html');
    var rootEl = doc.querySelector('#qg-root .mw-parser-output') || doc.getElementById('qg-root');
    arr(rootEl.querySelectorAll('.mw-editsection, .toc, #toc, .navbox, table.messagebox, .rs-external-header-links, ' +
      'sup.reference, .reference, .mw-references-wrap, .references, .printfooter, .catlinks, .mw-empty-elt, style, script'))
      .forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });

    var q = {
      version: VERSION,
      page: page,
      title: info.base || page.replace(/\/\s*quick guide$/i, ''),
      source: pageUrl(page),
      fetchedAt: new Date().toISOString(),
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

  // ---------- the list of all quests ----------
  function getJson(url) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : 0;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' }).then(function (r) {
      return r.json().then(function (j) { return j; }, function () { return null; }).then(function (j) {
        clearTimeout(timer);
        return { ok: r.ok, status: r.status, json: j };
      });
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') { var e = new Error('The wiki took too long to answer.'); e.code = 'timeout'; throw e; }
      throw err;
    });
  }
  function colKey(t) {
    t = t.toLowerCase();
    if (/^(name|quest)\b/.test(t)) return 'name';
    if (/member/.test(t)) return 'members';
    if (/length/.test(t)) return 'length';
    if (/^age\b/.test(t)) return 'age';
    if (/difficult/.test(t)) return 'difficulty';
    if (/combat/.test(t)) return 'combat';
    if (/^qp\b|quest points/.test(t)) return 'qp';
    if (/series/.test(t)) return 'series';
    if (/release|date/.test(t)) return 'release';
    return '';
  }
  function cellText(td) {
    if (!td) return '';
    var c = td.cloneNode(true);
    arr(c.querySelectorAll('sup, style, script')).forEach(function (n) { n.parentNode.removeChild(n); });
    return text(c);
  }
  // Everything a cell says, also in picture names and tooltips (the members column is an icon).
  function cellHints(td) {
    if (!td) return '';
    var s = [cellText(td), td.getAttribute('data-sort-value') || '', td.getAttribute('title') || ''];
    arr(td.querySelectorAll('img, a, span')).forEach(function (n) {
      s.push(n.getAttribute('alt') || '', n.getAttribute('title') || '', n.getAttribute('src') || '');
    });
    return s.join(' ');
  }
  // html of https://runescape.wiki/w/List_of_quests -> [{ name, page, members, length, age, difficulty, combat, qp, series, release }]
  function parseQuestList(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><html><body>' + html + '</body></html>', 'text/html');
    var out = [], seen = {};
    arr(doc.querySelectorAll('table')).forEach(function (t) {
      var col = null;
      arr(t.querySelectorAll('tr')).forEach(function (tr) {
        if (tr.closest('table') !== t) return;
        var cells = kids(tr);
        if (!col) {
          var c = {};
          cells.forEach(function (cell, i) { var k = colKey(cellText(cell) + ' ' + (cell.getAttribute('title') || '')); if (k && c[k] == null) c[k] = i; });
          if (c.name != null && Object.keys(c).length >= 3) col = c;
          return;
        }
        var nc = cells[col.name];
        if (!nc || cells.length < 3) return;
        var a = arr(nc.querySelectorAll('a[href]')).filter(function (x) {
          return /^\/w\/[^:?#]+$/.test(x.getAttribute('href')) || /^\/w\/(?!File:|Category:|Special:)/.test(x.getAttribute('href'));
        })[0];
        var name = a ? text(a) : cellText(nc);
        if (!name) return;
        var page = a ? clean(decodeSafe(a.getAttribute('href').slice(3).split('#')[0]).replace(/_/g, ' ')) : name;
        if (seen[page]) return;
        seen[page] = 1;
        function get(k) { return col[k] == null ? '' : cellText(cells[col[k]]); }
        var mh = col.members == null ? '' : cellHints(cells[col.members]);
        var qp = parseInt(get('qp'), 10);
        var combat = get('combat').replace(/^NPC combat level\s*/i, '');
        var series = get('series');
        out.push({
          name: name,
          page: page,
          members: /free|f2p/i.test(mh) ? false : /member|p2p/i.test(mh) ? true : null,
          length: get('length'),
          age: get('age'),
          difficulty: get('difficulty'),
          combat: /^(none|n\/a|-)?$/i.test(combat) ? '' : combat,
          qp: isFinite(qp) ? qp : null,
          series: /^(n\/a|none|-)?$/i.test(series) ? '' : series,
          release: get('release')
        });
      });
    });
    return out;
  }
  function loadQuestList() {
    return fetchPage('List of quests').then(function (p) {
      var list = parseQuestList(p.html);
      if (!list.length) { var e = new Error('The wiki\'s quest list looks different than expected.'); e.code = 'format'; throw e; }
      return { version: VERSION, source: pageUrl('List of quests'), fetchedAt: new Date().toISOString(), count: list.length, list: list };
    });
  }

  // ---------- player stats (the same places the wiki's own quest checker asks) ----------
  var SYNC = 'https://sync.runescape.wiki/runescape/player/';
  var HISCORE_SKILLS = ['Overall', 'Attack', 'Defence', 'Strength', 'Constitution', 'Ranged', 'Prayer', 'Magic', 'Cooking',
    'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving',
    'Slayer', 'Farming', 'Runecrafting', 'Hunter', 'Construction', 'Summoning', 'Dungeoneering', 'Divination', 'Invention',
    'Archaeology', 'Necromancy'];
  // "Rune Mysteries" and "rune mysteries!" are the same quest.
  function normName(s) {
    return clean(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
  }
  function playerResult(name, source, quests, levels) {
    var done = 0, started = 0;
    Object.keys(quests).forEach(function (k) { if (quests[k] === 2) done++; else if (quests[k] === 1) started++; });
    return { name: name, source: source, at: new Date().toISOString(), quests: quests, levels: levels, done: done, started: started };
  }
  function fromSync(name) {
    return getJson(SYNC + encodeURIComponent(name) + '/STANDARD').then(function (r) {
      var j = r.json;
      if (!r.ok || !j || !j.quests || typeof j.quests !== 'object') {
        var e = new Error('No WikiSync data.'); e.code = (j && j.code) || 'http'; throw e;
      }
      var quests = {}, levels = {};
      Object.keys(j.quests).forEach(function (k) { var v = +j.quests[k]; quests[normName(k)] = v === 2 ? 2 : v === 1 ? 1 : 0; });
      Object.keys(j.levels || {}).forEach(function (k) { var v = +j.levels[k]; if (isFinite(v)) levels[k.toLowerCase()] = v; });
      return playerResult(name, 'WikiSync', quests, levels);
    });
  }
  function fromRuneMetrics(name) {
    var enc = encodeURIComponent(name), fails = [];
    function soft(p) { return p.then(function (r) { return r.ok ? r.json : null; }, function (e) { fails.push(e); return null; }); }
    return Promise.all([
      soft(getJson(WIKI + '/cors/m=adventurers-log/api/v1/playerQuests/' + enc)),
      soft(getJson(WIKI + '/cors/m=hiscore/index_lite.json?player=' + enc))
    ]).then(function (res) {
      var quests = {}, levels = {}, got = false;
      var ql = res[0] && res[0].quests;
      (Array.isArray(ql) ? ql : ql && typeof ql === 'object' ? Object.keys(ql).map(function (k) { return ql[k]; }) : []).forEach(function (it) {
        if (!it || !it.title) return;
        got = true;
        quests[normName(it.title)] = it.status === 'COMPLETED' ? 2 : it.status === 'STARTED' ? 1 : 0;
      });
      (res[1] && Array.isArray(res[1].skills) ? res[1].skills : []).forEach(function (it) {
        var nm = it && HISCORE_SKILLS[it.id];
        if (!nm || !isFinite(+it.level)) return;
        got = true;
        levels[nm.toLowerCase()] = +it.level;
      });
      if (!got) {
        var e = new Error('No player data.');
        e.code = fails.length === 2 ? (fails[0] && fails[0].code === 'timeout' ? 'timeout' : 'network') : 'nodata';
        throw e;
      }
      return playerResult(name, 'RuneMetrics', quests, levels);
    });
  }
  // Tries WikiSync first, then the official RuneMetrics data through the wiki.
  function loadPlayer(name) {
    name = clean(name);
    return fromSync(name).catch(function () { return fromRuneMetrics(name); });
  }

  root.QuickGuide = {
    VERSION: VERSION,
    loadQuestList: loadQuestList,
    parseQuestList: parseQuestList,
    loadPlayer: loadPlayer,
    normName: normName,
    MAP_VERSION: MAP_VERSION,
    WIKI: WIKI,
    titleFromInput: titleFromInput,
    load: load,
    parse: parse,
    pageUrl: pageUrl
  };
})(window);
