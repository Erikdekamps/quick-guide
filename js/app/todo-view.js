/*!
 * Quick Guide - js/app/todo-view.js
 * My list: what the tab shows (the lists, their goals and sub tasks, the box at the end of each list), the count on the
 * tab, the message with Undo, "Add to list" in the menus of a quest, a tier and an area task, and the menus and boxes
 * todo.js fills.
 */
(function (A) {
  'use strict';
  if (!A || !A.T) return;
  var app = A.app, arr = A.arr, byId = A.byId, closeMenus = A.closeMenus, esc = A.esc, I = A.I, plural = A.plural, S = A.S, T = A.T;
  var backText = T.backText, cleanTodo = T.cleanTodo, ctx = T.ctx, goalTitle = T.goalTitle, isDone = T.isDone, lookUpWiki = T.lookUpWiki,
    openCount = T.openCount, order = T.order, pickId = T.pickId, refIndex = T.refIndex, refKey = T.refKey, REPEATS = T.REPEATS,
    resetDue = T.resetDue, saveTodo = T.saveTodo, settleAll = T.settleAll, skillKey = T.skillKey, skillName = T.skillName, TEXT_MAX = T.TEXT_MAX, todo = T.todo;

  // ---------- the My list tab ----------
  function doneCount(p) { return '<span class="sc">' + p.subs.filter(isDone).length + ' / ' + p.subs.length + '</span>'; }
  // One goal: its tick box, what it says (with "daily" or when it is back, how many sub tasks are done, and its note),
  // its menu, and its sub tasks under it.
  function goalHtml(g, s) {
    var title = goalTitle(g), tid = esc('gt-' + g.id);
    return '<li class="goal' + (s.done ? ' done' : '') + (g.repeat ? ' rep' : '') + '" data-goal="' + esc(g.id) + '"><div class="row">' +
      '<input class="cb" type="checkbox" data-gcb="' + esc(g.id) + '" aria-labelledby="' + tid + '"' + (s.done ? ' checked' : '') + '>' +
      '<div class="rb"><span class="t" id="' + tid + '">' + esc(title) + '</span>' +
      (g.repeat ? '<span class="rp">' + I.refresh + (s.done ? backText(g.repeat) : REPEATS[g.repeat]) + '</span>' : '') +
      (g.subs ? doneCount(g) : '') +
      (g.note ? '<span class="gn">' + esc(g.note) + '</span>' : '') + '</div>' +
      '<button class="ib xs rowm" type="button" data-gmenu="' + esc(g.id) + '" data-menu="tmenu" aria-label="Goal menu: ' + esc(title) + '" aria-haspopup="true" aria-expanded="false" title="More">' + I.dots + '</button>' +
      '</div>' + subsHtml(g, g) + '</li>';
  }
  // The sub tasks under a goal or a sub task (p), and the box to type the next one in when it is open there.
  function subsHtml(g, p) {
    var add = !!S.subAdd && S.subAdd.gid === g.id && S.subAdd.pid === (p === g ? '' : p.id);
    if (!p.subs && !add) return '';
    return '<ul class="gsubs">' + (p.subs || []).map(function (u) { return subHtml(g, u); }).join('') +
      (add ? '<li class="addrow">' + addFormHtml(' data-sadd="' + esc(g.id) + '" data-pid="' + esc(S.subAdd.pid) + '"',
        'Add a sub task to ' + goalTitle(p), 'Add a sub task', true) + '</li>' : '') + '</ul>';
  }
  // A sub task: its tick box, what it says, its menu, and its own sub tasks.
  function subHtml(g, u) {
    var tid = esc('st-' + g.id + '-' + u.id), done = isDone(u), title = goalTitle(u);
    return '<li class="gsub' + (done ? ' done' : '') + '" data-sub="' + esc(u.id) + '"><div class="row">' +
      '<input class="cb" type="checkbox" data-subcb="' + esc(u.id) + '" data-gid="' + esc(g.id) + '" aria-labelledby="' + tid + '"' + (done ? ' checked' : '') + '>' +
      '<div class="rb"><span class="t" id="' + tid + '">' + esc(title) + '</span>' + (u.subs ? doneCount(u) : '') +
      (u.note ? '<span class="gn">' + esc(u.note) + '</span>' : '') + '</div>' +
      '<button class="ib xs rowm" type="button" data-smenu="' + esc(u.id) + '" data-gid="' + esc(g.id) + '" data-menu="tmenu" aria-label="Sub task menu: ' + esc(title) + '" aria-haspopup="true" aria-expanded="false" title="More">' + I.dots + '</button>' +
      '</div>' + subsHtml(g, u) + '</li>';
  }
  // A box to type the next goal or sub task in: Enter adds it, and the box stays for another. close: with a button
  // that takes the box away (the one for sub tasks).
  function addFormHtml(attrs, label, hint, close) {
    return '<form class="qadd' + (close ? ' sadd' : '') + '"' + attrs + ' novalidate><div class="row-f">' +
      '<input class="inp" type="text" maxlength="' + TEXT_MAX + '" autocomplete="off" spellcheck="false" aria-label="' + esc(label) + '" placeholder="' + esc(hint) + '">' +
      '<button class="btn alt sm" type="submit">Add</button>' +
      (close ? '<button class="ib xs" type="button" data-saddx aria-label="Close" title="Close">' + I.x + '</button>' : '') +
      '</div><p class="err" role="alert" hidden></p></form>';
  }
  // One list: its bar (the name, done / all, the list menu), its goals, and the box for the next one. tally counts
  // what the line above the lists says.
  function listHtml(l, c, tally) {
    var shut = !!S.closed['todo:' + l.id], rows = order(l, c), done = 0;
    rows.forEach(function (r) { if (r.s.done) done++; });
    tally.goals += rows.length;
    tally.done += done;
    return '<h2 class="gh lh"><button class="ghb" type="button" data-group="' + esc(l.id) + '" aria-expanded="' + (shut ? 'false' : 'true') + '">' + I.chev +
      '<span class="n">' + esc(l.name) + '</span><span class="c">' + done + ' / ' + rows.length + '</span></button>' +
      '<button class="ib xs" type="button" data-lmenu="' + esc(l.id) + '" data-menu="tmenu" aria-label="List menu: ' + esc(l.name) + '" aria-haspopup="true" aria-expanded="false" title="List menu">' + I.dots + '</button></h2>' +
      '<ul class="todo" data-list="' + esc(l.id) + '"' + (shut ? ' hidden' : '') + '>' +
      (rows.length ? rows.map(function (r) { return goalHtml(r.g, r.s); }).join('') : '<li class="none">No goals here yet.</li>') +
      '<li class="addrow">' + addFormHtml(' data-qadd="' + esc(l.id) + '"', 'Add a goal to ' + l.name, 'Add a goal') + '</li></ul>';
  }
  // No lists yet: how to start. A goal needs a list, so the first thing to make is a list.
  function emptyHtml() {
    return '<p class="empty">Nothing on your list yet.</p>' +
      '<p class="para mid">Make your own lists, like <b>Today</b>, <b>Skilling goals</b> or <b>Gathering</b>, and put in what you want to get done.</p>' +
      '<ul class="plain start">' +
      '<li>Start with <b>New list</b>. Then type a goal in the box at its end, like <b>\u201c82 Thieving\u201d</b> or <b>\u201c500 Magic logs\u201d</b>.</li>' +
      '<li>A quest, an area task or a tier: <b>' + I.dots + ' \u2192 Add to list</b>.</li>' +
      '<li>Press <b>+ goal</b> next to a level you still miss.</li></ul>' +
      '<div class="newlist"><button class="btn" type="button" data-act="tnew">New list</button></div>';
  }
  // What the tab shows.
  function todoHtml() {
    var t = todo(), c = ctx(), tally = { goals: 0, done: 0 };
    resetDue();
    settleAll();
    lookUpWiki();
    if (!t.lists.length) return emptyHtml();
    var lists = t.lists.map(function (l) { return listHtml(l, c, tally); }).join('');
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
  function cssq(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  // Redraws the lists. The tick box or the box you were typing in keeps the focus (and what you typed); S.todoFocus
  // names what gets the focus instead.
  function drawTodo() {
    var a = document.activeElement, sel = S.todoFocus || '', val = '';
    S.todoFocus = '';
    if (!sel && a && a.getAttribute) {
      var f = a.closest('form.qadd');
      if (a.hasAttribute('data-gcb')) sel = '[data-gcb="' + cssq(a.getAttribute('data-gcb')) + '"]';
      else if (a.hasAttribute('data-subcb')) sel = '[data-subcb="' + cssq(a.getAttribute('data-subcb')) + '"][data-gid="' + cssq(a.getAttribute('data-gid')) + '"]';
      else if (f && a.tagName === 'INPUT') { sel = (f.hasAttribute('data-sadd') ? 'form.sadd' : 'form[data-qadd="' + cssq(f.getAttribute('data-qadd')) + '"]') + ' input'; val = a.value; }
    }
    A.drawList();
    var n = sel && document.querySelector(sel);
    if (!n) return;
    if (val) n.value = val;
    n.focus();
  }
  // After a change: the tab, the count on it, and the "Add to list" items and "+ goal" buttons on screen.
  function changed() {
    saveTodo();
    if (S.view === 'start' && S.set.home === 'todo') drawTodo(); else updateCount();
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
  // Undo: the lists as they were before a change.
  function undoer(snap) {
    return function () {
      S.todo = cleanTodo(JSON.parse(snap));
      saveTodo();
      refreshScreen();
    };
  }
  function startClock() {
    setInterval(function () {
      if (!resetDue()) return;
      if (S.view === 'start' && S.set.home === 'todo') drawTodo(); else updateCount();
    }, 60000);
  }

  // ---------- "Add to list" in the menus of a quest, a tier and an area task, and "+ goal" ----------
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
  // What is added, as the Add to list box says it: "Yoink! · Ardougne Easy".
  function whatHtml(r) {
    return '<b>' + esc(r.kind === 'skill' ? r.level + ' ' + skillName(skillKey(r.skill)) : r.kind === 'tier' ? r.title || r.area + ' ' + r.tname : r.title) + '</b>' +
      (r.kind === 'task' ? ' \u00b7 ' + esc(r.area + ' ' + r.tname) : '');
  }
  // The "Add to list" items in menus and the "+ goal" buttons on screen, after a change.
  function updateRefs() {
    arr(document.querySelectorAll('.mi[data-ref]')).forEach(function (b) {
      var r = refOf(b);
      b.insertAdjacentHTML('afterend', addToItemHtml(r.kind, r));
      b.parentNode.removeChild(b);
    });
    arr(document.querySelectorAll('[data-addgoal]')).forEach(function (b) {
      if (A.hasSkillGoal(b.getAttribute('data-addgoal'), b.getAttribute('data-level'))) b.parentNode.removeChild(b);
    });
  }

  // ---------- menus and boxes ----------
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
  function openDialog(state, html) {
    closeMenus();
    closeDialog();
    S.tdlg = state;
    app.insertAdjacentHTML('beforeend', '<div class="dlgbg" id="td"><form class="dlg form" id="td-form" role="dialog" aria-modal="true" aria-labelledby="td-h" novalidate>' + html + '</form></div>');
    var f = arr(byId('td-form').querySelectorAll('input[type="text"], textarea, select, button')).filter(function (x) { return x.offsetParent !== null; })[0];
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
  function segHtml(name, opts, v) {
    return '<div class="seg" role="group" aria-labelledby="tg-' + name + '-l" data-for="' + name + '">' + opts.map(function (o) {
      return '<button type="button" data-seg="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (o[0] === v) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  A.share({ addToItemHtml: addToItemHtml, closeTodoDialog: closeDialog, startTodoClock: startClock, taskMenuHtml: taskMenuHtml,
    toastAct: toastAct, todoCountHtml: countHtml, todoHtml: todoHtml, updateTodoCount: updateCount });
  T.buttonsHtml = buttonsHtml; T.changed = changed; T.closeDialog = closeDialog; T.dialogErr = dialogErr; T.drawTodo = drawTodo;
  T.errHtml = errHtml; T.fieldHtml = fieldHtml; T.mitem = mitem; T.openDialog = openDialog; T.openMenu = openMenu;
  T.pickerHtml = pickerHtml; T.refOf = refOf; T.segHtml = segHtml; T.tell = tell; T.undoer = undoer; T.whatHtml = whatHtml;
  A.loaded.todoView = true;
})(window.QuickGuideApp);
