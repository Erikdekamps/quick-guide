// Capes, in Achievements: the master quest, completionist and trimmed completionist capes. Cards on top of the list,
// and a page per cape: its achievements by category, with tick boxes, like an area.
const { test, expect, fixture, seed, stored, openApp, openSettings, closeSettings, lookUp, withCapes } = require('./support/app');

const W = 'https://runescape.wiki/w/';
const card = (page, key) => page.locator('.cape[data-cape="' + key + '"]');
const tab = (page, id) => page.locator('.tab[data-ctab="' + id + '"]');
const part = (page, key) => page.locator('section[data-cpart="' + key + '"]');
const cheevo = (page, id) => page.locator('li[data-cheevo="' + id + '"]');
const tabNames = (page) => page.locator('.tab[data-ctab] .tl-l');
const tabCounts = (page) => page.locator('.tab[data-ctab] .tcn');
const partNames = (page) => page.locator('section[data-cpart] .sech .n');
const partCounts = (page) => page.locator('section[data-cpart] .sech .c');

async function achievements(page) {
  await openApp(page, expect);
  await page.locator('.bn[data-home="areas"]').click();
  await expect(page.locator('#qcount')).toHaveText('13 areas');
}
async function openCape(page, key, name) {
  if (!(await card(page, key).count())) await achievements(page);
  await card(page, key).click();
  await expect(page.locator('h1.qt')).toHaveText(name);
}
const MQC = 'Master quest cape', COMP = 'Completionist cape', TRIM = 'Trimmed completionist cape';
// A cape, parsed by the app's own parser from its fixture, ready to put in storage.
async function parsedCape(page, file, key) {
  await page.goto('/__blank');
  await page.addScriptTag({ url: '/js/wiki/parser.js' });
  return page.evaluate(([h, k]) => window.QuickGuide.parseCape('<div class="mw-parser-output">' + h + '</div>', k), [fixture(file), key]);
}
// Every quest of the list marked done, as if ticked by hand.
async function allQuestsDone(page) {
  await page.waitForFunction(() => window.QuickGuideApp.S.list);
  await page.evaluate(() => {
    const A = window.QuickGuideApp;
    A.S.list.quests.forEach((q) => A.setMarked(q.t, true));
  });
}

test.describe('reading a cape page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/js/wiki/parser.js' });
  });
  const parse = (page, file, key) => page.evaluate(([h, k]) => window.QuickGuide.parseCape('<div class="mw-parser-output">' + h + '</div>', k), [fixture(file), key]);
  const html = (file) => '<div class="mw-parser-output">' + fixture(file) + '</div>';

  test('the three capes, and where to buy them', async ({ page }) => {
    const c = await page.evaluate(() => window.QuickGuide.CAPES);
    expect(c.map((x) => [x.key, x.name, x.page])).toEqual([
      ['mqc', MQC, 'Master Quest Cape (achievement)'],
      ['comp', COMP, 'Completionist Cape (achievement)'],
      ['trim', TRIM, 'Trimmed Completionist Cape (achievement)']
    ]);
    expect(c[0].buy).toContain('Curator Haig Halen');
    expect(c[2].buy).toContain('5,000,000 coins');
    expect(c[0].image).toMatch(/^https:\/\/runescape\.wiki\/images\/thumb\/Master_quest_cape_detail\.png\/96px-/);
  });

  test('achievements: name, what to do, members, category and subcategory', async ({ page }) => {
    const c = await parse(page, 'master-quest-cape-achievement.html', 'mqc');
    expect(c).toMatchObject({ key: 'mqc', name: MQC, page: 'Master Quest Cape (achievement)', source: W + 'Master_Quest_Cape_(achievement)', levels: [], skiller: [] });
    expect(c.cheevos).toHaveLength(23);
    expect(c.cheevos[0]).toEqual({ id: '4949', name: 'A Sliver of Silver Helps the Sanguine Go Down', page: 'A Sliver of Silver Helps the Sanguine Go Down',
      desc: 'Learn how to smith more durable havensilver.', members: true, cat: 'Lore', sub: 'Post-Quest' });
    // the achievement's own page, for its needs and tip
    expect(c.cheevos.find((x) => x.id === '3224')).toMatchObject({ name: "A Cultist's Journey", page: "A Cultist's Journey (achievement)" });
    expect(c.cheevos.find((x) => x.id === '2112')).toMatchObject({ name: "Aereck's Old Bones", members: false });
    // no subcategory: empty
    expect(c.cheevos.find((x) => x.id === '299')).toMatchObject({ name: 'Bridge over Fremmy Waters', cat: 'Lore', sub: '' });
    expect(c.cheevos.find((x) => x.id === '1')).toMatchObject({ name: 'Quest Cape', cat: 'Completionist', sub: '' });
    // ids are unique in a cape
    expect(new Set(c.cheevos.map((x) => x.id)).size).toBe(23);
    // the trimmed cape has the other two capes in it
    const t = await parse(page, 'trimmed-completionist-cape-achievement.html', 'trim');
    expect(t.cheevos.filter((x) => x.cat === 'Completionist').map((x) => [x.id, x.name])).toEqual([['1784', 'Completionist Cape'], ['1783', 'Master Quest Cape']]);
    // the game's count after a description is left out: the app counts an achievement as one tick
    expect(t.cheevos.find((x) => x.name === 'Chompy Massacre').desc).toBe('Kill chompy birds.');
    expect(c.cheevos.map((x) => x.desc).join(' ')).not.toContain('(X/');
  });

  test('the levels the master quest cape needs, and those of Master Skiller', async ({ page }) => {
    const l = await page.evaluate((h) => window.QuickGuide.minLevels(h), html('master-quest-cape.html'));
    expect(l).toHaveLength(28);
    expect(l.slice(0, 2)).toEqual([{ skill: 'Agility', level: 90 }, { skill: 'Archaeology', level: 120 }]);
    const s = await page.evaluate((h) => window.QuickGuide.skillReqs(h), html('master-skiller.html'));
    expect(s).toHaveLength(29);
    expect(s).toContainEqual({ skill: 'Invention', level: 120 });
    expect(s).toContainEqual({ skill: 'Agility', level: 99 });
  });

  test('a page that is not an achievement list', async ({ page }) => {
    const r = await page.evaluate(() => { try { window.QuickGuide.parseCape('<div class="mw-parser-output"><p>Nothing.</p></div>', 'mqc'); return 'no error'; } catch (e) { return e.code; } });
    expect(r).toBe('format');
  });

  test("an achievement's page: what it needs, the capes it counts for, and a tip", async ({ page }) => {
    const pages = JSON.parse(fixture('cape-achievements.json'));
    const r = await page.evaluate((p) => {
      const Q = window.QuickGuide, of = (t) => ({ needs: Q.cheevoNeeds(p[t].lead), capes: Q.cheevoCapes(p[t].lead), tip: Q.cheevoTip(p[t].extract) });
      return { sweep: of('Advanced Sweeping'), heart: of("Conquered Everyone's Heart"), bane: of('Bane Tuner'), bug: of('A bug in the system') };
    }, pages);
    // levels (boostable or not), quests ("partial" when part of it is enough), and which capes
    expect(r.sweep.needs).toEqual({ skills: [{ skill: 'Magic', level: 93, boost: true }], oneOf: [], other: [],
      links: [{ name: 'Swept Away', partial: false }, { name: 'Diamond in the Rough', partial: false }, { name: 'Lunar Diplomacy', partial: true }, { name: 'Underground Pass', partial: true }] });
    expect(r.sweep.capes).toEqual(['mqc']);
    // the tip: the first paragraph, without "… is an achievement that requires the player to"
    expect(r.sweep.tip).toMatch(/^Fully enchant the broomstick by bringing it to various magic users around the world\./);
    // one of several levels: the app can tell if you have one
    expect(r.heart.needs).toEqual({ skills: [{ skill: 'Constitution', level: 70, boost: false }], links: [], other: [],
      oneOf: [{ text: '60 Strength or 60 Agility', any: [[{ skill: 'Strength', level: 60 }], [{ skill: 'Agility', level: 60 }]] }] });
    expect(r.bane.capes).toEqual(['mqc', 'comp']);
    expect(r.bug.needs).toEqual({ skills: [], links: [], oneOf: [], other: [] });
    // other forms the wiki uses: a template over more lines, groups of levels, plain words
    const more = await page.evaluate(() => {
      const Q = window.QuickGuide;
      return [
        Q.cheevoNeeds('{{Infobox Achievement\n|requirements =\n{{Achievement requirement\n|or = y\n|{{Achievement requirement|Agility|90}}\n|{{Achievement requirement|Cooking|90}}\n}}\n|id = 409\n}}'),
        Q.cheevoNeeds('{{Infobox Achievement\n|requirements = \n{{Achievement requirement\n|or = y\n|\n* {{Skillreq|Fishing|90}}\n* {{Skillreq|Slayer|90}}\n|\n* {{Skillreq|Prayer|90}}\n}}\n}}'),
        Q.cheevoNeeds('{{Infobox Achievement\n|requirements =\n* Tier 10 [[Fort Forinthry|the fort]] in the [[Wilderness]].\n* None\n|mqc = yes\n}}'),
        Q.cheevoNeeds('{{Infobox Achievement\n|requirements =\n* {{Achievement requirement|or = y|80 Attack|80 [[Strength]]}}\n* {{Achievement requirement|or = y|81 Woodcutting|find an idol}}\n}}'),
        Q.cheevoTip('<p class="mw-empty-elt">\n</p><p><b>Port Life</b> is an achievement awarded for following the tutorial.</p><p>More.</p>')
      ];
    });
    expect(more[0].oneOf).toEqual([{ text: '90 Agility or 90 Cooking', any: [[{ skill: 'Agility', level: 90 }], [{ skill: 'Cooking', level: 90 }]] }]);
    expect(more[1].oneOf).toEqual([{ text: '90 Fishing + 90 Slayer or 90 Prayer',
      any: [[{ skill: 'Fishing', level: 90 }, { skill: 'Slayer', level: 90 }], [{ skill: 'Prayer', level: 90 }]] }]);
    expect(more[2]).toEqual({ skills: [], links: [], oneOf: [], other: ['Tier 10 the fort in the Wilderness'] });
    // levels in words count too; with something that is not a level, it stays words
    expect(more[3].oneOf).toEqual([{ text: '80 Attack or 80 Strength', any: [[{ skill: 'Attack', level: 80 }], [{ skill: 'Strength', level: 80 }]] }]);
    expect(more[3].other).toEqual(['81 Woodcutting or find an idol']);
    expect(more[4]).toBe('Port Life is an achievement awarded for following the tutorial.');
    // comments are left out, also one that takes another out to make itself ("<!<!-- -->--"), and one that is not
    // closed hides the rest, like on the wiki
    const noted = await page.evaluate(() => [
      window.QuickGuide.cheevoNeeds('{{Infobox Achievement\n|requirements =\n* {{Skillreq|Magic|50}} <!-- a note -->\n* [[Swept Away]]<!<!-- x -->--\n* [[Diamond in the Rough]]\n}}'),
      window.QuickGuide.cheevoNeeds('{{Infobox Achievement\n|requirements =\n* [[Swept Away]]\n* [[Ode of the Devourer]] <!-- not closed\n* [[Diamond in the Rough]]\n}}')
    ]);
    expect(noted[0]).toEqual({ skills: [{ skill: 'Magic', level: 50, boost: false }], links: [{ name: 'Swept Away', partial: false }], oneOf: [], other: [] });
    expect(JSON.stringify(noted)).not.toContain('<!--');
    expect(noted[1].links.map((l) => l.name)).toEqual(['Swept Away', 'Ode of the Devourer']);
  });
});

test.describe('Achievements', () => {
  test('the capes are on top of the areas; before you open one, nothing is read', async ({ page, wiki }) => {
    withCapes(wiki);
    await achievements(page);
    await expect(page.locator('.bn[data-home="areas"]')).toHaveText('Achievements');
    await expect(page.locator('.ghb .n').first()).toHaveText('Capes');
    await expect(page.locator('.ghb[data-group="Capes"] .c')).toHaveText('3');
    await expect(page.locator('.cape b')).toHaveText([MQC, COMP, TRIM]);
    await expect(card(page, 'mqc').locator('.cx')).toHaveText('Open it to read its achievements from the wiki.');
    await expect(card(page, 'mqc').locator('progress')).toHaveCount(0);
    expect(wiki.asked()).toEqual(['List of quests']);
  });

  test('a card shows how far you are, and where to go on', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    const c = card(page, 'mqc');
    await expect(c.locator('.cn')).toHaveText('1 / 23 achievements');
    await expect(c.locator('progress')).toHaveJSProperty('value', 1);
    await expect(c.locator('progress')).toHaveJSProperty('max', 23);
    await expect(c.locator('.cx')).toHaveText('Next: Lore · Post-Quest, 4 left');
    // the others are still unread
    await expect(card(page, 'comp').locator('.cx')).toHaveText('Open it to read its achievements from the wiki.');
  });

  test('the Capes group folds shut, and stays shut', async ({ page, wiki }) => {
    withCapes(wiki);
    await achievements(page);
    const head = page.locator('.ghb[data-group="Capes"]');
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.capes')).toBeHidden();
    // saved a moment later, with the rest of the view
    await expect.poll(async () => ((await stored(page, 'view')) || {}).closed).toEqual({ 'areas:Capes': true });
    await page.reload();
    await expect(page.locator('.capes')).toBeHidden();
    await page.locator('.ghb[data-group="Capes"]').click();
    await expect(card(page, 'mqc')).toBeVisible();
  });
});

test.describe('a cape', () => {
  test('opens from the wiki once, then from storage; a reload keeps it open', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    // the achievements, and the item page with the levels (asked together)
    expect(wiki.asked().slice(1).sort()).toEqual(['Master Quest Cape (achievement)', 'Master quest cape']);
    expect((await stored(page, 'cape.mqc')).cheevos).toHaveLength(23);
    expect((await stored(page, 'cape.mqc')).levels).toHaveLength(28);
    expect(await stored(page, 'last')).toBe('cape:mqc');
    await expect(page.locator('.bn[data-home="areas"]')).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await card(page, 'mqc').click();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    expect(wiki.asked().filter((x) => x === 'Master Quest Cape (achievement)')).toHaveLength(1);
  });

  test('the completionist cape reads Master Skiller for its levels', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'comp', COMP);
    expect(wiki.asked().slice(1).sort()).toEqual(['Completionist Cape (achievement)', 'Master Skiller']);
    expect((await stored(page, 'cape.comp')).skiller).toHaveLength(29);
  });

  test('a cape opens even when its extra page fails', async ({ page, wiki }) => {
    withCapes(wiki).fail('Master quest cape', 'http');
    await openCape(page, 'mqc', MQC);
    expect((await stored(page, 'cape.mqc')).levels).toEqual([]);
    await expect(part(page, 'needs')).toHaveCount(0);
  });

  test('says when the wiki fails', async ({ page, wiki }) => {
    withCapes(wiki).fail('Master Quest Cape (achievement)', 'http');
    await achievements(page);
    await card(page, 'mqc').click();
    await expect(page.locator('#load-err')).toHaveText('The wiki answered with error 500. Try again in a moment.');
  });

  test('a tab per category, the biggest first; the rest together in Other', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await expect(tabNames(page)).toHaveText(['Lore', 'Skills', 'Exploration', 'Other']);
    await expect(tabCounts(page)).toHaveText(['0 / 12', '0 / 4', '0 / 3', '0 / 4']);
    await expect(tab(page, 'lore')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.capehd .cn')).toHaveText('0 / 23 achievements');
    await expect(page.locator('.capehd .cx')).toHaveText('Buy it from Curator Haig Halen in the Varrock Museum, for 120,000 coins.');
    await expect(page.locator('#pg')).toHaveAttribute('aria-label', 'Cape progress');
    await expect(page.locator('#pg')).toHaveJSProperty('max', 23);
    // the completionist cape: Skills is the biggest; three of the same size, by name
    await page.getByRole('button', { name: 'All achievements' }).click();
    await openCape(page, 'comp', COMP);
    await expect(tabNames(page)).toHaveText(['Skills', 'Activities', 'Exploration', 'Other']);
  });

  test('a subcategory with three or more is a part of its own; the rest are together', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await expect(partNames(page)).toHaveText(['Needs', 'Post-Quest', 'Books', 'Miniquests', 'More lore']);
    await expect(partCounts(page)).toHaveText(['28', '0 / 5', '0 / 3', '0 / 3', '0 / 1']);
    await expect(part(page, 'lore:more').locator('li[data-cheevo] .t')).toHaveText(['Bridge over Fremmy Waters — Complete all the unabridged Fremennik Sagas.']);
    await tab(page, 'skills').click();
    await expect(partNames(page)).toHaveText(['Archaeology', 'More skills']);
    // no big subcategory: one part, by the tab's name
    await tab(page, 'exploration').click();
    await expect(partNames(page)).toHaveText(['Exploration']);
    await expect(partCounts(page)).toHaveText(['0 / 3']);
    // Other: a part per category
    await tab(page, 'other').click();
    await expect(partNames(page)).toHaveText(['Activities', 'Combat', 'Completionist']);
  });

  test('ticking: saved, counted, hidden when done; the tab is remembered', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await cheevo(page, '4949').locator('.cb').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12');
    await expect(page.locator('#pg')).toHaveJSProperty('value', 1);
    await expect(page.locator('.capehd .cn')).toHaveText('1 / 23 achievements');
    await expect(part(page, 'lore:post-quest').locator('.sech .c')).toHaveText('1 / 5');
    await expect(cheevo(page, '4949')).toBeHidden();
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({ 4949: 1 });
    // a click on the text ticks it too
    await cheevo(page, '2111').locator('.t').click();
    await expect(page.locator('#pg-cnt')).toHaveText('2 / 12');
    await tab(page, 'skills').click();
    expect((await stored(page, 'cprog.mqc')).tab).toBe('skills');
    await page.reload();
    await expect(tab(page, 'skills')).toHaveAttribute('aria-selected', 'true');
    await expect(tabCounts(page)).toHaveText(['2 / 12', '0 / 4', '0 / 3', '0 / 4']);
  });

  test('"Done, next achievement" ticks the first one left; a finished part folds shut', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await expect(page.locator('#next-btn')).toHaveText('Done, next achievement');
    await expect(page.locator('li[data-cheevo].cur')).toHaveAttribute('data-cheevo', '4949');
    for (let i = 0; i < 5; i++) await page.locator('#next-btn').click();
    expect(Object.keys((await stored(page, 'cprog.mqc')).ticks).sort()).toEqual(['2111', '2112', '2113', '3091', '4949']);
    const pq = part(page, 'lore:post-quest');
    await expect(pq.locator('.sech')).toHaveAttribute('aria-expanded', 'false');
    await expect(pq.locator('.sech')).toHaveClass(/\bdone\b/);
    await expect(pq.locator('.sech .c')).toHaveText('✓ 5 / 5');
    await expect(page.locator('li[data-cheevo].cur')).toHaveAttribute('data-cheevo', '3612');
    // open it to see them, and untick one
    await pq.locator('.sech').click();
    await expect(pq.locator('li[data-cheevo]')).toHaveCount(5);
    await expect(cheevo(page, '4949')).toBeVisible();
    await cheevo(page, '4949').locator('.cb').click();
    await expect(page.locator('#pg-cnt')).toHaveText('4 / 12');
  });

  test('with a tab done, the button goes to the next tab that has some left', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await tab(page, 'exploration').click();
    for (let i = 0; i < 3; i++) await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 3');
    await expect(page.locator('#next-btn')).toHaveText('Go to Other');
    await expect(page.locator('#next-btn')).toBeEnabled();
    await page.locator('#next-btn').click();
    await expect(tab(page, 'other')).toHaveAttribute('aria-selected', 'true');
    // in Other, Quest Cape ticks itself: the button skips it, and after the last one goes back to the start
    for (let i = 0; i < 3; i++) await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 4');
    await expect(page.locator('#next-btn')).toHaveText('Go to Lore');
  });

  test('when only the ones that tick themselves are left, the button says so; then all is done', async ({ page, wiki }) => {
    withCapes(wiki);
    const c = await parsedCape(page, 'master-quest-cape-achievement.html', 'mqc');
    const ticks = {};
    c.cheevos.filter((x) => x.name !== 'Quest Cape').forEach((x) => { ticks[x.id] = 1; });
    await seed(page, { 'cape.mqc': c, 'cprog.mqc': { ticks, tab: 'other' }, settings: { home: 'areas' } });
    await openApp(page, expect);
    await openCape(page, 'mqc', MQC);
    await expect(page.locator('#next-btn')).toHaveText('The rest tick themselves');
    await expect(page.locator('#next-btn')).toBeDisabled();
    await allQuestsDone(page);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await expect(card(page, 'mqc')).toHaveClass(/\bdone\b/);
    await expect(card(page, 'mqc').locator('.cn')).toHaveText('✓ 23 / 23 achievements');
    await expect(card(page, 'mqc').locator('.cx')).toHaveText('All achievements done.');
    await card(page, 'mqc').click();
    await expect(page.locator('#next-btn')).toHaveText('All achievements done');
    await expect(page.locator('#next-btn')).toBeDisabled();
  });

  test('Quest Cape ticks itself from your quests', async ({ page, wiki }) => {
    withCapes(wiki).setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' }, {});
    await openCape(page, 'mqc', MQC);
    await tab(page, 'other').click();
    const q = cheevo(page, '1');
    await expect(q).toHaveClass(/\bauto\b/);
    await expect(q.locator('.cb')).toBeDisabled();
    await expect(q.locator('.self')).toHaveText('Ticks itself from your quests: 0 / 11');
    // a click on it does nothing
    await q.locator('.t').click();
    await expect(q).not.toHaveClass(/\bdone\b/);
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({});
    // a quest the game says you have done counts
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await expect(q.locator('.self')).toHaveText('Ticks itself from your quests: 1 / 11');
    // all of them: done
    await allQuestsDone(page);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await card(page, 'mqc').click();
    await tab(page, 'other').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 4');
    await expect(cheevo(page, '1')).toHaveClass(/\bdone\b/);
    await expect(part(page, 'other:completionist').locator('.sech .c')).toHaveText('✓ 1 / 1');
  });

  test('Master Skiller ticks itself from your levels', async ({ page, wiki }) => {
    const levels = {};
    for (let id = 1; id <= 29; id++) levels[id] = 120;
    levels[17] = 98;   // Agility, one short of 99
    withCapes(wiki).setPlayer('Zezima', {}, levels);
    await openCape(page, 'comp', COMP);
    const m = cheevo(page, '1782');
    await expect(m).toHaveClass(/\bauto\b/);
    await expect(m.locator('.self')).toHaveText('Ticks itself from your levels: look up your character in Settings');
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await expect(m.locator('.self')).toHaveText('Ticks itself from your levels: 28 / 29 skills');
    await expect(m).not.toHaveClass(/\bdone\b/);
    // the completionist cape has no Needs of its own: Master Skiller is its levels
    await expect(part(page, 'needs')).toHaveCount(0);
  });

  test('the trimmed cape: the other two capes tick their own lines, and "Open it" opens them', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'trim', TRIM);
    await tab(page, 'other').click();
    await expect(partNames(page)).toHaveText(['Combat', 'Completionist', 'Lore']);
    await expect(cheevo(page, '1784').locator('.self')).toHaveText('Ticks itself from the completionist cape: not read yet · Open it');
    await expect(cheevo(page, '1783').locator('.self')).toHaveText('Ticks itself from the master quest cape: not read yet · Open it');
    await cheevo(page, '1783').getByRole('button', { name: 'Open it' }).click();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await card(page, 'trim').click();
    await expect(tab(page, 'other')).toHaveAttribute('aria-selected', 'true');
    await expect(cheevo(page, '1783').locator('.self')).toHaveText('Ticks itself from the master quest cape: 1 / 23 · Open it');
    await expect(cheevo(page, '1783').locator('.cb')).toBeDisabled();
  });

  test('Needs: the levels above the usual one, and a line for the rest', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    const n = part(page, 'needs');
    // shut at first: you can do every level
    await expect(n.locator('.sech')).toHaveAttribute('aria-expanded', 'false');
    await n.locator('.sech').click();
    const sk = n.locator('ul.skl-list li');
    await expect(sk).toHaveCount(13);
    await expect(sk.first()).toHaveText('120 Archaeology');
    await expect(n.locator('p.para')).toHaveText('And 90 or more in every other skill (15 more).');
    // only on the first tab
    await tab(page, 'skills').click();
    await expect(part(page, 'needs')).toHaveCount(0);
  });

  test('Needs with a player: a level too low is listed, and opens the part', async ({ page, wiki }) => {
    withCapes(wiki).setPlayer('Zezima', {}, { 17: 80, 28: 120 });   // Agility 80, Archaeology 120
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await openCape(page, 'mqc', MQC);
    const n = part(page, 'needs');
    await expect(n.locator('.sech')).toHaveAttribute('aria-expanded', 'true');
    await expect(n.locator('.sech .c')).toHaveText('1 too low');
    const sk = n.locator('ul.skl-list li');
    await expect(sk).toHaveCount(14);
    await expect(sk.nth(0)).toHaveClass(/\blow\b/);
    await expect(sk.nth(0)).toHaveText('90 Agility goal');
    await expect(sk.nth(1)).toHaveClass(/\bok\b/);
    await expect(n.locator('p.para')).toHaveText('And 90 or more in every other skill (14 more).');
  });

  test('parts fold shut and open again, and stay that way', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    const head = part(page, 'lore:books').locator('.sech');
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(part(page, 'lore:books').locator('.secb')).toBeHidden();
    expect((await stored(page, 'cprog.mqc')).open).toEqual({ 'lore:books': false });
    await page.reload();
    await expect(part(page, 'lore:books').locator('.secb')).toBeHidden();
    await expect(part(page, 'lore:miniquests').locator('.secb')).toBeVisible();
  });

  test('Settings, and back to the cape; "Done steps and tasks" shows the done ones', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await cheevo(page, '4949').locator('.cb').click();
    await expect(cheevo(page, '4949')).toBeHidden();
    await openSettings(page);
    await expect(page.locator('.bn[data-home="settings"]')).toHaveAttribute('aria-current', 'page');
    await page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' }).click();
    // the button of Achievements goes back to the cape
    await page.locator('.bn[data-home="areas"]').click();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    await expect(cheevo(page, '4949')).toBeVisible();
    await expect(cheevo(page, '4949').locator('.cb')).toBeChecked();
    // Settings stays open after a reload, over the cape
    await openSettings(page);
    await page.reload();
    await expect(page.locator('#settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('h1.qt')).toHaveText(MQC);
  });

  test('the cape menu: wiki link, refresh and reset', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await page.locator('#next-btn').click();
    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu a[data-act="wiki"]')).toHaveAttribute('href', W + 'Master_Quest_Cape_(achievement)');
    await page.locator('[data-act="creset"]').click();
    await expect(page.locator('[data-act="creset"]')).toContainText('again');
    await page.locator('[data-act="creset"]').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12');
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({});
    await page.locator('#menu-btn').click();
    await page.locator('[data-act="crefresh"]').click();
    await expect(page.locator('#toast')).toHaveText('Updated from the wiki.');
    expect(wiki.asked().filter((x) => x === 'Master Quest Cape (achievement)')).toHaveLength(2);
  });

  test('a cape saved by an older version opens at once, and is read again quietly', async ({ page, wiki }) => {
    withCapes(wiki);
    const old = await parsedCape(page, 'master-quest-cape-achievement.html', 'mqc');
    old.version = 0;
    await seed(page, { 'cape.mqc': old, settings: { home: 'areas' } });
    await openApp(page, expect);
    await card(page, 'mqc').click();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    await expect.poll(async () => (await stored(page, 'cape.mqc')).version).toBe(await page.evaluate(() => window.QuickGuide.CAPE_VERSION));
    await expect(page.locator('#toast')).toBeHidden();   // quiet
    expect(page.errors).toEqual([]);
  });

  test('a normal session has no errors', async ({ page, wiki }) => {
    withCapes(wiki);
    for (const [key, name] of [['mqc', MQC], ['comp', COMP], ['trim', TRIM]]) {
      await openCape(page, key, name);
      for (const t of await page.locator('.tab[data-ctab]').all()) await t.click();
      await page.getByRole('button', { name: 'All achievements' }).click();
    }
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(page.errors).toEqual([]);
  });
});

test.describe('export and import', () => {
  async function exportJson(page) {
    await openSettings(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    await expect(page.locator('#bk-text')).not.toHaveValue('');
    const t = await page.locator('#bk-text').inputValue();
    await page.getByRole('button', { name: 'Close' }).click();
    return JSON.parse(t);
  }

  test('the export has each cape you opened, by category: true is done', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await page.locator('#next-btn').click();
    const j = await exportJson(page);
    expect(Object.keys(j.capes)).toEqual([MQC]);
    const m = j.capes[MQC];
    expect(Object.keys(m)).toEqual(['Lore', 'Skills', 'Exploration', 'Activities', 'Combat', 'Completionist']);
    expect(m.Lore['4949 A Sliver of Silver Helps the Sanguine Go Down']).toBe(true);
    expect(m.Lore['2111 Advanced Sweeping']).toBe(false);
    expect(m.Completionist).toEqual({ '1 Quest Cape': false });
    expect(j.help).toContain('"capes"');
  });

  test('an import sets your ticks by their code; the ones that tick themselves are left alone', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await openSettings(page);
    await page.getByRole('button', { name: 'Import state' }).click();
    await page.locator('#bk-text').fill(JSON.stringify({ app: 'Quick Guide', format: 2, capes: { [MQC]: { Lore: { '2111 Advanced Sweeping': true, '4949 A Sliver': false }, Completionist: { '1 Quest Cape': true } } } }));
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Imported 1 cape.');
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({ 2111: 1 });
    // the card shows it at once
    await expect(card(page, 'mqc').locator('.cn')).toHaveText('1 / 23 achievements');
    await card(page, 'mqc').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12');
  });
});

test.describe('more about each achievement', () => {
  test('a cape is read with what each achievement needs and a tip: 20 pages at a time', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    expect(wiki.detailCalls.map((x) => x.length).sort((a, b) => b - a)).toEqual([20, 3]);
    expect(wiki.detailCalls.flat()).toContain("A Cultist's Journey (achievement)");
    const x = (await stored(page, 'cape.mqc')).cheevos.find((y) => y.id === '2111');
    expect(x).toMatchObject({ page: 'Advanced Sweeping', skills: [{ skill: 'Magic', level: 93, boost: true }], also: [] });
    expect(x.tip).toMatch(/^Fully enchant the broomstick/);
    // read once: from storage after that
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
    expect(wiki.detailCalls).toHaveLength(2);
  });

  test('like an area task: what it needs, with your levels, and the tip', async ({ page, wiki }) => {
    withCapes(wiki).setPlayer('Zezima', {}, { 7: 80 });   // Magic 80
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await openCape(page, 'mqc', MQC);
    const sw = cheevo(page, '2111');
    await expect(sw.locator('.need')).toHaveText('Needs 93 Magic (boostable) goal, Swept Away, Diamond in the Rough, Lunar Diplomacy (partial), Underground Pass (partial)');
    await expect(sw.locator('.need')).toHaveClass(/\blow\b/);
    await expect(sw.locator('.need .skl')).toHaveClass(/\blow\b/);
    await expect(sw.locator('.need .mk.no')).toHaveAttribute('title', 'Too low: you have 80');
    await expect(sw.locator('.need .addgoal')).toHaveAttribute('aria-label', 'Add 93 Magic to my list');
    await expect(sw.locator('.howto')).toHaveText(/^Fully enchant the broomstick by bringing it to various magic users around the world\./);
    // nothing it needs: no line
    await expect(cheevo(page, '3612').locator('.need')).toHaveCount(0);
    await expect(cheevo(page, '3612').locator('.howto')).toHaveText(/^Find and read the scruffy note in the Scabarite Cavern\./);
    // one of several
    await expect(cheevo(page, '299').locator('.need')).toContainText('71 Dungeoneering');
    expect(page.errors).toEqual([]);
  });

  test('a quest it needs opens here: a tick when you have done it, a cross when you have not', async ({ page, wiki }) => {
    withCapes(wiki).setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED', 'Rune Mysteries': 'STARTED' }, {});
    const pages = JSON.parse(fixture('cape-achievements.json'));
    const bones = pages["Aereck's Old Bones"];
    wiki.details({ "Aereck's Old Bones": { lead: bones.lead.replace('* [[The Restless Ghost]]', "* [[Cook's Assistant]]\n* [[Rune Mysteries]] (partial)\n* [[Imp Catcher]]"), extract: bones.extract } });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await openCape(page, 'mqc', MQC);
    const need = cheevo(page, '2112').locator('.need');
    await expect(need.locator('.qlink')).toHaveText(["Cook's Assistant", 'Rune Mysteries', 'Imp Catcher']);
    await expect(need).toContainText('Rune Mysteries (partial)');
    await expect(need.locator('.mk.ok')).toHaveCount(1);
    // part of a quest you started may be enough: no mark; one you have not done: a red cross
    await expect(need.locator('.mk.no')).toHaveCount(1);
    await expect(need.locator('.mk.no')).toHaveAttribute('title', 'Not done yet');
    await expect(need).toHaveClass(/\blow\b/);
    await need.locator('.qlink', { hasText: "Cook's Assistant" }).click();
    await expect(page.locator('h1.qt')).toHaveText("Cook's Assistant");
  });

  test('an achievement in two capes says so, and is one tick in both', async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'comp', COMP);
    await page.locator('.tab[data-ctab="other"]').click();
    const a = cheevo(page, '2115');
    await expect(a.locator('.also')).toHaveText('Also counts for the master quest cape');
    await a.locator('.cb').click();
    expect((await stored(page, 'cprog.comp')).ticks).toEqual({ 2115: 1 });
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({ 2115: 1 });
    // and back
    await page.getByRole('button', { name: 'All achievements' }).click();
    await openCape(page, 'mqc', MQC);
    await page.locator('.tab[data-ctab="skills"]').click();
    await expect(cheevo(page, '2543').locator('.also')).toHaveText('Also counts for the completionist cape');
    await cheevo(page, '2543').locator('.cb').click();
    expect((await stored(page, 'cprog.comp')).ticks).toEqual({ 2115: 1, 2543: 1 });
    // one in only one cape stays there
    await page.locator('.tab[data-ctab="lore"]').click();
    await cheevo(page, '2111').locator('.cb').click();
    expect((await stored(page, 'cprog.comp')).ticks).toEqual({ 2115: 1, 2543: 1 });
  });

  test('when the pages cannot be read, the cape still opens, without needs and tips', async ({ page, wiki }) => {
    withCapes(wiki).detailFail = true;
    await openCape(page, 'mqc', MQC);
    await expect(page.locator('li[data-cheevo]').first()).toBeVisible();
    await expect(page.locator('li[data-cheevo] .need')).toHaveCount(0);
    await expect(page.locator('li[data-cheevo] .howto')).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });

  test("the ⋯ menu: Add to list, and the achievement's page on the wiki", async ({ page, wiki }) => {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await cheevo(page, '3224').locator('.rowm').click();
    await expect(page.locator('#tmenu')).toHaveAttribute('aria-label', 'Achievement menu');
    await expect(page.locator('#tmenu .mh')).toHaveText("A Cultist's Journey");
    await expect(page.locator('#tmenu .mi')).toHaveText(['Add to list…', 'Open on the wiki']);
    await expect(page.locator('#tmenu a.mi')).toHaveAttribute('href', W + "A_Cultist's_Journey_(achievement)");
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await expect(page.locator('#td .what')).toHaveText("A Cultist's Journey · Master quest cape");
    await page.locator('#td').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Added to My list.');
    const t = await stored(page, 'todo');
    expect(t.lists[0].items[0]).toMatchObject({ kind: 'cheevo', cape: 'mqc', cheevo: '3224', title: "A Cultist's Journey", page: "A Cultist's Journey (achievement)" });
    // on a list now: the menu can take it off
    await cheevo(page, '3224').locator('.rowm').click();
    await expect(page.locator('#tmenu .mi')).toHaveText(['Remove from My list', 'Open on the wiki']);
    // the count on My list, right there
    await expect(page.locator('.bn[data-home="todo"] .tc')).toHaveText('1');
  });
});

test.describe('achievements on My list', () => {
  async function onList(page, wiki) {
    withCapes(wiki);
    await openCape(page, 'mqc', MQC);
    await cheevo(page, '2111').locator('.rowm').click();
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await page.locator('#td').getByRole('button', { name: 'Add', exact: true }).click();
    await page.locator('.bn[data-home="todo"]').click();
  }
  const goal = (page, title) => page.locator('li.goal').filter({ has: page.locator(':scope > .row .t', { hasText: title }) });

  test('one tick with its cape, both ways', async ({ page, wiki }) => {
    await onList(page, wiki);
    await goal(page, 'Advanced Sweeping').locator(':scope > .row .cb').click();
    await expect(goal(page, 'Advanced Sweeping')).toHaveClass(/\bdone\b/);
    expect((await stored(page, 'cprog.mqc')).ticks).toEqual({ 2111: 1 });
    // untick it in the cape: open again on the list
    await page.locator('.bn[data-home="areas"]').click();
    await card(page, 'mqc').click();
    await openSettings(page);
    await page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' }).click();
    await closeSettings(page);
    await cheevo(page, '2111').locator('.cb').click();
    await page.locator('.bn[data-home="todo"]').click();
    await expect(goal(page, 'Advanced Sweeping')).not.toHaveClass(/\bdone\b/);
  });

  test("its menu opens the cape, or the achievement's page on the wiki", async ({ page, wiki }) => {
    await onList(page, wiki);
    await goal(page, 'Advanced Sweeping').locator('[data-gmenu]').click();
    await expect(page.locator('#tmenu .mi')).toContainText(['Edit', 'Add sub task', 'Open Master quest cape', 'Open on the wiki']);
    await expect(page.locator('#tmenu a.mi', { hasText: 'Open on the wiki' })).toHaveAttribute('href', W + 'Advanced_Sweeping');
    await page.locator('#tmenu .mi', { hasText: 'Open Master quest cape' }).click();
    await expect(page.locator('h1.qt')).toHaveText(MQC);
  });

  test('in the export as "Achievement 2111: …", and an import makes it again', async ({ page, wiki }) => {
    await onList(page, wiki);
    await openSettings(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    await expect(page.locator('#bk-text')).not.toHaveValue('');
    const j = JSON.parse(await page.locator('#bk-text').inputValue());
    expect(j.mylist['My list']).toEqual({ 'Achievement 2111: Advanced Sweeping (Master quest cape)': false });
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Import state' }).click();
    await page.locator('#bk-text').fill(JSON.stringify({ app: 'Quick Guide', format: 2, mylist: { Capes: { 'Achievement 2115: Annihilator (Completionist cape)': true } } }));
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    const t = await stored(page, 'todo');
    expect(t.lists.map((l) => l.name)).toEqual(['Capes']);
    expect(t.lists[0].items[0]).toMatchObject({ kind: 'cheevo', cape: 'comp', cheevo: '2115', title: 'Annihilator' });
    // (like an area task, its tick comes from "capes" in the file, not from the list)
  });
});

test.describe('one of these levels', () => {
  for (const [levels, ok] of [[{ 3: 70 }, true], [{ 3: 50, 17: 40 }, false]]) {
    test(ok ? 'a tick when you have one of them' : 'a cross when you have none of them', async ({ page, wiki }) => {
      withCapes(wiki).setPlayer('Zezima', {}, Object.assign({ 4: 99 }, levels));   // Constitution 99, Strength and Agility
      await openApp(page, expect);
      await lookUp(page, 'Zezima');
      await expect(page.locator('#player')).toContainText('Zezima');
      await closeSettings(page);
      await openCape(page, 'trim', TRIM);
      await page.locator('.tab[data-ctab="other"]').click();
      const need = cheevo(page, '1679').locator('.need');
      await expect(need).toContainText('60 Strength or 60 Agility');
      await expect(need.locator('.mk')).toHaveCount(2);   // Constitution, and the group
      await expect(need.locator('.mk').last()).toHaveClass(ok ? /\bok\b/ : /\bno\b/);
      await expect(need.locator('.mk').last()).toHaveAttribute('title', ok ? 'You have one of these' : 'Too low: you have none of these');
      if (ok) await expect(need).not.toHaveClass(/\blow\b/); else await expect(need).toHaveClass(/\blow\b/);
    });
  }
});
