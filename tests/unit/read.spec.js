// The app's side of the data (js/wiki/data.js), without a browser: which files it asks for and when, what it makes
// of them, and what it says when one fails.
const { test, expect, load, fakeFetch } = require('./load');

const HASH = { cook: 'aaaaaaaaaa', desert: 'bbbbbbbbbb', mqc: 'cccccccccc' };
function index(more) {
  const q = (title, o) => Object.assign({ id: title.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-'), title, members: false, difficulty: 'Novice',
    length: 'Short', age: 'Fifth Age', combat: 'None', qp: 1, series: '', release: '2001' }, o);
  return Object.assign({ format: 1, updated: '2026-11-22',
    quests: [q("Cook's Assistant", { order: 2, rev: 7, hash: HASH.cook }), q('Imp Catcher', { order: 1, members: true }), q('Dragon Slayer', { order: 3, added: '2026-11-20' }),
      q('Demon Slayer', { order: 4 }), q('Rune Mysteries', { order: 5 }), q('Bar Crawl (miniquest)', { mini: true }),
      q('Recipe for Disaster: Freeing Evil Dave', { extra: true, rev: 3, hash: 'dddddddddd' })],
    areas: [{ id: 'desert', name: 'Desert', rev: 4, hash: HASH.desert, tiers: [] }],
    capes: [{ id: 'mqc', name: 'Master quest cape', achievements: 1, rev: 5, hash: HASH.mqc }] }, more);
}
const GUIDE = { format: 1, id: 'cooks-assistant', title: "Cook's Assistant", page: "Cook's Assistant/Quick guide", rev: 7, mapVersion: 'm1', overview: { questReqs: [] },
  items: { required: { note: '', items: ['egg'] }, recommended: { note: '', items: [] } }, sections: [{ id: 's', blocks: [] }], rewards: { items: [] }, music: [], achievements: [], requiredFor: [] };
const AREA = { format: 1, id: 'desert', name: 'Desert', page: 'Desert achievements', rev: 4,
  tiers: [{ id: 'easy', name: 'Easy', tasks: [{ id: '1', name: 'Old' }, { id: '2', name: 'Fresh', added: '2026-11-20' }] }] };
const CAPE = { format: 1, id: 'mqc', name: 'Master quest cape', page: 'Master Quest Cape (achievement)', rev: 5, levels: [{ skill: 'Magic', level: 93 }], skiller: [],
  achievements: [{ id: '9', name: 'Sweeping', category: 'Lore', added: '2026-11-20' }] };
// A site that has these files: { 'index.json': …, 'quests/x.json': … }. A value that is a function is called.
function site(files) {
  return fakeFetch((url) => {
    const path = url.replace(/^data\//, '').replace(/\?.*$/, ''), f = files[path];
    const a = typeof f === 'function' ? f(url) : f;
    // (a copy each time, like a real answer: the app may change what it got)
    return a === undefined ? { status: 404, json: null } : a && a.status ? a : { json: JSON.parse(JSON.stringify(a)) };
  });
}
const full = () => site({ 'index.json': index(), 'quests/cooks-assistant.json': GUIDE, 'achievements/areas/desert.json': AREA, 'achievements/capes/mqc.json': CAPE });

test.describe('the lists', () => {
  test('the quests, the miniquests and the order come from one file, asked for once', async () => {
    const fetch = full(), { D } = load({ fetch });
    const [list, minis, order] = await Promise.all([D.loadList(), D.loadMinis(), D.loadOrder()]);
    expect(fetch.urls).toEqual(['data/index.json']);
    expect(list.quests.map((q) => q.t)).toEqual(["Cook's Assistant", 'Imp Catcher', 'Dragon Slayer', 'Demon Slayer', 'Rune Mysteries']);
    expect(list.quests[1]).toEqual({ t: 'Imp Catcher', m: true, len: 'Short', age: 'Fifth Age', dif: 'Novice', cb: 'None', qp: 1, ser: '', rel: '2001' });
    // new since a build first saw it
    expect(list.quests[2].newAt).toBe(Date.parse('2026-11-20'));
    expect(minis.quests).toEqual([expect.objectContaining({ t: 'Bar Crawl (miniquest)', mini: true })]);
    expect(order.order).toEqual(['Imp Catcher', "Cook's Assistant", 'Dragon Slayer', 'Demon Slayer', 'Rune Mysteries']);
    expect(typeof list.at).toBe('number');
  });

  test('too few quests, or no order, is an error', async () => {
    const few = index();
    few.quests = few.quests.slice(0, 2);
    const { D } = load({ fetch: site({ 'index.json': few }) });
    await expect(D.loadList()).rejects.toMatchObject({ code: 'format', message: 'Could not read the quest list.' });
    await expect(D.loadOrder()).rejects.toMatchObject({ code: 'format', message: 'Could not read the optimal order.' });
  });

  test('an index that failed is asked for again the next time', async () => {
    let n = 0;
    const fetch = site({ 'index.json': () => (n++ ? index() : { status: 500, json: null }) }), { D } = load({ fetch });
    await expect(D.loadList()).rejects.toMatchObject({ code: 'http', message: "The app's data answered with error 500." });
    expect((await D.loadList()).quests).toHaveLength(5);
    expect(fetch.urls).toHaveLength(2);
  });
});

test.describe('what a file that fails says', () => {
  const cases = [
    ['is not there', { status: 404, json: null }, { code: 'missingtitle' }],
    ['is not JSON', { json: null }, { code: 'format', message: "The app's data could not be read." }],
    ['has no lists', { json: { format: 1 } }, { code: 'format', message: "The app's data could not be read." }],
    ['is of a newer shape than the app knows', { json: index({ format: 2 }) }, { code: 'format', message: "The app's data is newer than the app. Reload the page." }]
  ];
  for (const [what, answer, error] of cases) {
    test('the index ' + what, async () => {
      await expect(load({ fetch: fakeFetch(() => answer) }).D.loadList()).rejects.toMatchObject(error);
    });
  }

  test('no answer at all, or none in time: said as the data, with what to do', async () => {
    // (the page's own TypeError: that is what its fetch fails with)
    const off = load({ fetch: () => Promise.reject(off.run('new TypeError("Failed to fetch")')) });
    const e = await off.D.loadList().then(null, (x) => x);
    expect(e).toMatchObject({ code: 'offline', message: "Could not reach the app's data." });
    expect(off.A.loadError(e)).toBe("Could not reach the app's data. Check your internet, then try again.");
    const slow = load({ fetch: () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) });
    const s = await slow.D.loadList().then(null, (x) => x);
    expect(s).toMatchObject({ code: 'slow' });
    expect(slow.A.loadError(s)).toBe("The app's data took too long to come. Try again.");
  });

  test('another error is passed on as it is', async () => {
    const { D } = load({ fetch: () => Promise.reject(new Error('odd')) });
    await expect(D.loadList()).rejects.toThrow('odd');
  });
});

test.describe('a guide', () => {
  test('is one file, asked for with its mark; it comes as the app keeps it', async () => {
    const fetch = full(), { QG } = load({ fetch });
    const g = await QG.load({ base: "cook's assistant" });
    expect(fetch.urls).toEqual(['data/index.json', 'data/quests/cooks-assistant.json?h=' + HASH.cook]);
    expect(g).toMatchObject({ version: QG.VERSION, page: "Cook's Assistant/Quick guide", title: "Cook's Assistant", revid: 7, hash: HASH.cook, notQuickGuide: false,
      mapVersion: 'm1', source: "https://runescape.wiki/w/Cook's_Assistant/Quick_guide", requiredItems: { note: '', items: ['egg'] }, recommendedItems: { note: '', items: [] } });
    expect(Date.parse(g.fetchedAt)).toBeGreaterThan(0);
    expect(g.sections).toEqual(GUIDE.sections);
  });

  test('a part of a quest that is not in the list has a guide too', async () => {
    const fetch = site({ 'index.json': index(), 'quests/recipe-for-disaster-freeing-evil-dave.json': Object.assign({}, GUIDE, { title: 'Recipe for Disaster: Freeing Evil Dave', notQuickGuide: true }) });
    const g = await load({ fetch }).QG.load({ base: 'Recipe for Disaster: Freeing Evil Dave' });
    expect(g.notQuickGuide).toBe(true);
  });

  test('a quest without a file, or one the index does not know: the index is asked once more, then it says so', async () => {
    for (const base of ['Imp Catcher', 'No Such Quest']) {
      const fetch = full(), { QG } = load({ fetch });
      await expect(QG.load({ base })).rejects.toMatchObject({ code: 'missingtitle', message: 'The wiki has no page for this quest yet.' });
      expect(fetch.urls).toEqual(['data/index.json', 'data/index.json']);
    }
  });

  test('a quest that got its file since the index was read opens', async () => {
    let n = 0;
    const late = index();
    late.quests[1].hash = 'eeeeeeeeee';
    const fetch = site({ 'index.json': () => (n++ ? late : index()), 'quests/imp-catcher.json': GUIDE });
    expect((await load({ fetch }).QG.load({ base: 'Imp Catcher' })).hash).toBe('eeeeeeeeee');
  });

  test('read again: the index is asked for again, unless it is a few seconds old', async () => {
    const fetch = full(), { QG } = load({ fetch });
    await QG.load({ base: "Cook's Assistant" });
    await QG.load({ base: "Cook's Assistant" }, true);
    expect(fetch.urls.filter((u) => u === 'data/index.json')).toHaveLength(1);
  });

  test('a file without a revision, levels or tips still reads', async () => {
    const bare = index();
    delete bare.quests[0].rev;
    const fetch = site({ 'index.json': bare, 'quests/cooks-assistant.json': Object.assign({}, GUIDE, { rev: undefined }),
      'achievements/areas/desert.json': Object.assign({}, AREA, { rev: undefined }),
      'achievements/capes/mqc.json': Object.assign({}, CAPE, { rev: undefined, levels: undefined, skiller: undefined }) });
    const { QG } = load({ fetch });
    expect((await QG.load({ base: "Cook's Assistant" })).revid).toBe(0);
    expect((await QG.loadArea('Desert')).revid).toBe(0);
    expect(await QG.loadCape('mqc')).toMatchObject({ revid: 0, levels: [], skiller: [] });
    expect((await QG.pageInfo(["Cook's Assistant/Quick guide"]))["Cook's Assistant/Quick guide"]).toEqual({ hash: HASH.cook, rev: 0 });
  });

  test('a file that is not a guide is an error', async () => {
    const { QG } = load({ fetch: site({ 'index.json': index(), 'quests/cooks-assistant.json': { format: 1, page: 'X', sections: [] } }) });
    await expect(QG.load({ base: "Cook's Assistant" })).rejects.toMatchObject({ code: 'format' });
  });
});

test.describe('an area and a cape', () => {
  test('an area: its tiers, and what is new', async () => {
    const fetch = full(), { QG } = load({ fetch });
    const a = await QG.loadArea('Desert');
    expect(fetch.urls[1]).toBe('data/achievements/areas/desert.json?h=' + HASH.desert);
    expect(a).toMatchObject({ version: QG.AREA_VERSION, name: 'Desert', page: 'Desert achievements', revid: 4, hash: HASH.desert });
    expect(a.tiers[0].tasks).toEqual([{ id: '1', name: 'Old' }, { id: '2', name: 'Fresh', newAt: Date.parse('2026-11-20') }]);
  });

  test('an area the data does not have, or a file without tiers', async () => {
    await expect(load({ fetch: full() }).QG.loadArea('Varrock')).rejects.toMatchObject({ code: 'missingtitle', message: 'The app has no data for this area yet.' });
    const { QG } = load({ fetch: site({ 'index.json': index(), 'achievements/areas/desert.json': { format: 1, tiers: [] } }) });
    await expect(QG.loadArea('Desert')).rejects.toMatchObject({ code: 'format' });
  });

  test('a cape: its achievements with their category, the levels, and what is new', async () => {
    const fetch = full(), { QG } = load({ fetch });
    const c = await QG.loadCape('mqc');
    expect(fetch.urls[1]).toBe('data/achievements/capes/mqc.json?h=' + HASH.mqc);
    expect(c).toMatchObject({ version: QG.CAPE_VERSION, key: 'mqc', name: 'Master quest cape', revid: 5, hash: HASH.mqc, levels: [{ skill: 'Magic', level: 93 }], skiller: [] });
    expect(c.cheevos).toEqual([{ id: '9', name: 'Sweeping', cat: 'Lore', newAt: Date.parse('2026-11-20') }]);
  });

  test('a cape there is not, one the data does not have, or a file without achievements', async () => {
    await expect(Promise.resolve().then(() => load({ fetch: full() }).QG.loadCape('nope'))).rejects.toMatchObject({ code: 'format', message: 'There is no such cape.' });
    await expect(load({ fetch: full() }).QG.loadCape('comp')).rejects.toMatchObject({ code: 'missingtitle', message: 'The app has no data for this cape yet.' });
    const { QG } = load({ fetch: site({ 'index.json': index(), 'achievements/capes/mqc.json': { format: 1, achievements: [] } }) });
    await expect(QG.loadCape('mqc')).rejects.toMatchObject({ code: 'format' });
  });
});

test.describe('what changed', () => {
  test('the mark of each page the app keeps, from a new index; a page without a file is missing, an unknown one is left out', async () => {
    const fetch = full(), { QG, D } = load({ fetch });
    await D.loadList();
    const info = await QG.pageInfo(["Cook's Assistant/Quick guide", 'Imp Catcher/Quick guide', 'Desert achievements', 'Master Quest Cape (achievement)', 'Varrock achievements', 'Nothing/Quick guide']);
    expect(fetch.urls).toEqual(['data/index.json', 'data/index.json']);
    expect(info).toEqual({ "Cook's Assistant/Quick guide": { hash: HASH.cook, rev: 7 }, 'Imp Catcher/Quick guide': { missing: true },
      'Desert achievements': { hash: HASH.desert, rev: 4 }, 'Master Quest Cape (achievement)': { hash: HASH.mqc, rev: 5 } });
  });

  test('when the index cannot be read, it knows nothing', async () => {
    expect(await load({ fetch: fakeFetch(() => ({ status: 500, json: null })) }).QG.pageInfo(['X/Quick guide'])).toEqual({});
  });
});
