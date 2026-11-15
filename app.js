/*!
 * Quick Guide - app.js
 * A tick list for RuneScape Wiki quest quick guides and Area Tasks, made for the Alt1 browser.
 *
 * The parts of this file, in order: storage, helpers, state, saved quests and progress, step logic,
 * loading a quest guide, the quest list and the optimal order, player lookup, menus, the start screen,
 * shared pieces, the steps tab, the items and overview tabs, the quest screen, maps, settings,
 * Area Tasks (saved areas, the list and search, one area), export and import, scan achievements (Alt1),
 * events, and start. parser.js reads the wiki pages, quests.js the quest lists, reader.js the game screen.
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
  var PREFIX = 'qg1.';
  var FONT_MIN = 12, FONT_MAX = 40, FONT_STEP = 2, FONT_DEFAULT = 14;
  var LIST_MAX_AGE = 7 * 24 * 3600 * 1000;
  var PLAYER_MAX_AGE = 24 * 3600 * 1000;
  var TABS = [['overview', 'Overview'], ['items', 'Items'], ['steps', 'Steps']];
  // The foldable parts of the Overview tab. They start open.
  var OV = [['details', 'Details'], ['skills', 'Skills'], ['enemies', 'Enemies'], ['rewards', 'Rewards']];
  var SORTS = [['name', 'A to Z'], ['opt', 'Optimal order'], ['dif', 'Difficulty'], ['len', 'Length'], ['ser', 'Series'], ['rel', 'Newest']];
  var HOMES = [['quests', 'Quests'], ['areas', 'Area tasks']];
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
    set: {
      showDone: !!saved.showDone, hideDone: !!saved.hideDone, hideLocked: !!saved.hideLocked,
      // "hideMini" took the place of the old "Quests only" filter (kind: 'quest').
      hideMini: saved.hideMini != null ? !!saved.hideMini : saved.kind === 'quest',
      fontSize: clampFont(saved.fontSize || FONT_DEFAULT),
      sort: pick(SORTS, saved.sort, 'name'), home: pick(HOMES, saved.home, 'quests')
    },
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
    // The first version kept a short "recent" list instead.
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
  // Quests saved by the first version kept "bring" lines as one text.
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
    S.scroll = {};
    S.resetArmed = 0;
    sset('last', key);
    buildIndex();
    renderQuest();
    if (S.prog.tab === 'steps') jumpTo(current(), false);
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
      if (S.prog.tab === 'steps' && S.scroll.steps == null) jumpTo(current(), false);
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

  // ---------- player lookup (RuneMetrics, passed on by the wiki) ----------
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
    if (c === 'nodata') return 'Found nothing for \u201c' + name + '\u201d. Check the spelling, and that your RuneMetrics profile is public.';
    if (c === 'timeout') return 'The wiki took too long to answer. Try again.';
    return 'Could not reach the wiki. Check your internet, then try again.';
  }
  function playerHtml() {
    if (S.player) {
      return '<div class="player" id="player"><span class="pn"><b>' + esc(S.player.name) + '</b> \u00b7 ' +
        plural(S.player.done || 0, 'quest', 'quests') + ' done</span>' +
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
    drawList();
    if (S.view === 'start') return;
    var cog = byId('cog'), open = cog && !cog.hidden, main = byId('main'), top = main ? main.scrollTop : 0;
    if (S.view === 'area') renderArea(true); else renderQuest();
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

  // ---------- start screen: the quest list, or the area list ----------
  function alt1Html() {
    if (window.alt1 || !/^https?:$/.test(location.protocol)) return '';
    var cfg;
    try { cfg = new URL('appconfig.json', location.href).href; } catch (e) { return ''; }
    return '<p class="foot">Using Alt1? <a href="alt1://addapp/' + esc(cfg) + '">Add this app to Alt1</a>.</p>';
  }
  function homeHtml() { return S.set.home === 'areas' ? areaListHtml() : listHtml(); }
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
  function sortKey(t) { return t.replace(/^[^A-Za-z0-9]+/, '').toLowerCase(); }
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
  function renderStart() {
    S.view = 'start';
    dropMaps();
    app.innerHTML =
      '<header class="hdr"><img class="emb" src="icon.png" alt="" width="26" height="26"><h1 class="qt">Quick Guide</h1><div class="hs he">' + cogHtml() + '</div></header>' +
      '<nav class="tabs home" role="tablist" aria-label="Lists">' + HOMES.map(function (h) {
        return '<button class="tab" type="button" role="tab" data-home="' + h[0] + '" aria-selected="' + (S.set.home === h[0]) + '"><span class="tl-l">' + h[1] + '</span></button>';
      }).join('') + '</nav>' +
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
    if (!S.list && !S.listBusy && !S.listError) fetchList(false);
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
    return '<section class="sec" data-sec="' + esc(sec.id) + '">' +
      '<h2 class="sh"><button class="sech" type="button" data-sec-btn="' + esc(sec.id) + '" aria-expanded="' + open + '">' +
      I.chev + '<span class="n">' + esc(sec.title) + '</span><span class="c"></span></button></h2>' +
      '<div class="secb"' + (open ? '' : ' hidden') + '>' + body + '</div></section>';
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
      var id = p[0], open = ovOpen(id);
      if (!bodies[id]) return '';
      return '<section class="sec" data-ov="' + id + '">' +
        '<h2 class="sh"><button class="sech" type="button" data-ov-btn="' + id + '" aria-expanded="' + open + '">' +
        I.chev + '<span class="n">' + p[1] + '</span><span class="c" data-ovc="' + id + '">' + ovCount(id) + '</span></button></h2>' +
        '<div class="secb"' + (open ? '' : ' hidden') + '>' + bodies[id] + '</div></section>';
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
  function tabHtml(t) {
    var on = S.prog.tab === t[0];
    return '<button class="tab" type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + on + '" title="' + t[1] + '">' +
      TAB_ICON[t[0]] + '<span class="tl-l">' + t[1] + '</span></button>';
  }
  function bodyHtml(tab) { return tab === 'steps' ? stepsHtml() : tab === 'items' ? itemsHtml() : overviewHtml(); }
  function renderQuest() {
    var q = S.q, tab = S.prog.tab;
    dropMaps();
    app.innerHTML =
      '<header class="hdr"><button class="ib" type="button" data-act="change" aria-label="All quests" title="All quests">' + I.back + '</button>' +
      '<h1 class="qt" title="' + esc(q.title) + '">' + esc(q.title) + '</h1><div class="hs he">' + cogHtml() + dotsHtml() + '</div></header>' +
      '<div class="prog"><progress class="pg" id="pg" value="0" max="1" aria-label="Quest progress"></progress><span class="cnt" id="pg-cnt"></span></div>' +
      '<nav class="tabs" role="tablist" aria-label="Guide parts">' + TABS.map(tabHtml).join('') + '</nav>' +
      '<main class="scroll' + (S.set.showDone ? ' show-done' : '') + '" id="main" role="tabpanel">' + bodyHtml(tab) + '</main>' +
      (tab === 'steps' ?
        '<footer class="ftr">' +
        '<button class="next" type="button" id="next-btn" data-act="next">' + I.check + '<span>Done, next step</span></button>' +
        '</footer>' : '') +
      '<div class="toast' + (tab === 'steps' ? '' : ' low') + '" id="toast" role="status" aria-live="polite" hidden></div>';
    var main = byId('main');
    if (S.scroll[tab] != null) main.scrollTop = S.scroll[tab];
    restoreAcc();
    main.addEventListener('scroll', function () { S.scroll[tab] = main.scrollTop; }, { passive: true });
    refresh();
    if (S.scroll[tab] != null) main.scrollTop = S.scroll[tab];
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
  function switchTab(tab) {
    tab = validTab(tab);
    if (tab === S.prog.tab) return;
    S.prog.tab = tab;
    saveProg();
    renderQuest();
    if (tab === 'steps' && S.scroll.steps == null) jumpTo(current(), false);
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
      renderQuest();
      toast('Progress reset.');
      if (S.prog.tab === 'steps') jumpTo(current(), false);
      return;
    }
    S.resetArmed = Date.now();
    btn.querySelector('span').textContent = 'Click again to reset';
  }

  // ---------- maps (Leaflet with the wiki's map tiles) ----------
  var DOT = { radius: 7, color: '#1b1510', weight: 2, opacity: 1, fillColor: '#f2c45a', fillOpacity: 1 };
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
    function dot(ll) { return L.circleMarker(ll, DOT); }
    var feats = m.features || [];
    if (feats.length) {
      L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        pointToLayer: function (f, ll) { return dot(ll); },
        style: function (f) {
          var p = f.properties || {};
          if (f.geometry && /Point$/.test(f.geometry.type)) return DOT;
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
  function toggleShowDone() {
    S.set.showDone = !S.set.showDone;
    saveSettings();
    var on = S.set.showDone ? 'true' : 'false';
    var main = byId('main'), mi = document.querySelector('.mi[data-act="showdone"]');
    if (main && S.view !== 'start') main.classList.toggle('show-done', S.set.showDone);
    if (mi) mi.setAttribute('aria-checked', on);
  }
  function toggleHideDone() {
    S.set.hideDone = !S.set.hideDone;
    saveSettings();
    var mi = document.querySelector('.mi[data-act="hidedone"]');
    if (mi) mi.setAttribute('aria-checked', S.set.hideDone ? 'true' : 'false');
    drawList();
  }
  // Flips a list switch in the settings, and redraws the list.
  function toggleSetting(key, act) {
    S.set[key] = !S.set[key];
    saveSettings();
    var mi = document.querySelector('.mi[data-act="' + act + '"]');
    if (mi) mi.setAttribute('aria-checked', S.set[key] ? 'true' : 'false');
    drawList();
  }
  function toggleHideLocked() {
    S.set.hideLocked = !S.set.hideLocked;
    saveSettings();
    var mi = document.querySelector('.mi[data-act="hidelocked"]');
    if (mi) mi.setAttribute('aria-checked', S.set.hideLocked ? 'true' : 'false');
    drawList();
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
    closeBackup();
    stopScan();
    try {
      var ls = window.localStorage, keys = [];
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k); }
      keys.forEach(function (k) { ls.removeItem(k); });
    } catch (e) { /* blocked: only memory to clear */ }
    memory = {};
    S.set = { showDone: false, hideDone: false, hideLocked: false, hideMini: false, fontSize: FONT_DEFAULT, sort: 'name', home: 'quests' };
    S.player = null; S.playerMsg = ''; S.playerInput = '';
    S.list = null; S.minis = null; S.order = null; S.ranks = null; S.qdone = null;
    S.listError = ''; S.orderError = ''; S.aidxFail = [];
    S.q = null; S.key = ''; S.prog = null; S.area = null; S.areaKey = ''; S.aprog = null;
    S.closed = {}; S.input = ''; S.error = ''; S.loading = false; S.scroll = {};
    applySettings();
    renderStart();
    toast('Everything is deleted.');
  }

  // ---------- Area Tasks: saved areas and the task index ----------
  function ametaAll() { var m = sget('ameta'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function loadAprog(name) {
    var p = sget('aprog.' + name);
    if (!p || typeof p !== 'object') p = {};
    if (!p.tasks || typeof p.tasks !== 'object') p.tasks = {};
    return p;
  }
  function saveAprog() { sset('aprog.' + S.areaKey, S.aprog); saveAmeta(); }
  // What the area list needs to know, per tier: how many tasks, how many are done, and what the tier needs.
  function writeAmeta(name, a, p) {
    var m = ametaAll(), old = (m[name] && m[name].tiers) || [];
    m[name] = {
      at: Date.now(),
      tiers: a.tiers.map(function (t) {
        var o = old.filter(function (x) { return x.id === t.id; })[0] || {};
        return {
          id: t.id, name: t.name, total: t.tasks.length, done: t.tasks.filter(function (x) { return p.tasks[x.id]; }).length,
          needs: t.skills ? { skills: t.skills, quests: t.quests } : o.needs
        };
      })
    };
    sset('ameta', m);
  }
  function saveAmeta() { writeAmeta(S.areaKey, S.area, S.aprog); }
  // The index of every task, kept small so all 13 areas can be searched: { "<area>": { v, tiers: [{ id, name, tasks: [{ id, name, subs: [ids] }] }] } }
  function aidxAll() { var m = sget('aidx'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function indexArea(name, a) {
    var ix = aidxAll();
    ix[name] = { v: a.version, tiers: a.tiers.map(function (t) {
      return { id: t.id, name: t.name, tasks: t.tasks.map(function (x) { return { id: x.id, name: x.name, subs: (x.subs || []).map(function (u) { return u.id; }) }; }) };
    }) };
    sset('aidx', ix);
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
        out.push({ area: a.name, id: t.id, name: t.name, total: total, done: done, full: full, started: started,
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
      QG.loadArea(name).then(function (na) { sset('area.' + name, na); indexArea(name, na); },
        function () { S.aidxFail.push(name); }).then(function () { running--; drawList(); pump(); });
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
      '<span class="q1"><b>' + esc(x.area + ' ' + x.name) + '</b>' + status + '</span>' + (x.total ? '<span class="q2">' + plural(x.total, 'task', 'tasks') + '</span>' : '') + bar + '</button></li>';
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
    var li = '<li class="step task srch' + (done ? ' done' : '') + '" data-task="' + esc(r.task.id) + '">' + rowHtml('acb', r.task.id, done, '<b>' + esc(r.task.name) + '</b>', where) + '</li>';
    return li.replace('data-acb=', 'data-aarea="' + esc(r.area) + '" data-acb=');
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
    h += '<p class="qmeta"><span id="qcount">' + (n === total ? plural(n, 'area', 'areas') : n + ' of ' + plural(total, 'area', 'areas')) + '</span>' +
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
    // "Hide completed" and "Hide locked" work here too.
    if (S.set.hideDone) tiers = tiers.filter(function (t) { return !t.full; });
    if (S.set.hideLocked) tiers = tiers.filter(function (t) { return !t.locked; });
    // Each tier stays in its own area, in the game's order; a started one has its progress bar right there.
    QG.AREAS.forEach(function (a) {
      var rows = tiers.filter(function (t) { return t.area === a.name; });
      if (rows.length) h += groupHtml(a.name, a.name, rows.length, { html: rows.map(tierRow).join('') });
    });
    if (!tiers.length) h += '<p class="empty">All tiers are done or locked. Turn off “Hide completed” or “Hide locked” in the settings to see them.</p>';
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
    renderStart();
  }

  // ---------- Area Tasks: one area ----------
  // Opens an area (at a tier): from storage if it is saved, else from the wiki.
  function openArea(name, tier) {
    S.error = '';
    var a = sget('area.' + name);
    // A saved area opens at once. One saved by an older version is read again quietly; if that fails, the saved one stays.
    if (a && Array.isArray(a.tiers) && a.tiers.length) {
      showArea(name, a, tier);
      if (a.version !== QG.AREA_VERSION) refreshArea(true);
      return;
    }
    S.loading = name;
    renderStart();
    QG.loadArea(name).then(function (na) {
      S.loading = false;
      S.input = '';
      sset('area.' + name, na);
      showArea(name, na, tier);
    }, function (e) {
      S.loading = false;
      S.error = loadError(e);
      renderStart();
    });
  }
  function showArea(name, a, tier) {
    S.view = 'area';
    S.area = a;
    S.areaKey = name;
    indexArea(name, a);
    S.aprog = loadAprog(name);
    if (tier && a.tiers.some(function (t) { return t.id === tier; }) && S.aprog.tier !== tier) { S.aprog.tier = tier; sset('aprog.' + name, S.aprog); }
    S.resetArmed = 0;
    sset('last', 'area:' + name);
    renderArea(false);
  }
  function tierNow() {
    var t = S.area.tiers.filter(function (x) { return x.id === S.aprog.tier; })[0];
    return t || S.area.tiers[0];
  }
  function areaDotsHtml() {
    return '<button class="ib" type="button" data-menu="menu" id="menu-btn" aria-label="Area menu" aria-haspopup="true" aria-expanded="false" aria-controls="menu" title="Area menu">' + I.dots + '</button>' +
      '<div class="menu" id="menu" role="menu" hidden>' +
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
  function areaTaskHtml(x, cur) {
    var done = !!S.aprog.tasks[x.id];
    var ext = needText(x) + (x.notes ? '<div class="howto">' + x.notes + '</div>' : '');
    var subs = (x.subs || []).map(function (u) {
      var d = !!S.aprog.tasks[u.id];
      return '<li class="step task' + (d ? ' done' : '') + '" data-task="' + esc(u.id) + '">' +
        rowHtml('acb', u.id, d, u.html, u.notes && u.notes.length ? '<div class="ext"><div class="howto">' + u.notes.join('<br>') + '</div></div>' : '') + '</li>';
    }).join('');
    return '<li class="step task' + (done ? ' done' : '') + (cur ? ' cur' : '') + '" data-task="' + esc(x.id) + '">' +
      rowHtml('acb', x.id, done, '<b>' + esc(x.name) + '</b>' + (x.desc ? ' \u2014 ' + esc(x.desc) : ''), ext ? '<div class="ext">' + ext + '</div>' : '') +
      (subs ? '<ul class="steps subs">' + subs + '</ul>' : '') + '</li>';
  }
  // A part of an area tier that folds open and shut. The app remembers it per tier.
  // A finished list of tasks starts shut; opening it shows the done tasks, so you can untick one.
  function areaSec(id, name, count, body, done) {
    var key = tierNow().id + ':' + id, v = (S.aprog.open || {})[key];
    var open = v === true || v === false ? v : !done;
    return '<section class="sec' + (done ? ' alldone' : '') + '" data-asec="' + id + '"><h2 class="sh"><button class="sech' + (done ? ' done' : '') + '" type="button" data-asec-btn="' + key + '" aria-expanded="' + open + '">' +
      I.chev + '<span class="n">' + name + '</span><span class="c">' + count + '</span></button></h2>' +
      '<div class="secb"' + (open ? '' : ' hidden') + '>' + body + '</div></section>';
  }
  function toggleAreaSec(key) {
    var btn = document.querySelector('[data-asec-btn="' + key + '"]');
    var open = !(btn && btn.getAttribute('aria-expanded') === 'true');
    S.aprog.open = S.aprog.open || {};
    S.aprog.open[key] = open;
    saveAprog();
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var body = btn.parentNode.nextElementSibling;
      if (body) body.hidden = !open;
    }
  }
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
      '<header class="hdr"><button class="ib" type="button" data-act="change" aria-label="All areas" title="All areas">' + I.back + '</button>' +
      '<h1 class="qt" title="' + esc(a.name) + '">' + esc(a.name) + '</h1><div class="hs he">' + cogHtml() + areaDotsHtml() + '</div></header>' +
      '<div class="prog"><progress class="pg" id="pg" value="' + done + '" max="' + Math.max(t.tasks.length, 1) + '" aria-label="Tier progress"></progress>' +
      '<span class="cnt" id="pg-cnt">' + done + ' / ' + plural(t.tasks.length, 'task', 'tasks') + '</span></div>' +
      '<nav class="tabs" role="tablist" aria-label="Tiers">' + a.tiers.map(function (x) {
        return '<button class="tab" type="button" role="tab" data-tier="' + esc(x.id) + '" aria-selected="' + (x === t) + '"><span class="tl-l">' + esc(x.name) + '</span></button>';
      }).join('') + '</nav>' +
      '<main class="scroll' + (S.set.showDone ? ' show-done' : '') + '" id="main" role="tabpanel">' +
      (t.skills.length + t.quests.length + t.other.length + t.items.length || t.ironman ?
        areaSec('needs', 'Needs', low ? low + ' too low' : String(t.skills.length + t.quests.length), areaNeedsHtml(t)) : '') +
      areaSec('tasks', 'Tasks', (cur ? '' : '\u2713 ') + done + ' / ' + t.tasks.length, '<ul class="steps">' + t.tasks.map(function (x) { return areaTaskHtml(x, x === cur); }).join('') + '</ul>', !cur) +
      reward +
      '<p class="foot">Tasks: <a href="' + esc(a.source) + '" target="_blank" rel="noopener">RuneScape Wiki</a>, CC BY-NC-SA 3.0. Loaded ' + esc(dateText(a.fetchedAt)) + '.</p>' +
      '</main>' +
      '<footer class="ftr"><button class="next" type="button" id="next-btn" data-act="anext"' + (cur ? '' : ' disabled') + '>' + I.check +
      '<span>' + (cur ? 'Done, next task' : 'All tasks done') + '</span></button></footer>' +
      '<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>';
    main = byId('main');
    if (main) main.scrollTop = top;
  }
  function tickTask(id, on) {
    setTick(S.aprog.tasks, taskIndex(S.area), id, on);
    var t = tierNow();
    if (on && S.aprog.open && t.tasks.every(function (x) { return S.aprog.tasks[x.id]; })) delete S.aprog.open[t.id + ':tasks'];
    saveAprog();
    renderArea(true);
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
  function areaReset(btn) {
    if (S.resetArmed && Date.now() - S.resetArmed < 4000) {
      S.aprog.tasks = {};
      S.resetArmed = 0;
      saveAprog();
      renderArea(false);
      toast('Progress reset.');
      return;
    }
    S.resetArmed = Date.now();
    btn.querySelector('span').textContent = 'Click again to reset';
  }
  function refreshArea(silent) {
    var name = S.areaKey;
    if (!silent) toast('Reading the wiki\u2026', 0);
    QG.loadArea(name).then(function (na) {
      sset('area.' + name, na);
      indexArea(name, na);
      if (S.view !== 'area' || S.areaKey !== name) return;
      S.area = na;
      saveAmeta();
      renderArea(true);
      if (!silent) toast('Updated from the wiki.');
    }, function (e) { if (!silent) toast('Could not update. ' + loadError(e)); });
  }

  // ---------- export and import ----------
  // Everything you ticked, your settings and your player, as text. Guides and lists are not in it: the app reads them from the wiki.
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
  // A line of the file: "<code> <what it says>", cut short so the file stays easy to read.
  function lineKey(id, label) {
    label = String(label || '').replace(/\s+/g, ' ').trim();
    var room = 100 - String(id).length - 1;
    if (label.length > room) label = label.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, '') + '…';
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
  // The file: every quest and every area task, each true (done) or false, so you can change them by hand and import it again.
  function buildExport() {
    var m = metaAll(), byTitle = {}, progs = {}, quests = {}, areas = {}, titles = [];
    Object.keys(m).forEach(function (k) { byTitle[D.norm(m[k].title)] = k; });
    storageKeys('prog.').forEach(function (k) { progs[k] = 1; });
    allQuests().forEach(function (q) { titles.push(q.t); });
    Object.keys(m).forEach(function (k) { if (progs[k] && titles.every(function (t) { return D.norm(t) !== D.norm(m[k].title); })) titles.push(m[k].title); });
    titles.sort(function (a, b) { return sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0; });
    titles.forEach(function (title) {
      var key = byTitle[D.norm(title)] || title + '/Quick guide', me = m[key];
      var done = (!!me && me.total > 0 && me.done >= me.total) || playerStatus(title) === 2 || markedDone(title);
      var q = sget('quest.' + key), p = progs[key] ? loadProg(key) : null;
      var ticks = p ? Object.keys(ticked(p.steps)).length + Object.keys(ticked(p.items)).length : 0;
      if (!q && !ticks) { quests[title] = done; return; }
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
    var ix = aidxAll();
    QG.AREAS.forEach(function (a) {
      var x = ix[a.name];
      if (!x) return;
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
    return {
      app: 'Quick Guide', format: FORMAT, exportedAt: new Date().toISOString(),
      help: 'Set a quest, task or step to true to mark it done, or to false to undo it, then import this file. ' +
        'Keep the code at the start of a step or task: the app finds it by that code. A task can also be written by its name alone.',
      settings: JSON.parse(JSON.stringify(S.set)), player: S.player || null, quests: quests, areas: areas
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
    var nq = 0, na = 0;
    var st = j.settings;
    if (isMap(st)) {
      BOOL_SETTINGS.forEach(function (k) { if (typeof st[k] === 'boolean') S.set[k] = st[k]; });
      if (st.fontSize != null && isFinite(+st.fontSize)) S.set.fontSize = clampFont(st.fontSize);
      S.set.sort = pick(SORTS, st.sort, S.set.sort);
      S.set.home = pick(HOMES, st.home, S.set.home);
      applySettings();
      saveSettings();
    }
    var pl = j.player;
    if (isMap(pl) && typeof pl.name === 'string' && pl.name && isMap(pl.quests)) {
      var qs = {};
      Object.keys(pl.quests).forEach(function (k) { var v = +pl.quests[k]; if (v === 0 || v === 1 || v === 2) qs[k] = v; });
      S.player = { name: pl.name, source: pl.source || 'RuneMetrics', at: pl.at || new Date().toISOString(), quests: qs,
        levels: isMap(pl.levels) ? pl.levels : {}, locked: isMap(pl.locked) ? pl.locked : {}, done: +pl.done || 0, started: +pl.started || 0 };
      sset('player', S.player);
    }
    if (+j.format >= 2) { var r2 = importV2(j); nq = r2.quests; na = r2.areas; }
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
    return { quests: nq, areas: na };
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
    return { quests: nq, areas: na };
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
        'Every quest and every area task, as a file: <b>true</b> is done, <b>false</b> is not. Download it, change what you like in any text editor, then import it again.' :
        'Choose a file you exported, or paste its text. It replaces your ticks for the quests and areas in it.') + '</p>' +
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
    function fallback() {
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      toast(ok ? 'Copied.' : 'Select the text and copy it.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast('Copied.'); }, fallback);
    else fallback();
  }
  function runImport() {
    var ta = byId('bk-text'), err = byId('bk-err');
    if (!ta || !err) return;
    var r = importState(ta.value);
    if (r.error) { err.textContent = r.error; err.hidden = false; return; }
    closeBackup();
    S.error = '';
    S.input = '';
    renderStart();
    var parts = [];
    if (r.quests) parts.push(plural(r.quests, 'quest', 'quests'));
    if (r.areas) parts.push(plural(r.areas, 'area', 'areas'));
    toast(parts.length ? 'Imported ' + parts.join(' and ') + '.' : 'Imported.');
  }

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
    sc.k = k; sc.names = {}; sc.prev = null; sc.pin = { k: k, sig: sc.last ? sc.last.sig : null, y: sc.last ? sc.last.top : null }; sc.sum = null;
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
  function nameDiffer(sc, sig, k) {
    var R = window.QuickGuideReader, a = sc.names[k] ? R.textDiffer(sig, sc.names[k]) : 1, b = sc.base[k] ? R.textDiffer(sig, sc.base[k]) : 1;
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
    // A name the app came with is not learnt again (that one is right, whatever the arrows said).
    for (var b in sc.base) if (R.textDiffer(sig, sc.base[b]) < NAME_SAME) return;
    if (sc.names[k] && !(again && R.textDiffer(sig, sc.names[k]) >= NAME_SAME)) return;
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
      else if (act === 'showdone') toggleShowDone();
      else if (act === 'hidedone') toggleHideDone();
      else if (act === 'hidemini') toggleSetting('hideMini', 'hidemini');
      else if (act === 'hidelocked') toggleHideLocked();
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
  if (S.player && Date.now() - (Date.parse(S.player.at) || 0) > PLAYER_MAX_AGE) lookUpPlayer(S.player.name, true);

})();
