// Read from game: Alt1 shows the in-game Achievements list, and the app ticks the done tasks.
// Alt1 runs on a computer only, so the tests use screenshots of the desktop game, and a fake Alt1 that hands them over.
const { test, expect, openApp, openCog, stored, withAllAreas, areaPage } = require('./support/app');

const SHOT = {
  // Hard Daemonheim: 3 not done (red), 2 locked (grey with a lock), 2 done (green tick).
  daemonheim: '/tests/fixtures/game/desktop-daemonheim-hard.png',
  // The Area Tasks page before you pick a tier: the "Set tasks", with all kinds of badges.
  sets: '/tests/fixtures/game/desktop-set-tasks.png',
  // The whole game screen in Alt1, with this app open on the left (scanning) and Easy Ardougne (all done) on the right.
  screen: '/tests/fixtures/game/desktop-alt1-ardougne-easy.png',
  // The same, on Easy Desert, scrolled down a bit: 2 not done at the top (the first one half under the edge above).
  desert: '/tests/fixtures/game/desktop-alt1-easy-desert.png'
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

  test('a red badge is a little smaller than one with a tick, but is not taken for a cut-off row', async ({ page }) => {
    expect(await readShot(page, SHOT.desert)).toEqual(['not', 'not', 'done', 'done', 'done', 'done']);
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
  const ALL7 = [true, true, true, true, true, true, true, false];
  // Hard Daemonheim's list: tasks 6 and 7 done, 1 to 5 not (3 red, 2 locked).
  const DAEM = [false, false, false, false, false, true, true, false];

  // A fake Alt1, there from the start like the real one. It shows one "frame" of the game at a time: a screenshot,
  // moved up by __scroll pixels. getRegion hands back base64 BGRA, as Alt1 does. __closed shows a black screen,
  // __broken makes it throw. limit: like Alt1, too much at once gives nothing.
  async function inAlt1(page, o) {
    o = Object.assign({ w: 1244, h: 747, pixel: true, limit: 0 }, o);
    await page.addInitScript(([fw, fh, pixel, limit]) => {
      window.__scroll = 0; window.__grabs = 0; window.__closed = false; window.__broken = false; window.__shot = null; window.__noise = 0; window.__wobble = 0; window.__patches = 0;
      window.alt1 = {
        permissionPixel: pixel, rsLinked: true, rsWidth: fw, rsHeight: fh,
        getRegion: (rx, ry, rw, rh) => {
          window.__grabs++;
          if (window.__broken) throw new Error('capture failed');
          if (limit && rw * rh * 4 > limit) return '';
          const s = window.__shot, top = window.__scroll, noise = window.__noise, u = new Uint8Array(rw * rh * 4);
          // Each badge's edge moves a little from look to look, each its own way (the text next to it does not).
          // What shows through the window: patches of 16 x 16 pixels, each a little lighter or darker, new every look.
          const pat = {};
          const patch = (x, y) => { const k = (x >> 4) + ',' + (y >> 4); if (!(k in pat)) pat[k] = Math.round((Math.random() * 2 - 1) * window.__patches); return pat[k]; };
          const wobs = [];
          for (let k = 0; k < 16; k++) wobs.push(window.__wobble ? Math.round((Math.random() * 2 - 1) * window.__wobble) : 0);
          let o = 0;
          for (let yy = ry; yy < ry + rh; yy++) {
            for (let xx = rx; xx < rx + rw; xx++, o += 4) {
              const wob = xx >= 690 && xx <= 718 ? wobs[Math.max(0, Math.floor((yy + top - 150) / 62)) % 16] : 0;
              const sy = yy + top + wob;
              u[o + 3] = 255;
              if (!s || window.__closed || sy < 0 || sy >= s.h || xx >= s.w) continue;
              const i = (sy * s.w + xx) * 4, n = (noise ? Math.round((Math.random() * 2 - 1) * noise) : 0) + (window.__patches ? patch(xx, yy) : 0);
              u[o] = s.d[i + 2] + n; u[o + 1] = s.d[i + 1] + n; u[o + 2] = s.d[i] + n;
              if (n) { for (let k = 0; k < 3; k++) u[o + k] = Math.max(0, Math.min(255, [s.d[i + 2], s.d[i + 1], s.d[i]][k] + n)); }
            }
          }
          let out = '';
          for (let i = 0; i < u.length; i += 32768) out += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
          return btoa(out);
        }
      };
    }, [o.w, o.h, o.pixel, o.limit]);
  }
  // Puts a screenshot on the fake game screen. On the whole-screen one, pick: the row of the tier list on the left
  // that has the gold box (0 is Easy Ardougne), and other: another list on the right (rows 1 to 6 upside down),
  // as when another tier is clicked in the game.
  async function show(page, src, o) {
    await page.evaluate(([s, pick, other, cover]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        if (pick) {
          x.fillStyle = 'rgb(40,36,33)';
          x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 145, 1); x.fillRect(514, 244, 1, 30); x.fillRect(658, 244, 1, 30);
          const y = 244 + 36 * pick;
          x.fillStyle = 'rgb(255,203,5)';
          x.fillRect(514, y, 145, 1); x.fillRect(514, y + 29, 145, 1); x.fillRect(514, y, 1, 30); x.fillRect(658, y, 1, 30);
        }
        if (other) for (let k = 0; k < 6; k++) x.drawImage(im, 686, 176 + k * 62, 484, 62, 686, 176 + (5 - k) * 62, 484, 62);
        if (cover) {
          // A tooltip over three rows, with text in it.
          x.fillStyle = 'rgb(24,22,20)'; x.fillRect(700, 250, 330, 170);
          x.fillStyle = '#ddd'; x.font = '13px sans-serif';
          for (let k = 0; k < 8; k++) x.fillText('Some words about this task, line ' + (k + 1), 712, 272 + k * 19);
        }
        window.__shot = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data };
        done();
      };
      im.src = s;
    }), [src, (o && o.pick) || 0, !!(o && o.other), !!(o && o.cover)]);
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
  const tier = (page) => page.locator('#scan-tier');

  test('outside Alt1 there is no Scan achievements', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await expect(page.locator('#cog')).toBeVisible();
    await expect(page.locator('[data-act="scan-open"]')).toHaveCount(0);
  });

  test('in Alt1 it is in the settings; the box says to open a tier and go on from there', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await openCog(page);
    await page.locator('[data-act="scan-open"]').click();
    const dlg = page.locator('#rd');
    await expect(dlg).toContainText('Hero');
    await expect(dlg).toContainText('click a tier');
    await expect(dlg).toContainText('The app sees which one you picked');
    await expect(dlg).toContainText('not done is unticked');
    await page.locator('[data-act="rd-close"]').click();
    await expect(dlg).toHaveCount(0);
    // No button per tier.
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('[data-act="read"]')).toHaveCount(0);
  });

  test('Start: the bar names the tier, short, and its done tasks are ticked', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(bar(page).locator('.sk')).toHaveText(/^1\/\d+$/);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await page.locator('.tab[data-home="areas"]').click();
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="easy"]')).toContainText('7 / 23');
    expect(page.errors).toEqual([]);
  });

  test('it starts at the tier picked in the game, found from the "Area Tasks" title above it', async ({ page, wiki }) => {
    // As in the game: 4 tiers in each area, so the ninth is Easy Desert.
    for (const n of ['Daemonheim', 'Desert']) {
      wiki.page(n + ' achievements', areaPage(['Easy', 'Medium', 'Hard', 'Elite'].map((t, i) => ({ name: t, tasks: Array.from({ length: 12 }, (_, k) => ({ id: 7000 + (n === 'Desert' ? 100 : 0) + i * 20 + k, name: n + ' ' + t + ' task ' + (k + 1), desc: 'A task.' })) }))));
    }
    await inAlt1(page, { w: 1174, h: 718 });
    await openApp(page, expect);
    await show(page, SHOT.desert);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Desert');
    // The list is scrolled down (the scrollbar says so), so it does not know which task the first row is yet.
    await expect(page.locator('#scan-msg')).toHaveText('Scroll this list to the top.');
    expect(await ticked(page, 'Desert', 0, 12)).toEqual(Array(12).fill(false));
  });

  test('clicking the next tier in the game: the app reads which one has the gold box', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await show(page, SHOT.screen, { pick: 1, other: true });
    await expect(tier(page)).toHaveText('Medium Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 1, 8)).toEqual(ALL7);
    // Skipping ahead works too: the fifth row is Easy Daemonheim. And back to the first.
    await show(page, SHOT.screen, { pick: 4 });
    await expect(tier(page)).toHaveText('Easy Daemonheim');
    await show(page, SHOT.screen, { pick: 0, other: true });
    await expect(tier(page)).toHaveText('Easy Ardougne');
    // Nothing was ticked in a tier it was not shown.
    expect(await ticked(page, 'Ardougne', 2, 8)).toEqual(Array(8).fill(false));
  });

  test('a task the game shows as not done (or locked) is unticked', async ({ page }) => {
    await inAlt1(page, { w: 801, h: 583 });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    const boxes = page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task] > .row > input[data-acb]');
    for (let i = 0; i < 4; i++) await boxes.nth(i).check();
    await boxes.nth(9).check();
    await show(page, SHOT.daemonheim);
    await startScan(page);
    // This picture has no title in view in the list on the left, so the app cannot tell which tier it is.
    await expect(page.locator('#scan-msg')).toHaveText('Which one is this? Scroll the list on the left up to Area Tasks.');
    expect(await ticked(page, 'Ardougne', 0, 10)).toEqual([true, true, true, true, false, false, false, false, false, true]);
    await page.locator('[data-act="scan-next"]').click();
    await expect(tier(page)).toHaveText('Easy Ardougne');
    // Rows 1 to 7 are set to what the game shows; task 10 is not on the screen, so it stays.
    await expect.poll(() => ticked(page, 'Ardougne', 0, 10)).toEqual([...DAEM.slice(0, 7), false, false, true]);
  });

  test('scrolling, slowly or fast, down and back up, stays on the same tier and keeps each row on its task', async ({ page }) => {
    await inAlt1(page, { h: 640 });
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    for (const y of [10, 20, 30, 124, 0, 62, 100, 40, 0]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
      await expect(tier(page)).toHaveText('Easy Ardougne');
    }
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    expect(await ticked(page, 'Ardougne', 1, 8)).toEqual(Array(8).fill(false));
  });

  // What made the first version race through every tier: the window is a little see-through, so every look at
  // the game is a little different. It must stay on the tier, and not tick other tiers.
  test('a picture that is a little different every look (a see-through window) stays on the same tier', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => { window.__noise = 12; });
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await frames(page, 8);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    expect(await ticked(page, 'Ardougne', 1, 8)).toEqual(Array(8).fill(false));
    // And still knows the rows when the picture moves (here the whole window moves, so all 7 stay in view).
    await page.evaluate(() => { window.__scroll = 62; });
    await frames(page, 3);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1\u20137 of 23.');
    await expect(tier(page)).toHaveText('Easy Ardougne');
  });

  test('what shows through the window changes on every look, and no scrolling at all: it never loses its place', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => { window.__noise = 6; window.__patches = 10; window.__lost = 0; });
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await page.evaluate(() => {
      new MutationObserver(() => { const m = document.getElementById('scan-msg'); if (m && /Lost/.test(m.textContent)) window.__lost++; })
        .observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true });
    });
    await frames(page, 10);
    expect(await page.evaluate(() => window.__lost)).toBe(0);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1\u20137 of 23.');
    await expect(tier(page)).toHaveText('Easy Ardougne');
  });

  test('badges that move a few pixels on every look, and no scrolling: it never loses its place', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => { window.__noise = 10; window.__wobble = 3; window.__lost = 0; });
    await startScan(page);

    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await page.evaluate(() => {
      new MutationObserver(() => { const m = document.getElementById('scan-msg'); if (m && /Lost/.test(m.textContent)) window.__lost++; })
        .observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true });
    });
    await frames(page, 12);
    expect(await page.evaluate(() => window.__lost)).toBe(0);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1\u20137 of 23.');
    expect(await ticked(page, 'Ardougne', 1, 8)).toEqual(Array(8).fill(false));
  });

  test('a tooltip over some rows while scrolling: it keeps its place', async ({ page }) => {
    await inAlt1(page, { h: 640 });
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await show(page, SHOT.screen, { cover: true });
    for (const y of [20, 40, 62]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
    }
    await show(page, SHOT.screen);
    await frames(page, 2);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1\u20137 of 23.');
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    expect(await ticked(page, 'Ardougne', 1, 8)).toEqual(Array(8).fill(false));
  });

  test('the arrows set the tier, if the app got it wrong', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(page.locator('[data-act="scan-back"]')).toBeDisabled();
    await page.locator('[data-act="scan-next"]').click();
    await page.locator('[data-act="scan-next"]').click();
    await expect(tier(page)).toHaveText('Hard Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 2, 8)).toEqual(ALL7);
    // It stays: the picked row in the game is now Hard Ardougne.
    await frames(page, 3);
    await expect(tier(page)).toHaveText('Hard Ardougne');
    await page.locator('[data-act="scan-back"]').click();
    await expect(tier(page)).toHaveText('Medium Ardougne');
  });

  test('closing the list and opening it again stays on the same tier', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await page.evaluate(() => { window.__closed = true; });
    await expect(page.locator('#scan-msg')).toHaveText('No list seen in the 1244×747 picture.', { timeout: 10000 });
    await page.evaluate(() => { window.__closed = false; });
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await expect(tier(page)).toHaveText('Easy Ardougne');
  });

  test('the bar stays while you look around the app; an open tier shows the ticks at once', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await show(page, SHOT.screen);
    await startScan(page);
    const done = () => page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task]').evaluateAll((li) => li.slice(0, 8).map((x) => x.classList.contains('done')));
    await expect.poll(done).toEqual(ALL7);
    await page.locator('[data-act="change"]').click();
    await expect(page.locator('#qcount')).toBeVisible();
    await expect(bar(page)).toBeVisible();
  });

  test('the "Set tasks" page ticks nothing', async ({ page }) => {
    await inAlt1(page, { w: 805, h: 606 });
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
      await show(page, SHOT.screen);
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
      await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    });
  }

  test('older Alt1 on a big screen: the picture comes in strips (Alt1 gives at most about 4 MB at once)', async ({ page }) => {
    await inAlt1(page, { w: 2560, h: 1360, limit: 4000000 });
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8), { timeout: 20000 }).toEqual(ALL7);
  });

  // How long one look takes, on a big screen, with a picture that changes every time (so none is skipped).
  // Alt1's own copying is not counted: the fake one here is much slower than the real one.
  test('one look takes well under the time between looks, on a 2560 x 1360 screen', async ({ page }) => {
    await inAlt1(page, { w: 2560, h: 1360 });
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => {
      window.__noise = 6; window.__fake = 0; window.__ticks = [];
      const a = window.alt1, get = a.getRegion, R = window.QuickGuideReader, cap = R.capture;
      a.getRegion = function () { const t = performance.now(); const r = get.apply(this, arguments); window.__fake += performance.now() - t; return r; };
      R.capture = function () { const f0 = window.__fake, t = performance.now(); const c = cap.apply(this, arguments); window.__last = { t: t, f: f0 }; return c; };
      const st = window.setTimeout;
      window.setTimeout = function (fn, ms) {
        if (ms === 500 && window.__last) { const l = window.__last; window.__ticks.push(performance.now() - l.t - (window.__fake - l.f)); window.__last = null; }
        return st.apply(this, arguments);
      };
    });
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8), { timeout: 20000 }).toEqual(ALL7);
    await expect.poll(() => page.evaluate(() => window.__ticks.length), { timeout: 20000 }).toBeGreaterThanOrEqual(8);
    const ms = await page.evaluate(() => window.__ticks.slice(2));
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    console.log('one look, ms:', ms.map((x) => Math.round(x)).join(' '), 'average', Math.round(avg));
    expect(avg).toBeLessThan(100);
  });

  test('when Alt1 gives no picture, the bar says so', async ({ page }) => {
    await inAlt1(page, { limit: 1 });
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(page.locator('#scan-msg')).toHaveText('Alt1 gives no picture of the game.', { timeout: 10000 });
  });

  test('a picture that fails to come through does not stop the scanning', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => { window.__broken = true; });
    await startScan(page);
    await frames(page, 3);
    await page.evaluate(() => { window.__broken = false; });
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    expect(page.errors).toEqual([]);
  });

  test('Stop ends it; so does Delete everything', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
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
