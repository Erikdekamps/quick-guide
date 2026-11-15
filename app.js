/*!
 * Quick Guide - app.js
 * Loaded last: the clicks and keys of every screen, and the start.
 */
(function (A) {
  'use strict';
  // A file that did not load: the page already says which (index.html). Do not start half an app.
  if (!A || ['core', 'quests', 'areas', 'backup', 'scan'].some(function (k) { return !A.loaded[k]; })) return;
  var accKey = A.accKey, app = A.app, applySettings = A.applySettings, areaMatches = A.areaMatches,
    areaReset = A.areaReset, byId = A.byId, closeBackup = A.closeBackup, closeMenus = A.closeMenus,
    closeRead = A.closeRead, copyBackup = A.copyBackup, current = A.current, drawList = A.drawList,
    fetchList = A.fetchList, fetchMinis = A.fetchMinis, fetchOrder = A.fetchOrder, FONT_STEP = A.FONT_STEP,
    forgetPlayer = A.forgetPlayer, jumpTo = A.jumpTo, LIST_MAX_AGE = A.LIST_MAX_AGE, loadAllAreas = A.loadAllAreas,
    lookUpPlayer = A.lookUpPlayer, matchQuests = A.matchQuests, nextStep = A.nextStep, nextTask = A.nextTask,
    openArea = A.openArea, openBackup = A.openBackup, openQuest = A.openQuest, openScan = A.openScan,
    openTitle = A.openTitle, pick = A.pick, PLAYER_MAX_AGE = A.PLAYER_MAX_AGE, refresh = A.refresh,
    refreshArea = A.refreshArea, refreshQuest = A.refreshQuest, renderStart = A.renderStart,
    resetClick = A.resetClick, runImport = A.runImport, S = A.S, saveProg = A.saveProg, saveSettings = A.saveSettings,
    scanGoTo = A.scanGoTo, setFont = A.setFont, setHome = A.setHome, sget = A.sget, SORTS = A.SORTS,
    startMaps = A.startMaps, startScan = A.startScan, stopScan = A.stopScan, SWITCHES = A.SWITCHES,
    switchTab = A.switchTab, switchTier = A.switchTier, THEMES = A.THEMES, tickInArea = A.tickInArea,
    tickStep = A.tickStep, tickTask = A.tickTask, toggleAreaSec = A.toggleAreaSec, toggleMenu = A.toggleMenu,
    toggleOv = A.toggleOv, toggleSection = A.toggleSection, toggleSetting = A.toggleSetting, wipeClick = A.wipeClick;

  // ---------- events ----------
  app.addEventListener('submit', function (ev) {
    ev.preventDefault();
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
    if (ev.target.id !== 'quest-link') return;
    S.input = ev.target.value;
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
    if (t.hasAttribute('data-scb')) { tickStep(t.getAttribute('data-scb'), t.checked); return; }
    if (t.hasAttribute('data-acb')) {
      var ar = t.getAttribute('data-aarea');
      if (ar) tickInArea(ar, t.getAttribute('data-acb'), t.checked); else tickTask(t.getAttribute('data-acb'), t.checked);
      return;
    }
    if (t.hasAttribute('data-icb')) {
      var id = t.getAttribute('data-icb');
      if (t.checked) S.prog.items[id] = 1; else delete S.prog.items[id];
      refresh();
      // When everything in a "Bring" box is ticked, the box closes (not with "Show done steps" on).
      var det = t.closest('details.bring');
      if (det && t.checked && !S.set.showDone && det.classList.contains('alldone')) { det.open = false; if (S.prog.acc) delete S.prog.acc[accKey(det)]; saveProg(); }
    }
  });
  app.addEventListener('click', function (ev) {
    if (ev.target.id === 'bk') { closeBackup(); return; }   // a click outside the box
    if (ev.target.id === 'rd') { closeRead(); return; }
    var t = ev.target.closest('[data-quest], [data-area], [data-home], [data-tier], [data-group], [data-tab], [data-act], [data-sec-btn], [data-asec-btn], [data-ov-btn], [data-menu]');
    if (t) {
      if (t.hasAttribute('data-menu')) { toggleMenu(t.getAttribute('data-menu')); return; }
      if (t.hasAttribute('data-quest')) { openTitle(t.getAttribute('data-quest')); return; }
      if (t.hasAttribute('data-area')) { openArea(t.getAttribute('data-area'), t.getAttribute('data-atier')); return; }
      if (t.hasAttribute('data-home')) { setHome(t.getAttribute('data-home')); return; }
      if (t.hasAttribute('data-tier')) { switchTier(t.getAttribute('data-tier')); return; }
      if (t.hasAttribute('data-group')) {
        var gk = (S.set.home === 'areas' ? 'areas' : S.set.sort) + ':' + t.getAttribute('data-group'), ul = t.parentNode.nextElementSibling;
        S.closed[gk] = !S.closed[gk];
        t.setAttribute('aria-expanded', S.closed[gk] ? 'false' : 'true');
        if (ul) ul.hidden = !!S.closed[gk];
        return;
      }
      if (t.hasAttribute('data-tab')) { switchTab(t.getAttribute('data-tab')); return; }
      if (t.hasAttribute('data-sec-btn')) { toggleSection(t.getAttribute('data-sec-btn')); return; }
      if (t.hasAttribute('data-asec-btn')) { toggleAreaSec(t.getAttribute('data-asec-btn')); return; }
      if (t.hasAttribute('data-ov-btn')) { toggleOv(t.getAttribute('data-ov-btn')); return; }
      var act = t.getAttribute('data-act');
      if (act === 'next') nextStep();
      else if (act === 'anext') nextTask();
      else if (act === 'wipe') wipeClick(t);
      else if (act === 'export') openBackup('export');
      else if (act === 'import') openBackup('import');
      else if (act === 'bk-close') closeBackup();
      else if (act === 'scan-open') openScan();
      else if (act === 'rd-close') closeRead();
      else if (act === 'scan-start') startScan();
      else if (act === 'scan-stop') stopScan();
      else if (act === 'scan-back') scanGoTo(S.scan.k - 1);
      else if (act === 'scan-next') scanGoTo(S.scan.k + 1);
      else if (act === 'bk-copy') copyBackup();
      else if (act === 'bk-import') runImport();
      else if (act === 'areas-retry') { S.aidxFail = []; loadAllAreas(); drawList(); }
      else if (act === 'areset') areaReset(t);
      else if (act === 'arefresh') { closeMenus(); refreshArea(); }
      else if (act === 'jump') { closeMenus(); if (S.prog.tab !== 'steps') switchTab('steps'); jumpTo(current(), true); }
      else if (SWITCHES[act]) toggleSetting(act);
      else if (act === 'order-refresh') { S.orderError = ''; drawList(); }
      else if (act === 'change') { S.error = ''; S.input = ''; renderStart(); }
      else if (act === 'refresh') { closeMenus(); refreshQuest(false); }
      else if (act === 'wiki') closeMenus();
      else if (act === 'reset') resetClick(t);
      else if (act === 'font-down') setFont(-FONT_STEP);
      else if (act === 'font-up') setFont(FONT_STEP);
      else if (act === 'list-refresh') { closeMenus(); fetchList(false, true); if (S.order || S.set.sort === 'opt') fetchOrder(true); }
      else if (act === 'player-refresh') { if (S.player) lookUpPlayer(S.player.name); }
      else if (act === 'player-clear') forgetPlayer();
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
    if (!cb) return;
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
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closeMenus(); closeBackup(); closeRead(); } });
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
  var lastArea = /^area:/.test(last || '') ? last.slice(5) : '';
  if (lastArea && sget('area.' + lastArea)) openArea(lastArea);
  else if (last && !lastArea && sget('quest.' + last)) openQuest(last);
  else renderStart();
  // Keep the quest list fresh, quietly.
  if (S.view === 'quest' && !S.list) fetchList(true);
  else if (S.list && Date.now() - (S.list.at || 0) > LIST_MAX_AGE) fetchList(true);
  if (S.order && Date.now() - (S.order.at || 0) > LIST_MAX_AGE) fetchOrder(true);
  if (S.list && !S.listBusy && (!S.minis || Date.now() - (S.minis.at || 0) > LIST_MAX_AGE)) fetchMinis();
  // Keep the player fresh too: quietly, once a day.
  // (Data from before the app kept the quests' names is fetched again too: the export needs them.)
  if (S.player && (Date.now() - (Date.parse(S.player.at) || 0) > PLAYER_MAX_AGE || !S.player.titles)) lookUpPlayer(S.player.name, true);

})(window.QuickGuideApp);
