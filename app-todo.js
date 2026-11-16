/*!
 * Quick Guide - app-todo.js
 * My list: your own lists of goals. A goal is one flat row: a tick box, what it says, and its menu. Skill levels,
 * quests and tiers tick themselves; an area task shares its tick with its area; a goal can come back every day or
 * every week. Quests, tiers, area tasks and levels you miss go on a list from their ⋯ menu (or "+ goal").
 */
(function (A) {
  'use strict';
  if (!A) return;
  var app = A.app, arr = A.arr, byId = A.byId, closeMenus = A.closeMenus, D = A.D, esc = A.esc, I = A.I,
    markedDone = A.markedDone, metaAll = A.metaAll, note = A.note, playerLevel = A.playerLevel,
    playerStatus = A.playerStatus, plural = A.plural, QG = A.QG, S = A.S, sget = A.sget, sset = A.sset, toast = A.toast;

  var MAX_LISTS = 30, MAX_GOALS = 300, NAME_MAX = 30, TEXT_MAX = 80, NOTE_MAX = 120;
  var DAY = 24 * 3600 * 1000;
  var FULL_GOALS = 'You have 300 goals. Remove some first.', FULL_LISTS = 'You have 30 lists. Delete one first.';
  // The kinds of goal. A skill goal ticks itself once your character's level is known; a quest and a tier tick
  // themselves; an area task is one tick with its area; any other goal you tick.
  var KINDS = { skill: 1, task: 1, tier: 1, quest: 1, other: 1 };
  // Goals that stand for a quest, a task or a tier: only their list and note can change.
  var FIXED = { quest: 1, task: 1, tier: 1 };
  var SUGGEST = ['Today', 'This week', 'Skilling goals', 'Gathering', 'Unlocks'];
  var SKILLS = ['Attack', 'Defence', 'Strength', 'Constitution', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting',
    'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Slayer',
    'Farming', 'Runecrafting', 'Hunter', 'Construction', 'Summoning', 'Dungeoneering', 'Divination', 'Invention',
    'Archaeology', 'Necromancy'];
  // Short names people type for a skill.
  var SHORT = { att: 'attack', def: 'defence', defense: 'defence', str: 'strength', hp: 'constitution', hitpoints: 'constitution',
    range: 'ranged', pray: 'prayer', mage: 'magic', cook: 'cooking', wc: 'woodcutting', fletch: 'fletching', fish: 'fishing',
    fm: 'firemaking', craft: 'crafting', smith: 'smithing', mine: 'mining', herb: 'herblore', agi: 'agility', agil: 'agility',
    thieve: 'thieving', thiev: 'thieving', slay: 'slayer', farm: 'farming', rc: 'runecrafting', runecraft: 'runecrafting',
    hunt: 'hunter', con: 'construction', summ: 'summoning', dg: 'dungeoneering', dung: 'dungeoneering', div: 'divination',
    inv: 'invention', arch: 'archaeology', necro: 'necromancy' };
  var REPEAT_SEG = [['', 'Once'], ['day', 'Every day'], ['week', 'Every week']];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---------- helpers ----------
  function isMap(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function copy(to, from) { Object.keys(from).forEach(function (k) { to[k] = from[k]; }); return to; }
  // A text from saved data or a form: one line, at most max letters.
  function line(v, max) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max || TEXT_MAX) : ''; }
  function cap1(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  // 1234 -> "1,234"
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // "500", "1,000", "2k" -> a whole number, or -1 when it is not one.
  function amount(s) {
    var m = /^(\d[\d,]*(?:\.\d+)?)([km]?)$/i.exec(String(s == null ? '' : s).replace(/\s+/g, ''));
    return m ? Math.round(parseFloat(m[1].replace(/,/g, '')) * (/k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1)) : -1;
  }
  // "thieving", "Thieving" or "thiev" -> "thieving"; not a skill -> "".
  function skillKey(w) {
    w = String(w || '').toLowerCase();
    if (SHORT[w]) return SHORT[w];
    return SKILLS.some(function (s) { return s.toLowerCase() === w; }) ? w : '';
  }
  function skillName(k) { return SKILLS.filter(function (s) { return s.toLowerCase() === k; })[0] || cap1(k); }
  function areaOf(name) { return QG.AREAS.filter(function (a) { return a.name === name; })[0] || null; }
  // "Ardougne Hard" -> { area: 'Ardougne', tier: 'hard', tname: 'Hard' }, or null.
  function areaTier(s) {
    s = String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    var hit = null;
    QG.AREAS.forEach(function (a) {
      a.tiers.forEach(function (t) { if (s === (a.name + ' ' + t).toLowerCase()) hit = { area: a.name, tier: t.toLowerCase(), tname: t }; });
    });
    return hit;
  }
  var seq = 0;
  function newId(p) { seq += 1; return p + Date.now().toString(36) + seq.toString(36); }

  // ---------- the saved lists ----------
  // One goal from saved data, a file or a form, with only what its kind has. Null when it is not a goal.
  // Goals of an older kind (an item with a count, an unlock) become plain goals that say the same.
  function cleanGoal(x) {
    if (isMap(x) && x.kind === 'item') x = copy(copy({}, x), { kind: 'other', title: (+x.want > 0 ? fmt(Math.round(+x.want)) + ' ' : '') + line(x.title) });
    if (isMap(x) && x.kind === 'unlock') x = copy(copy({}, x), { kind: 'other', title: 'Unlock ' + line(x.title) });
    if (!isMap(x) || !KINDS[x.kind]) return null;
    var g = { id: line(x.id, 40) || newId('g'), kind: x.kind }, title = line(x.title);
    if (x.kind === 'skill') {
      g.skill = skillKey(x.skill);
      g.level = Math.round(+x.level);
      if (!g.skill || !(g.level >= 1 && g.level <= 120)) return null;
    } else if (x.kind === 'task' || x.kind === 'tier') {
      var a = areaOf(x.area), tier = line(x.tier, 20).toLowerCase();
      if (!a || !tier) return null;
      g.area = a.name;
      g.tier = tier;
      if (x.kind === 'task') {
        g.task = line(x.task == null ? '' : String(x.task), 20);
        if (!g.task) return null;
        g.tname = line(x.tname, 20) || cap1(tier);
        g.title = title || 'Task ' + g.task;
      } else g.title = title || a.name + ' ' + cap1(tier);
    } else {
      if (!title) return null;
      g.title = title;
    }
    var nt = line(x.note, NOTE_MAX);
    if (nt) g.note = nt;
    if (g.kind === 'other' && (x.repeat === 'day' || x.repeat === 'week')) g.repeat = x.repeat;
    ['at', 'done', 'upd'].forEach(function (k) { if (+x[k] > 0) g[k] = +x[k]; });
    if (!g.at) g.at = Date.now();
    return g;
  }
  // The lists, from what was saved: anything broken is left out, names are unique, and the limits hold.
  function cleanTodo(t) {
    var out = { v: 1, last: '', lists: [] }, names = {}, ids = {}, n = 0;
    t = isMap(t) ? t : {};
    (Array.isArray(t.lists) ? t.lists : []).forEach(function (l) {
      var name = isMap(l) ? line(l.name, NAME_MAX) : '';
      if (!name || names[name.toLowerCase()] || out.lists.length >= MAX_LISTS) return;
      names[name.toLowerCase()] = 1;
      var id = line(l.id, 40);
      if (!id || ids[id]) id = newId('l');
      ids[id] = 1;
      var items = [];
      (Array.isArray(l.items) ? l.items : []).forEach(function (x) {
        var g = n < MAX_GOALS ? cleanGoal(x) : null;
        if (!g) return;
        if (ids[g.id]) g.id = newId('g');
        ids[g.id] = 1;
        items.push(g);
        n++;
      });
      out.lists.push({ id: id, name: name, items: items });
    });
    if (out.lists.some(function (l) { return l.id === t.last; })) out.last = t.last;
    return out;
  }
  function todo() {
    if (!S.todo) { S.todo = cleanTodo(sget('todo')); resetDue(); }
    return S.todo;
  }
  function saveTodo() { S.todoIdx = null; sset('todo', S.todo); }
  function listById(id) { return todo().lists.filter(function (l) { return l.id === id; })[0] || null; }
  // A goal and the list it is in: { g, l }.
  function goalById(id) {
    var hit = null;
    todo().lists.forEach(function (l) { l.items.forEach(function (g) { if (g.id === id) hit = { g: g, l: l }; }); });
    return hit;
  }
  function goalCount() { return todo().lists.reduce(function (n, l) { return n + l.items.length; }, 0); }
  // The list the add box shows, and the one the Add to list box picks: the one you used last, else the first.
  function pickId() {
    var t = todo();
    return listById(t.last) ? t.last : t.lists.length ? t.lists[0].id : '';
  }
  function target() { return listById(pickId()) || makeList('My list'); }
  function makeList(name) {
    var l = { id: newId('l'), name: name, items: [] };
    todo().lists.push(l);
    return l;
  }
  function addGoal(g, l) {
    var c = cleanGoal(copy({ id: newId('g'), at: Date.now() }, g));
    if (!c) return null;
    l.items.push(c);
    todo().last = l.id;
    return c;
  }
  function moveTo(g, from, to) {
    from.items.splice(from.items.indexOf(g), 1);
    to.items.push(g);
  }
  // A list name you may use: not empty, not taken (in any case). Returns the error to show, or ''.
  function nameError(name, except) {
    if (!name) return 'Type a name first.';
    var same = todo().lists.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase() && x.id !== except; })[0];
    return same ? 'You already have a list called \u201c' + same.name + '\u201d.' : '';
  }
  function snapshot() { return JSON.stringify(todo()); }
  // Undo: the lists as they were before a change.
  function undoer(snap) {
    return function () {
      S.todo = cleanTodo(JSON.parse(snap));
      saveTodo();
      refreshScreen();
    };
  }

  // ---------- goals that come back: the game's daily reset (00:00 UTC) and weekly reset (Wednesday 00:00 UTC) ----------
  function lastReset(rep, now) {
    var d = new Date(now), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return rep === 'week' ? day - ((d.getUTCDay() + 4) % 7) * DAY : day;
  }
  function nextReset(rep, now) { return lastReset(rep, now) + (rep === 'week' ? 7 : 1) * DAY; }
  // "back tomorrow, 01:00", in your own time.
  function backText(rep) {
    var now = new Date(), at = new Date(nextReset(rep, now.getTime()));
    var days = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
    return 'back ' + (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : DAYS[at.getDay()]) + ', ' + pad(at.getHours()) + ':' + pad(at.getMinutes());
  }
  // Unticks goals that come back once their reset has passed. True when one changed.
  function resetDue() {
    var t = S.todo || todo(), now = Date.now(), changed = false;
    t.lists.forEach(function (l) {
      l.items.forEach(function (g) {
        if (!g.repeat || !g.done || (g.upd || g.done) >= lastReset(g.repeat, now)) return;
        delete g.done;
        delete g.upd;
        changed = true;
      });
    });
    if (changed) saveTodo();
    return changed;
  }
  function startClock() {
    setInterval(function () {
      if (!resetDue()) return;
      if (S.view === 'start' && S.set.home === 'todo') drawTodo(); else updateCount();
    }, 60000);
  }

  // ---------- how a goal stands ----------
  // What a render needs from storage, read once: an area's ticks, a tier's tasks, the opened quests.
  function ctx() {
    var ticks = {}, ix = null, meta = null;
    return {
      tasks: function (area) { if (!ticks[area]) ticks[area] = A.loadAprog(area).tasks; return ticks[area]; },
      tier: function (area, id) {
        ix = ix || A.aidxAll();
        return ((ix[area] && ix[area].tiers) || []).filter(function (t) { return t.id === id; })[0] || null;
      },
      meta: function () {
        if (!meta) { meta = {}; var m = metaAll(); Object.keys(m).forEach(function (k) { meta[D.norm(m[k].title)] = m[k]; }); }
        return meta;
      }
    };
  }
  // A goal: done or not, and whether it ticks itself (then why, for its tick box's tooltip).
  function goalState(g, c) {
    var s = { done: false, auto: false, why: '' };
    if (g.kind === 'skill') {
      var lv = playerLevel(g.skill);
      if (lv == null) s.done = !!g.done;
      else {
        s.auto = true;
        s.done = lv >= g.level;
        s.why = 'This ticks itself: ' + S.player.name + ' has ' + lv + ' ' + skillName(g.skill);
      }
    } else if (g.kind === 'task') {
      s.done = !!c.tasks(g.area)[g.task];
    } else if (g.kind === 'tier') {
      var t = c.tier(g.area, g.tier), ticks = c.tasks(g.area);
      s.auto = true;
      s.done = !!t && t.tasks.length > 0 && t.tasks.every(function (x) { return ticks[x.id]; });
      s.why = 'This ticks itself when all its tasks are done';
    } else if (g.kind === 'quest') {
      var m = c.meta()[D.norm(g.title)];
      s.auto = true;
      s.done = (!!m && m.total > 0 && m.done >= m.total) || playerStatus(g.title) === 2 || markedDone(g.title);
      s.why = 'This ticks itself when the quest is done';
    } else s.done = !!g.done;
    return s;
  }
  // Goals that tick themselves get the time they were first seen done, so done goals sort the same way for every kind.
  function stamp(g, s) {
    if (!s.auto && g.kind !== 'task') return false;
    if (s.done && !g.done) { g.done = Date.now(); return true; }
    if (!s.done && g.done) { delete g.done; return true; }
    return false;
  }
  function goalTitle(g) { return g.kind === 'skill' ? g.level + ' ' + skillName(g.skill) : g.title; }
  // A list's goals as they are shown: open ones in your order, then the done ones in the order they were done.
  // A goal that comes back keeps its place.
  function order(l, c) {
    var rows = l.items.map(function (g) { var s = goalState(g, c); return { g: g, s: s, sunk: s.done && !g.repeat }; });
    return rows.filter(function (r) { return !r.sunk; }).concat(rows.filter(function (r) { return r.sunk; })
      .sort(function (a, b) { return (a.g.done || 0) - (b.g.done || 0); }));
  }
  function openCount() {
    var c = ctx();
    return todo().lists.reduce(function (n, l) { return n + l.items.filter(function (g) { return !goalState(g, c).done; }).length; }, 0);
  }

  // ---------- the My list tab ----------
  // One goal: its tick box, what it says (with "every day" or when it is back, and its note), and its menu.
  function goalHtml(g, s) {
    var title = goalTitle(g), tid = esc('gt-' + g.id);
    return '<li class="goal' + (s.done ? ' done' : '') + (g.repeat ? ' rep' : '') + (s.auto ? ' auto' : '') + '" data-goal="' + esc(g.id) + '"><div class="row">' +
      '<input class="cb" type="checkbox" data-gcb="' + esc(g.id) + '" aria-labelledby="' + tid + '"' + (s.done ? ' checked' : '') +
      (s.auto ? ' disabled title="' + esc(s.why) + '"' : '') + '>' +
      '<div class="rb"><span class="t" id="' + tid + '">' + esc(title) + '</span>' +
      (g.repeat ? '<span class="rp">' + I.refresh + (s.done ? backText(g.repeat) : 'every ' + g.repeat) + '</span>' : '') +
      (g.note ? '<span class="gn">' + esc(g.note) + '</span>' : '') + '</div>' +
      '<button class="ib xs rowm" type="button" data-gmenu="' + esc(g.id) + '" data-menu="tmenu" aria-label="Goal menu: ' + esc(title) + '" aria-haspopup="true" aria-expanded="false" title="More">' + I.dots + '</button>' +
      '</div></li>';
  }
  // One list: its bar (the name, done / all, the list menu), then its goals. tally counts what the line above the lists says.
  function listHtml(l, c, tally) {
    var shut = !!S.closed['todo:' + l.id], rows = order(l, c), done = 0;
    rows.forEach(function (r) { if (stamp(r.g, r.s)) tally.dirty = true; if (r.s.done) done++; });
    tally.goals += rows.length;
    tally.done += done;
    return '<h2 class="gh lh"><button class="ghb" type="button" data-group="' + esc(l.id) + '" aria-expanded="' + (shut ? 'false' : 'true') + '">' + I.chev +
      '<span class="n">' + esc(l.name) + '</span><span class="c">' + done + ' / ' + rows.length + '</span></button>' +
      '<button class="ib xs" type="button" data-lmenu="' + esc(l.id) + '" data-menu="tmenu" aria-label="List menu: ' + esc(l.name) + '" aria-haspopup="true" aria-expanded="false" title="List menu">' + I.dots + '</button></h2>' +
      '<ul class="todo" data-list="' + esc(l.id) + '"' + (shut ? ' hidden' : '') + '>' +
      (rows.length ? rows.map(function (r) { return goalHtml(r.g, r.s); }).join('') : '<li class="none">No goals here yet.</li>') + '</ul>';
  }
  function emptyHtml() {
    return '<p class="empty">Nothing on your list yet.</p>' +
      '<p class="para mid">Make your own lists, like <b>Today</b>, <b>Skilling goals</b> or <b>Gathering</b>, and put in what you want to get done.</p>' +
      '<ul class="plain start">' +
      '<li>Type a goal above, like <b>\u201c82 Thieving\u201d</b> or <b>\u201c500 Magic logs\u201d</b>.</li>' +
      '<li>A quest, an area task or a tier: <b>' + I.dots + ' \u2192 Add to list</b>.</li>' +
      '<li>Press <b>+ goal</b> next to a level you still miss.</li></ul>' +
      '<div class="newlist"><button class="btn" type="button" data-act="tnew">New list</button></div>';
  }
  // What the tab shows under the add box.
  function todoHtml() {
    var t = todo(), c = ctx(), tally = { goals: 0, done: 0, dirty: false };
    resetDue();
    if (!t.lists.length) return emptyHtml();
    var lists = t.lists.map(function (l) { return listHtml(l, c, tally); }).join('');
    if (tally.dirty) saveTodo();
    return '<p class="qmeta"><span>' + plural(t.lists.length, 'list', 'lists') + ' \u00b7 ' + plural(tally.goals, 'goal', 'goals') +
      (tally.done ? ', ' + tally.done + ' done' : '') + '</span>' + (S.player ? '<span class="how"> \u00b7 ' + esc(S.player.name) + '</span>' : '') + '</p>' +
      lists + '<div class="newlist"><button class="btn alt sm" type="button" data-act="tnew">' + I.plus + 'New list</button></div>';
  }
  // The lists as options of a select. more: an option after them ("New list…").
  function pickerHtml(sel, more) {
    var t = todo();
    sel = sel || pickId();
    return t.lists.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === sel ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + (more || '');
  }
  // The add box at the top of the tab, with the list a goal goes in.
  function todoFormHtml() {
    return '<form class="find" id="todo-form" novalidate><label class="vh" for="todo-text">Add a goal</label>' +
      '<div class="row-f"><input class="inp" id="todo-text" name="goal" type="text" maxlength="' + TEXT_MAX + '" autocomplete="off" spellcheck="false"' +
      ' placeholder="Add a goal, like \u201c82 Thieving\u201d" value="' + esc(S.todoInput || '') + '">' +
      '<select class="sel" id="todo-list" aria-label="To this list" title="To this list">' + (todo().lists.length ? pickerHtml() : '<option value="">My list</option>') + '</select>' +
      '<button class="btn" type="submit">Add</button></div>' +
      '<p class="err" id="todo-err" role="alert"' + (S.error ? '' : ' hidden') + '>' + esc(S.error) + '</p></form>';
  }
  // The number of open goals, on the tab.
  function countHtml() {
    var n = openCount();
    return n ? '<span class="tc" title="' + plural(n, 'goal', 'goals') + ' to do">' + n + '</span>' : '';
  }
  function updateCount() {
    var tab = document.querySelector('.tab[data-home="todo"]');
    if (!tab) return;
    var old = tab.querySelector('.tc');
    if (old) old.parentNode.removeChild(old);
    tab.insertAdjacentHTML('beforeend', countHtml());
  }
  // Redraws the lists and the list picker. The tick box you were on keeps the focus.
  function drawTodo() {
    var a = document.activeElement, sel = a && a.getAttribute && a.hasAttribute('data-gcb') ? '[data-gcb="' + cssq(a.getAttribute('data-gcb')) + '"]' : '';
    A.drawList();
    var p = byId('todo-list');
    if (p) p.innerHTML = todo().lists.length ? pickerHtml() : '<option value="">My list</option>';
    var f = sel && document.querySelector(sel);
    if (f && !f.disabled) f.focus();
  }
  function cssq(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  // After a change: the tab, the count on it, and the "Add to list" items and "+ goal" buttons on screen.
  function changed() {
    saveTodo();
    if (S.view === 'start' && S.set.home === 'todo') drawTodo(); else if (S.view === 'start') updateCount();
    updateRefs();
  }
  // The whole screen again (after Undo, so every menu and "+ goal" is right).
  function refreshScreen() {
    if (S.view === 'quest') A.renderQuest();
    else if (S.view === 'area') A.renderArea(true);
    else drawTodo();
  }
  // A message with buttons, like "Added to Today. Undo".
  function tell(html, acts) {
    var el = byId('toast');
    if (!el) return;
    S.toastActs = acts || [];
    el.innerHTML = '<span>' + html + '</span>' + S.toastActs.map(function (a, i) {
      return (i ? '<span class="sep" aria-hidden="true">\u00b7</span>' : ' ') + '<button class="tl" type="button" data-tact="' + i + '">' + a[0] + '</button>';
    }).join('');
    el.hidden = false;
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () { el.hidden = true; }, S.toastActs.length ? 6000 : 2600);
  }
  function toastAct(i) {
    var a = (S.toastActs || [])[i], el = byId('toast');
    S.toastActs = [];
    if (el) el.hidden = true;
    if (a) a[1]();
  }

  // ---------- adding: the add box ----------
  // What you type, as a goal: "82 thieving" or "thieving 82" is a skill goal; anything else is a goal as you typed it.
  // The lines of an export read the same way: "Quest: …", "Tier: Ardougne Hard", "Task 448: Yoink! (Ardougne Easy)",
  // and " (every day)" or " (every week)" at the end.
  function parseGoal(text) {
    var s = String(text || '').slice(0, 300).replace(/\s+/g, ' ').trim(), rep = '', m;
    m = / ?\((every day|daily|every week|weekly)\)$/i.exec(s);
    if (m) { rep = /day|daily/i.test(m[1]) ? 'day' : 'week'; s = s.slice(0, m.index).trim(); }
    if (!s) return null;
    var g = lineGoal(s);
    if (rep && g.kind === 'other') g.repeat = rep;
    return g;
  }
  function lineGoal(s) {
    var m, at, sk;
    if ((m = /^task (\d+) ?: ?(.+?) ?\(([^()]+)\)$/i.exec(s)) && (at = areaTier(m[3]))) {
      return { kind: 'task', task: m[1], title: m[2], area: at.area, tier: at.tier, tname: at.tname };
    }
    if ((m = /^tier ?: ?(.+)$/i.exec(s)) && (at = areaTier(m[1]))) return { kind: 'tier', area: at.area, tier: at.tier, title: at.area + ' ' + at.tname };
    if ((m = /^quest ?: ?(.+)$/i.exec(s))) return { kind: 'quest', title: m[1] };
    if ((m = /^(\d{1,3}) ([a-z]+)$/i.exec(s)) && (sk = skillKey(m[2])) && +m[1] >= 2 && +m[1] <= 120) return { kind: 'skill', skill: sk, level: +m[1] };
    if ((m = /^([a-z]+) (\d{1,3})$/i.exec(s)) && (sk = skillKey(m[1])) && +m[2] >= 2 && +m[2] <= 120) return { kind: 'skill', skill: sk, level: +m[2] };
    return { kind: 'other', title: cap1(s) };
  }
  function addFromBox() {
    var inp = byId('todo-text'), err = byId('todo-err'), g = parseGoal(inp ? inp.value : '');
    if (!g) {
      if (err) { err.textContent = 'Type a goal first.'; err.hidden = false; }
      if (inp) inp.focus();
      return;
    }
    if (goalCount() >= MAX_GOALS) { toast(FULL_GOALS); return; }
    var snap = snapshot(), pick = byId('todo-list'), l = listById(pick && pick.value) || target();
    addGoal(g, l);
    S.todoInput = '';
    S.error = '';
    if (inp) inp.value = '';
    if (err) err.hidden = true;
    changed();
    tell('Added to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }

  // ---------- adding from elsewhere: a quest, a tier, an area task, a level ----------
  // What a menu item or a button stands for, in data attributes: data-ref="quest", "tier", "task" or "skill", and its parts.
  function refAttrs(kind, o) {
    return ' data-ref="' + kind + '"' + (kind === 'quest' ? ' data-rtitle="' + esc(o.title) + '"' : kind === 'skill' ? ' data-rskill="' + esc(o.skill) + '" data-rlevel="' + esc(o.level) + '"' :
      ' data-rarea="' + esc(o.area) + '" data-rtier="' + esc(o.tier) + '" data-rtname="' + esc(o.tname) + '"' +
      (kind === 'task' ? ' data-rtask="' + esc(o.task) + '" data-rtitle="' + esc(o.title) + '"' : ''));
  }
  function refOf(b) {
    function a(n) { return b.getAttribute('data-' + n) || ''; }
    return { kind: a('ref'), title: a('rtitle'), area: a('rarea'), tier: a('rtier'), tname: a('rtname'), task: a('rtask'), skill: a('rskill'), level: +a('rlevel') };
  }
  // The goal a reference makes.
  function goalOfRef(r) {
    if (r.kind === 'quest') return { kind: 'quest', title: r.title };
    if (r.kind === 'skill') return { kind: 'skill', skill: skillKey(r.skill), level: r.level };
    if (r.kind === 'task') return { kind: 'task', area: r.area, tier: r.tier, tname: r.tname, task: r.task, title: r.title };
    return { kind: 'tier', area: r.area, tier: r.tier, title: r.area + ' ' + r.tname };
  }
  // A goal's quest, task or tier as a key: "q:<quest>", "t:<area>:<task>" or "r:<area>:<tier>".
  function refKey(kind, o) {
    return kind === 'quest' ? 'q:' + QG.normName(o.title) : kind === 'task' ? 't:' + o.area + ':' + o.task : kind === 'tier' ? 'r:' + o.area + ':' + o.tier : '';
  }
  // The goals of a quest, task or tier, by refKey.
  function refIndex() {
    if (!S.todoIdx) {
      var ix = S.todoIdx = {};
      todo().lists.forEach(function (l) { l.items.forEach(function (g) { var k = refKey(g.kind, g); if (k && !ix[k]) ix[k] = { g: g, l: l }; }); });
    }
    return S.todoIdx;
  }
  // In a menu: "Add to list…", or "Remove from Today" when it is on a list already.
  function addToItemHtml(kind, o) {
    var hit = refIndex()[refKey(kind, o)];
    return hit ? '<button class="mi" type="button" role="menuitem" data-unlist' + refAttrs(kind, o) + '>' + I.x + 'Remove from ' + esc(hit.l.name) + '</button>' :
      '<button class="mi" type="button" role="menuitem" data-addto' + refAttrs(kind, o) + '>' + I.plus + 'Add to list\u2026</button>';
  }
  // The ⋯ at the end of an area task's row. Its menu has "Add to list…" (or "Remove from …").
  function taskMenuHtml(o) {
    return '<button class="ib xs rowm" type="button" data-imenu' + refAttrs('task', o) + ' data-menu="tmenu" aria-label="Task menu: ' + esc(o.title) + '" aria-haspopup="true" aria-expanded="false" title="More">' + I.dots + '</button>';
  }
  function itemMenu(btn) {
    var r = refOf(btn);
    openMenu(btn, 'item', refKey(r.kind, r), '<p class="mh">' + esc(r.title) + '</p>' + addToItemHtml(r.kind, r), 'Task menu');
  }
  // What is added, as the Add to list box says it: "Yoink! · Ardougne Easy".
  function whatHtml(r) {
    return '<b>' + esc(r.kind === 'skill' ? r.level + ' ' + skillName(skillKey(r.skill)) : r.kind === 'tier' ? r.title || r.area + ' ' + r.tname : r.title) + '</b>' +
      (r.kind === 'task' ? ' \u00b7 ' + esc(r.area + ' ' + r.tname) : '');
  }
  // The Add to list box: which list it goes in, or a new one.
  function addToDialog(r) {
    if (goalCount() >= MAX_GOALS) { closeMenus(); toast(FULL_GOALS); return; }
    var none = !todo().lists.length;
    openDialog({ type: 'addto', ref: r }, '<h2 class="dh" id="td-h">Add to list</h2><p class="what">' + whatHtml(r) + '</p>' +
      '<div class="fld"><label for="ta-list">List</label><select class="sel" id="ta-list">' + pickerHtml('', '<option value="+"' + (none ? ' selected' : '') + '>New list\u2026</option>') + '</select></div>' +
      '<div class="fld" id="ta-new"' + (none ? '' : ' hidden') + '><label for="ta-name">Name of the new list</label>' +
      '<input class="inp" id="ta-name" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" value="' + (none ? 'My list' : '') + '"></div>' +
      errHtml() + buttonsHtml('Add'));
  }
  // "New list…" picked in the box: the name field shows.
  function addToPick(sel) {
    var f = byId('ta-new'), inp = byId('ta-name'), e = byId('td-err');
    if (e) e.hidden = true;
    if (!f) return;
    f.hidden = sel.value !== '+';
    if (!f.hidden && inp) inp.focus();
  }
  function submitAddTo(st) {
    var sel = byId('ta-list'), t = todo(), l, snap = snapshot();
    if (sel.value === '+') {
      var name = line(byId('ta-name').value, NAME_MAX), err = nameError(name);
      if (err) { dialogErr(err); return; }
      if (t.lists.length >= MAX_LISTS) { dialogErr(FULL_LISTS); return; }
      l = makeList(name);
    } else l = listById(sel.value);
    closeDialog();
    addGoal(goalOfRef(st.ref), l);
    changed();
    tell('Added to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function addFromButton(b) { closeMenus(); addToDialog(refOf(b)); }
  // "Remove from …" in a menu.
  function unlist(b) {
    var r = refOf(b), hit = refIndex()[refKey(r.kind, r)], snap = snapshot();
    closeMenus();
    if (!hit) return;
    hit.l.items.splice(hit.l.items.indexOf(hit.g), 1);
    changed();
    tell('Removed from <b>' + esc(hit.l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  // Is there a goal for this skill, at this level or higher?
  function hasSkillGoal(skill, level) {
    var k = skillKey(skill);
    return todo().lists.some(function (l) { return l.items.some(function (g) { return g.kind === 'skill' && g.skill === k && g.level >= +level; }); });
  }
  // "+ goal" next to a level you do not have: the Add to list box for it.
  function addSkillGoal(b) {
    var k = skillKey(b.getAttribute('data-addgoal'));
    if (k) addToDialog({ kind: 'skill', skill: k, level: +b.getAttribute('data-level') });
  }
  // The "Add to list" items in menus and the "+ goal" buttons on screen, after a change.
  function updateRefs() {
    arr(document.querySelectorAll('.mi[data-ref]')).forEach(function (b) {
      var r = refOf(b);
      b.insertAdjacentHTML('afterend', addToItemHtml(r.kind, r));
      b.parentNode.removeChild(b);
    });
    arr(document.querySelectorAll('[data-addgoal]')).forEach(function (b) {
      if (hasSkillGoal(b.getAttribute('data-addgoal'), b.getAttribute('data-level'))) b.parentNode.removeChild(b);
    });
  }

  // ---------- ticking ----------
  // An area task on a list and in its area is one tick.
  function tickTaskInArea(g, on) {
    var ix = A.aidxAll()[g.area], p = A.loadAprog(g.area);
    A.setTick(p.tasks, ix ? A.taskIndex(ix) : {}, g.task, on);
    sset('aprog.' + g.area, p);
    if (ix) A.writeAmeta(g.area, ix, p);
  }
  function tickGoal(id, on) {
    var hit = goalById(id);
    if (!hit || goalState(hit.g, ctx()).auto) return;
    var g = hit.g;
    if (g.kind === 'task') tickTaskInArea(g, on);
    if (on) g.done = Date.now(); else delete g.done;
    if (g.repeat) g.upd = Date.now();
    changed();
  }
  function setLast(id) {
    if (!listById(id)) return;
    todo().last = id;
    saveTodo();
  }

  // ---------- the menus of a goal and of a list ----------
  function mitem(act, icon, label, off, cls) {
    return '<button class="mi' + (cls ? ' ' + cls : '') + '" type="button" role="menuitem" data-tm="' + act + '"' + (off ? ' disabled' : '') + '>' + icon + '<span class="ml">' + label + '</span></button>';
  }
  // A menu next to its button. It opens downwards, or upwards when there is no room below.
  function openMenu(btn, kind, id, html, label) {
    var same = !!byId('tmenu') && !!S.tmenu && S.tmenu.kind === kind && S.tmenu.id === id;
    closeMenus();
    if (same) return;
    S.tmenu = { kind: kind, id: id };
    S.delArmed = 0;
    app.insertAdjacentHTML('beforeend', '<div class="menu at" id="tmenu" role="menu" aria-label="' + esc(label) + '">' + html + '</div>');
    btn.setAttribute('aria-expanded', 'true');
    var m = byId('tmenu'), r = btn.getBoundingClientRect(), box = app.getBoundingClientRect();
    var top = r.bottom - box.top + 2, h = m.offsetHeight;
    if (top + h > box.height - 6 && r.top - box.top - h - 2 > 40) top = r.top - box.top - h - 2;
    m.style.top = Math.max(6, Math.round(top)) + 'px';
    m.style.right = Math.max(6, Math.round(box.right - r.right)) + 'px';
  }
  function canShift(rows, i, d) { var j = i + d; return i >= 0 && j >= 0 && j < rows.length && rows[i].sunk === rows[j].sunk; }
  function goalMenu(btn) {
    var hit = goalById(btn.getAttribute('data-gmenu'));
    if (!hit) return;
    var g = hit.g, l = hit.l, rows = order(l, ctx()), i = rows.map(function (r) { return r.g; }).indexOf(g);
    var open = g.kind === 'quest' ? '<button class="mi" type="button" role="menuitem" data-quest="' + esc(g.title) + '">' + I.ext + 'Open the quest</button>' :
      FIXED[g.kind] ? '<button class="mi" type="button" role="menuitem" data-area="' + esc(g.area) + '" data-atier="' + esc(g.tier) + '">' + I.ext + 'Open ' + esc(g.kind === 'task' ? g.area + ' ' + g.tname : g.title) + '</button>' :
        g.kind === 'skill' ? '<a class="mi" role="menuitem" href="' + esc(QG.pageUrl(skillName(g.skill))) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on the wiki</a>' : '';
    openMenu(btn, 'goal', g.id, '<p class="mh">' + esc(goalTitle(g)) + '</p>' + mitem('gedit', I.edit, 'Edit') + open +
      '<hr><p class="mh">Move to</p>' + todo().lists.map(function (x) {
        return '<button class="mi" type="button" role="menuitemradio" aria-checked="' + (x === l) + '" data-tm="gmove" data-to="' + esc(x.id) + '">' +
          (x === l ? I.check : I.blank) + '<span class="ml">' + esc(x.name) + '</span></button>';
      }).join('') + mitem('gmovenew', I.plus, 'New list\u2026') +
      '<hr>' + mitem('gup', I.up, 'Move up', !canShift(rows, i, -1)) + mitem('gdown', I.down, 'Move down', !canShift(rows, i, 1)) +
      '<hr>' + mitem('gremove', I.x, 'Remove', false, 'danger'), 'Goal menu');
  }
  function listMenu(btn) {
    var l = listById(btn.getAttribute('data-lmenu'));
    if (!l) return;
    var t = todo(), i = t.lists.indexOf(l), c = ctx();
    var done = l.items.filter(function (g) { return !g.repeat && goalState(g, c).done; }).length;
    openMenu(btn, 'list', l.id, '<p class="mh">' + esc(l.name) + '</p>' + mitem('ladd', I.plus, 'Add a goal here') + mitem('lrename', I.edit, 'Rename') +
      '<hr>' + mitem('lup', I.up, 'Move list up', i === 0) + mitem('ldown', I.down, 'Move list down', i === t.lists.length - 1) +
      '<hr>' + mitem('lclear', I.check, 'Clear done goals (' + done + ')', !done) + mitem('ldelete', I.x, 'Delete list', false, 'danger'), 'List menu');
  }
  function menuAct(b) {
    var m = S.tmenu;
    if (!m) return;
    if (m.kind === 'list') listAct(b.getAttribute('data-tm'), m.id, b); else goalAct(b.getAttribute('data-tm'), m.id, b);
  }
  function goalAct(act, id, b) {
    var hit = goalById(id);
    if (!hit) { closeMenus(); return; }
    var g = hit.g, l = hit.l, snap = snapshot();
    if (act === 'gedit') { goalDialog({ edit: id }); return; }
    if (act === 'gmovenew') { listDialog('new', '', id); return; }
    closeMenus();
    if (act === 'gmove') {
      var to = listById(b.getAttribute('data-to'));
      if (!to || to === l) return;
      moveTo(g, l, to);
      changed();
      tell('Moved to <b>' + esc(to.name) + '</b>.', [['Undo', undoer(snap)]]);
    } else if (act === 'gup' || act === 'gdown') {
      var rows = order(l, ctx()), i = rows.map(function (r) { return r.g; }).indexOf(g), d = act === 'gup' ? -1 : 1;
      if (!canShift(rows, i, d)) return;
      var other = rows[i + d].g, a = l.items.indexOf(g), z = l.items.indexOf(other);
      l.items[a] = other;
      l.items[z] = g;
      changed();
    } else if (act === 'gremove') {
      l.items.splice(l.items.indexOf(g), 1);
      changed();
      tell('Removed from <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
    }
  }
  function listAct(act, id, b) {
    var l = listById(id), t = todo(), snap = snapshot();
    if (!l) { closeMenus(); return; }
    var i = t.lists.indexOf(l);
    if (act === 'ladd') { goalDialog({ list: id }); return; }
    if (act === 'lrename') { listDialog('rename', id); return; }
    // A list with goals in it takes two clicks to delete, the second within 4 seconds.
    if (act === 'ldelete' && l.items.length && !(S.delArmed && Date.now() - S.delArmed < 4000)) {
      S.delArmed = Date.now();
      b.querySelector('.ml').textContent = 'Click again to delete the list';
      return;
    }
    closeMenus();
    if (act === 'lup' || act === 'ldown') {
      var j = i + (act === 'lup' ? -1 : 1);
      if (j < 0 || j >= t.lists.length) return;
      t.lists[i] = t.lists[j];
      t.lists[j] = l;
      changed();
    } else if (act === 'lclear') {
      var c = ctx(), gone = l.items.filter(function (g) { return !g.repeat && goalState(g, c).done; });
      if (!gone.length) return;
      l.items = l.items.filter(function (g) { return gone.indexOf(g) < 0; });
      changed();
      tell('Cleared ' + plural(gone.length, 'done goal', 'done goals') + '.', [['Undo', undoer(snap)]]);
    } else if (act === 'ldelete') {
      t.lists.splice(i, 1);
      if (t.last === l.id) t.last = '';
      changed();
      tell('Deleted <b>' + esc(l.name) + '</b>.', l.items.length ? [['Undo', undoer(snap)]] : []);
    }
  }

  // ---------- the boxes: a new list, a name, a goal, Add to list ----------
  function openDialog(state, html) {
    closeMenus();
    closeDialog();
    S.tdlg = state;
    app.insertAdjacentHTML('beforeend', '<div class="dlgbg" id="td"><form class="dlg form" id="td-form" role="dialog" aria-modal="true" aria-labelledby="td-h" novalidate>' + html + '</form></div>');
    var f = arr(byId('td-form').querySelectorAll('input[type="text"], select, button')).filter(function (x) { return x.offsetParent !== null; })[0];
    if (f) f.focus();
  }
  function closeDialog() {
    var d = byId('td');
    if (d) d.parentNode.removeChild(d);
  }
  function dialogErr(msg) {
    var e = byId('td-err');
    if (e) { e.textContent = msg; e.hidden = false; }
  }
  function errHtml() { return '<p class="err" id="td-err" role="alert" hidden></p>'; }
  function buttonsHtml(label) {
    return '<div class="dbtn"><button class="btn" type="submit">' + label + '</button><button class="btn alt" type="button" data-tdx>Cancel</button></div>';
  }
  function fieldHtml(id, label, v, max, hint) {
    return '<div class="fld"><label for="' + id + '">' + label + '</label><input class="inp" id="' + id + '" type="text" maxlength="' + max + '" autocomplete="off"' +
      (hint ? ' placeholder="' + esc(hint) + '"' : '') + ' value="' + esc(v) + '"></div>';
  }
  // mode "new" (move: a goal to put in the new list) or "rename".
  function listDialog(mode, id, move) {
    var t = todo(), l = listById(id), used = {};
    if (mode === 'new' && t.lists.length >= MAX_LISTS) { closeMenus(); toast(FULL_LISTS); return; }
    t.lists.forEach(function (x) { used[x.name.toLowerCase()] = 1; });
    var sugg = mode === 'new' ? SUGGEST.filter(function (n) { return !used[n.toLowerCase()]; }) : [];
    openDialog({ type: 'list', mode: mode, id: id || '', move: move || '' },
      '<h2 class="dh" id="td-h">' + (mode === 'new' ? 'New list' : 'Rename list') + '</h2>' +
      fieldHtml('tl-name', 'Name', mode === 'rename' && l ? l.name : '', NAME_MAX) +
      (sugg.length ? '<div class="fld"><span class="fl">Or start from</span><div class="sugg">' + sugg.map(function (n) {
        return '<button class="btn alt sm" type="button" data-sugg="' + esc(n) + '">' + esc(n) + '</button>';
      }).join('') + '</div></div>' : '') +
      errHtml() + buttonsHtml(mode === 'new' ? 'Make list' : 'Rename'));
  }
  function useSuggestion(b) {
    var inp = byId('tl-name');
    if (!inp) return;
    inp.value = b.getAttribute('data-sugg');
    inp.focus();
  }
  function submitList(st) {
    var inp = byId('tl-name'), name = line(inp ? inp.value : '', NAME_MAX), t = todo(), snap = snapshot(), err = nameError(name, st.id);
    if (err) { dialogErr(err); return; }
    closeDialog();
    if (st.mode === 'rename') {
      var l = listById(st.id);
      if (l) l.name = name;
      changed();
      return;
    }
    var nl = makeList(name), mv = st.move ? goalById(st.move) : null;
    t.last = nl.id;
    if (mv) moveTo(mv.g, mv.l, nl);
    changed();
    if (mv) tell('Moved to <b>' + esc(nl.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function segHtml(name, opts, v) {
    return '<div class="seg" role="group" aria-labelledby="tg-' + name + '-l" data-for="' + name + '">' + opts.map(function (o) {
      return '<button type="button" data-seg="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === v) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  // "Add a goal" (o.list: the list it goes in) and "Edit goal" (o.edit: the goal).
  function goalDialog(o) {
    var hit = o.edit ? goalById(o.edit) : null;
    if (!hit && goalCount() >= MAX_GOALS) { closeMenus(); toast(FULL_GOALS); return; }
    var g = hit ? hit.g : null;
    var st = { type: 'goal', edit: o.edit || '', g: g, d: { text: g ? goalTitle(g) : '', list: hit ? hit.l.id : o.list || pickId(), repeat: (g && g.repeat) || '', note: (g && g.note) || '' } };
    openDialog(st, goalFormHtml(st));
  }
  function goalFormHtml(st) {
    var d = st.d, fixed = !!st.g && FIXED[st.g.kind];
    var h = '<h2 class="dh" id="td-h">' + (st.edit ? 'Edit goal' : 'Add a goal') + '</h2>';
    h += fixed ? '<p class="what">' + whatHtml({ kind: st.g.kind, title: st.g.title, area: st.g.area, tname: st.g.tname || '' }) + '</p>' :
      fieldHtml('tg-text', 'Goal', d.text, TEXT_MAX, 'Like 82 Thieving, or Buy a cape');
    h += '<div class="fld"><label for="tg-list">List</label><select class="sel" id="tg-list">' + pickerHtml(d.list) + '</select></div>';
    if (!fixed) h += '<div class="fld"><span class="fl" id="tg-repeat-l">Again</span>' + segHtml('repeat', REPEAT_SEG, d.repeat) + '</div>';
    h += fieldHtml('tg-note', 'Note (optional)', d.note, NOTE_MAX);
    if (!st.edit) h += note('A quest, an area task or a tier? Its ' + I.dots + ' menu has Add to list.');
    return h + errHtml() + buttonsHtml(st.edit ? 'Save' : 'Add');
  }
  function readDraft(d) {
    ['text', 'list', 'note'].forEach(function (k) { var el = byId('tg-' + k); if (el) d[k] = el.value; });
  }
  // How often the goal comes back: the box shows the choice, and keeps what you typed.
  function pickSeg(b) {
    var st = S.tdlg, f = byId('td-form');
    if (!st || st.type !== 'goal' || !f) return;
    var name = b.getAttribute('data-seg'), v = b.getAttribute('data-v');
    readDraft(st.d);
    st.d[name] = v;
    f.innerHTML = goalFormHtml(st);
    var nb = f.querySelector('[data-seg="' + name + '"][data-v="' + v + '"]');
    if (nb) nb.focus();
  }
  function submitGoal(st) {
    var d = st.d, g;
    readDraft(d);
    if (st.g && FIXED[st.g.kind]) g = copy({}, st.g);
    else {
      g = parseGoal(d.text);
      if (!g) { dialogErr('Type a goal first.'); return; }
      if (g.kind === 'other' && (d.repeat === 'day' || d.repeat === 'week')) g.repeat = d.repeat;
    }
    delete g.note;
    if (line(d.note, NOTE_MAX)) g.note = line(d.note, NOTE_MAX);
    var l = listById(d.list) || target(), snap = snapshot();
    closeDialog();
    if (!st.edit) {
      addGoal(g, l);
      changed();
      tell('Added to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
      return;
    }
    var hit = goalById(st.edit);
    if (!hit) return;
    var old = hit.g, keep = old.kind === g.kind ? { done: old.done, upd: old.upd } : {};
    var ng = cleanGoal(copy(copy(copy({}, g), keep), { id: old.id, at: old.at }));
    hit.l.items[hit.l.items.indexOf(old)] = ng;
    if (l !== hit.l) moveTo(ng, hit.l, l);
    changed();
  }
  // The add box and the boxes above the app send their forms here. True when the form was one of them.
  function todoSubmit(form) {
    if (form.id === 'todo-form') { addFromBox(); return true; }
    if (form.id !== 'td-form') return false;
    var st = S.tdlg;
    if (st && st.type === 'list') submitList(st);
    else if (st && st.type === 'goal') submitGoal(st);
    else if (st && st.type === 'addto') submitAddTo(st);
    return true;
  }

  // ---------- export and import: "mylist" in the file ----------
  // A goal as a line of the file. It reads back the way the add box reads what you type.
  function goalLine(g) {
    if (g.kind === 'skill') return g.level + ' ' + skillName(g.skill);
    if (g.kind === 'task') return 'Task ' + g.task + ': ' + g.title + ' (' + g.area + ' ' + g.tname + ')';
    if (g.kind === 'tier') return 'Tier: ' + g.title;
    if (g.kind === 'quest') return 'Quest: ' + g.title;
    return g.title + (g.repeat ? ' (every ' + g.repeat + ')' : '');
  }
  // { "<list>": { "<goal>": true or false } }. A goal with a note: { done, note }.
  function exportTodo() {
    var out = {}, c = ctx();
    todo().lists.forEach(function (l) {
      var o = {};
      l.items.forEach(function (g) {
        var v = goalState(g, c).done;
        if (g.note) v = { done: v, note: g.note };
        var k = goalLine(g), key = k, n = 2;
        while (Object.prototype.hasOwnProperty.call(o, key)) key = k + ' #' + n++;
        o[key] = v;
      });
      out[l.name] = o;
    });
    return out;
  }
  // Replaces your lists with the file's. Lines are read like the add box reads them. Returns how many lists came in.
  // A goal is done when it says true (or "320 / 500" with the first number as big as the second).
  function importTodo(m) {
    var lists = [], names = {}, n = 0, now = Date.now();
    Object.keys(m).forEach(function (name) {
      var nm = line(name, NAME_MAX), e = m[name];
      if (!nm || names[nm.toLowerCase()] || !isMap(e) || lists.length >= MAX_LISTS) return;
      names[nm.toLowerCase()] = 1;
      var l = { id: newId('l'), name: nm, items: [] };
      Object.keys(e).forEach(function (k) {
        var g = n < MAX_GOALS ? parseGoal(String(k).replace(/ #\d+$/, '')) : null, v = e[k];
        if (!g) return;
        if (isMap(v)) {
          if (typeof v.note === 'string') g.note = v.note;
          v = v.done;
        }
        var cm = typeof v === 'string' ? /^([\d,.]+[km]?) ?\/ ?([\d,.]+[km]?)$/i.exec(v.replace(/\s+/g, ' ').trim()) : null;
        if (v === true || (cm && amount(cm[1]) >= amount(cm[2]))) g.done = now;
        if (g.repeat && g.done) g.upd = now;
        var c = cleanGoal(copy({ id: newId('g'), at: now }, g));
        if (!c) return;
        l.items.push(c);
        n++;
      });
      lists.push(l);
    });
    S.todo = { v: 1, last: lists.length ? lists[0].id : '', lists: lists };
    saveTodo();
    return lists.length;
  }

  A.share({ addFromButton: addFromButton, addSkillGoal: addSkillGoal, addToItemHtml: addToItemHtml, addToPick: addToPick,
    closeTodoDialog: closeDialog, exportTodo: exportTodo, goalMenu: goalMenu, hasSkillGoal: hasSkillGoal, importTodo: importTodo,
    itemMenu: itemMenu, listMenu: listMenu, menuAct: menuAct, newListDialog: function () { listDialog('new'); },
    pickSeg: pickSeg, setTodoLast: setLast, startTodoClock: startClock, taskMenuHtml: taskMenuHtml, tickGoal: tickGoal,
    todoCountHtml: countHtml, todoFormHtml: todoFormHtml, todoHtml: todoHtml, todoSubmit: todoSubmit, toastAct: toastAct,
    unlist: unlist, updateTodoCount: updateCount, useSuggestion: useSuggestion });
  A.loaded.todo = true;
})(window.QuickGuideApp);
