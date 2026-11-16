/*!
 * Quick Guide - app-core.js
 * A tick list for RuneScape Wiki quest quick guides and Area Tasks, made for the Alt1 browser.
 *
 * The app is in six files, loaded in this order. Each puts what the others need on window.QuickGuideApp (A):
 *   app-core.js     storage, helpers, state, saved progress, the player, menus, shared pieces, maps, settings
 *   app-quests.js   the quest list and the quest screen
 *   app-areas.js    Area Tasks
 *   app-backup.js   export and import
 *   app-scan.js     Scan achievements (Alt1)
 *   app.js          the clicks and keys of every screen, and the start
 * parser.js reads the wiki pages, quests.js the quest lists, reader.js the game screen.
 *
 * What is kept in localStorage (all keys start with "qg1."):
 *   list, minis     every quest and miniquest from the wiki's lists: { at, quests: [...] }
 *   order           the wiki's optimal quest order: { at, order: [quest names] }
 *   meta            one small entry per opened quest: { "<page>": { title, done, total, at } }
 *   quest.<page>    the full parsed guide of one quest (JSON)
 *   prog.<page>     your ticks for that quest
 *   qdone           quests marked done by an import: { "<name, letters only>": 1 }
 *   settings, last  display settings, and the quest or area that was open last
 *   player          the character you looked up: { name, at, quests, levels, locked, done, started }
 *   area.<name>     the parsed "<name> achievements" page (Area Tasks)
 *   aprog.<name>    your ticks for that area: { tasks: {id: 1}, tier }
 *   ameta           one small entry per opened area, for the area list: { "<name>": { tiers: [...], needs } }
 *   aidx            every task of every area, for search: { "<name>": { tiers: [...] } }
 *   tiernames       what each tier's name looks like in the game, as learnt by Scan achievements
 * When the storage is full, the guides that were opened longest ago are dropped (ticks are kept).
 */
(function () {
  'use strict';

  var QG = window.QuickGuide;
  var D = window.QuickGuideData;
  var app = document.getElementById('app');
  if (!QG || !D || !app) {
    if (app) app.textContent = 'The app could not start: ' + (!QG ? 'parser.js' : 'quests.js') + ' is missing. Upload all the files again, then reload.';
    return;
  }
  // What the files share (see the top of this file). A file that did not load leaves its name out of A.loaded.
  var A = window.QuickGuideApp = { loaded: {}, share: function (o) { Object.keys(o).forEach(function (k) { A[k] = o[k]; }); } };
  var PREFIX = 'qg1.';
  var FONT_MIN = 12, FONT_MAX = 40, FONT_STEP = 2, FONT_DEFAULT = 14;
  var LIST_MAX_AGE = 7 * 24 * 3600 * 1000;
  var PLAYER_MAX_AGE = 24 * 3600 * 1000;
  var TABS = [['overview', 'Overview'], ['items', 'Items'], ['steps', 'Steps']];
  // The foldable parts of the Overview tab. They start open.
  var OV = [['details', 'Details'], ['skills', 'Skills'], ['enemies', 'Enemies'], ['rewards', 'Rewards']];
  var SORTS = [['name', 'A to Z'], ['opt', 'Optimal order'], ['dif', 'Difficulty'], ['len', 'Length'], ['ser', 'Series'], ['rel', 'Newest']];
  var HOMES = [['quests', 'Quests'], ['areas', 'Area tasks']];
  // The look: the game's brown interface skin, or the blue one it had before (style.css has both).
  var THEMES = [['brown', 'Brown'], ['blue', 'Blue']];
  var DIF_ORDER = ['novice', 'intermediate', 'experienced', 'master', 'grandmaster', 'special'];
  var LEN_ORDER = ['very short', 'short', 'short to medium', 'medium', 'medium to long', 'long', 'long to very long', 'very long', 'very, very long'];

  // ---------- storage (falls back to memory if the browser blocks it) ----------
  var memory = {};
  var S = null;
  function sget(k) {
    try {
      var v = window.localStorage.getItem(PREFIX + k);
      if (v != null) return JSON.parse(v);
    } catch (e) { /* blocked or broken */ }
    return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
  }
  // Drops the saved guide that was opened longest ago. Returns false if there is nothing to drop.
  function evict(keep) {
    var best = null, m = sget('meta') || {}, am = sget('ameta') || {};
    try {
      var ls = window.localStorage, i, k, key, at;
      for (i = 0; i < ls.length; i++) {
        k = ls.key(i);
        if (!k || k.indexOf(PREFIX + 'quest.') !== 0) continue;
        key = k.slice((PREFIX + 'quest.').length);
        if ('quest.' + key === keep || (S && key === S.key)) continue;
        at = (m[key] && m[key].at) || 0;
        if (!best || at < best.at) best = { k: k, at: at, mem: 'quest.' + key };
      }
      // No guides left to drop: drop an area that was read long ago (it is read again when opened; its ticks and its tasks in the index stay).
      if (!best) {
        for (i = 0; i < ls.length; i++) {
          k = ls.key(i);
          if (!k || k.indexOf(PREFIX + 'area.') !== 0) continue;
          key = k.slice((PREFIX + 'area.').length);
          if ('area.' + key === keep || (S && key === S.areaKey)) continue;
          at = (am[key] && am[key].at) || 0;
          if (!best || at < best.at) best = { k: k, at: at, mem: 'area.' + key };
        }
      }
      if (!best) return false;
      ls.removeItem(best.k);
      delete memory[best.mem];
      return true;
    } catch (e) { return false; }
  }
  function sset(k, v) {
    memory[k] = v;
    var s = JSON.stringify(v);
    for (var tries = 0; tries < 40; tries++) {
      try { window.localStorage.setItem(PREFIX + k, s); return; } catch (e) { if (!evict(k)) return; }
    }
  }
  function sdel(k) {
    delete memory[k];
    try { window.localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ }
  }

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
    });
  }
  function byId(id) { return document.getElementById(id); }
  function arr(l) { return Array.prototype.slice.call(l || []); }
  function smooth() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function dateText(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
  }
  // Text of a bit of HTML, without loading any pictures in it.
  var scratch = document.implementation.createHTMLDocument('qg');
  function textOf(html) { var d = scratch.createElement('div'); d.innerHTML = String(html || ''); return d.textContent.replace(/\s+/g, ' ').trim(); }
  var uid = 0;
  function nextId() { uid += 1; return 'qt' + uid; }
  function svg(paths, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }
  var I = {
    dots: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    cog: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    back: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
    chev: svg('<path d="m9 18 6-6-6-6"/>', 'chev'),
    locate: svg('<path d="M2 12h3"/><path d="M19 12h3"/><path d="M12 2v3"/><path d="M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>'),
    eye: svg('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    image: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    table: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    refresh: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    ext: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    loader: svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'spin'),
    music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    map: svg('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'),
    scroll: svg('<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>'),
    type: svg('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    lock: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    skills: svg('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
    bag: svg('<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8"/><path d="M8 18h8"/><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
    swords: svg('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>'),
    steps: svg('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
    trophy: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>')
  };
  var TAB_ICON = { overview: I.info, skills: I.skills, items: I.bag, enemies: I.swords, steps: I.steps, rewards: I.trophy };

  // ---------- state ----------
  function clampFont(n) { n = Math.round(+n || FONT_DEFAULT); return Math.max(FONT_MIN, Math.min(FONT_MAX, n)); }
  function pick(list, v, d) { return list.some(function (x) { return x[0] === v; }) ? v : d; }
  // The settings, from what was saved: anything missing or unknown is the default.
  function readSettings(o) {
    o = o || {};
    return {
      showDone: !!o.showDone, hideDone: !!o.hideDone, hideLocked: !!o.hideLocked,
      // Settings without "hideMini": kind 'quest' (the "Quests only" filter) means hide miniquests.
      hideMini: o.hideMini != null ? !!o.hideMini : o.kind === 'quest',
      fontSize: clampFont(o.fontSize || FONT_DEFAULT),
      sort: pick(SORTS, o.sort, 'name'), home: pick(HOMES, o.home, 'quests'), theme: pick(THEMES, o.theme, 'brown')
    };
  }
  var saved = sget('settings') || {};
  var savedList = sget('list');
  var savedOrder = sget('order');
  var savedMinis = sget('minis');
  var savedPlayer = sget('player');
  if (!savedPlayer || typeof savedPlayer !== 'object' || !savedPlayer.name || typeof savedPlayer.quests !== 'object') savedPlayer = null;
  S = {
    view: 'start',
    q: null,          // the quest JSON
    key: '',          // the wiki page it came from
    prog: null,       // { steps: {id: 1}, items: {id: 1}, tab, open: {partId: bool} }
    idx: null,        // quick lookups for steps
    set: readSettings(saved),
    list: savedList && Array.isArray(savedList.quests) ? savedList : null,
    listBusy: false,
    listError: '',
    minis: savedMinis && Array.isArray(savedMinis.quests) ? savedMinis : null,   // the miniquests
    minisBusy: false,
    order: savedOrder && Array.isArray(savedOrder.order) ? savedOrder : null,   // the wiki's optimal order
    orderBusy: false,
    orderError: '',
    ranks: null,      // quest name -> its place in the optimal order
    player: savedPlayer,   // the character you looked up, or null
    aidxBusy: false,  // reading all areas so their tasks can be searched
    aidxFail: [],     // areas that could not be read
    aidxWait: [],     // what to do when all areas are read
    qdone: null,      // quests marked done by hand (in an imported file): { normName: 1 }
    area: null,       // the area that is open (Area Tasks), its name, and your ticks
    areaKey: '',
    aprog: null,
    playerBusy: false,
    playerMsg: '',
    playerInput: '',
    closed: {},       // letter groups in the quest list that are folded shut
    maps: [],         // map data for the map boxes on screen
    live: [],         // Leaflet maps that are running
    loading: false,
    error: '',
    input: '',
    scroll: {},
    resetArmed: 0,
    toastTimer: 0
  };
  function applySettings() {
    document.documentElement.style.fontSize = S.set.fontSize + 'px';
    document.documentElement.setAttribute('data-theme', S.set.theme);
  }
  function saveSettings() { sset('settings', S.set); }

  // ---------- saved quests and progress ----------
  function topSteps(q) {
    var out = [];
    q.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b) { if (b.type === 'step') out.push(b.id); });
    });
    return out;
  }
  function metaAll() {
    var m = sget('meta');
    if (m && typeof m === 'object' && !Array.isArray(m)) return m;
    // No meta yet: it is made from a saved "recent" list, if there is one.
    m = {};
    var old = sget('recent');
    if (Array.isArray(old)) {
      old.forEach(function (x, i) { if (x && x.key) m[x.key] = { title: x.title || x.key, done: x.done || 0, total: x.total || 0, at: Date.now() - i * 1000 }; });
      sset('meta', m);
      sdel('recent');
    }
    return m;
  }
  function remember(key, title, doneCount, total) {
    var m = metaAll(), old = m[key] || {};
    m[key] = {
      title: title || old.title || key,
      done: doneCount != null ? doneCount : (old.done || 0),
      total: total != null ? total : (old.total || 0),
      at: Date.now()
    };
    sset('meta', m);
  }
  function storeQuest(q) {
    var ids = topSteps(q), p = sget('prog.' + q.page) || {}, steps = p.steps || {};
    remember(q.page, q.title, ids.filter(function (id) { return steps[id]; }).length, ids.length);
    sset('quest.' + q.page, q);
  }
  function validTab(t) { return pick(TABS, t, 'overview'); }
  function loadProg(key) {
    var p = sget('prog.' + key) || {};
    return { steps: p.steps || {}, items: p.items || {}, tab: validTab(p.tab), open: p.open || {}, acc: p.acc || {} };
  }
  function saveProg() { if (S.key && S.prog) sset('prog.' + S.key, S.prog); }
  // A saved guide with "bring" lines as one text: each line becomes an item.
  function upgrade(q) {
    (q.sections || []).forEach(function (sec) {
      sec.blocks.forEach(function (b, i) {
        if (b.type !== 'bring') return;
        ['needed', 'recommended'].forEach(function (k) {
          if (typeof b[k] === 'string') b[k] = b[k] ? [{ id: sec.id + ':bring:v1-' + i + k, html: b[k], text: textOf(b[k]) }] : [];
        });
      });
    });
    q.overview = q.overview || {};
    return q;
  }
  function qdoneAll() {
    if (!S.qdone) { var d = sget('qdone'); S.qdone = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; }
    return S.qdone;
  }
  function markedDone(title) { return !!qdoneAll()[QG.normName(title)]; }
  function setMarked(title, on) {
    var d = qdoneAll(), n = QG.normName(title);
    // Only kept when nothing else says the quest is done.
    var other = playerStatus(title) === 2 || (function () {
      var m = metaAll(), k = Object.keys(m).filter(function (x) { return D.norm(m[x].title) === D.norm(title); })[0];
      return !!k && m[k].total > 0 && m[k].done >= m[k].total;
    })();
    if (on && !other) d[n] = 1; else delete d[n];
    sset('qdone', d);
  }

  // ---------- player lookup (Jagex's player data, passed on by the wiki) ----------
  // 2 = the game says this quest is done, 1 = started, 0 = not started or no player.
  function playerStatus(title) {
    return S.player ? (S.player.quests[QG.normName(title)] || 0) : 0;
  }
  // A quest the game says you cannot start yet: you miss a quest, a level or something else it needs.
  function playerLocked(title) {
    return !!(S.player && S.player.locked && S.player.locked[QG.normName(title)]);
  }
  function playerLevel(skill) {
    var v = S.player && S.player.levels ? S.player.levels[String(skill).toLowerCase()] : null;
    return typeof v === 'number' ? v : null;
  }
  function playerError(e, name) {
    var c = e && e.code;
    if (c === 'nodata') return 'Found no player called \u201c' + name + '\u201d. Check the spelling.';
    if (c === 'timeout') return 'The wiki took too long to answer. Try again.';
    return 'Could not reach the wiki. Check your internet, then try again.';
  }
  function playerHtml() {
    if (S.player) {
      return '<div class="player" id="player"><span class="pn"><b>' + esc(S.player.name) + '</b> \u00b7 ' +
        plural(S.player.done || 0, 'quest', 'quests') + ' done' +
        (typeof S.player.qp === 'number' ? ' \u00b7 <span title="Quest points' + (S.player.qpMax ? ', of ' + S.player.qpMax : '') + '">' + S.player.qp + ' QP</span>' : '') + '</span>' +
        '<button class="ib xs" type="button" data-act="player-refresh" aria-label="Update player" title="Update from the game"' + (S.playerBusy ? ' disabled' : '') + '>' +
        (S.playerBusy ? I.loader : I.refresh) + '</button>' +
        '<button class="ib xs" type="button" data-act="player-clear" aria-label="Forget this player" title="Forget this player">' + I.x + '</button></div>';
    }
    return '<form class="player" id="player-form" novalidate>' +
      '<label class="vh" for="player-name">Your character name</label>' +
      '<div class="row-f"><input class="inp" id="player-name" name="player" type="text" maxlength="12" autocomplete="off" autocapitalize="off" spellcheck="false"' +
      ' placeholder="Your character name" value="' + esc(S.playerInput) + '"' + (S.playerBusy ? ' disabled' : '') + '>' +
      '<button class="btn" type="submit"' + (S.playerBusy ? ' disabled' : '') + '>Look up</button></div>' +
      (S.playerMsg ? '<p class="pmsg' + (S.playerBusy ? '' : ' err') + '" id="player-msg" role="status">' + esc(S.playerMsg) + '</p>' : '') +
      '</form>';
  }
  function drawPlayer() {
    var el = byId('parea');
    if (el) el.innerHTML = playerHtml();
  }
  // A new or forgotten player changes the list, or the quest you are in (your levels, the quest tree).
  // The settings stay open, and the page keeps its place.
  function playerChanged() {
    drawPlayer();
    A.drawList();
    if (S.view === 'start') return;
    var cog = byId('cog'), open = cog && !cog.hidden, main = byId('main'), top = main ? main.scrollTop : 0;
    if (S.view === 'area') A.renderArea(true); else A.renderQuest();
    if (open) toggleMenu('cog');
    main = byId('main');
    if (main) main.scrollTop = top;
  }
  // Looks a player up. With quiet, a failure keeps the old data and says nothing.
  function lookUpPlayer(name, quiet) {
    name = String(name || '').replace(/\s+/g, ' ').trim();
    var had = S.player;
    if (!name) { S.playerMsg = 'Type your character name first.'; drawPlayer(); return; }
    if (S.playerBusy) return;
    S.playerBusy = true;
    S.playerMsg = 'Looking up ' + name + '\u2026';
    drawPlayer();
    QG.loadPlayer(name).then(function (p) {
      S.playerBusy = false;
      S.playerMsg = '';
      S.playerInput = '';
      S.player = p;
      sset('player', p);
      playerChanged();
    }, function (e) {
      S.playerBusy = false;
      S.playerMsg = had ? '' : playerError(e, name);
      drawPlayer();
      if (had && !quiet) toast('Could not update ' + name + '. ' + playerError(e, name), 5000);
    });
  }
  function forgetPlayer() {
    S.player = null;
    S.playerMsg = '';
    S.playerInput = '';
    sdel('player');
    playerChanged();
  }

  // ---------- menus: the cog (settings) and the dots (quest or area actions) ----------
  function toggleHtml(act, icon, label, on) {
    return '<button class="mi" type="button" role="menuitemcheckbox" aria-checked="' + (on ? 'true' : 'false') + '" data-act="' + act + '">' +
      icon + '<span class="ml">' + label + '</span><span class="tg" aria-hidden="true"></span></button>';
  }
  function selectHtml(id, label, list, value) {
    return '<div class="mi mrow"><label class="ml" for="' + id + '">' + label + '</label><select class="sel" id="' + id + '">' + list.map(function (s) {
      return '<option value="' + s[0] + '"' + (value === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
    }).join('') + '</select></div>';
  }
  // The settings: the same everywhere in the app. Your player, how the quest list is sorted and
  // filtered, and how things look.
  function cogHtml() {
    return '<button class="ib" type="button" data-menu="cog" id="cog-btn" aria-label="Settings" aria-haspopup="true" aria-expanded="false" aria-controls="cog" title="Settings">' + I.cog + '</button>' +
      '<div class="menu wide" id="cog" hidden>' +
      (S.view === 'quest' ? '<button class="mi" type="button" data-act="jump">' + I.locate + 'Jump to next step</button><hr>' : '') +
      '<p class="mh">Player</p><div id="parea">' + playerHtml() + '</div><hr>' +
      // Reading the game needs Alt1 (on a computer), so this is only there in Alt1.
      (window.alt1 ? '<p class="mh">Game</p><button class="mi" type="button" data-act="scan-open">' + I.eye + 'Scan achievements</button><hr>' : '') +
      '<p class="mh">Lists</p>' +
      selectHtml('sort', 'Sort by', SORTS, S.set.sort) +
      toggleHtml('hidedone', I.check, 'Hide completed', S.set.hideDone) +
      toggleHtml('hidemini', I.scroll, 'Hide miniquests', S.set.hideMini) +
      toggleHtml('hidelocked', I.lock, 'Hide locked', S.set.hideLocked) +
      '<hr><p class="mh">Display</p>' +
      selectHtml('theme', 'Theme', THEMES, S.set.theme) +
      toggleHtml('showdone', I.eye, 'Show done steps', S.set.showDone) +
      '<div class="mi mrow" role="group" aria-label="Text size">' + I.type + '<span class="ml">Text size</span>' +
      '<button class="ib xs" type="button" data-act="font-down" aria-label="Smaller text" title="Smaller text"' + (S.set.fontSize <= FONT_MIN ? ' disabled' : '') + '>' + I.minus + '</button>' +
      '<span class="fsv" id="fsv" aria-live="polite">' + S.set.fontSize + '</span>' +
      '<button class="ib xs" type="button" data-act="font-up" aria-label="Bigger text" title="Bigger text"' + (S.set.fontSize >= FONT_MAX ? ' disabled' : '') + '>' + I.plus + '</button>' +
      '</div>' +
      '<hr><button class="mi" type="button" data-act="list-refresh">' + I.refresh + 'Update quest list</button>' +
      '<hr><p class="mh">Backup</p>' +
      '<button class="mi" type="button" data-act="export">' + I.ext + 'Export state</button>' +
      '<button class="mi" type="button" data-act="import">' + I.plus + 'Import state</button>' +
      '<hr><p class="mh danger">Danger zone</p>' +
      '<button class="mi danger" type="button" data-act="wipe">' + I.reset + '<span>Delete everything</span></button>' +
      '</div>';
  }
  function dotsHtml() {
    return '<button class="ib" type="button" data-menu="menu" id="menu-btn" aria-label="Quest menu" aria-haspopup="true" aria-expanded="false" aria-controls="menu" title="Quest menu">' + I.dots + '</button>' +
      '<div class="menu" id="menu" role="menu" hidden>' +
      '<button class="mi" type="button" role="menuitem" data-act="refresh">' + I.refresh + 'Refresh from wiki</button>' +
      '<a class="mi" role="menuitem" href="' + esc(S.q.source) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on wiki</a>' +
      '<hr><button class="mi danger" type="button" role="menuitem" data-act="reset">' + I.reset + '<span>Reset progress</span></button>' +
      '</div>';
  }
  function closeMenus(except) {
    ['cog', 'menu'].forEach(function (id) {
      if (id === except) return;
      var m = byId(id), b = document.querySelector('[data-menu="' + id + '"]');
      if (m && !m.hidden) { m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); if (id === 'menu') disarmReset(); else disarmWipe(); }
    });
  }
  function toggleMenu(id) {
    var m = byId(id), b = document.querySelector('[data-menu="' + id + '"]');
    if (!m) return;
    closeMenus(id);
    var show = m.hidden;
    m.hidden = !show;
    if (b) b.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (!show && id === 'menu') disarmReset();
  }

  // ---------- the window: the parts every screen has ----------
  // The title band: a back button (with what it goes back to), or the app's emblem on the start screen; the name;
  // the settings cog and any more buttons on the right.
  function headerHtml(title, back, more) {
    return '<header class="hdr">' +
      (back ? '<button class="ib" type="button" data-act="change" aria-label="' + back + '" title="' + back + '">' + I.back + '</button>' :
        '<img class="emb" src="icon.svg" alt="" width="26" height="26">') +
      '<h1 class="qt"' + (back ? ' title="' + esc(title) + '"' : '') + '>' + esc(title) + '</h1>' +
      '<div class="hs he">' + cogHtml() + (more || '') + '</div></header>';
  }
  // The progress bar under the title band.
  function progHtml(done, max, label, count) {
    return '<div class="prog"><progress class="pg" id="pg" value="' + done + '" max="' + Math.max(max, 1) + '" aria-label="' + label + '"></progress>' +
      '<span class="cnt" id="pg-cnt">' + count + '</span></div>';
  }
  // One tab: attr is what the click handler reads (data-tab, data-tier, data-home).
  function tabHtml(attr, value, on, label, icon) {
    return '<button class="tab" type="button" role="tab" ' + attr + '="' + esc(value) + '" aria-selected="' + on + '"' +
      (icon ? ' title="' + label + '"' : '') + '>' + (icon || '') + '<span class="tl-l">' + esc(label) + '</span></button>';
  }
  function tabsHtml(label, tabs, cls) { return '<nav class="tabs' + (cls ? ' ' + cls : '') + '" role="tablist" aria-label="' + label + '">' + tabs.join('') + '</nav>'; }
  // The big button at the bottom ("Done, next step").
  function nextHtml(act, label, off) {
    return '<footer class="ftr"><button class="next" type="button" id="next-btn" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' +
      I.check + '<span>' + label + '</span></button></footer>';
  }
  // A part of a screen that folds open and shut: a bar with its name and a count, and what is in it. attr names the
  // part for the click handler (data-sec: a quest's part, data-ov: an Overview part, data-asec: a part of an area);
  // its button has attr + "-btn" with key (or id). done: everything in it is done.
  function partHtml(attr, id, name, count, body, open, o) {
    o = o || {};
    return '<section class="sec' + (o.done ? ' alldone' : '') + '" ' + attr + '="' + esc(id) + '"><h2 class="sh">' +
      '<button class="sech' + (o.done ? ' done' : '') + '" type="button" ' + attr + '-btn="' + esc(o.key || id) + '" aria-expanded="' + open + '">' +
      I.chev + '<span class="n">' + name + '</span><span class="c"' + (o.countAttr || '') + '>' + count + '</span></button></h2>' +
      '<div class="secb"' + (open ? '' : ' hidden') + '>' + body + '</div></section>';
  }
  function toastHtml(low) { return '<div class="toast' + (low ? ' low' : '') + '" id="toast" role="status" aria-live="polite" hidden></div>'; }
  // ---------- the start screen: the quest list, or the area list ----------
  function alt1Html() {
    if (window.alt1 || !/^https?:$/.test(location.protocol)) return '';
    var cfg;
    try { cfg = new URL('appconfig.json', location.href).href; } catch (e) { return ''; }
    return '<p class="foot">Using Alt1? <a href="alt1://addapp/' + esc(cfg) + '">Add this app to Alt1</a>.</p>';
  }
  function homeHtml() { return S.set.home === 'areas' ? A.areaListHtml() : A.listHtml(); }
  function sortKey(t) { return t.replace(/^[^A-Za-z0-9]+/, '').toLowerCase(); }
  function renderStart() {
    S.view = 'start';
    dropMaps();
    app.innerHTML =
      headerHtml('Quick Guide') +
      tabsHtml('Lists', HOMES.map(function (h) { return tabHtml('data-home', h[0], S.set.home === h[0], h[1]); }), 'home') +
      '<main class="scroll" id="main">' +
      '<form class="find" id="load-form" novalidate>' +
      '<label class="vh" for="quest-link">' + (S.set.home === 'areas' ? 'Search areas and tasks' : 'Search quests') + '</label>' +
      '<div class="row-f"><input class="inp' + (S.error ? ' bad' : '') + '" id="quest-link" name="link" type="text"' +
      ' autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (S.set.home === 'areas' ? 'Search areas and tasks' : 'Search quests') + '" value="' + esc(S.input) + '"' +
      (S.error ? ' aria-invalid="true" aria-describedby="load-err"' : '') + (S.loading ? ' disabled' : '') + '>' +
      '<button class="btn" type="submit"' + (S.loading ? ' disabled' : '') + '>Open</button></div>' +
      (S.error ? '<p class="err" id="load-err" role="alert">' + esc(S.error) + '</p>' : '') +
      '</form>' +

      (S.loading ? '<div class="state" role="status">' + I.loader + '<p>Reading \u201c' + esc(S.loading) + '\u201d from the wiki\u2026</p></div>' : '') +
      '<div id="qarea">' + (S.loading ? '' : homeHtml()) + '</div>' +
      alt1Html() +
      '<p class="foot">Quests and guide text come from the <a href="https://runescape.wiki/" target="_blank" rel="noopener">RuneScape Wiki</a> (CC BY-NC-SA 3.0).</p>' +
      '</main>' +
      '<div class="toast low" id="toast" role="status" aria-live="polite" hidden></div>';
    if (!S.list && !S.listBusy && !S.listError) A.fetchList(false);
  }

  // ---------- shared pieces: boxes, rows, quest links, skill levels ----------
  function note(html) { return '<div class="note">' + I.info + '<span>' + html + '</span></div>'; }
  function warn(html) { return '<div class="note warn">' + I.alert + '<span>' + html + '</span></div>'; }
  function acc(icon, label, meta, body, open, attrs) {
    // Boxes start open, unless a caller says otherwise. The app remembers the ones you close.
    return '<details class="acc"' + (open === false ? '' : ' open') + (attrs || '') + '><summary>' + I.chev + (icon || '') +
      '<span class="sl">' + esc(label) + '</span>' + (meta ? '<span class="m">' + esc(meta) + '</span>' : '') +
      '</summary><div class="body">' + body + '</div></details>';
  }
  function imgHtml(im) {
    return '<a class="imgl" href="' + esc(im.href || im.src) + '" target="_blank" rel="noopener" title="Open on the wiki">' +
      '<img src="' + esc(im.src) + '" alt="' + esc(im.alt || im.caption || '') + '" loading="lazy" decoding="async"' +
      (im.width ? ' width="' + im.width + '"' : '') + (im.height ? ' height="' + im.height + '"' : '') + '></a>' +
      (im.caption ? '<p class="cap">' + esc(im.caption) + '</p>' : '');
  }
  function mapAcc(m) {
    var key = S.maps.push(m) - 1;
    var link = '<a href="' + esc(m.href || (S.q && S.q.source) || QG.WIKI) + '" target="_blank" rel="noopener">Open on the wiki</a>';
    // A "Show on map" link has the caption "Map": no need to say "Map: Map".
    var named = m.caption && !/^map$/i.test(m.caption);
    return acc(I.map, named ? 'Map: ' + m.caption : 'Map', '',
      '<div class="map" data-map="' + key + '" role="region" aria-label="Map"></div>' +
      '<p class="cap">' + (named ? esc(m.caption) + ' \u00b7 ' : '') + link + '</p>');
  }
  function imageAcc(im, fallback) {
    if (im.type === 'map') return mapAcc(im);
    return acc(I.image, im.caption || fallback || im.alt || 'Picture', '', imgHtml(im));
  }
  function tableAcc(t) {
    var cols = t.head.length;
    t.rows.forEach(function (r) { if (r.length > cols) cols = r.length; });
    var body = '<div class="tblw"><table class="tbl">' +
      (t.head.length ? '<thead><tr>' + t.head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead>' : '') +
      '<tbody>' + t.rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          var span = (i === r.length - 1 && r.length < cols) ? ' colspan="' + (cols - r.length + 1) + '"' : '';
          return '<td' + span + '>' + c + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    return acc(I.table, t.label || 'Table', plural(t.rows.length, 'row', 'rows'), body);
  }
  // One clickable row with a tick box. kind: "scb" for steps, "icb" for items.
  function rowHtml(kind, id, checked, textHtml, extraHtml) {
    var tid = nextId();
    return '<div class="row"><input class="cb" type="checkbox" data-' + kind + '="' + esc(id) + '" aria-labelledby="' + tid + '"' + (checked ? ' checked' : '') + '>' +
      '<div class="rb"><span class="t" id="' + tid + '">' + textHtml + '</span>' + (extraHtml || '') + '</div></div>';
  }
  function liHtml(h) { return '<li>' + h + '</li>'; }
  // A quest name you can click to open that quest here, in the app.
  function questBtn(title, label) {
    return '<button class="qlink" type="button" data-quest="' + esc(title) + '" title="Open this quest">' + esc(label || title) + '</button>';
  }
  // Wiki links to quests become buttons that open the quest in the app.
  function questLinks(html) {
    var d = scratch.createElement('div');
    d.innerHTML = String(html || '');
    arr(d.querySelectorAll('a')).forEach(function (a) {
      var name = a.textContent.replace(/\s+/g, ' ').trim();
      if (!name) return;
      var w = scratch.createElement('span');
      w.innerHTML = questBtn(name);
      a.parentNode.replaceChild(w.firstChild, a);
    });
    return d.innerHTML;
  }
  // Skill and quest requirements, like the wiki: "• 100 [icon] Mining ✓". The level, the skill's icon and its name
  // (a link to the wiki) stay as they are; with a player looked up, a green tick follows when you have it and a red
  // cross when you do not (its tooltip says your level). "(boostable)" when the wiki marks the level [B].
  // tag: 'li' in a list, 'span' in a line.
  function skillIcon(name) {
    return '<img class="sic" src="https://runescape.wiki/images/' + encodeURIComponent(String(name).replace(/ /g, '_')) +
      '-icon.png" alt="" width="20" height="20" loading="lazy" onerror="this.remove()">';
  }
  // A green tick (ok) or a red cross, with what it means in its tooltip.
  function markHtml(ok, what) {
    return '<span class="mk ' + (ok ? 'ok' : 'no') + '" role="img" aria-label="' + esc(what) + '" title="' + esc(what) + '">' + (ok ? I.check : I.x) + '</span>';
  }
  function skillHtml(s, tag) {
    var mine = playerLevel(s.skill), st = mine == null ? '' : mine >= s.level ? 'ok' : 'low';
    var boost = s.boost || /boost|\[\s*b\s*\]|\(\s*b\s*\)/i.test(s.note || '');
    var note = s.note && !/^\W*(boostable|\[\s*b\s*\]|\(\s*b\s*\))\W*$/i.test(s.note) ? s.note : '';
    return '<' + tag + ' class="skl' + (st ? ' ' + st : '') + '"><span class="lv">' + esc(s.level) + '</span> ' + skillIcon(s.skill) +
      ' <a class="sn" href="' + esc(QG.pageUrl(s.skill)) + '" target="_blank" rel="noopener">' + esc(s.skill) + '</a>' +
      (st ? ' ' + markHtml(st === 'ok', st === 'ok' ? 'You have ' + mine : 'Too low: you have ' + mine) : '') +
      (boost ? ' <sup class="bst" title="You may use a boost for this level">(boostable)</sup>' : '') +
      (note ? ' <span class="x">' + esc(note) + '</span>' : '') + '</' + tag + '>';
  }
  // After a quest's name: a green tick when you have done it (like the wiki, nothing when you have not).
  function questMark(q) {
    return S.player && playerStatus(q) === 2 ? ' ' + markHtml(true, 'Done') : '';
  }
  // Boxes (pictures, maps, tables, music...) remember if you opened them.
  function accKey(d) {
    var host = d.closest('[data-step], [data-item]'), sec = d.closest('.sec');
    var base = host ? (host.getAttribute('data-step') || host.getAttribute('data-item')) :
      sec ? (sec.getAttribute('data-sec') || 'ov:' + sec.getAttribute('data-ov')) : S.prog.tab;
    var sl = d.querySelector(':scope > summary .sl'), label = sl ? sl.textContent : '';
    var same = arr((host || sec || byId('main')).querySelectorAll('details.acc')).filter(function (x) {
      var l = x.querySelector(':scope > summary .sl');
      return (l ? l.textContent : '') === label;
    });
    return base + '|' + label + '|' + same.indexOf(d);
  }
  function restoreAcc() {
    var saved = S.prog.acc || {}, main = byId('main');
    arr(main.querySelectorAll('details.acc')).forEach(function (d) {
      var v = saved[accKey(d)];
      if (v === 1) d.open = true; else if (v === 0) d.open = false;
    });
  }
  function disarmReset() {
    S.resetArmed = 0;
    var s = document.querySelector('[data-act="reset"] span');
    if (s) s.textContent = 'Reset progress';
  }
  function resetClick(btn) {
    if (S.resetArmed && Date.now() - S.resetArmed < 4000) {
      S.prog.steps = {};
      S.prog.items = {};
      S.prog.open = {};
      S.prog.acc = {};
      S.scroll = {};
      S.resetArmed = 0;
      A.renderQuest();
      toast('Progress reset.');
      if (S.prog.tab === 'steps') A.jumpTo(A.current(), false);
      return;
    }
    S.resetArmed = Date.now();
    btn.querySelector('span').textContent = 'Click again to reset';
  }

  // ---------- maps (Leaflet with the wiki's map tiles) ----------
  // A place on a map: a dot in the theme's gold (or light blue), with a dark rim.
  function dotStyle() {
    var css = getComputedStyle(document.documentElement);
    return { radius: 7, color: css.getPropertyValue('--win').trim() || '#1b1713', weight: 2, opacity: 1, fillColor: css.getPropertyValue('--gold').trim() || '#f2c45e', fillOpacity: 1 };
  }
  function dropMaps() {
    S.live.forEach(function (map) { try { map.remove(); } catch (e) { /* already gone */ } });
    S.live = [];
    S.maps = [];
  }
  function resizeMaps() { S.live.forEach(function (map) { map.invalidateSize(); }); }
  // Starts every map that is in an open box and on screen (not inside a folded part).
  function startMaps() {
    var main = byId('main');
    if (!main || S.view !== 'quest') return;
    arr(main.querySelectorAll('details[open] > .body > .map')).forEach(function (el) {
      if (!el.getAttribute('data-ready') && el.offsetParent !== null) initMap(el);
    });
  }
  function initMap(el) {
    el.setAttribute('data-ready', '1');
    var m = S.maps[+el.getAttribute('data-map')];
    if (!m) return;
    var L = window.L;
    if (!L) { el.innerHTML = '<p class="para">The map could not load. Use the wiki link below.</p>'; return; }
    var version = m.version || (S.q && S.q.mapVersion) || QG.MAP_VERSION;
    var map = L.map(el, { crs: L.CRS.Simple, minZoom: 0, maxZoom: 4, zoomSnap: 1, scrollWheelZoom: false, attributionControl: true });
    S.live.push(map);
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Map: <a href="https://runescape.wiki/" target="_blank" rel="noopener">RuneScape Wiki</a>');
    // Tile files are named plane_x_y, with y counted upwards from the bottom of the world.
    var Tiles = L.TileLayer.extend({
      getTileUrl: function (c) {
        return 'https://maps.runescape.wiki/rs/versions/' + encodeURIComponent(version) + '/map_icon_squares/' +
          m.mapId + '/' + c.z + '/' + m.plane + '_' + c.x + '_' + (-(1 + c.y)) + '.png';
      }
    });
    new Tiles('', { minZoom: 0, maxNativeZoom: 3, maxZoom: 4, noWrap: true }).addTo(map);
    map.setView([m.lat, m.lon], Math.max(0, Math.min(4, Math.round(m.zoom))));
    function dot(ll) { return L.circleMarker(ll, dotStyle()); }
    var feats = m.features || [];
    if (feats.length) {
      L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        pointToLayer: function (f, ll) { return dot(ll); },
        style: function (f) {
          var p = f.properties || {};
          if (f.geometry && /Point$/.test(f.geometry.type)) return dotStyle();
          return {
            color: p.stroke || '#f2c45a', weight: +p['stroke-width'] || 2, opacity: p['stroke-opacity'] != null ? +p['stroke-opacity'] : 1,
            fillColor: p.fill || '#f2c45a', fillOpacity: p['fill-opacity'] != null ? +p['fill-opacity'] : 0.25
          };
        },
        onEachFeature: function (f, layer) {
          var p = f.properties || {}, tip = textOf(p.title || p.description || '');
          if (tip) layer.bindTooltip(esc(tip), { direction: 'top', offset: [0, -6] });
        }
      }).addTo(map);
    } else {
      dot([m.lat, m.lon]).addTo(map);
    }
    // Scroll the list with the mouse wheel; click the map first to zoom it with the wheel.
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
    // The map may be gone by then (you switched tabs), so check first.
    setTimeout(function () { if (S.live.indexOf(map) >= 0) map.invalidateSize(); }, 60);
  }

  // ---------- settings, Delete everything, and the toast ----------
  function toast(msg, ms) {
    var el = byId('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(S.toastTimer);
    if (ms !== 0) S.toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }
  function setFont(delta) {
    S.set.fontSize = clampFont(S.set.fontSize + delta);
    saveSettings();
    applySettings();
    resizeMaps();
    var v = byId('fsv');
    if (v) v.textContent = S.set.fontSize;
    var down = document.querySelector('[data-act="font-down"]'), up = document.querySelector('[data-act="font-up"]');
    if (down) down.disabled = S.set.fontSize <= FONT_MIN;
    if (up) up.disabled = S.set.fontSize >= FONT_MAX;
  }
  // The on/off switches in the settings: which setting each one flips.
  var SWITCHES = { showdone: 'showDone', hidedone: 'hideDone', hidemini: 'hideMini', hidelocked: 'hideLocked' };
  // Flips a switch, and shows it: "Show done steps" shows or hides the done steps; the others redraw the list.
  function toggleSetting(act) {
    var key = SWITCHES[act];
    S.set[key] = !S.set[key];
    saveSettings();
    var mi = document.querySelector('.mi[data-act="' + act + '"]');
    if (mi) mi.setAttribute('aria-checked', S.set[key] ? 'true' : 'false');
    if (key !== 'showDone') { A.drawList(); return; }
    var main = byId('main');
    if (main && S.view !== 'start') main.classList.toggle('show-done', S.set.showDone);
  }
  // Danger zone: "Delete everything" takes two clicks, the second within 4 seconds.
  function disarmWipe() {
    S.wipeArmed = 0;
    var w = document.querySelector('[data-act="wipe"] span');
    if (w) w.textContent = 'Delete everything';
  }
  function wipeClick(btn) {
    if (!(S.wipeArmed && Date.now() - S.wipeArmed < 4000)) {
      S.wipeArmed = Date.now();
      btn.querySelector('span').textContent = 'Click again to delete everything';
      return;
    }
    S.wipeArmed = 0;
    closeMenus();
    A.closeBackup();
    A.stopScan();
    try {
      var ls = window.localStorage, keys = [];
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k); }
      keys.forEach(function (k) { ls.removeItem(k); });
    } catch (e) { /* blocked: only memory to clear */ }
    Object.keys(memory).forEach(function (k) { delete memory[k]; });
    S.set = readSettings();
    S.player = null; S.playerMsg = ''; S.playerInput = '';
    S.list = null; S.minis = null; S.order = null; S.ranks = null; S.qdone = null;
    S.listError = ''; S.orderError = ''; S.aidxFail = [];
    S.q = null; S.key = ''; S.prog = null; S.area = null; S.areaKey = ''; S.aprog = null;
    S.closed = {}; S.input = ''; S.error = ''; S.loading = false; S.scroll = {};
    applySettings();
    renderStart();
    toast('Everything is deleted.');
  }

  A.share({ D: D, partHtml: partHtml, headerHtml: headerHtml, progHtml: progHtml, tabHtml: tabHtml, tabsHtml: tabsHtml, nextHtml: nextHtml, toastHtml: toastHtml, THEMES: THEMES, readSettings: readSettings, DIF_ORDER: DIF_ORDER, FONT_STEP: FONT_STEP, HOMES: HOMES, I: I, LEN_ORDER: LEN_ORDER,
    LIST_MAX_AGE: LIST_MAX_AGE, OV: OV, PLAYER_MAX_AGE: PLAYER_MAX_AGE, PREFIX: PREFIX, QG: QG, S: S, SORTS: SORTS,
    TABS: TABS, TAB_ICON: TAB_ICON, acc: acc, accKey: accKey, app: app, applySettings: applySettings, arr: arr,
    byId: byId, clampFont: clampFont, closeMenus: closeMenus, cogHtml: cogHtml, dateText: dateText,
    dotsHtml: dotsHtml, dropMaps: dropMaps, esc: esc, forgetPlayer: forgetPlayer, homeHtml: homeHtml,
    imageAcc: imageAcc, imgHtml: imgHtml, liHtml: liHtml, loadProg: loadProg, lookUpPlayer: lookUpPlayer,
    mapAcc: mapAcc, markedDone: markedDone, memory: memory, metaAll: metaAll, note: note, pick: pick,
    playerLevel: playerLevel, playerLocked: playerLocked, playerStatus: playerStatus, plural: plural,
    questBtn: questBtn, questLinks: questLinks, questMark: questMark, remember: remember, renderStart: renderStart,
    resetClick: resetClick, resizeMaps: resizeMaps, restoreAcc: restoreAcc, rowHtml: rowHtml, saveProg: saveProg,
    saveSettings: saveSettings, sdel: sdel, setFont: setFont, setMarked: setMarked, sget: sget, skillHtml: skillHtml,
    smooth: smooth, sortKey: sortKey, sset: sset, startMaps: startMaps, storeQuest: storeQuest, tableAcc: tableAcc,
    textOf: textOf, toast: toast,
    toggleMenu: toggleMenu, SWITCHES: SWITCHES, toggleSetting: toggleSetting, topSteps: topSteps,
    upgrade: upgrade, validTab: validTab, warn: warn, wipeClick: wipeClick });
  A.loaded.core = true;
})();
