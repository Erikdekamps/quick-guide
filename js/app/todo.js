/*!
 * Quick Guide - js/app/todo.js
 * My list: what you do with it. Typing a goal in the box at the end of a list, Add to list from a quest, a tier, an
 * area task or a level, ticking, sub tasks, and what the menus of a goal, a sub task and a list do (edit, move,
 * make a list of a goal, delete). todo-data.js has what is saved, todo-view.js what is drawn.
 */
(function (A) {
  'use strict';
  if (!A || !A.T || !A.loaded.todoView) return;
  var byId = A.byId, closeMenus = A.closeMenus, esc = A.esc, I = A.I, note = A.note, plural = A.plural, QG = A.QG, S = A.S, T = A.T, toast = A.toast;
  var addGoal = T.addGoal, buttonsHtml = T.buttonsHtml, cap1 = T.cap1, changed = T.changed, cleanGoal = T.cleanGoal, closeDialog = T.closeDialog,
    copy = T.copy, ctx = T.ctx, dialogErr = T.dialogErr, drawTodo = T.drawTodo, errHtml = T.errHtml, fieldHtml = T.fieldHtml,
    findSub = T.findSub, mark = T.mark, FIXED = T.FIXED, FULL_GOALS = T.FULL_GOALS, FULL_LISTS = T.FULL_LISTS, goalById = T.goalById, goalCount = T.goalCount,
    goalOfRef = T.goalOfRef, goalState = T.goalState, goalTitle = T.goalTitle, line = T.line, listById = T.listById, listText = T.listText, makeList = T.makeList,
    MAX_DEPTH = T.MAX_DEPTH, MAX_GOALS = T.MAX_GOALS, MAX_LISTS = T.MAX_LISTS, MAX_SUBS = T.MAX_SUBS, mitem = T.mitem, moveTo = T.moveTo,
    NAME_MAX = T.NAME_MAX, nameError = T.nameError, newId = T.newId, NOTE_MAX = T.NOTE_MAX, openDialog = T.openDialog, openMenu = T.openMenu,
    order = T.order, parseGoal = T.parseGoal, parseOutline = T.parseOutline, pickerHtml = T.pickerHtml, pickId = T.pickId, refIndex = T.refIndex, refKey = T.refKey,
    refOf = T.refOf, setDone = T.setDone, setSubs = T.setSubs, settleGoal = T.settleGoal,
    skillKey = T.skillKey, skillName = T.skillName, snapshot = T.snapshot, tell = T.tell, TEXT_MAX = T.TEXT_MAX,
    todo = T.todo, undoer = T.undoer, whatHtml = T.whatHtml;

  var FULL_SUBS = 'A goal has at most 20 sub tasks.';

  // ---------- adding: the box at the end of a list, and the one under a goal for its sub tasks ----------
  function formErr(form, msg) {
    var e = form.querySelector('.err'), inp = form.querySelector('input');
    if (e) { e.textContent = msg; e.hidden = !msg; }
    if (inp) inp.focus();
  }
  // What you typed at the end of a list becomes a goal there, and the box is ready for the next one.
  function quickAdd(form) {
    var inp = form.querySelector('input'), g = parseGoal(inp.value);
    if (!g) { formErr(form, 'Type a goal first.'); return; }
    if (goalCount() >= MAX_GOALS) { toast(FULL_GOALS); return; }
    var l = listById(form.getAttribute('data-qadd'));
    if (!l) return;
    addGoal(g, l);
    inp.value = '';
    changed();
  }
  // "Add sub task" in a menu: the box opens under the goal (pid '') or the sub task (pid).
  function openSubAdd(gid, pid) {
    closeMenus();
    S.subAdd = { gid: gid, pid: pid || '' };
    S.todoFocus = 'form.sadd input';
    drawTodo();
  }
  function closeSubAdd() {
    if (!S.subAdd) return;
    S.subAdd = null;
    if (S.view === 'start' && S.set.home === 'todo') drawTodo();
  }
  function quickSub(form) {
    var hit = goalById(form.getAttribute('data-sadd')), g = hit && hit.g, pid = form.getAttribute('data-pid');
    var sub = g && pid ? findSub(g, pid) : null, p = pid ? sub && sub.u : g, inp = form.querySelector('input'), text = line(inp.value);
    if (!p) { closeSubAdd(); return; }
    if (!text) { formErr(form, 'Type a sub task first.'); return; }
    if ((p.subs || []).length >= MAX_SUBS) { closeSubAdd(); toast(FULL_SUBS); return; }
    // A level ("82 thieving") ticks itself, like in a list; anything else is a sub task as you typed it.
    var typed = parseGoal(text);
    (p.subs = p.subs || []).push(typed.kind === 'skill' ? copy({ id: newId('s') }, typed) : { id: newId('s'), title: cap1(text) });
    settleGoal(g);
    inp.value = '';
    changed();
  }

  // ---------- adding from elsewhere: a quest, a tier, an area task, an achievement, a level ----------
  // The menu of an area task or an achievement: Add to list (or Remove from it); an achievement also has its wiki page.
  function itemMenu(btn) {
    var r = refOf(btn), cheevo = r.kind === 'cheevo';
    openMenu(btn, 'item', refKey(r.kind, r), '<p class="mh">' + esc(r.title) + '</p>' + A.addToItemHtml(r.kind, r) + (cheevo ? wikiItem(r.page || r.title) : ''),
      cheevo ? 'Achievement menu' : 'Task menu');
  }
  // The Add to list box: which list it goes in, or a new one.
  function addToDialog(r) {
    if (goalCount() >= MAX_GOALS) { closeMenus(); toast(FULL_GOALS); return; }
    var none = !todo().lists.length;
    openDialog({ type: 'addto', ref: r }, '<h2 class="dh" id="td-h">Add to list</h2><p class="what">' + whatHtml(r) + '</p>' +
      '<div class="fld"><label for="ta-list">List</label><select class="sel" id="ta-list">' + pickerHtml('', '<option value="+"' + (none ? ' selected' : '') + '>New list\u2026</option>') + '</select></div>' +
      '<div class="fld" id="ta-new"' + (none ? '' : ' hidden') + '><label for="ta-name">Name of the new list</label>' +
      '<input class="inp" id="ta-name" type="text" maxlength="' + NAME_MAX + '" autocomplete="off" value="' + (none ? 'My list' : '') + '"></div>' +
      '<div class="fld" id="ta-where"' + (none ? ' hidden' : '') + '><label for="ta-parent">Parent</label><select class="sel" id="ta-parent">' + parentsHtml(listById(pickId())) + '</select></div>' +
      errHtml() + buttonsHtml('Add'));
  }
  // How many levels a goal or sub task takes: 1, or more with what is under it.
  function height(x) { return 1 + (x.subs || []).reduce(function (m, u) { return Math.max(m, height(u)); }, 0); }
  // The parents a goal or sub task can have in a list: none, or a goal or sub task of the list ("g:<goal>" or
  // "s:<goal>/<sub task>") that has room and is not too deep. A sub task is shown with a dash for each level.
  // sel: the one that is picked; skip: the goal or sub task itself (not under itself or what is under it).
  function parentsHtml(l, sel, skip) {
    var h = '<option value="">None</option>', tall = skip ? height(skip) : 1;
    function opt(v, depth, x) {
      if ((x.subs || []).length >= MAX_SUBS && v !== sel) return;
      h += '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + new Array(depth + 1).join('\u2014 ') + esc(goalTitle(x)) + '</option>';
    }
    (l ? l.items : []).forEach(function (g) {
      if (g === skip) return;
      opt('g:' + g.id, 0, g);
      (function walk(p, depth) {
        (p.subs || []).forEach(function (u) {
          if (u === skip || depth + tall > MAX_DEPTH) return;
          opt('s:' + g.id + '/' + u.id, depth, u);
          walk(u, depth + 1);
        });
      })(g, 1);
    });
    return h;
  }
  // What a picked parent is: { top (its goal), p (the goal or sub task itself), depth }, or null for none.
  function parentOf(value) {
    var m = /^([gs]):([^/]*)(?:\/(.*))?$/.exec(value || ''), top = m && goalById(m[2]);
    if (!top) return null;
    if (m[1] === 'g') return { top: top.g, p: top.g, depth: 0 };
    var hit = findSub(top.g, m[3]);
    return hit ? { top: top.g, p: hit.u, depth: hit.depth } : null;
  }
  // A goal or sub task as a sub task, depth levels under its goal: without what only a goal has.
  function asSub(x, depth) {
    var u = cleanGoal(copy(copy({ kind: 'other' }, x), { id: x.id || newId('s') }), depth);
    delete u.at;
    if (u.kind === 'other') delete u.kind;
    return u;
  }
  // Puts it under a parent, at the end. False when the parent is full.
  function putUnder(x, par) {
    if ((par.p.subs || []).length >= MAX_SUBS) return false;
    (par.p.subs = par.p.subs || []).push(asSub(x, par.depth + 1));
    return true;
  }
  // "New list…" picked in the box: the name field shows.
  function addToPick(sel) {
    var f = byId('ta-new'), inp = byId('ta-name'), e = byId('td-err');
    if (e) e.hidden = true;
    if (!f) return;
    f.hidden = sel.value !== '+';
    // The places are those of the list that is picked; a new list has none yet.
    byId('ta-where').hidden = !f.hidden;
    byId('ta-parent').innerHTML = parentsHtml(listById(sel.value));
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
    var par = sel.value === '+' ? null : parentOf(byId('ta-parent').value);
    closeDialog();
    // Under a parent it is a sub task there, and still the quest, tier, task or level it stands for.
    if (par) { if (!putUnder(goalOfRef(st.ref), par)) { toast(FULL_SUBS); return; } settleGoal(par.top); }
    else addGoal(goalOfRef(st.ref), l);
    changed();
    tell('Added to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function addFromButton(b) { closeMenus(); addToDialog(refOf(b)); }
  // "Remove from …" in a menu.
  function unlist(b) {
    var r = refOf(b), hit = refIndex()[refKey(r.kind, r)], snap = snapshot();
    closeMenus();
    if (!hit) return;
    if (hit.p) {
      hit.p.subs.splice(hit.p.subs.indexOf(hit.g), 1);
      if (!hit.p.subs.length) delete hit.p.subs;
      settleGoal(hit.top);
    } else hit.l.items.splice(hit.l.items.indexOf(hit.g), 1);
    changed();
    tell('Removed from <b>' + esc(hit.l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  // "+ goal" next to a level you do not have: the Add to list box for it.
  function addSkillGoal(b) {
    var k = skillKey(b.getAttribute('data-addgoal'));
    if (k) addToDialog({ kind: 'skill', skill: k, level: +b.getAttribute('data-level') });
  }

  // ---------- ticking ----------
  // A goal ticked by hand: its sub tasks go with it.
  function tickGoal(id, on) {
    var hit = goalById(id);
    if (!hit) return;
    setDone(hit.g, on);
    setSubs(hit.g, on);
    changed();
  }
  // A sub task ticked: what is under it goes with it, and what is above it is done when all under it are.
  function tickSub(gid, sid, on) {
    var hit = goalById(gid), g = hit && hit.g, sub = g && findSub(g, sid);
    if (!sub) return;
    mark(sub.u, on);
    setSubs(sub.u, on);
    settleGoal(g, true);
    changed();
  }

  // ---------- the menus of a goal, a sub task and a list ----------
  function canShift(rows, i, d) { var j = i + d; return i >= 0 && j >= 0 && j < rows.length; }
  function goalMenu(btn) {
    var hit = goalById(btn.getAttribute('data-gmenu'));
    if (!hit) return;
    var g = hit.g, l = hit.l, rows = order(l, ctx()), i = rows.map(function (r) { return r.g; }).indexOf(g);
    openMenu(btn, 'goal', g.id, '<p class="mh">' + esc(goalTitle(g)) + '</p>' + mitem('gedit', I.edit, 'Edit') + mitem('gsub', I.plus, 'Add sub task') +
      (g.kind === 'other' ? mitem('glist', I.list, 'Make it a list') : '') + openItem(g) +
      '<hr><p class="mh">Move to</p>' + todo().lists.map(function (x) {
        return '<button class="mi" type="button" role="menuitemradio" aria-checked="' + (x === l) + '" data-tm="gmove" data-to="' + esc(x.id) + '">' +
          (x === l ? I.check : I.blank) + '<span class="ml">' + esc(x.name) + '</span></button>';
      }).join('') + mitem('gmovenew', I.plus, 'New list\u2026') +
      '<hr>' + mitem('gup', I.up, 'Move up', !canShift(rows, i, -1)) + mitem('gdown', I.down, 'Move down', !canShift(rows, i, 1)) +
      '<hr>' + mitem('gremove', I.x, 'Remove', false, 'danger'), 'Goal menu');
  }
  // The way to what a goal or a sub task is about: its quest, its area, its cape, or its page on the wiki.
  function openItem(g) {
    return g.kind === 'quest' ? '<button class="mi" type="button" role="menuitem" data-quest="' + esc(g.title) + '">' + I.ext + 'Open the quest</button>' :
      g.kind === 'cheevo' ? '<button class="mi" type="button" role="menuitem" data-cape="' + esc(g.cape) + '">' + I.ext + 'Open ' + esc(T.capeTitle(g.cape)) + '</button>' +
        wikiItem(g.page || g.title) :
      FIXED[g.kind] ? '<button class="mi" type="button" role="menuitem" data-area="' + esc(g.area) + '" data-atier="' + esc(g.tier) + '">' + I.ext + 'Open ' + esc(g.kind === 'task' ? g.area + ' ' + g.tname : g.title) + '</button>' :
        g.kind === 'skill' ? wikiItem(skillName(g.skill)) : g.wiki ? wikiItem(g.wiki) : '';
  }
  function wikiItem(page) {
    return '<a class="mi" role="menuitem" href="' + esc(QG.pageUrl(page)) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on the wiki</a>';
  }
  // The ⋯ of a sub task: edit it, give it its own sub tasks, its wiki page, move it, delete it.
  function subMenu(btn) {
    var gid = btn.getAttribute('data-gid'), sid = btn.getAttribute('data-smenu'), hit = goalById(gid), sub = hit && findSub(hit.g, sid);
    if (!sub) return;
    var u = sub.u, n = sub.p.subs.length;
    openMenu(btn, 'sub', gid + '/' + sid, '<p class="mh">' + esc(goalTitle(u)) + '</p>' + mitem('sedit', I.edit, 'Edit') +
      mitem('sadd', I.plus, 'Add sub task', sub.depth >= MAX_DEPTH || (u.subs || []).length >= MAX_SUBS) + openItem(u) +
      '<hr>' + mitem('sup', I.up, 'Move up', sub.i === 0) + mitem('sdown', I.down, 'Move down', sub.i === n - 1) +
      mitem('sout', I.out, sub.depth === 1 ? 'Make it a goal' : 'Move out a level') +
      '<hr>' + mitem('sdelete', I.x, 'Delete', false, 'danger'), 'Sub task menu');
    // (Nothing to keep when the click closed the menu.)
    if (S.tmenu) { S.tmenu.gid = gid; S.tmenu.sid = sid; }
  }
  function listMenu(btn) {
    var l = listById(btn.getAttribute('data-lmenu'));
    if (!l) return;
    var t = todo(), i = t.lists.indexOf(l), c = ctx();
    var done = l.items.filter(function (g) { return goalState(g, c).done; }).length;
    openMenu(btn, 'list', l.id, '<p class="mh">' + esc(l.name) + '</p>' + mitem('ladd', I.plus, 'Add a goal here') +
      mitem('lpaste', I.paste, 'Paste a list\u2026') + mitem('lcopy', I.copy, 'Copy as text\u2026', !l.items.length) + mitem('lrename', I.edit, 'Rename') +
      '<hr>' + mitem('lup', I.up, 'Move list up', i === 0) + mitem('ldown', I.down, 'Move list down', i === t.lists.length - 1) +
      '<hr>' + mitem('lclear', I.check, 'Clear done goals (' + done + ')', !done) + mitem('ldelete', I.x, 'Delete list', false, 'danger'), 'List menu');
  }
  function menuAct(b) {
    var m = S.tmenu, act = b.getAttribute('data-tm');
    if (!m) return;
    if (m.kind === 'list') listAct(act, m.id, b); else if (m.kind === 'sub') subAct(act, m, b); else goalAct(act, m.id, b);
  }
  // The second click on a "Delete" within 4 seconds deletes. The first one makes the item ask for it.
  function armed(b, ask) {
    if (S.delArmed && Date.now() - S.delArmed < 4000) return true;
    S.delArmed = Date.now();
    b.querySelector('.ml').textContent = ask;
    return false;
  }
  function goalAct(act, id, b) {
    var hit = goalById(id);
    if (!hit) { closeMenus(); return; }
    var g = hit.g, l = hit.l, snap = snapshot();
    if (act === 'gedit') { goalDialog({ edit: id }); return; }
    if (act === 'gsub') {
      if ((g.subs || []).length >= MAX_SUBS) { closeMenus(); toast(FULL_SUBS); } else openSubAdd(id, '');
      return;
    }
    if (act === 'gmovenew') { listDialog('new', '', id); return; }
    closeMenus();
    if (act === 'glist') { goalToList(g, l); return; }
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
  // A name for a new list that is not taken: "Today", then "Today 2", "Today 3".
  function freeName(name) {
    var out = name, n = 2;
    while (nameError(out)) out = name.slice(0, NAME_MAX - 3).trim() + ' ' + n++;
    return out;
  }
  // "Make it a list": a new list with the goal's name, right after the list it was in. Its sub tasks are the goals.
  function goalToList(g, l) {
    var t = todo(), snap = snapshot();
    if (t.lists.length >= MAX_LISTS) { toast(FULL_LISTS); return; }
    var nl = { id: newId('l'), name: freeName(line(goalTitle(g), NAME_MAX)), items: [] };
    (g.subs || []).forEach(function (u) {
      var c = cleanGoal(copy({ kind: 'other' }, u));
      if (c) nl.items.push(c);
    });
    l.items.splice(l.items.indexOf(g), 1);
    t.lists.splice(t.lists.indexOf(l) + 1, 0, nl);
    changed();
    tell('Made the list <b>' + esc(nl.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function subAct(act, m, b) {
    var hit = goalById(m.gid), g = hit && hit.g, sub = g && findSub(g, m.sid), snap = snapshot();
    if (!sub) { closeMenus(); return; }
    var u = sub.u, p = sub.p, i = sub.i;
    if (act === 'sedit') { goalDialog({ edit: m.gid, sid: m.sid }); return; }
    if (act === 'sadd') { openSubAdd(m.gid, m.sid); return; }
    if (act === 'sdelete' && !armed(b, 'Click again to delete')) return;
    closeMenus();
    if (act === 'sup' || act === 'sdown') {
      var j = i + (act === 'sup' ? -1 : 1);
      if (j < 0 || j >= p.subs.length) return;
      p.subs[i] = p.subs[j];
      p.subs[j] = u;
    } else if (act === 'sout') {
      // Out one level: a goal of the list right after its goal, or a sub task right after the one it was under.
      var up = p === g ? null : findSub(g, p.id);
      if (!up && goalCount() >= MAX_GOALS) { toast(FULL_GOALS); return; }
      if (up && up.p.subs.length >= MAX_SUBS) { toast(FULL_SUBS); return; }
      p.subs.splice(i, 1);
      if (!p.subs.length) delete p.subs;
      if (up) up.p.subs.splice(up.i + 1, 0, u);
      else hit.l.items.splice(hit.l.items.indexOf(g) + 1, 0, cleanGoal(copy({ kind: 'other' }, u)));
    } else if (act === 'sdelete') {
      p.subs.splice(i, 1);
      if (!p.subs.length) delete p.subs;
    }
    settleGoal(g);
    changed();
    if (act === 'sdelete') tell('Deleted <b>' + esc(goalTitle(u)) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function listAct(act, id, b) {
    var l = listById(id), t = todo(), snap = snapshot();
    if (!l) { closeMenus(); return; }
    var i = t.lists.indexOf(l);
    if (act === 'ladd') { goalDialog({ list: id }); return; }
    if (act === 'lrename') { listDialog('rename', id); return; }
    if (act === 'lpaste') { pasteDialog(id, ''); return; }
    if (act === 'lcopy') { copyDialog(l); return; }
    // A list with goals in it takes two clicks to delete.
    if (act === 'ldelete' && l.items.length && !armed(b, 'Click again to delete the list')) return;
    closeMenus();
    if (act === 'lup' || act === 'ldown') {
      var j = i + (act === 'lup' ? -1 : 1);
      if (j < 0 || j >= t.lists.length) return;
      t.lists[i] = t.lists[j];
      t.lists[j] = l;
      changed();
    } else if (act === 'lclear') {
      var c = ctx(), gone = l.items.filter(function (g) { return goalState(g, c).done; });
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

  // ---------- the boxes: a new list, a name, a goal, a sub task ----------
  // mode "new" (move: a goal to put in the new list) or "rename".
  function listDialog(mode, id, move) {
    var t = todo(), l = listById(id);
    if (mode === 'new' && t.lists.length >= MAX_LISTS) { closeMenus(); toast(FULL_LISTS); return; }
    openDialog({ type: 'list', mode: mode, id: id || '', move: move || '' },
      '<h2 class="dh" id="td-h">' + (mode === 'new' ? 'Create list' : 'Rename list') + '</h2>' +
      fieldHtml('tl-name', 'Name', mode === 'rename' && l ? l.name : '', NAME_MAX) +
      errHtml() + buttonsHtml(mode === 'new' ? 'Create' : 'Rename'));
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
  // "Add a goal" (o.list: the list it goes in), "Edit goal" (o.edit: the goal) and "Edit sub task" (o.edit and
  // o.sid). The box has what it says, its list, its parent (none for a goal), and a note.
  function goalDialog(o) {
    var hit = o.edit ? goalById(o.edit) : null, sub = hit && o.sid ? findSub(hit.g, o.sid) : null;
    if (o.sid && !sub) { closeMenus(); return; }
    if (!hit && goalCount() >= MAX_GOALS) { closeMenus(); toast(FULL_GOALS); return; }
    var x = sub ? sub.u : hit ? hit.g : null;
    var parent = !sub ? '' : sub.p === hit.g ? 'g:' + hit.g.id : 's:' + hit.g.id + '/' + sub.p.id;
    var st = { type: 'goal', edit: o.edit || '', sid: o.sid || '', g: x, from: parent,
      d: { text: x ? goalTitle(x) : '', list: hit ? hit.l.id : o.list || pickId(), parent: parent, note: (x && x.note) || '' } };
    openDialog(st, goalFormHtml(st));
  }
  function goalFormHtml(st) {
    var d = st.d, fixed = !!st.g && FIXED[st.g.kind];
    var h = '<h2 class="dh" id="td-h">' + (st.sid ? 'Edit sub task' : st.edit ? 'Edit goal' : 'Add a goal') + '</h2>';
    h += fixed ? '<p class="what">' + whatHtml({ kind: st.g.kind, title: st.g.title, area: st.g.area, tname: st.g.tname || '', cape: st.g.cape }) + '</p>' :
      fieldHtml('tg-text', st.sid ? 'Sub task' : 'Goal', d.text, TEXT_MAX, 'Like 82 Thieving, or Buy a cape');
    h += '<div class="fld"><label for="tg-list">List</label><select class="sel" id="tg-list">' + pickerHtml(d.list) + '</select></div>';
    h += '<div class="fld"><label for="tg-parent">Parent</label><select class="sel" id="tg-parent">' + parentsHtml(listById(d.list), d.parent, st.g) + '</select></div>';
    h += fieldHtml('tg-note', 'Note (optional)', d.note, NOTE_MAX);
    if (!st.edit) h += note('A quest, an area task, a tier or an achievement? Its ' + I.dots + ' menu has Add to list.');
    return h + errHtml() + buttonsHtml(st.edit ? 'Save' : 'Add');
  }
  function readDraft(d) {
    ['text', 'list', 'parent', 'note'].forEach(function (k) { var el = byId('tg-' + k); if (el) d[k] = el.value; });
  }
  // The box again after a choice in it, with what you typed. focus: what gets the cursor.
  function redrawGoal(st, focus) {
    var f = byId('td-form');
    f.innerHTML = goalFormHtml(st);
    var el = f.querySelector(focus);
    if (el) el.focus();
  }
  // Another list or parent picked in the box: the parents are those of the list.
  function pickPlace(sel) {
    var st = S.tdlg;
    readDraft(st.d);
    if (sel.id === 'tg-list') st.d.parent = '';
    redrawGoal(st, '#' + sel.id);
  }
  function submitGoal(st) {
    var d = st.d, g, old = st.g;
    readDraft(d);
    if (old && FIXED[old.kind]) g = copy({}, old);
    else {
      g = parseGoal(d.text);
      if (!g) { dialogErr(st.sid ? 'Type a sub task first.' : 'Type a goal first.'); return; }
    }
    delete g.note;
    if (line(d.note, NOTE_MAX)) g.note = line(d.note, NOTE_MAX);
    var l = listById(d.list), par = parentOf(d.parent), snap = snapshot(), hit = st.edit ? goalById(st.edit) : null;
    var sub = hit && st.sid ? findSub(hit.g, st.sid) : null;
    closeDialog();
    if (st.edit && (!hit || (st.sid && !sub))) return;
    if (old) {
      // It keeps its ticks when it is the same kind, its sub tasks always, and its wiki page when it says the same.
      if (old.kind === g.kind || (!old.kind && g.kind === 'other')) g.done = old.done;
      if (old.subs) g.subs = old.subs;
      if (old.wiki !== undefined && g.kind === 'other' && g.title === old.title) g.wiki = old.wiki;
      g.id = old.id;
      g.at = old.at;
    }
    var stays = !!old && l === hit.l && d.parent === st.from;
    if (!stays && !par && (!old || sub) && goalCount() >= MAX_GOALS) { toast(FULL_GOALS); return; }
    if (!stays && par && (par.p.subs || []).length >= MAX_SUBS) { toast(FULL_SUBS); return; }
    if (stays && sub) {
      // A sub task that stays where it is: the same place under its parent.
      sub.p.subs[sub.i] = asSub(g, sub.depth);
    } else if (stays) hit.l.items[hit.l.items.indexOf(old)] = cleanGoal(g);
    else {
      // Out of where it was, and to the end of where it goes.
      if (sub) { sub.p.subs.splice(sub.i, 1); if (!sub.p.subs.length) delete sub.p.subs; }
      else if (old) hit.l.items.splice(hit.l.items.indexOf(old), 1);
      if (par) putUnder(g, par);
      else { l.items.push(cleanGoal(copy({ id: newId('g'), at: Date.now() }, g))); todo().last = l.id; }
    }
    if (hit) settleGoal(hit.g);
    if (par) settleGoal(par.top);
    changed();
    if (!old) tell('Added to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  // ---------- a list as text: "Paste a list" and "Copy as text" ----------
  var PASTE_HINT = 'One goal on each line. Indent a line to put it under the one above.';
  var PASTE_SAMPLE = '- Hatchet of bloom and blight\n  - Hatchet of ember and glade\n    - [x] Crystal hatchet\n- 82 Thieving\n- Vis wax';
  // What the box reads in its text: "6 goals and 5 sub tasks.", and what does not fit.
  function pasteSays(r) {
    if (!r.goals.length && !r.left) return PASTE_HINT;
    return (r.goals.length ? plural(r.goals.length, 'goal', 'goals') + (r.subs ? ' and ' + plural(r.subs, 'sub task', 'sub tasks') : '') + '.' : '') +
      (r.left ? ' ' + (r.left === 1 ? '1 line does not fit and is' : r.left + ' lines do not fit and are') + ' left out.' : '');
  }
  function readPaste() { return parseOutline(byId('tp-text').value, MAX_GOALS - goalCount()); }
  // "Paste a list…" in a list's menu (and more than one line pasted in the box at the end of a list): a box for
  // the text, which says what it reads while you type.
  // "Import list" (no id): the same box, with a name for the new list the goals go in.
  function pasteDialog(id, text) {
    var l = id ? listById(id) : null;
    if (id && !l) return;
    if (!l && todo().lists.length >= MAX_LISTS) { closeMenus(); toast(FULL_LISTS); return; }
    if (goalCount() >= MAX_GOALS) { closeMenus(); toast(FULL_GOALS); return; }
    openDialog({ type: 'paste', list: id || '' }, '<h2 class="dh" id="td-h">' + (l ? 'Paste a list' : 'Import list') + '</h2>' +
      (l ? '<p class="what"><b>' + esc(l.name) + '</b></p>' : fieldHtml('tl-name', 'Name', '', NAME_MAX)) +
      '<textarea class="inp tx" id="tp-text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Goals, one on each line" placeholder="' + esc(PASTE_SAMPLE) + '">' + esc(text) + '</textarea>' +
      '<p class="what" id="tp-count" aria-live="polite">' + PASTE_HINT + '</p>' + errHtml() + buttonsHtml(l ? 'Add' : 'Import'));
    pasteCount();
  }
  function pasteCount() {
    var c = byId('tp-count'), e = byId('td-err');
    if (!c || S.tdlg.type !== 'paste') return;
    c.textContent = pasteSays(readPaste());
    if (e) e.hidden = true;
  }
  function submitPaste(st) {
    var l = st.list ? listById(st.list) : null, r = readPaste(), snap = snapshot(), now = Date.now(), name = '';
    if (!st.list) {
      var inp = byId('tl-name'), err;
      name = line(inp ? inp.value : '', NAME_MAX);
      err = nameError(name);
      if (err) { dialogErr(err); return; }
    }
    if (!r.goals.length) { dialogErr('Type or paste a list first.'); return; }
    closeDialog();
    if (!st.list) { if (todo().lists.length >= MAX_LISTS) { toast(FULL_LISTS); return; } l = makeList(name); }
    if (!l) return;
    r.goals.forEach(function (g) {
      if (g.done) g.done = now;
      settleGoal(addGoal(g, l), true);
    });
    changed();
    tell('Added ' + plural(r.goals.length, 'goal', 'goals') + ' to <b>' + esc(l.name) + '</b>.', [['Undo', undoer(snap)]]);
  }
  // "Copy as text…" in a list's menu: the list the way "Paste a list" reads it, to copy.
  function copyDialog(l) {
    openDialog({ type: 'copy' }, '<h2 class="dh" id="td-h">' + esc(l.name) + ' as text</h2>' +
      '<textarea class="inp tx" id="tp-text" spellcheck="false" readonly aria-label="The list as text">' + esc(listText(l)) + '</textarea>' +
      '<div class="dbtn"><button class="btn" type="submit">Copy</button><button class="btn alt" type="button" data-tdx>Close</button></div>');
  }
  // The boxes you type in send their forms here. True when the form was one of them.
  function todoSubmit(form) {
    if (form.classList.contains('sadd')) { quickSub(form); return true; }
    if (form.classList.contains('qadd')) { quickAdd(form); return true; }
    if (form.id !== 'td-form') return false;
    var st = S.tdlg;
    if (st && st.type === 'list') submitList(st);
    else if (st && st.type === 'goal') submitGoal(st);
    else if (st && st.type === 'addto') submitAddTo(st);
    else if (st && st.type === 'paste') submitPaste(st);
    else if (st && st.type === 'copy') A.copyText(byId('tp-text'));
    return true;
  }

  A.share({ addFromButton: addFromButton, addSkillGoal: addSkillGoal, addToPick: addToPick, closeSubAdd: closeSubAdd, goalMenu: goalMenu,
    itemMenu: itemMenu, listMenu: listMenu, menuAct: menuAct, newListDialog: function () { listDialog('new'); }, importListDialog: function () { pasteDialog('', ''); }, pasteCount: pasteCount, pasteDialog: pasteDialog,
    pickPlace: pickPlace, subMenu: subMenu, tickGoal: tickGoal, tickSub: tickSub, todoSubmit: todoSubmit, unlist: unlist });
  A.loaded.todo = true;
})(window.QuickGuideApp);
