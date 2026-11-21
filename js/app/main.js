/*!
 * Quick Guide - js/app/main.js
 * Loaded last: the clicks and keys of every screen, and the start.
 */
(function (A) {
  'use strict';
  // A file that did not load: the page already says which (index.html). Do not start half an app.
  if (!A || ['core', 'quests', 'areas', 'capes', 'update', 'todoData', 'todoView', 'todo', 'backup'].some(function (k) { return !A.loaded[k]; })) return;
  var accKey = A.accKey, addFromButton = A.addFromButton, addSkillGoal = A.addSkillGoal, addToPick = A.addToPick, app = A.app,
    applySettings = A.applySettings, areaMatches = A.areaMatches, areaReset = A.areaReset, byId = A.byId, capeReset = A.capeReset, closeBackup = A.closeBackup,
    closeMenus = A.closeMenus, closeSubAdd = A.closeSubAdd, closeTodoDialog = A.closeTodoDialog, copyBackup = A.copyBackup,
    current = A.current, drawList = A.drawList, fetchList = A.fetchList, fetchMinis = A.fetchMinis, fetchOrder = A.fetchOrder,
    FONT_STEP = A.FONT_STEP, forgetPlayer = A.forgetPlayer, goalMenu = A.goalMenu, goHome = A.goHome, itemMenu = A.itemMenu, jumpTo = A.jumpTo,
    LIST_MAX_AGE = A.LIST_MAX_AGE, listMenu = A.listMenu, loadAllAreas = A.loadAllAreas, lookUpPlayer = A.lookUpPlayer,
    matchQuests = A.matchQuests, menuAct = A.menuAct, newListDialog = A.newListDialog, nextCheevo = A.nextCheevo, nextStep = A.nextStep, nextTask = A.nextTask,
    openArea = A.openArea, openBackup = A.openBackup, openCape = A.openCape, openQuest = A.openQuest, openTitle = A.openTitle, pick = A.pick,
    PLAYER_MAX_AGE = A.PLAYER_MAX_AGE, refresh = A.refresh, refreshArea = A.refreshArea, refreshCape = A.refreshCape, refreshQuest = A.refreshQuest,
    leaveSettings = A.leaveSettings, renderStart = A.renderStart, resetClick = A.resetClick, runImport = A.runImport, S = A.S, saveProg = A.saveProg,
    saveSettings = A.saveSettings, saveView = A.saveView, sdel = A.sdel, setFont = A.setFont, sget = A.sget,
    SORTS = A.SORTS, startMaps = A.startMaps, subMenu = A.subMenu, SWITCHES = A.SWITCHES,
    switchCapeTab = A.switchCapeTab, switchTab = A.switchTab, switchTier = A.switchTier, THEMES = A.THEMES, tickCheevo = A.tickCheevo, tickGoal = A.tickGoal, tickInArea = A.tickInArea,
    tickStep = A.tickStep, tickSub = A.tickSub, tickTask = A.tickTask, toastAct = A.toastAct, todoSubmit = A.todoSubmit,
    toggleAreaSec = A.toggleAreaSec, toggleCapePart = A.toggleCapePart, toggleMenu = A.toggleMenu, toggleOv = A.toggleOv, toggleSection = A.toggleSection,
    toggleSetting = A.toggleSetting, unlist = A.unlist, wipeClick = A.wipeClick;

  // ---------- what a click does ----------
  // My list: the buttons in its message, Add to list and Remove from a list, "+ goal", the ⋯ of a task, a goal, a
  // sub task and a list, the items of their menus, and the boxes. The first one the button has counts.
  var TODO_CLICKS = [
    ['data-tact', function (g) { toastAct(+g.getAttribute('data-tact')); }],
    ['data-saddx', function () { closeSubAdd(); }],
    ['data-addto', addFromButton],
    ['data-unlist', unlist],
    ['data-addgoal', addSkillGoal],
    ['data-imenu', itemMenu],
    ['data-gmenu', goalMenu],
    ['data-smenu', subMenu],
    ['data-lmenu', listMenu],
    ['data-tm', menuAct],
    ['data-tdx', function () { closeTodoDialog(); }]
  ];
  var TODO_SEL = TODO_CLICKS.map(function (c) { return '[' + c[0] + ']'; }).join(', ');
  // The buttons with data-act. t: the button.
  var ACTS = {
    next: function () { nextStep(); },
    anext: function () { nextTask(); },
    wipe: wipeClick,
    'export': function () { openBackup('export'); },
    'import': function () { openBackup('import'); },
    'bk-close': function () { closeBackup(); },
    'bk-copy': function () { copyBackup(); },
    'bk-import': function () { runImport(); },
    'areas-retry': function () { S.aidxFail = []; loadAllAreas(); drawList(); },
    areset: areaReset,
    arefresh: function () { closeMenus(); refreshArea(); },
    cnext: function () { nextCheevo(); },
    creset: capeReset,
    crefresh: function () { closeMenus(); refreshCape(); },
    jump: function () { closeMenus(); if (S.prog.tab !== 'steps') switchTab('steps'); jumpTo(current(), true); },
    'order-refresh': function () { S.orderError = ''; drawList(); },
    change: function () { S.error = ''; S.input = ''; sdel('last'); saveView(); renderStart(); },
    refresh: function () { closeMenus(); refreshQuest(false); },
    wiki: function () { closeMenus(); },
    reset: resetClick,
    'font-down': function () { setFont(-FONT_STEP); },
    'font-up': function () { setFont(FONT_STEP); },
    'list-refresh': function () { closeMenus(); fetchList(false, true); if (S.order || S.set.sort === 'opt') fetchOrder(true); },
    'update-all': function () { closeMenus(); A.updateAll(false); },
    'player-refresh': function () { if (S.player) lookUpPlayer(S.player.name); },
    'player-clear': function () { forgetPlayer(); },
    tnew: function () { newListDialog(); },
    timport: function () { A.importListDialog(); }
  };

  // ---------- events ----------
  app.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (todoSubmit(ev.target)) return;
    if (ev.target.id === 'player-form') { S.playerInput = ev.target.elements.player.value; lookUpPlayer(S.playerInput); return; }
    if (ev.target.id !== 'load-form') return;
    var v = ev.target.elements.link.value.trim();
    S.input = v;
    if (S.set.home === 'areas') {
      var am = v ? areaMatches(v) : { tiers: [], tasks: [] };
      if (am.tiers.length) openArea(am.tiers[0].area, am.tiers[0].id);
      else if (am.tasks.length) openArea(am.tasks[0].area, am.tasks[0].tier.id);
      else { S.error = v ? 'Nothing matches \u201c' + v + '\u201d.' : 'Type an area or task name first.'; renderStart(); }
      return;
    }
    if (!v) { S.error = 'Type a quest name first.'; renderStart(); return; }
    var hits = matchQuests(v);
    if (hits.length) openTitle(hits[0].t);
    else { S.error = 'No quest matches \u201c' + v + '\u201d.'; renderStart(); }
  });
  app.addEventListener('input', function (ev) {
    if (ev.target.id === 'player-name') { S.playerInput = ev.target.value; return; }
    if (ev.target.id === 'tp-text') { A.pasteCount(); return; }
    // My list: typing in a box takes its "Type a goal first." away.
    var qa = ev.target.closest('form.qadd');
    if (qa) { qa.querySelector('.err').hidden = true; return; }
    if (ev.target.id !== 'quest-link') return;
    S.input = ev.target.value;
    saveView();
    if (S.set.home === 'areas' && S.input.trim()) loadAllAreas();
    if (S.error) {
      S.error = '';
      var e = byId('load-err');
      if (e) e.hidden = true;
      ev.target.classList.remove('bad');
    }
    drawList();
  });
  app.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'bk-file') {
      var f = t.files && t.files[0];
      if (f) {
        var rd = new FileReader();
        rd.onload = function () { var ta = byId('bk-text'); if (ta) ta.value = String(rd.result || ''); };
        rd.readAsText(f);
      }
      return;
    }
    if (t.id === 'sort') { S.set.sort = pick(SORTS, t.value, 'name'); saveSettings(); drawList(); return; }
    if (t.id === 'theme') { S.set.theme = pick(THEMES, t.value, 'brown'); saveSettings(); applySettings(); return; }
    if (t.id === 'ta-list') { addToPick(t); return; }
    if (t.id === 'tg-list' || t.id === 'tg-parent') { A.pickPlace(t); return; }
    if (t.hasAttribute('data-gcb')) { tickGoal(t.getAttribute('data-gcb'), t.checked); return; }
    if (t.hasAttribute('data-subcb')) { tickSub(t.getAttribute('data-gid'), t.getAttribute('data-subcb'), t.checked); return; }
    if (t.hasAttribute('data-scb')) { tickStep(t.getAttribute('data-scb'), t.checked); return; }
    if (t.hasAttribute('data-ccb')) { tickCheevo(t.getAttribute('data-ccb'), t.checked); return; }
    if (t.hasAttribute('data-acb')) {
      var ar = t.getAttribute('data-aarea');
      if (ar) tickInArea(ar, t.getAttribute('data-acb'), t.checked); else tickTask(t.getAttribute('data-acb'), t.checked);
      return;
    }
    if (t.hasAttribute('data-icb')) {
      var id = t.getAttribute('data-icb');
      if (t.checked) S.prog.items[id] = 1; else delete S.prog.items[id];
      refresh();
      // When everything in a "Bring" box is ticked, the box closes (not with "Done steps and tasks" ticked).
      var det = t.closest('details.bring');
      if (det && t.checked && !S.set.showDone && det.classList.contains('alldone')) { det.open = false; if (S.prog.acc) delete S.prog.acc[accKey(det)]; saveProg(); }
    }
  });
  app.addEventListener('click', function (ev) {
    if (ev.target.id === 'bk') { closeBackup(); return; }   // a click outside the box
    if (ev.target.id === 'td') { closeTodoDialog(); return; }
    var g = ev.target.closest(TODO_SEL);
    if (g) {
      TODO_CLICKS.filter(function (c) { return g.hasAttribute(c[0]); })[0][1](g);
      return;
    }
    var t = ev.target.closest('[data-quest], [data-area], [data-cape], [data-home], [data-tier], [data-ctab], [data-group], [data-dn], [data-tab], [data-act], [data-sec-btn], [data-asec-btn], [data-cpart-btn], [data-ov-btn], [data-menu]');
    if (t) {
      if (t.hasAttribute('data-menu')) { toggleMenu(t.getAttribute('data-menu')); return; }
      if (t.hasAttribute('data-quest')) { openTitle(t.getAttribute('data-quest')); return; }
      if (t.hasAttribute('data-area')) { openArea(t.getAttribute('data-area'), t.getAttribute('data-atier')); return; }
      if (t.hasAttribute('data-cape')) { closeMenus(); openCape(t.getAttribute('data-cape')); return; }
      if (t.hasAttribute('data-home')) { goHome(t.getAttribute('data-home')); return; }
      if (t.hasAttribute('data-tier')) { switchTier(t.getAttribute('data-tier')); return; }
      if (t.hasAttribute('data-ctab')) { switchCapeTab(t.getAttribute('data-ctab')); return; }
      if (t.hasAttribute('data-group')) {
        var home = S.set.home, gk = (home === 'areas' || home === 'todo' ? home : S.set.sort) + ':' + t.getAttribute('data-group'), ul = t.parentNode.nextElementSibling;
        S.closed[gk] = !S.closed[gk];
        t.setAttribute('aria-expanded', S.closed[gk] ? 'false' : 'true');
        if (ul) ul.hidden = !!S.closed[gk];
        saveView();
        return;
      }
      if (t.hasAttribute('data-dn')) {
        // A list's Done part: shut until you open it (so here true means open).
        var dk = 'tododone:' + t.getAttribute('data-dn'), dl = t.nextElementSibling;
        S.closed[dk] = !S.closed[dk];
        t.setAttribute('aria-expanded', S.closed[dk] ? 'true' : 'false');
        if (dl) dl.hidden = !S.closed[dk];
        saveView();
        return;
      }
      if (t.hasAttribute('data-tab')) { switchTab(t.getAttribute('data-tab')); return; }
      if (t.hasAttribute('data-sec-btn')) { toggleSection(t.getAttribute('data-sec-btn')); return; }
      if (t.hasAttribute('data-asec-btn')) { toggleAreaSec(t.getAttribute('data-asec-btn')); return; }
      if (t.hasAttribute('data-cpart-btn')) { toggleCapePart(t.getAttribute('data-cpart-btn')); return; }
      if (t.hasAttribute('data-ov-btn')) { toggleOv(t.getAttribute('data-ov-btn')); return; }
      var act = t.getAttribute('data-act');
      if (ACTS[act]) ACTS[act](t);
      else if (SWITCHES[act]) toggleSetting(act);
      return;
    }
    // Remember boxes you open or close by hand.
    var sum = ev.target.closest('summary');
    if (sum && S.view === 'quest' && sum.parentNode.classList.contains('acc')) {
      // The click is about to flip the box, so save the opposite of what it is now.
      var box = sum.parentNode;
      S.prog.acc = S.prog.acc || {};
      S.prog.acc[accKey(box)] = box.open ? 0 : 1;
      saveProg();
    }
    // Click anywhere on a step or item row to tick it. Links, pictures, tables and maps keep working.
    var row = ev.target.closest('.row');
    if (!row || !app.contains(row)) return;
    if (ev.target.closest('a, button, input, select, textarea, label, .leaflet-container')) return;
    var det = ev.target.closest('details');
    if (det && row.contains(det)) return;
    var sel = window.getSelection ? String(window.getSelection()) : '';
    if (sel.trim()) return;
    var cb = row.querySelector(':scope > .cb');
    if (!cb || cb.disabled) return;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Maps start when their box is first opened ("toggle" does not bubble, so listen while capturing).
  app.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (d && d.tagName === 'DETAILS' && d.open) startMaps();
  }, true);
  document.addEventListener('click', function (ev) {
    // Look at where the click was, not where the target is now: a button in a menu may be redrawn by the click.
    var path = ev.composedPath ? ev.composedPath() : [ev.target];
    var inside = path.some(function (n) { return n.nodeType === 1 && (n.classList.contains('menu') || n.hasAttribute('data-menu')); });
    if (!inside) closeMenus();
  });
  // My list: more than one line pasted in the box at the end of a list is a list to paste.
  app.addEventListener('paste', function (ev) {
    var f = ev.target.closest && ev.target.closest('form.qadd'), text = ev.clipboardData ? ev.clipboardData.getData('text/plain') : '';
    if (!f || f.classList.contains('sadd') || !/\n/.test(text.trim())) return;
    ev.preventDefault();
    A.pasteDialog(f.getAttribute('data-qadd'), text);
  });
  // Ctrl+Enter in the Paste a list box adds, like its button.
  app.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.id === 'tp-text') { ev.preventDefault(); A.todoSubmit(ev.target.form); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    // Escape closes what is open on top; with nothing open, it leaves Settings for the screen you came from.
    var open = byId('bk') || byId('td') || byId('tmenu') || document.querySelector('.menu:not([hidden])');
    closeMenus(); closeBackup(); closeTodoDialog(); closeSubAdd();
    if (!open && S.view === 'settings') leaveSettings();
  });
  // Inside Alt1, web links open in your normal browser, so the app window stays on the guide.
  document.addEventListener('click', function (ev) {
    if (!window.alt1 || typeof window.alt1.openBrowser !== 'function') return;
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || !/^https?:/i.test(a.href)) return;
    ev.preventDefault();
    try { window.alt1.openBrowser(a.href); } catch (e) { /* stay on the guide */ }
  });

  // ---------- start ----------
  applySettings();
  if (window.alt1 && typeof window.alt1.identifyAppUrl === 'function') {
    try { window.alt1.identifyAppUrl('./appconfig.json'); } catch (e) { /* not important */ }
  }
  var last = sget('last');
  var lastArea = /^area:/.test(last || '') ? last.slice(5) : '', lastCape = /^cape:/.test(last || '') ? last.slice(5) : '';
  if (lastArea && sget('area.' + lastArea)) openArea(lastArea);
  else if (lastCape && A.savedCape(lastCape)) openCape(lastCape);
  else if (last && !lastArea && !lastCape && sget('quest.' + last)) A.showSaved('quest.' + last, function () { openQuest(last); });
  else renderStart();
  // Keep the quest list fresh, quietly.
  if (S.view === 'quest' && !S.list) fetchList(true);
  else if (S.list && Date.now() - (S.list.at || 0) > LIST_MAX_AGE) fetchList(true);
  if (S.order && Date.now() - (S.order.at || 0) > LIST_MAX_AGE) fetchOrder(true);
  if (S.list && !S.listBusy && (!S.minis || Date.now() - (S.minis.at || 0) > LIST_MAX_AGE)) fetchMinis();
  // Keep the player fresh too: quietly, once a day.
  // (Data from before the app kept the quests' names is fetched again too: the export needs them.)
  if (S.player && (Date.now() - (Date.parse(S.player.at) || 0) > PLAYER_MAX_AGE || !S.player.titles)) lookUpPlayer(S.player.name, true);
  // New quests, tasks and achievements: once a week the app checks what it keeps against the wiki, quietly.
  A.autoUpdate();
  A.saidDeleted();
  // Settings was open: open it again, over the screen it was opened from (its button in the bar goes back there).
  if (S.reopenSettings) A.openSettings();

})(window.QuickGuideApp);
