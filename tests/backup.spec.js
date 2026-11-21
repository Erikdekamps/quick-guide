// Export and import: everything as a JSON file you can download, change by hand, and import again.
const fs = require('fs');
const { test, expect, seed, stored, openApp, openQuest, openTab, step, item, openSettings, closeSettings, withAllAreas, AREAS } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';

async function openExport(page) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Export state' }).click();
  await expect(page.locator('#bk-text')).not.toHaveValue('');
}
async function exportText(page) {
  await openExport(page);
  const t = await page.locator('#bk-text').inputValue();
  await page.getByRole('button', { name: 'Close' }).click();
  return t;
}
async function importText(page, text) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Import state' }).click();
  await page.locator('#bk-text').fill(text);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
}
async function importFile(page, text) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Import state' }).click();
  await page.locator('#bk-file').setInputFiles({ name: 'quick-guide.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#bk-text')).toHaveValue(text);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
}
// Some ticks in a quest and in an area, a player and a changed setting.
async function someState(page, wiki) {
  // Two parts of a bigger quest, which the wiki's quest list does not have: the game counts them on their own.
  wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED', 'Recipe for Disaster: Freeing Evil Dave': 'COMPLETED', 'Recipe for Disaster: Freeing Pirate Pete': 'STARTED' }, { 7: 80 });
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
  await item(page, 'sapphire lantern').locator('.cb').click();
  await openTab(page, 'steps');
  await step(page, 'In Taverley').locator('.cb').first().click();
  await openSettings(page);
  await page.locator('#player-name').fill('Zezima');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('#settings #player')).toContainText('Zezima');
  await page.getByRole('menuitemcheckbox', { name: 'Done quests and tiers' }).click();
  await closeSettings(page);
  await page.getByRole('button', { name: 'All quests' }).click();
  await page.locator('.bn[data-home="areas"]').click();
  await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
  await page.locator('#next-btn').click();
  await page.locator('#next-btn').click();
  await expect(page.locator('#pg-cnt')).toHaveText('2 / 23');
  await page.getByRole('button', { name: 'All achievements' }).click();
}
const key = (map, start) => Object.keys(map).find((k) => k.startsWith(start));

test.describe('the settings', () => {
  test('end with a Backup part: Export state and Import state', async ({ page }) => {
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#settings .mh')).toHaveText(['Player', 'Show', 'Lists', 'Display', 'Backup', 'Danger zone']);
    await expect(page.locator('#settings .mi').nth(-3)).toHaveText('Export state');
    await expect(page.locator('#settings .mi').nth(-2)).toHaveText('Import state');
  });

  test('they are there inside a quest and inside an area too', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openSettings(page);
    await expect(page.getByRole('button', { name: 'Export state' })).toBeVisible();
    await closeSettings(page);
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"]').first().click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await openSettings(page);
    await expect(page.getByRole('button', { name: 'Import state' })).toBeVisible();
  });
});

test.describe('export', () => {
  test('Download file gives a .json file with the same text', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await openExport(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download file' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^quick-guide-\d{4}-\d{2}-\d{2}\.json$/);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    expect(text).toBe(await page.locator('#bk-text').inputValue());
    expect(JSON.parse(text).app).toBe('Quick Guide');
  });

  test('a done quest is just true, without its steps', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    await page.evaluate(() => window.QuickGuideApp.setMarked('While Guthix Sleeps', true));
    const j = JSON.parse(await exportText(page));
    expect(j.quests['While Guthix Sleeps']).toBe(true);
  });

  test('lists every quest and every area task, done or not, so you can change them', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const j = JSON.parse(await exportText(page));
    expect(Object.keys(j)).toEqual(['app', 'format', 'exportedAt', 'help', 'settings', 'player', 'quests', 'tiers', 'areas', 'capes', 'mylist']);
    expect(j).toMatchObject({ app: 'Quick Guide', format: 2 });
    expect(j.help).toContain('true');
    expect(j.settings).toEqual({ showDone: false, hideDone: true, hideLocked: false, hideMini: false, fontSize: 14, sort: 'name', home: 'areas', theme: 'brown' });
    expect(j.player).toMatchObject({ name: 'Zezima', done: 2 });
    // every quest in the list, by name: true when it is done
    expect(j.quests["Cook's Assistant"]).toBe(true);
    expect(j.quests['Imp Catcher']).toBe(false);
    // and the quests the game knows that are not in the list (parts of a bigger quest), so the file has as many done
    // quests as the game says
    expect(Object.keys(j.quests)).toHaveLength(13);
    expect(j.quests['Recipe for Disaster: Freeing Evil Dave']).toBe(true);
    expect(j.quests['Recipe for Disaster: Freeing Pirate Pete']).toBe(false);
    expect(Object.values(j.quests).filter((v) => v === true || v.done === true)).toHaveLength(j.player.done);
    // each tier's count, as the game shows it, to read at a glance (an import does not use it)
    expect(Object.keys(j.tiers)).toEqual(AREAS);
    expect(j.tiers.Ardougne).toEqual({ Easy: '2 / 23', Medium: '0 / 16', Hard: '0 / 17', Elite: '0 / 5' });
    // a quest whose guide is saved lists each step and item: its code, what it says, and whether it is done
    const w = j.quests['While Guthix Sleeps'];
    expect(Object.keys(w)).toEqual(['done', 'progress', 'steps', 'items']);
    expect(w).toMatchObject({ done: false, progress: '1 / 12' });
    expect(Object.values(w.steps).filter((v) => v === true)).toHaveLength(1);
    expect(Object.keys(w.steps).length).toBeGreaterThan(12);
    expect(w.steps[key(w.steps, 'starting-out')]).toBeDefined();
    expect(Object.entries(w.steps).find(([k]) => k.includes('In Taverley'))[1]).toBe(true);
    expect(Object.entries(w.items).find(([k]) => k.includes('sapphire lantern'))[1]).toBe(true);
    // every area, every tier, every task
    expect(Object.keys(j.areas)).toEqual(AREAS);
    const e = j.areas.Ardougne;
    expect(Object.keys(e)).toEqual(['Easy', 'Medium', 'Hard', 'Elite']);
    expect(Object.keys(e.Easy)).toHaveLength(23);
    expect(e.Easy['447 The Essence of Magic']).toBe(true);
    expect(e.Easy['448 Yoink!']).toBe(true);
    expect(e.Easy['449 Silky Smooth']).toBe(false);
    // a task with steps: done, and each step
    const red = j.areas.Varrock.Elite['993 Red, Red Pies of Summer'];
    expect(Object.keys(red)).toEqual(['done', 'steps']);
    expect(red.done).toBe(false);
    expect(Object.keys(red.steps)).toHaveLength(4);
    expect(Object.keys(red.steps)[0]).toMatch(/^993:1 Make pastry dough/);
    // each step says all it says: nothing is cut off
    for (const k of Object.keys(w.steps)) expect(k).not.toMatch(/…$/);
    expect(Math.max(...Object.keys(w.steps).map((k) => k.length))).toBeGreaterThan(100);
  });

  test('reads the areas it has not read yet first, so all their tasks are in it', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await openExport(page);
    expect(wiki.asked().filter((x) => / achievements$/.test(x)).sort()).toEqual(AREAS.map((n) => n + ' achievements').sort());
    const j = JSON.parse(await page.locator('#bk-text').inputValue());
    expect(Object.keys(j.areas)).toEqual(AREAS);
    expect(j.areas.Desert.Easy).toEqual({ '5001 Desert filler task': false });
  });

  test('an area that cannot be read is left out, and it says so', async ({ page, wiki }) => {
    withAllAreas(wiki).fail('Desert achievements', 'http');
    await openApp(page, expect);
    await openExport(page);
    await expect(page.locator('#bk-note')).toHaveText('Could not read Desert, so its tasks are not in the file.');
    const j = JSON.parse(await page.locator('#bk-text').inputValue());
    expect(Object.keys(j.areas)).not.toContain('Desert');
    expect(Object.keys(j.areas)).toHaveLength(12);
  });

  test('is easy to read and change: indented, one thing per line', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    const text = await exportText(page);
    expect(text).toContain('\n  "settings": {\n    "showDone": false,');
    expect(text).toContain('\n        "447 The Essence of Magic": false,\n');
    expect(text.endsWith('}')).toBe(true);
  });

  test('Copy uses the clipboard', async ({ page, wiki }) => {
    withAllAreas(wiki);
    // the test site is plain http, where a browser hides the clipboard: put a fake one there
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } } }); });
    await openApp(page, expect);
    await openExport(page);
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    expect(await page.evaluate(() => window.__clip)).toBe(await page.locator('#bk-text').inputValue());
  });

  test('Copy still works without the clipboard (Alt1 or an old browser): the text is selected and copied', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
      document.execCommand = (c) => { const e = document.activeElement; window.__copy = [c, e.value.slice(e.selectionStart, e.selectionEnd)]; return true; };
    });
    await openApp(page, expect);
    await openExport(page);
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    const [cmd, text] = await page.evaluate(() => window.__copy);
    expect(cmd).toBe('copy');
    expect(text).toBe(await page.locator('#bk-text').inputValue());
  });

  test('the box closes with Close, Escape or a click outside, back to Settings', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    for (const how of ['button', 'escape', 'outside']) {
      await openExport(page);
      if (how === 'button') await page.getByRole('button', { name: 'Close' }).click();
      else if (how === 'escape') await page.keyboard.press('Escape');
      else await page.locator('#bk').click({ position: { x: 3, y: 3 } });
      await expect(page.locator('#bk')).toHaveCount(0);
      await expect(page.locator('#settings')).toBeVisible();
    }
  });
});

test.describe('import', () => {
  test('change the file by hand: true marks done, false undoes it', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const j = JSON.parse(await exportText(page));
    j.areas.Ardougne.Easy['449 Silky Smooth'] = true;     // done now
    j.areas.Ardougne.Easy['448 Yoink!'] = false;          // not done after all
    j.quests['Imp Catcher'] = true;                        // a whole quest
    const w = j.quests['While Guthix Sleeps'];
    const taverley = Object.keys(w.steps).find((k) => k.includes('In Taverley'));
    w.steps[taverley] = false;
    const other = Object.keys(w.steps).find((k) => w.steps[k] === false && k !== taverley && !k.includes(':', k.indexOf(' ')) && k.split(' ')[0].split(':').length === 2);
    w.steps[other] = true;
    await importFile(page, JSON.stringify(j, null, 2));
    await expect(page.locator('#toast')).toHaveText('Imported 13 quests and 13 areas.');
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 447: 1, 449: 1 });
    expect(await stored(page, 'qdone')).toEqual({ impcatcher: 1 });
    expect((await stored(page, 'prog.' + WGS)).steps).toEqual({ [other.split(' ')[0]]: 1 });
    // the lists show it
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="easy"] .qs')).toHaveText('2 / 23');
    await page.locator('.bn[data-home="quests"]').click();
    await openSettings(page);
    await page.getByRole('menuitemcheckbox', { name: 'Done quests and tiers' }).click();   // ticked again, to see done quests
    await closeSettings(page);
    await expect(page.locator('.q[data-quest="Imp Catcher"]')).toHaveClass(/\bdone\b/);
    await expect(page.locator('.q[data-quest="Imp Catcher"] .qs')).toHaveText('✓ Done');
  });

  test('a task with steps: tick steps one by one, or the whole task', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    const j = JSON.parse(await exportText(page));
    const red = j.areas.Varrock.Elite['993 Red, Red Pies of Summer'];
    const steps = Object.keys(red.steps);
    red.steps[steps[0]] = true;
    red.steps[steps[1]] = true;
    j.areas.Varrock.Elite[Object.keys(j.areas.Varrock.Elite).find((k) => k.startsWith('994 '))] = true;
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, 994: 1 });
    red.steps[steps[2]] = false;
    red.done = true;
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1, 994: 1 });
  });

  test('a task can be named without its code', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await exportText(page);   // reads the areas
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, areas: { Ardougne: { Easy: { 'Yoink!': true, 'Silky Smooth': true } } } }));
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1, 449: 1 });
  });

  test('a fresh start: everything comes back', async ({ page, wiki, context }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await someState(page, wiki);
    const first = await exportText(page);
    const other = await context.newPage();
    await seed(other, {});
    await openApp(other, expect);
    await importText(other, first);
    await expect(other.locator('#toast')).toHaveText('Imported 13 quests and 13 areas.');
    const second = await exportText(other);
    // what each step of a quest says comes from its guide, which this fresh start has not read yet: compare what is ticked
    const strip = (t) => {
      const j = JSON.parse(t);
      j.exportedAt = '';
      for (const [n, q] of Object.entries(j.quests)) {
        if (typeof q !== 'object') continue;
        j.quests[n] = { done: q.done, progress: q.progress, steps: Object.keys(q.steps).filter((k) => q.steps[k]).map((k) => k.split(' ')[0]), items: Object.keys(q.items).filter((k) => q.items[k]).map((k) => k.split(' ')[0]) };
      }
      return j;
    };
    expect(strip(second)).toEqual(strip(first));
  });

  test('areas that are not in the file keep their ticks', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { 'aprog.Desert': { tasks: { 5001: 1 } } });
    await openApp(page, expect);
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, areas: { Ardougne: { Easy: { '447 The Essence of Magic': true } } } }));
    await expect(page.locator('#toast')).toHaveText('Imported 1 area.');
    expect((await stored(page, 'aprog.Desert')).tasks).toEqual({ 5001: 1 });
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 447: 1 });
  });

  test('only what the app knows is used: bad values are dropped', async ({ page }) => {
    await openApp(page, expect);
    await importText(page, JSON.stringify({
      app: 'Quick Guide', format: 2,
      settings: { fontSize: 999, sort: 'nonsense', hideDone: 'yes', home: 'elsewhere', theme: 'pink', extra: 1 },
      quests: { 'Imp Catcher': 'yes', "Cook's Assistant": true },
      areas: { Atlantis: { Easy: { '1 x': true } }, Ardougne: 'all of it' }
    }));
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest.');
    expect(await stored(page, 'settings')).toEqual({ showDone: false, hideDone: false, hideLocked: false, hideMini: false, fontSize: 40, sort: 'name', home: 'quests', theme: 'brown' });
    expect(await stored(page, 'qdone')).toEqual({ cooksassistant: 1 });
    expect(await stored(page, 'aprog.Atlantis')).toBeNull();
    expect(await stored(page, 'aprog.Ardougne')).toBeNull();
  });

  test('ticks of a quest whose guide is not saved (any more) still go out and come back', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, {});
    await page.evaluate(() => localStorage.setItem('qg1.prog.Imp Catcher/Quick guide', JSON.stringify({ steps: { 'part:1': 1, 'part:2': 0 }, items: { 'req:1x': 1 } })));
    await openApp(page, expect);
    const j = JSON.parse(await exportText(page));
    // Without the guide, the app does not know what the steps say: only their codes, and only the ticked ones.
    expect(j.quests['Imp Catcher']).toEqual({ done: false, steps: { 'part:1': true }, items: { 'req:1x': true } });
    // Import it with the count of steps from the file.
    j.quests['Imp Catcher'] = { progress: '3 / 10', steps: { 'part:1': true, 'part:2': true, 'part:3': true } };
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'prog.Imp Catcher/Quick guide')).steps).toEqual({ 'part:1': 1, 'part:2': 1, 'part:3': 1 });
    expect((await stored(page, 'meta'))['Imp Catcher/Quick guide']).toMatchObject({ title: 'Imp Catcher', done: 3, total: 10 });
    await expect(page.locator('.q[data-quest="Imp Catcher"] .qs')).toHaveText('3 / 10');
  });

  test('a file from the first version (format 1) still imports', async ({ page }) => {
    await openApp(page, expect);
    await importText(page, JSON.stringify({
      app: 'Quick Guide', format: 1,
      quests: { 'While Guthix Sleeps': { page: WGS, progress: { done: 3, total: 12 }, steps: { 'a:1': 'one', 'a:2': 'two', 'a:3': 'three' }, items: {}, view: { tab: 'items' } } },
      areas: { Ardougne: { tier: 'medium', tiers: { easy: { done: 2, total: 23 } }, tasks: { 447: 'The Essence of Magic', 448: 'Yoink!' } } }
    }));
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest and 1 area.');
    expect((await stored(page, 'prog.' + WGS)).steps).toEqual({ 'a:1': 1, 'a:2': 1, 'a:3': 1 });
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 447: 1, 448: 1 });
  });

  const bad = [
    ['', 'Paste an export first.'],
    ['{ nope', 'That is not valid JSON'],
    ['[1, 2]', 'That is not a Quick Guide export.'],
    ['{"a": 1}', 'That is not a Quick Guide export.'],
    ['{"app": "Quick Guide", "format": 3}', 'This export is from a newer version of the app.'],
    ['{"app":"Quick Guide","format":2,"settings":{"fontSize":20},"mylist":{"Today":["Vis wax"]}}', 'There is a mistake in the lists. mylist \u2192 "Today" must look like { "a goal": true }.']
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
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, quests: { 'Imp Catcher': true } }));
    await expect(page.locator('#toast')).toHaveText('Imported 1 quest.');
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    expect(page.errors).toEqual([]);
  });
});

test.describe('danger zone', () => {
  const all = async (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('qg1.')).map((k) => k.slice(4)).sort());
  async function lots(page) {
    await seed(page, {
      settings: { fontSize: 18, home: 'areas', hideDone: true, theme: 'blue' }, player: { name: 'Zezima', quests: { cooksassistant: 2 }, levels: {}, done: 1, started: 0 },
      [ 'prog.' + WGS ]: { steps: { 'a:1': 1 } }, meta: { [WGS]: { title: 'While Guthix Sleeps', done: 1, total: 12, at: 1 } },
      'aprog.Ardougne': { tasks: { 447: 1 } }, qdone: { impcatcher: 1 }, last: 'nothing'
    });
  }

  test('is the last part of the settings: Delete everything, in red', async ({ page }) => {
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#settings .mh').last()).toHaveText('Danger zone');
    const del = page.locator('#settings .mi').last();
    await expect(del).toHaveText('Delete everything');
    await expect(del).toHaveClass(/\bdanger\b/);
    await expect(del).toHaveCSS('color', 'rgb(255, 91, 73)');
  });

  test('the first click only asks again; closing the settings cancels it', async ({ page }) => {
    await lots(page);
    await openApp(page, expect);
    await openSettings(page);
    const before = await all(page);   // opening Settings saves the view: a reload opens it again
    await page.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.locator('[data-act="wipe"]')).toHaveText('Click again to delete everything');
    expect(await all(page)).toEqual(before);
    await closeSettings(page);
    await openSettings(page);
    await expect(page.locator('[data-act="wipe"]')).toHaveText('Delete everything');
    expect(await all(page)).toEqual(before);
  });

  test('the second click deletes everything: ticks, guides, areas, settings and the player', async ({ page }) => {
    await lots(page);
    await openApp(page, expect);
    await expect(page.locator('html')).toHaveCSS('font-size', '18px');
    await openSettings(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    await expect(page.locator('#toast')).toHaveText('Everything is deleted.');
    // the app starts again: the quest list is read again from the wiki, and nothing else is saved
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(await all(page)).toEqual(['list']);
    await expect(page.locator('html')).toHaveCSS('font-size', '14px');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'brown');
    await expect(page.locator('.bn[data-home="quests"]')).toHaveAttribute('aria-current', 'page');
    await openSettings(page);
    await expect(page.locator('#player-name')).toBeVisible();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Done quests and tiers' })).toHaveAttribute('aria-checked', 'true');
    await closeSettings(page);
    await expect(page.locator('.q[data-quest="Imp Catcher"]')).not.toHaveClass(/\bdone\b/);
    expect(page.errors).toEqual([]);
  });

  test('works inside a quest too: you are back at the start', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openSettings(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    // the quest list is read again from the wiki: wait for it, then nothing else is saved
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    await expect.poll(() => all(page)).toEqual(['list']);
    // a reload does not open the old quest
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
  });

  test('the second click must come soon: after 4 seconds it asks again', async ({ page }) => {
    await page.clock.install();
    await lots(page);
    await openApp(page, expect);
    await openSettings(page);
    const before = await all(page);
    await page.locator('[data-act="wipe"]').click();
    await page.clock.runFor(5000);
    await page.locator('[data-act="wipe"]').click();
    await expect(page.locator('[data-act="wipe"]')).toHaveText('Click again to delete everything');
    expect(await all(page)).toEqual(before);
  });
});
