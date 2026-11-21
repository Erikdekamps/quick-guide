/*!
 * Quick Guide - js/app/update.js
 * Update from the wiki: everything the app keeps, at once, so new quests, tasks and achievements come in together.
 * The quest lists are read again. For the quest guides you opened, the areas and the capes, the app first asks the wiki
 * when each page last changed (50 pages a request), then reads again only those that changed. Your ticks stay; what is
 * new says "New" for a while. Settings has the button; once a week it runs by itself, quietly.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var byId = A.byId, dateText = A.dateText, esc = A.esc, loadError = A.loadError, metaAll = A.metaAll, plural = A.plural,
    QG = A.QG, S = A.S, sget = A.sget, sset = A.sset, toast = A.toast;
  var UPDATE_MAX_AGE = 7 * 24 * 3600 * 1000, READ_PARALLEL = 3;

  // ---------- what the app keeps ----------
  // [{ kind: 'quest' | 'area' | 'cape', key, title (its page on the wiki), old (the saved copy) }]
  function keptPages() {
    var out = [];
    Object.keys(metaAll()).forEach(function (k) {
      var q = sget('quest.' + k);
      if (q && q.sections && q.page) out.push({ kind: 'quest', key: k, title: q.page, old: q });
    });
    QG.AREAS.forEach(function (a) {
      var x = sget('area.' + a.name);
      if (x && x.tiers && x.page) out.push({ kind: 'area', key: a.name, title: x.page, old: x });
    });
    QG.CAPES.forEach(function (c) {
      var x = A.savedCape(c.key);
      if (x && x.page) out.push({ kind: 'cape', key: c.key, title: x.page, old: x });
    });
    return out;
  }
  function newer(a, b) { return (Date.parse(a) || 0) > (Date.parse(b) || 0); }
  // Did a page change since the app read it? A quest guide: when it was edited (its revision). An area or a cape list:
  // when anything on it changed (their tables come from templates, so a new task does not edit the page itself); a
  // cape also when one of its achievements' pages was edited. Unknown (the wiki did not say): read it. A page the wiki
  // does not have any more: keep what we have.
  function changed(p, info) {
    var i = info[p.title];
    if (!i) return true;
    if (i.missing) return false;
    if (p.kind === 'quest') return p.old.revid ? i.rev !== p.old.revid : newer(i.edited, p.old.fetchedAt);
    if (newer(i.touched, p.old.fetchedAt)) return true;
    return p.kind === 'cape' && p.old.cheevos.some(function (x) { var j = info[x.page]; return !j || (!j.missing && j.rev !== x.rev); });
  }

  // ---------- what it found ----------
  // { quests, tasks, cheevos: how many are new; guides: quest guides read again; failed: pages it could not read }
  function foundText(f) {
    var bits = [];
    if (f.cheevos) bits.push(plural(f.cheevos, 'new achievement', 'new achievements'));
    if (f.tasks) bits.push(plural(f.tasks, 'new task', 'new tasks'));
    if (f.quests) bits.push(plural(f.quests, 'new quest', 'new quests'));
    if (f.guides) bits.push(plural(f.guides, 'quest guide', 'quest guides') + ' changed');
    var last = bits.pop();
    return last ? (bits.length ? bits.join(', ') + ' and ' : '') + last : '';
  }
  function lastUpdate() { var u = sget('upd'); return u && typeof u === 'object' && u.at ? u : null; }
  // The line under the button in Settings.
  function updateText() {
    var u = S.upd;
    if (u && u.step === 'check') return 'Checking ' + plural(u.total, 'page', 'pages') + ' on the wiki…';
    if (u) return 'Reading what changed… ' + u.done + ' / ' + u.total;
    var l = lastUpdate();
    if (!l) return 'Reads again what changed: the quest lists, the guides you opened, the areas and the capes. It checks by itself once a week.';
    var f = foundText(l.found || {});
    return 'Checked ' + dateText(new Date(l.at).toISOString()) + ': ' + (f || 'nothing new') + '.' +
      (l.failed ? ' Could not read ' + plural(l.failed, 'page', 'pages') + '.' : '') + ' It checks by itself once a week.';
  }
  function showStatus() {
    var el = byId('upd-msg'), b = document.querySelector('[data-act="update-all"]');
    if (el) el.textContent = updateText();
    if (b) b.disabled = !!S.upd;
  }

  // ---------- the update ----------
  // Reads one changed page again, and counts what is new in it.
  function readAgain(p, info, found) {
    if (p.kind === 'quest') return A.reloadQuest(p.key, p.old).then(function () { found.guides++; });
    if (p.kind === 'area') return A.reloadArea(p.key, p.old).then(function (n) { found.tasks += n; });
    return A.reloadCape(p.key, p.old, info).then(function (n) { found.cheevos += n; });
  }
  // quiet: the weekly run (no messages unless something is new; the quest lists keep their own schedule).
  function updateAll(quiet) {
    if (S.upd) return Promise.resolve();
    var found = { quests: 0, tasks: 0, cheevos: 0, guides: 0 }, failed = 0, listErr = null;
    var pages = keptPages(), titles = [];
    pages.forEach(function (p) {
      if (titles.indexOf(p.title) < 0) titles.push(p.title);
      if (p.kind === 'cape') p.old.cheevos.forEach(function (x) { if (x.page && titles.indexOf(x.page) < 0) titles.push(x.page); });
    });
    S.upd = { step: 'check', done: 0, total: titles.length };
    if (!quiet) toast('Checking the wiki…', 0);
    showStatus();
    var lists = quiet ? Promise.resolve() : Promise.all([A.fetchList(true), A.fetchMinis(), S.order || S.set.sort === 'opt' ? A.fetchOrder(true) : null]).then(function (r) {
      if (r[0] && r[0].error) listErr = r[0].error;
      found.quests += ((r[0] && r[0].added) || 0) + ((r[1] && r[1].added) || 0);
    });
    var reached = true;
    var rest = QG.pageInfo(titles).then(function (info) {
      // The wiki did not answer at all: nothing is read again (it would be everything).
      if (titles.length && !Object.keys(info).length) { reached = false; failed = pages.length; return; }
      var todo = pages.filter(function (p) { return changed(p, info); });
      S.upd = { step: 'read', done: 0, total: todo.length };
      showStatus();
      return QG.inTurns(todo, function (p) {
        return readAgain(p, info, found).then(null, function () { failed++; }).then(function () { S.upd.done++; showStatus(); });
      }, READ_PARALLEL);
    });
    return Promise.all([lists, rest]).then(function () {
      S.upd = null;
      // A run that could not reach the wiki is tried again at the next start.
      if (reached) sset('upd', { at: Date.now(), found: found, failed: failed });
      showStatus();
      if (S.view === 'start') A.drawList();
      var what = foundText(found), msg = what ? 'Updated: ' + what + '.' : '';
      if (failed) msg = (msg ? msg + ' ' : '') + 'Could not read ' + plural(failed, 'page', 'pages') + '.';
      if (quiet) { if (what) toast('New on the wiki: ' + what + '.', 5000); return; }
      if (listErr) toast('Could not update the quest list. ' + loadError(listErr), 5000);
      else if (!reached) toast('Could not reach the wiki. Try again in a moment.', 5000);
      else toast(msg || 'Everything is up to date.', msg ? 5000 : undefined);
    }).then(null, function () {
      // something went wrong on the way: the button works again
      S.upd = null;
      showStatus();
    });
  }
  // At the start: once a week, quietly, when the app keeps anything.
  function autoUpdate() {
    var l = lastUpdate();
    if (l && Date.now() - l.at < UPDATE_MAX_AGE) return;
    if (!keptPages().length) return;
    updateAll(true);
  }

  A.share({ autoUpdate: autoUpdate, updateAll: updateAll, updateText: updateText });
  A.loaded.update = true;
})(window.QuickGuideApp);
