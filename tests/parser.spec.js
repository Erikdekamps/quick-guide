// The parser (parser.js) and the quest list reader (quests.js), tested in the browser.
const { test, expect, fixture } = require('./support/app');

test.beforeEach(async ({ page }) => {
  await page.goto('/__blank');
  await page.addScriptTag({ url: '/parser.js' });
  await page.addScriptTag({ url: '/quests.js' });
});

// Parses a bit of wiki HTML. Steps need a part heading, so most snippets start with an <h2>.
function parse(page, html, title, live) {
  title = title || 'Test quest/Quick guide';
  return page.evaluate(([h, t, l]) => window.QuickGuide.parse('<div class="mw-parser-output">' + h + '</div>',
    { title: t, base: t.replace(/\/Quick guide$/, ''), live: l || {} }), [html, title, live]);
}
const steps = (q, i) => q.sections[i || 0].blocks.filter((b) => b.type === 'step');
const W = 'https://runescape.wiki/w/';

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
    ['http://', { error: 'bad-link' }]
  ];
  for (const [input, want] of cases) {
    test('"' + input + '"', async ({ page }) => {
      const got = await page.evaluate((s) => window.QuickGuide.titleFromInput(s), input);
      expect(got).toMatchObject(want);
    });
  }
});

test('wiki page addresses', async ({ page }) => {
  const urls = await page.evaluate(() => [
    window.QuickGuide.pageUrl("Cook's Assistant"),
    window.QuickGuide.pageUrl('While Guthix Sleeps/Quick guide'),
    window.QuickGuide.pageUrl('Recipe for Disaster: Freeing King Awowogei'),
    window.QuickGuide.pageUrl('Dragon Slayer', 'Part 1')
  ]);
  expect(urls).toEqual([
    W + "Cook's_Assistant",
    W + 'While_Guthix_Sleeps/Quick_guide',
    W + 'Recipe_for_Disaster:_Freeing_King_Awowogei',
    W + 'Dragon_Slayer#Part%201'
  ]);
});

test.describe('a full quick guide', () => {
  let q;
  test.beforeEach(async ({ page }) => {
    q = await parse(page, fixture('while-guthix-sleeps.html'), 'While Guthix Sleeps/Quick guide', JSON.parse(fixture('while-guthix-sleeps.live.json')));
  });

  test('page facts', () => {
    expect(q).toMatchObject({
      version: 4, page: 'While Guthix Sleeps/Quick guide', title: 'While Guthix Sleeps',
      source: W + 'While_Guthix_Sleeps/Quick_guide', notQuickGuide: false, mapVersion: '2026-11-01-b'
    });
    expect(Date.parse(q.fetchedAt)).toBeGreaterThan(0);
  });

  test('quest details', () => {
    const o = q.overview;
    expect(o.startPoint).toContain('<a href="' + W + 'Radimus_Erkle" target="_blank" rel="noopener">Radimus Erkle</a>');
    expect(o.startPoint).not.toContain('Show on map');
    expect(o.startMap).toMatchObject({ type: 'map', caption: 'Start point', lat: 3348, lon: 2729, zoom: 2, plane: 0, mapId: 28 });
    expect(o.startMap.features).toHaveLength(1);
    expect(o).toMatchObject({ members: true, length: 'Very, Very Long', difficulty: 'Grandmaster', description: 'Find out what Lucien is planning, and stop him.' });
    expect(o.questReqs).toEqual([
      { text: 'Defender of Varrock', depth: 1 }, { text: 'Shield of Arrav', depth: 2 },
      { text: "The Knight's Sword", depth: 2 }, { text: 'The Hand in the Sand', depth: 1 }
    ]);
    expect(o.skillReqs).toEqual([
      { skill: 'Magic', level: 75, note: '' }, { skill: 'Herblore', level: 65, note: '(boostable)' }, { skill: 'Hunter', level: 55, note: '' }
    ]);
    expect(o.otherReqs).toHaveLength(1);
    expect(o.otherReqs[0]).toContain("Warriors&#39; Guild</a>");
    expect(o.followsEvents).toEqual(['Nature Spirit', 'Priest in Peril', 'The Restless Ghost']);
    expect(o.enemies).toEqual([
      { text: '2 × Assassin (level 42)', name: 'Assassin', count: 2, level: '42', note: '' },
      { text: 'Balance Elemental (level 117)', name: 'Balance Elemental', count: null, level: '117', note: '' },
      { text: '2 Tormented demons (level 119; your stats are boosted)', name: 'Tormented demons', count: 2, level: '119', note: 'your stats are boosted' }
    ]);
    // Rows the app has no place for: pictures become their names, and links are dropped.
    // League regions are read once each, from the badge, and shown as tags.
    expect(o.extra).toEqual([
      { label: 'League region required', html: '<span class="reg">Kandarin</span> <span class="reg">Asgarnia</span> <span class="reg">Misthalin</span>' },
      { label: 'League auto-complete', html: 'Unlocking <span class="reg">Misthalin</span> will auto-complete the quest.' },
      { label: 'Ironman concerns', html: 'Bring a Spade spade &amp; logs.' }
    ]);
    expect(o.notes).toEqual(['This is the short version of the guide.']);
  });

  test('items', () => {
    expect(q.requiredItems.note).toBe('Tool belt items are not listed.');
    expect(q.requiredItems.items.map((i) => [i.text, i.alternatives])).toEqual([
      ['A lit sapphire lantern', []], ['Ring of charos (a)', ['or 5,000 coins']], ['Runes for 4 casts of NPC Contact', ['8 air, 4 astral, 4 cosmic']]
    ]);
    expect(q.recommendedItems.items.map((i) => i.text)).toEqual(['Games necklace', 'Ardougne Teleport']);
    for (const it of q.requiredItems.items) expect(it.id).toMatch(/^req:[0-9a-z]+$/);
    for (const it of q.recommendedItems.items) expect(it.id).toMatch(/^rec:[0-9a-z]+$/);
  });

  test('parts, in wiki order, without Trivia', () => {
    expect(q.sections.map((s) => [s.id, s.title])).toEqual([
      ['starting-out', 'Starting out'], ['finding-movario-s-base', "Finding Movario's base"], ['catching-lucien-s-spy', "Catching Lucien's spy"]
    ]);
    expect(q.sections[0].anchor).toBe('Starting_out');
    expect(q.sections[1].blocks.map((b) => b.type)).toEqual([
      'bring', 'heading', 'step', 'step', 'heading', 'map', 'note', 'step', 'step', 'step', 'warning', 'heading', 'text', 'table', 'step', 'step'
    ]);
  });

  test('steps: links, actions, codes, no footnotes', () => {
    const s = steps(q, 0);
    expect(s).toHaveLength(3);
    expect(s[0].html).toContain('<a href="' + W + 'Ivy_Sophista" target="_blank" rel="noopener">Ivy Sophista</a>');
    expect(s[1].html).toBe('Go upstairs, talk to <a href="' + W + 'Thaerisk_Cemphier" target="_blank" rel="noopener">Thaerisk Cemphier</a> and kill both assassins.');
    expect(s[2].html).toContain('(fairy ring <span class="code">BLR</span>)');
    expect(steps(q, 1)[1].html).toBe('<i>Trap</i> the square trap pit to the west, then <i>use</i> the mort myre fungus on it.');
  });

  test('chat options', () => {
    expect(steps(q, 0)[0].dialogue).toEqual([{ when: null, options: [{ key: '1', text: 'What efforts are you making against Lucien?' }, { key: '✓', text: 'Accept quest' }] }]);
    const launder = steps(q, 1)[2];
    expect(launder.dialogue).toEqual([
      { when: null, options: [{ key: '2', text: 'Do you know someone called Movario?' }, { key: '2', text: '(Charm) Tell me all you know about Movario.' }] },
      { when: 'If you brought coins instead', options: [{ key: '1', text: 'Offer five thousand coins for information on Movario.' }] }
    ]);
    expect(launder.html).not.toContain('If you brought coins');
  });

  test('sub-steps, pictures, maps and tables', () => {
    const s = steps(q, 1);
    expect(s[3].substeps.map((x) => x.text)).toEqual(['Turael', 'Duradel', 'Mazchna']);
    expect(s[3].substeps[1].dialogue[0].options).toEqual([{ key: '1', text: 'I need to talk to you about Lucien.' }]);
    for (const sub of s[3].substeps) expect(sub.id.startsWith(s[3].id + ':')).toBe(true);
    expect(s[4].images).toHaveLength(1);
    expect(s[4].images[0]).toMatchObject({ type: 'map', caption: 'Map', lat: 3150, lon: 2580, zoom: 3 });
    expect(s[4].images[0].features).toHaveLength(2);
    expect(s[5].images).toEqual([{
      type: 'image', src: 'https://runescape.wiki/images/Old_battered_door.png?abc', width: 300, height: 200,
      alt: 'Old battered door', caption: 'The old battered door', href: W + 'File:Old_battered_door.png'
    }]);
    const map = q.sections[1].blocks[5];
    expect(map).toMatchObject({ type: 'map', caption: 'Location of the Khazard launderer', lat: 3150, lon: 2610, version: '2026-11-01-b' });
    const table = q.sections[1].blocks[13];
    expect(table).toEqual({ type: 'table', label: 'Symbol to rune', head: ['Symbol', 'Rune'], rows: [['O', '<a href="' + W + 'Mind_rune" target="_blank" rel="noopener">Mind rune</a>'], ['H', 'Earth rune'], ['Note']] });
  });

  test('bring list, notes, warnings, headings', () => {
    const b = q.sections[1].blocks;
    expect(b[0].needed.map((x) => x.text)).toEqual(['Any logs', 'Ring of charos (a) or 5,000 coins', 'Mort myre fungus']);
    expect(b[0].recommended.map((x) => x.text)).toEqual(['Watchtower Teleport', 'Ardougne Teleport (Ardougne cloak is best)']);
    for (const it of b[0].needed.concat(b[0].recommended)) expect(it.id).toMatch(/^finding-movario-s-base:bring:[0-9a-z]+$/);
    expect(b[1]).toEqual({ type: 'heading', level: 3, text: 'Feldip Hunter area' });
    expect(b[6]).toEqual({ type: 'note', html: 'Dismiss any followers before the next steps.' });
    expect(b[10]).toEqual({ type: 'warning', html: '<span class="caution">CAUTION:</span> items dropped in this room are lost.' });
    expect(b[11]).toEqual({ type: 'heading', level: 4, text: 'Intended method' });
    expect(b[12]).toEqual({ type: 'text', html: '&quot;Prohibited&quot; is the key word. Match the odd symbol to a rune.' });
  });

  test('rewards, music, achievements and later quests', () => {
    expect(q.rewards.image).toMatchObject({ type: 'image', src: 'https://runescape.wiki/images/While_Guthix_Sleeps_reward.png', caption: 'Quest complete scroll' });
    expect(q.rewards.items.map((r) => [r.text, r.subs])).toEqual([
      ['5 quest points', []], ['5,000 coins', []], ['4 × 100,000 XP from Idria', ['in skills at level 65 or higher']]
    ]);
    expect(q.rewards.notes).toEqual(['The rewards are given when you finish.']);
    expect(q.music).toEqual([{ name: 'Dangerous Logic', where: "Movario's base" }, { name: 'The Sound of Guthix', where: '' }]);
    expect(q.achievements).toHaveLength(1);
    expect(q.achievements[0]).toContain('Raiders of the Lost Arc');
    expect(q.requiredFor.map((g) => [g.label, g.items.length])).toEqual([['Directly', 2], ['Indirectly', 1]]);
  });

  test('ids are the same every time', async ({ page }) => {
    const again = await parse(page, fixture('while-guthix-sleeps.html'), 'While Guthix Sleeps/Quick guide');
    const ids = (x) => x.sections.flatMap((s) => s.blocks.filter((b) => b.type === 'step').map((b) => b.id));
    expect(ids(again)).toEqual(ids(q));
    expect(new Set(ids(q)).size).toBe(ids(q).length);
  });
});

test.describe('wiki markup details', () => {
  test('both kinds of part headings', async ({ page }) => {
    const q = await parse(page, '<h2><span class="mw-headline" id="Old">Old style</span></h2><ul><li>One</li></ul>' +
      '<div class="mw-heading mw-heading2"><h2 id="New">New style</h2></div><ul><li>Two</li></ul>');
    expect(q.sections.map((s) => [s.title, s.anchor])).toEqual([['Old style', 'Old'], ['New style', 'New']]);
  });

  test('parts with the same name get their own ids; empty parts are dropped', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>One</li></ul><h2>Part</h2><ul><li>Two</li></ul><h2>Empty</h2><h2>See also</h2><ul><li>X</li></ul>');
    expect(q.sections.map((s) => s.id)).toEqual(['part', 'part-2']);
  });

  test('the same step text twice gets two ids', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Talk to Bob.</li><li>Talk to Bob.</li></ul>');
    const [a, b] = steps(q);
    expect(b.id).toBe(a.id + '-2');
  });

  test('only safe markup is kept', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Use <b>bold</b>, <i>italic</i>, <span style="color:red">span</span>, <button>btn</button>' +
      '<script>alert(1)</script><style>p{}</style> and <a href="javascript:alert(1)">bad link</a> or <a href="/w/Good">good</a>' +
      '<span class="hidden">secret</span><span style="display: none">hidden</span>.</li></ul>');
    const html = steps(q)[0].html;
    expect(html).toBe('Use <b>bold</b>, <i>italic</i>, span, and bad link or <a href="' + W + 'Good" target="_blank" rel="noopener">good</a>.');
  });

  test('edit links, contents, footnotes and boxes are removed', async ({ page }) => {
    const q = await parse(page, '<div id="toc" class="toc">Contents</div><table class="messagebox"><tr><td>Box</td></tr></table>' +
      '<h2>Part<span class="mw-editsection">[edit]</span></h2><ul><li>Step<sup class="reference">[1]</sup></li></ul>' +
      '<div class="navbox">Nav</div><div class="mw-references-wrap"><ol class="references"><li>Ref</li></ol></div>');
    expect(q.sections).toHaveLength(1);
    expect(q.sections[0].title).toBe('Part');
    expect(steps(q).map((s) => s.html)).toEqual(['Step']);
  });

  test('fairy ring codes', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Use <b>CKS</b>.</li><li>Use fairy ring code AIQ.</li><li>Talk to <b>Bob</b>.</li></ul>');
    expect(steps(q).map((s) => s.html)).toEqual(['Use <span class="code">CKS</span>.', 'Use fairy ring code <span class="code">AIQ</span>.', 'Talk to <b>Bob</b>.']);
  });

  test('warnings, notes and plain text', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><p><b>WARNING:</b> do not die.</p><p><i>A tip.</i></p><blockquote>Quoted.</blockquote><p>Plain.</p>' +
      '<ul><li>IMPORTANT: a warning step.</li><li>CAUTION: still a step <span class="chat-options">(<span class="chat-options-underline" title="Yes">1</span>)</span></li></ul>');
    const b = q.sections[0].blocks;
    expect(b.map((x) => x.type)).toEqual(['warning', 'note', 'note', 'text', 'warning', 'step']);
    expect(b[0].html).toBe('<b><span class="caution">WARNING:</span></b> do not die.');
    expect(b[4].html).toBe('<span class="caution">IMPORTANT:</span> a warning step.');
  });

  test('spelling notes and stray brackets', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Pick the colour<sup>[UK]</sup> color<sup>[US]</sup>.</li><li>Talk to Bob ().</li><li>Go north (past the gate.</li></ul>');
    expect(steps(q).map((s) => s.html)).toEqual(['Pick the colour (UK) / color (US).', 'Talk to Bob.', 'Go north past the gate.']);
  });

  test('chat options from a tooltip table, plain keys and special keys', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul>' +
      '<li>Talk to Bob <span class="chat-options">(1)</span><span class="chat-options-dialogue" data-tooltip-name="t1">show</span>' +
      '<div class="js-tooltip-wrapper" data-tooltip-for="t1"><table><tr><td>[1]</td><td>Hello there.</td></tr><tr><td>Accept</td><td>Yes.</td></tr></table></div></li>' +
      '<li>Talk to Ann <span class="chat-options">(Varies•Any•✔•3)</span></li>' +
      '<li>Talk to Kim <span class="chat-options">(<span class="chat-options-underline" title="A">1</span>)</span> or <span class="chat-options">(<span class="chat-options-underline" title="B">2</span>)</span></li>' +
      '<li>Talk to Jo <span class="chat-options">(<span class="chat-options-underline" title="A">1</span>)</span> then <span class="chat-options">(<span class="chat-options-underline" title="B">2</span>)</span> if you have the key.</li>' +
      '</ul>');
    const s = steps(q);
    expect(s[0].dialogue).toEqual([{ when: null, options: [{ key: '1', text: 'Hello there.' }, { key: '✓', text: 'Yes.' }] }]);
    expect(s[0].html).toBe('Talk to Bob');
    expect(s[1].dialogue[0].options.map((o) => o.key)).toEqual(['?', '~', '✓', '3']);
    expect(s[2].dialogue.map((d) => d.when)).toEqual([null, 'Or']);
    expect(s[3].dialogue.map((d) => d.when)).toEqual([null, 'Then, if you have the key']);
    expect(s[3].html).toBe('Talk to Jo');
  });

  test('a "Bring" line is split into items', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><p><b>Needed:</b> logs, ring of charos (a) or 5,000 coins, food, but more is better, runes: air, mind, and a tinderbox.<br>' +
      '<b>Recommended:</b> <a href="/w/Games_necklace">games necklace</a></p>');
    const b = q.sections[0].blocks[0];
    expect(b.type).toBe('bring');
    expect(b.needed.map((x) => x.text)).toEqual(['Logs', 'Ring of charos (a) or 5,000 coins', 'Food, but more is better', 'Runes: air, mind', 'A tinderbox']);
    expect(b.recommended.map((x) => x.html)).toEqual(['<a href="' + W + 'Games_necklace" target="_blank" rel="noopener">Games necklace</a>']);
  });

  test('other "Bring" labels', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><p><strong>Items required:</strong> a spade</p><h2>Part 2</h2><p><b>Items recommended</b>: a lamp</p><h2>Part 3</h2><p><b>Note:</b> not a bring list</p>');
    expect(q.sections.map((s) => s.blocks[0].type)).toEqual(['bring', 'bring', 'text']);
    expect(q.sections[0].blocks[0].needed.map((x) => x.text)).toEqual(['A spade']);
    expect(q.sections[1].blocks[0].recommended.map((x) => x.text)).toEqual(['A lamp']);
  });

  test('sub-steps two levels deep', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ol><li>Top<ul><li>Middle<ul><li>Bottom</li></ul></li></ul></li></ol>');
    const top = steps(q)[0];
    expect(top.text).toBe('Top');
    expect(top.substeps[0].text).toBe('Middle');
    expect(top.substeps[0].substeps[0].text).toBe('Bottom');
    expect(top.substeps[0].substeps[0].id.startsWith(top.substeps[0].id + ':')).toBe(true);
  });

  test('pictures: big ones get a box, small icons are dropped, galleries are grouped', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Use the <img src="/images/Icon.png" width="20" height="20" alt="icon"> lever.' +
      '<a href="/w/File:Big.png" class="mw-file-description"><img src="/images/Big.png" width="250" height="100" alt="Big"></a></li></ul>' +
      '<ul class="gallery"><li class="gallerybox"><div class="thumb"><img src="/images/A.png" width="120" alt="A"></div><div class="gallerytext">First</div></li>' +
      '<li class="gallerybox"><div class="thumb"><img src="/images/B.png" width="120" alt="B"></div><div class="gallerytext">Second</div></li></ul>' +
      '<figure><img src="/images/C.png" width="200" alt="C"><figcaption>Third</figcaption></figure>');
    const b = q.sections[0].blocks;
    expect(b[0].html).toBe('Use the lever.');
    expect(b[0].images.map((i) => [i.src, i.href])).toEqual([['https://runescape.wiki/images/Big.png', W + 'File:Big.png']]);
    expect(b[1].type).toBe('images');
    expect(b[1].items.map((i) => i.caption)).toEqual(['First', 'Second']);
    expect(b[2]).toMatchObject({ type: 'image', caption: 'Third', src: 'https://runescape.wiki/images/C.png' });
  });

  test('a map link inside a sentence keeps its words, and gets a map box', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><ul><li>Go to <a class="mw-kartographer-maplink" data-lat="3200" data-lon="3100" data-zoom="1" data-mapid="5" data-plane="1">the mine</a>.</li></ul>');
    expect(steps(q)[0].images[0]).toMatchObject({ type: 'map', caption: 'the mine', lat: 3200, lon: 3100, zoom: 1, mapId: 5, plane: 1, features: [] });
    expect(steps(q)[0].html).toBe('Go to the mine.');
    const v = await page.evaluate(() => window.QuickGuide.MAP_VERSION);
    expect(q.mapVersion).toBe(v);
  });

  test('tables: labels, header rows and pictures in cells', async ({ page }) => {
    const q = await parse(page, '<h2>Part</h2><table class="wikitable"><tr><th>Keyword</th><th>Ingredients</th><th>Notes</th></tr>' +
      '<tr><td>Agility</td><td><img src="/images/Toad.png" width="20" alt="Toad"> toad</td><td></td></tr><tr><td></td><td></td><td></td></tr></table>' +
      '<table class="navbox"><tr><td>Skip</td></tr></table>');
    const t = q.sections[0].blocks[0];
    expect(t.label).toBe('Keyword · Ingredients');
    expect(t.head).toEqual(['Keyword', 'Ingredients', 'Notes']);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0][1]).toContain('<img src="https://runescape.wiki/images/Toad.png" alt="Toad" width="20" loading="lazy" decoding="async">');
    expect(q.sections[0].blocks).toHaveLength(1);
  });

  test('quest details without the questdetails class, and free quests', async ({ page }) => {
    const q = await parse(page, '<table><tr><th>Start point</th><td>Lumbridge</td></tr><tr><th>Members</th><td>Free-to-play</td></tr>' +
      '<tr><th>Length</th><td>Short</td></tr></table><h2>Part</h2><ul><li>Go.</li></ul>');
    expect(q.overview).toMatchObject({ startPoint: 'Lumbridge', members: false, length: 'Short' });
  });

  test('a page with no details and no parts', async ({ page }) => {
    const q = await parse(page, '<p>Nothing here.</p>');
    expect(q.sections).toEqual([]);
    expect(q.overview.startPoint).toBe('');
    expect(q.requiredItems.items).toEqual([]);
  });

  test('reward groups and "Required for" labels', async ({ page }) => {
    const q = await parse(page, '<h2>Rewards</h2><ul><li>2 quest points</li></ul><h3>Other</h3><ul><li>A lamp</li></ul>' +
      '<h2>Required for completing</h2><dl><dt>For comprehension of the story</dt></dl><ul><li>Story quest</li></ul>');
    expect(q.rewards.items.map((r) => r.text)).toEqual(['2 quest points']);
    expect(q.rewards.groups.map((g) => [g.label, g.items.map((i) => i.text)])).toEqual([['Other', ['A lamp']]]);
    expect(q.requiredFor).toEqual([{ label: 'Indirectly, for the story', items: ['Story quest'] }]);
  });
});

test.describe('the quest list', () => {
  test('quests.js reads the wiki list', async ({ page }) => {
    const list = await page.evaluate((h) => window.QuickGuideData.parseList(h), fixture('list-of-quests.html'));
    expect(list).toHaveLength(11);
    expect(list[0]).toEqual({ t: 'While Guthix Sleeps', m: true, dif: 'Grandmaster', len: 'Very, Very Long', age: 'Fifth Age', cb: '119', qp: 5, ser: 'Mahjarrat', rel: '14 April 2009' });
    expect(list[1]).toMatchObject({ t: "Cook's Assistant", m: false, qp: 1 });
    expect(list.filter((x) => x.t === 'Dragon Slayer')).toHaveLength(1);
  });

  test('parser.js reads the wiki list too', async ({ page }) => {
    const list = await page.evaluate((h) => window.QuickGuide.parseQuestList(h), fixture('list-of-quests.html'));
    expect(list).toHaveLength(11);
    expect(list[1]).toEqual({ name: "Cook's Assistant", page: "Cook's Assistant", members: false, length: 'Short', age: 'Fifth Age', difficulty: 'Novice', combat: '', qp: 1, series: '', release: '4 January 2001' });
    expect(list.find((x) => x.name === "'Phite Club").page).toBe("'Phite Club");
  });

  test('names match however they are written', async ({ page }) => {
    const r = await page.evaluate(() => [
      window.QuickGuideData.norm('The Restless Ghost'),
      window.QuickGuideData.norm('Recipe for Disaster: Freeing King Awowogei'),
      window.QuickGuideData.norm('Rocking Out (miniquest)'),
      window.QuickGuideData.norm('Ernest & the Chicken'),
      window.QuickGuide.normName('Rune Mysteries') === window.QuickGuide.normName('rune mysteries!')
    ]);
    expect(r).toEqual(['restless ghost', 'recipe for disaster freeing king awowogei', 'rocking out', 'ernest and the chicken', true]);
  });
});

test.describe('talking to the wiki', () => {
  const load = (page, t) => page.evaluate((x) => window.QuickGuide.load(x).then((q) => ({ ok: q }), (e) => ({ err: { code: e.code, message: e.message, type: e.constructor.name } })), t);

  test('loads a quick guide with its map data', async ({ page, wiki }) => {
    const r = await load(page, { title: 'While Guthix Sleeps/Quick guide', base: 'While Guthix Sleeps' });
    expect(r.ok.sections).toHaveLength(3);
    expect(r.ok.overview.startMap.features).toHaveLength(1);
    expect(wiki.calls[0].prop).toBe('text|jsconfigvars');
  });

  test('falls back to the quest page when there is no quick guide', async ({ page, wiki }) => {
    const r = await load(page, { title: 'Rune Mysteries/Quick guide', base: 'Rune Mysteries' });
    expect(wiki.asked()).toEqual(['Rune Mysteries/Quick guide', 'Rune Mysteries']);
    expect(r.ok).toMatchObject({ page: 'Rune Mysteries', title: 'Rune Mysteries', notQuickGuide: true });
  });

  test('errors', async ({ page, wiki }) => {
    wiki.fail('Broken/Quick guide', 'http').fail('Offline/Quick guide', 'network').fail('Odd/Quick guide', 'format');
    expect((await load(page, { title: 'Nope/Quick guide', base: 'Nope' })).err.code).toBe('missingtitle');
    expect((await load(page, { title: 'Broken/Quick guide', base: 'Broken' })).err.code).toBe('http');
    expect((await load(page, { title: 'Offline/Quick guide', base: 'Offline' })).err.type).toBe('TypeError');
    expect((await load(page, { title: 'Odd/Quick guide', base: 'Odd' })).err.code).toBe('format');
  });

  test('gives up after 25 seconds', async ({ page, wiki }) => {
    wiki.fail('Slow/Quick guide', 'slow');
    await page.clock.install();
    const r = page.evaluate(() => window.QuickGuide.load({ title: 'Slow/Quick guide', base: 'Slow' }).catch((e) => e.code));
    await expect.poll(() => wiki.asked()).toContain('Slow/Quick guide');
    await page.clock.runFor(26000);
    expect(await r).toBe('timeout');
  });

  test('quest list from parser.js', async ({ page, wiki }) => {
    const r = await page.evaluate(() => window.QuickGuide.loadQuestList());
    expect(r.count).toBe(11);
    wiki.page('List of quests', '<p>No table here.</p>');
    const e = await page.evaluate(() => window.QuickGuide.loadQuestList().catch((x) => x.code));
    expect(e).toBe('format');
  });

  test('quest list from quests.js', async ({ page, wiki }) => {
    const r = await page.evaluate(() => window.QuickGuideData.loadList());
    expect(r.quests).toHaveLength(11);
    expect(r.at).toBeGreaterThan(0);
    expect(wiki.calls[0].prop).toBe('text');
    wiki.page('List of quests', '<table><tr><th>Name</th></tr><tr><td>Only one</td></tr></table>');
    expect(await page.evaluate(() => window.QuickGuideData.loadList().catch((x) => x.code))).toBe('format');
    wiki.fail('List of quests', 'http');
    expect(await page.evaluate(() => window.QuickGuideData.loadList().catch((x) => x.code))).toBe('http');
  });

  test('player lookup: quests and levels through the wiki', async ({ page, wiki }) => {
    wiki.setPlayer('Bob', { 'Rune Mysteries': 'COMPLETED', 'Dragon Slayer': 'STARTED', 'Imp Catcher': 'NOT_STARTED' }, { 7: 80 });   // 7 is Magic
    const b = await page.evaluate(() => window.QuickGuide.loadPlayer(' Bob '));
    expect(b).toMatchObject({ name: 'Bob', source: 'RuneMetrics', done: 1, started: 1, levels: { magic: 80 } });
    expect(b.quests).toEqual({ runemysteries: 2, dragonslayer: 1, impcatcher: 0 });
    expect(Date.parse(b.at)).toBeGreaterThan(0);
    // it only asks the wiki, nobody else
    expect(wiki.playerCalls.every((u) => u.startsWith('https://runescape.wiki/cors/'))).toBe(true);

    // quests but no levels still counts
    wiki.setPlayer('Ann', { 'Rune Mysteries': 'COMPLETED' }, {});
    wiki.player['index_lite.json?player=Ann'] = { status: 404, json: {} };
    expect(await page.evaluate(() => window.QuickGuide.loadPlayer('Ann'))).toMatchObject({ done: 1, levels: {} });

    expect(await page.evaluate(() => window.QuickGuide.loadPlayer('Unknown').catch((e) => e.code))).toBe('nodata');
    wiki.player['playerQuests/Nobody'] = 'network';
    wiki.player['index_lite.json?player=Nobody'] = 'network';
    expect(await page.evaluate(() => window.QuickGuide.loadPlayer('Nobody').catch((e) => e.code))).toBe('network');
  });
});
