// Export and import: everything you ticked, as text you can keep, edit and put back.
const { test, expect, fixture, seed, stored, openApp, openQuest, openTab, step, item, openCog, closeCog, areaPage } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';

function withAreas(wiki) {
  wiki.page('Ardougne achievements', fixture('ardougne-achievements.html'));
  return wiki;
}
async function exportText(page) {
  await openCog(page);
  await page.getByRole('button', { name: 'Export state' }).click();
  const t = await page.locator('#bk-text').inputValue();
  await page.getByRole('button', { name: 'Close' }).click();
  return t;
}
async function importText(page, text) {
  await openCog(page);
  await page.getByRole('button', { name: 'Import state' }).click();
  await page.locator('#bk-text').fill(text);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
}
// Some ticks in a quest and in an area, a player and a changed setting.
async function someState(page, wiki) {
  wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' }, { 7: 80 });
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
  await item(page, 'sapphire lantern').locator('.cb').click();
  await openTab(page, 'steps');
  await step(page, 'In Taverley').locator('.cb').first().click();
  await openCog(page);
  await page.locator('#player-name').fill('Zezima');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('#cog #player')).toContainText('Zezima');
  await page.getByRole('menuitemcheckbox', { name: 'Hide completed' }).click();
  await closeCog(page);
  await page.getByRole('button', { name: 'All quests' }).click();
  await page.locator('.tab[data-home="areas"]').click();
  await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
  await page.locator('#next-btn').click();
  await page.locator('#next-btn').click();
  await expect(page.locator('#pg-cnt')).toHaveText('2 / 23 tasks');
  await page.getByRole('button', { name: 'All areas' }).click();
}

test.describe('the settings', () => {
  test('end with a Backup part: Export state and Import state', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await expect(page.locator('#cog .mh')).toHaveText(['Player', 'Lists', 'Display', 'Backup']);
    const last = page.locator('#cog > *').last();
    await expect(page.locator('#cog .mi').last()).toHaveText('Import state');
    await expect(page.locator('#cog .mi').nth(-2)).toHaveText('Export state');
    await expect(last).toHaveText('Import state');
  });

  test('they are there inside a quest and inside an area too', async ({ page, wiki }) => {
    withAreas(wiki);
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openCog(page);
    await expect(page.getByRole('button', { name: 'Export state' })).toBeVisible();
    await closeCog(page);
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"]').first().click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await openCog(page);
    await expect(page.getByRole('button', { name: 'Import state' })).toBeVisible();
  });
});

test.describe('export', () => {
  test('is text with a clear structure: settings, player, quests and areas', async ({ page, wiki }) => {
    withAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const text = await exportText(page);
    const j = JSON.parse(text);
    expect(Object.keys(j)).toEqual(['app', 'format', 'exportedAt', 'settings', 'player', 'quests', 'areas']);
    expect(j).toMatchObject({ app: 'Quick Guide', format: 1 });
    expect(Date.parse(j.exportedAt)).toBeGreaterThan(Date.now() - 60000);
    expect(j.settings).toEqual({ showDone: false, hideDone: true, hideLocked: false, hideMini: false, fontSize: 14, sort: 'name', home: 'areas' });
    expect(j.player).toMatchObject({ name: 'Zezima', done: 1, levels: { magic: 80 } });
    expect(Object.keys(j.quests)).toEqual(['While Guthix Sleeps']);
    const q = j.quests['While Guthix Sleeps'];
    expect(Object.keys(q)).toEqual(['page', 'progress', 'steps', 'items', 'view']);
    expect(q.page).toBe(WGS);
    expect(q.progress).toEqual({ done: 1, total: 12 });
    expect(Object.keys(q.steps)).toHaveLength(1);
    expect(Object.values(q.steps)[0]).toContain('In Taverley');            // an id and what it is, so you can read it
    expect(Object.values(q.items)[0]).toContain('sapphire lantern');
    expect(q.view).toMatchObject({ tab: 'steps' });
    expect(Object.keys(j.areas)).toEqual(['Ardougne']);
    expect(j.areas.Ardougne).toEqual({
      tier: 'easy',
      tiers: { easy: { done: 2, total: 23 }, medium: { done: 0, total: 16 }, hard: { done: 0, total: 17 }, elite: { done: 0, total: 5 } },
      tasks: { 447: 'The Essence of Magic', 448: 'Yoink!' }
    });
  });

  test('is easy to read and change: indented, one thing per line', async ({ page, wiki }) => {
    withAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const text = await exportText(page);
    expect(text).toContain('\n  "settings": {\n    "showDone": false,');
    expect(text.split('\n').length).toBeGreaterThan(30);
    expect(text.endsWith('}')).toBe(true);
  });

  test('with nothing yet: settings, no player, no quests, no areas', async ({ page }) => {
    await openApp(page, expect);
    const j = JSON.parse(await exportText(page));
    expect(j).toMatchObject({ app: 'Quick Guide', format: 1, player: null, quests: {}, areas: {} });
    expect(j.settings.fontSize).toBe(14);
  });

  test('Copy uses the clipboard', async ({ page }) => {
    // the test site is plain http, where a browser hides the clipboard: put a fake one there
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } } }); });
    await openApp(page, expect);
    await openCog(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    expect(await page.evaluate(() => window.__clip)).toBe(await page.locator('#bk-text').inputValue());
  });

  test('Copy still works without the clipboard (Alt1 or an old browser): the text is selected and copied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
      document.execCommand = (c) => { const e = document.activeElement; window.__copy = [c, e.value.slice(e.selectionStart, e.selectionEnd)]; return true; };
    });
    await openApp(page, expect);
    await openCog(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    const [cmd, text] = await page.evaluate(() => window.__copy);
    expect(cmd).toBe('copy');
    expect(text).toBe(await page.locator('#bk-text').inputValue());
  });

  test('Save file is a download of the same text', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    const a = page.locator('#bk-save');
    await expect(a).toHaveAttribute('download', 'quick-guide.json');
    const href = await a.getAttribute('href');
    expect(href.startsWith('data:application/json')).toBe(true);
    expect(decodeURIComponent(href.split(',').slice(1).join(','))).toBe(await page.locator('#bk-text').inputValue());
  });

  test('the box closes with Close, Escape or a click outside; the settings are not left open', async ({ page }) => {
    await openApp(page, expect);
    for (const how of ['button', 'escape', 'outside']) {
      await openCog(page);
      await page.getByRole('button', { name: 'Export state' }).click();
      await expect(page.locator('#bk')).toBeVisible();
      await expect(page.locator('#cog')).toBeHidden();
      if (how === 'button') await page.getByRole('button', { name: 'Close' }).click();
      else if (how === 'escape') await page.keyboard.press('Escape');
      else await page.locator('#bk').click({ position: { x: 3, y: 3 } });
      await expect(page.locator('#bk')).toHaveCount(0);
    }
  });
});

test.describe('import', () => {
  const sample = () => JSON.stringify({
    app: 'Quick Guide', format: 1, exportedAt: '2026-11-14T12:00:00.000Z',
    settings: { showDone: true, hideDone: true, hideLocked: true, hideMini: true, fontSize: 18, sort: 'opt', home: 'areas' },
    player: { name: 'Zezima', at: '2026-11-14T10:00:00.000Z', done: 1, started: 0, quests: { cooksassistant: 2 }, locked: {}, levels: { magic: 80 } },
    quests: { 'While Guthix Sleeps': { page: WGS, progress: { done: 3, total: 12 }, steps: { 'a:1': 'one', 'a:2': 'two', 'a:3': 'three' }, items: { 'req:1': 'lantern' }, view: { tab: 'items', open: { 'ov:skills': false }, acc: {} } } },
    areas: { Ardougne: { tier: 'medium', tiers: { easy: { done: 2, total: 23 }, medium: { done: 1, total: 16 } }, tasks: { 447: 'The Essence of Magic', 448: 'Yoink!', 470: 'A Visit to Charlie' } } }
  });

  test('puts everything back on a fresh start', async ({ page }) => {
    await openApp(page, expect);
    await importText(page, sample());
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest and 1 area.');
    await expect(page.locator('#bk')).toHaveCount(0);
    expect(await stored(page, 'settings')).toEqual({ showDone: true, hideDone: true, hideLocked: true, hideMini: true, fontSize: 18, sort: 'opt', home: 'areas' });
    expect((await stored(page, 'player')).name).toBe('Zezima');
    expect(await stored(page, 'prog.' + WGS)).toEqual({ steps: { 'a:1': 1, 'a:2': 1, 'a:3': 1 }, items: { 'req:1': 1 }, tab: 'items', open: { 'ov:skills': false }, acc: {} });
    expect((await stored(page, 'meta'))[WGS]).toMatchObject({ title: 'While Guthix Sleeps', done: 3, total: 12 });
    expect(await stored(page, 'aprog.Ardougne')).toEqual({ tasks: { 447: 1, 448: 1, 470: 1 }, tier: 'medium' });
    const m = (await stored(page, 'ameta')).Ardougne.tiers;
    expect(m.map((t) => [t.id, t.done, t.total])).toEqual([['easy', 2, 23], ['medium', 1, 16]]);
    await expect(page.locator('html')).toHaveCSS('font-size', '18px');
  });

  test('the lists show the imported progress without reading the wiki again', async ({ page, wiki }) => {
    await openApp(page, expect);
    await importText(page, sample());
    await expect(page.locator('.tab[data-home="areas"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="medium"] .qs')).toHaveText('1 / 16');
    await page.locator('.tab[data-home="quests"]').click();
    await openCog(page);
    await page.getByRole('menuitemcheckbox', { name: 'Hide miniquests' }).click();   // off again
    await page.getByRole('menuitemcheckbox', { name: 'Hide completed' }).click();    // off again
    await closeCog(page);
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"] .qs')).toHaveText('3 / 12');
    // no guide and no area page was needed to show it
    expect(wiki.asked().filter((x) => /Quick guide| achievements/.test(x))).toEqual([]);
  });

  test('a round trip gives the same text', async ({ page, wiki, context }) => {
    withAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const first = await exportText(page);
    const other = await context.newPage();
    other.errors = [];
    await seed(other, {});
    await openApp(other, expect);
    await importText(other, first);
    await expect(other.locator('#toast')).toHaveText('Imported 1 quest and 1 area.');
    const second = await exportText(other);
    // what a step or task is called comes from the guide, which this fresh start has not read yet: compare the rest
    const strip = (t) => {
      const j = JSON.parse(t);
      j.exportedAt = '';
      for (const q of Object.values(j.quests)) { for (const k of ['steps', 'items']) Object.keys(q[k]).forEach((i) => { q[k][i] = ''; }); }
      for (const a of Object.values(j.areas)) Object.keys(a.tasks).forEach((i) => { a.tasks[i] = ''; });
      return j;
    };
    expect(strip(second)).toEqual(strip(first));
  });

  test('replaces the ticks of the quests and areas in it, and leaves the others', async ({ page, wiki }) => {
    withAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const j = JSON.parse(await exportText(page));
    // take one tick out by hand, and save it
    delete j.areas.Ardougne.tasks['448'];
    await seed(page, { 'prog.Other/Quick guide': { steps: { 'x:1': 1 } } });
    await openApp(page, expect);
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 447: 1 });
    expect(await stored(page, 'prog.Other/Quick guide')).toEqual({ steps: { 'x:1': 1 } });
  });

  test('a file can be chosen instead of pasting', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await page.getByRole('button', { name: 'Import state' }).click();
    await page.locator('#bk-file').setInputFiles({ name: 'quick-guide.json', mimeType: 'application/json', buffer: Buffer.from(sample()) });
    await expect(page.locator('#bk-text')).toHaveValue(sample());
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest and 1 area.');
  });

  test('only what the app knows is used: bad values are dropped', async ({ page }) => {
    const j = JSON.parse(sample());
    j.settings = { fontSize: 999, sort: 'nonsense', hideDone: 'yes', home: 'elsewhere', extra: 1 };
    j.areas.Atlantis = { tasks: { 1: 'x' } };
    j.quests.Broken = { page: 'Broken/Quick guide', steps: 'not a map' };
    j.quests.NoPage = { steps: { 'a:1': 'one' } };
    await openApp(page, expect);
    await importText(page, JSON.stringify(j));
    await expect(page.locator('#toast')).toHaveText('Imported 3 quests and 1 area.');
    expect(await stored(page, 'settings')).toEqual({ showDone: false, hideDone: false, hideLocked: false, hideMini: false, fontSize: 40, sort: 'name', home: 'quests' });
    expect(await stored(page, 'aprog.Atlantis')).toBeNull();
    expect(await stored(page, 'prog.Broken/Quick guide')).toEqual({ steps: {}, items: {}, tab: 'overview', open: {}, acc: {} });
    expect((await stored(page, 'prog.NoPage/Quick guide')).steps).toEqual({ 'a:1': 1 });
  });

  const bad = [
    ['', 'Paste an export first.'],
    ['{ nope', 'That is not valid JSON'],
    ['[1, 2]', 'That is not a Quick Guide export.'],
    ['{"a": 1}', 'That is not a Quick Guide export.'],
    ['{"app": "Quick Guide", "format": 2}', 'This export is from a newer version of the app.']
  ];
  for (const [text, message] of bad) {
    test('says what is wrong with "' + text.slice(0, 20) + '", and changes nothing', async ({ page }) => {
      await seed(page, { settings: { fontSize: 16 } });
      await openApp(page, expect);
      await importText(page, text);
      await expect(page.locator('#bk-err')).toContainText(message);
      await expect(page.locator('#bk')).toBeVisible();
      await expect(page.locator('#bk-text')).toHaveValue(text);   // your text stays, so you can fix it
      expect(await stored(page, 'settings')).toEqual({ fontSize: 16 });
    });
  }

  test('works inside a quest too: you go back to the list with the new state', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await importText(page, sample());
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest and 1 area.');
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    expect(page.errors).toEqual([]);
  });
});
