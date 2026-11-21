// The wiki reader (js/wiki), without a browser: what you type, page addresses, names, the wiki text of an achievement,
// ids, and how it asks the wiki (batches, a few at once, errors). Reading wiki HTML needs a browser: tests/parser.spec.js.
const fs = require('fs');
const path = require('path');
const { test, expect, load, fakeFetch, titlesOf, ROOT } = require('./load');

const W = 'https://runescape.wiki/w/';
const { QG, D } = load();

test.describe('reading what you type', () => {
  const cases = [
    ['', { error: 'empty' }],
    ['   ', { error: 'empty' }],
    ["cook's assistant", { base: "Cook's assistant", title: "Cook's assistant/Quick guide" }],
    ['While_Guthix_Sleeps', { base: 'While Guthix Sleeps', title: 'While Guthix Sleeps/Quick guide' }],
    ['https://runescape.wiki/w/While_Guthix_Sleeps', { base: 'While Guthix Sleeps' }],
    ['https://runescape.wiki/w/While_Guthix_Sleeps/Quick_guide', { base: 'While Guthix Sleeps', title: 'While Guthix Sleeps/Quick guide' }],
    ['https://runescape.wiki/w/Cook%27s_Assistant', { base: "Cook's Assistant" }],
    ['runescape.wiki/w/Dragon_Slayer', { base: 'Dragon Slayer' }],
    ['www.runescape.wiki/w/Dragon_Slayer#Walkthrough', { base: 'Dragon Slayer' }],
    ['https://runescape.wiki/index.php?title=Dragon_Slayer&action=view', { base: 'Dragon Slayer' }],
    ['https://oldschool.runescape.wiki/w/Dragon_Slayer_I', { error: 'osrs' }],
    ['https://example.com/w/Dragon_Slayer', { error: 'not-wiki' }],
    ['https://runescape.wiki/', { error: 'no-page' }],
    ['https://runescape.wiki/w/_', { error: 'no-page' }],
    ['http://', { error: 'bad-link' }]
  ];
  for (const [input, want] of cases) {
    test('"' + input + '"', () => {
      expect(QG.titleFromInput(input)).toMatchObject(want);
    });
  }
});

test('wiki page addresses', () => {
  expect([
    QG.pageUrl("Cook's Assistant"),
    QG.pageUrl('While Guthix Sleeps/Quick guide'),
    QG.pageUrl('Recipe for Disaster: Freeing King Awowogei'),
    QG.pageUrl('Dragon Slayer', 'Part 1')
  ]).toEqual([
    W + "Cook's_Assistant",
    W + 'While_Guthix_Sleeps/Quick_guide',
    W + 'Recipe_for_Disaster:_Freeing_King_Awowogei',
    W + 'Dragon_Slayer#Part%201'
  ]);
});

test('quest names match however they are written', () => {
  expect([
    D.norm('The Restless Ghost'),
    D.norm('Recipe for Disaster: Freeing King Awowogei'),
    D.norm('Rocking Out (miniquest)'),
    D.norm('Ernest & the Chicken')
  ]).toEqual(['restless ghost', 'recipe for disaster freeing king awowogei', 'rocking out', 'ernest and the chicken']);
  expect(QG.normName('Rune Mysteries')).toBe(QG.normName('rune mysteries!'));
});

// Your ticks are saved by these ids. If one of these changes, ticks people have saved no longer match: change the
// numbers here only on purpose (and raise the matching *_VERSION).
test('ids stay the same', () => {
  expect([QG.hash('Talk to the Cook in Lumbridge Castle.'), QG.hash('step'), QG.hash('lumbridge easyYoink!'), QG.hash('')])
    .toEqual(['n6aes1', '1jaeuxb', 'ib43f9', 'ztntfp']);
  expect(['Part 1: Getting started', 'Ernest & the Chicken!', 'Café crème', '???', '  Walkthrough  '].map(QG.slug))
    .toEqual(['part-1-getting-started', 'ernest-the-chicken', 'cafe-creme', 'part', 'walkthrough']);
});

test.describe('cleaning wiki text', () => {
  test('comments come out completely, also one that makes another when taken out; one not closed hides the rest', () => {
    expect(QG.noComments('a<!-- x -->b')).toBe('ab');
    expect(QG.noComments('a<!<!-- x -->-- y -->b')).toBe('ab');
    expect(QG.noComments('a <!-- not closed\nb')).toBe('a ');
    for (const s of ['<!--<!-- -->-->x', '<!<!--- -->-- -->', '<!-<!-- -->- x -->']) expect(QG.noComments(s)).not.toContain('<!--');
  });

  test('line breaks at the ends go, however many', () => {
    expect(QG.trimBreaks('<br> <br>Text<br><br> ')).toBe('Text');
    expect(QG.trimBreaks('a<br>b')).toBe('a<br>b');
    expect(QG.trimBreaks('<br>')).toBe('');
  });
});

test.describe("an achievement's wiki text", () => {
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'wiki', 'cape-achievements.json'), 'utf8'));
  const lead = (t) => pages[t].lead;
  const box = (req) => '{{Infobox Achievement\n|requirements =\n' + req + '\n}}';

  test('what an achievement needs: wikitext that is written another way', () => {
    const box = (req) => '{{Infobox Achievement\n|name = X\n|requirements = ' + req + '\n|id = 1\n}}';
    // no text at all
    expect(QG.cheevoNeeds()).toEqual({ skills: [], links: [], oneOf: [], other: [] });
    // a "|" inside a comment is not the end of the requirements
    expect(QG.cheevoNeeds(box('<!-- a | b -->\n* [[Swept Away]]')).links).toEqual([{ name: 'Swept Away', partial: false }]);
    // a level written another way is kept as words; one written the usual way is still a level
    expect(QG.cheevoNeeds(box('\n* {{Skillreq|Magic|level=93}}\n* {{Skillreq|Combat}}\n* {{Skillreq|Mining|50}}')))
      .toEqual({ skills: [{ skill: 'Mining', level: 50, boost: false }], links: [], oneOf: [], other: ['93 Magic', 'Combat'] });
    // a template in a template, a footnote, a line break and a picture leave no pieces behind
    expect(QG.cheevoNeeds(box('\n* Own a {{plink|Rune bar|txt={{fact}} bar}} first\n* Kill 5 dragons<ref>See [[x]]</ref><br />twice<ref name="a" />\n* [[File:Coins 1.png|20px|link=Coins]] 5 coins')).other)
      .toEqual(['Own a first', 'Kill 5 dragons twice', '5 coins']);
  });

  test('what it needs, and the capes it counts for (real pages)', () => {
    // levels (boostable or not), quests ("partial" when part of it is enough), and which capes
    expect(QG.cheevoNeeds(lead('Advanced Sweeping'))).toEqual({ skills: [{ skill: 'Magic', level: 93, boost: true }], oneOf: [], other: [],
      links: [{ name: 'Swept Away', partial: false }, { name: 'Diamond in the Rough', partial: false }, { name: 'Lunar Diplomacy', partial: true }, { name: 'Underground Pass', partial: true }] });
    expect(QG.cheevoCapes(lead('Advanced Sweeping'))).toEqual(['mqc']);
    // one of several levels: the app can tell if you have one
    expect(QG.cheevoNeeds(lead("Conquered Everyone's Heart"))).toEqual({ skills: [{ skill: 'Constitution', level: 70, boost: false }], links: [], other: [],
      oneOf: [{ text: '60 Strength or 60 Agility', any: [[{ skill: 'Strength', level: 60 }], [{ skill: 'Agility', level: 60 }]] }] });
    expect(QG.cheevoCapes(lead('Bane Tuner'))).toEqual(['mqc', 'comp']);
    expect(QG.cheevoNeeds(lead('A bug in the system'))).toEqual({ skills: [], links: [], oneOf: [], other: [] });
  });

  test('other forms the wiki uses: a template over more lines, groups of levels, plain words', () => {
    expect(QG.cheevoNeeds('{{Infobox Achievement\n|requirements =\n{{Achievement requirement\n|or = y\n|{{Achievement requirement|Agility|90}}\n|{{Achievement requirement|Cooking|90}}\n}}\n|id = 409\n}}').oneOf)
      .toEqual([{ text: '90 Agility or 90 Cooking', any: [[{ skill: 'Agility', level: 90 }], [{ skill: 'Cooking', level: 90 }]] }]);
    expect(QG.cheevoNeeds('{{Infobox Achievement\n|requirements = \n{{Achievement requirement\n|or = y\n|\n* {{Skillreq|Fishing|90}}\n* {{Skillreq|Slayer|90}}\n|\n* {{Skillreq|Prayer|90}}\n}}\n}}').oneOf)
      .toEqual([{ text: '90 Fishing + 90 Slayer or 90 Prayer', any: [[{ skill: 'Fishing', level: 90 }, { skill: 'Slayer', level: 90 }], [{ skill: 'Prayer', level: 90 }]] }]);
    expect(QG.cheevoNeeds(box('* Tier 10 [[Fort Forinthry|the fort]] in the [[Wilderness]].\n* None') + '\n|mqc = yes'))
      .toEqual({ skills: [], links: [], oneOf: [], other: ['Tier 10 the fort in the Wilderness'] });
    // levels in words count too; with something that is not a level, it stays words
    const words = QG.cheevoNeeds(box('* {{Achievement requirement|or = y|80 Attack|80 [[Strength]]}}\n* {{Achievement requirement|or = y|81 Woodcutting|find an idol}}'));
    expect(words.oneOf).toEqual([{ text: '80 Attack or 80 Strength', any: [[{ skill: 'Attack', level: 80 }], [{ skill: 'Strength', level: 80 }]] }]);
    expect(words.other).toEqual(['81 Woodcutting or find an idol']);
  });

  test('comments are left out, also one that makes another, and one not closed hides the rest, like on the wiki', () => {
    const noted = QG.cheevoNeeds(box('* {{Skillreq|Magic|50}} <!-- a note -->\n* [[Swept Away]]<!<!-- x -->--\n* [[Diamond in the Rough]]'));
    expect(noted).toEqual({ skills: [{ skill: 'Magic', level: 50, boost: false }], links: [{ name: 'Swept Away', partial: false }], oneOf: [], other: [] });
    expect(JSON.stringify(noted)).not.toContain('<!--');
    expect(QG.cheevoNeeds(box('* [[Swept Away]]\n* [[Ode of the Devourer]] <!-- not closed\n* [[Diamond in the Rough]]')).links.map((l) => l.name))
      .toEqual(['Swept Away', 'Ode of the Devourer']);
  });

  test('no requirements, a list page, "see", and one capes line each', () => {
    expect(QG.cheevoNeeds('{{Infobox Achievement\n|name = X\n}}')).toEqual({ skills: [], links: [], oneOf: [], other: [] });
    expect(QG.cheevoNeeds(box('* {{List of quests}}\n* See [[Somewhere]]\n* None.'))).toEqual({ skills: [], links: [], oneOf: [], other: [] });
    expect(QG.cheevoCapes('{{Infobox Achievement\n|mqc = yes\n|comp = Yes\n|trimmed = yes\n|mqc = yes\n}}')).toEqual(['mqc', 'comp', 'trim']);
    expect(QG.cheevoCapes('{{Infobox Achievement\n|mqc = no\n}}')).toEqual([]);
  });
});

test.describe('asking the wiki', () => {
  test('a few at a time: every item gets its turn, at most that many at once', async () => {
    let open = 0, most = 0;
    const done = [];
    await QG.inTurns([1, 2, 3, 4, 5, 6, 7], (x) => {
      open++;
      most = Math.max(most, open);
      return new Promise((r) => { setTimeout(() => { open--; done.push(x); r(); }, 1); });
    }, 3);
    expect(most).toBe(3);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await QG.inTurns([], () => { throw new Error('never'); }, 3)).toEqual([]);
  });

  test('when pages changed: 50 a request, 2 requests at once', async () => {
    const fetch = fakeFetch((url) => ({ json: { query: { pages: titlesOf(url).map((t, i) => ({ title: t, lastrevid: 1000 + i, touched: '2026-11-20T10:00:00Z',
      revisions: [{ revid: 1000 + i, timestamp: '2026-11-19T10:00:00Z' }] })) } } }));
    const info = await load({ fetch }).QG.pageInfo(Array.from({ length: 120 }, (_, i) => 'Page ' + i));
    expect(fetch.urls.map((u) => titlesOf(u).length)).toEqual([50, 50, 20]);
    expect(fetch.most).toBe(2);
    expect(fetch.urls[0]).toContain('prop=info%7Crevisions&rvprop=ids%7Ctimestamp');
    expect(Object.keys(info)).toHaveLength(120);
    expect(info['Page 0']).toEqual({ rev: 1000, edited: '2026-11-19T10:00:00Z', touched: '2026-11-20T10:00:00Z' });
  });

  test('when pages changed: a name the wiki writes differently, a redirect, a page it does not have', async () => {
    const fetch = fakeFetch(() => ({ json: { query: {
      normalized: [{ from: "cook's assistant", to: "Cook's assistant" }],
      redirects: [{ from: "Cook's assistant", to: "Cook's Assistant" }],
      pages: [{ title: "Cook's Assistant", lastrevid: 7, touched: 'T', revisions: [{ revid: 7, timestamp: 'E' }] }, { title: 'Gone', missing: true }]
    } } }));
    expect(await load({ fetch }).QG.pageInfo(["cook's assistant", 'Gone', 'Not in the answer']))
      .toEqual({ "cook's assistant": { rev: 7, edited: 'E', touched: 'T' }, Gone: { missing: true } });
  });

  test('when pages changed: a request that fails leaves its pages out (unknown, so read again); the others still come', async () => {
    const fetch = fakeFetch((url) => {
      const first = titlesOf(url)[0];
      if (first === 'Page 0') return { status: 500, json: {} };
      if (first === 'Page 50') throw new TypeError('Failed to fetch');
      return { json: { query: { pages: titlesOf(url).map((t) => ({ title: t, lastrevid: 1 })) } } };
    });
    const info = await load({ fetch }).QG.pageInfo(Array.from({ length: 120 }, (_, i) => 'Page ' + i));
    expect(Object.keys(info)).toEqual(Array.from({ length: 20 }, (_, i) => 'Page ' + (100 + i)));
  });

  test('which names the wiki has: after its capitals and a redirect; missing and bad names are left out', async () => {
    const fetch = fakeFetch(() => ({ json: { query: {
      normalized: [{ from: 'dragon slayer', to: 'Dragon slayer' }],
      redirects: [{ from: 'Dragon slayer', to: 'Dragon Slayer' }],
      pages: [{ title: 'Dragon Slayer' }, { title: 'Nope', missing: true }, { title: 'Bad<', invalid: true }]
    } } }));
    expect(await load({ fetch }).QG.findPages(['dragon slayer', 'Nope', 'Bad<'])).toEqual({ 'dragon slayer': 'Dragon Slayer' });
    expect(titlesOf(fetch.urls[0])).toEqual(['dragon slayer', 'Nope', 'Bad<']);
  });

  test('which names the wiki has: what goes wrong is said plainly', async () => {
    await expect(load({ fetch: fakeFetch(() => ({ status: 503, json: {} })) }).QG.findPages(['X'])).rejects.toThrow('The wiki answered with error 503.');
    await expect(load({ fetch: fakeFetch(() => ({ json: { error: 'x' } })) }).QG.findPages(['X'])).rejects.toThrow('The wiki sent something unexpected.');
  });

  // The app with a clock that does not wait; waits: how long it would have waited each time (not the 25 seconds a read gets).
  const quick = (fetch) => {
    const app = load({ fetch });
    app.waits = [];
    app.window.setTimeout = (f, ms) => { if (ms !== 25000) app.waits.push(ms); return setTimeout(f, ms === 25000 ? ms : 0); };
    app.window.clearTimeout = clearTimeout;
    return app;
  };
  const ok = (url) => ({ json: { query: { pages: titlesOf(url).map((t) => ({ title: t, lastrevid: 1 })) } } });
  // The first answer is what the test says, the next ones are fine.
  const firstThen = (first) => { let n = 0; return fakeFetch((url) => (n++ ? ok(url) : first(url))); };

  test('a busy wiki is asked once more, after a second: error 429, error 503, "maxlag" and "ratelimited"', async () => {
    for (const first of [{ status: 429, json: {} }, { status: 503, json: {} }, { json: { error: { code: 'maxlag' } } }, { json: { error: { code: 'ratelimited' } } }]) {
      const fetch = firstThen(() => first), app = quick(fetch);
      expect(Object.keys(await app.QG.pageInfo(['A', 'B']))).toEqual(['A', 'B']);
      expect(fetch.urls).toHaveLength(2);
      expect(app.waits).toEqual([1000]);
    }
  });

  test('it waits as long as the wiki asks, at most 5 seconds', async () => {
    for (const [asks, waits] of [['2', 2000], ['60', 5000], ['soon', 1000]]) {
      let n = 0;
      const fetch = (url) => Promise.resolve(n++ ? { ok: true, status: 200, json: () => Promise.resolve(ok(url).json) } :
        { ok: false, status: 429, headers: { get: (h) => (h === 'Retry-After' ? asks : null) }, json: () => Promise.resolve({}) });
      const app = quick(fetch);
      expect(Object.keys(await app.QG.pageInfo(['A']))).toEqual(['A']);
      expect(app.waits).toEqual([waits]);
    }
  });

  test('a connection that drops is tried once more; a second failure is the end', async () => {
    const fetch = firstThen(() => { throw new TypeError('Failed to fetch'); }), app = quick(fetch);
    expect(await app.QG.findPages(['A'])).toEqual({ A: 'A' });
    expect(fetch.urls).toHaveLength(2);
    const never = fakeFetch(() => { throw new TypeError('Failed to fetch'); });
    await expect(quick(never).QG.findPages(['A'])).rejects.toThrow('Failed to fetch');
    expect(never.urls).toHaveLength(2);
  });

  test('not asked again: an answer that takes too long, and a mistake in the question', async () => {
    let asked = 0;
    const slow = (url, opts) => { asked++; return new Promise((done, fail) => { opts.signal.addEventListener('abort', () => fail(Object.assign(new Error('Cut off'), { name: 'AbortError' }))); }); };
    const app = load({ fetch: slow });
    app.window.setTimeout = (f) => setTimeout(f, 5);
    expect(await app.QG.pageInfo(['A'])).toEqual({});
    expect(asked).toBe(1);
    const wrong = fakeFetch(() => ({ json: { error: { code: 'toomanyvalues' } } })), app2 = quick(wrong);
    expect(await app2.QG.pageInfo(['A'])).toEqual({});
    expect(wrong.urls).toHaveLength(1);
    expect(app2.waits).toEqual([]);
  });

  // An answer that starts and never ends: its first part is there, the rest only stops when the read is cut off.
  const stalled = (url, opts) => Promise.resolve({ ok: true, status: 200, json: () => new Promise((done, fail) => {
    opts.signal.addEventListener('abort', () => fail(Object.assign(new Error('Cut off'), { name: 'AbortError' })));
  }) });
  // The app, with a clock where the wiki's time is up at once.
  const hasty = () => { const app = load({ fetch: stalled }); app.window.setTimeout = (f) => setTimeout(f, 5); return app; };

  test('which names the wiki has: an answer that never ends is cut off', async () => {
    // (it ends with an error, so the lookups after it go on)
    await expect(hasty().QG.findPages(['X'])).rejects.toThrow('The wiki sent something unexpected.');
  });

  test('the quest list: an answer that starts and never ends is cut off too', async () => {
    await expect(hasty().D.loadList()).rejects.toMatchObject({ code: 'timeout' });
  });
});
