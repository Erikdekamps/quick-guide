/*
 * Reads the in-game Achievements list from a picture of the screen.
 *
 * Every task row has a red shield badge on the left. A done task has a
 * bright green tick painted over the shield. So we:
 *   1. find blobs of red (shield) and green (tick) pixels,
 *   2. keep the blobs that line up in one column (the badge column),
 *   3. call a row done when its badge holds enough green.
 *
 * The result is the rows from top to bottom. It does not read text: the
 * app knows which task is at the top because it tells the player.
 *
 * Works in the browser (window.QuickGuideReader) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  function isRed(r, g, b) { return r >= 60 && r > 1.8 * g && r > 1.5 * b; }
  function isGreen(r, g, b) { return g >= 150 && g > 1.5 * r && g > 1.3 * b; }

  // Pixels: RGBA bytes, like ImageData.data.
  function blobs(px, w, h) {
    var kind = new Uint8Array(w * h); // 0 none, 1 red, 2 green
    var i, j;
    for (i = 0, j = 0; i < w * h; i++, j += 4) {
      var r = px[j], g = px[j + 1], b = px[j + 2];
      if (isRed(r, g, b)) kind[i] = 1;
      else if (isGreen(r, g, b)) kind[i] = 2;
    }
    var seen = new Uint8Array(w * h), out = [], stack = [];
    for (i = 0; i < w * h; i++) {
      if (!kind[i] || seen[i]) continue;
      var bl = { x0: w, y0: h, x1: 0, y1: 0, red: 0, green: 0 };
      seen[i] = 1; stack.push(i);
      while (stack.length) {
        var p = stack.pop(), x = p % w, y = (p - x) / w;
        if (kind[p] === 1) bl.red++; else bl.green++;
        if (x < bl.x0) bl.x0 = x; if (x > bl.x1) bl.x1 = x;
        if (y < bl.y0) bl.y0 = y; if (y > bl.y1) bl.y1 = y;
        // 8 neighbours, with a 1 pixel gap allowed so thin outlines don't split a badge.
        for (var dy = -2; dy <= 2; dy++) {
          var ny = y + dy; if (ny < 0 || ny >= h) continue;
          for (var dx = -2; dx <= 2; dx++) {
            var nx = x + dx; if (nx < 0 || nx >= w) continue;
            var q = ny * w + nx;
            if (kind[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
          }
        }
      }
      bl.w = bl.x1 - bl.x0 + 1; bl.h = bl.y1 - bl.y0 + 1;
      out.push(bl);
    }
    return out;
  }

  // A tick can cut the shield into pieces. Join pieces that sit close together.
  function join(list) {
    list = list.filter(function (b) { return b.red + b.green >= 3; });
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < list.length && !changed; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i], b = list[j];
          var pad = Math.max(3, Math.round(Math.max(a.w, a.h, b.w, b.h) * 0.25));
          if (a.x0 - pad > b.x1 || b.x0 - pad > a.x1 || a.y0 - pad > b.y1 || b.y0 - pad > a.y1) continue;
          a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
          a.red += b.red; a.green += b.green;
          a.w = a.x1 - a.x0 + 1; a.h = a.y1 - a.y0 + 1;
          list.splice(j, 1); changed = true; break;
        }
      }
    }
    return list;
  }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s.length ? s[s.length >> 1] : 0;
  }

  // The space from one row to the next: the middle gap between whole rows. 0 when there are fewer than 2.
  function pitch(rows) {
    var ys = rows.filter(function (r) { return !r.partial; }).map(function (r) { return r.y; }), d = [];
    for (var i = 1; i < ys.length; i++) d.push(ys[i] - ys[i - 1]);
    return d.length ? median(d) : 0;
  }

  /*
   * read(pixels, width, height) -> { found, rows: [{ y, done, partial }] }
   * partial: the badge is cut off (scrolled half out of view), so its state
   * is not trusted.
   */
  function read(px, w, h) {
    var all = join(blobs(px, w, h)).filter(function (b) {
      var aspect = b.w / b.h;
      return (b.red >= 10 || b.green >= 14) && aspect > 0.4 && aspect < 2.5;
    });
    // Group blobs whose centres share a column.
    var best = [];
    all.forEach(function (a) {
      var cx = a.x0 + a.w / 2;
      var grp = all.filter(function (b) {
        return Math.abs(b.x0 + b.w / 2 - cx) <= Math.max(a.w, b.w) * 0.35 &&
          b.w > a.w * 0.6 && b.w < a.w * 1.6;
      });
      if (grp.length > best.length) best = grp;
    });
    if (best.length < 2) return { found: false, rows: [] };
    var mh = median(best.map(function (b) { return b.h; }));
    var mw = median(best.map(function (b) { return b.w; }));
    var last = best.length - 1;
    var rows = best.sort(function (a, b) { return a.y0 - b.y0; }).map(function (b, i) {
      // Only the top or bottom row can be scrolled half out of view.
      var edge = i === 0 || i === last;
      var partial = b.y0 <= 0 || b.y1 >= h - 1 || (edge && (b.h < mh * 0.7 || b.w < mw * 0.7));
      return {
        y: b.y0, h: b.h,
        done: b.green / (b.red + b.green) >= 0.08,
        partial: partial
      };
    });
    var x0 = Math.min.apply(null, best.map(function (b) { return b.x0; }));
    var x1 = Math.max.apply(null, best.map(function (b) { return b.x1; }));
    return { found: true, rows: rows, x0: x0, x1: x1, pitch: pitch(rows) };
  }

  // Alt1 hands pixels over as base64 BGRA. Turn that into RGBA.
  function fromBgraBase64(str, w, h) {
    var bin = atob(str), out = new Uint8ClampedArray(w * h * 4);
    for (var i = 0; i < w * h * 4; i += 4) {
      out[i] = bin.charCodeAt(i + 2);
      out[i + 1] = bin.charCodeAt(i + 1);
      out[i + 2] = bin.charCodeAt(i);
      out[i + 3] = 255;
    }
    return out;
  }

  // Grab the game screen (or part of it: { x, y, w, h }) through Alt1. Returns null outside Alt1.
  function capture(rect) {
    var a = root.alt1;
    if (!a || !a.permissionPixel || !a.rsLinked) return null;
    var W = a.rsWidth, H = a.rsHeight;
    if (!W || !H) return null;
    var x = 0, y = 0, w = W, h = H;
    if (rect) {
      x = Math.max(0, Math.min(W - 1, rect.x | 0)); y = Math.max(0, Math.min(H - 1, rect.y | 0));
      w = Math.max(1, Math.min(W - x, rect.w | 0)); h = Math.max(1, Math.min(H - y, rect.h | 0));
    }
    if (typeof a.capture === 'function') {
      try {
        var buf = a.capture(x, y, w, h);
        if (buf && buf.length === w * h * 4) {
          var px = new Uint8ClampedArray(buf); // BGRA too
          for (var i = 0; i < px.length; i += 4) { var t = px[i]; px[i] = px[i + 2]; px[i + 2] = t; px[i + 3] = 255; }
          return { px: px, w: w, h: h, x: x, y: y };
        }
      } catch (e) { /* fall back to getRegion */ }
    }
    var s = a.getRegion(x, y, w, h);
    if (!s) return null;
    return { px: fromBgraBase64(s, w, h), w: w, h: h, x: x, y: y };
  }

  var api = { read: read, capture: capture, fromBgraBase64: fromBgraBase64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuickGuideReader = api;
})(typeof window !== 'undefined' ? window : this);
