// Reads everything the app shows from the wiki, with the app's own reader (js/wiki), in a page of a browser: the
// reader needs a page to read the wiki's HTML. page: a page that has the files of js/wiki loaded (window.QuickGuide).
// Gives { list, order, guides: { title: guide or null }, areas, capes, failed: ["what: why"] }.
// It asks a few pages at a time, like the app: about 400 requests in all.
'use strict';

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
      .then(() => QG.inTurns(QG.CAPES, (c) => QG.loadCape(c.key).then((x) => { capes.push(x); }, (e) => { failed.push('cape ' + c.key + ': ' + why(e)); }), 1))
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

module.exports = { collect, readAll };
