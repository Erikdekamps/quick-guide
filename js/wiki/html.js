/*!
 * Quick Guide - js/wiki/html.js
 * The wiki's HTML made small and safe: only a few tags survive (inline), tidy text, and the maps and pictures of a page.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var BLOCK_RE = W.BLOCK_RE, CUR = W.CUR, DROP_RE = W.DROP_RE, FAIRY_RE = W.FAIRY_RE, absUrl = W.absUrl, arr = W.arr,
    clean = W.clean, esc = W.esc, pageUrl = W.pageUrl, plainOf = W.plainOf, scratch = W.scratch, text = W.text;

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
        if (!plainOf(inner) && inner.indexOf('<img') < 0) return '';   // nothing to read or see in it
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

  // Takes the line breaks off both ends of a bit of HTML, until none is left there (in one pass, taking some out could
  // leave others behind).
  function trimBreaks(s) {
    var prev;
    do { prev = s; s = s.replace(/^\s*<br>|<br>\s*$/g, ''); } while (s !== prev);
    return s;
  }
  // Changes the words of a piece of the app's own HTML, and leaves its tags alone: a link to a page called "WARNING"
  // or "Foo ()" keeps its address. fn(words, the tag right before them) gives the new words.
  function onWords(html, fn) {
    return html.split(/(<[^>]*>)/).map(function (bit, i, all) { return i % 2 ? bit : fn(bit, all[i - 1] || ''); }).join('');
  }
  var CAUTION_OPEN = '<span class="caution">';
  // Tidy spacing and punctuation left behind after pulling bits out.
  function tidy(html) {
    var s = trimBreaks(String(html || '')
      .replace(/\s*\[UK\]\s*/g, ' (UK) / ').replace(/\s*\[US\]/g, ' (US)')
      .replace(/[ \t\r\n\u00a0]+/g, ' ')
      .replace(/(?:\s*<br>\s*){2,}/g, '<br>'));
    s = onWords(s, function (w) { return w.replace(/\(\s*\)/g, ''); })
      .replace(/\s+([.,;:!?])(?=\s|$|<)/g, '$1')
      .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
      .replace(/^[,;]\s*/, '');
    // (text that is tidied twice is marked once)
    s = onWords(s, function (w, tag) {
      return tag === CAUTION_OPEN ? w : w.replace(/\b(CAUTION|WARNING|IMPORTANT)\b:?/g, CAUTION_OPEN + '$&</span>');
    }).trim();
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
    var groups, features = [];
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
    var st = /maps\.runescape\.wiki\/rs\/versions\/([^/"')\s&]+)\//.exec(a.getAttribute('style') || '');
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

  W.share({ inline: inline, inlineOne: inlineOne, isHidden: isHidden, mapOf: mapOf, takeImages: takeImages, tidy: tidy });
  W.publish({ trimBreaks: trimBreaks });
  W.loaded.html = true;
})(window.QuickGuideWiki);
