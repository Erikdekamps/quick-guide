/*
 * Reads the in-game Achievements list from a picture of the screen, taken by Alt1.
 *
 * Every task row is a box of one flat colour with a thin dark line under it. In it: a badge (each area has its
 * own), a small gold icon (a pin, or a star when the task is done) and the title (gold when the task is done).
 * So we:
 *   1. find the boxes by their edges: boxes of one size, one under the other, each with the gold icon,
 *   2. call a row done when its title is gold, locked when its badge has the blue-green lock.
 * That works in every area. On a blurry picture (the game drawn at another size) the edges are soft; then the old
 * way is tried too: blobs of red, green and lock pixels that line up in a column (only areas with red badges).
 *
 * The result is the rows from top to bottom. It does not read text: the app works out which task is at the top
 * from the list's scrollbar, and counts on from there.
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
    // A badge that came out clearly taller than the others took in something below it: its place is its top plus
    // the usual height, not its bottom.
    list.forEach(function (b) { b.yb = b.h > mh * 1.25 ? b.y0 + Math.round(mh) - 1 : b.y1; });
    list.sort(function (a, b) { return a.yb - b.yb; });
    var gaps = [];
    for (var i = 1; i < list.length; i++) gaps.push(list[i].yb - list[i - 1].yb);
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


  // ---------- the task rows, found by their boxes ----------
  // Every task is a box of one flat colour, with a thin dark line between it and the next: the same in every area,
  // whatever its badge looks like (a red shield in Ardougne, a blue one in Falador, a palm in Karamja…). In the box:
  // the badge on the left, then a small gold icon (a pin, or a star when the task is done), then the title, which
  // is gold when the task is done. A locked task has a blue-green lock over its badge.
  // The gold of the pin, the star and a done task's title.
  function isMark(r, g, b) { return r >= 150 && g >= 110 && r - b >= 50 && r >= g; }
  function countIf(px, w, h, x0, y0, x1, y1, is) {
    var n = 0;
    for (var y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
      for (var x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) { var j = (y * w + x) * 4; if (is(px[j], px[j + 1], px[j + 2])) n++; }
    }
    return n;
  }
  // The rows as the old way gives them ({ found, rows, x0, x1, pitch, red }), or null when no such list is in view
  // (a blurry picture: then the badges' colours are tried).
  var lumBuf = null, sumBuf = null;
  // The top and bottom edges of every box in the picture, and how light each pixel is. (On its own, with nothing
  // but these loops in it: the browser keeps such a function fast, where a long one with more in it gets slow
  // every few looks.)
  function boxEdges(px, w, h) {
    // (The same two buffers are used for every look of one size: making new big ones each time is slow.)
    if (!lumBuf || lumBuf.length !== w * h) { lumBuf = new Uint8Array(w * h); sumBuf = new Uint16Array(w * h); }
    var L = lumBuf, S = sumBuf, n = w * h, i = 0, j = 0;
    S[n - 1] = S[n - 2] = S[n - 3] = 0;
    for (i = 0, j = 0; i < n; i++, j += 4) L[i] = ((px[j] + px[j + 1] + px[j + 2]) * 21846) >> 16;
    // Four pixels side by side, added up: a picture with some noise in it (a see-through window) still has clean edges.
    for (i = 0; i + 3 < n; i++) S[i] = L[i] + L[i + 1] + L[i + 2] + L[i + 3];
    // The top and bottom edges of boxes: long level lines where a dark line turns lighter (a top) or the other way
    // round (a bottom). (Four pixels wide, a run starts 2 pixels before the box and ends 1 before its end.)
    var WMIN = 160, tops = [], bots = [], last = w - 3;
    for (var y = 1; y < h; y++) {
      var o = y * w, ts = -1, tl = -1, bs = -1, bl = -1;
      for (var x = 0; x < last; x++) {
        var a = S[o - w + x], b = S[o + x];
        if (b - a >= 32 && a < 240) { if (ts < 0) ts = x; tl = x; } else if (ts >= 0 && x - tl > 2) { if (tl - ts + 1 >= WMIN) tops.push({ y: y, xa: ts + 2, xb: tl + 1 }); ts = -1; }
        if (a - b >= 32 && b < 240) { if (bs < 0) bs = x; bl = x; } else if (bs >= 0 && x - bl > 2) { if (bl - bs + 1 >= WMIN) bots.push({ y: y, xa: bs + 2, xb: bl + 1 }); bs = -1; }
      }
      if (ts >= 0 && tl - ts + 1 >= WMIN) tops.push({ y: y, xa: ts + 2, xb: tl + 1 });
      if (bs >= 0 && bl - bs + 1 >= WMIN) bots.push({ y: y, xa: bs + 2, xb: bl + 1 });
    }
    return { L: L, tops: tops, bots: bots };
  }
  function boxList(px, w, h) {
    if (w < 8 || h < 8) return null;
    var edges = boxEdges(px, w, h), L = edges.L, tops = edges.tops, bots = edges.bots;
    function sameX(p, q) { return Math.abs(p.xa - q.xa) <= 3 && Math.abs(p.xb - q.xb) <= 3; }
    // A box: a top with the first bottom under it that is as wide. (A box cut off by the edge of the picture ends there.)
    var boxes = tops.map(function (t) {
      var end = null;
      bots.forEach(function (q) { if (q.y > t.y + 4 && sameX(q, t) && (!end || q.y < end.y)) end = q; });
      return { top: t.y, bot: end ? end.y - 1 : h - 1, xa: t.xa, xb: t.xb, H: (end ? end.y : h) - t.y };
    });
    // The lists: boxes of one size, one under the other. The one with the most rows that has the gold icons wins.
    var best = null, seenKey = {};
    boxes.forEach(function (seed) {
      if (seed.H < 30 || seed.H > h / 4) return;
      var tol = Math.max(1, Math.round(seed.H * 0.03));
      var grp = boxes.filter(function (q) { return sameX(q, seed) && Math.abs(q.H - seed.H) <= tol; }).sort(function (p, q) { return p.top - q.top; });
      if (grp.length < 3 || (best && grp.length <= best.rows.length)) return;
      var key = grp.map(function (q) { return q.top; }).join(',') + '@' + grp[0].xa;
      if (seenKey[key]) return;
      seenKey[key] = 1;
      var H = median(grp.map(function (q) { return q.H; })), sc = H / 60, d = [];
      for (var k = 1; k < grp.length; k++) d.push(grp[k].top - grp[k - 1].top);
      var p = step(d, H);
      // The dark line between two rows is thin.
      if (!p || p - H < 1 || p - H > Math.max(8, H * 0.15)) return;
      // The gold pin or star, right of the badge at the top of the row: in (nearly) every row.
      var xa = median(grp.map(function (q) { return q.xa; })), need = Math.max(4, Math.round(6 * sc * sc));
      var marked = grp.filter(function (q) {
        q.mark = countIf(px, w, h, Math.round(xa + 0.5 * H), q.top, Math.round(xa + 0.8 * H), Math.round(q.top + 0.17 * H), isMark);
        return q.mark >= need;
      });
      if (marked.length < 3 || marked.length < grp.length * 0.7) return;
      // Rows on one even grid (a row opened up to show its steps is taller, and pushes the ones under it off it):
      // the most rows that fit one grid, the upper ones when it is a tie.
      var on = [];
      marked.forEach(function (from) {
        var fit = marked.filter(function (q) { var n = Math.round((q.top - from.top) / p); return Math.abs(q.top - from.top - n * p) <= 2; });
        if (fit.length > on.length) on = fit;
      });
      if (on.length < 2) return;
      marked = on;
      best = { rows: marked, H: H, sc: sc, p: p, xa: xa, sample: on[0] };
    });
    if (!best) return null;
    var H = best.H, sc = best.sc, xa = best.xa, rows = best.rows.slice(), gap = best.p - H;
    // Rows the edges missed, on the same grid: one whose edge was broken up (a poor picture), and the row under the
    // last whole one, cut off by the bottom of the list. Such a row counts when it has its gold icon, a top edge,
    // and enough of it shows for its title and most of its badge.
    var xb = median(rows.map(function (q) { return q.xb; })), needMark = Math.max(4, Math.round(6 * sc * sc));
    // How light a line of the list is, across the rows' width (text only makes it lighter). The thin line between
    // two rows is dark; so is what is under the list.
    var lx0 = Math.round(xa) + 2, lx1 = Math.round(xb) - 2;
    function level(y) { if (y < 0 || y >= h) return 0; var n = 0, t = 0, o = y * w; for (var x = lx0; x <= lx1; x += 3) { t += L[o + x]; n++; } return n ? t / n : 0; }
    var lit = level(rows[0].bot + 1) + 5;
    function missed(at) {
      // The edge itself, within 2 pixels of where the grid says (a resized picture is off by a pixel here and there).
      var top = -1, jump = 5;
      for (var dy = -2; dy <= 2; dy++) { var e = level(at + dy) - level(at + dy - 1); if (at + dy >= 1 && at + dy < h - 2 && e > jump) { jump = e; top = at + dy; } }
      if (top < 0) return null;
      for (var k = 0; k < rows.length; k++) if (Math.abs(rows[k].top - top) <= 3) return null;
      // A row starts under a dark line, with a line of its own flat colour (no text yet). What is under the list
      // (the window's edge, the game behind it) does not.
      if (level(top - 1) > lit && level(top - 2) > lit) return null;
      var flat = 0, all = 0, bg = level(top + 1), fo = (top + 1) * w;
      for (var fx = lx0; fx <= lx1; fx += 3) { all++; if (Math.abs(L[fo + fx] - bg) <= 9) flat++; }
      if (flat < all * 0.9) return null;
      if (countIf(px, w, h, Math.round(xa + 0.5 * H), top, Math.round(xa + 0.8 * H), Math.round(top + 0.17 * H), isMark) < needMark) return null;
      var end = top + 1;
      while (end < h - 1 && end < top + H - 1 && level(end + 1) > lit) end++;
      return end - top + 1 >= H * 0.35 ? { top: top, bot: end, xa: xa, xb: xb, H: end - top + 1 } : null;
    }
    // The step as a fraction: on a resized picture it is not a whole number of pixels.
    var top0 = rows[0].top, nLast = Math.round((rows[rows.length - 1].top - top0) / best.p), found = [];
    var pf = nLast ? (rows[rows.length - 1].top - top0) / nLast : best.p;
    for (var n = 1; n < nLast; n++) { var mid = missed(top0 + Math.round(n * pf)); if (mid) found.push(mid); }
    for (n = nLast + 1; n < nLast + 40; n++) { var under = missed(top0 + Math.round(n * pf)); if (!under) break; found.push(under); }
    for (n = -1; n > -40; n--) { var over = missed(top0 + Math.round(n * pf)); if (!over) break; found.push(over); }
    rows = rows.concat(found).sort(function (p, q) { return p.top - q.top; });
    // A sharp picture: no row is missing between the first and the last, and most rows were found by their own edges.
    var holes = Math.round((rows[rows.length - 1].top - rows[0].top) / pf) + 1 - rows.length;
    var crisp = holes <= 0 && best.rows.length >= 3 && best.rows.length * 2 >= rows.length;
    // A task opened up to show its steps is a taller box, and pushes the rows under it off the grid the app counts
    // on. Only the rows down to it are kept; with one right above the rows found, none can be trusted.
    var opened = false;
    for (var oi = 0; oi < rows.length && !opened; oi++) {
      var ro = rows[oi];
      // Where the dark line under the row should be, the row just goes on.
      if (ro.H >= H - 2 && ro.top + H + 1 < h && level(ro.top + H) > lit && level(ro.top + H + 1) > lit) { opened = true; rows = rows.slice(0, oi + 1); }
    }
    boxes.forEach(function (q) {
      if (!rows.length || !sameX(q, best.sample) || q.H < H * 1.15 || q.H > H * 8) return;
      if (q.bot < rows[0].top && q.bot >= rows[0].top - gap - 3) { opened = true; rows = []; }
    });
    // The badge's place in the row (as the old way measures it: the middle of the badge).
    var bx0 = Math.round(xa + 8 * sc), bx1 = Math.round(xa + 23 * sc), mh = Math.round(14 * sc), red = 0;
    var out = rows.map(function (q) {
      var title = countIf(px, w, h, Math.round(xa + 0.8 * H), q.top, Math.round(xa + 3.8 * H), Math.round(q.top + 0.2 * H), isMark);
      var by0 = q.top + Math.round(2 * sc), by1 = Math.min(q.bot, q.top + Math.round(29 * sc)), ax0 = Math.round(xa + 2 * sc), ax1 = Math.round(xa + 29 * sc);
      var lock = countIf(px, w, h, ax0, by0, ax1, by1, isLock);
      red += countIf(px, w, h, ax0, by0, ax1, by1, isRed);
      var done = title >= 20 * sc * sc;
      return { y: q.top + Math.round(22 * sc), h: mh, done: done, locked: !done && lock >= 30 * sc * sc, partial: false };
    });
    out.forEach(function (r) {
      r.fp = textPrint(px, w, h, bx1 + Math.round((bx1 - bx0) * 0.4), r.y - mh - 6, bx1 + (bx1 - bx0 + 1) * 14, r.y + 6, mh + 2);
    });
    return { found: true, rows: out, x0: bx0, x1: bx1, pitch: best.p, red: red, sure: true, crisp: crisp, opened: opened };
  }

  /*
   * read(pixels, width, height) -> { found, rows: [{ y, done, locked, partial, fp }], x0, x1, pitch, red, panel }
   * partial: the badge is cut off (scrolled half out of view), so its state is not trusted.
   * panel: the tier list on the left of the list (see panel()), or null when it is not in view.
   *
   * The whole game screen has more than the list on it. The chat can be full of the same green line, whose letters
   * line up like a column of ticks, more of them than the tasks in view. So every column that could be the list is
   * tried, best first, and the one with the tier list (and its gold box) on its left wins. A column whose rows are
   * as close as lines of text is not tried; with no tier list in view, only a column whose rows are clearly far
   * apart is taken (a task row is three and a half badges tall or more, a line of text two and a half at most).
   */
  function read(px, w, h) {
    // The rows' boxes first: that works in every area. A list found that way is the real one (it has the game's
    // gold pins and stars), tier list in view or not.
    var byBox = boxList(px, w, h);
    if (byBox && !byBox.rows.length) return byBox;   // only an opened-up task in view
    if (byBox) {
      var t0 = byBox.rows[0].y, t1 = byBox.rows[byBox.rows.length - 1].y, bp = byBox.pitch;
      byBox.panel = panel(px, w, h, byBox.x0, { y0: t0 - bp * 8, y1: t1 + bp * 4, reach: bp * 5 });
      if (byBox.crisp) return byBox;
    }
    // A blurry picture (the game drawn bigger or smaller than it is): the boxes' edges are soft and some rows may
    // have been missed. The badges' colours are tried too, and the way that finds the most rows wins.
    var byBadge = badgeList(px, w, h);
    if (!byBox) return byBadge;
    return byBadge.found && byBadge.rows.length > byBox.rows.length ? byBadge : byBox;
  }
  // The old way: the badges' colours (red shields, green ticks, blue-green locks). Only areas with red badges.
  function badgeList(px, w, h) {
    var all = join(blobs(px, w, h), h / 5).filter(function (b) {
      var aspect = b.w / b.h, fill = (b.red + b.green + b.lock) / (b.w * b.h);
      // A badge is a shield with an outline, a letter and laurels: only part of its box is red or green.
      // A solid red or green shape is something else.
      return (b.red >= 10 || b.green >= 14 || b.lock >= 14) && aspect > 0.6 && aspect < 3 && b.h < h / 5 &&
        fill >= 0.15 && fill <= 0.7;
    });
    // Every column of blobs whose centres line up and whose sizes match, once each.
    var cols = [], seen = {};
    all.forEach(function (a) {
      var cx = a.x0 + a.w / 2, ids = [];
      var grp = all.filter(function (b, i) {
        var ok = Math.abs(b.x0 + b.w / 2 - cx) <= Math.max(a.w, b.w) * 0.15 + 1 && b.w > a.w * 0.7 && b.w < a.w * 1.4;
        if (ok) ids.push(i);
        return ok;
      });
      var key = ids.join(',');
      if (seen[key] || !score(grp)) return;
      seen[key] = 1;
      cols.push(grp);
    });
    // The list with the most red and green badges first; a column of only locks or text is not it.
    cols.sort(function (a, b) { return score(b) - score(a); });
    var first = null, firstFar = 0, tried = 0;
    for (var i = 0; i < cols.length && tried < 60; i++) {
      var best = tidy(cols[i]);
      if (best.length < 2 || !best.some(colour)) continue;
      var far = apart(best);
      if (far < 2) continue;
      var r = rowsOf(best, px, w, h);
      if (!r) continue;
      tried++;
      // The tier list is on the left of the list, in the same window (which shows about 7 rows): its right edge is
      // half a row from the badges, its left edge about three rows.
      var top = r.rows[0].y, bottom = r.rows[r.rows.length - 1].y, pp = r.pitch || (r.x1 - r.x0 + 1) * 3;
      r.panel = panel(px, w, h, r.x0, { y0: top - pp * 8, y1: bottom + pp * 4, reach: pp * 5 });
      if (r.panel) return r;
      // With no tier list in view, only a column whose rows are clearly a task list's, the farthest apart: never the chat.
      if (far >= 2.8 && far > firstFar) { first = r; firstFar = far; }
    }
    return first || { found: false, rows: [] };
  }
  // How far apart a column's rows are, in badge heights. A task row has a title and a line of text under it: three
  // and a half to five badges (two and a half when the badges come out big). Lines of text, like the chat, are
  // about two to two and a half letters apart.
  function apart(list) {
    var mh = median(list.map(function (b) { return b.h; })), ys = list.map(function (b) { return b.yb; }), d = [];
    for (var i = 1; i < ys.length; i++) d.push(ys[i] - ys[i - 1]);
    return mh >= 6 ? step(d, mh) / mh : 0;
  }
  // The rows of a column of badges: where each is, and done, locked or not.
  function rowsOf(best, px, w, h) {
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
      var c = count(px, w, h, cx0, Math.max(0, b.yb - mh + 1), cx1, b.yb), all = c.red + c.green + c.lock || 1;
      return {
        y: b.yb, h: b.h,
        // The text next to the badge (bright pixels only): the same row looks the same after a scroll,
        // whatever shows through the window behind it.
        // A tick is a lot of bright green (a third or more); some emblems (Desert) have a little green of their own.
        done: c.green / all >= 0.2,
        locked: c.lock > c.green && c.lock >= all * 0.3,
        partial: partial
      };
    });
    // A locked task whose grey badge is too faint to be found shows only its small lock: look in each empty place
    // between the rows found, and add a locked row where the lock is.
    var gp = pitch(rows);
    if (gp) {
      for (var gi = 1; gi < rows.length; gi++) {
        var k = Math.round((rows[gi].y - rows[gi - 1].y) / gp);
        for (var gk = 1; gk < k; gk++) {
          var gy = Math.round(rows[gi - 1].y + (rows[gi].y - rows[gi - 1].y) * gk / k);
          var gc = count(px, w, h, cx0, gy - mh + 1, cx1, gy);
          if (gc.lock >= 10 && gc.lock > gc.green) {
            rows.splice(gi, 0, { y: gy, h: mh, done: false, locked: true, partial: false });
            gi++;
          }
        }
      }
    }
    // At least 4 whole rows: a few shapes that only happen to line up are not a list.
    if (rows.filter(function (r) { return !r.partial; }).length < 4) return null;
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
  // A 1 pixel gold line in a picture made smaller (or blurred) comes out darker: tried when no box is found.
  function isDimGold(r, g, b) { return r >= 140 && g >= 120 && b <= 160 && r - b >= 45 && r >= g && g - b >= 25; }
  function lum(px, w, x, y) { var j = (y * w + x) * 4; return (px[j] + px[j + 1] + px[j + 2]) / 3; }
  // Brightness of 3 pixels side by side: steadier than one.
  function lum3(px, w, x, y) { return (lum(px, w, x, y) + lum(px, w, x + 1, y) + lum(px, w, x + 2, y)) / 3; }

  // near: { y0, y1, reach } to look only beside the task list: up to reach pixels left of it, from y0 to y1.
  function panel(px, w, h, maxX, near) {
    maxX = Math.min(w, maxX || w);
    var xa = near ? Math.max(0, maxX - Math.round(near.reach)) : 0;
    var ya = near ? Math.max(0, Math.round(near.y0)) : 0, yb = near ? Math.min(h, Math.round(near.y1)) : h;
    return boxPanel(px, w, h, goldBox(px, w, xa, maxX, ya, yb, isGold)) || boxPanel(px, w, h, goldBox(px, w, xa, maxX, ya, yb, isDimGold));
  }
  // The gold box: two long gold lines, one above the other, the nearest to the list (rightmost).
  function goldBox(px, w, xa, maxX, ya, yb, gold) {
    // Long gold lines: the top and bottom of the box. A line broken by a few pixels (a blurred picture) is one line.
    var runs = [];
    for (var y = ya; y < yb; y++) {
      var x0 = -1, last = -9, cur = null;
      for (var x = xa; x <= maxX; x++) {
        var j = (y * w + x) * 4, on = x < maxX && gold(px[j], px[j + 1], px[j + 2]);
        if (on) {
          if (cur && x - last <= 4) cur.x1 = x;
          else { if (cur && cur.x1 - cur.x0 + 1 >= 40) runs.push(cur); cur = { y: y, x0: x, x1: x }; }
          last = x;
        }
      }
      if (cur && cur.x1 - cur.x0 + 1 >= 40) runs.push(cur);
    }
    var box = null;
    runs.forEach(function (a) {
      runs.forEach(function (b) {
        var d = b.y - a.y;
        if (d < 18 || d > 90) return;
        // The top and the bottom of one box: one end the same, and mostly over each other. (A blurred corner can
        // break a line short at the other end.)
        if (Math.abs(a.x0 - b.x0) > 3 && Math.abs(a.x1 - b.x1) > 3) return;
        var x0 = Math.min(a.x0, b.x0), x1 = Math.max(a.x1, b.x1), over = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
        if (over < (x1 - x0 + 1) * 0.6 || x1 - x0 < d * 2) return;
        // The nearest one to the list (rightmost), and the tightest pair.
        if (!box || x1 > box.x1 + 3 || (Math.abs(x1 - box.x1) <= 3 && d < box.y1 - box.y0)) box = { x0: x0, x1: x1, y0: a.y, y1: b.y };
      });
    });
    return box;
  }
  // The tier list around the gold box: its rows, which one is picked, and the titles above and below.
  function boxPanel(px, w, h, box) {
    if (!box) return null;
    var bh = box.y1 - box.y0 + 1, bw = box.x1 - box.x0 + 1;
    // The rows: runs down a line just inside the box's left edge, lighter than the gaps between them.
    // On a bigger screen the box's edge is more than 1 pixel thick: look just inside it, not on it.
    var my = Math.round((box.y0 + box.y1) / 2), edge = 0;
    while (edge < 8 && box.x0 + edge < w && isGold(px[(my * w + box.x0 + edge) * 4], px[(my * w + box.x0 + edge) * 4 + 1], px[(my * w + box.x0 + edge) * 4 + 2])) edge++;
    var cx = box.x0 + (edge > 1 ? edge + 1 : 1), gapLum = Infinity, rowLum = lum3(px, w, cx, my);
    // The gap is the darkest thing right under the box.
    for (var gy = box.y1 + 1; gy < Math.min(h, box.y1 + bh); gy++) gapLum = Math.min(gapLum, lum3(px, w, cx, gy));
    var cut = (gapLum + Math.min(rowLum, lum3(px, w, cx, Math.min(h - 1, box.y1 + bh)))) / 2;
    if (!(cut > gapLum + 3)) return null;
    // "Area Tasks" has a green icon on its left; no tier row has one.
    var need = Math.max(15, Math.round(15 * (bh / 30) * (bh / 30)));
    function greenIn(t, b) {
      var n = 0;
      for (var y = t; y <= b; y++) {
        for (var x = box.x0; x < Math.min(w, box.x0 + bh * 2); x++) { var j = (y * w + x) * 4; if (isGreen(px[j], px[j + 1], px[j + 2])) n++; }
      }
      return n;
    }
    // The light runs down that line: rows, and titles.
    var runs = [], top = -1;
    for (var yy = 0; yy <= h; yy++) {
      var light = yy < h && lum3(px, w, cx, yy) > cut;
      if (light && top < 0) top = yy;
      if (!light && top >= 0) { runs.push({ top: top, bottom: yy - 1, hh: yy - top }); top = -1; }
    }
    // A row's height, as most rows have it (the gold lines can make the box itself a pixel or two off).
    var rh = median(runs.filter(function (r) { return r.hh >= bh * 0.75 && r.hh <= bh * 1.35; }).map(function (r) { return r.hh; })) || bh;
    var rows = [], tall = [];
    runs.forEach(function (r) {
      var g = r.hh >= rh * 0.5 ? greenIn(r.top, r.bottom) : 0;
      // The row in the gold box can come out a little taller (its gold lines blur into the gap on a big screen).
      var inBox = r.top <= box.y1 && r.bottom >= box.y0 && r.hh >= rh * 0.75 && r.hh <= rh * 1.35;
      // The title with the green icon, even when the list is scrolled so it is partly cut off.
      if (g >= need) tall.push({ top: r.top, bottom: r.bottom, green: g });
      else if (inBox || Math.abs(r.hh - rh) <= Math.max(4, rh * 0.12)) rows.push({ top: r.top, bottom: r.bottom });
      // Another title is about one and a half rows tall (two rows run together are more than two).
      else if (r.hh >= rh * 1.3 && r.hh <= rh * 1.8) tall.push({ top: r.top, bottom: r.bottom, green: 0 });
    });
    // The tier list always shows a few rows; a lone box (a tab, a button) is not it.
    if (rows.length < 3) return null;
    // Which row the box is on.
    var sel = -1;
    rows.forEach(function (r, i) { if (r.top <= box.y1 && r.bottom >= box.y0) sel = i; });
    if (sel < 0) return null;
    // Each row's place, in steps from the picked one (rows of another kind in between keep their place apart).
    var steps = [];
    for (var i = 1; i < rows.length; i++) steps.push(rows[i].top - rows[i - 1].top);
    var p = (steps.length && step(steps, bh)) || bh + 6;
    // The tier list's rows are stacked one under the other, a small gap apart, a few of them around the picked one.
    // (A gold button somewhere else, with a few light bits above and below it, is not the tier list.)
    if (p < rh * 1.02 || p > rh * 1.7) return null;
    if (rows.filter(function (r) { return Math.abs(r.top - rows[sel].top) <= p * 3.2; }).length < 3) return null;
    rows.forEach(function (r) {
      r.at = Math.round((r.top - rows[sel].top) / p);
      // The name only (the left 60%), not the count on the right.
      r.sig = textPrint(px, w, h, box.x0 + 3, r.top + 2, box.x0 + Math.round(bw * 0.6), r.top + bh - 3);
    });
    // The titles around the tiers. "Area Tasks" (a taller box with a green icon) sits right above Easy Ardougne;
    // the next title (no green icon) sits right below the last tier. head: the place of the row under "Area Tasks",
    // tail: the place of the row above the next title (each only when seen, and on the right side of the gold box).
    var gap = p - bh + Math.max(5, Math.round(bh / 6)), head = null, tail = null;
    tall.forEach(function (t) {
      rows.forEach(function (r) {
        if (t.green >= need && r.top > t.bottom && r.top - t.bottom <= gap && r.at <= 0) head = r.at;
        if (t.green < need && t.top > r.bottom && t.top - r.bottom <= gap && r.at >= 0) tail = r.at;
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
  function lit(a) { if (a.n == null) { var n = 0; for (var i = 0; i < a.m.length; i++) n += a.m[i]; a.n = n; } return a.n; }
  function textDiffer(a, b) {
    if (!a || !b) return 1;
    // One with less than half as much text as the other is nothing like it: no need to look closer.
    var na = lit(a), nb = lit(b), few = na < nb ? na : nb, many = na < nb ? nb : na;
    if (many > 40 && few < many * 0.5) return 1 - few / many;
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
    function thumbAt(x, y) { if (x < 0 || x >= w || y < 0 || y >= h) return false; var j = (y * w + x) * 4; return isThumb(px[j], px[j + 1], px[j + 2]); }
    // How wide the handle is at one height, if it is one: a few pixels of its colour with the dark track on both
    // sides. (The window's gold edge is a thin line, and rocks or sand behind the window are wide: both return 0.)
    function widthAt(x, y) {
      var a = x, b = x;
      while (a > 0 && x - a < 40 && thumbAt(a - 1, y)) a--;
      while (b < w - 1 && b - x < 40 && thumbAt(b + 1, y)) b++;
      var n = b - a + 1, off = Math.max(3, Math.round(n * 0.6));
      if (n < 3 || n > 30 || a - off < 0 || b + off >= w) return 0;
      return lum(px, w, a - off, y) < 60 && lum(px, w, b + off, y) < 60 ? n : 0;
    }
    for (var x = x0; x <= x1 && !(best && x > best.x + 30); x++) {
      // A run of handle pixels, with gaps of up to 2 pixels bridged (a noisy picture breaks it up).
      var start = -1, last = -1;
      for (var y = y0; y <= y1 + 3; y++) {
        var on = y <= y1 && thumbAt(x, y);
        if (on) { if (start < 0) start = y; last = y; continue; }
        if (start >= 0 && y - last > 2) {
          // Its real ends: it may go on above or below the part that was looked at.
          var top = start, bot = last, gap = 0;
          while (top > 0 && gap <= 2) { if (thumbAt(x, top - 1 - gap)) { top -= 1 + gap; gap = 0; } else gap++; }
          gap = 0;
          while (bot < h - 1 && gap <= 2) { if (thumbAt(x, bot + 1 + gap)) { bot += 1 + gap; gap = 0; } else gap++; }
          var run = bot - top + 1, mid = (top + bot) >> 1, q = (bot - top) >> 2;
          // Not one as long as the whole list or longer: that is the window's border, not the handle.
          // The first one from the left wins (the scrollbar is right next to the list; what is further right is
          // the window's edge and the game behind it); of the handle's own columns, the longest.
          if (run >= 20 && run < span - 6 && (!best || run > best.len) && darkBy(px, w, h, x, top, bot) &&
              widthAt(x, mid) && widthAt(x, mid - q) && widthAt(x, mid + q)) best = { x: x, top: top, len: run };
          start = -1;
        }
      }
    }
    if (!best) return { atTop: true, found: false };
    // The track: dark above and below the handle, up to the arrows.
    // (The handle's soft edge is skipped: 3 pixels.)
    // On a bigger screen everything is bigger: the handle is wider (5 pixels at the normal size), and so are its
    // soft edge and the room around it.
    // (Only the handle's own pixels count: the window's edge or rocks further right have its colour too.)
    var tw = widthAt(best.x, best.top + (best.len >> 1));
    var soft = Math.max(3, Math.round(3 * tw / 5)), edge = Math.max(2, Math.round(2 * tw / 5));
    var up = best.top - soft, down = best.top + best.len + edge;
    while (up > 0 && lum(px, w, best.x, up) < 45) up--;
    while (down < h - 1 && lum(px, w, best.x, down) < 45) down++;
    var above = Math.max(0, best.top - up - soft), below = Math.max(0, down - (best.top + best.len) - edge);
    return { found: true, x: best.x, top: best.top, len: best.len, above: above, below: below, atTop: above <= soft, atBottom: below <= soft, frac: above + below ? above / (above + below) : 0 };
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
