// The shape of the files in data/: what the wiki reader (js/wiki) gives, made into the JSON the app reads.
// Nothing here asks the wiki or touches a disk: tools/data/build.js does that. data/README.md says what the files hold.
//
// A file only changes when the wiki changed: there are no dates of the build in it. "added" is the day a quest, a task
// or an achievement was first seen by a build (the app says New by it); it is carried over from the file before.
'use strict';

const FORMAT = 1;

// A name as a file name and an id: "Cook's Assistant" -> "cooks-assistant".
function slug(s) {
  return String(s).toLowerCase().replace(/['’]/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// The files as text: two spaces, a line break at the end, so a change shows as a small diff.
function text(o) { return JSON.stringify(o, null, 2) + '\n'; }

// One quest in the index, from its row in the wiki's quest list (l), its place in the optimal order (0: none) and its
// guide (null when it could not be read: then it has no rev, and no file).
function questEntry(l, order, guide) {
  const e = { id: slug(l.t), title: l.t, members: !!l.m, difficulty: l.dif || '', length: l.len || '', age: l.age || '',
    combat: l.cb || '', qp: l.qp || 0, series: l.ser || '', release: l.rel || '' };
  if (order) e.order = order;
  if (l.mini) e.mini = true;
  if (guide) e.rev = guide.revid || 0;
  return e;
}
// A quest's guide as its file.
function questFile(id, q) {
  const o = { format: FORMAT, id, title: q.title, page: q.page, rev: q.revid || 0, mapVersion: q.mapVersion };
  if (q.notQuickGuide) o.notQuickGuide = true;
  return Object.assign(o, { overview: q.overview, items: { required: q.requiredItems, recommended: q.recommendedItems },
    sections: q.sections, rewards: q.rewards, music: q.music, achievements: q.achievements, requiredFor: q.requiredFor });
}
function areaFile(a) {
  return { format: FORMAT, id: slug(a.name), name: a.name, page: a.page, rev: a.revid || 0, tiers: a.tiers };
}
function capeFile(c) {
  return { format: FORMAT, id: c.key, name: c.name, page: c.page, rev: c.revid || 0, levels: c.levels, skiller: c.skiller,
    achievements: c.cheevos.map((x) => { const y = Object.assign({}, x, { category: x.cat }); delete y.cat; return y; }) };
}
// The index: every quest, area and cape, with what the lists of the app show. updated: the day the data last changed.
function indexFile(quests, areas, capes, updated) {
  return { format: FORMAT, updated,
    quests,
    areas: areas.map((a) => ({ id: a.id, name: a.name, rev: a.rev, tiers: a.tiers.map((t) => ({ id: t.id, name: t.name, tasks: t.tasks.length })) })),
    capes: capes.map((c) => ({ id: c.id, name: c.name, achievements: c.achievements.length, rev: c.rev })) };
}

// "added": what was in the list before keeps its day (or stays without one); what is new gets today. With no list
// before (the first build) nothing is new.
function carryAdded(before, now, today) {
  if (!before) return now;
  const had = new Map(before.map((x) => [x.id, x]));
  for (const x of now) {
    const o = had.get(x.id);
    if (!o) x.added = today; else if (o.added) x.added = o.added;
  }
  return now;
}
const tasksOf = (area) => [].concat(...area.tiers.map((t) => t.tasks));

// Everything a build read, as files: { "<path in data/>": text }, and what it found.
//   read: { list: [rows], order: [titles], guides: { title: guide or null }, areas: [area], capes: [cape] }
//   before: (path) => the parsed file that is there now, or null
//   today: "2026-11-22"
function build(read, before, today) {
  const files = {}, rank = {}, seen = {};
  read.order.forEach((t, i) => { if (rank[t] == null) rank[t] = i + 1; });
  const was = before('index.json');
  const quests = read.list.map((l) => {
    const g = read.guides[l.t] || null, e = questEntry(l, rank[l.t] || 0, g), path = 'quests/' + e.id + '.json';
    if (!e.id || seen[e.id]) throw new Error('Two quests would get the same file: ' + l.t + ' and ' + seen[e.id]);
    seen[e.id] = l.t;
    if (g) files[path] = text(questFile(e.id, g));
    else {
      // The guide could not be read this time: the one from before stays.
      const old = before(path);
      if (old) { files[path] = text(old); e.rev = old.rev; }
    }
    return e;
  });
  carryAdded(was && was.quests, quests, today);
  const areas = read.areas.map((a) => {
    const f = areaFile(a), old = before('achievements/areas/' + f.id + '.json');
    carryAdded(old && tasksOf(old), tasksOf(f), today);
    files['achievements/areas/' + f.id + '.json'] = text(f);
    return f;
  });
  const capes = read.capes.map((c) => {
    const f = capeFile(c), old = before('achievements/capes/' + f.id + '.json');
    carryAdded(old && old.achievements, f.achievements, today);
    files['achievements/capes/' + f.id + '.json'] = text(f);
    return f;
  });
  // The index says when the data last changed: today when a file is new, gone or different, else the day it said.
  const index = indexFile(quests, areas, capes, '');
  const same = !!was && text(Object.assign({}, was, { updated: '' })) === text(index) &&
    Object.keys(files).every((p) => { const o = before(p); return !!o && text(o) === files[p]; });
  index.updated = same ? was.updated : today;
  files['index.json'] = text(index);
  return files;
}

// What changed, in words, for the pull request: { lines: [...], changed: how many files }.
//   now: the files of build(); old: { path: text } of what was there (only the .json files).
function summary(now, old) {
  const name = (p) => p.replace(/^quests\//, 'quest ').replace(/^achievements\/areas\//, 'area ').replace(/^achievements\/capes\//, 'cape ').replace(/\.json$/, '');
  const added = [], changed = [], gone = [];
  for (const p of Object.keys(now)) {
    if (p === 'index.json') continue;
    if (!(p in old)) added.push(name(p)); else if (old[p] !== now[p]) changed.push(name(p));
  }
  for (const p of Object.keys(old)) if (p !== 'index.json' && !(p in now)) gone.push(name(p));
  const lines = [];
  const say = (label, list) => { if (list.length) lines.push('- **' + label + ' (' + list.length + '):** ' + list.slice(0, 40).join(', ') + (list.length > 40 ? ', …' : '')); };
  say('New', added);
  say('Changed', changed);
  say('Gone', gone);
  const n = added.length + changed.length + gone.length;
  if (!n && old['index.json'] !== now['index.json']) lines.push('- The lists changed (the quest list, the optimal order, or a count).');
  return { lines, changed: n + (old['index.json'] !== now['index.json'] ? 1 : 0) };
}

module.exports = { FORMAT, slug, text, questEntry, questFile, areaFile, capeFile, indexFile, carryAdded, build, summary };
