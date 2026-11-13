/*!
 * Quick Guide - app.js
 * A tick list for RuneScape Wiki quest quick guides, made for the Alt1 browser.
 */
(function () {
  'use strict';

  var QG = window.QuickGuide;
  var app = document.getElementById('app');
  var PREFIX = 'qg1.';
  var MAX_RECENT = 8;
  var FONT_MIN = 12, FONT_MAX = 20, FONT_DEFAULT = 14;
  var TABS = [
    ['overview', 'Overview'], ['skills', 'Skills'], ['items', 'Items'],
    ['enemies', 'Enemies'], ['steps', 'Steps'], ['rewards', 'Rewards']
  ];

  // ---------- storage (falls back to memory if the browser blocks it) ----------
  var memory = {};
  function sget(k) {
    try {
      var v = window.localStorage.getItem(PREFIX + k);
      if (v != null) return JSON.parse(v);
    } catch (e) { /* blocked or broken */ }
    return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null;
  }
  function sset(k, v) {
    memory[k] = v;
    try { window.localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* full or blocked */ }
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
    chev: svg('<path d="m9 18 6-6-6-6"/>', 'chev'),
    locate: svg('<path d="M2 12h3"/><path d="M19 12h3"/><path d="M12 2v3"/><path d="M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    image: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
    table: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    refresh: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    ext: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    loader: svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'spin'),
    music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    map: svg('<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>'),
    scroll: svg('<path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>'),
    rows: svg('<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="18" height="7" x="3" y="14" rx="1"/>'),
    type: svg('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
    minus: svg('<path d="M5 12h14"/>'),
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
  var saved = sget('settings') || {};
  var S = {
    view: 'start',
    q: null,          // the quest JSON
    key: '',          // the wiki page it came from
    prog: null,       // { steps: {id: 1}, items: {id: 1}, tab, open: {partId: bool} }
    idx: null,        // quick lookups for steps
    set: { hideDone: !!saved.hideDone, compact: !!saved.compact, fontSize: clampFont(saved.fontSize || FONT_DEFAULT) },
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
    app.classList.toggle('compact', S.set.compact);
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
  function recentList() { var r = sget('recent'); return Array.isArray(r) ? r : []; }
  function remember(key, title, doneCount, total) {
    var old = {};
    var list = recentList().filter(function (x) { if (x.key === key) { old = x; return false; } return true; });
    list.unshift({
      key: key,
      title: title || old.title || key,
      done: doneCount != null ? doneCount : (old.done || 0),
      total: total != null ? total : (old.total || 0)
    });
    list.slice(MAX_RECENT).forEach(function (x) { sdel('quest.' + x.key); });
    sset('recent', list.slice(0, MAX_RECENT));
  }
  function storeQuest(q) {
    sset('quest.' + q.page, q);
    var ids = topSteps(q), p = sget('prog.' + q.page) || {}, steps = p.steps || {};
    remember(q.page, q.title, ids.filter(function (id) { return steps[id]; }).length, ids.length);
  }
  function validTab(t) { return TABS.some(function (x) { return x[0] === t; }) ? t : 'overview'; }
  function loadProg(key) {
    var p = sget('prog.' + key) || {};
    return { steps: p.steps || {}, items: p.items || {}, tab: validTab(p.tab), open: p.open || {} };
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
    return !!cur && S.idx.secOf[cur] === sec.id;
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
  // Returns the new next step. Closes a part when it is finished, opens the next one.
  function changeStep(id, val) {
    var before = current();
    setStep(id, val);
    var after = current();
    var sb = before && S.idx.secOf[before], sa = after && S.idx.secOf[after];
    if (sb !== sa) {
      if (sb) { var st = secStat(S.idx.secs[sb]); if (st.done === st.total) S.prog.open[sb] = false; }
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
  function jumpTo(id, animate) {
    var main = byId('main');
    if (!main) return;
    if (!id) {
      var c = byId('complete');
      if (c && !c.hidden) c.scrollIntoView({ block: 'start', behavior: animate ? smooth() : 'auto' });
      return;
    }
    var sid = S.idx.secOf[id];
    if (sid && !isOpen(S.idx.secs[sid], current())) { S.prog.open[sid] = true; refresh(); }
    var li = main.querySelector('li[data-step="' + id + '"]');
    if (!li) return;
    // For the first step of a part, show the part's header and "Bring" box too (if they fit).
    var target = li, sec = S.idx.secs[sid];
    var first = sec && sec.blocks.filter(function (b) { return b.type === 'step'; })[0];
    var secEl = main.querySelector('[data-sec="' + sid + '"]');
    if (first && first.id === id && secEl &&
        li.getBoundingClientRect().top - secEl.getBoundingClientRect().top < main.clientHeight * 0.6) {
      target = secEl;
    }
    target.scrollIntoView({ block: 'start', behavior: animate ? smooth() : 'auto' });
  }

  // ---------- loading ----------
  function inputError(code) {
    if (code === 'empty') return 'Paste a link first.';
    if (code === 'osrs') return 'That is the Old School wiki. This app reads the RuneScape 3 wiki.';
    if (code === 'not-wiki') return 'That is not a RuneScape Wiki link.';
    if (code === 'no-page') return 'That link does not point to a wiki page.';
    return 'That link does not look right.';
  }
  function loadError(e) {
    var c = e && e.code;
    if (c === 'missingtitle') return 'The wiki has no page with that name. Check the link.';
    if (c === 'invalidtitle') return 'That is not a valid wiki page name.';
    if (c === 'timeout') return 'The wiki took too long to answer. Try again.';
    if (c === 'http' || c === 'format') return (e.message || 'The wiki had a problem.') + ' Try again in a moment.';
    if (e instanceof TypeError) return 'Could not reach the wiki. Check your internet, then try again.';
    return (e && e.message) || 'Something went wrong. Try again.';
  }
  function startLoad(value) {
    var t = QG.titleFromInput(value);
    S.input = value;
    if (t.error) { S.error = inputError(t.error); renderStart(); return; }
    S.loading = true;
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

  // ---------- menu (actions and settings) ----------
  function settingsHtml() {
    return '<p class="mh">Settings</p>' +
      '<button class="mi" type="button" role="menuitemcheckbox" aria-checked="' + S.set.compact + '" data-act="compact">' +
      I.rows + '<span class="ml">Compact layout</span><span class="tg" aria-hidden="true"></span></button>' +
      '<div class="mi mrow" role="group" aria-label="Text size">' + I.type + '<span class="ml">Text size</span>' +
      '<button class="ib xs" type="button" data-act="font-down" aria-label="Smaller text" title="Smaller text"' + (S.set.fontSize <= FONT_MIN ? ' disabled' : '') + '>' + I.minus + '</button>' +
      '<span class="fsv" id="fsv" aria-live="polite">' + S.set.fontSize + '</span>' +
      '<button class="ib xs" type="button" data-act="font-up" aria-label="Bigger text" title="Bigger text"' + (S.set.fontSize >= FONT_MAX ? ' disabled' : '') + '>' + I.plus + '</button>' +
      '</div>';
  }
  function menuHtml(withQuest) {
    var q = S.q;
    return '<button class="ib" type="button" id="menu-btn" aria-label="Menu and settings" aria-haspopup="true" aria-expanded="false" aria-controls="menu" title="Menu and settings">' + I.dots + '</button>' +
      '<div class="menu" id="menu" role="menu" hidden>' +
      (withQuest ?
        '<button class="mi" type="button" role="menuitem" data-act="change">' + I.link + 'Change quest</button>' +
        '<button class="mi" type="button" role="menuitem" data-act="refresh">' + I.refresh + 'Refresh from wiki</button>' +
        '<a class="mi" role="menuitem" href="' + esc(q.source) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on wiki</a>' +
        '<hr>' : '') +
      settingsHtml() +
      (withQuest ? '<hr><button class="mi danger" type="button" role="menuitem" data-act="reset">' + I.reset + '<span>Reset progress</span></button>' : '') +
      '</div>';
  }

  // ---------- start screen ----------
  function alt1Html() {
    if (window.alt1 || !/^https?:$/.test(location.protocol)) return '';
    var cfg;
    try { cfg = new URL('appconfig.json', location.href).href; } catch (e) { return ''; }
    return '<p class="foot">Using Alt1? <a href="alt1://addapp/' + esc(cfg) + '">Add this app to Alt1</a>.</p>';
  }
  function recentHtml(r) {
    return '<li><button class="rec" type="button" data-open="' + esc(r.key) + '">' +
      '<span class="r1"><b>' + esc(r.title) + '</b><span class="cnt">' + (r.done || 0) + ' / ' + (r.total || 0) + ' steps</span></span>' +
      '<progress class="pg" value="' + (r.done || 0) + '" max="' + Math.max(r.total || 0, 1) + '" aria-hidden="true"></progress>' +
      '</button></li>';
  }
  function renderStart() {
    S.view = 'start';
    dropMaps();
    var list = recentList();
    app.innerHTML =
      '<header class="hdr"><h1 class="qt">Quick Guide</h1>' + menuHtml(false) + '</header>' +
      '<main class="scroll" id="main">' +
      '<form class="start" id="load-form" novalidate>' +
      '<label class="fl" for="quest-link">Quest guide link</label>' +
      '<div class="row-f"><input class="inp' + (S.error ? ' bad' : '') + '" id="quest-link" name="link" type="text" inputmode="url"' +
      ' autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://runescape.wiki/w/\u2026" value="' + esc(S.input) + '"' +
      (S.error ? ' aria-invalid="true" aria-describedby="load-err"' : '') + (S.loading ? ' disabled' : '') + '>' +
      '<button class="btn" type="submit"' + (S.loading ? ' disabled' : '') + '>Load</button></div>' +
      (S.error ? '<p class="err" id="load-err" role="alert">' + esc(S.error) + '</p>' : '') +
      '<p class="hint">Paste a quest link from the RuneScape Wiki. The quest page or its Quick guide both work, or type a quest name. Your ticks are saved on this computer.</p>' +
      '</form>' +
      (S.loading ? '<div class="state" role="status">' + I.loader + '<p>Reading the wiki\u2026</p></div>' : '') +
      (list.length ? '<h2 class="bh">Recent</h2><ul class="recent">' + list.map(recentHtml).join('') + '</ul>' : '') +
      alt1Html() +
      '<p class="foot">Guide text comes from the <a href="https://runescape.wiki/" target="_blank" rel="noopener">RuneScape Wiki</a> (CC BY-NC-SA 3.0).</p>' +
      '</main>';
  }

  // ---------- shared pieces ----------
  function note(html) { return '<div class="note">' + I.info + '<span>' + html + '</span></div>'; }
  function warn(html) { return '<div class="note warn">' + I.alert + '<span>' + html + '</span></div>'; }
  function acc(icon, label, meta, body, open, attrs) {
    return '<details class="acc"' + (open ? ' open' : '') + (attrs || '') + '><summary>' + I.chev + (icon || '') +
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
    return acc(I.map, m.caption ? 'Map: ' + m.caption : 'Map', '',
      '<div class="map" data-map="' + key + '" role="region" aria-label="Map"></div>' +
      '<p class="cap">' + (m.caption ? esc(m.caption) + ' \u00b7 ' : '') + link + '</p>');
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
    var open = !next || !done(next.id);
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
    return h;
  }

  // ---------- other tabs ----------
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
  function liHtml(h) { return '<li>' + h + '</li>'; }
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
  function overviewHtml() {
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
      h += '<h2 class="bh">Quests</h2><div class="blk">' + acc('', 'Quest tree', plural(o.questReqs.length, 'entry', 'entries'),
        '<ul class="tree">' + o.questReqs.map(function (e) {
          return '<li style="padding-left:' + Math.max(0, e.depth - 1) * 16 + 'px">' + esc(e.text) + '</li>';
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
      h += '<h2 class="bh">Skill levels</h2><ul class="skills">' + o.skillReqs.map(function (s) {
        return '<li class="chip"><b>' + s.level + '</b>' + esc(s.skill) + (s.note ? ' <span class="x">' + esc(s.note) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (o.otherReqs && o.otherReqs.length) {
      h += '<h2 class="bh">Also needed</h2>' + o.otherReqs.map(function (r) { return '<p class="para">' + r + '</p>'; }).join('');
    }
    return h || '<p class="empty">No skill requirements.</p>';
  }
  function enemiesHtml() {
    var e = S.q.overview.enemies || [];
    if (!e.length) return '<p class="empty">No enemies to fight.</p>';
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
        return '<p class="why">' + esc(g.label) + ':</p><ul class="plain">' + g.items.map(liHtml).join('') + '</ul>';
      }).join(''));
    }
    if (more) h += '<div class="blk" style="margin-top:14px">' + more + '</div>';
    return h || '<p class="empty">No rewards listed.</p>';
  }

  // ---------- quest screen ----------
  function tabHtml(t) {
    var on = S.prog.tab === t[0];
    return '<button class="tab" type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + on + '" title="' + t[1] + '">' +
      TAB_ICON[t[0]] + '<span class="tl-l">' + t[1] + '</span></button>';
  }
  function bodyHtml(tab) {
    if (tab === 'skills') return skillsHtml();
    if (tab === 'items') return itemsHtml();
    if (tab === 'enemies') return enemiesHtml();
    if (tab === 'steps') return stepsHtml();
    if (tab === 'rewards') return rewardsHtml();
    return overviewHtml();
  }
  function renderQuest() {
    var q = S.q, tab = S.prog.tab;
    dropMaps();
    app.innerHTML =
      '<header class="hdr"><h1 class="qt" title="' + esc(q.title) + '">' + esc(q.title) + '</h1>' + menuHtml(true) + '</header>' +
      '<div class="prog"><progress class="pg" id="pg" value="0" max="1" aria-label="Quest progress"></progress><span class="cnt" id="pg-cnt"></span></div>' +
      '<nav class="tabs" role="tablist" aria-label="Guide parts">' + TABS.map(tabHtml).join('') + '</nav>' +
      '<main class="scroll' + (tab === 'steps' && S.set.hideDone ? ' hide-done' : '') + '" id="main" role="tabpanel">' + bodyHtml(tab) + '</main>' +
      (tab === 'steps' ?
        '<footer class="ftr">' +
        '<button class="ib lg" type="button" data-act="jump" aria-label="Jump to next step" title="Jump to next step">' + I.locate + '</button>' +
        '<button class="next" type="button" id="next-btn" data-act="next">' + I.check + '<span>Done, next step</span></button>' +
        '<button class="ib lg' + (S.set.hideDone ? ' on' : '') + '" type="button" data-act="hide" aria-label="Hide done steps" aria-pressed="' +
        (S.set.hideDone ? 'true' : 'false') + '" title="Hide done steps">' + I.eyeOff + '</button>' +
        '</footer>' : '') +
      '<div class="toast' + (tab === 'steps' ? '' : ' low') + '" id="toast" role="status" aria-live="polite" hidden></div>';
    var main = byId('main');
    if (S.scroll[tab] != null) main.scrollTop = S.scroll[tab];
    main.addEventListener('scroll', function () { S.scroll[tab] = main.scrollTop; }, { passive: true });
    refresh();
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
    if (S.prog.tab === 'items') {
      [['req', S.q.requiredItems.items], ['rec', S.q.recommendedItems.items]].forEach(function (p) {
        var c = main.querySelector('[data-count="' + p[0] + '"]');
        if (c) c.textContent = p[1].filter(function (it) { return S.prog.items[it.id]; }).length + ' / ' + p[1].length;
      });
    }
    saveProg();
    remember(S.key, S.q.title, t.done, t.total);
  }

  // ---------- maps (Leaflet with the wiki's map tiles) ----------
  var DOT = { radius: 7, color: '#1b1510', weight: 2, opacity: 1, fillColor: '#f2c45a', fillOpacity: 1 };
  function dropMaps() {
    S.live.forEach(function (map) { try { map.remove(); } catch (e) { /* already gone */ } });
    S.live = [];
    S.maps = [];
  }
  function resizeMaps() { S.live.forEach(function (map) { map.invalidateSize(); }); }
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
    setTimeout(function () { map.invalidateSize(); }, 60);
  }

  // ---------- small UI bits ----------
  function toast(msg, ms) {
    var el = byId('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(S.toastTimer);
    if (ms !== 0) S.toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }
  function disarmReset() {
    S.resetArmed = 0;
    var s = document.querySelector('[data-act="reset"] span');
    if (s) s.textContent = 'Reset progress';
  }
  function toggleMenu() {
    var m = byId('menu'), b = byId('menu-btn');
    if (!m) return;
    var show = m.hidden;
    m.hidden = !show;
    b.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (!show) disarmReset();
  }
  function closeMenu() {
    var m = byId('menu'), b = byId('menu-btn');
    if (m && !m.hidden) { m.hidden = true; b.setAttribute('aria-expanded', 'false'); disarmReset(); }
  }
  function resetClick(btn) {
    if (S.resetArmed && Date.now() - S.resetArmed < 4000) {
      S.prog.steps = {};
      S.prog.items = {};
      S.prog.open = {};
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
  function setFont(delta) {
    S.set.fontSize = clampFont(S.set.fontSize + delta);
    saveSettings();
    applySettings();
    var v = byId('fsv');
    if (v) v.textContent = S.set.fontSize;
    var down = document.querySelector('[data-act="font-down"]'), up = document.querySelector('[data-act="font-up"]');
    if (down) down.disabled = S.set.fontSize <= FONT_MIN;
    if (up) up.disabled = S.set.fontSize >= FONT_MAX;
  }
  function toggleCompact(btn) {
    S.set.compact = !S.set.compact;
    saveSettings();
    applySettings();
    resizeMaps();
    btn.setAttribute('aria-checked', S.set.compact ? 'true' : 'false');
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
  }
  function toggleHide() {
    S.set.hideDone = !S.set.hideDone;
    saveSettings();
    var main = byId('main'), b = document.querySelector('[data-act="hide"]');
    if (main) main.classList.toggle('hide-done', S.set.hideDone);
    if (b) { b.classList.toggle('on', S.set.hideDone); b.setAttribute('aria-pressed', S.set.hideDone ? 'true' : 'false'); }
  }

  // ---------- events ----------
  app.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'load-form') return;
    ev.preventDefault();
    startLoad(ev.target.elements.link.value);
  });
  app.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.hasAttribute('data-scb')) { changeStep(t.getAttribute('data-scb'), t.checked); return; }
    if (t.hasAttribute('data-icb')) {
      var id = t.getAttribute('data-icb');
      if (t.checked) S.prog.items[id] = 1; else delete S.prog.items[id];
      refresh();
    }
  });
  app.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-open], [data-tab], [data-act], [data-sec-btn], #menu-btn');
    if (t) {
      if (t.id === 'menu-btn') { toggleMenu(); return; }
      if (t.hasAttribute('data-open')) { S.error = ''; openQuest(t.getAttribute('data-open')); return; }
      if (t.hasAttribute('data-tab')) { switchTab(t.getAttribute('data-tab')); return; }
      if (t.hasAttribute('data-sec-btn')) { toggleSection(t.getAttribute('data-sec-btn')); return; }
      var act = t.getAttribute('data-act');
      if (act === 'next') nextStep();
      else if (act === 'jump') jumpTo(current(), true);
      else if (act === 'hide') toggleHide();
      else if (act === 'change') { closeMenu(); S.error = ''; renderStart(); }
      else if (act === 'refresh') { closeMenu(); refreshQuest(false); }
      else if (act === 'wiki') closeMenu();
      else if (act === 'reset') resetClick(t);
      else if (act === 'compact') toggleCompact(t);
      else if (act === 'font-down') setFont(-1);
      else if (act === 'font-up') setFont(1);
      return;
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
    if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    var el = d.querySelector(':scope > .body > .map');
    if (el && !el.getAttribute('data-ready')) initMap(el);
  }, true);
  document.addEventListener('click', function (ev) {
    var m = byId('menu');
    if (m && !m.hidden && !ev.target.closest('#menu, #menu-btn')) closeMenu();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeMenu(); });

  // ---------- start ----------
  applySettings();
  if (window.alt1 && typeof window.alt1.identifyAppUrl === 'function') {
    try { window.alt1.identifyAppUrl('./appconfig.json'); } catch (e) { /* not important */ }
  }
  var last = sget('last');
  if (last && sget('quest.' + last)) openQuest(last); else renderStart();
})();
