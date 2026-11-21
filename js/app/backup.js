/*!
 * Quick Guide - js/app/backup.js
 * Export and import: every quest and area task as an editable JSON file.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var aidxAll = A.aidxAll, allQuests = A.allQuests, ametaAll = A.ametaAll, app = A.app,
    applySettings = A.applySettings, byId = A.byId, clampFont = A.clampFont, closeMenus = A.closeMenus, D = A.D,
    HOMES = A.HOMES, I = A.I, loadAprog = A.loadAprog, loadProg = A.loadProg, markedDone = A.markedDone,
    memory = A.memory, metaAll = A.metaAll, missingAreas = A.missingAreas, pick = A.pick,
    playerStatus = A.playerStatus, plural = A.plural, PREFIX = A.PREFIX, QG = A.QG, remember = A.remember,
    renderStart = A.renderStart, S = A.S, saveSettings = A.saveSettings, setMarked = A.setMarked, setTick = A.setTick,
    sget = A.sget, sortKey = A.sortKey, SORTS = A.SORTS, sset = A.sset, subId = A.subId, taskIndex = A.taskIndex,
    textOf = A.textOf, THEMES = A.THEMES, toast = A.toast, topSteps = A.topSteps, validTab = A.validTab,
    whenAreasRead = A.whenAreasRead, writeAmeta = A.writeAmeta;

  // ---------- export and import ----------
  // Everything you ticked, your settings, your player and My list, as text. Guides and quest lists are not in it: the app reads them from the wiki.
  var FORMAT = 2;
  var BOOL_SETTINGS = ['showDone', 'hideDone', 'hideLocked', 'hideMini'];
  function storageKeys(prefix) {
    var out = {};
    Object.keys(memory).forEach(function (m) { if (m.indexOf(prefix) === 0) out[m.slice(prefix.length)] = 1; });
    try {
      var ls = window.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(PREFIX + prefix) === 0) out[k.slice(PREFIX.length + prefix.length)] = 1;
      }
    } catch (e) { /* blocked */ }
    return Object.keys(out).sort();
  }
  function ticked(map) { var o = {}; Object.keys(map || {}).forEach(function (k) { if (map[k]) o[k] = 1; }); return o; }
  // A line of the file: "<code> <what it says>", all of it, so you can tell what you tick.
  function lineKey(id, label) {
    label = String(label || '').replace(/\s+/g, ' ').trim();
    return label ? id + ' ' + label : String(id);
  }
  // Every step and item of a saved guide, in order, with what it says.
  function questLines(q) {
    var steps = [], items = [];
    function step(st) { steps.push([st.id, st.text || textOf(st.html)]); (st.substeps || []).forEach(function (c) { if (c.type === 'step') step(c); }); }
    [q.requiredItems, q.recommendedItems].forEach(function (g) { ((g && g.items) || []).forEach(function (it) { if (it && it.id) items.push([it.id, it.text || textOf(it.html)]); }); });
    (q.sections || []).forEach(function (sec) {
      sec.blocks.forEach(function (b) {
        if (b.type === 'step') step(b);
        else if (b.type === 'bring') (b.needed || []).concat(b.recommended || []).forEach(function (it) { if (it && it.id) items.push([it.id, it.text || textOf(it.html)]); });
      });
    });
    return { steps: steps, items: items };
  }
  // The file: every quest and every area task, each true (done) or false, and your lists of goals, so you can change them
  // by hand and import it again.
  function buildExport() {
    var m = metaAll(), byTitle = {}, progs = {}, quests = {}, areas = {}, titles = [];
    Object.keys(m).forEach(function (k) { byTitle[D.norm(m[k].title)] = k; });
    storageKeys('prog.').forEach(function (k) { progs[k] = 1; });
    allQuests().forEach(function (q) { titles.push(q.t); });
    // Quests the game knows that the wiki's list does not have (parts of a bigger quest, like Recipe for Disaster):
    // they count in the game's number of done quests, so they are in the file too.
    var known = {}, pt = (S.player && S.player.titles) || {};
    titles.forEach(function (t) { known[QG.normName(t)] = 1; });
    Object.keys(pt).forEach(function (k) { if (!known[k] && S.player.quests[k] != null) { titles.push(pt[k]); known[k] = 1; } });
    Object.keys(m).forEach(function (k) { if (progs[k] && titles.every(function (t) { return D.norm(t) !== D.norm(m[k].title); })) titles.push(m[k].title); });
    titles.sort(function (a, b) { return sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0; });
    titles.forEach(function (title) {
      var key = byTitle[D.norm(title)] || title + '/Quick guide', me = m[key];
      var done = (!!me && me.total > 0 && me.done >= me.total) || playerStatus(title) === 2 || markedDone(title);
      var q = sget('quest.' + key), p = progs[key] ? loadProg(key) : null;
      var ticks = p ? Object.keys(ticked(p.steps)).length + Object.keys(ticked(p.items)).length : 0;
      // A done quest is just true: its steps would only fill the file.
      if (done || (!q && !ticks)) { quests[title] = done; return; }
      var e = {};
      if (key !== title + '/Quick guide') e.page = key;
      e.done = done;
      if (me && me.total) e.progress = me.done + ' / ' + me.total;
      var st = {}, it = {}, pr = p || { steps: {}, items: {} };
      if (q) {
        var L = questLines(q);
        L.steps.forEach(function (x) { st[lineKey(x[0], x[1])] = !!pr.steps[x[0]]; });
        L.items.forEach(function (x) { it[lineKey(x[0], x[1])] = !!pr.items[x[0]]; });
      } else {
        Object.keys(ticked(pr.steps)).forEach(function (id) { st[id] = true; });
        Object.keys(ticked(pr.items)).forEach(function (id) { it[id] = true; });
      }
      e.steps = st;
      e.items = it;
      quests[title] = e;
    });
    var ix = aidxAll(), counts = {};
    QG.AREAS.forEach(function (a) {
      var x = ix[a.name];
      if (!x) return;
      var pc = loadAprog(a.name), c = counts[a.name] = {};
      x.tiers.forEach(function (t) { c[t.name] = t.tasks.filter(function (tk) { return pc.tasks[tk.id]; }).length + ' / ' + t.tasks.length; });
      var full = sget('area.' + a.name), subs = {}, p = loadAprog(a.name), out = {};
      ((full && full.tiers) || []).forEach(function (t) { t.tasks.forEach(function (tk) { (tk.subs || []).forEach(function (u) { subs[u.id] = textOf(u.html); }); }); });
      x.tiers.forEach(function (t) {
        var tier = {};
        t.tasks.forEach(function (tk) {
          var k = tk.id + ' ' + tk.name;
          if (!tk.subs || !tk.subs.length) { tier[k] = !!p.tasks[tk.id]; return; }
          var steps = {};
          tk.subs.forEach(function (u) { var uid = subId(u); steps[lineKey(uid, subs[uid])] = !!p.tasks[uid]; });
          tier[k] = { done: !!p.tasks[tk.id], steps: steps };
        });
        out[t.name] = tier;
      });
      areas[a.name] = out;
    });
    // The capes you read: each achievement, by category, true (done) or false. Some tick themselves: their value is only to read.
    var capes = {};
    QG.CAPES.forEach(function (info) {
      var c = A.savedCape(info.key);
      if (!c) return;
      var out = {};
      c.cheevos.forEach(function (x) { (out[x.cat] = out[x.cat] || {})[x.id + ' ' + x.name] = A.cheevoDone(info.key, x); });
      capes[info.name] = out;
    });
    return {
      app: 'Quick Guide', format: FORMAT, exportedAt: new Date().toISOString(),
      help: 'Set a quest, task or step to true to mark it done, or to false to undo it, then import this file. ' +
        'A done quest is just true, without its steps. ' +
        'Keep the code at the start of a step or task: the app finds it by that code. A task can also be written by its name alone. ' +
        '"tiers" is each tier\'s count, to read at a glance: an import does not use it. ' +
        '"capes" is every achievement of the capes you opened. Quest Cape, Master Skiller and the two capes in the trimmed one tick themselves, ' +
        'so their true or false is only to read. ' +
        '"mylist" is your lists of goals: add a goal by typing it the way you would in the add box, like "82 Thieving" or "500 Magic logs". ' +
        'Skill, quest, task and tier goals tick themselves, so their true or false is only to read.',
      settings: JSON.parse(JSON.stringify(S.set)), player: S.player || null, quests: quests, tiers: counts, areas: areas, capes: capes, mylist: A.exportTodo()
    };
  }
  function isMap(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function cap1(x) { x = String(x); return x.charAt(0).toUpperCase() + x.slice(1); }
  // Puts an export back. Returns { error } and changes nothing when the text is not right, else what was imported.
  function importState(text) {
    text = String(text || '').trim();
    if (!text) return { error: 'Paste an export first.' };
    var j;
    try { j = JSON.parse(text); } catch (e) { return { error: 'That is not valid JSON. ' + (e && e.message ? e.message : '') }; }
    if (!isMap(j) || j.app !== 'Quick Guide') return { error: 'That is not a Quick Guide export.' };
    if (+j.format > FORMAT) return { error: 'This export is from a newer version of the app.' };
    // The lists are checked before anything changes: they replace yours, so a mistake there must not empty them.
    var te = j.mylist == null ? '' : A.todoFileError(j.mylist);
    if (te) return { error: 'There is a mistake in the lists. ' + te };
    var nq = 0, na = 0;
    var st = j.settings;
    if (isMap(st)) {
      BOOL_SETTINGS.forEach(function (k) { if (typeof st[k] === 'boolean') S.set[k] = st[k]; });
      if (st.fontSize != null && isFinite(+st.fontSize)) S.set.fontSize = clampFont(st.fontSize);
      S.set.sort = pick(SORTS, st.sort, S.set.sort);
      S.set.home = pick(HOMES, st.home, S.set.home);
      S.set.theme = pick(THEMES, st.theme, S.set.theme);
      applySettings();
      saveSettings();
    }
    var pl = j.player;
    if (isMap(pl) && typeof pl.name === 'string' && pl.name && isMap(pl.quests)) {
      var qs = {};
      Object.keys(pl.quests).forEach(function (k) { var v = +pl.quests[k]; if (v === 0 || v === 1 || v === 2) qs[k] = v; });
      var tl = {};
      if (isMap(pl.titles)) Object.keys(pl.titles).forEach(function (k) { if (qs[k] != null && typeof pl.titles[k] === 'string') tl[k] = pl.titles[k]; });
      S.player = { name: pl.name, source: pl.source || 'RuneMetrics', at: pl.at || new Date().toISOString(), quests: qs, titles: tl,
        levels: isMap(pl.levels) ? pl.levels : {}, locked: isMap(pl.locked) ? pl.locked : {}, done: +pl.done || 0, started: +pl.started || 0 };
      if (isFinite(+pl.qp) && pl.qp != null) S.player.qp = +pl.qp;
      if (isFinite(+pl.qpMax) && pl.qpMax != null) S.player.qpMax = +pl.qpMax;
      sset('player', S.player);
    }
    var nc = 0;
    if (+j.format >= 2) { var r2 = importV2(j); nq = r2.quests; na = r2.areas; nc = r2.capes; }
    else if (isMap(j.quests)) {
      Object.keys(j.quests).forEach(function (title) {
        var e = j.quests[title];
        if (!isMap(e)) return;
        var key = typeof e.page === 'string' && e.page ? e.page : title + '/Quick guide';
        var v = isMap(e.view) ? e.view : {}, steps = {}, items = {};
        Object.keys(isMap(e.steps) ? e.steps : {}).forEach(function (id) { steps[id] = 1; });
        Object.keys(isMap(e.items) ? e.items : {}).forEach(function (id) { items[id] = 1; });
        sset('prog.' + key, { steps: steps, items: items, tab: validTab(v.tab), open: isMap(v.open) ? v.open : {}, acc: isMap(v.acc) ? v.acc : {} });
        var pr = isMap(e.progress) ? e.progress : {};
        remember(key, title, Math.max(0, +pr.done || 0), Math.max(0, +pr.total || 0));
        nq++;
      });
    }
    if (+j.format < 2 && isMap(j.areas)) {
      var am = ametaAll();
      QG.AREAS.forEach(function (a) {
        var e = j.areas[a.name];
        if (!isMap(e)) return;
        var tasks = {};
        Object.keys(isMap(e.tasks) ? e.tasks : {}).forEach(function (id) { tasks[id] = 1; });
        var p = { tasks: tasks };
        if (typeof e.tier === 'string' && e.tier) p.tier = e.tier;
        sset('aprog.' + a.name, p);
        if (isMap(e.tiers)) {
          var old = (am[a.name] && am[a.name].tiers) || [];
          am[a.name] = { at: Date.now(), tiers: Object.keys(e.tiers).map(function (id) {
            var t = isMap(e.tiers[id]) ? e.tiers[id] : {}, o = old.filter(function (x) { return x.id === id; })[0] || {};
            return { id: id, name: o.name || cap1(id), total: Math.max(0, +t.total || 0), done: Math.max(0, +t.done || 0), needs: o.needs };
          }) };
          sset('ameta', am);
        }
        na++;
      });
    }
    // My list: the file's lists replace yours. A file without them leaves yours alone.
    var nl = isMap(j.mylist) ? A.importTodo(j.mylist) : 0;
    return { quests: nq, areas: na, capes: nc, lists: nl };
  }
  // Format 2: everything listed, each true or false. Steps and tasks are found by the code at the start of their line.
  function importV2(j) {
    var nq = 0, na = 0, m = metaAll(), byTitle = {};
    Object.keys(m).forEach(function (k) { byTitle[D.norm(m[k].title)] = k; });
    function code(k) { return String(k).trim().split(/\s+/)[0]; }
    if (isMap(j.quests)) {
      Object.keys(j.quests).forEach(function (title) {
        var v = j.quests[title];
        if (typeof v === 'boolean') { setMarked(title, v); nq++; return; }
        if (!isMap(v)) return;
        if (typeof v.done === 'boolean') setMarked(title, v.done);
        if (isMap(v.steps) || isMap(v.items)) {
          var key = typeof v.page === 'string' && v.page ? v.page : byTitle[D.norm(title)] || title + '/Quick guide';
          var old = loadProg(key), steps = {}, items = {};
          Object.keys(isMap(v.steps) ? v.steps : {}).forEach(function (k) { if (v.steps[k] === true) steps[code(k)] = 1; });
          Object.keys(isMap(v.items) ? v.items : {}).forEach(function (k) { if (v.items[k] === true) items[code(k)] = 1; });
          sset('prog.' + key, { steps: steps, items: items, tab: old.tab, open: old.open, acc: old.acc });
          var g = sget('quest.' + key), pm = /^(\d+)\s*\/\s*(\d+)$/.exec(String(v.progress || '').trim());
          if (g) { var ids = topSteps(g); remember(key, title, ids.filter(function (id) { return steps[id]; }).length, ids.length); }
          else remember(key, title, pm ? +pm[1] : Object.keys(steps).length, pm ? +pm[2] : 0);
          if (typeof v.done === 'boolean') setMarked(title, v.done);
        }
        nq++;
      });
    }
    if (isMap(j.areas)) {
      QG.AREAS.forEach(function (a) {
        var e = j.areas[a.name];
        if (!isMap(e)) return;
        var ix = aidxAll()[a.name], idx = ix ? taskIndex(ix) : {}, byName = {}, ticks = {};
        if (ix) ix.tiers.forEach(function (t) { t.tasks.forEach(function (x) { byName[x.name.toLowerCase()] = x.id; }); });
        function idOf(k) {
          var c = code(k);
          if (!ix || idx[c]) return c;
          return byName[String(k).trim().toLowerCase()] || c;
        }
        Object.keys(e).forEach(function (tn) {
          var tier = e[tn];
          if (!isMap(tier)) return;
          Object.keys(tier).forEach(function (k) {
            var v = tier[k], id = idOf(k);
            if (v === true) setTick(ticks, idx, id, true);
            else if (isMap(v)) {
              Object.keys(isMap(v.steps) ? v.steps : {}).forEach(function (sk) { if (v.steps[sk] === true) setTick(ticks, idx, code(sk), true); });
              if (v.done === true) setTick(ticks, idx, id, true);
            }
          });
        });
        var p = loadAprog(a.name);
        p.tasks = ticks;
        sset('aprog.' + a.name, p);
        if (ix) writeAmeta(a.name, ix, p);
        na++;
      });
    }
    // Capes: your ticks, found by the code at the start of each achievement's line. The ones that tick themselves are left alone.
    var nc = 0;
    if (isMap(j.capes)) {
      QG.CAPES.forEach(function (info) {
        var e = j.capes[info.name];
        if (!isMap(e)) return;
        var c = A.savedCape(info.key), auto = {}, ticks = {};
        if (c) c.cheevos.forEach(function (x) { if (A.autoOf(x, c)) auto[x.id] = 1; });
        Object.keys(e).forEach(function (cat) {
          if (!isMap(e[cat])) return;
          Object.keys(e[cat]).forEach(function (k) { var id = code(k); if (e[cat][k] === true && !auto[id]) ticks[id] = 1; });
        });
        var p = A.loadCprog(info.key);
        p.ticks = ticks;
        sset('cprog.' + info.key, p);
        nc++;
      });
    }
    return { quests: nq, areas: na, capes: nc };
  }
  function closeBackup() {
    var b = byId('bk');
    if (b) b.parentNode.removeChild(b);
    if (S.bkUrl) { try { URL.revokeObjectURL(S.bkUrl); } catch (e) { /* gone */ } S.bkUrl = ''; }
  }
  function openBackup(mode) {
    closeMenus();
    closeBackup();
    var exp = mode === 'export';
    app.insertAdjacentHTML('beforeend',
      '<div class="dlgbg" id="bk"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="bk-h">' +
      '<h2 class="dh" id="bk-h">' + (exp ? 'Export state' : 'Import state') + '</h2>' +
      '<p class="para">' + (exp ?
        'Every quest, every area task, the capes you opened and your lists, as a file: <b>true</b> is done, <b>false</b> is not. Download it, change what you like in any text editor, then import it again.' :
        'Choose a file you exported, or paste its text. It replaces your ticks for the quests, areas and capes in it, and your lists when it has them.') + '</p>' +
      (exp ? '<div class="state" id="bk-wait" role="status">' + I.loader + '<p>Reading the areas, so all their tasks are in the file…</p></div>' :
        '<label class="btn file">Choose a file<input type="file" id="bk-file" accept=".json,application/json"></label>') +
      '<textarea class="inp tx" id="bk-text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="' + (exp ? 'Exported state' : 'State to import') + '"' +
      (exp ? ' readonly' : ' placeholder="Or paste an export here"') + '></textarea>' +
      '<p class="note" id="bk-note" hidden></p>' +
      '<p class="err" id="bk-err" role="alert" hidden></p>' +
      '<div class="dbtn">' + (exp ?
        '<a class="btn" id="bk-save" role="link" aria-disabled="true">Download file</a><button class="btn alt" type="button" data-act="bk-copy" disabled>Copy</button>' :
        '<button class="btn" type="button" data-act="bk-import">Import</button>') +
      '<button class="btn alt" type="button" data-act="bk-close">' + (exp ? 'Close' : 'Cancel') + '</button></div></div></div>');
    if (!exp) { var t0 = byId('bk-text'); if (t0) t0.focus(); return; }
    S.aidxFail = [];
    whenAreasRead(function () {
      var ta = byId('bk-text');
      if (!ta) return;   // closed while reading
      var text = JSON.stringify(buildExport(), null, 2);
      ta.value = text;
      var w = byId('bk-wait');
      if (w) w.parentNode.removeChild(w);
      var failed = S.aidxFail.filter(function (n) { return missingAreas().indexOf(n) >= 0; }), note = byId('bk-note');
      if (failed.length && note) {
        note.textContent = 'Could not read ' + failed.join(' and ') + ', so ' + (failed.length === 1 ? 'its' : 'their') + ' tasks are not in the file.';
        note.hidden = false;
      }
      var a = byId('bk-save'), c = document.querySelector('[data-act="bk-copy"]');
      try {
        S.bkUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.href = S.bkUrl;
      } catch (e) { a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text); }
      a.download = 'quick-guide-' + new Date().toISOString().slice(0, 10) + '.json';
      a.removeAttribute('aria-disabled');
      if (c) c.disabled = false;
    });
  }
  function copyBackup() {
    var ta = byId('bk-text');
    if (!ta) return;
    A.copyText(ta);
  }
  function runImport() {
    var ta = byId('bk-text'), err = byId('bk-err');
    if (!ta || !err) return;
    var r = importState(ta.value);
    if (r.error) { err.textContent = r.error; err.hidden = false; return; }
    closeBackup();
    S.error = '';
    S.input = '';
    var fromSettings = S.view === 'settings';
    renderStart();
    if (fromSettings) A.saveView(true);   // the new state shows on the start screen, after a reload too
    var parts = [];
    if (r.quests) parts.push(plural(r.quests, 'quest', 'quests'));
    if (r.areas) parts.push(plural(r.areas, 'area', 'areas'));
    if (r.capes) parts.push(plural(r.capes, 'cape', 'capes'));
    if (r.lists) parts.push(plural(r.lists, 'list', 'lists'));
    // "1 quest", "1 quest and 2 areas", "1 quest, 2 areas and 3 lists"
    var last = parts.pop();
    toast(last ? 'Imported ' + (parts.length ? parts.join(', ') + ' and ' : '') + last + '.' : 'Imported.');
  }

  A.share({ closeBackup: closeBackup, copyBackup: copyBackup, openBackup: openBackup, runImport: runImport });
  A.loaded.backup = true;
})(window.QuickGuideApp);
