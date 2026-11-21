/*!
 * Quick Guide - js/wiki/steps.js
 * The parts of a guide: chat options, tables, text, "bring" boxes, and steps with their sub-steps.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var MARK = W.MARK, arr = W.arr, cap = W.cap, clean = W.clean, docOf = W.docOf, kids = W.kids, plainOf = W.plainOf,
    text = W.text, inline = W.inline, inlineOne = W.inlineOne, mapOf = W.mapOf, takeImages = W.takeImages,
    tidy = W.tidy;

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

  // The levels of an achievement page's requirements (Master Skiller: every skill at its mastery level): [{ skill, level }]
  function skillReqs(html) {
    var root = docOf(html), box = root.querySelector('.infobox') || root, seen = {};
    return arr(box.querySelectorAll('.skillreq[data-skill]')).map(function (s) {
      return { skill: s.getAttribute('data-skill'), level: +s.getAttribute('data-level') || 0 };
    }).filter(function (x) { if (!x.level || seen[x.skill]) return false; seen[x.skill] = 1; return true; });
  }

  W.share({ bringOf: bringOf, isItalicOnly: isItalicOnly, listItems: listItems, parseStep: parseStep, parseTable: parseTable, skillReqs: skillReqs, textBlock: textBlock });
  W.publish({ skillReqs: skillReqs });
  W.loaded.steps = true;
})(window.QuickGuideWiki);
