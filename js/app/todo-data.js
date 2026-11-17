/*!
 * Quick Guide - js/app/todo-data.js
 * My list: your own lists of goals. This file has what is saved and how it is read: the lists, the goals and their
 * sub tasks, the game's resets, how a goal stands, what you type as a goal, the links to the wiki, and export and import.
 * todo-view.js draws it and todo.js changes it; they find what is here on A.T.
 *
 * A goal is one row: a tick box, what it says, and its menu. You can tick any goal; skill levels, quests and tiers
 * also tick themselves; an area task shares its tick with its area, and a quest with the quest list. A goal can repeat
 * daily, weekly or monthly. A goal can have sub tasks, and those their own (four deep): each is done when all of its
 * own are.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var D = A.D, markedDone = A.markedDone, metaAll = A.metaAll, playerLevel = A.playerLevel, playerStatus = A.playerStatus,
    QG = A.QG, S = A.S, setMarked = A.setMarked, sget = A.sget, sset = A.sset;

  var MAX_LISTS = 30, MAX_GOALS = 300, MAX_SUBS = 20, MAX_DEPTH = 4, NAME_MAX = 30, TEXT_MAX = 80, NOTE_MAX = 120;
  var DAY = 24 * 3600 * 1000;
  var FULL_GOALS = 'You have 300 goals. Remove some first.', FULL_LISTS = 'You have 30 lists. Delete one first.';
  // The kinds of goal. You tick any of them; a skill goal also ticks itself when your character has the level, a
  // quest when the quest is done, a tier when all its tasks are. An area task is one tick with its area.
  var KINDS = { skill: 1, task: 1, tier: 1, quest: 1, other: 1 };
  // Goals that stand for a quest, a task or a tier: only their list and note can change.
  var FIXED = { quest: 1, task: 1, tier: 1 };
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
  var REPEATS = { day: 'daily', week: 'weekly', month: 'monthly' };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  // Sub tasks from saved data or a file: each has what it says, and may have its own (MAX_DEPTH deep).
  function cleanSubs(list, depth) {
    if (!Array.isArray(list) || depth > MAX_DEPTH) return [];
    return list.map(function (u) {
      // A sub task that stands for a quest, a tier, an area task or a level is kept like a goal of that kind.
      if (isMap(u) && isRef(u)) {
        var r = cleanGoal(copy(copy({}, u), { id: line(u.id, 40) || newId('s') }), depth);
        if (r) delete r.at;
        return r;
      }
      var st = isMap(u) ? line(u.title) : '';
      if (!st) return null;
      var o = { id: line(u.id, 40) || newId('s'), title: st };
      if (+u.done > 0) o.done = +u.done;
      if (typeof u.wiki === 'string') o.wiki = line(u.wiki, 120);
      if (line(u.note, NOTE_MAX)) o.note = line(u.note, NOTE_MAX);
      var kids = cleanSubs(u.subs, depth + 1);
      if (kids.length) o.subs = kids;
      return o;
    }).filter(Boolean).slice(0, MAX_SUBS);
  }
  // One goal from saved data, a file or a form, with only what its kind has. Null when it is not a goal.
  // Goals of an older kind (an item with a count, an unlock) become plain goals that say the same.
  function cleanGoal(x, depth) {
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
    if (g.kind === 'other' && REPEATS[x.repeat]) g.repeat = x.repeat;
    ['at', 'done', 'upd'].forEach(function (k) { if (+x[k] > 0) g[k] = +x[k]; });
    // The wiki page of a goal you wrote yourself: a name, '' when there is none, nothing when it was not looked up yet.
    if (g.kind === 'other' && typeof x.wiki === 'string') g.wiki = line(x.wiki, 120);
    var subs = cleanSubs(x.subs, (depth || 0) + 1);
    if (subs.length) g.subs = subs;
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
  // The list a new goal goes in when none is named: the one you used last, else the first.
  function pickId() {
    var t = todo();
    return listById(t.last) ? t.last : t.lists.length ? t.lists[0].id : '';
  }
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

  // ---------- sub tasks ----------
  // A sub task of a goal, however deep: { u, p (what it is under: the goal or a sub task), i (its place), depth }.
  function findSub(g, sid) {
    var hit = null;
    (function walk(p, depth) {
      (p.subs || []).forEach(function (u, i) {
        if (hit) return;
        if (u.id === sid) hit = { u: u, p: p, i: i, depth: depth }; else walk(u, depth + 1);
      });
    })(g, 1);
    return hit;
  }
  // Ticks or unticks everything under a goal or a sub task.
  function setSubs(p, on) {
    (p.subs || []).forEach(function (u) { mark(u, on); setSubs(u, on); });
  }
  // Does a goal or sub task stand for a quest, a tier, an area task or a level?
  function isRef(x) { return !!KINDS[x.kind] && x.kind !== 'other'; }
  // Is a sub task done? One that stands for a quest, a tier, an area task or a level is done the way a goal of
  // that kind is.
  function isDone(u) { return isRef(u) ? goalState(u, ctx()).done : !!u.done; }
  // Ticks or unticks one sub task (an area task in its area, a quest in the quest list, too).
  function mark(u, on) {
    if (isRef(u)) setDone(u, on); else if (on) u.done = u.done || 1; else delete u.done;
  }
  // After a change: a sub task with its own sub tasks is done when all of them are, and open when one is not. One
  // that stands for a task or a quest is only ticked for that when you just ticked the last one under it (finish).
  // True when all under p are done.
  function settle(p, finish) {
    var all = true;
    (p.subs || []).forEach(function (u) {
      if (u.subs) {
        var kids = settle(u, finish);
        if (kids && (finish || !isRef(u)) && !isDone(u)) mark(u, true);
        else if (!kids && isDone(u)) mark(u, false);
      }
      if (!isDone(u)) all = false;
    });
    return all;
  }
  // The sub tasks you wrote yourself: is one ticked, and unticking them all (for a goal that repeats).
  function anyDone(p) { return (p.subs || []).some(function (u) { return (!isRef(u) && u.done) || anyDone(u); }); }
  function untickOwn(p) { (p.subs || []).forEach(function (u) { if (!isRef(u)) delete u.done; untickOwn(u); }); }
  // An area task on a list and in its area is one tick.
  function tickTaskInArea(g, on) {
    var ix = A.aidxAll()[g.area], p = A.loadAprog(g.area);
    A.setTick(p.tasks, ix ? A.taskIndex(ix) : {}, g.task, on);
    sset('aprog.' + g.area, p);
    if (ix) A.writeAmeta(g.area, ix, p);
  }
  // A goal ticked or unticked. An area task is ticked in its area, and a quest in the quest list, too.
  function setDone(g, on) {
    if (g.kind === 'task') tickTaskInArea(g, on);
    if (g.kind === 'quest') setMarked(g.title, on);
    if (on) g.done = Date.now(); else delete g.done;
    if (g.repeat) g.upd = Date.now();
  }
  // After its sub tasks changed: the goal is done when all of them are, and open again when one is not.
  // A task ticked in its area, or a quest that got done, changes what is above it on a list: every goal with sub
  // tasks is settled again before the lists are shown or go into a file.
  function settleAll() {
    var before = snapshot();
    todo().lists.forEach(function (l) { l.items.forEach(function (g) { if (g.subs) settleGoal(g); }); });
    if (snapshot() !== before) saveTodo();
  }
  function settleGoal(g, finish) {
    var all = settle(g, finish);
    if (!g.subs) return;
    if (finish && all && !goalState(g, ctx()).done) setDone(g, true);
    else if (!all && goalState(g, ctx()).done) setDone(g, false);
  }

  // ---------- goals that repeat: the game's resets, daily (00:00 UTC), weekly (Wednesday 00:00 UTC) and monthly (the
  // 1st, 00:00 UTC) ----------
  function lastReset(rep, now) {
    var d = new Date(now), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return rep === 'month' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) : rep === 'week' ? day - ((d.getUTCDay() + 4) % 7) * DAY : day;
  }
  function nextReset(rep, now) {
    var d = new Date(now);
    return rep === 'month' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) : lastReset(rep, now) + (rep === 'week' ? 7 : 1) * DAY;
  }
  // "back tomorrow, 01:00", "back Wednesday, 01:00" or "back 1 December, 01:00", in your own time.
  function backText(rep) {
    var now = new Date(), at = new Date(nextReset(rep, now.getTime()));
    var days = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
    return 'back ' + (days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days < 7 ? DAYS[at.getDay()] : at.getDate() + ' ' + MONTHS[at.getMonth()]) +
      ', ' + pad(at.getHours()) + ':' + pad(at.getMinutes());
  }
  // Unticks goals that repeat once their reset has passed. True when one changed.
  function resetDue() {
    var t = S.todo || todo(), now = Date.now(), changed = false;
    t.lists.forEach(function (l) {
      l.items.forEach(function (g) {
        var any = g.done || anyDone(g);
        if (!g.repeat || !any || (g.upd || g.done || 0) >= lastReset(g.repeat, now)) return;
        delete g.done;
        delete g.upd;
        untickOwn(g);
        changed = true;
      });
    });
    if (changed) saveTodo();
    return changed;
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
  // Is a goal done by itself? A skill level your character has, a quest that is done, a tier with all its tasks ticked.
  function selfDone(g, c) {
    if (g.kind === 'skill') { var lv = playerLevel(g.skill); return lv != null && lv >= g.level; }
    if (g.kind === 'tier') {
      var t = c.tier(g.area, g.tier), ticks = c.tasks(g.area);
      return !!t && t.tasks.length > 0 && t.tasks.every(function (x) { return ticks[x.id]; });
    }
    if (g.kind === 'quest') {
      var m = c.meta()[D.norm(g.title)];
      return (!!m && m.total > 0 && m.done >= m.total) || playerStatus(g.title) === 2 || markedDone(g.title);
    }
    return false;
  }
  // A goal is done when you ticked it or it is done by itself. An area task is done when it is ticked in its area.
  function goalState(g, c) {
    if (g.kind === 'task') return { done: !!c.tasks(g.area)[g.task], self: false };
    var self = selfDone(g, c);
    return { done: !!g.done || self, self: self };
  }
  function goalTitle(g) { return g.kind === 'skill' ? g.level + ' ' + skillName(g.skill) : g.title; }
  // A list's goals, in your order, each with how it stands. A goal you tick stays where it is.
  function order(l, c) {
    return l.items.map(function (g) { return { g: g, s: goalState(g, c) }; });
  }
  function openCount() {
    var c = ctx();
    return todo().lists.reduce(function (n, l) { return n + l.items.filter(function (g) { return !goalState(g, c).done; }).length; }, 0);
  }

  // ---------- what you type, as a goal ----------
  // What you type, as a goal: "82 thieving" or "thieving 82" is a skill goal; anything else is a goal as you typed it.
  // The lines of an export read the same way: "Quest: …", "Tier: Ardougne Hard", "Task 448: Yoink! (Ardougne Easy)",
  // and " (daily)", " (weekly)" or " (monthly)" at the end (or "every day", "every week", "every month").
  function parseGoal(text) {
    var s = String(text || '').slice(0, 300).replace(/\s+/g, ' ').trim(), rep = '', m;
    m = / ?\((every day|daily|every week|weekly|every month|monthly)\)$/i.exec(s);
    if (m) { rep = /day|daily/i.test(m[1]) ? 'day' : /week/i.test(m[1]) ? 'week' : 'month'; s = s.slice(0, m.index).trim(); }
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

  // ---------- a list as text: one goal on each line, a line that is further in is under the one above ----------
  // Reads a pasted list. A line may start with a bullet (-, *, +, \u2022) or a number ("1."), then a tick box ("[ ]",
  // "[x]" for done); what follows is read like a goal you type. room: how many goals still fit.
  // Returns { goals (each with its subs), subs (how many sub tasks), left (lines that do not fit) }.
  function parseOutline(text, room) {
    var out = { goals: [], subs: 0, left: 0 }, stack = [];
    String(text || '').slice(0, 60000).split(/\r?\n/).forEach(function (raw) {
      var m = /^([ \t]*)(.*)$/.exec(raw), indent = m[1].replace(/\t/g, '    ').length;
      var s = m[2].replace(/^(?:[-*+\u2022\u2013\u2014\u00b7]|\d+[.)])(?:\s+|$)/, '');
      var box = /^\[([ xX]?)\]\s*/.exec(s), g = parseGoal(box ? s.slice(box[0].length) : s);
      if (!g) return;
      if (box && /x/i.test(box[1])) g.done = 1;
      // What it is under: the last line that is less far in. Deeper than a sub task can be: next to the deepest.
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      while (stack.length > MAX_DEPTH) stack.pop();
      var par = stack.length ? stack[stack.length - 1].node : null, fits;
      if (!stack.length) fits = out.goals.length < room;
      else fits = !!par && (par.subs || []).length < MAX_SUBS;
      // (What is under a line that does not fit does not fit either.)
      stack.push({ indent: indent, node: fits ? g : null });
      if (!fits) { out.left++; return; }
      if (par) { (par.subs = par.subs || []).push(g); out.subs++; } else out.goals.push(g);
    });
    return out;
  }
  // A list as text, the way parseOutline reads it: "- " for each goal, two spaces further in for each level, "[x]" when done.
  function listText(l) {
    var c = ctx(), lines = [];
    function walk(x, depth, done) {
      lines.push(new Array(depth + 1).join('  ') + '- ' + (done ? '[x] ' : '') + goalLine(x));
      (x.subs || []).forEach(function (u) { walk(u, depth + 1, isDone(u)); });
    }
    l.items.forEach(function (g) { walk(g, 0, goalState(g, c).done); });
    return lines.join('\n');
  }

  // ---------- a quest, a tier, an area task or a level, as a goal ----------
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
      // g: the goal or sub task; l: its list; top and p: for a sub task, its goal and what it is under.
      todo().lists.forEach(function (l) {
        l.items.forEach(function (g) {
          var k = refKey(g.kind, g);
          if (k && !ix[k]) ix[k] = { g: g, l: l };
          (function walk(p) {
            (p.subs || []).forEach(function (u) {
              var uk = refKey(u.kind, u);
              if (uk && !ix[uk]) ix[uk] = { g: u, l: l, top: g, p: p };
              walk(u);
            });
          })(g);
        });
      });
    }
    return S.todoIdx;
  }
  // Is there a goal for this skill, at this level or higher?
  function hasSkillGoal(skill, level) {
    var k = skillKey(skill);
    return todo().lists.some(function (l) { return l.items.some(function (g) { return g.kind === 'skill' && g.skill === k && g.level >= +level; }); });
  }

  // ---------- links to the wiki, for goals and sub tasks you wrote yourself ----------
  var WORDS = /^(unlock|buy|get|make|craft|obtain|find|kill|do|finish|complete|smith|cook|catch|chop|cut|mine|collect|gather|use|wear|equip)\s+/i;
  // The wiki pages a goal's words may be about: as typed, and without "Buy a" or a number in front; each also with
  // small letters after the first ("Crystal Hatchet" is "Crystal hatchet" on the wiki).
  function wikiNames(title) {
    var out = [], t = title.replace(/\s*\([^()]*\)$/, '');
    function push(s) {
      s = s.trim();
      if (s.length < 2 || /[|#<>\[\]{}]/.test(s)) return;
      [s, s.charAt(0) + s.slice(1).toLowerCase()].forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); });
    }
    push(t);
    push(t.replace(WORDS, '').replace(/^(an?|the|some)\s+/i, '').replace(/^\d[\d,.]*[km]?\s*x?\s+/i, ''));
    return out;
  }
  // Every goal you wrote yourself and every sub task.
  function eachOwn(fn) {
    todo().lists.forEach(function (l) {
      l.items.forEach(function (g) {
        if (g.kind === 'other') fn(g);
        (function walk(p) { (p.subs || []).forEach(function (u) { if (!isRef(u)) fn(u); walk(u); }); })(g);
      });
    });
  }
  // What the wiki said this session: { "<what a goal says>": its page, or '' }, and what it could not be asked for.
  var wikiSeen = {}, wikiFailed = {}, wikiBusy = false;
  // Looks up the goals and sub tasks that were not looked up yet, a few at a time, quietly. The answer is kept with
  // each of them (wiki: the page's name, or '' when there is none), so each is asked once.
  function lookUpWiki() {
    var ask = [], n = 0;
    eachOwn(function (x) {
      if (x.wiki !== undefined) return;
      if (Object.prototype.hasOwnProperty.call(wikiSeen, x.title)) { x.wiki = wikiSeen[x.title]; n++; }
      else if (!wikiFailed[x.title] && ask.indexOf(x.title) < 0) ask.push(x.title);
    });
    if (n) sset('todo', S.todo);
    if (wikiBusy || !ask.length) return;
    ask = ask.slice(0, 10);
    var names = [];
    ask.forEach(function (t) { wikiNames(t).forEach(function (w) { if (names.indexOf(w) < 0) names.push(w); }); });
    if (!names.length) { ask.forEach(function (t) { wikiSeen[t] = ''; }); lookUpWiki(); return; }
    wikiBusy = true;
    QG.findPages(names).then(function (found) {
      ask.forEach(function (t) {
        wikiSeen[t] = wikiNames(t).map(function (w) { return found[w] || ''; }).filter(Boolean)[0] || '';
      });
    }, function () {
      ask.forEach(function (t) { wikiFailed[t] = 1; });
    }).then(function () { wikiBusy = false; lookUpWiki(); });
  }

  // ---------- export and import: "mylist" in the file ----------
  // A goal as a line of the file. It reads back the way the add box reads what you type.
  function goalLine(g) {
    if (g.kind === 'skill') return g.level + ' ' + skillName(g.skill);
    if (g.kind === 'task') return 'Task ' + g.task + ': ' + g.title + ' (' + g.area + ' ' + g.tname + ')';
    if (g.kind === 'tier') return 'Tier: ' + g.title;
    if (g.kind === 'quest') return 'Quest: ' + g.title;
    return g.title + (g.repeat ? ' (' + REPEATS[g.repeat] + ')' : '');
  }
  // Sub tasks in the file: { "<sub task>": true or false }, or { done, note, subs } for one with a note or its own.
  function subsOut(list) {
    var o = {};
    list.forEach(function (u) {
      var name = isRef(u) ? goalLine(u) : u.title, k = name, n = 2;
      while (Object.prototype.hasOwnProperty.call(o, k)) k = name + ' #' + n++;
      var v = isDone(u);
      if (u.note || u.subs) {
        v = { done: v };
        if (u.note) v.note = u.note;
        if (u.subs) v.subs = subsOut(u.subs);
      }
      o[k] = v;
    });
    return o;
  }
  function subsIn(m) {
    return Object.keys(m).map(function (t) {
      // "Task 448: Yoink! (Ardougne Easy)", "Quest: …", "Tier: …" and "82 Thieving" are read like a goal's line.
      var v = m[t], name = t.replace(/ #\d+$/, ''), g = parseGoal(name), o = g && g.kind !== 'other' ? g : { title: name };
      if (isMap(v)) {
        if (isMap(v.subs)) o.subs = subsIn(v.subs);
        if (typeof v.note === 'string') o.note = v.note;
        v = v.done;
      }
      o.done = v === true ? 1 : 0;
      return o;
    });
  }
  // { "<list>": { "<goal>": true or false } }. A goal with a note or sub tasks: { done, note, subs: { "<sub task>": true } }.
  function exportTodo() {
    settleAll();
    var out = {}, c = ctx();
    todo().lists.forEach(function (l) {
      var o = {};
      l.items.forEach(function (g) {
        var v = goalState(g, c).done;
        if (g.note || g.subs) {
          v = { done: v };
          if (g.note) v.note = g.note;
          if (g.subs) v.subs = subsOut(g.subs);
        }
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
          if (isMap(v.subs)) g.subs = subsIn(v.subs);
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

  // What todo-view.js and todo.js use.
  A.T = { MAX_LISTS: MAX_LISTS, MAX_GOALS: MAX_GOALS, MAX_SUBS: MAX_SUBS, MAX_DEPTH: MAX_DEPTH, NAME_MAX: NAME_MAX, TEXT_MAX: TEXT_MAX,
    NOTE_MAX: NOTE_MAX, FULL_GOALS: FULL_GOALS, FULL_LISTS: FULL_LISTS, FIXED: FIXED, REPEATS: REPEATS,
    addGoal: addGoal, backText: backText, cap1: cap1, cleanGoal: cleanGoal, cleanTodo: cleanTodo, copy: copy, ctx: ctx,
    findSub: findSub, isDone: isDone, isRef: isRef, mark: mark, goalById: goalById, goalCount: goalCount, goalOfRef: goalOfRef, goalState: goalState, goalTitle: goalTitle,
    line: line, listById: listById, listText: listText, parseOutline: parseOutline, lookUpWiki: lookUpWiki, makeList: makeList, moveTo: moveTo, nameError: nameError,
    newId: newId, openCount: openCount, order: order, parseGoal: parseGoal, pickId: pickId, refIndex: refIndex, refKey: refKey,
    resetDue: resetDue, saveTodo: saveTodo, setDone: setDone, setSubs: setSubs, settleAll: settleAll, settleGoal: settleGoal, skillKey: skillKey,
    skillName: skillName, snapshot: snapshot, todo: todo };
  A.share({ exportTodo: exportTodo, hasSkillGoal: hasSkillGoal, importTodo: importTodo });
  A.loaded.todoData = true;
})(window.QuickGuideApp);
