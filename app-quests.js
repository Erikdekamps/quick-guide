/*!
 * Quick Guide - app-quests.js
 * Quests: the quest list and its order, the quest screen (Overview, Items, Steps) and its step logic.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var restoreScroll = A.restoreScroll, savedScroll = A.savedScroll, acc = A.acc, app = A.app, arr = A.arr, byId = A.byId, D = A.D, dateText = A.dateText, DIF_ORDER = A.DIF_ORDER,
    dotsHtml = A.dotsHtml, dropMaps = A.dropMaps, esc = A.esc, headerHtml = A.headerHtml, homeHtml = A.homeHtml,
    I = A.I, imageAcc = A.imageAcc, imgHtml = A.imgHtml, LEN_ORDER = A.LEN_ORDER, liHtml = A.liHtml,
    loadProg = A.loadProg, mapAcc = A.mapAcc, markedDone = A.markedDone, metaAll = A.metaAll, nextHtml = A.nextHtml,
    note = A.note, OV = A.OV, partHtml = A.partHtml, playerLevel = A.playerLevel, playerLocked = A.playerLocked,
    playerStatus = A.playerStatus, plural = A.plural, progHtml = A.progHtml, QG = A.QG, questBtn = A.questBtn,
    questLinks = A.questLinks, questMark = A.questMark, remember = A.remember, renderStart = A.renderStart,
    resizeMaps = A.resizeMaps, restoreAcc = A.restoreAcc, rowHtml = A.rowHtml, S = A.S, saveProg = A.saveProg,
    sget = A.sget, skillHtml = A.skillHtml, smooth = A.smooth, sortKey = A.sortKey, SORTS = A.SORTS, sset = A.sset,
    startMaps = A.startMaps, storeQuest = A.storeQuest, TAB_ICON = A.TAB_ICON, tabHtml = A.tabHtml,
    tableAcc = A.tableAcc, TABS = A.TABS, tabsHtml = A.tabsHtml, toast = A.toast, toastHtml = A.toastHtml,
    upgrade = A.upgrade, validTab = A.validTab, warn = A.warn;

  // ---------- step logic ----------
  function buildIndex() {
    var idx = { steps: {}, order: [], secOf: {}, secs: {} };
    function reg(s, parent) {
      idx.steps[s.id] = { s: s, parent: parent };
      (s.substeps || []).forEach(function (c) { if (c.type === 'step') reg(c, s.id); });
    }
    S.q.sections.forEach(function (sec) {
      idx.secs[sec.id] = sec;
      sec.blocks.forEach(function (b) {
        if (b.type !== 'step') return;
        idx.order.push(b.id);
        idx.secOf[b.id] = sec.id;
        reg(b, null);
      });
    });
    S.idx = idx;
  }
  function done(id) { return !!S.prog.steps[id]; }
  function current() {
    var o = S.idx.order;
    for (var i = 0; i < o.length; i++) if (!done(o[i])) return o[i];
    return null;
  }
  function secStat(sec) {
    var d = 0, t = 0;
    sec.blocks.forEach(function (b) { if (b.type === 'step') { t++; if (done(b.id)) d++; } });
    return { done: d, total: t };
  }
  function totals() {
    var d = 0;
    S.idx.order.forEach(function (id) { if (done(id)) d++; });
    return { done: d, total: S.idx.order.length };
  }
  function isOpen(sec, cur) {
    var v = S.prog.open[sec.id];
    if (v === true || v === false) return v;
    return true;   // parts start open; a part you finish folds shut
  }
  function mark(s, val) {
    if (val) S.prog.steps[s.id] = 1; else delete S.prog.steps[s.id];
    (s.substeps || []).forEach(function (c) { if (c.type === 'step') mark(c, val); });
  }
  // Ticking a step ticks its sub-steps. A step counts as done when all its sub-steps are.
  function setStep(id, val) {
    var e = S.idx.steps[id];
    if (!e) return;
    mark(e.s, val);
    var p = e.parent;
    while (p) {
      var pe = S.idx.steps[p];
      var subs = pe.s.substeps.filter(function (c) { return c.type === 'step'; });
      if (subs.every(function (c) { return done(c.id); })) S.prog.steps[p] = 1; else delete S.prog.steps[p];
      p = pe.parent;
    }
  }
  // Returns the new next step. Opens the part of the next step.
  // A finished part closes, unless "Show done steps" is on: then it stays as it was.
  function changeStep(id, val) {
    var before = current();
    var sb = before && S.idx.secOf[before], wasOpen = sb ? isOpen(S.idx.secs[sb], before) : false;
    setStep(id, val);
    var after = current();
    var sa = after && S.idx.secOf[after];
    if (sb !== sa) {
      if (sb) {
        var st = secStat(S.idx.secs[sb]);
        if (S.set.showDone) S.prog.open[sb] = wasOpen;
        else if (st.done === st.total) S.prog.open[sb] = false;
      }
      if (sa) S.prog.open[sa] = true;
    }
    refresh();
    return after;
  }
  function nextStep() {
    var cur = current();
    if (!cur) return;
    jumpTo(changeStep(cur, true), true);
  }
  // After a tick: the next step goes to the top of the list.
  function tickStep(id, val) {
    var after = changeStep(id, val);
    if (val) jumpTo(after, true);
  }
  // Puts an element exactly at the top of the list (just under the part's header, which stays in view).
  function alignTop(el, animate) {
    var main = byId('main');
    if (!main || !el) return;
    var sec = el.closest('.sec'), head = sec && sec !== el && sec.querySelector('.sh');
    var off = head ? head.offsetHeight - 1 : 0;   // the header sits 1px up, see .sh in style.css
    var top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - off;
    top = Math.max(0, Math.round(top));
    if (animate && smooth() === 'smooth' && main.scrollTo) main.scrollTo({ top: top, behavior: 'smooth' });
    else main.scrollTop = top;
  }
  function jumpTo(id, animate) {
    var main = byId('main');
    if (!main) return;
    if (!id) {
      var c = byId('complete');
      if (c && !c.hidden) alignTop(c, animate);
      return;
    }
    var sid = S.idx.secOf[id];
    if (sid && !isOpen(S.idx.secs[sid], current())) { S.prog.open[sid] = true; refresh(); }
    var li = main.querySelector('li[data-step="' + id + '"]');
    if (!li) return;
    // For the first step of a part, start at the top of the part, so its "Bring" box and notes come first.
    var target = li, sec = S.idx.secs[sid];
    var first = sec && sec.blocks.filter(function (b) { return b.type === 'step'; })[0];
    var body = main.querySelector('[data-sec="' + sid + '"] .secb');
    if (first && first.id === id && body) target = body;
    alignTop(target, animate);
  }

  // ---------- loading a quest guide ----------
  function loadError(e) {
    var c = e && e.code;
    if (c === 'missingtitle') return 'The wiki has no page for this quest yet.';
    if (c === 'invalidtitle') return 'That is not a valid wiki page name.';
    if (c === 'timeout') return 'The wiki took too long to answer. Try again.';
    if (c === 'http' || c === 'format') return (e.message || 'The wiki had a problem.') + ' Try again in a moment.';
    if (e instanceof TypeError) return 'Could not reach the wiki. Check your internet, then try again.';
    return (e && e.message) || 'Something went wrong. Try again.';
  }
  function loadGuide(t, label) {
    S.loading = label || t.base;
    S.error = '';
    renderStart();
    QG.load(t).then(function (q) {
      S.loading = false;
      S.input = '';
      storeQuest(q);
      openQuest(q.page, q);
    }, function (e) {
      S.loading = false;
      S.error = loadError(e);
      renderStart();
    });
  }
  // Opens a quest from the list: from storage if it is saved, else from the wiki.
  function openTitle(title) {
    var m = metaAll(), want = D.norm(title), key = '';
    Object.keys(m).forEach(function (k) { if (!key && D.norm(m[k].title) === want) key = k; });
    S.error = '';
    if (key && sget('quest.' + key)) { openQuest(key); return; }
    loadGuide({ base: title, title: title + '/Quick guide' }, title);
  }
  function openQuest(key, q) {
    q = q || sget('quest.' + key);
    if (!q || !q.sections) {
      S.error = 'That quest is not saved any more. Load it again.';
      renderStart();
      return;
    }
    S.q = upgrade(q);
    S.key = key;
    S.prog = loadProg(key);
    S.view = 'quest';
    S.resetArmed = 0;
    sset('last', key);
    buildIndex();
    renderQuest();
    // The steps tab, not seen before: the next step is in view.
    if (S.prog.tab === 'steps' && savedScroll() == null) jumpTo(current(), false);
    if (q.version !== QG.VERSION) refreshQuest(true);
  }
  function refreshQuest(silent) {
    var key = S.key, q = S.q;
    if (!silent) toast('Reading the wiki\u2026', 0);
    var t = q.notQuickGuide ? { title: q.page, base: q.page } : { title: q.page, base: q.title };
    QG.load(t).then(function (nq) {
      if (nq.page !== key) sset('prog.' + nq.page, sget('prog.' + key) || S.prog);
      storeQuest(nq);
      if (S.view !== 'quest' || S.key !== key) return;
      if (nq.page !== key) { openQuest(nq.page, nq); return; }
      S.q = nq;
      buildIndex();
      renderQuest();
      if (S.prog.tab === 'steps' && savedScroll() == null) jumpTo(current(), false);
      if (!silent) toast('Updated from the wiki.');
    }, function (e) {
      if (!silent) toast('Could not update. ' + loadError(e));
    });
  }

  // ---------- the quest list and the optimal order, from the wiki ----------
  function fetchList(silent, say) {
    if (S.listBusy) return;
    S.listBusy = true;
    S.listError = '';
    if (!silent) drawList();
    if (say) toast('Updating the quest list\u2026', 0);
    var asked = D.loadList();
    fetchMinis();
    asked.then(function (l) {
      S.listBusy = false;
      S.list = l;
      S.ranks = null;
      sset('list', l);
      drawList();
      if (say) toast('Quest list updated.');
    }, function (e) {
      S.listBusy = false;
      if (!silent || !S.list) S.listError = 'Could not get the quest list. ' + loadError(e);
      drawList();
      if (say) toast('Could not update the quest list. ' + loadError(e), 5000);
    });
  }
  // The miniquests. A failure says nothing: the quests still show, and the app asks again next time.
  function fetchMinis() {
    if (S.minisBusy) return;
    S.minisBusy = true;
    D.loadMinis().then(function (l) {
      S.minisBusy = false;
      S.minis = l;
      sset('minis', l);
      drawList();
    }, function () { S.minisBusy = false; });
  }
  // Quests and miniquests together. A miniquest that is also in the quest list shows once.
  function allQuests() {
    var out = ((S.list && S.list.quests) || []).slice(), seen = {};
    out.forEach(function (q) { seen[D.norm(q.t)] = 1; });
    ((S.minis && S.minis.quests) || []).forEach(function (q) { if (!seen[D.norm(q.t)]) { seen[D.norm(q.t)] = 1; out.push(q); } });
    return out;
  }
  function shortName(t) { return String(t).replace(/\s*\(miniquest\)\s*$/i, ''); }
  // The wiki's optimal quest order. With silent, a failure keeps what we have and says nothing.
  function fetchOrder(silent) {
    if (S.orderBusy) return;
    S.orderBusy = true;
    S.orderError = '';
    D.loadOrder().then(function (o) {
      S.orderBusy = false;
      S.order = o;
      S.ranks = null;
      sset('order', o);
      drawList();
    }, function (e) {
      S.orderBusy = false;
      if (!silent || !S.order) S.orderError = 'Could not get the optimal order. ' + loadError(e);
      drawList();
    });
  }
  // Each quest's place in the optimal order, counting only quests that are in the list: 1, 2, 3...
  function orderRanks() {
    if (S.ranks) return S.ranks;
    var pos = {}, r = {};
    ((S.order && S.order.order) || []).forEach(function (t, i) { var k = D.norm(t); if (pos[k] == null) pos[k] = i; });
    ((S.list && S.list.quests) || []).filter(function (q) { return pos[D.norm(q.t)] != null; })
      .sort(function (a, b) { return pos[D.norm(a.t)] - pos[D.norm(b.t)]; })
      .forEach(function (q, i) { r[D.norm(q.t)] = i + 1; });
    S.ranks = r;
    return r;
  }
  function orderRank(q) { return orderRanks()[D.norm(q.t)] || 0; }
  // ---------- the quest list (the start screen's Quests tab) ----------
  // Everything the list needs to know about one quest.
  function questInfo(q, byTitle) {
    var m = byTitle[D.norm(q.t)] || null, ps = playerStatus(q.t);
    // Done when you ticked every step, when the game says so, or when you marked it done in an imported file.
    var isDone = (!!m && m.total > 0 && m.done >= m.total) || ps === 2 || markedDone(q.t);
    var started = !isDone && ((!!m && m.done > 0) || ps === 1);
    return { q: q, m: m, done: isDone, started: started, locked: !isDone && !started && playerLocked(q.t) };
  }
  function groupOf(q, sort) {
    if (sort === 'dif') return q.dif || 'Other';
    if (sort === 'len') return q.len || 'Other';
    if (sort === 'ser') return q.ser && !/^(none|n\/a|-)$/i.test(q.ser) ? q.ser : 'No series';
    if (sort === 'rel') { var y = /\b(\d{4})\b/.exec(q.rel || ''); return y ? y[1] : 'Unknown'; }
    if (sort === 'opt') return orderRank(q) ? 'Optimal order' : 'Not in the guide';
    var c = q.t.replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
  }
  function rank(list, v) { var i = list.indexOf(String(v || '').toLowerCase()); return i < 0 ? list.length : i; }
  function sortQuests(items, sort) {
    function byName(a, b) { return sortKey(a.q.t) < sortKey(b.q.t) ? -1 : sortKey(a.q.t) > sortKey(b.q.t) ? 1 : 0; }
    return items.slice().sort(function (a, b) {
      var d = 0;
      if (sort === 'dif') d = rank(DIF_ORDER, a.q.dif) - rank(DIF_ORDER, b.q.dif) || String(a.q.dif).localeCompare(String(b.q.dif));
      else if (sort === 'len') d = rank(LEN_ORDER, a.q.len) - rank(LEN_ORDER, b.q.len) || String(a.q.len).localeCompare(String(b.q.len));
      else if (sort === 'ser') {
        var ga = groupOf(a.q, sort), gb = groupOf(b.q, sort);
        d = (ga === 'No series') - (gb === 'No series') || ga.localeCompare(gb);
      } else if (sort === 'rel') d = (Date.parse(b.q.rel) || 0) - (Date.parse(a.q.rel) || 0);
      else if (sort === 'opt') d = (orderRank(a.q) || 1e9) - (orderRank(b.q) || 1e9);
      return d || byName(a, b);
    });
  }
  function questRow(x) {
    var q = x.q, bits = [], status = '';
    if (q.mini) bits.push('Miniquest');
    if (S.set.sort === 'opt' && orderRank(q)) bits.push('#' + orderRank(q));
    if (q.dif) bits.push(esc(q.dif));
    if (q.len) bits.push(esc(q.len));
    if (q.m === true) bits.push('Members'); else if (q.m === false) bits.push('Free');
    if (q.qp) bits.push(q.qp + ' QP');
    if (x.m && x.m.total && x.m.done > 0) status = '<span class="qs' + (x.done ? ' ok' : '') + '">' + (x.done ? '\u2713 ' : '') + x.m.done + ' / ' + x.m.total + '</span>';
    else if (x.done) status = '<span class="qs ok">\u2713 Done</span>';
    else if (x.started) status = '<span class="qs">Started</span>';
    else if (x.locked) status = '<span class="qs lk">' + I.lock + 'Locked</span>';
    var bar = x.started && x.m && x.m.total && x.m.done > 0 ?
      '<progress class="pg" value="' + x.m.done + '" max="' + x.m.total + '" aria-hidden="true"></progress>' : '';
    return '<li><button class="q' + (x.done ? ' done' : x.started ? ' started' : x.locked ? ' locked' : '') + '" type="button" data-quest="' + esc(q.t) + '"' +
      (x.locked ? ' title="You do not have what this quest needs yet"' : '') + '>' +
      '<span class="q1"><b>' + esc(shortName(q.t)) + '</b>' + status + '</span>' +
      (bits.length ? '<span class="q2">' + bits.join(' \u00b7 ') + '</span>' : '') + bar + '</button></li>';
  }
  function matchQuests(v) {
    var n = String(v || '').toLowerCase().trim();
    if (!S.list || !n) return [];
    var hits = allQuests().filter(function (q) { return q.t.toLowerCase().indexOf(n) >= 0; });
    function score(q) { var t = q.t.toLowerCase(); return t === n ? 0 : sortKey(q.t).indexOf(n) === 0 ? 1 : 2; }
    return hits.sort(function (a, b) { return score(a) - score(b); });
  }
  function listHtml() {
    if (!S.list) {
      if (S.listBusy) return '<div class="state" role="status">' + I.loader + '<p>Getting the quest list\u2026</p></div>';
      return '<p class="err pad" role="alert">' + esc(S.listError || 'The quest list is not loaded.') + '</p>' +
        '<p class="pad"><button class="btn" type="button" data-act="list-refresh">Try again</button></p>';
    }
    var m = metaAll(), byTitle = {};
    Object.keys(m).forEach(function (k) { byTitle[D.norm(m[k].title)] = m[k]; });
    var v = S.input.toLowerCase().trim();
    var sort = S.set.sort;
    if (sort === 'opt' && !S.order) {
      if (!S.orderBusy && !S.orderError) fetchOrder(false);
      if (S.orderBusy) return '<div class="state" role="status">' + I.loader + '<p>Getting the optimal order\u2026</p></div>';
      return '<p class="err pad" role="alert">' + esc(S.orderError) + '</p>' +
        '<p class="pad"><button class="btn" type="button" data-act="order-refresh">Try again</button></p>';
    }
    var all = allQuests();
    var items = all.filter(function (q) { return !(S.set.hideMini && q.mini); })
      .map(function (q) { return questInfo(q, byTitle); }).filter(function (x) {
        return !v || x.q.t.toLowerCase().indexOf(v) >= 0;
      });
    // "Hide completed" and "Hide locked": not while you search, so a search still finds everything.
    var hidden = 0, hiddenLocked = 0;
    if (S.set.hideDone && !v) {
      hidden = items.filter(function (x) { return x.done; }).length;
      items = items.filter(function (x) { return !x.done; });
    }
    if (S.set.hideLocked && !v) {
      hiddenLocked = items.filter(function (x) { return x.locked; }).length;
      items = items.filter(function (x) { return !x.locked; });
    }
    items = sortQuests(items, sort);
    // Quests in progress go first, in their own group.
    items = items.filter(function (x) { return x.started; }).concat(items.filter(function (x) { return !x.started; }));
    function gOf(x) { return x.started ? 'In progress' : groupOf(x.q, sort); }
    // How the list is set up (all of it is in the settings).
    var how = [SORTS.filter(function (x) { return x[0] === sort; })[0][1]];
    if (S.set.hideMini) how.push('Quests only');
    if (S.player) how.push(esc(S.player.name));
    var h = '<p class="qmeta"><span id="qcount">' + (items.length === all.length ? plural(items.length, 'quest', 'quests') :
      items.length + ' of ' + plural(all.length, 'quest', 'quests')) +
      (hidden ? ' \u00b7 ' + hidden + ' done hidden' : '') +
      (hiddenLocked ? ' \u00b7 ' + hiddenLocked + ' locked hidden' : '') +
      (S.listError ? ' \u00b7 <span class="err">' + esc(S.listError) + '</span>' : '') + '</span>' +
      '<span class="how"> \u00b7 ' + how.join(' \u00b7 ') + '</span></p>';
    if (!items.length && hidden && !hiddenLocked) return h + '<p class="empty">All quests are done. Turn off \u201cHide completed\u201d in the settings to see them.</p>';
    if (!items.length && (hidden || hiddenLocked)) return h + '<p class="empty">All quests here are done or locked. Turn off \u201cHide completed\u201d or \u201cHide locked\u201d in the settings to see them.</p>';
    if (!items.length && v) return h + '<p class="empty">No quests match \u201c' + esc(S.input.trim()) + '\u201d.</p>';
    if (!items.length) return h + '<p class="empty">No quests here.</p>';
    var group = null, open = false;
    items.forEach(function (x) {
      var g = gOf(x);
      if (g !== group) {
        if (open) h += '</ul>';
        group = g;
        open = true;
        var n = items.filter(function (y) { return gOf(y) === g; }).length;
        var shut = !!S.closed[sort + ':' + g];
        h += '<h2 class="gh"><button class="ghb" type="button" data-group="' + esc(g) + '" aria-expanded="' + (shut ? 'false' : 'true') + '">' +
          I.chev + '<span class="n">' + esc(g) + '</span><span class="c">' + n + '</span></button></h2><ul class="ql"' + (shut ? ' hidden' : '') + '>';
      }
      h += questRow(x);
    });
    return h + '</ul>';
  }
  // Redraws only the list, so the search box keeps its text and focus.
  function drawList() {
    var el = byId('qarea');
    if (el && S.view === 'start') el.innerHTML = S.loading ? '' : homeHtml();
  }

  // ---------- steps tab ----------
  function optHtml(o) {
    var key = o.key || '\u2022';
    var tip = key === '?' ? 'The number varies' : key === '~' ? 'Any option' : key === '\u2713' ? 'Accept quest' : 'Press ' + key;
    var txt = o.text ? esc(o.text) : '<span class="vary">No text on the wiki.</span>';
    if (key === '?') txt += ' <span class="vary">Number varies.</span>';
    return '<li><kbd title="' + esc(tip) + '">' + esc(key) + '</kbd><span>' + txt + '</span></li>';
  }
  function stepHtml(s) {
    if (s.type === 'warning') return '<li class="warnli">' + warn(s.html) + '</li>';
    var ext = '';
    (s.dialogue || []).forEach(function (g) {
      if (g.when) ext += '<p class="why">' + esc(g.when) + ':</p>';
      ext += '<ul class="dlg" aria-label="Chat options">' + g.options.map(optHtml).join('') + '</ul>';
    });
    (s.images || []).forEach(function (im) { ext += imageAcc(im); });
    (s.tables || []).forEach(function (t) { ext += tableAcc(t); });
    var d = done(s.id);
    return '<li class="step' + (d ? ' done' : '') + '" data-step="' + esc(s.id) + '">' +
      rowHtml('scb', s.id, d, s.html || '<span class="x">See below.</span>', ext ? '<div class="ext">' + ext + '</div>' : '') +
      (s.substeps && s.substeps.length ? '<ul class="steps subs">' + s.substeps.map(stepHtml).join('') + '</ul>' : '') +
      '</li>';
  }
  function itemLi(it, extra) {
    var d = !!S.prog.items[it.id];
    return '<li class="step' + (d ? ' done' : '') + '" data-item="' + esc(it.id) + '">' + rowHtml('icb', it.id, d, it.html, extra) + '</li>';
  }
  function bringHtml(b, sec, i) {
    var next = null;
    for (var k = i + 1; k < sec.blocks.length; k++) { if (sec.blocks[k].type === 'step') { next = sec.blocks[k]; break; } }
    var all = (b.needed || []).concat(b.recommended || []);
    var allTicked = all.length > 0 && all.every(function (it) { return S.prog.items[it.id]; });
    // Open, until everything in it is ticked.
    var open = !allTicked || S.set.showDone;
    function list(kind, items) {
      if (!items || !items.length) return '';
      return '<p class="bl"><span>' + kind + '</span><span class="c"></span></p><ul class="steps blist">' +
        items.map(function (it) { return itemLi(it); }).join('') + '</ul>';
    }
    return '<details class="acc bring"' + (open ? ' open' : '') + '><summary>' + I.chev +
      '<span class="sl">Bring for this part</span><span class="m" data-bcount></span></summary>' +
      '<div class="body">' + list('Needed', b.needed) + list('Recommended', b.recommended) + '</div></details>';
  }
  function blockHtml(b, sec, i) {
    switch (b.type) {
      case 'heading': return b.level <= 3 ? '<h3 class="sub">' + esc(b.text) + '</h3>' : '<h4 class="sub minor">' + esc(b.text) + '</h4>';
      case 'bring': return '<div class="blk">' + bringHtml(b, sec, i) + '</div>';
      case 'note': return note(b.html);
      case 'warning': return warn(b.html);
      case 'text': return '<p class="para">' + b.html + '</p>';
      case 'image': case 'map': return '<div class="blk">' + imageAcc(b) + '</div>';
      case 'images': return '<div class="blk">' + acc(I.image, 'Pictures', plural(b.items.length, 'picture', 'pictures'), b.items.map(imgHtml).join('')) + '</div>';
      case 'table': return '<div class="blk">' + tableAcc(b) + '</div>';
      default: return '';
    }
  }
  function sectionHtml(sec, cur) {
    var open = isOpen(sec, cur), body = '', run = '';
    sec.blocks.forEach(function (b, i) {
      if (b.type === 'step') { run += stepHtml(b); return; }
      if (run) { body += '<ul class="steps">' + run + '</ul>'; run = ''; }
      body += blockHtml(b, sec, i);
    });
    if (run) body += '<ul class="steps">' + run + '</ul>';
    return partHtml('data-sec', sec.id, esc(sec.title), '', body, open);
  }
  function stepsHtml() {
    var q = S.q;
    if (!q.sections.length) return '<p class="empty">No steps found on this page.</p>';
    var cur = current();
    var h = '<div class="complete" id="complete" hidden>' + I.scroll +
      '<div><b>Quest complete!</b><span>All ' + plural(S.idx.order.length, 'step', 'steps') + ' done.</span></div></div>';
    q.sections.forEach(function (sec) { h += sectionHtml(sec, cur); });
    return h + '<div class="tail" aria-hidden="true"></div>';
  }

  // ---------- items and overview tabs ----------
  function itemsHtml() {
    var req = S.q.requiredItems, rec = S.q.recommendedItems, h = '';
    function alts(it) { return (it.alternatives || []).map(function (a) { return '<span class="alt">' + a + '</span>'; }).join(''); }
    if (!req.items.length && !rec.items.length) return '<p class="empty">This guide lists no items.</p>';
    if (req.note) h += note(req.note);
    if (req.items.length) {
      h += '<h2 class="bh">Required <span class="c" data-count="req"></span></h2><ul class="steps">' +
        req.items.map(function (it) { return itemLi(it, alts(it)); }).join('') + '</ul>';
    }
    if (rec.note) h += note(rec.note);
    if (rec.items.length) {
      h += '<h2 class="bh">Recommended <span class="c" data-count="rec"></span></h2><ul class="steps">' +
        rec.items.map(function (it) { return itemLi(it, alts(it)); }).join('') + '</ul>';
    }
    return h;
  }
  function rewardLi(it) {
    return '<li>' + it.html + (it.subs || []).map(function (s) { return '<span class="alt">' + s + '</span>'; }).join('') + '</li>';
  }
  function foeHtml(e) {
    return '<li><span class="nm">' + (e.count ? '<span class="x">' + e.count + ' \u00d7</span> ' : '') + esc(e.name) +
      (e.note ? ' <span class="x">(' + esc(e.note) + ')</span>' : '') + '</span>' +
      (e.level ? '<span class="lv">lvl <b>' + esc(e.level) + '</b></span>' : '') + '</li>';
  }
  function forSummary(groups) {
    var direct = 0, others = {};
    groups.forEach(function (g) {
      if (g.label === 'Directly') direct += g.items.length;
      else g.items.forEach(function (x) { others[x] = 1; });
    });
    var more = Object.keys(others).length;
    return direct ? direct + ' direct' + (more ? ' \u00b7 ' + more + ' more' : '') : plural(more, 'quest', 'quests');
  }
  function detailsHtml() {
    var q = S.q, o = q.overview, h = '', kv = [];
    if (q.notQuickGuide) h += note('This quest has no Quick guide on the wiki, so this is its full page.');
    if (o.startPoint) kv.push(['Start', o.startPoint]);
    if (o.members != null) kv.push(['Members', o.members ? 'Yes' : 'No, free to play']);
    if (o.length) kv.push(['Length', esc(o.length)]);
    if (o.difficulty) kv.push(['Difficulty', esc(o.difficulty)]);
    if (kv.length) h += '<dl class="kv">' + kv.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
    if (o.startMap) h += '<div class="blk">' + mapAcc(o.startMap) + '</div>';
    if (o.description) h += '<p class="para">' + esc(o.description) + '</p>';
    if (o.questReqs && o.questReqs.length) {
      var got = o.questReqs.filter(function (e) { return playerStatus(e.text) === 2; }).length;
      h += '<h2 class="bh">Quests</h2><div class="blk">' + acc('', 'Quest tree',
        S.player ? got + ' / ' + o.questReqs.length + ' done' : plural(o.questReqs.length, 'entry', 'entries'),
        '<ul class="tree">' + o.questReqs.map(function (e) {
          var have = playerStatus(e.text) === 2;
          return '<li' + (have ? ' class="got"' : '') + ' style="margin-left:' + Math.max(0, e.depth - 1) * 16 + 'px">' +
            questBtn(e.text) + questMark(e.text) + '</li>';
        }).join('') + '</ul>') + '</div>';
    } else if (kv.length) {
      h += '<h2 class="bh">Quests</h2><p class="para">No quests needed first.</p>';
    }
    if (o.followsEvents && o.followsEvents.length) h += '<p class="para">Story only, not required: ' + esc(o.followsEvents.join(', ')) + '.</p>';
    if (o.extra && o.extra.length) {
      h += '<h2 class="bh">Other</h2><dl class="kv wide">' + o.extra.map(function (x) { return '<dt>' + esc(x.label) + '</dt><dd>' + x.html + '</dd>'; }).join('') + '</dl>';
    }
    (o.notes || []).forEach(function (n) { h += '<p class="para">' + n + '</p>'; });
    var full = q.notQuickGuide ? q.source : QG.pageUrl(q.title);
    h += '<a class="xl" href="' + esc(full) + '" target="_blank" rel="noopener">Full quest guide on the wiki ' + I.ext + '</a>';
    h += '<p class="foot">Guide text: <a href="' + esc(q.source) + '" target="_blank" rel="noopener">RuneScape Wiki</a>, CC BY-NC-SA 3.0. Loaded ' + esc(dateText(q.fetchedAt)) + '.</p>';
    return h;
  }
  function skillsHtml() {
    var o = S.q.overview, h = '';
    if (o.skillReqs && o.skillReqs.length) {
      h += '<h2 class="bh">Skill levels</h2><ul class="skl-list">' + o.skillReqs.map(function (s) { return skillHtml(s, 'li'); }).join('') + '</ul>';
    }
    if (o.otherReqs && o.otherReqs.length) {
      h += '<h2 class="bh">Also needed</h2>' + o.otherReqs.map(function (r) { return '<p class="para">' + r + '</p>'; }).join('');
    }
    return h;
  }
  function enemiesHtml() {
    var e = S.q.overview.enemies || [];
    if (!e.length) return '';
    return '<h2 class="bh">Enemies to defeat</h2><ul class="foes">' + e.map(foeHtml).join('') + '</ul>';
  }
  function rewardsHtml() {
    var q = S.q, r = q.rewards, h = '';
    if (r.items.length) h += '<h2 class="bh">Rewards</h2><ul class="plain">' + r.items.map(rewardLi).join('') + '</ul>';
    r.groups.forEach(function (g) {
      h += '<h2 class="bh">' + esc(g.label) + '</h2><ul class="plain">' + g.items.map(rewardLi).join('') + '</ul>';
    });
    (r.notes || []).forEach(function (n) { h += '<p class="para">' + n + '</p>'; });
    var more = '';
    if (r.image) more += imageAcc(r.image, 'Quest complete scroll');
    if (q.music.length) {
      more += acc(I.music, 'Music unlocked', plural(q.music.length, 'track', 'tracks'), '<ul class="plain">' + q.music.map(function (m) {
        return '<li>' + esc(m.name) + (m.where ? ' <span class="x">(' + esc(m.where) + ')</span>' : '') + '</li>';
      }).join('') + '</ul>');
    }
    if (q.achievements.length) more += acc('', 'Achievements', String(q.achievements.length), '<ul class="plain">' + q.achievements.map(liHtml).join('') + '</ul>');
    if (q.requiredFor.length) {
      more += acc('', 'Needed for later quests', forSummary(q.requiredFor), q.requiredFor.map(function (g) {
        return '<p class="why">' + esc(g.label) + ':</p><ul class="plain">' + g.items.map(function (x) { return liHtml(questLinks(x)); }).join('') + '</ul>';
      }).join(''));
    }
    if (more) h += '<div class="blk" style="margin-top:14px">' + more + '</div>';
    return h;
  }
  // The Overview tab: one foldable part for each kind of info, all open at first.
  function ovCount(id) {
    var q = S.q, o = q.overview;
    if (id === 'skills') {
      var low = (o.skillReqs || []).filter(function (s) { var v = playerLevel(s.skill); return v != null && v < s.level; }).length;
      return low ? low + ' too low' : String((o.skillReqs || []).length + (o.otherReqs || []).length);
    }
    if (id === 'enemies') return String((o.enemies || []).length);
    if (id === 'rewards') return String(q.rewards.items.length);
    return '';
  }
  function overviewHtml() {
    var bodies = { details: detailsHtml(), skills: skillsHtml(), enemies: enemiesHtml(), rewards: rewardsHtml() };
    return OV.map(function (p) {
      var id = p[0];
      if (!bodies[id]) return '';
      return partHtml('data-ov', id, p[1], ovCount(id), bodies[id], ovOpen(id), { countAttr: ' data-ovc="' + id + '"' });
    }).join('');
  }
  // Open unless you closed it.
  function ovOpen(id) { return S.prog.open['ov:' + id] !== false; }
  function toggleOv(id) {
    var el = document.querySelector('[data-ov="' + id + '"]');
    if (!el) return;
    var open = !ovOpen(id);
    S.prog.open['ov:' + id] = open;
    saveProg();
    el.querySelector('.sech').setAttribute('aria-expanded', open ? 'true' : 'false');
    el.querySelector('.secb').hidden = !open;
    resizeMaps();
    startMaps();
    alignTop(el, false);
  }

  // ---------- quest screen ----------
  function bodyHtml(tab) { return tab === 'steps' ? stepsHtml() : tab === 'items' ? itemsHtml() : overviewHtml(); }
  function renderQuest() {
    var q = S.q, tab = S.prog.tab;
    dropMaps();
    app.innerHTML =
      headerHtml(q.title, 'All quests', dotsHtml()) +
      progHtml(0, 1, 'Quest progress', '') +
      tabsHtml('Guide parts', TABS.map(function (t) { return tabHtml('data-tab', t[0], tab === t[0], t[1], TAB_ICON[t[0]]); })) +
      '<main class="scroll' + (S.set.showDone ? ' show-done' : '') + '" id="main" role="tabpanel">' + bodyHtml(tab) + '</main>' +
      (tab === 'steps' ? nextHtml('next', 'Done, next step') : '') +
      toastHtml(tab !== 'steps');
    restoreScroll();
    restoreAcc();
    refresh();
    restoreScroll();
  }
  // Updates ticks, counts and open parts without rebuilding the page.
  function refresh() {
    if (S.view !== 'quest') return;
    var t = totals(), cur = current(), main = byId('main');
    var pg = byId('pg'), cnt = byId('pg-cnt');
    if (pg) { pg.max = Math.max(t.total, 1); pg.value = t.done; }
    if (cnt) cnt.textContent = t.done + ' / ' + plural(t.total, 'step', 'steps');
    if (!main) return;
    arr(main.querySelectorAll('li[data-step]')).forEach(function (li) {
      var id = li.getAttribute('data-step'), d = done(id);
      li.classList.toggle('done', d);
      li.classList.toggle('cur', id === cur);
      var cb = li.querySelector(':scope > .row > .cb');
      if (cb) cb.checked = d;
    });
    arr(main.querySelectorAll('li[data-item]')).forEach(function (li) {
      var d = !!S.prog.items[li.getAttribute('data-item')];
      li.classList.toggle('done', d);
      var cb = li.querySelector(':scope > .row > .cb');
      if (cb) cb.checked = d;
    });
    arr(main.querySelectorAll('details.bring')).forEach(function (det) {
      var got = 0, all = 0, lists = arr(det.querySelectorAll('ul.blist'));
      lists.forEach(function (ul) {
        var g = ul.querySelectorAll('li.done').length, n = ul.querySelectorAll('li[data-item]').length;
        got += g;
        all += n;
        // Each list shows its own count only when there are two lists.
        var c = ul.previousElementSibling && ul.previousElementSibling.querySelector('.c');
        if (c) c.textContent = lists.length > 1 ? g + ' / ' + n : '';
      });
      det.classList.toggle('alldone', all > 0 && got === all);
      var m = det.querySelector('[data-bcount]');
      if (m) m.textContent = (all && got === all ? '\u2713 ' : '') + got + ' / ' + all;
    });
    if (S.prog.tab === 'steps') {
      S.q.sections.forEach(function (sec) {
        var el = main.querySelector('[data-sec="' + sec.id + '"]');
        if (!el) return;
        var st = secStat(sec), btn = el.querySelector('.sech'), full = st.total > 0 && st.done === st.total;
        btn.classList.toggle('done', full);
        btn.querySelector('.c').textContent = st.total ? (full ? '\u2713 ' : '') + st.done + ' / ' + st.total : '';
        var open = isOpen(sec, cur);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        el.querySelector('.secb').hidden = !open;
      });
      var nb = byId('next-btn');
      if (nb) { nb.disabled = !cur; nb.querySelector('span').textContent = cur ? 'Done, next step' : 'All steps done'; }
      var cp = byId('complete');
      if (cp) cp.hidden = !!cur || !t.total;
    }
    [['req', S.q.requiredItems.items], ['rec', S.q.recommendedItems.items]].forEach(function (p) {
      var c = main.querySelector('[data-count="' + p[0] + '"]');
      if (c) c.textContent = p[1].filter(function (it) { return S.prog.items[it.id]; }).length + ' / ' + p[1].length;
    });
    saveProg();
    remember(S.key, S.q.title, t.done, t.total);
    startMaps();
  }
  function switchTab(tab) {
    tab = validTab(tab);
    if (tab === S.prog.tab) return;
    S.prog.tab = tab;
    saveProg();
    renderQuest();
    if (tab === 'steps' && savedScroll() == null) jumpTo(current(), false);
  }
  function toggleSection(id) {
    var sec = S.idx.secs[id];
    if (!sec) return;
    S.prog.open[id] = !isOpen(sec, current());
    refresh();
    resizeMaps();
    // Keep the part you just opened or closed at the top, so you do not lose your place.
    alignTop(document.querySelector('[data-sec="' + id + '"]'), false);
  }

  A.share({ alignTop: alignTop, allQuests: allQuests, current: current, drawList: drawList, fetchList: fetchList,
    fetchMinis: fetchMinis, fetchOrder: fetchOrder, jumpTo: jumpTo, listHtml: listHtml, loadError: loadError,
    matchQuests: matchQuests, nextStep: nextStep, openQuest: openQuest, openTitle: openTitle, refresh: refresh,
    refreshQuest: refreshQuest, renderQuest: renderQuest, switchTab: switchTab, tickStep: tickStep,
    toggleOv: toggleOv, toggleSection: toggleSection });
  A.loaded.quests = true;
})(window.QuickGuideApp);
