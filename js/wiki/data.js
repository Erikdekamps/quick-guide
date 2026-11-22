/*!
 * Quick Guide - js/wiki/data.js
 * Where the app gets the quests, area tasks and capes: the JSON files in data/, next to the app. A build makes them
 * from the RuneScape Wiki every night (tools/data), so a player's browser does not ask the wiki for them.
 * This file gives the app what the wiki reader gave it before: the quest lists, a guide, an area, a cape, and what
 * changed since it last looked.
 * The text in data/ belongs to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var AREA_VERSION = W.AREA_VERSION, CAPE_VERSION = W.CAPE_VERSION, VERSION = W.VERSION, capeOf = W.capeOf, coded = W.coded,
    getJson = W.getJson, normName = W.normName, pageUrl = W.pageUrl;

  // The folder of the data, next to index.html, and the shape of its files this app can read (FORMAT in tools/data/shape.js).
  var DATA = 'data/', FORMAT = 1;
  // The index is asked for once for the lists that start together, and again after this long (ms). When you ask to
  // read something again, an index that is a few seconds old will do (an update reads many pages in a row).
  var INDEX_KEEP = 60000, AGAIN_KEEP = 5000;

  // One file of the data. mark: the file's hash from the index, so the browser never gives an old copy.
  function read(path, mark) {
    return getJson(DATA + path + (mark ? '?h=' + encodeURIComponent(mark) : '')).then(function (r) {
      if (r.status === 404) throw coded('missingtitle', 'The app has no data for this yet.');
      if (!r.ok) throw coded('http', 'The app\'s data answered with error ' + r.status + '.');
      if (!r.json || typeof r.json !== 'object') throw coded('format', 'The app\'s data could not be read.');
      if (r.json.format > FORMAT) throw coded('format', 'The app\'s data is newer than the app. Reload the page.');
      return r.json;
    }, function (e) {
      // no answer at all, or none in time: said as the data's, not the wiki's
      if (e && e.code === 'timeout') throw coded('slow', 'The app\'s data took too long to come.');
      if (e instanceof TypeError) throw coded('offline', 'Could not reach the app\'s data.');
      throw e;
    });
  }
  var indexAsk = null, indexAt = 0;
  // The index: every quest, area and cape. keep: how old (ms) the last answer may be; 0: ask again, whatever was asked.
  function loadIndex(keep) {
    if (indexAsk && Date.now() - indexAt < (keep == null ? INDEX_KEEP : keep)) return indexAsk;
    indexAt = Date.now();
    var ask = indexAsk = read('index.json').then(function (ix) {
      if (!Array.isArray(ix.quests) || !Array.isArray(ix.areas) || !Array.isArray(ix.capes)) throw coded('format', 'The app\'s data could not be read.');
      return ix;
    });
    // one that failed is not kept: the next ask tries again
    ask.then(null, function () { if (indexAsk === ask) indexAsk = null; });
    return ask;
  }
  // Looks something up in the index. When it is not there (or has no file yet), the index is asked for once more: a
  // build may have brought it since.
  // again: you asked to read it again, so the index must be new.
  function find(pick, again) {
    return loadIndex(again ? AGAIN_KEEP : null).then(function (ix) {
      var e = pick(ix);
      if (e && e.hash) return e;
      return loadIndex(0).then(pick);
    });
  }
  // "added" in the data (the day a build first saw it) is when it was new, for the app's New.
  function withNew(x, o) {
    var at = x.added ? Date.parse(x.added) : 0;
    if (at) o.newAt = at;
    return o;
  }

  // ---------- the quest lists ----------
  // A quest of the index as a row of the app's list.
  function row(e) {
    var q = { t: e.title, m: !!e.members, len: e.length, age: e.age, dif: e.difficulty, cb: e.combat, qp: e.qp, ser: e.series, rel: e.release };
    if (e.mini) q.mini = true;
    return withNew(e, q);
  }
  function loadList() {
    return loadIndex().then(function (ix) {
      var quests = ix.quests.filter(function (e) { return !e.mini && !e.extra; }).map(row);
      if (quests.length < 5) throw coded('format', 'Could not read the quest list.');
      return { at: Date.now(), quests: quests };
    });
  }
  function loadMinis() {
    return loadIndex().then(function (ix) {
      return { at: Date.now(), quests: ix.quests.filter(function (e) { return e.mini && !e.extra; }).map(row) };
    });
  }
  function loadOrder() {
    return loadIndex().then(function (ix) {
      var order = ix.quests.filter(function (e) { return e.order; }).sort(function (a, b) { return a.order - b.order; }).map(function (e) { return e.title; });
      if (order.length < 5) throw coded('format', 'Could not read the optimal order.');
      return { at: Date.now(), order: order };
    });
  }

  // ---------- a guide, an area, a cape ----------
  function now() { return new Date().toISOString(); }
  function questEntry(ix, title) {
    var n = normName(title);
    return ix.quests.filter(function (e) { return normName(e.title) === n; })[0] || null;
  }
  // t = { base: 'X' } (the quest's name). A quest the wiki has no guide for has no file. (The index also has the
  // guides of parts of a quest that are not in the quest list, like those of Recipe for Disaster: "extra".)
  function load(t, again) {
    return find(function (ix) { return questEntry(ix, t.base); }, again).then(function (e) {
      if (!e || !e.hash) throw coded('missingtitle', 'The wiki has no page for this quest yet.');
      return read('quests/' + e.id + '.json', e.hash).then(function (f) {
        if (!Array.isArray(f.sections) || !f.page || !f.items) throw coded('format', 'The app\'s data could not be read.');
        return { version: VERSION, page: f.page, title: f.title, source: pageUrl(f.page), fetchedAt: now(), revid: f.rev || 0, hash: e.hash,
          notQuickGuide: !!f.notQuickGuide, mapVersion: f.mapVersion, overview: f.overview,
          requiredItems: f.items.required, recommendedItems: f.items.recommended, sections: f.sections, rewards: f.rewards,
          music: f.music, achievements: f.achievements, requiredFor: f.requiredFor };
      });
    });
  }
  function loadArea(name, again) {
    return find(function (ix) { return ix.areas.filter(function (a) { return a.name === name; })[0]; }, again).then(function (e) {
      if (!e) throw coded('missingtitle', 'The app has no data for this area yet.');
      return read('achievements/areas/' + e.id + '.json', e.hash).then(function (f) {
        if (!Array.isArray(f.tiers) || !f.tiers.length) throw coded('format', 'The app\'s data could not be read.');
        f.tiers.forEach(function (t) { t.tasks = t.tasks.map(function (x) { var o = withNew(x, x); delete o.added; return o; }); });
        return { version: AREA_VERSION, name: f.name, page: f.page, source: pageUrl(f.page), fetchedAt: now(), tiers: f.tiers, revid: f.rev || 0, hash: e.hash };
      });
    });
  }
  // old: the cape as it was saved, when it is read again.
  function loadCape(key, old) {
    if (!capeOf(key)) return Promise.reject(coded('format', 'There is no such cape.'));
    return find(function (ix) { return ix.capes.filter(function (c) { return c.id === key; })[0]; }, !!old).then(function (e) {
      if (!e) throw coded('missingtitle', 'The app has no data for this cape yet.');
      return read('achievements/capes/' + e.id + '.json', e.hash).then(function (f) {
        if (!Array.isArray(f.achievements) || !f.achievements.length) throw coded('format', 'The app\'s data could not be read.');
        return { version: CAPE_VERSION, key: key, name: f.name, page: f.page, source: pageUrl(f.page), fetchedAt: now(),
          cheevos: f.achievements.map(function (x) { var o = withNew(x, x); o.cat = o.category; delete o.category; delete o.added; return o; }),
          levels: f.levels || [], skiller: f.skiller || [], revid: f.rev || 0, hash: e.hash };
      });
    });
  }

  // ---------- what changed ----------
  // For Update: the mark of each of these pages as the data has it now: { "<wiki page>": { hash, rev } or
  // { missing: true } }. The index is asked for again. A page the data does not know is left out.
  function pageInfo(titles) {
    return loadIndex(0).then(function (ix) {
      var out = {};
      titles.forEach(function (t) {
        var area = /^(.*) achievements$/.exec(t), a = area && ix.areas.filter(function (x) { return x.name === area[1]; })[0];
        var c = ix.capes.filter(function (x) { var info = capeOf(x.id); return !!info && info.page === t; })[0];
        var q = a || c ? null : questEntry(ix, t.replace(/\/\s*quick guide$/i, ''));
        var e = a || c || q;
        if (e) out[t] = e.hash ? { hash: e.hash, rev: e.rev || 0 } : { missing: true };
      });
      return out;
    }, function () { return {}; });
  }

  W.publish({ load: load, loadArea: loadArea, loadCape: loadCape, pageInfo: pageInfo });
  window.QuickGuideData = { loadList: loadList, loadMinis: loadMinis, loadOrder: loadOrder };
  W.loaded.data = true;
})(window.QuickGuideWiki);
