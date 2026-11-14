// The start screen: the list of all quests, search, sorting, groups, and opening a quest.
const { test, expect, fixture, seed, stored, openApp, parsedQuest } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const list = (page) => page.locator('#qarea');
const groups = (page) => page.locator('.ghb .n');
const names = (page) => page.locator('.q .q1 b');

test.describe('the quest list', () => {
  test('is read from the wiki on first start, and saved', async ({ page, wiki }) => {
    await openApp(page, expect);
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(wiki.asked()).toEqual(['List of quests']);
    const saved = await stored(page, 'list');
    expect(saved.quests).toHaveLength(11);
    expect(Date.now() - saved.at).toBeLessThan(60000);
  });

  test('shows a message while it loads', async ({ page, wiki }) => {
    wiki.fail('List of quests', 'slow');
    await page.goto('/');
    await expect(page.locator('.state')).toHaveText('Getting the quest list…');
  });

  test('shows an error and can try again', async ({ page, wiki }) => {
    wiki.fail('List of quests', 'http');
    await page.goto('/');
    await expect(page.locator('#qarea .err')).toHaveText('Could not get the quest list. The server answered with an error (500). Try again in a moment.');
    wiki.page('List of quests', fixture('list-of-quests.html'));
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('#qcount')).toHaveText('11 quests');
  });

  test('a saved list is used, and read again quietly after a week', async ({ page, wiki }) => {
    const old = { at: Date.now() - 8 * 24 * 3600 * 1000, quests: [{ t: 'Old quest', dif: 'Novice' }] };
    await seed(page, { list: old });
    await page.goto('/');
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(wiki.asked()).toEqual(['List of quests']);
  });

  test('a fresh saved list is not read again', async ({ page, wiki }) => {
    await seed(page, { list: { at: Date.now() - 3600 * 1000, quests: [{ t: 'Fresh quest', dif: 'Novice' }] } });
    await page.goto('/');
    await expect(page.locator('#qcount')).toHaveText('1 quest');
    await expect(names(page)).toHaveText(['Fresh quest']);
    expect(wiki.asked()).toEqual([]);
  });

  test('rows show difficulty, length, members and quest points', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"] .q2')).toHaveText('Grandmaster · Very, Very Long · Members · 5 QP');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"] .q2")).toHaveText('Novice · Short · Free · 1 QP');
    await expect(page.locator('.q[data-quest="101 Test Quest"] .q2')).toHaveText('Special · Very Short · Free');
  });

  test('the footer credits the wiki and offers to add the app to Alt1', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('a[href="alt1://addapp/http://quick-guide.test/appconfig.json"]')).toHaveText('Add this app to Alt1');
    await expect(page.locator('.foot a[href="https://runescape.wiki/"]')).toHaveText('RuneScape Wiki');
  });
});

test.describe('sorting and groups', () => {
  test('A to Z, grouped by first letter; numbers go under #', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('#sort')).toHaveValue('name');
    await expect(groups(page)).toHaveText(['#', 'C', 'D', 'I', 'P', 'R', 'W']);
    await expect(names(page)).toHaveText(['101 Test Quest', "Cook's Assistant", 'Demon Slayer', 'Desert Treasure', 'Dragon Slayer', 'Druidic Ritual',
      'Imp Catcher', "'Phite Club", 'Recipe for Disaster: Freeing King Awowogei', 'Rune Mysteries', 'While Guthix Sleeps']);
    await expect(page.locator('.ghb[data-group="D"] .c')).toHaveText('4');
  });

  const sorts = [
    ['dif', ['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster', 'Special']],
    ['len', ['Very Short', 'Short', 'Medium', 'Long', 'Very, Very Long']],
    ['ser', ['Delrith', 'Mahjarrat', 'Recipe for Disaster', 'Rune Mysteries', 'Wizards', 'No series']],
    ['rel', ['2020', '2014', '2009', '2006', '2005', '2002', '2001']]
  ];
  for (const [value, want] of sorts) {
    test('sort by ' + value, async ({ page }) => {
      await openApp(page, expect);
      await page.locator('#sort').selectOption(value);
      await expect(groups(page)).toHaveText(want);
    });
  }

  test('inside a group, quests are A to Z', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#sort').selectOption('dif');
    await expect(page.locator('.ghb[data-group="Novice"]').locator('xpath=../following-sibling::ul[1]').locator('.q1 b'))
      .toHaveText(["Cook's Assistant", 'Demon Slayer', 'Druidic Ritual', 'Imp Catcher', 'Rune Mysteries']);
  });

  test('the sort order is remembered', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#sort').selectOption('len');
    expect((await stored(page, 'settings')).sort).toBe('len');
    await page.reload();
    await expect(page.locator('#sort')).toHaveValue('len');
    await expect(groups(page).first()).toHaveText('Very Short');
  });

  test('a group folds shut and opens again', async ({ page }) => {
    await openApp(page, expect);
    const head = page.locator('.ghb[data-group="D"]');
    const body = head.locator('xpath=../following-sibling::ul[1]');
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(body).toBeHidden();
    await head.click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(body).toBeVisible();
  });

  test('quests in progress come first, in their own group', async ({ page }) => {
    await seed(page, { meta: { [WGS]: { title: 'While Guthix Sleeps', done: 4, total: 12, at: 1 }, "Cook's Assistant/Quick guide": { title: "Cook's Assistant", done: 4, total: 4, at: 2 } } });
    await openApp(page, expect);
    await expect(groups(page).first()).toHaveText('In progress');
    await expect(page.locator('.ghb[data-group="In progress"] .c')).toHaveText('1');
    const row = page.locator('.q[data-quest="While Guthix Sleeps"]');
    await expect(row.locator('.qs')).toHaveText('4 / 12');
    await expect(row.locator('progress')).toHaveJSProperty('value', 4);
    // started: yellow, like the game's quest list
    await expect(row.locator('.q1 b')).toHaveCSS('color', 'rgb(245, 225, 90)');
    // the same order with another sort
    await page.locator('#sort').selectOption('rel');
    await expect(groups(page).first()).toHaveText('In progress');
  });

  test('done quests are green, with a tick', async ({ page }) => {
    await seed(page, { meta: { "Cook's Assistant/Quick guide": { title: "Cook's Assistant", done: 4, total: 4, at: 2 } } });
    await openApp(page, expect);
    const row = page.locator(".q[data-quest=\"Cook's Assistant\"]");
    await expect(row).toHaveClass(/\bdone\b/);
    await expect(row.locator('.qs.ok')).toHaveText('✓ 4 / 4');
    await expect(row.locator('.q1 b')).toHaveCSS('color', 'rgb(102, 211, 92)');
    await expect(row.locator('progress')).toHaveCount(0);
    await expect(groups(page)).not.toContainText(['In progress']);
  });
});

test.describe('search', () => {
  test('filters the list as you type, and keeps your typing', async ({ page }) => {
    await openApp(page, expect);
    const box = page.locator('#quest-link');
    await box.pressSequentially('slay');
    await expect(names(page)).toHaveText(['Demon Slayer', 'Dragon Slayer']);
    await expect(page.locator('#qcount')).toHaveText('2 of 11 quests');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('slay');
  });

  test('says when nothing matches', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').fill('zzz');
    await expect(page.locator('#qarea .empty')).toHaveText('No quests match “zzz”.');
  });

  test('Open picks the best match: exact name, then names that start with it, then the rest', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').fill('cook');
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('h1.qt')).toHaveText("Cook's Assistant");
    expect(wiki.asked()).toContain("Cook's Assistant/Quick guide");
  });

  test('Enter opens a match found inside a name', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').fill('guthix');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  });

});

test.describe('opening a quest', () => {
  test('from the list: read from the wiki once, then saved', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    expect(wiki.asked()).toEqual(['List of quests', WGS]);
    expect((await stored(page, 'quest.' + WGS)).title).toBe('While Guthix Sleeps');
    expect(await stored(page, 'last')).toBe(WGS);
    expect((await stored(page, 'meta'))[WGS]).toMatchObject({ title: 'While Guthix Sleeps', done: 0, total: 12 });
    // back to the list, and open it again: no second visit to the wiki
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    expect(wiki.asked()).toEqual(['List of quests', WGS]);
  });

  test('a saved quest whose guide was dropped is read again', async ({ page, wiki }) => {
    await seed(page, { meta: { [WGS]: { title: 'While Guthix Sleeps', done: 2, total: 14, at: 1 } } });
    await openApp(page, expect);
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    expect(wiki.asked()).toContain(WGS);
  });

  test('shows a message while the guide loads, and blocks the box', async ({ page, wiki }) => {
    wiki.fail('Imp Catcher/Quick guide', 'slow');
    await openApp(page, expect);
    await page.locator('.q[data-quest="Imp Catcher"]').click();
    await expect(page.locator('.state')).toHaveText('Reading “Imp Catcher” from the wiki…');
    await expect(page.locator('#quest-link')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Open' })).toBeDisabled();
  });

  test('a quest without a quick guide uses its main page', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('.q[data-quest="Rune Mysteries"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Rune Mysteries');
    expect(wiki.asked()).toEqual(['List of quests', 'Rune Mysteries/Quick guide', 'Rune Mysteries']);
    await expect(page.locator('#main .note').first()).toHaveText('This quest has no Quick guide on the wiki, so this is its full page.');
  });

  test('the error goes away when you type', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('#load-err')).toBeVisible();
    await page.locator('#quest-link').pressSequentially('d');
    await expect(page.locator('#load-err')).toBeHidden();
    await expect(page.locator('#quest-link')).not.toHaveClass(/\bbad\b/);
  });

  const loadErrors = [
    ['missing', 'The wiki has no page for this quest yet.'],
    ['http', 'The wiki answered with error 500. Try again in a moment.'],
    ['network', 'Could not reach the wiki. Check your internet, then try again.'],
    ['format', 'The wiki sent something unexpected. Try again in a moment.']
  ];
  for (const [how, message] of loadErrors) {
    test('wiki error: ' + how, async ({ page, wiki }) => {
      if (how === 'missing') wiki.missing('Imp Catcher/Quick guide').missing('Imp Catcher');
      else wiki.fail('Imp Catcher/Quick guide', how);
      await openApp(page, expect);
      await page.locator('.q[data-quest="Imp Catcher"]').click();
      await expect(page.locator('#load-err')).toHaveText(message);
    });
  }

  test('wiki error: too slow', async ({ page, wiki }) => {
    wiki.fail('Imp Catcher/Quick guide', 'slow');
    await page.clock.install();
    await openApp(page, expect);
    await page.locator('.q[data-quest="Imp Catcher"]').click();
    await expect(page.locator('.state')).toBeVisible();
    await page.clock.runFor(26000);
    await expect(page.locator('#load-err')).toHaveText('The wiki took too long to answer. Try again.');
  });

  test('a saved guide opens without the wiki', async ({ page, wiki }) => {
    const q = await parsedQuest(page, 'while-guthix-sleeps.html', WGS);
    await seed(page, { ['quest.' + WGS]: q, meta: { [WGS]: { title: q.title, done: 0, total: 14, at: 1 } }, list: { at: Date.now(), quests: [{ t: 'While Guthix Sleeps' }] } });
    await page.goto('/');
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    expect(wiki.asked()).toEqual([]);
  });
});
