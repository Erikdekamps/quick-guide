// The data files (data/): how a build makes them from what the wiki reader gives (tools/data/shape.js), and that the
// files in this project are what the app can read. The nightly build runs this file before it opens a pull request.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const S = require('../../tools/data/shape');
const { filesNow, write } = require('../../tools/data/build');

const ROOT = path.resolve(__dirname, '..', '..');
const row = (t, more) => Object.assign({ t, m: true, len: 'Short', age: 'Fifth Age', dif: 'Novice', cb: 'None', qp: 1, ser: 'N/A', rel: '4 January 2001' }, more);
const guide = (title, rev) => ({ version: 4, page: title + '/Quick guide', title, source: 'https://runescape.wiki/w/x', fetchedAt: '2026-11-22T07:00:00Z', revid: rev,
  notQuickGuide: false, mapVersion: '2026-10-12-a', overview: { startPoint: 'Here' }, requiredItems: { note: '', items: [{ id: 'req:a', html: 'An egg' }] },
  recommendedItems: { note: '', items: [] }, sections: [{ id: 'walkthrough', title: 'Walkthrough', blocks: [{ type: 'step', id: 'walkthrough:1', html: 'Go.' }] }],
  rewards: { items: [] }, music: [], achievements: [], requiredFor: [] });
const area = (name, tasks) => ({ version: 5, name, page: name + ' achievements', source: 'x', fetchedAt: 'y', revid: 7, tiers: [{ id: 'easy', name: 'Easy', tasks: tasks.map((id) => ({ id, name: 'Task ' + id })) }] });
const cape = (key, ids) => ({ version: 2, key, name: 'Cape ' + key, page: 'Cape (achievement)', source: 'x', fetchedAt: 'y', revid: 9, levels: [], skiller: [],
  cheevos: ids.map((id) => ({ id, name: 'A ' + id, cat: 'Lore', sub: 'Books' })) });
// What a build read: two quests (one a miniquest), an area and a cape.
const read = (o) => Object.assign({
  list: [row("Cook's Assistant", { m: false }), row('Bar Crawl (miniquest)', { mini: true })],
  order: ['Bar Crawl (miniquest)', "Cook's Assistant"],
  guides: { "Cook's Assistant": guide("Cook's Assistant", 100), 'Bar Crawl (miniquest)': guide('Bar Crawl (miniquest)', 200) },
  areas: [area('Ardougne', ['448', '449'])], capes: [cape('mqc', ['2111'])]
}, o);
const none = () => null;
const from = (files) => (p) => (files[p] ? JSON.parse(files[p]) : null);

test.describe('the names of the files', () => {
  test('a quest, an area: small letters and dashes, no accents, no apostrophes', () => {
    expect(["Cook's Assistant", 'Bar Crawl (miniquest)', "Seers' Village", 'Recipe for Disaster: Freeing King Awowogei', 'Café  crème', '’Phite Club'].map(S.slug))
      .toEqual(['cooks-assistant', 'bar-crawl-miniquest', 'seers-village', 'recipe-for-disaster-freeing-king-awowogei', 'cafe-creme', 'phite-club']);
  });

  test('two quests that would get the same file stop the build', () => {
    expect(() => S.build(read({ list: [row('Rune Mysteries'), row('Rune mysteries!')] }), none, '2026-11-22')).toThrow('Two quests would get the same file: Rune mysteries! and Rune Mysteries');
  });
});

test.describe('a build', () => {
  test('makes the index, a file for each guide, area and cape, and nothing else', () => {
    const files = S.build(read(), none, '2026-11-22');
    expect(Object.keys(files).sort()).toEqual(['achievements/areas/ardougne.json', 'achievements/capes/mqc.json', 'index.json', 'quests/bar-crawl-miniquest.json', 'quests/cooks-assistant.json']);
    expect(JSON.parse(files['index.json'])).toEqual({
      format: 1, updated: '2026-11-22',
      quests: [
        { id: 'cooks-assistant', title: "Cook's Assistant", members: false, difficulty: 'Novice', length: 'Short', age: 'Fifth Age', combat: 'None', qp: 1, series: 'N/A', release: '4 January 2001', order: 2, rev: 100 },
        { id: 'bar-crawl-miniquest', title: 'Bar Crawl (miniquest)', members: true, difficulty: 'Novice', length: 'Short', age: 'Fifth Age', combat: 'None', qp: 1, series: 'N/A', release: '4 January 2001', order: 1, mini: true, rev: 200 }
      ],
      areas: [{ id: 'ardougne', name: 'Ardougne', rev: 7, tiers: [{ id: 'easy', name: 'Easy', tasks: 2 }] }],
      capes: [{ id: 'mqc', name: 'Cape mqc', achievements: 1, rev: 9 }]
    });
  });

  test('a guide: its page and revision, its items and parts; nothing that changes with every build', () => {
    const q = JSON.parse(S.build(read(), none, '2026-11-22')['quests/cooks-assistant.json']);
    expect(Object.keys(q)).toEqual(['format', 'id', 'title', 'page', 'rev', 'mapVersion', 'overview', 'items', 'sections', 'rewards', 'music', 'achievements', 'requiredFor']);
    expect(q).toMatchObject({ format: 1, id: 'cooks-assistant', page: "Cook's Assistant/Quick guide", rev: 100, items: { required: { items: [{ id: 'req:a', html: 'An egg' }] } } });
    expect(q.sections[0].blocks[0].id).toBe('walkthrough:1');
    // a guide read from the quest's own page says so
    const own = S.questFile('x', Object.assign(guide('X', 1), { notQuickGuide: true }));
    expect(own.notQuickGuide).toBe(true);
  });

  test('an area and a cape: the reader\'s tiers and achievements, a cape\'s "cat" as "category"', () => {
    const files = S.build(read(), none, '2026-11-22');
    expect(JSON.parse(files['achievements/areas/ardougne.json'])).toEqual({ format: 1, id: 'ardougne', name: 'Ardougne', page: 'Ardougne achievements', rev: 7,
      tiers: [{ id: 'easy', name: 'Easy', tasks: [{ id: '448', name: 'Task 448' }, { id: '449', name: 'Task 449' }] }] });
    expect(JSON.parse(files['achievements/capes/mqc.json']).achievements).toEqual([{ id: '2111', name: 'A 2111', sub: 'Books', category: 'Lore' }]);
  });

  test('the same wiki gives the same files, on any day: no pull request for nothing', () => {
    const first = S.build(read(), none, '2026-11-22');
    expect(S.build(read(), from(first), '2026-12-25')).toEqual(first);
    expect(S.summary(first, first)).toEqual({ lines: [], changed: 0 });
  });

  test('a guide that could not be read keeps its file from before; a new quest without a guide has no file', () => {
    const first = S.build(read(), none, '2026-11-22');
    const guides = { "Cook's Assistant": null, 'Bar Crawl (miniquest)': guide('Bar Crawl (miniquest)', 200), 'Brand New': null };
    const next = S.build(read({ list: read().list.concat([row('Brand New')]), guides }), from(first), '2026-11-23');
    expect(next['quests/cooks-assistant.json']).toBe(first['quests/cooks-assistant.json']);
    expect(next['quests/brand-new.json']).toBeUndefined();
    const ix = JSON.parse(next['index.json']);
    expect(ix.quests.map((q) => [q.id, q.rev, q.added])).toEqual([['cooks-assistant', 100, undefined], ['bar-crawl-miniquest', 200, undefined], ['brand-new', undefined, '2026-11-23']]);
    expect(ix.updated).toBe('2026-11-23');
  });
});

test.describe('what is new', () => {
  test('the first build marks nothing; later, a new quest, task or achievement gets the day it was first seen, and keeps it', () => {
    const first = S.build(read(), none, '2026-11-22');
    expect(first['index.json'] + first['achievements/areas/ardougne.json'] + first['achievements/capes/mqc.json']).not.toContain('"added"');
    const more = read({ list: read().list.concat([row('Brand New')]), guides: Object.assign({}, read().guides, { 'Brand New': guide('Brand New', 300) }),
      areas: [area('Ardougne', ['448', '449', '450'])], capes: [cape('mqc', ['2111', '9999'])] });
    const second = S.build(more, from(first), '2026-11-23');
    expect(JSON.parse(second['index.json']).quests.map((q) => q.added)).toEqual([undefined, undefined, '2026-11-23']);
    expect(JSON.parse(second['achievements/areas/ardougne.json']).tiers[0].tasks.map((t) => t.added)).toEqual([undefined, undefined, '2026-11-23']);
    expect(JSON.parse(second['achievements/capes/mqc.json']).achievements.map((t) => t.added)).toEqual([undefined, '2026-11-23']);
    // a week later: the day stays
    const third = S.build(more, from(second), '2026-11-30');
    expect(third).toEqual(second);
  });

  test('what changed, in words, for the pull request', () => {
    const first = S.build(read(), none, '2026-11-22');
    const next = S.build(read({ list: [row("Cook's Assistant", { m: false }), row('Brand New')], order: [],
      guides: { "Cook's Assistant": guide("Cook's Assistant", 101), 'Brand New': guide('Brand New', 300) } }), from(first), '2026-11-23');
    expect(S.summary(next, first)).toEqual({ changed: 4, lines: ['- **New (1):** quest brand-new', '- **Changed (1):** quest cooks-assistant', '- **Gone (1):** quest bar-crawl-miniquest'] });
    // only the order changed: no file but the index
    const order = S.build(read({ order: ["Cook's Assistant"] }), from(first), '2026-11-23');
    expect(S.summary(order, first)).toEqual({ changed: 1, lines: ['- The lists changed (the quest list, the optimal order, or a count).'] });
    // a long list is cut off
    const many = {};
    for (let i = 0; i < 45; i++) many['quests/q' + i + '.json'] = '{}';
    expect(S.summary(many, {}).lines[0]).toMatch(/^- \*\*New \(45\):\*\* quest q0, .*quest q39, …$/);
  });
});

test.describe('writing the files', () => {
  test('only what changed is written, and what is gone is removed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-data-'));
    expect(filesNow(path.join(dir, 'nothing'))).toEqual({});
    expect(write(dir, { 'index.json': '{}\n', 'quests/a.json': '{"a":1}\n', 'quests/b.json': '{}\n' }, {})).toBe(3);
    fs.writeFileSync(path.join(dir, 'README.md'), 'not data');
    const old = filesNow(dir);
    expect(Object.keys(old).sort()).toEqual(['index.json', 'quests/a.json', 'quests/b.json']);
    const at = fs.statSync(path.join(dir, 'index.json')).mtimeMs;
    expect(write(dir, { 'index.json': '{}\n', 'quests/a.json': '{"a":2}\n' }, old)).toBe(2);
    expect(filesNow(dir)).toEqual({ 'index.json': '{}\n', 'quests/a.json': '{"a":2}\n' });
    expect(fs.statSync(path.join(dir, 'index.json')).mtimeMs).toBe(at);
    expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
  });
});

// The files in this project. A build that breaks one of these fails here, before its pull request is opened.
test.describe('this project: data/', () => {
  const files = filesNow(path.join(ROOT, 'data'));
  const json = (p) => JSON.parse(files[p]);
  const index = json('index.json');
  const twice = (list) => list.filter((x, i) => list.indexOf(x) !== i);

  test('every file is JSON the way a build writes it, and of this format', () => {
    for (const [p, text] of Object.entries(files)) {
      expect(S.text(JSON.parse(text)) === text, p + ' is written by the build').toBe(true);
      expect(JSON.parse(text).format, p).toBe(S.FORMAT);
    }
  });

  test('the index: every quest, the 13 areas and the 3 capes, each once', () => {
    expect(index.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(index.quests.length).toBeGreaterThan(300);
    expect(twice(index.quests.map((q) => q.id))).toEqual([]);
    expect(twice(index.quests.map((q) => q.title))).toEqual([]);
    for (const q of index.quests) expect(q.id, q.title).toBe(S.slug(q.title));
    expect(index.quests.filter((q) => q.mini).length).toBeGreaterThan(20);
    expect(index.quests.filter((q) => q.order).length).toBeGreaterThan(200);
    expect(index.areas.map((a) => a.name)).toEqual(['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness']);
    expect(index.capes.map((c) => c.id)).toEqual(['mqc', 'comp', 'trim']);
  });

  test('every file is in the index, and every guide the index has a revision for is there', () => {
    const want = ['index.json'].concat(index.quests.filter((q) => q.rev != null).map((q) => 'quests/' + q.id + '.json'),
      index.areas.map((a) => 'achievements/areas/' + a.id + '.json'), index.capes.map((c) => 'achievements/capes/' + c.id + '.json'));
    expect(Object.keys(files).sort()).toEqual(want.sort());
    // nearly every quest has a guide
    expect(index.quests.filter((q) => q.rev == null).length).toBeLessThan(10);
  });

  test('a guide: the quest of its file, parts with steps, and no id twice (your ticks are saved by them)', () => {
    for (const e of index.quests.filter((q) => q.rev != null)) {
      const q = json('quests/' + e.id + '.json'), ids = [];
      expect([q.id, q.rev], e.id).toEqual([e.id, e.rev]);
      expect(typeof q.page === 'string' && q.page.length > 0, e.id).toBe(true);
      expect(Array.isArray(q.sections), e.id).toBe(true);
      (function walk(steps) { for (const s of steps || []) { if (s.id) ids.push(s.id); walk(s.substeps); } })([].concat(...q.sections.map((s) => s.blocks.filter((b) => b.type === 'step'))));
      for (const it of q.items.required.items.concat(q.items.recommended.items)) ids.push(it.id);
      expect(twice(ids), e.id).toEqual([]);
      expect(files['quests/' + e.id + '.json'], e.id).not.toMatch(/<script|javascript:|\son\w+=/i);
    }
  });

  test('an area: its tiers as in the index, and no task twice', () => {
    for (const e of index.areas) {
      const a = json('achievements/areas/' + e.id + '.json');
      expect([a.id, a.name, a.rev], e.id).toEqual([e.id, e.name, e.rev]);
      expect(a.tiers.map((t) => ({ id: t.id, name: t.name, tasks: t.tasks.length })), e.id).toEqual(e.tiers);
      expect(twice([].concat(...a.tiers.map((t) => t.tasks.map((x) => x.id)))), e.id).toEqual([]);
      for (const t of a.tiers) expect(t.tasks.length, e.id + ' ' + t.id).toBeGreaterThan(0);
    }
  });

  test('a cape: as many achievements as the index says, each with a category, none twice', () => {
    for (const e of index.capes) {
      const c = json('achievements/capes/' + e.id + '.json');
      expect([c.id, c.name, c.achievements.length], e.id).toEqual([e.id, e.name, e.achievements]);
      expect(c.achievements.length, e.id).toBeGreaterThan(20);
      expect(twice(c.achievements.map((x) => x.id)), e.id).toEqual([]);
      for (const x of c.achievements) expect(typeof x.category === 'string' && !!x.name, e.id + ' ' + x.id).toBe(true);
    }
  });
});
