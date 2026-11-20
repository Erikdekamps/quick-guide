/*!
 * Quick Guide - js/app/capes.js
 * Capes, in Achievements: the master quest, completionist and trimmed completionist capes. Their cards on top of the
 * list, and a cape's page: its achievements by category, with tick boxes, like an area.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var alignTop = A.alignTop, app = A.app, byId = A.byId, D = A.D, dropMaps = A.dropMaps, esc = A.esc, headerHtml = A.headerHtml,
    homeBarHtml = A.homeBarHtml, I = A.I, loadError = A.loadError, markedDone = A.markedDone, markHtml = A.markHtml, metaAll = A.metaAll, nextHtml = A.nextHtml,
    partHtml = A.partHtml, playerLevel = A.playerLevel, playerStatus = A.playerStatus, plural = A.plural, progHtml = A.progHtml, QG = A.QG,
    questBtn = A.questBtn, questMark = A.questMark,
    renderStart = A.renderStart, restoreScroll = A.restoreScroll, rowHtml = A.rowHtml, S = A.S, sget = A.sget, skillHtml = A.skillHtml,
    sset = A.sset, tabCountHtml = A.tabCountHtml, tabHtml = A.tabHtml, tabsHtml = A.tabsHtml, toast = A.toast, toastHtml = A.toastHtml;

  // ---------- saved capes and your ticks ----------
  function capeInfo(key) { return QG.CAPES.filter(function (c) { return c.key === key; })[0]; }
  function savedCape(key) { var c = sget('cape.' + key); return c && Array.isArray(c.cheevos) && c.cheevos.length ? c : null; }
  // Your ticks in a cape, the tab you looked at, and the parts you opened or closed: { ticks, tab, open }
  function loadCprog(key) {
    var p = sget('cprog.' + key);
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    if (!p.ticks || typeof p.ticks !== 'object') p.ticks = {};
    return p;
  }
  // On the cape's own page: the ticks in use; anywhere else: the saved ones (an import may have changed them).
  function progOf(key) { return S.view === 'cape' && key === S.capeKey && S.cprog ? S.cprog : loadCprog(key); }
  function saveCprog() { sset('cprog.' + S.capeKey, S.cprog); }
  // Ticks or unticks an achievement in a cape: the one on screen, or a saved one.
  function setTick(key, id, on) {
    var here = S.view === 'cape' && key === S.capeKey && S.cprog, p = here ? S.cprog : loadCprog(key);
    if (on) p.ticks[id] = 1; else delete p.ticks[id];
    sset('cprog.' + key, p);
  }
  // An achievement that counts for two capes is one tick: it is ticked in both (also: the other capes, from the wiki).
  function tickShared(key, x, on) {
    setTick(key, x.id, on);
    (x.also || []).forEach(function (k) { if (k !== key && capeInfo(k)) setTick(k, x.id, on); });
  }

  // ---------- the achievements that tick themselves ----------
  // From your quests (Quest Cape), your levels (Master Skiller), or another cape (the two capes in the trimmed one).
  function autoOf(x, c) {
    if (x.name === 'Quest Cape') return 'quests';
    if (x.name === 'Master Skiller' && c.skiller && c.skiller.length) return 'skills';
    if (x.name === 'Master Quest Cape') return 'cape:mqc';
    if (x.name === 'Completionist Cape') return 'cape:comp';
    return '';
  }
  // The quests of the quest list you have done: by the game, or ticked here.
  function questsDone() {
    var m = metaAll(), byTitle = {}, all = (S.list && S.list.quests) || [];
    Object.keys(m).forEach(function (k) { byTitle[D.norm(m[k].title)] = m[k]; });
    var done = all.filter(function (q) {
      var me = byTitle[D.norm(q.t)];
      return (me && me.total > 0 && me.done >= me.total) || playerStatus(q.t) === 2 || markedDone(q.t);
    }).length;
    return { done: done, total: all.length };
  }
  function skillsMet(c) {
    var reqs = c.skiller || [];
    return { done: reqs.filter(function (r) { var v = playerLevel(r.skill); return v != null && v >= r.level; }).length, total: reqs.length };
  }
  // { done, total } of a cape, or null when it is not read yet. seen: the capes counted already (no loops).
  function capeCount(key, seen) {
    var c = savedCape(key);
    if (!c) return null;
    seen = seen || {};
    if (seen[key]) return { done: 0, total: c.cheevos.length };
    seen[key] = 1;
    var p = progOf(key);
    return { done: c.cheevos.filter(function (x) { return isDone(x, c, p, seen); }).length, total: c.cheevos.length };
  }
  function isDone(x, c, p, seen) {
    var a = autoOf(x, c);
    if (a === 'quests') { var q = questsDone(); return q.total > 0 && q.done >= q.total; }
    if (a === 'skills') { var s = skillsMet(c); return s.total > 0 && s.done >= s.total; }
    if (a) { var n = capeCount(a.slice(5), Object.assign({}, seen || {})); return !!n && n.done >= n.total; }
    return !!p.ticks[x.id];
  }
  function selfText(a, c) {
    if (a === 'quests') {
      var q = questsDone();
      return q.total ? 'Ticks itself from your quests: <b>' + q.done + ' / ' + q.total + '</b>' : 'Ticks itself from your quests, once the quest list is read';
    }
    if (a === 'skills') {
      var s = skillsMet(c);
      return S.player ? 'Ticks itself from your levels: <b>' + s.done + ' / ' + s.total + '</b> skills' : 'Ticks itself from your levels: look up your character in Settings';
    }
    var k = a.slice(5), n = capeCount(k), info = capeInfo(k);
    return 'Ticks itself from the ' + esc(info.name.toLowerCase()) + ': ' + (n ? '<b>' + n.done + ' / ' + n.total + '</b>' : 'not read yet') +
      ' · <button class="qlink" type="button" data-cape="' + k + '">Open it</button>';
  }

  // ---------- tabs and parts ----------
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'; }
  // A tab per category, the biggest first. With more than four, the fourth is Other: the rest together.
  function capeTabs(c) {
    var n = {}, cats = [];
    c.cheevos.forEach(function (x) { if (!n[x.cat]) { n[x.cat] = 0; cats.push(x.cat); } n[x.cat]++; });
    cats.sort(function (a, b) { return n[b] - n[a] || (a < b ? -1 : a > b ? 1 : 0); });
    var own = cats.length <= 4 ? cats : cats.slice(0, 3);
    var tabs = own.map(function (cat) { return { id: slug(cat), name: cat, cats: [cat] }; });
    if (cats.length > 4) tabs.push({ id: 'other', name: 'Other', cats: cats.slice(3) });
    return tabs;
  }
  // The parts of a tab: a part per subcategory with three or more achievements, the biggest first, and the rest
  // together ("More skills"). In Other: a part per category.
  function capeParts(c, tab) {
    var list = c.cheevos.filter(function (x) { return tab.cats.indexOf(x.cat) >= 0; }), out = [];
    function add(name, key, items) { if (items.length) out.push({ key: tab.id + ':' + key, name: name, items: items }); }
    if (tab.cats.length > 1) {
      tab.cats.forEach(function (cat) { add(cat, slug(cat), list.filter(function (x) { return x.cat === cat; })); });
      return out;
    }
    var n = {}, subs = [];
    list.forEach(function (x) { if (x.sub && !n[x.sub]) { n[x.sub] = 0; subs.push(x.sub); } if (x.sub) n[x.sub]++; });
    var big = subs.filter(function (s) { return n[s] >= 3; }).sort(function (a, b) { return n[b] - n[a] || (a < b ? -1 : a > b ? 1 : 0); });
    big.forEach(function (s) { add(s, slug(s), list.filter(function (x) { return x.sub === s; })); });
    add(big.length ? 'More ' + tab.name.toLowerCase() : tab.name, 'more', list.filter(function (x) { return big.indexOf(x.sub) < 0; }));
    return out;
  }
  // Where to go on: the first part with achievements left, as "Lore · Post-Quest, 53 left".
  function nextText(c) {
    var p = progOf(c.key), tabs = capeTabs(c);
    for (var i = 0; i < tabs.length; i++) {
      var parts = capeParts(c, tabs[i]);
      for (var j = 0; j < parts.length; j++) {
        var left = parts[j].items.filter(function (x) { return !isDone(x, c, p); }).length;
        if (left) return 'Next: ' + tabs[i].name + (parts[j].name !== tabs[i].name ? ' · ' + parts[j].name : '') + ', ' + left + ' left';
      }
    }
    return 'All achievements done.';
  }

  // ---------- the cards, on top of Achievements ----------
  function cardHtml(info) {
    var c = savedCape(info.key), n = c ? capeCount(info.key) : null, full = !!n && n.done >= n.total;
    var body = n ? '<span class="cn">' + (full ? '✓ ' : '') + n.done + ' / ' + plural(n.total, 'achievement', 'achievements') + '</span>' +
        '<progress class="pg" value="' + n.done + '" max="' + n.total + '" aria-hidden="true"></progress><span class="cx">' + esc(nextText(c)) + '</span>' :
      '<span class="cx">Open it to read its achievements from the wiki.</span>';
    return '<button class="cape' + (full ? ' done' : '') + '" type="button" data-cape="' + info.key + '"><img src="' + esc(info.image) + '" alt="" width="48" height="48">' +
      '<span class="cb1"><b>' + esc(info.name) + '</b>' + body + '</span></button>';
  }
  // The Capes group of Achievements (it folds like the areas).
  function capeCardsHtml() {
    var shut = !!S.closed['areas:Capes'];
    return '<h2 class="gh"><button class="ghb" type="button" data-group="Capes" aria-expanded="' + (shut ? 'false' : 'true') + '">' + I.chev +
      '<span class="n">Capes</span><span class="c">' + QG.CAPES.length + '</span></button></h2>' +
      '<div class="capes"' + (shut ? ' hidden' : '') + '>' + QG.CAPES.map(cardHtml).join('') + '</div>';
  }

  // ---------- a cape's page ----------
  // Opens a cape: from storage if it is saved, else from the wiki.
  function openCape(key) {
    var info = capeInfo(key);
    if (!info) return;
    S.error = '';
    var c = savedCape(key);
    // A saved cape opens at once. One saved with another CAPE_VERSION is read again quietly; if that fails, the saved one stays.
    if (c) {
      showCape(key, c);
      if (c.version !== QG.CAPE_VERSION) refreshCape(true);
      return;
    }
    S.loading = info.name;
    renderStart();
    QG.loadCape(key).then(function (nc) {
      S.loading = false;
      S.input = '';
      sset('cape.' + key, nc);
      showCape(key, nc);
    }, function (e) {
      S.loading = false;
      S.error = loadError(e);
      renderStart();
    });
  }
  function showCape(key, c) {
    S.view = 'cape';
    S.cape = c;
    S.capeKey = key;
    S.cprog = loadCprog(key);
    S.resetArmed = 0;
    sset('last', 'cape:' + key);
    renderCape(false);
  }
  function tabNow(tabs) { return tabs.filter(function (t) { return t.id === S.cprog.tab; })[0] || tabs[0]; }
  // When this tab has nothing left to tick: the next tab that has (after this one, then from the start), or null.
  function goTab(c, tabs, t) {
    var i = tabs.indexOf(t), order = tabs.slice(i + 1).concat(tabs.slice(0, i));
    return order.filter(function (x) {
      return c.cheevos.some(function (y) { return x.cats.indexOf(y.cat) >= 0 && !autoOf(y, c) && !isDone(y, c, S.cprog); });
    })[0] || null;
  }
  function capeDotsHtml() {
    return '<button class="ib" type="button" data-menu="menu" id="menu-btn" aria-label="Cape menu" aria-haspopup="true" aria-expanded="false" aria-controls="menu" title="Cape menu">' + I.dots + '</button>' +
      '<div class="menu" id="menu" role="menu" hidden>' +
      '<button class="mi" type="button" role="menuitem" data-act="crefresh">' + I.refresh + 'Refresh from wiki</button>' +
      '<a class="mi" role="menuitem" href="' + esc(S.cape.source) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on wiki</a>' +
      '<hr><button class="mi danger" type="button" role="menuitem" data-act="creset">' + I.reset + '<span>Reset progress</span></button>' +
      '</div>';
  }
  // The levels the cape needs: those above the usual one first, with yours; the usual one as a line ("90 or more in every
  // other skill"). A level you do not have is always listed.
  function needsHtml(c) {
    var n = {}, common = 0;
    c.levels.forEach(function (s) { n[s.level] = (n[s.level] || 0) + 1; if (!common || n[s.level] > n[common]) common = s.level; });
    var low = function (s) { var v = playerLevel(s.skill); return v != null && v < s.level; };
    var shown = c.levels.filter(function (s) { return s.level !== common || low(s); }), rest = c.levels.length - shown.length;
    // too low first, then the highest
    shown.sort(function (a, b) { return (low(b) ? 1 : 0) - (low(a) ? 1 : 0) || b.level - a.level || (a.skill < b.skill ? -1 : 1); });
    return '<h2 class="bh">Skill levels</h2><ul class="skl-list areq">' + shown.map(function (s) { return skillHtml(s, 'li'); }).join('') + '</ul>' +
      (rest ? '<p class="para">And ' + common + ' or more in every other skill (' + rest + ' more).</p>' : '');
  }
  // The quests of the quest list and the miniquests, by name: the quest a "needs" line links to. The names are
  // indexed once for each quest list.
  var questIdx = null, questIdxOf = [];
  function questNamed(name) {
    if (!questIdx || questIdxOf[0] !== S.list || questIdxOf[1] !== S.minis) {
      questIdx = {};
      questIdxOf = [S.list, S.minis];
      ((S.list && S.list.quests) || []).concat((S.minis && S.minis.quests) || []).forEach(function (q) {
        var k = QG.normName(q.t);
        if (!questIdx[k]) questIdx[k] = q.t;
      });
    }
    return questIdx[QG.normName(name)] || '';
  }
  // What an achievement needs, like an area task: "Needs 93 [icon] Magic ✓, Swept Away ✓, Lunar Diplomacy (partial)".
  // Once your character is looked up, what you have gets a green ✓ and what you do not a red ✗ (a level also "+ goal").
  // A quest opens here. A part of a quest ("(partial)") you started gets neither: it may be enough.
  // "One of these" levels gets one mark for the group.
  function needHtml(x) {
    var bits = [], low = false;
    (x.skills || []).forEach(function (s) {
      var v = playerLevel(s.skill);
      if (v != null && v < s.level) low = true;
      bits.push(skillHtml(s, 'span'));
    });
    (x.links || []).forEach(function (l) {
      var q = questNamed(l.name), part = l.partial ? ' (partial)' : '';
      if (!q) { bits.push(esc(l.name) + part); return; }
      var st = playerStatus(q);
      if (S.player && st !== 2 && !(l.partial && st === 1)) low = true;
      bits.push(questBtn(q) + part + questMark(q, l.partial));
    });
    (x.oneOf || []).forEach(function (o) {
      var mark = '';
      if (S.player) {
        var has = o.any.some(function (g) { return g.every(function (s) { var v = playerLevel(s.skill); return v != null && v >= s.level; }); });
        if (!has) low = true;
        mark = ' ' + markHtml(has, has ? 'You have one of these' : 'Too low: you have none of these');
      }
      bits.push(esc(o.text) + mark);
    });
    (x.other || []).forEach(function (o) { bits.push(esc(o)); });
    return bits.length ? '<span class="need' + (low ? ' low' : '') + '">Needs ' + bits.join(', ') + '</span>' : '';
  }
  // An achievement: what to do, what it needs, how (the wiki's tip), the other cape it counts for, and its ⋯ menu.
  // One that ticks itself says from what, instead of what it needs.
  function cheevoHtml(x, c, cur) {
    var a = autoOf(x, c), done = isDone(x, c, S.cprog);
    var also = (x.also || []).filter(function (k) { return k !== c.key && capeInfo(k); }).map(function (k) { return 'the ' + esc(capeInfo(k).name.toLowerCase()); });
    var ext = a ? '<span class="self">' + selfText(a, c) + '</span>' :
      needHtml(x) + (x.tip ? '<div class="howto">' + esc(x.tip) + '</div>' : '');
    if (also.length) ext += '<span class="also">Also counts for ' + also.join(' and ') + '</span>';
    var row = rowHtml('ccb', x.id, done, '<b>' + esc(x.name) + '</b>' + (x.desc ? ' — ' + esc(x.desc) : ''), ext ? '<div class="ext">' + ext + '</div>' : '',
      A.cheevoMenuHtml({ cape: c.key, cheevo: x.id, title: x.name, page: x.page || x.name }));
    if (a) row = row.replace('<input class="cb"', '<input class="cb" disabled');
    return '<li class="step task' + (done ? ' done' : '') + (cur ? ' cur' : '') + (a ? ' auto' : '') + '" data-cheevo="' + esc(x.id) + '">' + row + '</li>';
  }
  // A part that folds open and shut. A finished part starts shut; the app remembers the ones you open or close.
  function capePart(id, name, count, body, done) {
    var v = (S.cprog.open || {})[id];
    return partHtml('data-cpart', id, name, count, body, v === true || v === false ? v : !done, { key: id, done: done });
  }
  function renderCape(keepScroll) {
    var main = byId('main'), top = keepScroll && main ? main.scrollTop : 0;
    var c = S.cape, p = S.cprog, info = capeInfo(S.capeKey), tabs = capeTabs(c), t = tabNow(tabs), parts = capeParts(c, t);
    var doneOf = function (x) { return isDone(x, c, p); };
    var done = c.cheevos.filter(doneOf).length, total = c.cheevos.length, cur = null;
    parts.some(function (g) { cur = g.items.filter(function (x) { return !autoOf(x, c) && !doneOf(x); })[0] || null; return !!cur; });
    var go = cur ? null : goTab(c, tabs, t);
    var body = '<div class="capehd"><img src="' + esc(info.image) + '" alt="" width="48" height="48"><span class="cb1"><span class="cn">' +
      done + ' / ' + plural(total, 'achievement', 'achievements') + '</span><span class="cx">' + esc(info.buy) + '</span></span></div>';
    if (t === tabs[0] && c.levels && c.levels.length) {
      var low = c.levels.filter(function (s) { var v = playerLevel(s.skill); return v != null && v < s.level; }).length;
      var nv = (p.open || {}).needs;
      body += partHtml('data-cpart', 'needs', 'Needs', low ? low + ' too low' : String(c.levels.length), needsHtml(c),
        nv === true || nv === false ? nv : low > 0, { key: 'needs' });
    }
    body += parts.map(function (g) {
      var d = g.items.filter(doneOf).length, full = d === g.items.length;
      return capePart(g.key, esc(g.name), (full ? '✓ ' : '') + d + ' / ' + g.items.length,
        '<ul class="steps">' + g.items.map(function (x) { return cheevoHtml(x, c, x === cur); }).join('') + '</ul>', full);
    }).join('');
    body += '<p class="foot">Achievements: <a href="' + esc(c.source) + '" target="_blank" rel="noopener">RuneScape Wiki</a>, CC BY-NC-SA 3.0. Loaded ' +
      esc(A.dateText(c.fetchedAt)) + '.</p>';
    dropMaps();
    app.innerHTML =
      headerHtml({ title: c.name, back: 'All achievements', more: capeDotsHtml() }) +
      progHtml(done, total, 'Cape progress') +
      // each category with its own count: the achievements done in it
      tabsHtml('Categories', tabs.map(function (x) {
        var items = c.cheevos.filter(function (y) { return x.cats.indexOf(y.cat) >= 0; });
        return tabHtml('data-ctab', x.id, x === t, x.name, '', tabCountHtml(items.filter(doneOf).length, items.length, x === t ? ' id="pg-cnt"' : ''));
      }), 'two') +
      '<main class="scroll' + (S.set.showDone ? ' show-done' : '') + '" id="main" role="tabpanel">' + body + '</main>' +
      // Nothing left to tick in this tab: the button goes to the next tab that has some.
      (go ? nextHtml('cnext', 'Go to ' + esc(go.name)).replace(I.check, I.chev) :
        nextHtml('cnext', cur ? 'Done, next achievement' : done >= total ? 'All achievements done' : 'The rest tick themselves', !cur)) +
      homeBarHtml('areas') +
      toastHtml();
    main = byId('main');
    // Ticking keeps the place; another tab goes to where you left it.
    if (keepScroll) { if (main) main.scrollTop = top; } else restoreScroll();
  }
  function partOfId(id) {
    var c = S.cape, tabs = capeTabs(c), found = null;
    tabs.some(function (t) { return capeParts(c, t).some(function (g) { if (g.items.some(function (x) { return x.id === id; })) { found = g; return true; } return false; }); });
    return found;
  }
  function tickCheevo(id, on) {
    var x = S.cape.cheevos.filter(function (y) { return y.id === id; })[0];
    if (!x || autoOf(x, S.cape)) return;
    tickShared(S.capeKey, x, on);
    // A part you finish folds shut (the next time it is drawn), like an area's tasks.
    var g = partOfId(id);
    if (on && g && S.cprog.open && g.items.every(function (y) { return isDone(y, S.cape, S.cprog); })) delete S.cprog.open[g.key];
    saveCprog();
    renderCape(true);
  }
  // For My list: is this achievement of this cape done, and ticking it there. A cape that is not read yet keeps the tick
  // for when it is; one that ticks itself cannot be ticked.
  function cheevoIsDone(key, id) {
    var c = savedCape(key), x = c && c.cheevos.filter(function (y) { return y.id === id; })[0];
    return x ? isDone(x, c, progOf(key)) : !!progOf(key).ticks[id];
  }
  function tickCheevoIn(key, id, on) {
    var c = savedCape(key), x = c && c.cheevos.filter(function (y) { return y.id === id; })[0];
    if (x && autoOf(x, c)) return;
    tickShared(key, x || { id: id }, on);
  }
  function nextCheevo() {
    var cur = document.querySelector('li[data-cheevo].cur');
    if (!cur) {
      var tabs = capeTabs(S.cape), go = goTab(S.cape, tabs, tabNow(tabs));
      if (go) switchCapeTab(go.id);
      return;
    }
    tickCheevo(cur.getAttribute('data-cheevo'), true);
    var li = document.querySelector('li[data-cheevo].cur');
    if (li) alignTop(li, true);
  }
  function switchCapeTab(id) {
    if (id === S.cprog.tab) return;
    S.cprog.tab = id;
    saveCprog();
    renderCape(false);
  }
  function toggleCapePart(key) {
    var btn = document.querySelector('[data-cpart-btn="' + key + '"]');
    var open = !(btn && btn.getAttribute('aria-expanded') === 'true');
    S.cprog.open = S.cprog.open || {};
    S.cprog.open[key] = open;
    saveCprog();
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var b = btn.parentNode.nextElementSibling;
      if (b) b.hidden = !open;
    }
  }
  function capeReset(btn) {
    if (S.resetArmed && Date.now() - S.resetArmed < 4000) {
      S.cprog.ticks = {};
      S.cprog.open = {};
      S.resetArmed = 0;
      saveCprog();
      renderCape(false);
      toast('Progress reset.');
      return;
    }
    S.resetArmed = Date.now();
    btn.querySelector('span').textContent = 'Click again to reset';
  }
  function refreshCape(silent) {
    var key = S.capeKey;
    if (!silent) toast('Reading the wiki…', 0);
    QG.loadCape(key).then(function (nc) {
      sset('cape.' + key, nc);
      if (S.view !== 'cape' || S.capeKey !== key) return;
      S.cape = nc;
      renderCape(true);
      if (!silent) toast('Updated from the wiki.');
    }, function (e) { if (!silent) toast('Could not update. ' + loadError(e)); });
  }
  // For the export: is this achievement of a saved cape done (ticked, or ticked by itself)?
  function cheevoDone(key, x) {
    var c = savedCape(key);
    return !!c && isDone(x, c, progOf(key));
  }

  A.share({ autoOf: autoOf, capeCardsHtml: capeCardsHtml, capeReset: capeReset, cheevoDone: cheevoDone, cheevoIsDone: cheevoIsDone, loadCprog: loadCprog,
    tickCheevoIn: tickCheevoIn,
    nextCheevo: nextCheevo, openCape: openCape, refreshCape: refreshCape, renderCape: renderCape, savedCape: savedCape,
    switchCapeTab: switchCapeTab, tickCheevo: tickCheevo, toggleCapePart: toggleCapePart });
  A.loaded.capes = true;
})(window.QuickGuideApp);
