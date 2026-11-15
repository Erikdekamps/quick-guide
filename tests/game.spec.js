// Read from game: Alt1 (or a screenshot) shows the in-game Achievements list, and the app ticks the done tasks.
// The screenshots are from the phone game. Desktop is smaller, so the reader is also checked on shrunk copies.
const { test, expect, fixture, openApp } = require('./support/app');

const SHOT = { ardougne: '/tests/fixtures/game/phone-ardougne-easy.png', senntisten: '/tests/fixtures/game/phone-senntisten.png' };
const FILE = { ardougne: 'tests/fixtures/game/phone-ardougne-easy.png', senntisten: 'tests/fixtures/game/phone-senntisten.png' };

// Reads a picture with the reader, in the page. scale shrinks it first; cut keeps only the top part.
function readShot(page, src, scale, cut) {
  return page.evaluate(([s, k, c]) => new Promise((done, fail) => {
    const im = new Image();
    im.onload = () => {
      const w = Math.round(im.width * k), h = Math.round(im.height * k * c);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, Math.round(im.height * k));
      const r = window.QuickGuideReader.read(x.getImageData(0, 0, w, h).data, w, h);
      done(r.found ? r.rows.map((row) => (row.done ? 'done' : 'not') + (row.partial ? ' cut' : '')) : null);
    };
    im.onerror = fail;
    im.src = s;
  }), [src, scale || 1, cut || 1]);
}

test.describe('the screen reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/reader.js' });
  });

  test('a tier with every task done: a green tick on each badge', async ({ page }) => {
    expect(await readShot(page, SHOT.ardougne)).toEqual(Array(7).fill('done'));
  });

  test('a tier with one task not done: a red badge with no tick', async ({ page }) => {
    expect(await readShot(page, SHOT.senntisten)).toEqual(['not', 'done', 'done', 'done', 'done', 'done', 'done']);
  });

  test('a smaller screen, like the desktop game, reads the same', async ({ page }) => {
    for (const k of [0.6, 0.45, 0.3]) {
      expect(await readShot(page, SHOT.ardougne, k)).toEqual(Array(7).fill('done'));
      expect(await readShot(page, SHOT.senntisten, k)).toEqual(['not', 'done', 'done', 'done', 'done', 'done', 'done']);
    }
  });

  test('a badge cut off at the edge is marked, so it is not trusted', async ({ page }) => {
    const rows = await readShot(page, SHOT.senntisten, 1, 1035 / 1170);
    expect(rows.slice(0, 6)).toEqual(['not', 'done', 'done', 'done', 'done', 'done']);
    expect(rows[6]).toBe('done cut');
  });

  test('a picture without the list finds nothing', async ({ page }) => {
    expect(await readShot(page, '/icon.png')).toBeNull();
  });
});

test.describe('the Read from game button', () => {
  test.beforeEach(async ({ wiki }) => {
    wiki.page('Ardougne achievements', fixture('ardougne-achievements.html'));
  });
  const tasks = (page) => page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task]');
  async function openArdougne(page) {
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
  }
  async function doneList(page, n) {
    return tasks(page).evaluateAll((li, k) => li.slice(0, k).map((x) => x.classList.contains('done')), n);
  }

  test('a screenshot ticks the done tasks, from the task at the top', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    const dlg = page.locator('#rd');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('Hero');
    await expect(page.locator('#rd-top option:checked')).toHaveText('1. The Essence of Magic');
    await page.locator('#rd-file').setInputFiles(FILE.senntisten);
    await expect(page.locator('#rd-msg')).toHaveText(/Found 7 tasks: 6 done\. Ticked 6\./);
    expect(await doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
    // Next time it goes on from task 8.
    await expect(page.locator('#rd-top option:checked')).toHaveText(/^8\. /);
    await expect(page.locator('#rd-msg')).toContainText('scroll');
    expect(page.errors).toEqual([]);
  });

  test('it starts at the task you pick', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-top').selectOption({ index: 10 });
    await page.locator('#rd-file').setInputFiles(FILE.ardougne);
    await expect(page.locator('#rd-msg')).toHaveText(/Found 7 tasks: 7 done/);
    expect(await doneList(page, 18)).toEqual([...Array(10).fill(false), ...Array(7).fill(true), false]);
  });

  test('it only ticks; a task you ticked stays ticked', async ({ page }) => {
    await openArdougne(page);
    await tasks(page).first().locator('.row > input[data-acb]').first().check();
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-file').setInputFiles(FILE.senntisten);
    await expect(page.locator('#rd-msg')).toHaveText(/Ticked 6\./);
    expect((await doneList(page, 7))[0]).toBe(true);
  });

  test('a picture without the list says so and ticks nothing', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-file').setInputFiles('icon.png');
    await expect(page.locator('#rd-msg')).toContainText('Could not find the task list');
    expect(await doneList(page, 23)).toEqual(Array(23).fill(false));
  });

  test('outside Alt1 there is no Start scanning button', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await expect(page.locator('[data-act="scan-start"]')).toHaveCount(0);
    await expect(page.locator('#rd')).toContainText('Alt1');
  });

  // A fake Alt1. It shows one "frame" of the game at a time: a slice of a screenshot, shrunk to half size.
  // Moving the slice down is like scrolling down the list in the game. getRegion hands back base64 BGRA, as Alt1 does.
  async function fakeAlt1(page, src, h) {
    await page.evaluate(([s, fh]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const w = Math.round(im.width / 2), full = Math.round(im.height / 2);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = full;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, full);
        const all = x.getImageData(0, 0, w, full).data;
        window.__scroll = 0;
        window.__grabs = 0;
        window.alt1 = {
          permissionPixel: true, rsLinked: true, rsWidth: w, rsHeight: fh,
          getRegion: (rx, ry, rw, rh) => {
            window.__grabs++;
            const top = window.__scroll;
            let out = '';
            for (let yy = ry; yy < ry + rh; yy++) {
              for (let xx = rx; xx < rx + rw; xx++) {
                const sy = yy + top, i = (sy * w + xx) * 4;
                if (sy < 0 || sy >= full) { out += '\0\0\0\xff'; continue; }
                out += String.fromCharCode(all[i + 2], all[i + 1], all[i], 255);
              }
            }
            return btoa(out);
          }
        };
        done();
      };
      im.src = s;
    }), [src, h]);
  }
  const grabs = (page) => page.evaluate(() => window.__grabs);
  async function frames(page, n) {
    const g = await grabs(page);
    await expect.poll(() => grabs(page), { timeout: 10000 }).toBeGreaterThanOrEqual(g + n);
  }

  test('Start scanning: the app says it is scanning, and ticks what it sees', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#rd')).toHaveCount(0);
    await expect(page.locator('#scan')).toContainText('Scanning for achievements');
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
    await expect(page.locator('#scan')).toContainText('Easy Ardougne');
    expect(page.errors).toEqual([]);
  });

  test('scanning follows the list as you scroll it in the game', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 440);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await frames(page, 2);
    // Scroll down bit by bit, until the red "not done" row has gone off the top.
    for (const y of [20, 40, 60, 80, 100, 120, 140]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
    }
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
    // Task 1 was the red one, so it stays unticked, even though a done row is now at the top.
  });

  test('switching to another tier in the app scans that tier, from its first task', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.ardougne, 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(page.locator('#scan')).toContainText('Medium Ardougne');
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
    await page.locator('.tab[data-tier="easy"]').click();
    expect(await doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
  });

  test('Stop ends the scanning; so does leaving the area', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#scan')).toBeVisible();
    await page.locator('[data-act="scan-stop"]').click();
    await expect(page.locator('#scan')).toHaveCount(0);
    const g = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBe(g);

    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#scan')).toBeVisible();
    await page.locator('[data-act="change"]').click();
    const g2 = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBeLessThanOrEqual(g2 + 1);
  });

  test('no list on the screen: it keeps looking, and says so', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, '/icon.png', 100);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#scan')).toContainText('Open Easy Ardougne in the game');
    await frames(page, 2);
    expect(await doneList(page, 23)).toEqual(Array(23).fill(false));
  });

  test('in Alt1 without the screen permission, it says how to fix it', async ({ page }) => {
    await openArdougne(page);
    await page.evaluate(() => { window.alt1 = { permissionPixel: false, rsLinked: true, rsWidth: 800, rsHeight: 600, getRegion: () => '' }; });
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#rd-msg')).toContainText('permission');
    await expect(page.locator('#scan')).toHaveCount(0);
  });
});
