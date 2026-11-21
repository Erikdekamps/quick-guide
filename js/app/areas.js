/*!
 * Quick Guide - js/app/areas.js
 * Area Tasks: saved areas and the task index, the list of tiers and search, and one area.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var cssq = A.cssq, restoreScroll = A.restoreScroll, acc = A.acc, alignTop = A.alignTop, app = A.app, byId = A.byId, dateText = A.dateText, drawList = A.drawList,
    dropMaps = A.dropMaps, esc = A.esc, headerHtml = A.headerHtml, homeBarHtml = A.homeBarHtml, HOMES = A.HOMES, I = A.I, liHtml = A.liHtml,
    nextHtml = A.nextHtml, partHtml = A.partHtml, pick = A.pick, playerLevel = A.playerLevel,
    playerStatus = A.playerStatus, plural = A.plural, progHtml = A.progHtml, QG = A.QG, questBtn = A.questBtn,
    questMark = A.questMark, renderStart = A.renderStart, rowHtml = A.rowHtml, S = A.S, saveSettings = A.saveSettings,
    sget = A.sget, skillHtml = A.skillHtml, sset = A.sset, tabCountHtml = A.tabCountHtml, tabHtml = A.tabHtml, tabsHtml = A.tabsHtml,
    textOf = A.textOf, toastHtml = A.toastHtml;

  // ---------- Area Tasks: saved areas and the task index ----------
  function ametaAll() { A.flushLater(); var m = sget('ameta'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  // Your ticks in an area: { v, tasks: { id: 1 }, tier (the tab), open (parts you folded) }. v is the shape they are
  // saved in: a change to it raises APROG_VERSION, and loadAprog upgrades older ones (version 1 is the first).
  var APROG_VERSION = 1;
  function loadAprog(name) {
    var p = sget('aprog.' + name);
    if (!p || typeof p !== 'object') p = {};
    if (!p.tasks || typeof p.tasks !== 'object') p.tasks = {};
    p.v = APROG_VERSION;
    return p;
  }
  // Your ticks are saved at once; the area list's counts a moment later (writeLater in core.js).
  function saveAprog() {
    var name = S.areaKey, a = S.area, p = S.aprog;
    sset('aprog.' + name, p);
    A.writeLater('ameta.' + name, function () { writeAmeta(name, a, p); });
  }
  // What the area list needs to know, per tier: how many tasks, how many are done, how many are new and not done yet,
  // and what the tier needs.
  function writeAmeta(name, a, p) {
    var m = ametaAll(), old = (m[name] && m[name].tiers) || [];
    m[name] = {
      at: Date.now(),
      tiers: a.tiers.map(function (t) {
        var o = old.filter(function (x) { return x.id === t.id; })[0] || {};
        return {
          id: t.id, name: t.name, total: t.tasks.length, done: t.tasks.filter(function (x) { return p.tasks[x.id]; }).length,
          fresh: t.tasks.filter(function (x) { return A.isNew(x.newAt) && !p.tasks[x.id]; }).length,
          needs: t.skills ? { skills: t.skills, quests: t.quests } : o.needs
        };
      })
    };
    sset('ameta', m);
  }
  // The index of every task, kept small so all 13 areas can be searched: { "<area>": { v, tiers: [{ id, name, tasks: [{ id, name, subs: [ids] }] }] } }
  function aidxAll() { var m = sget('aidx'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  // Puts an area in the index. It is only written when the area's entry changed: the index holds every area.
  function indexArea(name, a) {
    var ix = aidxAll(), entry = { v: a.version, tiers: a.tiers.map(function (t) {
      return { id: t.id, name: t.name, tasks: t.tasks.map(function (x) {
        var o = { id: x.id, name: x.name, subs: (x.subs || []).map(function (u) { return u.id; }) };
        if (x.newAt) o.newAt = x.newAt;
        return o;
      }) };
    }) };
    if (!ix[name] || JSON.stringify(ix[name]) !== JSON.stringify(entry)) {
      ix[name] = entry;
      sset('aidx', ix);
    }
    writeAmeta(name, a, loadAprog(name));
  }
  // Needs you do not meet yet (only known with a player): [skills too low, quests not done]
  function unmet(n) {
    if (!S.player || !n) return { skills: [], quests: [] };
    return {
      skills: (n.skills || []).filter(function (x) { var v = playerLevel(x.skill); return v != null && v < x.level; }),
      quests: (n.quests || []).filter(function (q) { return playerStatus(q) !== 2; })
    };
  }
  // One row of the list for each tier of each area. The tiers come from the saved index once an area is known.
  function allTiers() {
    var ix = aidxAll(), am = ametaAll(), out = [];
    QG.AREAS.forEach(function (a) {
      var known = ix[a.name] && ix[a.name].tiers, m = am[a.name] && am[a.name].tiers || [];
      (known || a.tiers.map(function (n) { return { id: n.toLowerCase(), name: n, tasks: null }; })).forEach(function (t) {
        var mt = m.filter(function (x) { return x.id === t.id; })[0];
        var total = mt ? mt.total : t.tasks ? t.tasks.length : 0, done = mt ? mt.done : 0;
        var u = unmet(mt && mt.needs);
        var full = total > 0 && done >= total, started = done > 0 && !full;
        out.push({ area: a.name, id: t.id, name: t.name, total: total, done: done, full: full, started: started, fresh: (mt && mt.fresh) || 0,
          locked: !full && !started && u.skills.length + u.quests.length > 0 });
      });
    });
    return out;
  }
  function subId(u) { return typeof u === 'string' ? u : u.id; }
  // Every task and sub-step by id, with the task it belongs to.
  function taskIndex(a) {
    var idx = {};
    a.tiers.forEach(function (t) {
      t.tasks.forEach(function (x) {
        idx[x.id] = { task: x, parent: null };
        (x.subs || []).forEach(function (u) { idx[subId(u)] = { task: x, parent: x.id, sub: u }; });
      });
    });
    return idx;
  }
  // Sets a task or sub-step in a set of ticks. A task ticks all its steps; a task is done when all its steps are.
  function setTick(ticks, idx, id, on) {
    var e = idx[id];
    function put(k, v) { if (v) ticks[k] = 1; else delete ticks[k]; }
    put(id, on);
    if (!e) return;
    if (!e.parent) (e.task.subs || []).forEach(function (u) { put(subId(u), on); });
    else put(e.parent, e.task.subs.every(function (u) { return ticks[subId(u)]; }));
  }
  function missingAreas() {
    var ix = aidxAll();
    return QG.AREAS.filter(function (a) { return !ix[a.name] || ix[a.name].v !== QG.AREA_VERSION; }).map(function (a) { return a.name; });
  }
  // Reads every area, so all tasks can be searched. Done once: later searches use the saved index.
  function loadAllAreas() {
    if (S.aidxBusy) return;
    var todo = missingAreas().filter(function (n) { return S.aidxFail.indexOf(n) < 0; });
    if (!todo.length) return;
    S.aidxBusy = true;
    var running = 0, next = 0;
    function pump() {
      while (running < 3 && next < todo.length) start(todo[next++]);
      if (!running && next >= todo.length) {
        S.aidxBusy = false;
        drawList();
        var w = S.aidxWait;
        S.aidxWait = [];
        w.forEach(function (fn) { fn(); });
      }
    }
    function start(name) {
      running++;
      // An area that cannot be read, or cannot be kept (what was saved of it is broken), counts as failed: the
      // others go on, and the reading always ends.
      QG.loadArea(name).then(function (na) { var old = sget('area.' + name); A.markNew(old && taskList(old), taskList(na)); sset('area.' + name, na); indexArea(name, na); })
        .then(null, function () { S.aidxFail.push(name); }).then(function () { running--; pump(); drawList(); });
    }
    pump();
  }
  // Runs fn once every area that can be read is read (at once when they all are).
  function whenAreasRead(fn) {
    var todo = missingAreas().filter(function (n) { return S.aidxFail.indexOf(n) < 0; });
    if (!todo.length && !S.aidxBusy) { fn(); return; }
    S.aidxWait.push(fn);
    loadAllAreas();
  }

  // ---------- Area Tasks: the list of tiers, and search ----------
  function tierRow(x) {
    var status = '', bar = '';
    if (x.started) {
      status = '<span class="qs">' + x.done + ' / ' + x.total + '</span>';
      bar = '<progress class="pg" value="' + x.done + '" max="' + x.total + '" aria-hidden="true"></progress>';
    } else if (x.full) status = '<span class="qs ok">✓ Done</span>';
    else if (x.locked) status = '<span class="qs lk">' + I.lock + 'Locked</span>';
    return '<li><button class="q' + (x.full ? ' done' : x.started ? ' started' : x.locked ? ' locked' : '') + '" type="button" data-area="' + esc(x.area) + '" data-atier="' + esc(x.id) + '"' +
      (x.locked ? ' title="You do not have what this tier needs yet"' : '') + '>' +
      '<span class="q1"><b>' + esc(x.area + ' ' + x.name) + '</b>' + status + '</span>' +
      (x.total ? '<span class="q2">' + plural(x.total, 'task', 'tasks') + (x.fresh ? ' \u00b7 ' + x.fresh + ' new' : '') + '</span>' : '') + bar + '</button></li>';
  }
  // What a search finds: tiers by "area tier" name, tasks by their own name.
  function areaMatches(v) {
    var n = String(v || '').toLowerCase().trim(), ix = aidxAll(), tasks = [];
    var tiers = allTiers().filter(function (t) { return !n || (t.area + ' ' + t.name).toLowerCase().indexOf(n) >= 0; });
    if (n) {
      QG.AREAS.forEach(function (a) {
        ((ix[a.name] && ix[a.name].tiers) || []).forEach(function (t) {
          t.tasks.forEach(function (x) { if (x.name.toLowerCase().indexOf(n) >= 0) tasks.push({ area: a.name, tier: t, task: x }); });
        });
      });
    }
    return { tiers: tiers, tasks: tasks };
  }
  function taskResult(r, ticks) {
    var done = !!ticks[r.task.id];
    var where = '<div class="ext"><button class="qlink where" type="button" data-area="' + esc(r.area) + '" data-atier="' + esc(r.tier.id) + '">' + esc(r.area + ' ' + r.tier.name) + '</button></div>';
    return '<li class="step task srch' + (done ? ' done' : '') + '" data-task="' + esc(r.task.id) + '">' + rowHtml('acb', r.task.id, done, '<b>' + esc(r.task.name) + '</b>', where,
      A.taskMenuHtml({ area: r.area, tier: r.tier.id, tname: r.tier.name, task: r.task.id, title: r.task.name }), ' data-aarea="' + esc(r.area) + '"') + '</li>';
  }
  function groupHtml(key, title, count, inner) {
    var shut = !!S.closed['areas:' + key];
    return '<h2 class="gh"><button class="ghb" type="button" data-group="' + esc(key) + '" aria-expanded="' + (shut ? 'false' : 'true') + '">' +
      I.chev + '<span class="n">' + esc(title) + '</span><span class="c">' + count + '</span></button></h2><ul class="' + (inner.steps ? 'steps ' : '') + 'ql"' + (shut ? ' hidden' : '') + '>' + inner.html + '</ul>';
  }
  function areaListHtml() {
    var v = S.input.trim(), h = '', total = QG.AREAS.length;
    var tiers = allTiers(), res = null;
    if (v) { res = areaMatches(v); tiers = res.tiers; }
    var areas = {};
    tiers.forEach(function (t) { areas[t.area] = 1; });
    var n = Object.keys(areas).length;
    // "3 capes · 13 areas · Zezima" (a search shows areas and tasks only)
    h += '<p class="qmeta">' + (v ? '' : plural(QG.CAPES.length, 'cape', 'capes') + ' · ') + '<span id="qcount">' + (n === total ? plural(n, 'area', 'areas') : n + ' of ' + plural(total, 'area', 'areas')) + '</span>' +
      (S.player ? '<span class="how"> · ' + esc(S.player.name) + '</span>' : '') + '</p>';
    if (v) {
      var have = QG.AREAS.length - missingAreas().length;
      if (S.aidxBusy) h += '<div class="state" role="status">' + I.loader + '<p>Reading the areas so their tasks can be searched… ' + have + ' / ' + total + '</p></div>';
      var failed = S.aidxFail.filter(function (a) { return missingAreas().indexOf(a) >= 0; });
      if (!S.aidxBusy && failed.length) {
        h += '<p class="err pad">Could not read ' + plural(failed.length, 'area', 'areas') + ' (' + esc(failed.join(', ')) + '), so ' + (failed.length === 1 ? 'its' : 'their') + ' tasks cannot be searched yet. ' +
          '<button class="btn" type="button" data-act="areas-retry">Try again</button></p>';
      }
      if (tiers.length) h += groupHtml('Areas', 'Areas', tiers.length, { html: tiers.map(tierRow).join('') });
      if (res.tasks.length) {
        var pc = {};
        res.tasks.slice(0, 100).forEach(function (r) { if (!pc[r.area]) pc[r.area] = loadAprog(r.area).tasks; });
        h += groupHtml('Tasks', 'Tasks', res.tasks.length, { steps: true, html: res.tasks.slice(0, 100).map(function (r) { return taskResult(r, pc[r.area]); }).join('') });
      }
      if (!tiers.length && !res.tasks.length && !S.aidxBusy) h += '<p class="empty">Nothing matches “' + esc(v) + '”.</p>';
      return h;
    }
    // The capes first, as cards; then the areas.
    h += A.capeCardsHtml();
    // The same switches as for quests: done and locked tiers stay out when they are off.
    if (S.set.hideDone) tiers = tiers.filter(function (t) { return !t.full; });
    if (S.set.hideLocked) tiers = tiers.filter(function (t) { return !t.locked; });
    // Each tier stays in its own area, in the game's order; a started one has its progress bar right there.
    QG.AREAS.forEach(function (a) {
      var rows = tiers.filter(function (t) { return t.area === a.name; });
      if (rows.length) h += groupHtml(a.name, a.name, rows.length, { html: rows.map(tierRow).join('') });
    });
    if (!tiers.length) h += '<p class="empty">All tiers are done or locked. Tick “Done quests and tiers” or “Locked quests and tiers” in Settings to see them.</p>';
    return h;
  }
  // Ticks a task from the search results, without opening its area.
  function tickInArea(name, id, on) {
    var ix = aidxAll()[name];
    if (!ix) return;
    var p = loadAprog(name);
    setTick(p.tasks, taskIndex(ix), id, on);
    sset('aprog.' + name, p);
    writeAmeta(name, ix, p);
    drawList();
  }
  function setHome(h) {
    S.set.home = pick(HOMES, h, 'quests');
    saveSettings();
    S.input = '';
    S.error = '';
    // From a quest or an area, a tab leaves it. From Settings too: a reload opens the list.
    A.sdel('last');
    renderStart();
    A.saveView(true);
  }

  // ---------- Area Tasks: one area ----------
  // Opens an area (at a tier): from storage if it is saved, else from the wiki.
  // a: the saved area, when the caller read it already.
  function openArea(name, tier, a) {
    a = a || sget('area.' + name);
    A.openPage({ key: 'area.' + name, saved: a && Array.isArray(a.tiers) && a.tiers.length ? a : null, version: QG.AREA_VERSION, label: name,
      load: function () { return QG.loadArea(name); }, show: function (p) { showArea(name, p, tier); }, refresh: refreshArea });
  }
  function showArea(name, a, tier) {
    A.enterPage('area', 'area:' + name);
    S.area = a;
    S.areaKey = name;
    indexArea(name, a);
    S.aprog = loadAprog(name);
    if (tier && a.tiers.some(function (t) { return t.id === tier; }) && S.aprog.tier !== tier) { S.aprog.tier = tier; sset('aprog.' + name, S.aprog); }
    renderArea(false);
  }
  function tierNow() {
    var t = S.area.tiers.filter(function (x) { return x.id === S.aprog.tier; })[0];
    return t || S.area.tiers[0];
  }
  function areaDotsHtml() {
    var t = tierNow();
    return '<button class="ib" type="button" data-menu="menu" id="menu-btn" aria-label="Area menu" aria-haspopup="true" aria-expanded="false" aria-controls="menu" title="Area menu">' + I.dots + '</button>' +
      '<div class="menu" id="menu" role="menu" hidden>' + A.addToItemHtml('tier', { area: S.areaKey, tier: t.id, tname: t.name }) + '<hr>' +
      '<button class="mi" type="button" role="menuitem" data-act="arefresh">' + I.refresh + 'Refresh from wiki</button>' +
      '<a class="mi" role="menuitem" href="' + esc(S.area.source) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on wiki</a>' +
      '<hr><button class="mi danger" type="button" role="menuitem" data-act="areset">' + I.reset + '<span>Reset progress</span></button>' +
      '</div>';
  }
  function needText(n) {
    var bits = [], low = false;
    (n.skills || []).forEach(function (x) {
      var v = playerLevel(x.skill);
      if (v != null && v < x.level) low = true;
      bits.push(skillHtml(x, 'span'));
    });
    (n.quests || []).forEach(function (q) {
      var got = playerStatus(q) === 2;
      if (S.player && !got) low = true;
      bits.push(esc(q) + questMark(q));
    });
    (n.other || []).forEach(function (o) { bits.push(esc(textOf(o))); });
    return bits.length ? '<span class="need' + (low ? ' low' : '') + '">Needs ' + bits.join(', ') + '</span>' : '';
  }
  function areaNeedsHtml(t) {
    var h = '';
    if (t.skills.length) {
      // One line each, like the wiki: "16 [icon] Thieving ✓".
      h += '<h2 class="bh">Skill levels</h2><ul class="skl-list areq">' + t.skills.map(function (s) { return skillHtml(s, 'li'); }).join('') + '</ul>';
    }
    if (t.quests.length) {
      h += '<h2 class="bh">Quests</h2><ul class="tree areq">' + t.quests.map(function (q) {
        var have = playerStatus(q) === 2;
        return '<li' + (have ? ' class="got"' : '') + '>' + questBtn(q) + questMark(q) + '</li>';
      }).join('') + '</ul>';
    }
    if (t.other.length) h += '<h2 class="bh">Also needed</h2>' + t.other.map(function (o) { return '<p class="para">' + o + '</p>'; }).join('');
    var boxes = '';
    if (t.items.length) boxes += acc(I.bag, 'Items to bring', String(t.items.length), '<ul class="plain">' + t.items.map(liHtml).join('') + '</ul>');
    if (t.ironman) boxes += acc('', 'Ironmen', '', '<p class="para">' + t.ironman + '</p>', false);
    if (boxes) h += '<div class="blk">' + boxes + '</div>';
    return h;
  }
  function areaTaskHtml(x, cur, t) {
    var done = !!S.aprog.tasks[x.id];
    var ext = needText(x) + (x.notes ? '<div class="howto">' + x.notes + '</div>' : '');
    var subs = (x.subs || []).map(function (u) {
      var d = !!S.aprog.tasks[u.id];
      return '<li class="step task' + (d ? ' done' : '') + '" data-task="' + esc(u.id) + '">' +
        rowHtml('acb', u.id, d, u.html, u.notes && u.notes.length ? '<div class="ext"><div class="howto">' + u.notes.join('<br>') + '</div></div>' : '') + '</li>';
    }).join('');
    return '<li class="step task' + (done ? ' done' : '') + (cur ? ' cur' : '') + '" data-task="' + esc(x.id) + '">' +
      rowHtml('acb', x.id, done, '<b>' + esc(x.name) + '</b>' + (A.isNew(x.newAt) && !done ? A.newTagHtml() : '') + (x.desc ? ' \u2014 ' + esc(x.desc) : ''), ext ? '<div class="ext">' + ext + '</div>' : '',
        A.taskMenuHtml({ area: S.areaKey, tier: t.id, tname: t.name, task: x.id, title: x.name })) +
      (subs ? '<ul class="steps subs">' + subs + '</ul>' : '') + '</li>';
  }
  // A part of an area tier that folds open and shut. The app remembers it per tier.
  // A finished list of tasks starts shut; opening it shows the done tasks, so you can untick one.
  function areaSec(id, name, count, body, done) {
    var key = tierNow().id + ':' + id, v = (S.aprog.open || {})[key];
    var open = v === true || v === false ? v : !done;
    return partHtml('data-asec', id, name, count, body, open, { key: key, done: done });
  }
  function toggleAreaSec(key) { A.togglePart(document.querySelector('[data-asec-btn="' + cssq(key) + '"]'), S.aprog, key, saveAprog); }
  function renderArea(keepScroll) {
    var main = byId('main'), top = keepScroll && main ? main.scrollTop : 0;
    var a = S.area, t = tierNow();
    var done = t.tasks.filter(function (x) { return S.aprog.tasks[x.id]; }).length;
    var cur = t.tasks.filter(function (x) { return !S.aprog.tasks[x.id]; })[0];
    var u = unmet(t), low = u.skills.length;
    var r = t.reward, reward = '';
    if (r && (r.items.length || r.perks.length || r.intro)) {
      reward = '<div class="blk" style="margin-top:14px">' + acc(I.trophy, 'Rewards', '', (r.intro ? '<p class="para">' + r.intro + '</p>' : '') +
        (r.items.length ? '<ul class="plain">' + r.items.map(liHtml).join('') + '</ul>' : '') +
        (r.perks.length ? '<h2 class="bh">What it does</h2><ul class="plain">' + r.perks.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '')) + '</div>';
    }
    dropMaps();
    app.innerHTML =
      headerHtml({ title: a.name, back: 'All achievements', more: areaDotsHtml() }) +
      progHtml(done, t.tasks.length, 'Tier progress') +
      // each tier with its own count: the tasks done in it
      tabsHtml('Tiers', a.tiers.map(function (x) {
        var d = x.tasks.filter(function (k) { return S.aprog.tasks[k.id]; }).length;
        return tabHtml('data-tier', x.id, x === t, x.name, '', tabCountHtml(d, x.tasks.length, x === t ? ' id="pg-cnt"' : ''));
      }), 'two') +
      '<main class="scroll' + (S.set.showDone ? ' show-done' : '') + '" id="main" role="tabpanel">' +
      (t.skills.length + t.quests.length + t.other.length + t.items.length || t.ironman ?
        areaSec('needs', 'Needs', low ? low + ' too low' : String(t.skills.length + t.quests.length), areaNeedsHtml(t)) : '') +
      areaSec('tasks', 'Tasks', (cur ? '' : '\u2713 ') + done + ' / ' + t.tasks.length, '<ul class="steps">' + t.tasks.map(function (x) { return areaTaskHtml(x, x === cur, t); }).join('') + '</ul>', !cur) +
      reward +
      '<p class="foot">Tasks: <a href="' + esc(a.source) + '" target="_blank" rel="noopener">RuneScape Wiki</a>, CC BY-NC-SA 3.0. Loaded ' + esc(dateText(a.fetchedAt)) + '.</p>' +
      '</main>' +
      nextHtml('anext', cur ? 'Done, next task' : 'All tasks done', !cur) +
      homeBarHtml('areas') +
      toastHtml();
    main = byId('main');
    // Ticking keeps the place; another tier goes to where you left it.
    if (keepScroll) { if (main) main.scrollTop = top; } else restoreScroll();
  }
  function tickTask(id, on) {
    setTick(S.aprog.tasks, taskIndex(S.area), id, on);
    var t = tierNow();
    if (on && S.aprog.open && t.tasks.every(function (x) { return S.aprog.tasks[x.id]; })) delete S.aprog.open[t.id + ':tasks'];
    saveAprog();
    if (!updateArea()) renderArea(true);
  }
  // After a tick: the counts, and the task rows that changed, without drawing the screen again. False when the tier
  // was done, or is now (the part folds, the button changes): then the screen is drawn again.
  function updateArea() {
    var main = byId('main'), t = tierNow();
    var cur = t.tasks.filter(function (x) { return !S.aprog.tasks[x.id]; })[0];
    if (!cur || byId('next-btn').disabled) return false;
    var done = t.tasks.length - t.tasks.filter(function (x) { return !S.aprog.tasks[x.id]; }).length;
    var pg = byId('pg'), cnt = byId('pg-cnt'), sc = main.querySelector('[data-asec="tasks"] .sech .c');
    if (pg) pg.value = done;
    if (cnt) cnt.textContent = done + ' / ' + t.tasks.length;
    if (sc) sc.textContent = done + ' / ' + t.tasks.length;
    t.tasks.forEach(function (x) {
      var li = main.querySelector('li[data-task="' + cssq(x.id) + '"]:not(.subs li)');
      var same = li.classList.contains('done') === !!S.aprog.tasks[x.id] && li.classList.contains('cur') === (x === cur) &&
        (x.subs || []).every(function (u) {
          var s = li.querySelector('li[data-task="' + cssq(u.id) + '"]');
          return !s || s.classList.contains('done') === !!S.aprog.tasks[u.id];
        });
      if (!same) li.outerHTML = areaTaskHtml(x, x === cur, t);
    });
    return true;
  }
  function nextTask() {
    var t = tierNow(), cur = t.tasks.filter(function (x) { return !S.aprog.tasks[x.id]; })[0];
    if (!cur) return;
    tickTask(cur.id, true);
    var li = document.querySelector('li[data-task].cur');
    if (li) alignTop(li, true);
  }
  function switchTier(id) {
    S.aprog.tier = id;
    saveAprog();
    renderArea(false);
  }
  // Every task of an area, in all its tiers.
  function taskList(a) { return [].concat.apply([], a.tiers.map(function (t) { return t.tasks; })); }
  function areaReset(btn) { A.resetTwice(btn, function () { S.aprog.tasks = {}; saveAprog(); renderArea(false); }); }
  // Reads a saved area again and keeps it; tasks that are new say so. The area on screen is drawn again.
  // Gives how many tasks are new.
  function reloadArea(name, old) {
    var na = null;
    return A.reloadPage({ key: 'area.' + name, old: old, load: function () { return QG.loadArea(name).then(function (p) { na = p; return p; }); },
      items: taskList,
      kept: function (p) { indexArea(name, p); },
      here: function () { return S.areaKey === name && !!S.area; },
      use: function (p) { S.area = p; },
      draw: function () { if (S.view === 'area' && S.area === na) renderArea(true); } });
  }
  function refreshArea(silent) { A.refreshPage(silent, function () { return reloadArea(S.areaKey, S.area); }, 'area', 'new task', 'new tasks'); }

  A.share({ aidxAll: aidxAll, ametaAll: ametaAll, areaListHtml: areaListHtml, areaMatches: areaMatches,
    areaReset: areaReset, loadAllAreas: loadAllAreas, loadAprog: loadAprog, missingAreas: missingAreas,
    nextTask: nextTask, openArea: openArea, refreshArea: refreshArea, reloadArea: reloadArea, renderArea: renderArea,     setHome: setHome, setTick: setTick, subId: subId, switchTier: switchTier, taskIndex: taskIndex,
    tickInArea: tickInArea, tickTask: tickTask, toggleAreaSec: toggleAreaSec, whenAreasRead: whenAreasRead,
    writeAmeta: writeAmeta });
  A.loaded.areas = true;
})(window.QuickGuideApp);
