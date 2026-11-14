// The quest screen: title band, progress, tabs, the two menus, text size, refresh and reset.
const { test, expect, fixture, seed, stored, openApp, openQuest, openTab, step, parsedQuest } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const toast = (page) => page.locator('#toast');
const tabs = (page) => page.getByRole('tab');

async function tickFirstPart(page) {
  await openTab(page, 'steps');
  for (const t of ['In Taverley', 'Go upstairs', 'Talk to Radimus']) await step(page, t).locator('.cb').first().click();
}

test.describe('title band, progress and tabs', () => {
  test('shows the quest name, the progress and three tabs', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await expect(page.locator('h1.qt')).toHaveAttribute('title', 'While Guthix Sleeps');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
    await expect(tabs(page)).toHaveText(['Overview', 'Items', 'Steps']);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'All quests' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quest menu' })).toBeVisible();
  });

  test('progress counts ticked main steps', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12 steps');
    await expect(page.locator('#pg')).toHaveJSProperty('value', 3);
    await expect(page.locator('#pg')).toHaveJSProperty('max', 12);
  });

  test('one step: "1 / 1 step"', async ({ page, wiki }) => {
    wiki.page('Tiny quest/Quick guide', '<h2>Part</h2><ul><li>Do it.</li></ul>');
    await openApp(page, expect);
    await page.locator('#quest-link').fill('tiny quest');
    await page.locator('#quest-link').press('Enter');
    await openTab(page, 'steps');
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 1 step');
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
  test('one menu at a time; a click outside or Escape closes it', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const cog = page.locator('#cog'), dots = page.locator('#menu');
    await page.locator('#cog-btn').click();
    await expect(cog).toBeVisible();
    await expect(page.locator('#cog-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#menu-btn').click();
    await expect(dots).toBeVisible();
    await expect(cog).toBeHidden();
    await expect(page.locator('#cog-btn')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('h1.qt').click();
    await expect(dots).toBeHidden();
    await page.locator('#cog-btn').click();
    await page.keyboard.press('Escape');
    await expect(cog).toBeHidden();
    // the same button closes it again
    await page.locator('#menu-btn').click();
    await page.locator('#menu-btn').click();
    await expect(dots).toBeHidden();
  });

  test('the settings menu: in a quest, and on the start screen', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#cog-btn').click();
    await expect(page.locator('#cog .mi')).toHaveText(['Jump to next step', 'Show done steps', /Text size\s*14/, 'Update quest list']);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('#cog-btn').click();
    await expect(page.locator('#cog .mi')).toHaveText(['Show done steps', /Text size\s*14/, 'Update quest list']);
    await expect(page.locator('#cog')).not.toContainText('Compact');
  });

  test('text size: bigger and smaller, 12 to 40, remembered', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#cog-btn').click();
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

  test('show done steps: on and off, remembered', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#cog-btn').click();
    const t = page.getByRole('menuitemcheckbox', { name: 'Show done steps' });
    await expect(t).toHaveAttribute('aria-checked', 'false');
    await t.click();
    await expect(t).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#main')).toHaveClass(/\bshow-done\b/);
    expect((await stored(page, 'settings')).showDone).toBe(true);
    await t.click();
    await expect(page.locator('#main')).not.toHaveClass(/\bshow-done\b/);
    expect((await stored(page, 'settings')).showDone).toBe(false);
  });

  test('jump to next step: goes to Steps and puts the next step at the top', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await tickFirstPart(page);
    await openTab(page, 'overview');
    await page.locator('#cog-btn').click();
    await page.getByRole('button', { name: 'Jump to next step' }).click();
    await expect(page.getByRole('tab', { name: 'Steps' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#cog')).toBeHidden();
    const cur = page.locator('li.step.cur');
    await expect(cur).toContainText('Talk to the Hunting expert');
    await expect(cur).toBeInViewport();
  });

  test('update quest list', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#cog-btn').click();
    await page.getByRole('button', { name: 'Update quest list' }).click();
    await expect(toast(page)).toHaveText('Quest list updated.');
    expect(wiki.asked().filter((x) => x === 'List of quests')).toHaveLength(2);
    wiki.fail('List of quests', 'network');
    await page.locator('#cog-btn').click();
    await page.getByRole('button', { name: 'Update quest list' }).click();
    await expect(toast(page)).toHaveText('Could not update the quest list. Could not reach the wiki. Check your internet, then try again.');
  });

  test('update quest list shows a message while it works', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    wiki.fail('List of quests', 'slow');
    await page.locator('#cog-btn').click();
    await page.getByRole('button', { name: 'Update quest list' }).click();
    await expect(toast(page)).toHaveText('Updating the quest list…');
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
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 13 steps');
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
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12 steps');
    await reset.click();
    await expect(toast(page)).toHaveText('Progress reset.');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
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
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12 steps');
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
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12 steps');
  });
});

test.describe('saved guides from older versions', () => {
  test('are read again quietly when opened', async ({ page, wiki }) => {
    const q = await parsedQuest(page, 'while-guthix-sleeps.html', WGS);
    q.version = 2;
    await seed(page, { ['quest.' + WGS]: q, last: WGS, list: { at: Date.now(), quests: [] } });
    await page.goto('/');
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect.poll(async () => (await stored(page, 'quest.' + WGS)).version).toBe(3);
    expect(wiki.asked()).toEqual([WGS]);
    await expect(toast(page)).toBeHidden();
  });
});
