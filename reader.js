/*
 * Reads the in-game Achievements list from a picture of the screen, taken by Alt1.
 *
 * Every task row has a badge on the left: a red shield (not done), the shield
 * with a bright green tick (done), or a grey shield with a blue-green lock (locked).
 * So we:
 *   1. find blobs of red, green and lock pixels,
 *   2. keep the blobs that line up in one column at one even step (the badge column),
 *   3. call a row done when its badge holds enough green.
 *
 * The result is the rows from top to bottom. It does not read text: the
 * player picks which task is at the top, and the app counts on from there.
 *
 * Works in the browser (window.QuickGuideReader) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  // The blue-green lock on a task you cannot do yet: green and blue about equal, so light blue text does not count.
  function isLock(r, g, b) { return g >= 90 && b >= 90 && g - r >= 25 && b - r >= 25 && Math.abs(g - b) <= 15 && r <= 160; }
  function isRed(r, g, b) { return r >= 45 && r > 1.8 * g && r > 1.5 * b; }
  // Clearly greener than red and blue, so a darker or greyer screen still counts.
  function isGreen(r, g, b) { var m = r > b ? r : b; return g >= 100 && g - m >= 40 && g > 1.3 * m; }

  // Pixels: RGBA bytes, like ImageData.data.
  function blobs(px, w, h) {
    var kind = new Uint8Array(w * h); // 0 none, 1 red, 2 green
    var i, j;
    for (i = 0, j = 0; i < w * h; i++, j += 4) {
      var r = px[j], g = px[j + 1], b = px[j + 2];
      if (isRed(r, g, b)) kind[i] = 1;
      else if (isGreen(r, g, b)) kind[i] = 2;
      else if (isLock(r, g, b)) kind[i] = 3;
    }
    var seen = new Uint8Array(w * h), out = [], stack = [];
    for (i = 0; i < w * h; i++) {
      if (!kind[i] || seen[i]) continue;
      var bl = { x0: w, y0: h, x1: 0, y1: 0, red: 0, green: 0, lock: 0 };
      seen[i] = 1; stack.push(i);
      while (stack.length) {
        var p = stack.pop(), x = p % w, y = (p - x) / w;
        if (kind[p] === 1) bl.red++; else if (kind[p] === 2) bl.green++; else bl.lock++;
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

  // A tick can cut the shield into pieces. The biggest piece is the seed; smaller pieces close by join it,
  // as long as the whole stays within one and a half times the seed. A seed never grows past that, so a crowded
  // screen cannot chain up into one big blob.
  function join(list, maxSize) {
    function n(b) { return b.red + b.green + b.lock; }
    list = list.filter(function (b) { return n(b) >= 3; })
      .sort(function (a, b) { return n(b) - n(a); });
    var used = new Uint8Array(list.length), out = [];
    // Only red or green starts a badge. A lock (or light blue next to a badge) can join one, or,
    // left alone, be a locked badge.
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < list.length; i++) {
        if (used[i]) continue;
        var a = list[i];
        if (pass === 0 && a.red + a.green < 3) continue;
        used[i] = 1;
        var size = Math.max(a.w, a.h), lim = size * 1.5, pad = Math.max(3, Math.round(size * 0.5));
        var m = { x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1, red: a.red, green: a.green, lock: a.lock };
        // Far too big to be a badge (sky, scenery), or a lone lock: it takes no pieces.
        if (size > maxSize || pass === 1) { m.w = a.w; m.h = a.h; out.push(m); continue; }
        for (var j = i + 1; j < list.length; j++) {
          if (used[j]) continue;
          var b = list[j];
          if (Math.max(b.w, b.h) > size) continue;
          if (m.x0 - pad > b.x1 || b.x0 - pad > m.x1 || m.y0 - pad > b.y1 || b.y0 - pad > m.y1) continue;
          var x0 = Math.min(m.x0, b.x0), y0 = Math.min(m.y0, b.y0), x1 = Math.max(m.x1, b.x1), y1 = Math.max(m.y1, b.y1);
          if (x1 - x0 + 1 > lim || y1 - y0 + 1 > lim) continue;
          m.x0 = x0; m.y0 = y0; m.x1 = x1; m.y1 = y1; m.red += b.red; m.green += b.green; m.lock += b.lock;
          used[j] = 1;
        }
        m.w = m.x1 - m.x0 + 1; m.h = m.y1 - m.y0 + 1;
        out.push(m);
      }
    }
    return out;
  }


  // Red, green and lock pixels in a box.
  function count(px, w, h, x0, y0, x1, y1) {
    var c = { red: 0, green: 0, lock: 0 };
    for (var y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
      for (var x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
        var j = (y * w + x) * 4, r = px[j], g = px[j + 1], bl = px[j + 2];
        if (isRed(r, g, bl)) c.red++; else if (isGreen(r, g, bl)) c.green++; else if (isLock(r, g, bl)) c.lock++;
      }
    }
    return c;
  }
  function colour(b) { return b.red >= 10 || b.green >= 14; }
  function score(g) { var c = g.filter(colour).length; return c ? c * 1000 + g.length : 0; }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s.length ? s[s.length >> 1] : 0;
  }

  // The space from one row to the next: the middle gap between whole rows. 0 when there are fewer than 2.
  function pitch(rows) {
    var ys = rows.filter(function (r) { return !r.partial; }).map(function (r) { return r.y; }), d = [];
    for (var i = 1; i < ys.length; i++) d.push(ys[i] - ys[i - 1]);
    return d.length ? step(d, 1) : 0;
  }

  // The real list: badges of about the same size, one under the other at an even step.
  // Something that only happens to sit in the same column (far above, or much bigger) is dropped.
  function tidy(list) {
    // Rows are measured at their bottom edge: the top of a shield can be faint, the bottom is steady.
    list = list.slice().sort(function (a, b) { return a.y1 - b.y1; });
    // Two pieces of one badge that did not join (a pale screen): in the same column, overlapping rows are one row.
    var rows = [];
    list.forEach(function (b) {
      var a = rows[rows.length - 1];
      if (a && b.y0 <= a.y1 && b.y1 - Math.min(a.y0, b.y0) <= Math.max(a.h, b.h) * 1.5) {
        var m = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
          red: a.red + b.red, green: a.green + b.green, lock: a.lock + b.lock };
        m.w = m.x1 - m.x0 + 1; m.h = m.y1 - m.y0 + 1;
        rows[rows.length - 1] = m;
      } else rows.push(b);
    });
    list = rows;
    var mh = median(list.map(function (b) { return b.h; })), mw = median(list.map(function (b) { return b.w; }));
    list = list.filter(function (b) { return b.h <= mh * 1.6 && b.w <= mw * 1.6; });
    if (list.length < 4) return [];
    var gaps = [];
    for (var i = 1; i < list.length; i++) gaps.push(list[i].y1 - list[i - 1].y1);
    var p = step(gaps, mh), best = [list[0]], run = [list[0]];
    if (!p) return [];
    for (i = 1; i < list.length; i++) {
      // Rows follow each other at one step. A row we could not see (a lock in poor light) leaves a gap of two or three steps.
      var g = gaps[i - 1], k = Math.round(g / p);
      var ok = k >= 1 && k <= 3 && Math.abs(g - k * p) <= p * 0.1 * k;
      if (ok) run.push(list[i]); else run = [list[i]];
      if (run.length > best.length) best = run.slice();
    }
    // The list always shows at least 4 rows; fewer is more likely chance.
    return best.length >= 4 ? best : [];
  }
  // The step from one row to the next: the gap that fits the most gaps (as 1, 2 or 3 steps: rows can be missing,
  // and a row cut off at the edge is closer). Ties go to the smaller one.
  function step(gaps, mh) {
    var g = gaps.filter(function (x) { return x >= mh; }), best = 0, bestN = 0;
    g.forEach(function (c) {
      var n = g.filter(function (x) { var k = Math.round(x / c); return k >= 1 && k <= 3 && Math.abs(x - k * c) <= c * 0.1 * k; }).length;
      if (n > bestN || n === bestN && c < best) { best = c; bestN = n; }
    });
    if (!best) return 0;
    return median(g.filter(function (x) { return Math.abs(x - best) <= best * 0.1; }));
  }


  /*
   * read(pixels, width, height) -> { found, rows: [{ y, done, partial }] }
   * partial: the badge is cut off (scrolled half out of view), so its state
   * is not trusted.
   */
  function read(px, w, h) {
    var all = join(blobs(px, w, h), h / 5).filter(function (b) {
      var aspect = b.w / b.h, fill = (b.red + b.green + b.lock) / (b.w * b.h);
      // A badge is a shield with an outline, a letter and laurels: only part of its box is red or green.
      // A solid red or green shape is something else.
      return (b.red >= 10 || b.green >= 14 || b.lock >= 14) && aspect > 0.6 && aspect < 3 && b.h < h / 5 &&
        fill >= 0.15 && fill <= 0.7;
    });
    // Group blobs whose centres share a column.
    var best = [];
    all.forEach(function (a) {
      var cx = a.x0 + a.w / 2;
      var grp = all.filter(function (b) {
        return Math.abs(b.x0 + b.w / 2 - cx) <= Math.max(a.w, b.w) * 0.15 + 1 &&
          b.w > a.w * 0.7 && b.w < a.w * 1.4;
      });
      // The list with the most red and green badges wins; a column of only locks or text is not it.
      if (score(grp) > score(best)) best = grp;
    });
    best = tidy(best);
    if (best.length < 2 || !best.some(colour)) return { found: false, rows: [] };
    var mh = median(best.map(function (b) { return b.h; }));
    var mw = median(best.map(function (b) { return b.w; }));
    var last = best.length - 1;
    var cx0 = median(best.map(function (b) { return b.x0; })), cx1 = median(best.map(function (b) { return b.x1; }));
    var rows = best.map(function (b, i) {
      // Only the top or bottom row can be scrolled half out of view. (A red badge is a little smaller than one
      // with a tick, so only a badge less than half the usual size counts as cut off.)
      var edge = i === 0 || i === last;
      var partial = b.y0 <= 0 || b.y1 >= h - 1 || (edge && (b.h < mh * 0.5 || b.w < mw * 0.5));
      // Done or not is counted in a badge-sized box on the row, at the column's place: not in the blob,
      // which may have taken in something next to the badge.
      var c = count(px, w, h, cx0, Math.max(0, b.y1 - mh + 1), cx1, b.y1), all = c.red + c.green + c.lock || 1;
      return {
        y: b.y1, h: b.h,
        // The text next to the badge (bright pixels only): the same row looks the same after a scroll,
        // whatever shows through the window behind it.
        done: c.green / all >= 0.08,
        locked: c.lock > c.green && c.lock >= all * 0.3,
        partial: partial
      };
    });
    // At least 4 whole rows: a few shapes that only happen to line up are not a list.
    if (rows.filter(function (r) { return !r.partial; }).length < 4) return { found: false, rows: [] };
    var x0 = Math.min.apply(null, best.map(function (b) { return b.x0; }));
    var x1 = Math.max.apply(null, best.map(function (b) { return b.x1; }));
    // The text next to each badge (bright pixels only), as a fingerprint: the same row looks the same after a scroll,
    // whatever shows through the window behind it. It is taken on the even grid of the rows, not at each badge's own
    // edge: that edge moves a few pixels from look to look (and a red badge ends a bit higher than one with a tick).
    // It starts at the top of the first line of text, found near the badge, so it does not move when the badge's
    // edge moves a few pixels from look to look (or when a red badge ends a bit higher than one with a tick).
    var p = pitch(rows);
    rows.forEach(function (r) {
      if (r.partial) return;
      r.fp = textPrint(px, w, h, cx1 + Math.round((cx1 - cx0) * 0.4), r.y - mh - 6, cx1 + (cx1 - cx0 + 1) * 14, r.y + 6, mh + 2);
    });
    // How much red the badges have: every real badge has a red shield, so this tells if red and blue came the right
    // way round (the other way, the shields are blue and only the green ticks are found).
    var red = best.reduce(function (a, b) { return a + b.red; }, 0);
    return { found: true, rows: rows, x0: x0, x1: x1, pitch: p, red: red };
  }

  // Alt1 hands pixels over as base64 BGRA. Turn that into RGBA.
  // Into out (from byte at) when given, else into a new array.
  function fromBgraBase64(str, w, h, out, at) {
    var bin = atob(str), n = w * h * 4;
    out = out || new Uint8ClampedArray(n); at = at || 0;
    for (var i = 0; i < n; i += 4) {
      out[at + i] = bin.charCodeAt(i + 2);
      out[at + i + 1] = bin.charCodeAt(i + 1);
      out[at + i + 2] = bin.charCodeAt(i);
      out[at + i + 3] = 255;
    }
    return out;
  }

  // ---------- the tier list on the left ----------
  // The tier you picked in the game has a gold box around it. The rows of the list are boxes of one height
  // with a dark gap between them. Each row's name is kept as a fingerprint of its text (bright pixels only,
  // so what shows through the window does not matter), so the app can tell the rows apart.
  function isGold(r, g, b) { return r >= 170 && g >= 140 && b <= 175 && r - b >= 55 && r >= g && g - b >= 30; }
  function lum(px, w, x, y) { var j = (y * w + x) * 4; return (px[j] + px[j + 1] + px[j + 2]) / 3; }
  // Brightness of 3 pixels side by side: steadier than one.
  function lum3(px, w, x, y) { return (lum(px, w, x, y) + lum(px, w, x + 1, y) + lum(px, w, x + 2, y)) / 3; }

  function panel(px, w, h, maxX) {
    maxX = Math.min(w, maxX || w);
    // Long gold lines: the top and bottom of the box.
    var runs = [];
    for (var y = 0; y < h; y++) {
      var x0 = -1;
      for (var x = 0; x <= maxX; x++) {
        var j = (y * w + x) * 4, on = x < maxX && isGold(px[j], px[j + 1], px[j + 2]);
        if (on && x0 < 0) x0 = x;
        if (!on && x0 >= 0) { if (x - x0 >= 40) runs.push({ y: y, x0: x0, x1: x - 1 }); x0 = -1; }
      }
    }
    var box = null;
    runs.forEach(function (a) {
      runs.forEach(function (b) {
        var d = b.y - a.y;
        if (d < 18 || d > 90 || Math.abs(a.x0 - b.x0) > 3 || Math.abs(a.x1 - b.x1) > 3) return;
        if (a.x1 - a.x0 < d * 2) return;
        // The nearest one to the list (rightmost), and the tightest pair.
        if (!box || a.x1 > box.x1 + 3 || (Math.abs(a.x1 - box.x1) <= 3 && d < box.y1 - box.y0)) box = { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: a.y, y1: b.y };
      });
    });
    if (!box) return null;
    var bh = box.y1 - box.y0 + 1, bw = box.x1 - box.x0 + 1;
    // The rows: runs down a line just inside the box's left edge, lighter than the gaps between them.
    var cx = box.x0 + 1, gapLum = Infinity, rowLum = lum3(px, w, cx, Math.round((box.y0 + box.y1) / 2));
    // The gap is the darkest thing right under the box.
    for (var gy = box.y1 + 1; gy < Math.min(h, box.y1 + bh); gy++) gapLum = Math.min(gapLum, lum3(px, w, cx, gy));
    var cut = (gapLum + Math.min(rowLum, lum3(px, w, cx, Math.min(h - 1, box.y1 + bh)))) / 2;
    if (!(cut > gapLum + 3)) return null;
    var rows = [], tall = [], top = -1;
    for (var yy = 0; yy <= h; yy++) {
      var light = yy < h && lum3(px, w, cx, yy) > cut;
      if (light && top < 0) top = yy;
      if (!light && top >= 0) {
        var hh = yy - top;
        if (Math.abs(hh - bh) <= 4) rows.push({ top: top, bottom: yy - 1 });
        // A title is about one and a half rows tall (two rows run together are more than two).
        else if (hh >= bh * 1.3 && hh <= bh * 1.8) tall.push({ top: top, bottom: yy - 1 });
        top = -1;
      }
    }
    if (!rows.length) return null;
    // Which row the box is on.
    var sel = -1;
    rows.forEach(function (r, i) { if (r.top <= box.y1 && r.bottom >= box.y0) sel = i; });
    if (sel < 0) return null;
    // Each row's place, in steps from the picked one (rows of another kind in between keep their place apart).
    var steps = [];
    for (var i = 1; i < rows.length; i++) steps.push(rows[i].top - rows[i - 1].top);
    var p = (steps.length && step(steps, bh)) || bh + 6;
    rows.forEach(function (r) {
      r.at = Math.round((r.top - rows[sel].top) / p);
      // The name only (the left 60%), not the count on the right.
      r.sig = textPrint(px, w, h, box.x0 + 3, r.top + 2, box.x0 + Math.round(bw * 0.6), r.top + bh - 3);
    });
    // The titles around the tiers. "Area Tasks" (a taller box with a green icon) sits right above Easy Ardougne;
    // the next title (no green icon) sits right below the last tier. head: the place of the row under "Area Tasks",
    // tail: the place of the row above the next title (each only when seen, and on the right side of the gold box).
    var gap = p - bh + 5, head = null, tail = null;
    tall.forEach(function (t) {
      var green = 0;
      for (var y = t.top; y <= t.bottom; y++) {
        for (var x = box.x0; x < Math.min(w, box.x0 + bh * 2); x++) { var j = (y * w + x) * 4; if (isGreen(px[j], px[j + 1], px[j + 2])) green++; }
      }
      rows.forEach(function (r) {
        if (green >= 15 && r.top > t.bottom && r.top - t.bottom <= gap && r.at <= 0) head = r.at;
        if (green < 15 && t.top > r.bottom && t.top - r.bottom <= gap && r.at >= 0) tail = r.at;
      });
    });
    return { box: box, rows: rows, sel: sel, head: head, tail: tail };
  }
  // The text pixels of a box (bright ones), as a mask: { w, h, m }. With tall: the mask starts at the first line
  // of the box that has text in it, and is that many lines tall.
  function textPrint(px, w, h, x0, y0, x1, y1, tall) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
    var mw = x1 - x0 + 1, mh = y1 - y0 + 1;
    if (mw < 10 || mh < 6) return null;
    var m = new Uint8Array(mw * mh);
    for (var y = 0; y < mh; y++) for (var x = 0; x < mw; x++) m[y * mw + x] = lum(px, w, x0 + x, y0 + y) > 110 ? 1 : 0;
    if (!tall) return { w: mw, h: mh, m: m };
    var need = Math.max(3, Math.round(mw * 0.02)), top = -1;
    for (var yy = 0; yy < mh && top < 0; yy++) {
      var on = 0;
      for (var xx = 0; xx < mw; xx++) on += m[yy * mw + xx];
      if (on >= need) top = yy;
    }
    if (top < 0) return null;
    var th = Math.min(tall, mh - top), out = new Uint8Array(mw * tall);
    out.set(m.subarray(top * mw, (top + th) * mw));
    return { w: mw, h: tall, m: out };
  }
  // How different two text masks are: 0 is the same, 1 is nothing alike. A shift of 1 pixel sideways and up to 3 up or down
  // is allowed (the edge of a badge can move a little from one look to the next).
  function textDiffer(a, b) {
    if (!a || !b) return 1;
    var w = Math.min(a.w, b.w), h = Math.min(a.h, b.h), best = 1;
    // No shift first: when that is already a clear match, the other 8 are not needed.
    var shifts = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-1, -2], [1, -2], [-1, 2], [1, 2], [0, -3], [0, 3]];
    for (var s = 0; s < shifts.length; s++) {
      var dx = shifts[s][0], dy = shifts[s][1];
      {
        var both = 0, any = 0;
        for (var y = 1; y < h - 1; y++) {
          for (var x = 1; x < w - 1; x++) {
            var p = a.m[y * a.w + x], q = b.m[(y + dy) * b.w + x + dx];
            if (p || q) { any++; if (p && q) both++; }
          }
        }
        var d = any ? 1 - both / any : 0;
        if (d < best) best = d;
        if (best < 0.05) return best;
      }
    }
    return best;
  }

  // ---------- the list's scrollbar ----------
  // A light handle in a dark track, right of the rows. atTop: the handle touches the top of the track (or there is
  // no scrollbar: the whole list fits). Searched between x0 and x1, and y0 and y1 (the height of the rows).
  function isThumb(r, g, b) { return r > 150 && g > 120 && r > b + 40; }
  // The handle sits in a dark track: at least 5 dark pixels right above it or right below it (a border does not).
  function darkBy(px, w, h, x, top, bot) {
    function dark(a, b) { var n = 0; for (var y = a; y <= b; y++) { if (y >= 0 && y < h && lum(px, w, x, y) < 45) n++; } return n >= 4; }
    return dark(top - 8, top - 4) || dark(bot + 3, bot + 7);
  }
  function scrollbar(px, w, h, x0, x1, y0, y1) {
    x0 = Math.max(0, x0); x1 = Math.min(w - 1, x1); y0 = Math.max(0, y0 || 0); y1 = Math.min(h - 1, y1 == null ? h - 1 : y1);
    var best = null, span = y1 - y0 + 1;
    for (var x = x0; x <= x1; x++) {
      // A run of handle pixels, with gaps of up to 2 pixels bridged (a noisy picture breaks it up).
      var start = -1, last = -1;
      for (var y = y0; y <= y1 + 3; y++) {
        var j = (y * w + x) * 4, on = y <= y1 && isThumb(px[j], px[j + 1], px[j + 2]);
        if (on) { if (start < 0) start = y; last = y; continue; }
        if (start >= 0 && y - last > 2) {
          var run = last - start + 1;
          // Not one that runs the whole height: that is the window's border, not the handle.
          if (run >= 20 && run < span - 6 && (!best || run > best.len) && darkBy(px, w, h, x, start, last)) best = { x: x, top: start, len: run };
          start = -1;
        }
      }
    }
    if (!best) return { atTop: true, found: false };
    // The track: dark above and below the handle, up to the arrows.
    // (The handle's soft edge is skipped: 3 pixels.)
    var up = best.top - 3, down = best.top + best.len + 2;
    while (up > 0 && lum(px, w, best.x, up) < 45) up--;
    while (down < h - 1 && lum(px, w, best.x, down) < 45) down++;
    var above = Math.max(0, best.top - up - 3), below = Math.max(0, down - (best.top + best.len) - 2);
    return { found: true, x: best.x, top: best.top, len: best.len, above: above, below: below, atTop: above <= 3, atBottom: below <= 3, frac: above + below ? above / (above + below) : 0 };
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
    // Newer Alt1: alt1.capture hands over the pixels as bytes (RGBA, the way the alt1 library reads them).
    if (typeof a.capture === 'function') {
      try {
        var buf = a.capture(x, y, w, h);
        if (buf && (buf.length || buf.byteLength) === w * h * 4) return { px: buf instanceof Uint8ClampedArray ? buf : new Uint8ClampedArray(buf.buffer || buf), w: w, h: h, x: x, y: y };
      } catch (e) { /* fall back to getRegion */ }
    }
    // Older Alt1: getRegion hands over base64 BGRA, at most about 4 MB at a time, so a big screen comes in strips.
    var out = new Uint8ClampedArray(w * h * 4), band = Math.max(1, Math.floor(MAX_TRANSFER / (w * 4)));
    for (var top = 0; top < h; top += band) {
      var bh = Math.min(band, h - top), str = a.getRegion(x, y + top, w, bh);
      if (!str) return null;
      fromBgraBase64(str, w, bh, out, top * w * 4);
    }
    return { px: out, w: w, h: h, x: x, y: y };
  }
  var MAX_TRANSFER = 4000000;

  // Swaps red and blue, in place. Some Alt1 versions hand over the colours the other way round;
  // the app tries both and keeps the one that finds the list.
  function swapRB(px) {
    for (var i = 0; i < px.length; i += 4) { var t = px[i]; px[i] = px[i + 2]; px[i + 2] = t; }
    return px;
  }

  var api = { read: read, panel: panel, scrollbar: scrollbar, textPrint: textPrint, textDiffer: textDiffer, capture: capture, fromBgraBase64: fromBgraBase64, swapRB: swapRB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuickGuideReader = api;
})(typeof window !== 'undefined' ? window : this);
