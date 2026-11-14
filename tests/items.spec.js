// The Items tab: Required and Recommended items, each with a tick box.
const { test, expect, stored, openQuest, openTab, item } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';

test.beforeEach(async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
});

test('the note, then Required and Recommended with counts', async ({ page }) => {
  await expect(page.locator('#main .note')).toHaveText('Tool belt items are not listed.');
  await expect(page.locator('#main .bh')).toHaveText(['Required 0 / 3', 'Recommended 0 / 2']);
  await expect(page.locator('#main li[data-item] > .row .t')).toHaveText([
    'A lit sapphire lantern', 'Ring of charos (a)', 'Runes for 4 casts of NPC Contact',
    'Games necklace', 'Ardougne Teleport'
  ]);
  await expect(item(page, 'Ring of charos').locator('.alt')).toHaveText('or 5,000 coins');
  await expect(item(page, 'Runes for 4 casts').locator('.alt')).toHaveText('8 air, 4 astral, 4 cosmic');
});

test('ticking an item counts it, hides it and saves it', async ({ page }) => {
  await item(page, 'sapphire lantern').locator('.cb').click();
  await expect(page.locator('#main .bh').first()).toHaveText('Required 1 / 3');
  await expect(item(page, 'sapphire lantern')).toBeHidden();
  const p = await stored(page, 'prog.' + WGS);
  expect(Object.keys(p.items)).toEqual([expect.stringMatching(/^req:/)]);
  await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
  await page.reload();
  await expect(page.locator('#main .bh').first()).toHaveText('Required 1 / 3');
});

test('a click anywhere on the row ticks it, but a link still works as a link', async ({ page }) => {
  await item(page, 'Ardougne Teleport').locator('.rb').click({ position: { x: 250, y: 8 } });
  await expect(page.locator('#main .bh').nth(1)).toHaveText('Recommended 1 / 2');
  const popup = page.waitForEvent('popup');
  await item(page, 'Games necklace').locator('a').click();
  expect((await popup).url()).toBe('https://runescape.wiki/w/Games_necklace');
  await expect(page.locator('#main .bh').nth(1)).toHaveText('Recommended 1 / 2');
});

test('with "Show done steps" on, ticked items stay, and can be unticked', async ({ page }) => {
  await page.locator('#cog-btn').click();
  await page.getByRole('menuitemcheckbox', { name: 'Show done steps' }).click();
  await page.keyboard.press('Escape');
  const lantern = item(page, 'sapphire lantern');
  await lantern.locator('.cb').click();
  await expect(lantern).toBeVisible();
  await expect(lantern).toHaveClass(/\bdone\b/);
  await expect(lantern.locator('.cb')).toBeChecked();
  await lantern.locator('.cb').click();
  await expect(lantern.locator('.cb')).not.toBeChecked();
  await expect(page.locator('#main .bh').first()).toHaveText('Required 0 / 3');
});

test('a guide with only required items', async ({ page }) => {
  await page.getByRole('button', { name: 'All quests' }).click();
  await openQuest(page, expect, "Cook's Assistant");
  await openTab(page, 'items');
  await expect(page.locator('#main .bh')).toHaveText(['Required 0 / 2']);
  await expect(page.locator('#main .note')).toHaveCount(0);
});

test('a guide with no items says so', async ({ page }) => {
  await page.getByRole('button', { name: 'All quests' }).click();
  await openQuest(page, expect, 'Rune Mysteries');
  await openTab(page, 'items');
  await expect(page.locator('#main .empty')).toHaveText('This guide lists no items.');
});
