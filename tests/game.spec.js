// Read from game: Alt1 shows the in-game Achievements list, and the app ticks the done tasks.
// Alt1 runs on a computer only, so the tests use screenshots of the desktop game, and a fake Alt1 that hands them over.
const { test, expect, openApp, openCog, stored, withAllAreas } = require('./support/app');

const SHOT = {
  // Hard Daemonheim: 3 not done (red), 2 locked (grey with a lock), 2 done (green tick).
  daemonheim: '/tests/fixtures/game/desktop-daemonheim-hard.png',
  // The Area Tasks page before you pick a tier: the "Set tasks", with all kinds of badges.
  sets: '/tests/fixtures/game/desktop-set-tasks.png',
  // The whole game screen in Alt1, with this app open on the left (scanning) and Easy Ardougne (all done) on the right.
  screen: '/tests/fixtures/game/desktop-alt1-ardougne-easy.png'
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

  test('the whole game screen, with this app open next to the list: the list is read, not the app', async ({ page }) => {
    expect(await readShot(page, SHOT.screen)).toEqual(Array(7).fill('done'));
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

test.describe('Scan achievements in Alt1', () => {
  test.beforeEach(async ({ wiki }) => { withAllAreas(wiki); });

  // Which tasks of a tier are ticked, read from storage (the tier as the game lists it: 0 is Easy Ardougne).
  async function ticked(page, area, tier, n) {
    const ix = await stored(page, 'aidx'), p = (await stored(page, 'aprog.' + area)) || { tasks: {} };
    return ix[area].tiers[tier].tasks.slice(0, n).map((x) => !!p.tasks[x.id]);
  }
  // Hard Daemonheim as the first list: tasks 6 and 7 are done.
  const A = [false, false, false, false, false, true, true, false];
  // The other list (rows 1 to 6 upside down): tasks 1 and 7 are done.
  const B = [true, false, false, false, false, false, true, false];

  // A fake Alt1, there from the start like the real one. It shows one "frame" of the game at a time: a screenshot,
  // moved up by __scroll pixels (like scrolling the list). getRegion hands back base64 BGRA, as Alt1 does.
  // __closed shows a black screen, __broken makes it throw. limit: like Alt1, too much at once gives nothing.
  async function inAlt1(page, o) {
    o = Object.assign({ w: 801, h: 583, pixel: true, limit: 0 }, o);
    await page.addInitScript(([fw, fh, pixel, limit]) => {
      window.__scroll = 0; window.__grabs = 0; window.__closed = false; window.__broken = false; window.__shot = null;
      window.alt1 = {
        permissionPixel: pixel, rsLinked: true, rsWidth: fw, rsHeight: fh,
        getRegion: (rx, ry, rw, rh) => {
          window.__grabs++;
          if (window.__broken) throw new Error('capture failed');
          if (limit && rw * rh * 4 > limit) return '';
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
    }, [o.w, o.h, o.pixel, o.limit]);
  }
  // Puts a screenshot on the fake game screen. other: the same window with another list in it
  // (the first 6 rows upside down), as when the next tier is clicked in the game.
  async function show(page, src, other) {
    await page.evaluate(([s, flip]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        if (flip) for (let k = 0; k < 6; k++) x.drawImage(im, 276, 152 + k * 62, 500, 62, 276, 152 + (5 - k) * 62, 500, 62);
        window.__shot = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data };
        done();
      };
      im.src = s;
    }), [src, !!other]);
  }
  const grabs = (page) => page.evaluate(() => window.__grabs);
  async function frames(page, n) {
    const g = await grabs(page);
    await expect.poll(() => grabs(page), { timeout: 10000 }).toBeGreaterThanOrEqual(g + n);
  }
  async function startScan(page) {
    await openCog(page);
    await page.locator('[data-act="scan-open"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#scan')).toBeVisible();
  }
  const bar = (page) => page.locator('#scan');

  test('outside Alt1 there is no Scan achievements', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await expect(page.locator('#cog')).toBeVisible();
    await expect(page.locator('[data-act="scan-open"]')).toHaveCount(0);
  });

  test('in Alt1 it is in the settings, and the box says to start at Easy Ardougne and go through them all', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await openCog(page);
    await page.locator('[data-act="scan-open"]').click();
    const dlg = page.locator('#rd');
    await expect(dlg).toContainText('Hero');
    await expect(dlg).toContainText('Easy Ardougne');
    await expect(dlg).toContainText('Medium Ardougne');
    await expect(dlg).toContainText('to the last one');
    await page.locator('[data-act="rd-close"]').click();
    await expect(dlg).toHaveCount(0);
    // No button per tier any more.
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('[data-act="read"]')).toHaveCount(0);
  });

  test('Start: the bar says it is on Easy Ardougne, and its done tasks are ticked', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(page.locator('#scan-tier')).toHaveText('Easy Ardougne');
    await expect(bar(page)).toContainText(/\(1 of \d+\)/);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    await expect(bar(page)).toContainText('Tasks 1–7 of 23 in view. Ticked 2.');
    // The list of areas shows it.
    await page.locator('.tab[data-home="areas"]').click();
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="easy"]')).toContainText('2 / 23');
    expect(page.errors).toEqual([]);
  });

  test('clicking the next tier in the game: the app goes on to Medium Ardougne by itself', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    await show(page, SHOT.daemonheim, true);
    await expect(page.locator('#scan-tier')).toHaveText('Medium Ardougne');
    await expect(bar(page)).toContainText(/\(2 of \d+\)/);
    await expect.poll(() => ticked(page, 'Ardougne', 1, 8)).toEqual(B);
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(A);
  });

  test('scrolling, slowly or fast, down and back up, stays on the same tier and keeps each row on its task', async ({ page }) => {
    await inAlt1(page, { h: 470 });
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await frames(page, 2);
    for (const y of [10, 20, 30, 124, 0, 62, 100, 40, 0]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
      await expect(page.locator('#scan-tier')).toHaveText('Easy Ardougne');
    }
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    expect(await ticked(page, 'Ardougne', 1, 8)).toEqual(Array(8).fill(false));
  });

  test('closing the list and opening it again on the same tier stays on that tier', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    await page.evaluate(() => { window.__closed = true; });
    await frames(page, 3);
    await expect(bar(page)).toContainText('Open Easy Ardougne in the game');
    await page.evaluate(() => { window.__closed = false; });
    await frames(page, 3);
    await expect(page.locator('#scan-tier')).toHaveText('Easy Ardougne');
  });

  test('the arrows move to the tier before or after, if the app got it wrong', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(page.locator('[data-act="scan-back"]')).toBeDisabled();
    await page.locator('[data-act="scan-next"]').click();
    await page.locator('[data-act="scan-next"]').click();
    await expect(page.locator('#scan-tier')).toHaveText('Hard Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 2, 8)).toEqual(A);
    await page.locator('[data-act="scan-back"]').click();
    await expect(page.locator('#scan-tier')).toHaveText('Medium Ardougne');
  });

  test('after the last tier, it says it is all done', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    const total = +(await bar(page).locator('.sk').textContent()).match(/of (\d+)/)[1];
    for (let k = 1; k < total; k++) await page.locator('[data-act="scan-next"]').click();
    await expect(page.locator('[data-act="scan-next"]')).toBeDisabled();
    await frames(page, 2);
    await show(page, SHOT.daemonheim, true);
    await expect(bar(page)).toContainText('All done');
  });

  test('the bar stays while you look around the app; an open tier shows the ticks at once', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await show(page, SHOT.daemonheim);
    await startScan(page);
    const done = () => page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task]').evaluateAll((li) => li.slice(0, 8).map((x) => x.classList.contains('done')));
    await expect.poll(done).toEqual(A);
    await expect(bar(page)).toBeVisible();
    await page.locator('[data-act="change"]').click();
    await expect(page.locator('#qcount')).toBeVisible();
    await expect(bar(page)).toBeVisible();
  });

  test('the "Set tasks" page ticks nothing', async ({ page }) => {
    await inAlt1(page, { h: 606 });
    await openApp(page, expect);
    await show(page, SHOT.sets);
    await startScan(page);
    await frames(page, 3);
    expect(await ticked(page, 'Ardougne', 0, 23)).toEqual(Array(23).fill(false));
  });

  // Newer Alt1: alt1.capture hands over bytes. Which way round red and blue come is tried both ways.
  for (const order of ['RGBA', 'BGRA']) {
    test('newer Alt1: pictures come from alt1.capture as ' + order + ' bytes', async ({ page }) => {
      await inAlt1(page);
      await openApp(page, expect);
      await show(page, SHOT.daemonheim);
      await page.evaluate((rgba) => {
        const a = window.alt1, old = a.getRegion;
        a.getRegion = () => { throw new Error('should use capture'); };
        a.capture = (x, y, w, h) => {
          const b = atob(old(x, y, w, h)), u = new Uint8ClampedArray(b.length);   // BGRA
          for (let i = 0; i < b.length; i += 4) {
            u[i] = b.charCodeAt(rgba ? i + 2 : i); u[i + 1] = b.charCodeAt(i + 1); u[i + 2] = b.charCodeAt(rgba ? i : i + 2); u[i + 3] = 255;
          }
          return u;
        };
      }, order === 'RGBA');
      await startScan(page);
      await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    });
  }

  test('older Alt1 on a big screen: the picture comes in strips (Alt1 gives at most about 4 MB at once)', async ({ page }) => {
    await inAlt1(page, { w: 1920, h: 1080, limit: 4000000 });
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8), { timeout: 15000 }).toEqual(A);
  });

  test('when Alt1 gives no picture, the bar says so', async ({ page }) => {
    await inAlt1(page, { limit: 1 });
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(bar(page)).toContainText('Alt1 gives no picture of the game', { timeout: 10000 });
  });

  test('when it sees no list for a while, the bar says how big the picture was', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await page.evaluate(() => { window.__closed = true; });
    await startScan(page);
    await expect(bar(page)).toContainText('801×583 picture; no list yet', { timeout: 10000 });
  });

  test('a picture that fails to come through does not stop the scanning', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await page.evaluate(() => { window.__broken = true; });
    await startScan(page);
    await frames(page, 3);
    await page.evaluate(() => { window.__broken = false; });
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(A);
    expect(page.errors).toEqual([]);
  });

  test('it only ticks; a task you ticked stays ticked', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task]').first().locator('.row > input[data-acb]').first().check();
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual([true, ...A.slice(1)]);
  });

  test('Stop ends it; so does Delete everything', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await page.locator('[data-act="scan-stop"]').click();
    await expect(bar(page)).toHaveCount(0);
    const g = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBe(g);

    await startScan(page);
    await openCog(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    await expect(bar(page)).toHaveCount(0);
    const g2 = await grabs(page);
    await page.waitForTimeout(1200);
    expect(await grabs(page)).toBeLessThanOrEqual(g2 + 1);
  });

  test('without the screen permission, it says how to fix it', async ({ page }) => {
    await inAlt1(page, { pixel: false });
    await openApp(page, expect);
    await openCog(page);
    await page.locator('[data-act="scan-open"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#rd-msg')).toContainText('permission');
    await expect(bar(page)).toHaveCount(0);
  });
});
