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
    findSub = T.findSub, FIXED = T.FIXED, FULL_GOALS = T.FULL_GOALS, FULL_LISTS = T.FULL_LISTS, goalById = T.goalById, goalCount = T.goalCount,
    goalOfRef = T.goalOfRef, goalState = T.goalState, goalTitle = T.goalTitle, line = T.line, listById = T.listById, makeList = T.makeList,
    MAX_DEPTH = T.MAX_DEPTH, MAX_GOALS = T.MAX_GOALS, MAX_LISTS = T.MAX_LISTS, MAX_SUBS = T.MAX_SUBS, mitem = T.mitem, moveTo = T.moveTo,
    NAME_MAX = T.NAME_MAX, nameError = T.nameError, newId = T.newId, NOTE_MAX = T.NOTE_MAX, openDialog = T.openDialog, openMenu = T.openMenu,
    order = T.order, parseGoal = T.parseGoal, pickerHtml = T.pickerHtml, pickId = T.pickId, refIndex = T.refIndex, refKey = T.refKey,
    refOf = T.refOf, REPEATS = T.REPEATS, segHtml = T.segHtml, setDone = T.setDone, setSubs = T.setSubs, settleGoal = T.settleGoal,
    skillKey = T.skillKey, skillName = T.skillName, snapshot = T.snapshot, target = T.target, tell = T.tell, TEXT_MAX = T.TEXT_MAX,
    todo = T.todo, undoer = T.undoer, whatHtml = T.whatHtml;

  var REPEAT_SEG = [['', 'Never'], ['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']];
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
    (p.subs = p.subs || []).push({ id: newId('s'), title: cap1(text) });
    settleGoal(g);
    inp.value = '';
    changed();
  }

  // ---------- adding from elsewhere: a quest, a tier, an area task, a level ----------
  function itemMenu(btn) {
    var r = refOf(btn);
    openMenu(btn, 'item', refKey(r.kind, r), '<p class="mh">' + esc(r.title) + '</p>' + A.addToItemHtml(r.kind, r), 'Task menu');
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
    if (on) sub.u.done = 1; else delete sub.u.done;
    setSubs(sub.u, on);
    if (g.repeat) g.upd = Date.now();
    settleGoal(g, true);
    changed();
  }

  // ---------- the menus of a goal, a sub task and a list ----------
  function canShift(rows, i, d) { var j = i + d; return i >= 0 && j >= 0 && j < rows.length; }
  function goalMenu(btn) {
    var hit = goalById(btn.getAttribute('data-gmenu'));
    if (!hit) return;
    var g = hit.g, l = hit.l, rows = order(l, ctx()), i = rows.map(function (r) { return r.g; }).indexOf(g);
    var open = g.kind === 'quest' ? '<button class="mi" type="button" role="menuitem" data-quest="' + esc(g.title) + '">' + I.ext + 'Open the quest</button>' :
      FIXED[g.kind] ? '<button class="mi" type="button" role="menuitem" data-area="' + esc(g.area) + '" data-atier="' + esc(g.tier) + '">' + I.ext + 'Open ' + esc(g.kind === 'task' ? g.area + ' ' + g.tname : g.title) + '</button>' :
        g.kind === 'skill' ? '<a class="mi" role="menuitem" href="' + esc(QG.pageUrl(skillName(g.skill))) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on the wiki</a>' : '';
    var wiki = g.kind === 'other' && g.wiki ? wikiItem(g.wiki) : '';
    openMenu(btn, 'goal', g.id, '<p class="mh">' + esc(goalTitle(g)) + '</p>' + mitem('gedit', I.edit, 'Edit') + mitem('gsub', I.plus, 'Add sub task') +
      (g.kind === 'other' ? mitem('glist', I.list, 'Make it a list') : '') + open + wiki +
      '<hr><p class="mh">Move to</p>' + todo().lists.map(function (x) {
        return '<button class="mi" type="button" role="menuitemradio" aria-checked="' + (x === l) + '" data-tm="gmove" data-to="' + esc(x.id) + '">' +
          (x === l ? I.check : I.blank) + '<span class="ml">' + esc(x.name) + '</span></button>';
      }).join('') + mitem('gmovenew', I.plus, 'New list\u2026') +
      '<hr>' + mitem('gup', I.up, 'Move up', !canShift(rows, i, -1)) + mitem('gdown', I.down, 'Move down', !canShift(rows, i, 1)) +
      '<hr>' + mitem('gremove', I.x, 'Remove', false, 'danger'), 'Goal menu');
  }
  function wikiItem(page) {
    return '<a class="mi" role="menuitem" href="' + esc(QG.pageUrl(page)) + '" target="_blank" rel="noopener" data-act="wiki">' + I.ext + 'Open on the wiki</a>';
  }
  // The ⋯ of a sub task: edit it, give it its own sub tasks, its wiki page, move it, delete it.
  function subMenu(btn) {
    var gid = btn.getAttribute('data-gid'), sid = btn.getAttribute('data-smenu'), hit = goalById(gid), sub = hit && findSub(hit.g, sid);
    if (!sub) return;
    var u = sub.u, n = sub.p.subs.length;
    openMenu(btn, 'sub', gid + '/' + sid, '<p class="mh">' + esc(u.title) + '</p>' + mitem('sedit', I.edit, 'Edit') +
      mitem('sadd', I.plus, 'Add sub task', sub.depth >= MAX_DEPTH || (u.subs || []).length >= MAX_SUBS) + (u.wiki ? wikiItem(u.wiki) : '') +
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
    var done = l.items.filter(function (g) { return !g.repeat && goalState(g, c).done; }).length;
    openMenu(btn, 'list', l.id, '<p class="mh">' + esc(l.name) + '</p>' + mitem('ladd', I.plus, 'Add a goal here') + mitem('lrename', I.edit, 'Rename') +
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
      var c = cleanGoal({ kind: 'other', title: u.title, done: u.done, wiki: u.wiki, subs: u.subs });
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
    if (act === 'sedit') { subDialog(m.gid, m.sid); return; }
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
      else hit.l.items.splice(hit.l.items.indexOf(g) + 1, 0, cleanGoal({ kind: 'other', title: u.title, done: u.done, wiki: u.wiki, subs: u.subs }));
    } else if (act === 'sdelete') {
      p.subs.splice(i, 1);
      if (!p.subs.length) delete p.subs;
    }
    settleGoal(g);
    changed();
    if (act === 'sdelete') tell('Deleted <b>' + esc(u.title) + '</b>.', [['Undo', undoer(snap)]]);
  }
  function listAct(act, id, b) {
    var l = listById(id), t = todo(), snap = snapshot();
    if (!l) { closeMenus(); return; }
    var i = t.lists.indexOf(l);
    if (act === 'ladd') { goalDialog({ list: id }); return; }
    if (act === 'lrename') { listDialog('rename', id); return; }
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

  // ---------- the boxes: a new list, a name, a goal, a sub task ----------
  // mode "new" (move: a goal to put in the new list) or "rename".
  function listDialog(mode, id, move) {
    var t = todo(), l = listById(id);
    if (mode === 'new' && t.lists.length >= MAX_LISTS) { closeMenus(); toast(FULL_LISTS); return; }
    openDialog({ type: 'list', mode: mode, id: id || '', move: move || '' },
      '<h2 class="dh" id="td-h">' + (mode === 'new' ? 'New list' : 'Rename list') + '</h2>' +
      fieldHtml('tl-name', 'Name', mode === 'rename' && l ? l.name : '', NAME_MAX) +
      errHtml() + buttonsHtml(mode === 'new' ? 'Make list' : 'Rename'));
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
    if (!fixed) h += '<div class="fld"><span class="fl" id="tg-repeat-l">Repeat</span>' + segHtml('repeat', REPEAT_SEG, d.repeat) + '</div>';
    h += fieldHtml('tg-note', 'Note (optional)', d.note, NOTE_MAX);
    if (!st.edit) h += note('A quest, an area task or a tier? Its ' + I.dots + ' menu has Add to list.');
    return h + errHtml() + buttonsHtml(st.edit ? 'Save' : 'Add');
  }
  function readDraft(d) {
    ['text', 'list', 'note'].forEach(function (k) { var el = byId('tg-' + k); if (el) d[k] = el.value; });
  }
  // How often the goal repeats: the box shows the choice, and keeps what you typed.
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
      if (g.kind === 'other' && REPEATS[d.repeat]) g.repeat = d.repeat;
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
    // The goal keeps its ticks when it is the same kind, its sub tasks always, and its wiki page when it says the same.
    var old = hit.g, keep = old.kind === g.kind ? { done: old.done, upd: old.upd } : {};
    if (old.subs) keep.subs = old.subs;
    if (old.wiki !== undefined && g.kind === 'other' && g.title === old.title) keep.wiki = old.wiki;
    var ng = cleanGoal(copy(copy(copy({}, g), keep), { id: old.id, at: old.at }));
    hit.l.items[hit.l.items.indexOf(old)] = ng;
    if (l !== hit.l) moveTo(ng, hit.l, l);
    changed();
  }
  // "Edit" in a sub task's menu: a box with what it says.
  function subDialog(gid, sid) {
    var hit = goalById(gid), sub = hit && findSub(hit.g, sid);
    if (!sub) { closeMenus(); return; }
    openDialog({ type: 'sub', gid: gid, sid: sid }, '<h2 class="dh" id="td-h">Edit sub task</h2><p class="what"><b>' + esc(goalTitle(hit.g)) + '</b></p>' +
      fieldHtml('ts-text', 'Sub task', sub.u.title, TEXT_MAX) + errHtml() + buttonsHtml('Save'));
  }
  function submitSub(st) {
    var hit = goalById(st.gid), sub = hit && findSub(hit.g, st.sid), text = cap1(line(byId('ts-text').value));
    if (!text) { dialogErr('Type a sub task first.'); return; }
    closeDialog();
    if (!sub || sub.u.title === text) return;
    sub.u.title = text;
    delete sub.u.wiki;
    changed();
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
    else if (st && st.type === 'sub') submitSub(st);
    return true;
  }

  A.share({ addFromButton: addFromButton, addSkillGoal: addSkillGoal, addToPick: addToPick, closeSubAdd: closeSubAdd, goalMenu: goalMenu,
    itemMenu: itemMenu, listMenu: listMenu, menuAct: menuAct, newListDialog: function () { listDialog('new'); },
    pickSeg: pickSeg, subMenu: subMenu, tickGoal: tickGoal, tickSub: tickSub, todoSubmit: todoSubmit, unlist: unlist });
  A.loaded.todo = true;
})(window.QuickGuideApp);
