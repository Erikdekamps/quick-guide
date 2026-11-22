// The data build's reading step (tools/data/collect.js), in a browser against the fake wiki: it reads the quest
// lists, every guide, the areas and the capes with the app's own reader, and says what it could not read.
const { test, expect, addWiki, withAllAreas, withCapes, AREAS } = require('./support/app');
const { collect } = require('../tools/data/collect');
const shape = require('../tools/data/shape');

test.beforeEach(async ({ page, wiki }) => {
  withCapes(withAllAreas(wiki.minis()));
  await page.goto('/__blank');
  await addWiki(page);
});

test('reads the lists, each guide, the 13 areas and the 3 capes; a quest without a page is said, not fatal', async ({ page, wiki }) => {
  const read = await collect(page);
  expect(read.list.length).toBe(15);
  expect(read.list.filter((q) => q.mini).length).toBe(4);
  expect(read.order.length).toBeGreaterThan(5);
  // the fake wiki has three guides (one from the quest's own page); the others have no page
  expect(Object.keys(read.guides).filter((t) => read.guides[t]).sort()).toEqual(["Cook's Assistant", 'Rune Mysteries', 'While Guthix Sleeps']);
  expect(read.guides['Rune Mysteries'].notQuickGuide).toBe(true);
  expect(read.failed).toContain('quest Dragon Slayer: missingtitle');
  expect(read.failed.filter((f) => !f.startsWith('quest '))).toEqual([]);
  expect(read.areas.map((a) => a.name)).toEqual(AREAS);
  expect(read.capes.map((c) => c.key)).toEqual(['mqc', 'comp', 'trim']);
  expect(read.want).toEqual({ areas: 13, capes: 3 });
  // a few at a time
  expect(wiki.asked()).toContain('While Guthix Sleeps/Quick guide');

  // and the files a build makes of it are the same the second time
  const files = shape.build(read, () => null, '2026-11-22');
  expect(Object.keys(files)).toContain('quests/while-guthix-sleeps.json');
  expect(Object.keys(files)).not.toContain('quests/dragon-slayer.json');
  expect(JSON.parse(files['index.json']).quests.find((q) => q.id === 'dragon-slayer').rev).toBeUndefined();
  const again = shape.build(await collect(page), (p) => (files[p] ? JSON.parse(files[p]) : null), '2026-12-01');
  expect(again).toEqual(files);
});

test('an area or a cape that fails is said, and is missing from what was read (the build then stops)', async ({ page, wiki }) => {
  wiki.fail('Desert achievements', 'http').fail('Completionist Cape (achievement)', 'format');
  const read = await collect(page);
  expect(read.areas.map((a) => a.name)).toEqual(AREAS.filter((n) => n !== 'Desert'));
  expect(read.capes.map((c) => c.key)).toEqual(['mqc', 'trim']);
  expect(read.failed).toEqual(expect.arrayContaining(['area Desert: http', 'cape comp: format']));
});

test('when the quest list cannot be read, the reading fails as a whole', async ({ page, wiki }) => {
  wiki.fail('List of quests', 'http');
  await expect(collect(page)).rejects.toThrow(/error 500/);
});
