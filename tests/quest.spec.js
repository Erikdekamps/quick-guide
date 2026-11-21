// The quest screen: title band, progress, tabs, the two menus, text size, refresh and reset.
const { test, expect, fixture, seed, stored, openQuest, openTab, step, item, parsedQuest } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const toast = (page) => page.locator('#toast');
const tabs = (page) => page.locator('.tab[data-tab]');

async function tickFirstPart(page) {
  await openTab(page, 'steps');
  for (const t of ['In Taverley', 'Go upstairs', 'Talk to Radimus']) await step(page, t).locator('.cb').first().click();
}

test.describe('title band, progress and tabs', () => {
  test('shows the quest name, the progress and three tabs', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await expect(page.locator('h1.qt')).toHaveAttribute('title', 'While Guthix Sleeps');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12');
    await expect(tabs(page).locator('.tl-l')).toHaveText(['Overview', 'Items', 'Steps']);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'All quests' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quest menu' })).toBeVisible();
  });

  test('progress counts ticked main steps', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12');
    await expect(page.locator('#pg')).toHaveJSProperty('value', 3);
    await expect(page.locator('#pg')).toHaveJSProperty('max', 12);
  });

  test('one step: "1 / 1"; a guide with no items has no count on Items', async ({ page, wiki }) => {
    wiki.page('Imp Catcher/Quick guide', '<h2>Part</h2><ul><li>Do it.</li></ul>');
    await openQuest(page, expect, 'Imp Catcher');
    await openTab(page, 'steps');
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 1');
    await expect(page.locator('.tab[data-tab="items"] .tcn')).toHaveCount(0);
    await expect(page.locator('.tab[data-tab="items"]')).toHaveText('Items');
  });

  test('the counts under the tab names: the steps you did on Steps, the items you have on Items', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const count = (t) => page.locator('.tab[data-tab="' + t + '"] .tcn');
    await expect(count('overview')).toHaveCount(0);
    await expect(count('items')).toHaveText('0 / 5');
    await expect(count('steps')).toHaveText('0 / 12');
    // all three tabs are as tall, with a count or not
    const h = await Promise.all(['overview', 'items', 'steps'].map(async (t) => (await page.locator('.tab[data-tab="' + t + '"]').boundingBox()).height));
    expect(new Set(h).size).toBe(1);
    await tickFirstPart(page);
    await expect(count('steps')).toHaveText('3 / 12');
    // ticking an item changes the count at once, without drawing the tabs again
    await openTab(page, 'items');
    const before = await count('items').elementHandle();
    await item(page, 'sapphire lantern').locator('.cb').click();
    await expect(count('items')).toHaveText('1 / 5');
    expect(await before.evaluate((e) => e.isConnected)).toBe(true);
    await expect(count('steps')).toHaveText('3 / 12');
    // and they are the same after a reload
    await page.reload();
    await expect(count('items')).toHaveText('1 / 5');
    await expect(count('steps')).toHaveText('3 / 12');
  });

  test('tabs switch, and each quest remembers its tab', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'items');
    await expect(page.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#main .bh').first()).toContainText('Required');
    expect((await stored(page, 'prog.' + WGS)).tab).toBe('items');
    // another quest starts on Overview
    await page.getByRole('button', { name: 'All quests' }).click();
    await openQuest(page, expect, "Cook's Assistant");
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    // and the first one is still on Items
    await page.getByRole('button', { name: 'All quests' }).click();
    await openQuest(page, expect, 'While Guthix Sleeps');
    await expect(page.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the last quest opens again after a reload, on the same tab', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect(page.getByRole('tab', { name: 'Steps' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the back button goes to all quests, where the quest is now in progress', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await page.getByRole('button', { name: 'All quests' }).click();
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    await expect(page.locator('.ghb .n').first()).toHaveText('In progress');
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"] .qs')).toHaveText('3 / 12');
  });

  test('a long quest name stops after two lines', async ({ page }) => {
    const q = await parsedQuest(page, 'cooks-assistant.html', "Cook's Assistant/Quick guide");
    q.title = 'Recipe for Disaster: Freeing King Awowogei and a very long name that goes on';
    await seed(page, { ['quest.' + q.page]: q, last: q.page, list: { at: Date.now(), quests: [] } });
    await page.setViewportSize({ width: 280, height: 600 });
    await page.goto('/');
    const title = page.locator('h1.qt');
    await expect(title).toHaveAttribute('title', q.title);
    const box = await title.boundingBox();
    const lh = parseFloat(await title.evaluate((e) => getComputedStyle(e).lineHeight));
    expect(box.height).toBeLessThanOrEqual(2 * lh + 1);
  });
});

test.describe('menus', () => {
  test('the quest menu: a click outside, Escape or its own button closes it; so does Settings', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const dots = page.locator('#menu');
    // the quest's menu is in the title band, next to the name; the cog is not there any more
    await expect(page.locator('.hdr #menu-btn')).toBeVisible();
    await expect(page.locator('.hdr [aria-label="Settings"]')).toHaveCount(0);
    await page.locator('#menu-btn').click();
    await expect(dots).toBeVisible();
    await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.hdr .qt').click();
    await expect(dots).toBeHidden();
    await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
    // Escape closes the menu, and the quest stays
    await page.locator('#menu-btn').click();
    await page.keyboard.press('Escape');
    await expect(dots).toBeHidden();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    // the same button closes it again
    await page.locator('#menu-btn').click();
    await page.locator('#menu-btn').click();
    await expect(dots).toBeHidden();
    // Settings in the bar takes its place
    await page.locator('#menu-btn').click();
    await page.locator('.bn[data-home="settings"]').click();
    await expect(page.locator('#settings')).toBeVisible();
    await expect(dots).toHaveCount(0);
  });

  test('Settings: the same screen from a quest and from the start screen; Jump to next step is in the quest menu', async ({ page }) => {
    const rows = ['Done quests and tiers', 'Miniquests', 'Locked quests and tiers', 'Done steps and tasks', /^Sort by/, /^Theme/, /Text size\s*14/, 'Update from the wiki', 'Export state', 'Import state', 'Delete everything'];
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.bn[data-home="settings"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Settings');
    await expect(page.locator('#settings .mh')).toHaveText(['Player', 'Show', 'Lists', 'Display', 'Backup', 'Danger zone']);
    await expect(page.locator('#settings .mi')).toHaveText(rows);
    await expect(page.locator('#settings #player-name')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu .mi')).toHaveText(['Jump to next step', 'Add to list…', 'Refresh from wiki', 'Open on wiki', 'Reset progress']);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.bn[data-home="settings"]').click();
    await expect(page.locator('#settings .mi')).toHaveText(rows);
    await expect(page.locator('#settings')).not.toContainText('Compact');
  });

  test('text size: bigger and smaller, 12 to 40, remembered', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.bn[data-home="settings"]').click();
    const up = page.getByRole('button', { name: 'Bigger text' }), down = page.getByRole('button', { name: 'Smaller text' });
    await up.click();
    await expect(page.locator('#fsv')).toHaveText('16');
    await expect(page.locator('html')).toHaveCSS('font-size', '16px');
    expect((await stored(page, 'settings')).fontSize).toBe(16);
    for (let i = 0; i < 2; i++) await down.click();
    await expect(page.locator('#fsv')).toHaveText('12');
    await expect(down).toBeDisabled();
    for (let i = 0; i < 14; i++) await up.click();
    await expect(page.locator('#fsv')).toHaveText('40');
    await expect(up).toBeDisabled();
    await page.reload();
    await expect(page.locator('html')).toHaveCSS('font-size', '40px');
  });

  test('the text size setting is kept within 12 to 40', async ({ page }) => {
    await seed(page, { settings: { fontSize: 99 } });
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('font-size', '40px');
  });

  test('done steps and tasks: shown and hidden again, remembered', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.bn[data-home="settings"]').click();
    const t = page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' });
    await expect(t).toHaveAttribute('aria-checked', 'false');
    await t.click();
    await expect(t).toHaveAttribute('aria-checked', 'true');
    expect((await stored(page, 'settings')).showDone).toBe(true);
    // back in the quest, it shows
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#main')).toHaveClass(/\bshow-done\b/);
    await page.locator('.bn[data-home="settings"]').click();
    await t.click();
    expect((await stored(page, 'settings')).showDone).toBe(false);
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#main')).not.toHaveClass(/\bshow-done\b/);
  });

  test('jump to next step: goes to Steps and puts the next step at the top', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await openTab(page, 'overview');
    await page.locator('#menu-btn').click();
    await page.getByRole('menuitem', { name: 'Jump to next step' }).click();
    await expect(page.getByRole('tab', { name: 'Steps' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#menu')).toBeHidden();
    const cur = page.locator('li.step.cur');
    await expect(cur).toContainText('Talk to the Hunting expert');
    await expect(cur).toBeInViewport();
  });

  test('update from the wiki reads the quest list again', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.bn[data-home="settings"]').click();
    await page.getByRole('button', { name: 'Update from the wiki' }).click();
    await expect(toast(page)).toHaveText('Everything is up to date.');
    expect(wiki.asked().filter((x) => x === 'List of quests')).toHaveLength(2);
    wiki.fail('List of quests', 'network');
    await page.getByRole('button', { name: 'Update from the wiki' }).click();
    await expect(toast(page)).toHaveText('Could not update the quest list. Could not reach the wiki. Check your internet, then try again.');
  });

  test('update from the wiki shows a message while it works', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    wiki.fail('List of quests', 'slow');
    await page.locator('.bn[data-home="settings"]').click();
    await page.getByRole('button', { name: 'Update from the wiki' }).click();
    await expect(toast(page)).toHaveText('Checking the wiki…');
    await expect(page.getByRole('button', { name: 'Update from the wiki' })).toBeDisabled();
  });
});

test.describe('the quest menu', () => {
  test('open on the wiki', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#menu-btn').click();
    const link = page.getByRole('menuitem', { name: 'Open on wiki' });
    await expect(link).toHaveAttribute('href', 'https://runescape.wiki/w/While_Guthix_Sleeps/Quick_guide');
    await expect(link).toHaveAttribute('target', '_blank');
    const popup = page.waitForEvent('popup');
    await link.click();
    expect((await popup).url()).toBe('https://runescape.wiki/w/While_Guthix_Sleeps/Quick_guide');
    await expect(page.locator('#menu')).toBeHidden();
  });

  test('refresh from the wiki: new text comes in, ticks stay', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    wiki.page(WGS, fixture('while-guthix-sleeps.html').replace('<li>Follow the spy to the bar.</li>', '<li>Follow the spy to the bar.</li><li>A new step.</li>'));
    await page.locator('#menu-btn').click();
    await page.getByRole('menuitem', { name: 'Refresh from wiki' }).click();
    await expect(toast(page)).toHaveText('Updated from the wiki.');
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 13');
    expect(wiki.asked().filter((x) => x === WGS)).toHaveLength(2);
  });

  test('refresh shows a message while it works', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    wiki.fail(WGS, 'slow');
    await page.locator('#menu-btn').click();
    await page.getByRole('menuitem', { name: 'Refresh from wiki' }).click();
    await expect(toast(page)).toHaveText('Reading the wiki…');
  });

  test('refresh can fail, and says so', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    wiki.fail(WGS, 'network');
    await page.locator('#menu-btn').click();
    await page.getByRole('menuitem', { name: 'Refresh from wiki' }).click();
    await expect(toast(page)).toHaveText('Could not update. Could not reach the wiki. Check your internet, then try again.');
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  });

  test('a message goes away by itself', async ({ page }) => {
    await page.clock.install();
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#menu-btn').click();
    await page.getByRole('menuitem', { name: 'Refresh from wiki' }).click();
    await expect(toast(page)).toHaveText('Updated from the wiki.');
    await page.clock.runFor(3000);
    await expect(toast(page)).toBeHidden();
  });

  test('reset progress needs a second click', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await page.locator('#menu-btn').click();
    const reset = page.locator('[data-act="reset"]');
    await reset.click();
    await expect(reset).toHaveText('Click again to reset');
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12');
    await reset.click();
    await expect(toast(page)).toHaveText('Progress reset.');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12');
    expect((await stored(page, 'prog.' + WGS)).steps).toEqual({});
  });

  test('closing the menu cancels a reset', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await page.locator('#menu-btn').click();
    const reset = page.locator('[data-act="reset"]');
    await reset.click();
    await page.keyboard.press('Escape');
    await page.locator('#menu-btn').click();
    await expect(reset).toHaveText('Reset progress');
    await reset.click();
    await expect(reset).toHaveText('Click again to reset');
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12');
  });

  test('a reset click runs out after 4 seconds', async ({ page }) => {
    await page.clock.install();
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await page.locator('#menu-btn').click();
    const reset = page.locator('[data-act="reset"]');
    await reset.click();
    await page.clock.runFor(4500);
    await reset.click();
    await expect(reset).toHaveText('Click again to reset');
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12');
  });
});

test.describe('saved guides from older versions', () => {
  test('are read again quietly when opened', async ({ page, wiki }) => {
    const q = await parsedQuest(page, 'while-guthix-sleeps.html', WGS);
    q.version = 2;
    await seed(page, { ['quest.' + WGS]: q, last: WGS, list: { at: Date.now(), quests: [] } });
    await page.goto('/');
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect.poll(async () => (await stored(page, 'quest.' + WGS)).version).toBe(4);
    expect(wiki.asked()).toEqual([WGS]);
    await expect(toast(page)).toBeHidden();
  });
});
