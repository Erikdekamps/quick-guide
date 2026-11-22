// Update from the wiki: everything the app keeps, at once. It asks when each page changed, reads again only what did,
// keeps your ticks, and marks what is new. Once a week it runs by itself, quietly.
const { test, expect, fixture, stored, caughtUp, openApp, openQuest, openSettings, closeSettings, withAllAreas, withCapes, areaPage } = require('./support/app');

const MQC = 'Master Quest Cape (achievement)', WEEK = 7 * 24 * 3600 * 1000;
const card = (page, key) => page.locator('.cape[data-cape="' + key + '"]');
const cheevo = (page, id) => page.locator('li[data-cheevo="' + id + '"]');
const toast = (page) => page.locator('#toast');

async function achievements(page) {
  await page.locator('.bn[data-home="areas"]').click();
  await expect(page.locator('#qcount')).toHaveText('13 areas');
}
async function openCape(page, key, name) {
  await achievements(page);
  await card(page, key).click();
  await expect(page.locator('h1.qt')).toHaveText(name);
}
async function update(page, says) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Update from the wiki' }).click();
  await expect(toast(page)).toHaveText(says);
  await expect(page.getByRole('button', { name: 'Update from the wiki' })).toBeEnabled();
}
// A new achievement in the master quest cape: a row in its list (made by a template, so the page is not edited, only
// touched), and its own page.
function newCheevo(wiki) {
  const row = '<tr data-rowid="9999"><td data-sort-value="BRAND NEW" class=""><a href="/w/Brand_New" title="Brand New">Brand New</a></td>' +
    '<td>Do the new thing.</td><td><a href="/w/Members" title="Members">Members</a></td><td><a href="/w/Lore_achievements" title="Lore achievements">Lore</a></td>' +
    '<td class=""><a href="/w/Post-Quest_achievements" title="Post-Quest achievements">Post-Quest</a></td><td class="table-na nohighlight">N/A</td><td>10</td></tr>';
  wiki.touch(MQC, fixture('master-quest-cape-achievement.html').replace('</tbody></table>', row + '</tbody></table>'));
  wiki.details({ 'Brand New': { lead: '{{Infobox Achievement\n|name = Brand New\n|mqc = yes\n|requirements =\n* {{Skillreq|Magic|50}}\n|id = 9999\n}}',
    extract: '<p><b>Brand New</b> is an achievement that requires the player to do the new thing at once.</p>' } });
}

test.describe('Update from the wiki', () => {
  test('in Settings: what it does, and when it last checked', async ({ page }) => {
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#upd-msg')).toHaveText('Reads again what changed: the quest lists, the guides you opened, the areas and the capes. It checks by itself once a week.');
    await page.getByRole('button', { name: 'Update from the wiki' }).click();
    await expect(toast(page)).toHaveText('Everything is up to date.');
    await expect(page.locator('#upd-msg')).toHaveText(/^Checked \w{3} \d{1,2}, \d{4}: nothing new\. It checks by itself once a week\.$/);
    expect((await stored(page, 'upd')).found).toEqual({ quests: 0, tasks: 0, cheevos: 0, guides: 0 });
  });

  test('only what changed is read again, in few requests, and your ticks stay', async ({ page, wiki }) => {
    withAllAreas(wiki);
    withCapes(wiki);
    await openApp(page, expect);
    await openQuest(page, expect, "Cook's Assistant");
    await openCape(page, 'mqc', 'Master quest cape');
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await page.locator('.q[data-area="Desert"]').first().click();
    await page.locator('#next-btn').click();
    const ticks = await stored(page, 'cprog.mqc'), aticks = await stored(page, 'aprog.Desert');
    const before = wiki.dataCalls.length;
    newCheevo(wiki);
    await update(page, 'Updated: 1 new achievement.');
    // asked what changed: the index, once. Read again: the cape; not the area, not the guide
    expect(wiki.dataCalls.slice(before)).toEqual(['index.json', 'achievements/capes/mqc.json']);
    expect(await stored(page, 'cprog.mqc')).toEqual(ticks);
    expect(await stored(page, 'aprog.Desert')).toEqual(aticks);
    const c = await stored(page, 'cape.mqc');
    expect(c.cheevos).toHaveLength(24);
    // the others kept what they had
    expect(c.cheevos.find((x) => x.id === '2111').tip).toMatch(/^Fully enchant/);
    expect(c.cheevos.find((x) => x.id === '9999')).toMatchObject({ tip: 'Do the new thing at once.', skills: [{ skill: 'Magic', level: 50, boost: false }] });
    await expect(page.locator('#upd-msg')).toHaveText(/: 1 new achievement\. It checks by itself once a week\.$/);
  });

  test('a new achievement says New, on the card and in the cape, until you tick it', async ({ page, wiki }) => {
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    newCheevo(wiki);
    await update(page, 'Updated: 1 new achievement.');
    await closeSettings(page);
    await expect(cheevo(page, '9999').locator('.t')).toHaveText('Brand New New — Do the new thing.');
    await expect(cheevo(page, '9999').locator('.newtag')).toHaveText('New');
    await expect(cheevo(page, '4949').locator('.newtag')).toHaveCount(0);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await expect(card(page, 'mqc').locator('.cn')).toHaveText('0 / 24 achievements · 1 new');
    await card(page, 'mqc').click();
    await cheevo(page, '9999').locator('.cb').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await expect(card(page, 'mqc').locator('.cn')).toHaveText('1 / 24 achievements');
  });

  test('New lasts a month', async ({ page, wiki }) => {
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    newCheevo(wiki);
    await update(page, 'Updated: 1 new achievement.');
    await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem('qg1.cape.mqc'));
      c.cheevos.find((x) => x.id === '9999').newAt -= 31 * 24 * 3600 * 1000;
      localStorage.setItem('qg1.cape.mqc', JSON.stringify(c));
    });
    await page.reload();
    await closeSettings(page);
    await expect(cheevo(page, '9999')).toHaveCount(1);
    await expect(page.locator('.newtag')).toHaveCount(0);
  });

  test('an edited achievement page is read again; the others are kept', async ({ page, wiki }) => {
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    const d = JSON.parse(fixture('cape-achievements.json'))['Advanced Sweeping'];
    wiki.edit('Advanced Sweeping', { lead: d.lead.replace('{{Skillreq|Magic|93}}', '{{Skillreq|Magic|95}}'), extract: d.extract });
    await update(page, 'Everything is up to date.');
    await closeSettings(page);
    await expect(cheevo(page, '2111').locator('.need')).toContainText('95 Magic');
  });

  test('a new task in an area says New, and its tier says how many', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await achievements(page);
    await page.locator('.q[data-area="Desert"]').first().click();
    await expect(page.locator('h1.qt')).toHaveText('Desert');
    wiki.touch('Desert achievements', areaPage([{ name: 'Easy', tasks: [{ id: 5001, name: 'Desert filler task', desc: 'A task in Desert.' }, { id: 7000, name: 'Sand castle', desc: 'Build one.' }] }]));
    await update(page, 'Updated: 1 new task.');
    await closeSettings(page);
    await expect(page.locator('li[data-task="7000"] .newtag')).toHaveText('New');
    await expect(page.locator('li[data-task="5001"] .newtag')).toHaveCount(0);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await expect(page.locator('.q[data-area="Desert"][data-atier="easy"] .q2')).toHaveText('2 tasks · 1 new');
    // the search knows the new task too
    await page.locator('#quest-link').fill('sand castle');
    await expect(page.locator('li[data-task="7000"]')).toHaveCount(1);
  });

  test('a quest guide that was edited is read again', async ({ page, wiki }) => {
    await openApp(page, expect);
    await openQuest(page, expect, "Cook's Assistant");
    wiki.edit("Cook's Assistant/Quick guide", fixture('cooks-assistant.html').replace('Talk to the Cook', 'Talk to the Lumbridge Cook'));
    await update(page, 'Updated: 1 quest guide changed.');
    expect(wiki.asked().filter((x) => x === "Cook's Assistant/Quick guide")).toHaveLength(2);
    await closeSettings(page);
    await page.locator('.tab[data-tab="steps"]').click();
    await expect(page.locator('#main')).toContainText('Talk to the Lumbridge Cook');
  });

  test('a quest guide whose page has another name now: your ticks go with it, and it is not kept twice', async ({ page, wiki }) => {
    const OLD = "Cook's Assistant/Quick guide", NEW = "Cook's Assistant (quest)/Quick guide";
    await openApp(page, expect);
    await openQuest(page, expect, "Cook's Assistant");
    await page.locator('.tab[data-tab="steps"]').click();
    await page.locator('#next-btn').click();
    const ticks = (await stored(page, 'prog.' + OLD)).steps;
    expect(Object.keys(ticks)).toHaveLength(1);
    wiki.page(NEW, fixture('cooks-assistant.html'));
    wiki.edit(OLD).moved(OLD, NEW);
    await update(page, 'Updated: 1 quest guide changed.');
    expect(Object.keys(await stored(page, 'meta'))).toEqual([NEW]);
    expect(await stored(page, 'quest.' + OLD)).toBeNull();
    expect(await stored(page, 'prog.' + OLD)).toBeNull();
    expect((await stored(page, 'prog.' + NEW)).steps).toEqual(ticks);
    expect(await stored(page, 'last')).toBe(NEW);
    // the next check finds nothing: the guide is kept once, under its new name
    await update(page, 'Everything is up to date.');
    // and the quest opens from the list with your tick
    await page.locator('.bn[data-home="quests"]').click();
    await page.locator('.bn[data-home="quests"]').click();
    await page.locator('.q[data-quest="Cook\'s Assistant"]').click();
    await expect(page.locator('.tab[data-tab="steps"] .tcn')).toContainText('1 /');
    expect(page.errors).toEqual([]);
  });

  test('a new quest in the quest list says New', async ({ page, wiki }) => {
    await openApp(page, expect);
    const list = fixture('list-of-quests.html'), imp = /<tr>\s*<td><a href="\/w\/Imp_Catcher"[\s\S]*?<\/tr>/.exec(list)[0];
    wiki.page('List of quests', list.replace(imp, imp + '\n' + imp.replace(/Imp_Catcher/g, 'Fresh_Quest').replace(/Imp Catcher/g, 'Fresh Quest')));
    await update(page, 'Updated: 1 new quest.');
    await closeSettings(page);
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('.q[data-quest="Fresh Quest"] .newtag')).toHaveText('New');
    await expect(page.locator('.q[data-quest="Imp Catcher"] .newtag')).toHaveCount(0);
  });

  test('once a week it runs by itself, quietly, and says what is new', async ({ page, wiki }) => {
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    // checked yesterday: not again
    const asked = wiki.dataCalls.length;
    await page.evaluate(() => localStorage.setItem('qg1.upd', JSON.stringify({ at: Date.now() - 24 * 3600 * 1000, found: {} })));
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText('Master quest cape');
    await caughtUp(page);
    expect(wiki.dataCalls).toHaveLength(asked);
    // a week ago: it checks, and reads the cape again
    newCheevo(wiki);
    await page.evaluate((w) => localStorage.setItem('qg1.upd', JSON.stringify({ at: Date.now() - w - 1000, found: {} })), WEEK);
    await page.reload();
    await expect(toast(page)).toHaveText('New on the wiki: 1 new achievement.');
    await expect(cheevo(page, '9999').locator('.newtag')).toHaveText('New');
    expect(Date.now() - (await stored(page, 'upd')).at).toBeLessThan(60000);
    expect(page.errors).toEqual([]);
  });

  test('nothing kept yet: no weekly check', async ({ page, wiki }) => {
    await openApp(page, expect);
    await caughtUp(page);
    expect(wiki.dataCalls).toEqual(['index.json']);
    expect(await stored(page, 'upd')).toBeNull();
  });

  test('when the data cannot be reached, nothing changes, and the weekly check tries again next time', async ({ page, wiki }) => {
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    const c = await stored(page, 'cape.mqc');
    wiki.fail('List of quests', 'network');
    await update(page, "Could not reach the app's data. Try again in a moment.");
    expect(await stored(page, 'cape.mqc')).toEqual(c);
    expect(await stored(page, 'upd')).toBeNull();
  });

  test('nothing kept yet, and the data cannot be reached: it says the quest list could not be updated', async ({ page, wiki }) => {
    await openApp(page, expect);
    wiki.fail('List of quests', 'network');
    await update(page, "Could not update the quest list. Could not reach the app's data. Check your internet, then try again.");
  });

  test('a page that cannot be read again keeps what was saved; the others still update', async ({ page, wiki }) => {
    withAllAreas(wiki);
    withCapes(wiki);
    await openApp(page, expect);
    await openCape(page, 'mqc', 'Master quest cape');
    await page.getByRole('button', { name: 'All achievements' }).click();
    await page.locator('.q[data-area="Desert"]').first().click();
    newCheevo(wiki);
    wiki.touch('Desert achievements');
    wiki.fail('Desert achievements', 'http');
    await update(page, 'Updated: 1 new achievement. Could not read 1 page.');
    expect((await stored(page, 'area.Desert')).tiers[0].tasks).toHaveLength(1);
    await expect(page.locator('#upd-msg')).toHaveText(/: 1 new achievement\. Could not read 1 page\. It checks by itself once a week\.$/);
  });
});
