/*!
 * Quick Guide - app-scan.js
 * Scan achievements (Alt1): reads the game's Area Tasks list with reader.js and ticks the tasks.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var aidxAll = A.aidxAll, app = A.app, byId = A.byId, closeMenus = A.closeMenus, drawList = A.drawList, esc = A.esc,
    loadAprog = A.loadAprog, QG = A.QG, renderArea = A.renderArea, S = A.S, saveAprog = A.saveAprog, sdel = A.sdel,
    setTick = A.setTick, sget = A.sget, sset = A.sset, taskIndex = A.taskIndex, whenAreasRead = A.whenAreasRead,
    writeAmeta = A.writeAmeta;

  // ---------- scan achievements (Alt1) ----------
  // Alt1 looks at the game twice a second. The player opens Hero > Achievements > Area Tasks and picks a tier.
  // The tier picked in the game has a gold box in the list on the left. Which one it is, the app counts from the
  // "Area Tasks" title above Easy Ardougne (or from the next title, below the last tier), and it remembers what each
  // row's name looks like, for when no title is in view. Then each task row on the right is set to what the game
  // shows: done is ticked, not done (or locked) is unticked.
  // Tests may look faster (window.__scanMs); the game itself is looked at twice a second.
  var SCAN_MS = (typeof window.__scanMs === 'number' && window.__scanMs > 0) ? window.__scanMs : 500, SAME = 0.15, ROW_SAME = 0.45, NAME_SAME = 0.2;
  // Every tier of every area, in the order the game lists them: Easy Ardougne, Medium Ardougne, ...
  function scanTiers() {
    var ix = aidxAll(), out = [];
    QG.AREAS.forEach(function (a) {
      var t = ix[a.name] && ix[a.name].tiers;
      (t || []).forEach(function (x) { out.push({ area: a.name, id: x.id, name: x.name + ' ' + a.name, tasks: x.tasks.map(function (k) { return k.id; }) }); });
    });
    return out;
  }
  function closeRead() {
    var d = byId('rd');
    if (d) d.parentNode.removeChild(d);
  }
  function openScan(msg) {
    closeMenus();
    closeRead();
    app.insertAdjacentHTML('beforeend',
      '<div class="dlgbg" id="rd"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="rd-h">' +
      '<h2 class="dh" id="rd-h">Scan achievements</h2>' +
      '<ol class="rdhow"><li>In the game, open <b>Hero → Achievements → Area Tasks</b> and click a tier, ' +
      'for example <b>Easy Ardougne</b>.</li>' +
      '<li>Keep <b>Show Completed</b> on and <b>List Mode</b> off.</li>' +
      '<li>Press <b>Start</b>. Then scroll each list down, and click the next one. The app sees which one you picked.</li></ol>' +
      '<p class="rdtip">Each task is set to what the game shows: done is ticked, not done is unticked.</p>' +
      '<p class="note" id="rd-msg" role="status"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p>' +
      '<div class="dbtn"><button class="btn" type="button" data-act="scan-start">Start</button>' +
      '<button class="btn alt" type="button" data-act="rd-close">Close</button></div>' +
      '</div></div>');
  }
  function readMsg(text) {
    var m = byId('rd-msg');
    if (m) { m.textContent = text; m.hidden = false; }
  }
  function startScan() {
    var a = window.alt1, R = window.QuickGuideReader;
    if (!a || !R) return;
    if (!a.permissionPixel) { readMsg('Alt1 has no permission to see the screen. In Alt1, remove this app, add it again, and allow it to view the screen.'); return; }
    if (!a.rsLinked) { readMsg('Alt1 cannot find the game. Open RuneScape and try again.'); return; }
    readMsg('Reading the task lists of all areas…');
    S.aidxFail = [];
    whenAreasRead(function () {
      if (!byId('rd')) return;   // closed while reading
      var tiers = scanTiers();
      if (!tiers.length) { readMsg('Could not read the task lists from the wiki. Try again in a moment.'); return; }
      stopScan();
      S.scan = { tiers: tiers, k: -1, names: loadNames(tiers), base: namesFrom(tiers, window.QuickGuideTierNames || {}), prev: null, region: null, swap: null, set: 0, misses: 0, blank: 0, timer: 0, msg: '' };
      S.scan.msg = 'Looking for the list…';
      closeRead();
      showScanBar();
      scanTick();
    });
  }
  function stopScan() {
    if (!S.scan) return;
    clearTimeout(S.scan.timer);
    S.scan = null;
    var b = byId('scan');
    if (b) b.parentNode.removeChild(b);
  }
  function scanTier() { return S.scan.tiers[S.scan.k]; }
  function scanBarHtml() {
    var sc = S.scan, t = scanTier();
    return '<div class="scanbar" id="scan" role="status"><span class="dot" aria-hidden="true"></span>' +
      '<span class="smsg"><b id="scan-tier">' + esc(t ? t.name : 'Area Tasks') + '</b> <span class="sk">' + (t ? (sc.k + 1) + '/' + sc.tiers.length : '') + '</span><br>' +
      '<span id="scan-msg">' + esc(sc.msg) + '</span></span>' +
      '<button class="ib xs" type="button" data-act="scan-back" aria-label="The one before" title="The one before"' + (sc.k > 0 ? '' : ' disabled') + '>◀</button>' +
      '<button class="ib xs" type="button" data-act="scan-next" aria-label="The next one" title="The next one"' + (sc.k < sc.tiers.length - 1 ? '' : ' disabled') + '>▶</button>' +
      '<button class="btn alt sm" type="button" data-act="scan-stop">Stop</button></div>';
  }
  // The bar sits under the header of whatever screen is open, and comes back when the screen is drawn again.
  function showScanBar() {
    if (!S.scan) return;
    var old = byId('scan');
    if (old) old.parentNode.removeChild(old);
    var hdr = app.querySelector('.hdr');
    if (hdr) hdr.insertAdjacentHTML('afterend', scanBarHtml());
    else app.insertAdjacentHTML('afterbegin', scanBarHtml());
  }
  if (window.MutationObserver) new MutationObserver(function () { if (S.scan && !byId('scan')) showScanBar(); }).observe(app, { childList: true });
  function scanMsg(t) {
    if (!S.scan) return;
    S.scan.msg = t;
    var e = byId('scan-msg');
    if (e) e.textContent = t;
  }
  // The arrows: the app got the tier wrong. The picked row in the game is that tier; the rest is learnt again.
  function scanGoTo(k) {
    var sc = S.scan;
    if (!sc || k < 0 || k >= sc.tiers.length) return;
    // The arrows win until another row is picked in the game.
    sc.k = k; sc.names = {}; sc.other = {}; sc.prev = null; sc.pin = { k: k, sig: sc.last ? sc.last.sig : null, y: sc.last ? sc.last.top : null }; sc.sum = null;
    try { sdel('tiernames'); } catch (e) { /* not saved */ }
    showScanBar();
  }
  // Alt1 versions differ in which way round they hand over red and blue. Until the list is found once,
  // try both; then keep the one that worked.
  function readFrame(sc, c) {
    var R = window.QuickGuideReader;
    if (sc.swap) R.swapRB(c.px);
    var r = R.read(c.px, c.w, c.h);
    if (sc.swap != null) return r;
    // Not known yet: read it the other way round too, and keep the way that finds the tier list's gold box, or else
    // the one with the most red in the badges.
    var copy = R.swapRB(new Uint8ClampedArray(c.px)), r2 = R.read(copy, c.w, c.h);
    function worth(x) { return x.found ? (x.panel ? 1e9 : 0) + (x.sure ? 1e6 : 0) + x.red : -1; }
    if (worth(r2) > worth(r)) { c.px = copy; sc.swap = true; return r2; }
    if (r.found) sc.swap = false;
    return r;
  }
  function scanTick() {
    var sc = S.scan, R = window.QuickGuideReader;
    if (!sc) return;
    var c = null, r = null;
    try { c = R.capture(sc.region); } catch (e) { c = null; }
    // The same picture as last time (nothing moved in the game): nothing to do.
    var sum = c ? frameSum(c) : null;
    if (c && sum === sc.sum && sc.region && sc.cand == null && !sc.pending && sc.k >= 0) { sc.timer = setTimeout(scanTick, SCAN_MS); return; }
    sc.sum = sum;
    if (c) r = readFrame(sc, c);
    if (!c) sc.blank++; else sc.blank = 0;
    if (!r || !r.found) {
      sc.misses++;
      if (sc.region) sc.region = null;   // look at the whole screen again
      else if (sc.blank >= 6) scanMsg('Alt1 gives no picture of the game.');
      else if (sc.misses >= 6) scanMsg('No list seen in the ' + c.w + '×' + c.h + ' picture.');
      else scanMsg('Looking for the list…');
    } else {
      sc.misses = 0;
      // From now on, only look at the part with the tier list on the left and the task list: much less to copy
      // and read each time. It reaches a few rows above and below the list, for the list on the left.
      // The part stays put while the list is well inside it: a part that moved with every look would move
      // everything in it too. It is the full height of the game: a look that missed some rows must not cut
      // them off for good.
      var bw = r.x1 - r.x0 + 1, pitch = r.pitch || bw * 4, ax = c.x + r.x0;
      // At least 420 pixels to the left (the list of tiers) and 600 to the right (the scrollbar), whatever size the
      // badges came out this look.
      var left = Math.max(bw * 28, 420), right = Math.max(bw * 35, 600);
      var g = sc.region, inside = g && ax - left + 10 >= g.x && ax + right - 10 <= g.x + g.w;
      if (!inside) {
        var x0 = Math.max(0, ax - left);
        sc.region = { x: x0, y: 0, w: Math.min(window.alt1.rsWidth, ax + right) - x0, h: window.alt1.rsHeight };
      }
      // Rows are placed on the whole screen, not in the part, so places can be compared from one look to the next.
      r.rows.forEach(function (q) { q.ay = c.y + q.y; });
      // The tier list on the left, found by the reader next to the list.
      var known = r.rows.length ? scanPicked(sc, r.panel || null) : null;
      // A task opened up to show its steps pushes the rows under it out of place: only the ones above it are read.
      var OPENED = 'A task is opened up in the game: close it (click its arrow) to scan the tasks under it.';
      if (!r.rows.length) scanMsg(OPENED);
      else if (known === null) { /* another tier, not sure yet: set nothing this look */ }
      else if (known) {
        var ry = r.rows.map(function (q) { return q.y; });
        var sb = R.scrollbar(c.px, c.w, c.h, r.x1 + bw * 10, r.x0 + right - bw, Math.min.apply(null, ry) - pitch, Math.max.apply(null, ry) + pitch);
        scanRows(sc, r, sb);
        if (r.opened && S.scan === sc && /^Tasks /.test(sc.msg)) scanMsg(sc.msg + ' ' + OPENED);
      }
      else if (!r.panel) scanMsg('Which tier is this? Scroll the list on the left until the tier you clicked (the gold box) shows.');
      else scanMsg('Which tier is this? Scroll the list on the left up until Area Tasks shows (only needed once).');
    }
    if (S.scan === sc) sc.timer = setTimeout(scanTick, SCAN_MS);
  }
  // A quick sum of a sample of the picture's bytes, to see if anything changed.
  function frameSum(c) {
    var px = c.px, sum = 0, step = 4 * 7 + 4;
    for (var i = 0; i < px.length; i += step) sum = (sum * 31 + px[i] + px[i + 1] * 3 + px[i + 2] * 7) | 0;
    return sum + ':' + c.x + ':' + c.y + ':' + c.w + ':' + c.h;
  }
  // What each tier's name looks like in the list on the left is kept, so a later scan knows them without the
  // "Area Tasks" title in view. Saved as the size and the text pixels packed 6 to a character.
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function packMask(sig) {
    var out = sig.w + ',' + sig.h + ',';
    for (var i = 0; i < sig.m.length; i += 6) {
      var v = 0;
      for (var b = 0; b < 6; b++) v = v * 2 + (sig.m[i + b] ? 1 : 0);
      out += B64.charAt(v);
    }
    return out;
  }
  function unpackMask(str) {
    var p = String(str).split(','), w = +p[0], h = +p[1], d = p[2] || '', m = new Uint8Array(w * h);
    if (!(w > 0 && h > 0)) return null;
    for (var i = 0; i < d.length; i++) {
      var v = B64.indexOf(d.charAt(i));
      for (var b = 5; b >= 0; b--) { var j = i * 6 + (5 - b); if (j < m.length) m[j] = (v >> b) & 1; }
    }
    return { w: w, h: h, m: m };
  }
  function tierKey(t) { return t.area + '|' + t.id; }
  // The names the app learnt by itself (saved), and the ones it comes with (tiernames.js: every tier's name at the
  // game's normal interface size). Both are tried: a row is the tier whose name it looks like.
  function namesFrom(tiers, packed) {
    var out = {};
    tiers.forEach(function (t, k) { if (typeof packed[tierKey(t)] === 'string') { var m = unpackMask(packed[tierKey(t)]); if (m) out[k] = m; } });
    return out;
  }
  function loadNames(tiers) {
    // (Names saved by older versions could be wrong: they are dropped.)
    try { sdel('scannames'); } catch (e) { /* not saved */ }
    return namesFrom(tiers, sget('tiernames') || {});
  }
  // The names the app comes with are for the game's normal interface size: a name of another size is not tried.
  function sized(sig, m) { return Math.abs(sig.w - m.w) <= 4 && Math.abs(sig.h - m.h) <= 3; }
  function nameDiffer(sc, sig, k) {
    var R = window.QuickGuideReader, a = sc.names[k] ? R.textDiffer(sig, sc.names[k]) : 1, b = sc.base[k] && sized(sig, sc.base[k]) ? R.textDiffer(sig, sc.base[k]) : 1;
    return a < b ? a : b;
  }
  // The tier whose name a row looks like, if one is clearly the closest; else null.
  function nameOf(sc, sig) {
    if (!sig) return null;
    var d1 = 1, d2 = 1, at = null;
    for (var k = 0; k < sc.tiers.length; k++) {
      if (!sc.names[k] && !sc.base[k]) continue;
      var d = nameDiffer(sc, sig, k);
      if (d < d1) { d2 = d1; d1 = d; at = k; } else if (d < d2) d2 = d;
    }
    return d1 < NAME_SAME && d1 < d2 * 0.7 ? at : null;
  }
  function learnName(sc, k, sig, again) {
    var R = window.QuickGuideReader;
    if (!sig || k < 0 || k >= sc.tiers.length) return;
    // The name the app came with for this tier fits: nothing to learn. (This is every row, every look, at the
    // game's normal size, so it is checked first: one comparison.)
    if (sc.base[k] && sized(sig, sc.base[k]) && R.textDiffer(sig, sc.base[k]) < NAME_SAME) return;
    if (sc.names[k] && !(again && R.textDiffer(sig, sc.names[k]) >= NAME_SAME)) return;
    // With a title in view the place is certain. Without one: a name the app came with for another tier is not
    // learnt for this one (that one is right, whatever the arrows said). That is looked up once per tier:
    // comparing with all 52 names on every look would be slow.
    if (!again) {
      sc.other = sc.other || {};
      if (sc.other[k]) return;
      for (var b in sc.base) if (sized(sig, sc.base[b]) && R.textDiffer(sig, sc.base[b]) < NAME_SAME) { sc.other[k] = true; return; }
    }
    sc.names[k] = sig;
    var saved = sget('tiernames') || {};
    saved[tierKey(sc.tiers[k])] = packMask(sig);
    sset('tiernames', saved);
  }
  // Which tier is picked in the game (the row with the gold box in the list on the left). True when it knows,
  // false when it does not, null when it saw another tier only once (it moves on after two looks in a row agree).
  function scanPicked(sc, p) {
    var R = window.QuickGuideReader, n = sc.tiers.length, at = null;
    if (!p) return sc.k >= 0;   // the list on the left is out of view: keep the tier as it is
    var picked = p.rows[p.sel];
    // The row picked in the game, for the arrows: they hold for this row.
    sc.last = { sig: picked.sig, top: picked.top };
    // Set with the arrows: that holds while the same row is picked in the game.
    if (sc.pin) {
      // The same row: in the same place, with the same name ("Easy Ardougne" and "Easy Daemonheim" look alike).
      if (!sc.pin.sig) { sc.pin.sig = picked.sig; sc.pin.y = picked.top; }
      var bh = p.box.y1 - p.box.y0 + 1;
      if (picked.sig && Math.abs(picked.top - sc.pin.y) <= bh / 2 && R.textDiffer(picked.sig, sc.pin.sig) < NAME_SAME) {
        sc.pickSig = picked.sig; sc.pickTop = picked.top;
        p.rows.forEach(function (row) { learnName(sc, sc.pin.k + row.at, row.sig); });
        return true;
      }
      sc.pin = null;
    }
    // A title in view says it for sure: "Area Tasks" sits right above Easy Ardougne, the next title right below
    // the last tier.
    if (p.head != null) at = -p.head;
    else if (p.tail != null) at = n - 1 - p.tail;
    if (at != null && (at < 0 || at >= n)) at = null;
    // Tier names of one area look a lot alike ("Hard Ardougne", "Elite Ardougne"), so a name only counts as the
    // same when it is nearly pixel for pixel the same (NAME_SAME).
    var certain = at != null, bh2 = p.box.y1 - p.box.y0 + 1;
    // The name it knows that the picked row looks like, if that one is clearly closest.
    if (at == null) at = nameOf(sc, picked.sig);
    // The same row as last time is still picked (the same name, in the same place): the same tier.
    if (at == null && sc.k >= 0 && picked.sig && sc.pickSig && sc.pickTop != null && Math.abs(picked.top - sc.pickTop) <= bh2 / 2 &&
        R.textDiffer(picked.sig, sc.pickSig) < NAME_SAME) at = sc.k;
    if (at == null) {
      // The picked row's name is new, but rows around it have names it knows (the list on the left scrolled on):
      // each of those says where the picked one is; most of them must agree.
      var votes = {}, nv = 0;
      p.rows.forEach(function (row) {
        if (!row.sig || row === picked) return;
        var b1 = nameOf(sc, row.sig);
        if (b1 != null) { var v = b1 - row.at; votes[v] = (votes[v] || 0) + 1; nv++; }
      });
      Object.keys(votes).forEach(function (v) { if (votes[v] >= 2 && votes[v] * 2 > nv && (at == null || votes[v] > votes[at])) at = +v; });
      if (at != null && (at < 0 || at >= n)) at = null;
    }
    // Cannot tell this look. If a tier was seen once and waits for a second look, keep waiting (one look that
    // missed the title must not throw it away); else say so.
    if (at == null) return sc.cand != null ? null : false;
    if (at !== sc.k) {
      if (sc.cand !== at) { sc.cand = at; return null; }
    }
    sc.cand = null;
    sc.pickSig = picked.sig; sc.pickTop = picked.top;
    // Learn the names of the rows in view (they are in the game's order around the picked one). With a title in
    // view the place is certain: a name remembered wrongly (or at another interface size) is learnt again.
    p.rows.forEach(function (row) { learnName(sc, at + row.at, row.sig, certain); });
    if (at !== sc.k) {
      // Another tier: its list starts at the top.
      sc.k = at; sc.prev = null;
      showScanBar();
    }
    return true;
  }
  // Which task each row on the right is. Each row has a slot: how many steps below the first row it is (a row that
  // was not seen leaves its slot empty). Rows that look the same as rows of the last look vote for where the list
  // is now. A new tier starts at the top.
  function scanRows(sc, r, sb) {
    var R = window.QuickGuideReader, rows = r.rows.filter(function (x) { return !x.partial && x.fp; });
    if (!rows.length) return;
    // A tier seen for the first time: its first row is task 1 only when the list is at the top. The scrollbar says.
    if (!sc.prev && sb && !sb.atTop) { scanMsg('Scroll this list to the top.'); return; }
    var p = r.pitch || 1, y0 = rows[0].y, base = 0;
    rows.forEach(function (x, j) { x.slot = r.pitch ? Math.round((x.y - y0) / p) : j; });
    // The list is at the top (the scrollbar's handle is at the top of its track): the first task's row is the one
    // within a step below the top of the handle. That says which task each row is, on its own, every look.
    // (Rounded with a quarter step of room, so a row a pixel or two above the handle's top is still the first.)
    if (sb && sb.found && sb.atTop && r.pitch) base = -Math.round((y0 - sb.top - p / 4) / p);
    else if (sc.prev) {
      // The rows are where they were (nothing scrolled): most rows have one at the same height last time
      // (give or take 4 pixels), with text that is still roughly like it (so an exact one-row scroll does not count).
      var same = {}, near = 0;
      rows.forEach(function (x) {
        var q = sc.prev.filter(function (z) { return Math.abs(z.y - x.ay) <= 4; })[0];
        if (!q) return;
        near++;
        if (R.textDiffer(x.fp, q.fp) < ROW_SAME) { var b = q.idx - x.slot; same[b] = (same[b] || 0) + 1; }
      });
      var most = null;
      Object.keys(same).forEach(function (b) { if (most == null || same[b] > same[most]) most = b; });
      if (most != null && same[most] * 2 > near && near * 2 >= rows.length) base = +most;
      else {
        // Each row votes for the row of the last look it looks most like, if that one is clearly closest.
        // A row like none of them (scrolled in, or under a tooltip) does not vote.
        var votes = {}, n = 0;
        rows.forEach(function (x) {
          var b1 = null, d1 = 1, d2 = 1;
          sc.prev.forEach(function (q) {
            var d = R.textDiffer(x.fp, q.fp);
            if (d < d1) { d2 = d1; d1 = d; b1 = q; } else if (d < d2) d2 = d;
          });
          if (b1 && d1 < ROW_SAME && d1 < d2 * 0.75) { var b = b1.idx - x.slot; votes[b] = (votes[b] || 0) + 1; n++; }
        });
        var best = null;
        Object.keys(votes).forEach(function (b) { if (best == null || votes[b] > votes[best]) best = b; });
        // Most of the rows that voted agree.
        if (best == null || votes[best] * 2 <= n) {
          scanMsg('Lost my place: scroll back a little.'); return;
        }
        base = +best;
      }
    }
    var t = scanTier(), on = [], off = [], lo = Infinity, hi = -1;
    sc.prev = rows.map(function (x) { return { fp: x.fp, idx: base + x.slot, y: x.ay }; });
    // A task changes only when two looks in a row agree on it: one odd look does not tick or untick anything.
    var seen = sc.seen || (sc.seen = {});
    sc.pending = false;
    rows.forEach(function (x) {
      var i = base + x.slot;
      if (i < 0 || i >= t.tasks.length) return;
      lo = Math.min(lo, i); hi = Math.max(hi, i);
      var id = t.tasks[i], last = seen[id];
      seen[id] = x.done;
      if (last === x.done) (x.done ? on : off).push(id); else sc.pending = true;
    });
    sc.set += scanSet(t.area, on, off);
    scanMsg(hi < 0 ? 'Looking for the list…' : 'Tasks ' + (lo + 1) + (hi > lo ? '–' + (hi + 1) : '') + ' of ' + t.tasks.length +
      (hi >= t.tasks.length - 1 ? ', all seen.' : '.'));
  }
  // Sets tasks of an area to what the game shows. Returns how many changed.
  function scanSet(area, on, off) {
    var open = S.view === 'area' && S.areaKey === area && S.aprog;
    var p = open ? S.aprog : loadAprog(area), ix = open ? taskIndex(S.area) : taskIndex(aidxAll()[area]), n = 0;
    on.forEach(function (id) { if (!p.tasks[id]) { setTick(p.tasks, ix, id, true); n++; } });
    off.forEach(function (id) { if (p.tasks[id]) { setTick(p.tasks, ix, id, false); n++; } });
    if (!n) return 0;
    if (open) { saveAprog(); renderArea(true); }
    else { sset('aprog.' + area, p); writeAmeta(area, aidxAll()[area], p); if (S.view === 'start') drawList(); }
    return n;
  }

  A.share({ closeRead: closeRead, openScan: openScan, scanGoTo: scanGoTo, startScan: startScan, stopScan: stopScan });
  A.loaded.scan = true;
})(window.QuickGuideApp);
