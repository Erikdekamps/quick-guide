// The Steps tab: parts, ticking, sub-steps, chat options, "Bring" boxes, boxes for pictures,
// maps and tables, "Done, next step", and the "Show done steps" setting.
const { test, expect, stored, openQuest, openTab, step, item, part } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const tick = (page, text) => step(page, text).locator(':scope > .row > .cb').click();
const head = (page, title) => part(page, title).locator('.sech');
const box = (scope, label) => scope.locator('details.acc').filter({ has: scope.page().locator('summary .sl', { hasText: label }) }).first();

async function showDone(page) {
  await page.locator('#cog-btn').click();
  await page.getByRole('menuitemcheckbox', { name: 'Show done steps' }).click();
  await page.keyboard.press('Escape');
}

test.beforeEach(async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'steps');
});

test('parts with counts; only the part with the next step is open', async ({ page }) => {
  await expect(page.locator('.sech .n')).toHaveText(['Starting out', "Finding Movario's base", "Catching Lucien's spy"]);
  await expect(page.locator('.sech .c')).toHaveText(['0 / 3', '0 / 7', '0 / 2']);
  await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'true');
  await expect(head(page, "Finding Movario's base")).toHaveAttribute('aria-expanded', 'false');
  await expect(part(page, "Finding Movario's base").locator('.secb')).toBeHidden();
  await expect(page.locator('li.step.cur')).toHaveCount(1);
  await expect(page.locator('li.step.cur > .row .t')).toContainText('In Taverley');
  await expect(page.locator('#next-btn')).toHaveText('Done, next step');
});

test.describe('ticking', () => {
  test('with the tick box: the step goes away and the next one is next', async ({ page }) => {
    await tick(page, 'In Taverley');
    await expect(step(page, 'In Taverley')).toBeHidden();
    await expect(page.locator('li.step.cur > .row .t')).toContainText('Go upstairs');
    await expect(head(page, 'Starting out').locator('.c')).toHaveText('1 / 3');
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
    const p = await stored(page, 'prog.' + WGS);
    expect(Object.keys(p.steps)).toEqual([expect.stringMatching(/^starting-out:/)]);
    expect((await stored(page, 'meta'))[WGS]).toMatchObject({ done: 1, total: 12 });
  });

  test('a click anywhere on the row works too', async ({ page }) => {
    await step(page, 'Go upstairs').locator('.row').click({ position: { x: 300, y: 10 } });
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
    await expect(step(page, 'Go upstairs')).toBeHidden();
  });

  test('a link in a step opens the wiki and does not tick', async ({ page }) => {
    const popup = page.waitForEvent('popup');
    await step(page, 'Go upstairs').locator('a', { hasText: 'Thaerisk Cemphier' }).click();
    expect((await popup).url()).toBe('https://runescape.wiki/w/Thaerisk_Cemphier');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
  });

  test('selecting text in a step does not tick it', async ({ page }) => {
    const t = step(page, 'Go upstairs').locator('.t');
    const b = await t.boundingBox();
    await page.mouse.move(b.x + 2, b.y + 6);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 4, b.y + 6, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => String(window.getSelection()).length)).toBeGreaterThan(3);
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
  });

  test('the next step moves to the top, just under the part name', async ({ page }) => {
    await tick(page, 'In Taverley');
    await tick(page, 'Go upstairs');
    const gap = await page.evaluate(() => {
      const main = document.getElementById('main'), cur = main.querySelector('li.step.cur'), sh = cur.closest('.sec').querySelector('.sh');
      return cur.getBoundingClientRect().top - main.getBoundingClientRect().top - (sh.offsetHeight - 1);
    });
    expect(Math.abs(gap)).toBeLessThanOrEqual(3);
  });

  test('"Done, next step" ticks the next step', async ({ page }) => {
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
    await expect(page.locator('li.step.cur > .row .t')).toContainText('Go upstairs');
  });

  test('a finished part folds shut and the next part opens', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.locator('#next-btn').click();
    await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'false');
    await expect(head(page, 'Starting out')).toHaveClass(/\bdone\b/);
    await expect(head(page, 'Starting out').locator('.c')).toHaveText('✓ 3 / 3');
    await expect(head(page, "Finding Movario's base")).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('li.step.cur > .row .t')).toContainText('Talk to the Hunting expert');
  });

  test('the last step: "All steps done" and "Quest complete!"', async ({ page }) => {
    await page.getByRole('button', { name: 'All quests' }).click();
    await openQuest(page, expect, "Cook's Assistant");
    await openTab(page, 'steps');
    await expect(page.locator('#complete')).toBeHidden();
    for (let i = 0; i < 4; i++) await page.locator('#next-btn').click();
    await expect(page.locator('#next-btn')).toBeDisabled();
    await expect(page.locator('#next-btn')).toHaveText('All steps done');
    await expect(page.locator('#complete')).toBeVisible();
    await expect(page.locator('#complete')).toHaveText('Quest complete!All 4 steps done.');
    await expect(page.locator('#pg-cnt')).toHaveText('4 / 4 steps');
    await page.getByRole('button', { name: 'All quests' }).click();
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"] .qs")).toHaveText('✓ 4 / 4');
  });
});

test.describe('with "Show done steps" on', () => {
  test('ticked steps stay, with a tick, and a finished part stays open', async ({ page }) => {
    await showDone(page);
    for (let i = 0; i < 3; i++) await page.locator('#next-btn').click();
    await expect(step(page, 'In Taverley')).toBeVisible();
    await expect(step(page, 'In Taverley')).toHaveClass(/\bdone\b/);
    await expect(step(page, 'In Taverley').locator(':scope > .row > .cb')).toBeChecked();
    await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'true');
    await expect(head(page, "Finding Movario's base")).toHaveAttribute('aria-expanded', 'true');
    await page.reload();
    await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'true');
  });

  test('untick a step: it is the next step again', async ({ page }) => {
    await showDone(page);
    for (let i = 0; i < 4; i++) await page.locator('#next-btn').click();
    await tick(page, 'Go upstairs');
    await expect(page.locator('li.step.cur > .row .t')).toContainText('Go upstairs');
    await expect(head(page, 'Starting out').locator('.c')).toHaveText('2 / 3');
    await expect(page.locator('#pg-cnt')).toHaveText('3 / 12 steps');
  });

  test('"Done, next step" opens the part of the next step, even if you closed it', async ({ page }) => {
    await showDone(page);
    await head(page, 'Starting out').click();
    await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#next-btn').click();
    await expect(head(page, 'Starting out')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('li.step.cur > .row .t')).toContainText('Go upstairs');
  });
});

test.describe('parts', () => {
  test('open and close by hand, remembered', async ({ page }) => {
    const h = head(page, "Catching Lucien's spy");
    await h.click();
    await expect(h).toHaveAttribute('aria-expanded', 'true');
    await expect(step(page, 'Follow the spy')).toBeVisible();
    await page.reload();
    await expect(h).toHaveAttribute('aria-expanded', 'true');
    await h.click();
    await expect(h).toHaveAttribute('aria-expanded', 'false');
    await expect(step(page, 'Follow the spy')).toBeHidden();
    // the part you just opened is at the top, so you do not lose your place
    await h.click();
    await expect(h).toBeInViewport();
  });

  test('headings, notes, warnings and text', async ({ page }) => {
    await head(page, "Finding Movario's base").click();
    const p = part(page, "Finding Movario's base");
    await expect(p.locator('h3.sub')).toHaveText(['Feldip Hunter area', 'Khazard']);
    await expect(p.locator('h4.sub.minor')).toHaveText('Intended method');
    await expect(p.locator('.note:not(.warn)')).toHaveText('Dismiss any followers before the next steps.');
    await expect(p.locator('.note.warn')).toHaveText('CAUTION: items dropped in this room are lost.');
    await expect(p.locator('.note.warn .caution')).toHaveText('CAUTION:');
    await expect(p.locator('p.para')).toHaveText('"Prohibited" is the key word. Match the odd symbol to a rune.');
    await expect(step(page, 'Talk to Radimus').locator('.code')).toHaveText('BLR');
    await expect(step(page, 'Trap the square').locator('i')).toHaveText(['Trap', 'use']);
  });
});

test.describe('chat options', () => {
  test('keys with hints, and a second case', async ({ page }) => {
    const first = step(page, 'In Taverley');
    await expect(first.locator('.dlg li')).toHaveText(['1What efforts are you making against Lucien?', '✓Accept quest']);
    expect(await first.locator('kbd').evaluateAll((k) => k.map((x) => x.title))).toEqual(['Press 1', 'Accept quest']);
    await head(page, "Finding Movario's base").click();
    const launder = step(page, 'With the ring of charos');
    await expect(launder.locator('.dlg')).toHaveCount(2);
    await expect(launder.locator('.why')).toHaveText('If you brought coins instead:');
    await expect(launder.locator('.dlg').nth(1).locator('li')).toHaveText(['1Offer five thousand coins for information on Movario.']);
  });
});

test.describe('sub-steps', () => {
  test.beforeEach(async ({ page }) => {
    await showDone(page);
    await head(page, "Finding Movario's base").click();
  });

  test('ticking the main step ticks its sub-steps', async ({ page }) => {
    await tick(page, 'Cast NPC Contact');
    for (const s of ['Turael', 'Duradel', 'Mazchna']) await expect(step(page, s).locator(':scope > .row > .cb')).toBeChecked();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
  });

  test('ticking every sub-step ticks the main step, which then folds them away', async ({ page }) => {
    for (const s of ['Turael', 'Duradel', 'Mazchna']) await tick(page, s);
    const main = step(page, 'Cast NPC Contact');
    await expect(main.locator(':scope > .row > .cb')).toBeChecked();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
    await expect(step(page, 'Duradel')).toBeHidden();
    // unticking the main step unticks them all, and shows them again
    await tick(page, 'Cast NPC Contact');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
    for (const s of ['Turael', 'Duradel', 'Mazchna']) await expect(step(page, s).locator(':scope > .row > .cb')).not.toBeChecked();
  });

  test('unticking one sub-step unticks the main step', async ({ page }) => {
    for (const s of ['Turael', 'Duradel']) await tick(page, s);
    await tick(page, 'Turael');
    await tick(page, 'Mazchna');
    await expect(step(page, 'Cast NPC Contact').locator(':scope > .row > .cb')).not.toBeChecked();
    await expect(step(page, 'Duradel').locator(':scope > .row > .cb')).toBeChecked();
  });

  test('sub-steps count only as part of their main step', async ({ page }) => {
    await tick(page, 'Turael');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 12 steps');
    await expect(step(page, 'Duradel').locator('.dlg li')).toHaveText(['1I need to talk to you about Lucien.']);
  });
});

test.describe('"Bring" box', () => {
  test.beforeEach(async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.locator('#next-btn').click();
  });

  test('open at the start of a part, with counts', async ({ page }) => {
    const b = page.locator('details.bring');
    await expect(b).toHaveAttribute('open', '');
    await expect(b.locator('summary .sl')).toHaveText('Bring for this part');
    await expect(b.locator('[data-bcount]')).toHaveText('0 / 5');
    await expect(b.locator('.bl')).toHaveText(['Needed0 / 3', 'Recommended0 / 2']);
    await expect(b.locator('li[data-item] .t')).toHaveText(['Any logs', 'Ring of charos (a) or 5,000 coins', 'Mort myre fungus', 'Watchtower Teleport', 'Ardougne Teleport (Ardougne cloak is best)']);
  });

  test('ticking everything closes it, and its rows stay so you can untick', async ({ page }) => {
    const b = page.locator('details.bring');
    for (const t of ['Any logs', 'Ring of charos (a) or', 'Mort myre', 'Watchtower', 'Ardougne Teleport (']) await item(page, t).locator('.cb').click();
    await expect(b).not.toHaveAttribute('open', '');
    await expect(b).toHaveClass(/\balldone\b/);
    await expect(b.locator('[data-bcount]')).toHaveText('✓ 5 / 5');
    await b.locator('summary').click();
    await expect(item(page, 'Any logs')).toBeVisible();
    await item(page, 'Any logs').locator('.cb').click();
    await expect(b.locator('[data-bcount]')).toHaveText('4 / 5');
  });

  test('with "Show done steps" on, it stays open', async ({ page }) => {
    await showDone(page);
    for (const t of ['Any logs', 'Ring of charos (a) or', 'Mort myre', 'Watchtower', 'Ardougne Teleport (']) await item(page, t).locator('.cb').click();
    await expect(page.locator('details.bring')).toHaveAttribute('open', '');
  });

  test('closed once you start the part', async ({ page }) => {
    await page.locator('#next-btn').click();
    await openTab(page, 'overview');
    await openTab(page, 'steps');
    await expect(page.locator('details.bring')).not.toHaveAttribute('open', '');
  });

  test('its ticks are not the Items tab ticks', async ({ page }) => {
    await item(page, 'Ring of charos (a) or').locator('.cb').click();
    await openTab(page, 'items');
    await expect(page.locator('#main .bh').first()).toHaveText('Required 0 / 3');
  });
});

test.describe('boxes for pictures, maps and tables', () => {
  test.beforeEach(async ({ page }) => {
    await head(page, "Finding Movario's base").click();
  });

  test('all closed at first', async ({ page }) => {
    const p = part(page, "Finding Movario's base");
    await expect(p.locator('details.acc:not(.bring) summary .sl')).toHaveText(['Map: Location of the Khazard launderer', 'Map', 'Symbol to rune', 'The old battered door']);
    await expect(box(step(page, 'Go to the laundry room'), 'Map').locator('.cap')).toHaveText('Open on the wiki');
    for (const d of await p.locator('details.acc:not(.bring)').all()) expect(await d.getAttribute('open')).toBeNull();
  });

  test('a map starts when you open it, with markers and the wiki map tiles', async ({ page, tiles }) => {
    const m = box(part(page, "Finding Movario's base"), 'Map: Location of the Khazard launderer');
    await m.locator('summary').click();
    await expect(m.locator('.leaflet-container')).toBeVisible();
    await expect(m.locator('.leaflet-overlay-pane path')).toHaveCount(2);
    await expect(m.locator('.leaflet-control-zoom-in')).toBeVisible();
    await expect(m.locator('.cap a')).toHaveAttribute('href', 'https://runescape.wiki/w/While_Guthix_Sleeps/Quick_guide');
    await expect.poll(() => tiles.length).toBeGreaterThan(0);
    expect(tiles[0]).toMatch(/^https:\/\/maps\.runescape\.wiki\/rs\/versions\/2026-11-01-b\/map_icon_squares\/28\/\d\/0_-?\d+_-?\d+\.png$/);
  });

  test('a table, with a short row stretched', async ({ page }) => {
    const t = box(part(page, "Finding Movario's base"), 'Symbol to rune');
    await expect(t.locator('summary .m')).toHaveText('3 rows');
    await t.locator('summary').click();
    await expect(t.locator('th')).toHaveText(['Symbol', 'Rune']);
    await expect(t.locator('tbody tr')).toHaveText(['OMind rune', 'HEarth rune', 'Note']);
    await expect(t.locator('tbody tr').last().locator('td')).toHaveAttribute('colspan', '2');
  });

  test('a picture inside a step; opening it does not tick the step', async ({ page }) => {
    const s = step(page, 'Search the old battered door');
    const pic = box(s, 'The old battered door');
    await pic.locator('summary').click();
    await expect(pic.locator('img')).toHaveAttribute('src', 'https://runescape.wiki/images/Old_battered_door.png?abc');
    await expect(pic.locator('.cap')).toHaveText('The old battered door');
    await pic.locator('img').click({ modifiers: [] }).catch(() => {});
    await expect(s).not.toHaveClass(/\bdone\b/);
  });

  test('boxes you open stay open after a reload', async ({ page }) => {
    await box(part(page, "Finding Movario's base"), 'Symbol to rune').locator('summary').click();
    await expect.poll(async () => Object.keys((await stored(page, 'prog.' + WGS)).acc)).toEqual(['finding-movario-s-base|Symbol to rune|0']);
    await page.reload();
    await expect(box(part(page, "Finding Movario's base"), 'Symbol to rune')).toHaveAttribute('open', '');
    await expect(box(part(page, "Finding Movario's base"), 'Map: Location')).not.toHaveAttribute('open', '');
  });
});
