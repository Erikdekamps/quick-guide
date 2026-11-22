// Reads everything the app shows from the wiki, with the app's own reader (js/wiki), in a page of a browser: the
// reader needs a page to read the wiki's HTML. page: a page that has the files of js/wiki loaded (window.QuickGuide).
// Gives { list, order, guides: { title: guide or null }, areas, capes, failed: ["what: why"] }. (list also has the
// guides outside the quest lists, as rows with extra: true.)
// It asks a few pages at a time, like the app: about 400 requests in all.
'use strict';

// The files of the wiki reader, in the order they load. (The app itself only loads base.js, player.js and data.js.)
const READER = ['base', 'html', 'steps', 'guide', 'player', 'areas', 'capes', 'quests'].map((f) => 'js/wiki/' + f + '.js');

// Runs in the page.
function readAll(o) {
  const QG = window.QuickGuide, D = window.QuickGuideData, failed = [];
  const why = (e) => (e && (e.code || e.message)) || 'unknown';
  // The lists and the order are needed for everything else: when one fails, the build stops.
  return Promise.all([D.loadList(), D.loadMinis(), D.loadOrder()]).then(([list, minis, order]) => {
    const seen = {}, rows = list.quests.concat(minis.quests).filter((q) => (seen[q.t] ? false : (seen[q.t] = true)));
    const guides = {}, areas = [], capes = [];
    return QG.inTurns(rows, (q) => QG.load({ base: q.t, title: q.t + '/Quick guide' })
      .then((g) => { guides[q.t] = g; }, (e) => { guides[q.t] = null; failed.push('quest ' + q.t + ': ' + why(e)); }), o.parallel)
      .then(() => QG.inTurns(QG.AREAS, (a) => QG.loadArea(a.name).then((x) => { areas.push(x); }, (e) => { failed.push('area ' + a.name + ': ' + why(e)); }), o.parallel))
      // (a cape that misses its levels page, or what some achievements need, is not whole: it counts as not read)
      .then(() => QG.inTurns(QG.CAPES, (c) => QG.loadCape(c.key).then((x) => { if (x.partial) failed.push('cape ' + c.key + ': a part of it'); else capes.push(x); },
        (e) => { failed.push('cape ' + c.key + ': ' + why(e)); }), 1))
      // Guides outside the lists: a name a guide or an area shows as a quest you can open (a part of Recipe for
      // Disaster, say). The ones that have a Quick guide of their own come along, as rows with extra: true.
      .then(() => {
        const have = {}, names = [], found = [];
        rows.forEach((q) => { have[QG.normName(q.t)] = true; });
        const add = (n) => {
          const name = String(n || '').replace(/\s+/g, ' ').trim(), k = QG.normName(name);
          if (k && !have[k]) { have[k] = true; names.push(name); }
        };
        const links = (html) => Array.from(new window.DOMParser().parseFromString(String(html || ''), 'text/html').querySelectorAll('a')).forEach((x) => add(x.textContent));
        Object.keys(guides).forEach((t) => {
          const g = guides[t];
          if (!g) return;
          ((g.overview && g.overview.questReqs) || []).forEach((e) => add(e.text));
          (g.requiredFor || []).forEach((r) => (r.items || []).forEach(links));
        });
        areas.forEach((a) => a.tiers.forEach((t) => { (t.quests || []).forEach(add); (t.tasks || []).forEach((k) => (k.quests || []).forEach(add)); }));
        return QG.inTurns(names, (n) => QG.load({ base: n, title: n + '/Quick guide' }).then((g) => { if (!g.notQuickGuide) { guides[n] = g; found.push(n); } },
          (e) => { if (why(e) !== 'missingtitle') failed.push('quest ' + n + ': ' + why(e)); }), o.parallel)
          .then(() => { found.sort().forEach((n) => { rows.push({ t: n, extra: true }); }); });
      })
      .then(() => {
        // in the wiki's own order, whatever came back first
        areas.sort((a, b) => QG.AREAS.findIndex((x) => x.name === a.name) - QG.AREAS.findIndex((x) => x.name === b.name));
        return { list: rows, order: order.order, guides, areas, capes, failed, want: { areas: QG.AREAS.length, capes: QG.CAPES.length } };
      });
  });
}

function collect(page, o) {
  return page.evaluate(readAll, Object.assign({ parallel: 3 }, o));
}

module.exports = { READER, collect, readAll };
