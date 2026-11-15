// Read from game: Alt1 shows the in-game Achievements list, and the app ticks the done tasks.
// Alt1 runs on a computer only, so the tests use screenshots of the desktop game, and a fake Alt1 that hands them over.
const { test, expect, fixture, openApp } = require('./support/app');

const SHOT = {
  // Hard Daemonheim: 3 not done (red), 2 locked (grey with a lock), 2 done (green tick).
  daemonheim: '/tests/fixtures/game/desktop-daemonheim-hard.png',
  // The Area Tasks page before you pick a tier: the "Set tasks", with all kinds of badges.
  sets: '/tests/fixtures/game/desktop-set-tasks.png'
};
const HARD_DAEMONHEIM = ['not', 'not', 'not', 'locked', 'locked', 'done', 'done'];

// Reads a picture with the reader, in the page. scale resizes it first; cut keeps only the top part;
// filter is a canvas filter, or 'jpeg' to save it as a JPEG first.
function readShot(page, src, o) {
  o = Object.assign({ scale: 1, cut: 1, filter: '' }, o);
  return page.evaluate(([s, k, c, f]) => new Promise((done, fail) => {
    const im = new Image();
    im.onload = async () => {
      const w = Math.round(im.width * k), h = Math.round(im.height * k * c);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      if (f && f !== 'jpeg') x.filter = f;
      x.drawImage(im, 0, 0, w, Math.round(im.height * k));
      if (f === 'jpeg') { const j = new Image(); j.src = cv.toDataURL('image/jpeg', 0.6); await j.decode(); x.drawImage(j, 0, 0); }
      const r = window.QuickGuideReader.read(x.getImageData(0, 0, w, h).data, w, h);
      done(r.found ? r.rows.map((row) => (row.locked ? 'locked' : row.done ? 'done' : 'not') + (row.partial ? ' cut' : '')) : null);
    };
    im.onerror = fail;
    im.src = s;
  }), [src, o.scale, o.cut, o.filter]);
}

test.describe('the screen reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/reader.js' });
  });

  test('not done, locked and done tasks', async ({ page }) => {
    expect(await readShot(page, SHOT.daemonheim)).toEqual(HARD_DAEMONHEIM);
  });

  test('a bigger interface (Alt1 at a higher interface scale) reads the same', async ({ page }) => {
    for (const k of [1.25, 1.5, 2]) expect(await readShot(page, SHOT.daemonheim, { scale: k }), String(k)).toEqual(HARD_DAEMONHEIM);
  });

  test('the "Set tasks" page (no tier picked): nothing that could be ticked', async ({ page }) => {
    const rows = await readShot(page, SHOT.sets);
    expect(rows === null || !rows.includes('done')).toBe(true);
  });

  test('a badge cut off at the edge is left out or marked, never read as a whole row', async ({ page }) => {
    const rows = await readShot(page, SHOT.daemonheim, { cut: 546 / 583 });
    expect(rows.slice(0, 6)).toEqual(HARD_DAEMONHEIM.slice(0, 6));
    expect([undefined, 'done cut']).toContain(rows[6]);
    expect(rows.length).toBeLessThanOrEqual(7);
  });

  // As if the game were darker, greyer or blurry, or the picture came through as a JPEG.
  test('a darker, brighter, greyer, blurry or JPEG picture: the done ones are still found, and nothing else is done', async ({ page }) => {
    for (const f of ['brightness(0.6)', 'brightness(1.4)', 'contrast(0.6)', 'saturate(0.5)', 'blur(1px)', 'jpeg']) {
      const d = await readShot(page, SHOT.daemonheim, { filter: f });
      expect(d, f).not.toBeNull();
      // A lock can fade out in a poor picture; then that row is simply not there.
      expect(d.length, f).toBeLessThanOrEqual(7);
      expect(d.slice(-2).map((x) => x.replace(' cut', '')), f).toEqual(['done', 'done']);
      expect(d.filter((x) => x.startsWith('done')).length, f).toBe(2);
    }
  });

  // Random red, green and blue-green shapes, like a busy game screen. With no list, nothing may be found;
  // with the list window on top, it must still read right.
  test('a busy screen: no list is made up, and a real one is still read', async ({ page }) => {
    const res = await page.evaluate((src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; })
      .then((im) => {
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const out = { empty: 0, wrong: [], missed: 0 };
        const cols = ['#c81e1e', '#28c828', '#961414', '#5adc5a', '#785a3c', '#1e1e1e', '#dcc83c', '#3ca03c', '#aa2828', '#649696', '#82aaaa'];
        for (let n = 0; n < 40; n++) {
          const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
          const x = cv.getContext('2d');
          x.fillStyle = 'rgb(' + [0, 0, 0].map(() => Math.floor(rnd() * 80)).join() + ')'; x.fillRect(0, 0, 1280, 720);
          for (let i = 0; i < 300; i++) {
            x.fillStyle = cols[Math.floor(rnd() * cols.length)];
            const r = 2 + rnd() * 28;
            x.beginPath();
            if (i % 2) x.ellipse(rnd() * 1280, rnd() * 720, r / 2, r * (0.25 + rnd() / 2), 0, 0, 7); else x.rect(rnd() * 1280, rnd() * 720, r, r * (0.5 + rnd()));
            x.fill();
          }
          if (window.QuickGuideReader.read(x.getImageData(0, 0, 1280, 720).data, 1280, 720).found) out.empty++;
          if (n < 15) {
            const k = 0.95 + rnd() * 0.25, w = Math.round(im.width * k), h = Math.round(im.height * k);
            x.drawImage(im, Math.floor(rnd() * Math.max(1, 1280 - w)), Math.floor(rnd() * Math.max(1, 720 - h)), w, h);
            const r = window.QuickGuideReader.read(x.getImageData(0, 0, 1280, 720).data, 1280, 720);
            const got = r.found ? r.rows.map((row) => (row.locked ? 'L' : row.done ? 'Y' : 'n')).join('') : 'none';
            if (got === 'none') out.missed++;
            else if (got !== 'nnnLLYY') out.wrong.push(n + ':' + got);
          }
        }
        return out;
      }), SHOT.daemonheim);
    expect(res.empty).toBe(0);          // never a list where there is none
    expect(res.wrong).toEqual([]);      // never a wrong reading
    expect(res.missed).toBeLessThanOrEqual(1);   // missing one now and then is fine: scanning tries again
  });

  test('it is quick: a full 1920 x 1080 screen in well under the time between scans', async ({ page }) => {
    const ms = await page.evaluate((s) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
        const x = cv.getContext('2d'); x.fillStyle = '#203040'; x.fillRect(0, 0, 1920, 1080); x.drawImage(im, 560, 250);
        const d = x.getImageData(0, 0, 1920, 1080).data, t = performance.now();
        for (let i = 0; i < 5; i++) window.QuickGuideReader.read(d, 1920, 1080);
        done((performance.now() - t) / 5);
      };
      im.src = s;
    }), SHOT.daemonheim);
    expect(ms).toBeLessThan(250);
  });

  test('a picture without the list finds nothing', async ({ page }) => {
    expect(await readShot(page, '/icon.png')).toBeNull();
  });
});

test.describe('Read from game in Alt1', () => {
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
  // Hard Daemonheim read from task 1: tasks 6 and 7 are done.
  const FROM_1 = [false, false, false, false, false, true, true, false];

  // A fake Alt1, there from the start like the real one. It shows one "frame" of the game at a time:
  // the desktop screenshot, moved up by __scroll pixels (like scrolling the list). getRegion hands back
  // base64 BGRA, as Alt1 does. __closed shows a black screen, __broken makes it throw.
  async function inAlt1(page, o) {
    o = Object.assign({ h: 583, pixel: true }, o);
    await page.addInitScript(([fh, pixel]) => {
      window.__scroll = 0; window.__grabs = 0; window.__closed = false; window.__broken = false; window.__shot = null;
      window.alt1 = {
        permissionPixel: pixel, rsLinked: true, rsWidth: 801, rsHeight: fh,
        getRegion: (rx, ry, rw, rh) => {
          window.__grabs++;
          if (window.__broken) throw new Error('capture failed');
          const s = window.__shot, top = window.__scroll;
          let out = '';
          for (let yy = ry; yy < ry + rh; yy++) {
            for (let xx = rx; xx < rx + rw; xx++) {
              const sy = yy + top;
              if (!s || window.__closed || sy < 0 || sy >= s.h || xx >= s.w) { out += '\0\0\0\xff'; continue; }
              const i = (sy * s.w + xx) * 4;
              out += String.fromCharCode(s.d[i + 2], s.d[i + 1], s.d[i], 255);
            }
          }
          return btoa(out);
        }
      };
    }, [o.h, o.pixel]);
  }
  // Puts a screenshot on the fake game screen.
  async function show(page, src) {
    await page.evaluate((s) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        window.__shot = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data };
        done();
      };
      im.src = s;
    }), src);
  }
  const grabs = (page) => page.evaluate(() => window.__grabs);
  async function frames(page, n) {
    const g = await grabs(page);
    await expect.poll(() => grabs(page), { timeout: 10000 }).toBeGreaterThanOrEqual(g + n);
  }
  async function startScan(page) {
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
  }

  test('outside Alt1 there is no Read from game button', async ({ page }) => {
    await openArdougne(page);
    await expect(page.locator('#pg-cnt')).toBeVisible();
    await expect(page.locator('[data-act="read"]')).toHaveCount(0);
  });

  test('the box says what to open in the game, and which task is at the top', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    const dlg = page.locator('#rd');
    await expect(dlg).toContainText('Hero');
    await expect(dlg).toContainText('Easy Ardougne');
    await expect(page.locator('#rd-top option:checked')).toHaveText('1. The Essence of Magic');
    await expect(dlg.locator('input[type="file"]')).toHaveCount(0);
    await page.locator('[data-act="rd-close"]').click();
    await expect(dlg).toHaveCount(0);
  });

  test('Start scanning: the app says it is scanning, and ticks what it sees', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(page.locator('#rd')).toHaveCount(0);
    await expect(page.locator('#scan')).toContainText('Scanning for achievements');
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    await expect(page.locator('#scan')).toContainText('Easy Ardougne: tasks 1–7 in view. Ticked 2.');
    expect(page.errors).toEqual([]);
  });

  test('it starts at the task you pick', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-top').selectOption({ index: 10 });
    await page.locator('[data-act="scan-start"]').click();
    await expect.poll(() => doneList(page, 18)).toEqual([...Array(15).fill(false), true, true, false]);
  });

  test('it only ticks; a task you ticked stays ticked', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await tasks(page).first().locator('.row > input[data-acb]').first().check();
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => doneList(page, 8)).toEqual([true, ...FROM_1.slice(1)]);
  });

  test('the "Set tasks" page ticks nothing', async ({ page }) => {
    await inAlt1(page, { h: 606 });
    await openArdougne(page);
    await show(page, SHOT.sets);
    await startScan(page);
    await frames(page, 3);
    expect(await doneList(page, 23)).toEqual(Array(23).fill(false));
  });

  test('scanning follows the list as you scroll down and back up, through locked rows', async ({ page }) => {
    await inAlt1(page, { h: 470 });
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await frames(page, 2);
    for (const y of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 80, 60, 40, 20, 0, 25, 50]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
    }
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    expect(page.errors).toEqual([]);
  });

  test('switching tier in the app waits until the game shows another list, then scans it from its first task', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(page.locator('#scan')).toContainText('Open Medium Ardougne in the game');
    await expect(page.locator('[data-act="scan-go"]')).toBeVisible();
    // The game still shows the same list: nothing is ticked in Medium.
    await frames(page, 4);
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    // Now the list in the game changes.
    await page.evaluate(() => { window.__scroll = 62; });
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    await expect(page.locator('[data-act="scan-go"]')).toHaveCount(0);
    await page.locator('.tab[data-tier="easy"]').click();
    expect(await doneList(page, 8)).toEqual(FROM_1);
  });

  test('Go: you already opened the tier in the game, so it scans right away', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await page.locator('.tab[data-tier="medium"]').click();
    await startScan(page);
    await page.locator('.tab[data-tier="hard"]').click();
    await frames(page, 3);
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    await page.locator('[data-act="scan-go"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
  });

  test('closing the list in the game and opening the new tier counts as a change', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    await page.locator('.tab[data-tier="medium"]').click();
    await frames(page, 2);
    await page.evaluate(() => { window.__closed = true; });
    await frames(page, 3);
    await page.evaluate(() => { window.__closed = false; });
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
  });

  test('no list on the screen: it keeps looking, and goes on when the list opens', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await page.evaluate(() => { window.__closed = true; });
    await startScan(page);
    await frames(page, 3);
    await expect(page.locator('#scan')).toContainText('Open Easy Ardougne in the game');
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    await page.evaluate(() => { window.__closed = false; });
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
  });

  test('a picture that fails to come through does not stop the scanning', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await page.evaluate(() => { window.__broken = true; });
    await startScan(page);
    await frames(page, 3);
    await page.evaluate(() => { window.__broken = false; });
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
    expect(page.errors).toEqual([]);
  });

  test('ticks from scanning are saved, and the area list shows them', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(page.locator('#pg-cnt')).toHaveText('2 / 23 tasks');
    await page.reload();
    await expect(page.locator('#pg-cnt')).toHaveText('2 / 23 tasks');
    await expect(page.locator('#scan')).toHaveCount(0);
    await page.locator('[data-act="change"]').click();
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="easy"]')).toContainText('2 / 23');
  });

  test('newer Alt1: pictures come from alt1.capture as raw bytes', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await page.evaluate(() => {
      const a = window.alt1, old = a.getRegion;
      a.getRegion = () => { throw new Error('should use capture'); };
      a.capture = (x, y, w, h) => { const b = atob(old(x, y, w, h)), u = new Uint8ClampedArray(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    });
    await startScan(page);
    await expect.poll(() => doneList(page, 8)).toEqual(FROM_1);
  });

  test('Stop ends the scanning; so does leaving the area', async ({ page }) => {
    await inAlt1(page);
    await openArdougne(page);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(page.locator('#scan')).toBeVisible();
    await page.locator('[data-act="scan-stop"]').click();
    await expect(page.locator('#scan')).toHaveCount(0);
    const g = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBe(g);

    await startScan(page);
    await expect(page.locator('#scan')).toBeVisible();
    await page.locator('[data-act="change"]').click();
    const g2 = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBeLessThanOrEqual(g2 + 1);
  });

  test('without the screen permission, it says how to fix it', async ({ page }) => {
    await inAlt1(page, { pixel: false });
    await openArdougne(page);
    await startScan(page);
    await expect(page.locator('#rd-msg')).toContainText('permission');
    await expect(page.locator('#scan')).toHaveCount(0);
  });
});
