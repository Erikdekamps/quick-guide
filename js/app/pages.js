/*!
 * Quick Guide - js/app/pages.js
 * What an area and a cape share: they open from storage at once (or from the wiki), fold their parts, reset, and
 * are read again from the wiki, with what is new marked New.
 */
(function (A) {
  'use strict';
  if (!A) return;
  var loadError = A.loadError, plural = A.plural, renderStart = A.renderStart, S = A.S, showSaved = A.showSaved, sset = A.sset,
    stillWanted = A.stillWanted, toast = A.toast, waitFor = A.waitFor;

  // Opens a page the app keeps. o: { key (in storage, like "area.Ardougne"), saved (what is saved, or null), version
  // (the one the wiki reader makes now), label (what the start screen says it waits for), load () (reads it from the
  // wiki), show (page), refresh (quiet) }. A saved page opens at once; one saved by another version is read again
  // quietly, and if that fails the saved one stays. A page that is not saved is read first.
  function openPage(o) {
    S.error = '';
    if (o.saved) {
      if (showSaved(o.key, function () { o.show(o.saved); }) && o.saved.version !== o.version) o.refresh(true);
      return;
    }
    var mine = waitFor(o.label);
    renderStart();
    o.load().then(function (p) {
      sset(o.key, p);
      // You went on to another screen: the page is saved, and opens at once when you ask for it again.
      if (!stillWanted(mine)) return;
      S.loading = false;
      S.input = '';
      showSaved(o.key, function () { o.show(p); });
    }, function (e) {
      if (!stillWanted(mine)) return;
      S.loading = false;
      S.error = loadError(e);
      renderStart();
    });
  }
  // The screen of a page: what is on it (view), and what opens again after a reload (last).
  function enterPage(view, last) {
    S.view = view;
    S.resetArmed = 0;
    sset('last', last);
  }
  // A part that folds open and shut, by its button: where it is kept (prog.open[key]), and save, to keep it.
  function togglePart(btn, prog, key, save) {
    var open = !(btn && btn.getAttribute('aria-expanded') === 'true');
    prog.open = prog.open || {};
    prog.open[key] = open;
    save();
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var body = btn.parentNode.nextElementSibling;
      if (body) body.hidden = !open;
    }
  }
  // Reset progress takes two clicks within 4 seconds. reset: what it does then.
  function resetTwice(btn, reset) {
    if (S.resetArmed && Date.now() - S.resetArmed < 4000) {
      S.resetArmed = 0;
      reset();
      toast('Progress reset.');
      return;
    }
    S.resetArmed = Date.now();
    btn.querySelector('span').textContent = 'Click again to reset';
  }
  // A page read again: what was not in it before (by id) is New. What was there keeps when it was new. Gives how many
  // are new (none when there was nothing before).
  function markNew(old, fresh) {
    var had = {}, n = 0, now = Date.now();
    if (!old) return 0;
    old.forEach(function (x) { had[x.id] = x; });
    fresh.forEach(function (x) {
      var o = had[x.id];
      if (!o) { x.newAt = now; n++; } else if (o.newAt) x.newAt = o.newAt;
    });
    return n;
  }
  // Reads a saved page again and keeps it. o: { key, load (), items (page) (its tasks or achievements, for New), old
  // (the saved one), kept (page) (more to do with it once saved), here () (is it open: on screen, or under Settings),
  // use (page) (the open one gets it), draw () (draws it again, when it is still on screen) }. Gives how many are new.
  function reloadPage(o) {
    return o.load().then(function (p) {
      var added = markNew(o.old && o.items(o.old), o.items(p));
      sset(o.key, p);
      if (o.kept) o.kept(p);
      if (o.here()) {
        o.use(p);
        A.redrawWhenFree(o.draw);
      }
      return added;
    });
  }
  // Refresh from wiki, from a page's menu: reload () reads it again; view: the screen it is on; one, many: what is new.
  function refreshPage(silent, reload, view, one, many) {
    if (!silent) toast('Reading the wiki…', 0);
    reload().then(function (n) {
      if (!silent && S.view === view) toast('Updated from the wiki' + (n ? ': ' + plural(n, one, many) : '') + '.');
    }, function (e) { if (!silent) toast('Could not update. ' + loadError(e)); });
  }

  A.share({ enterPage: enterPage, markNew: markNew, openPage: openPage, refreshPage: refreshPage, reloadPage: reloadPage,
    resetTwice: resetTwice, togglePart: togglePart });
  A.loaded.pages = true;
})(window.QuickGuideApp);
