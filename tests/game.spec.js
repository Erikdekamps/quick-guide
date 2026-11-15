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

  test('outside Alt1 there is no Read screen button', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await expect(page.locator('[data-act="rd-screen"]')).toHaveCount(0);
    await expect(page.locator('#rd')).toContainText('Alt1');
  });

  test('in Alt1, Read screen reads the game window', async ({ page }) => {
    await openArdougne(page);
    // A fake Alt1 that hands over the screenshot, as Alt1 does: base64 BGRA pixels.
    await page.evaluate((src) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, im.width, im.height).data;
        let s = '';
        for (let i = 0; i < d.length; i += 4) s += String.fromCharCode(d[i + 2], d[i + 1], d[i], 255);
        const b64 = btoa(s);
        window.alt1 = { permissionPixel: true, rsLinked: true, rsWidth: im.width, rsHeight: im.height, getRegion: () => b64 };
        done();
      };
      im.src = src;
    }), SHOT.senntisten);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="rd-screen"]').click();
    await expect(page.locator('#rd-msg')).toHaveText(/Found 7 tasks: 6 done\. Ticked 6\./);
    expect(await doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
  });

  test('in Alt1 without the screen permission, it says how to fix it', async ({ page }) => {
    await openArdougne(page);
    await page.evaluate(() => { window.alt1 = { permissionPixel: false, rsLinked: true, rsWidth: 800, rsHeight: 600, getRegion: () => '' }; });
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="rd-screen"]').click();
    await expect(page.locator('#rd-msg')).toContainText('permission');
  });
});
