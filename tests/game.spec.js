// Read from game: Alt1 (or a screenshot) shows the in-game Achievements list, and the app ticks the done tasks.
// The screenshots are from the phone game. Desktop is smaller, so the reader is also checked on shrunk copies.
const { test, expect, fixture, openApp } = require('./support/app');

const SHOT = {
  ardougne: '/tests/fixtures/game/phone-ardougne-easy.png', senntisten: '/tests/fixtures/game/phone-senntisten.png',
  // Desktop: 3 not done (red), 2 locked (grey with a lock), 2 done (green tick).
  daemonheim: '/tests/fixtures/game/desktop-daemonheim-hard.png',
  // Desktop, the Area Tasks page before you pick a tier: the "Set tasks" with all kinds of badges.
  sets: '/tests/fixtures/game/desktop-set-tasks.png'
};
const FILE = { ardougne: 'tests/fixtures/game/phone-ardougne-easy.png', senntisten: 'tests/fixtures/game/phone-senntisten.png', daemonheim: 'tests/fixtures/game/desktop-daemonheim-hard.png', sets: 'tests/fixtures/game/desktop-set-tasks.png' };

// Reads a picture with the reader, in the page. scale shrinks it first; cut keeps only the top part.
function readShot(page, src, scale, cut) {
  return page.evaluate(([s, k, c]) => new Promise((done, fail) => {
    const im = new Image();
    im.onload = () => {
      const w = Math.round(im.width * k), h = Math.round(im.height * k * c);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, Math.round(im.height * k));
      const r = window.QuickGuideReader.read(x.getImageData(0, 0, w, h).data, w, h);
      done(r.found ? r.rows.map((row) => (row.locked ? 'locked' : row.done ? 'done' : 'not') + (row.partial ? ' cut' : '')) : null);
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

  test('desktop: not done, locked and done tasks', async ({ page }) => {
    expect(await readShot(page, SHOT.daemonheim)).toEqual(['not', 'not', 'not', 'locked', 'locked', 'done', 'done']);
  });

  test('desktop, bigger interface (scaled up): reads the same', async ({ page }) => {
    for (const k of [1.25, 1.5, 2]) expect(await readShot(page, SHOT.daemonheim, k)).toEqual(['not', 'not', 'not', 'locked', 'locked', 'done', 'done']);
  });

  test('desktop "Set tasks" page (no tier picked): nothing that could be ticked', async ({ page }) => {
    const rows = await readShot(page, SHOT.sets);
    expect(rows === null || !rows.includes('done')).toBe(true);
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
    // The cut one is either left out or marked as cut: never read as a whole row.
    expect([undefined, 'done cut', 'not cut']).toContain(rows[6]);
    expect(rows.length).toBeLessThanOrEqual(7);
  });

  // The same screenshots made harder: as if the game were darker, greyer, blurry, or saved as a JPEG.
  test('a darker, greyer, blurry or JPEG picture reads the same', async ({ page }) => {
    for (const f of ['brightness(0.6)', 'brightness(1.4)', 'contrast(0.6)', 'saturate(0.5)', 'blur(1px)', 'jpeg']) {
      const rows = (src, scale) => page.evaluate(([s, filter, k]) => new Promise((done) => {
        const im = new Image();
        im.onload = async () => {
          const w = Math.round(im.width * k), h = Math.round(im.height * k);
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const x = cv.getContext('2d');
          if (filter !== 'jpeg') x.filter = filter;
          x.drawImage(im, 0, 0, w, h);
          if (filter === 'jpeg') {
            const j = new Image(); j.src = cv.toDataURL('image/jpeg', 0.6); await j.decode();
            x.drawImage(j, 0, 0);
          }
          const r = window.QuickGuideReader.read(x.getImageData(0, 0, w, h).data, w, h);
          done(r.found ? r.rows.map((row) => (row.locked ? 'locked' : row.done ? 'done' : 'not')) : null);
        };
        im.src = s;
      }), [src, f, scale || 0.5]);
      expect(await rows(SHOT.ardougne), f).toEqual(Array(7).fill('done'));
      expect(await rows(SHOT.senntisten), f).toEqual(['not', 'done', 'done', 'done', 'done', 'done', 'done']);
      // Desktop at its own size. A lock can fade out in a poor picture; then that row is simply not there.
      // What matters: the 2 done ones are found, and nothing else is read as done.
      const d = await rows(SHOT.daemonheim, 1);
      expect(d, f).not.toBeNull();
      expect(d.length, f).toBeLessThanOrEqual(7);
      expect(d.slice(-2), f).toEqual(['done', 'done']);
      expect(d.filter((x) => x === 'done').length, f).toBe(2);
    }
  });

  // Random red and green shapes, like a busy game screen. With no list, nothing may be found;
  // with the list window on top, it must still read right.
  test('a busy screen full of red and green things: no list is made up, and a real one is still read', async ({ page }) => {
    const res = await page.evaluate((list) => Promise.all(list.map((s) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = s; })))
      .then((shots) => {
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const out = { empty: 0, wrong: [] };
        for (let n = 0; n < 40; n++) {
          const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
          const x = cv.getContext('2d');
          x.fillStyle = 'rgb(' + [0, 0, 0].map(() => Math.floor(rnd() * 80)).join() + ')'; x.fillRect(0, 0, 1280, 720);
          const cols = ['#c81e1e', '#28c828', '#961414', '#5adc5a', '#785a3c', '#1e1e1e', '#dcc83c', '#3ca03c', '#aa2828', '#649696', '#82aaaa'];
          for (let i = 0; i < 300; i++) {
            x.fillStyle = cols[Math.floor(rnd() * cols.length)];
            const r = 2 + rnd() * 28;
            x.beginPath();
            if (i % 2) x.ellipse(rnd() * 1280, rnd() * 720, r / 2, r * (0.25 + rnd() / 2), 0, 0, 7); else x.rect(rnd() * 1280, rnd() * 720, r, r * (0.5 + rnd()));
            x.fill();
          }
          if (window.QuickGuideReader.read(x.getImageData(0, 0, 1280, 720).data, 1280, 720).found) out.empty++;
          if (n < 15) {
            // Phone screenshots shrunk to desktop size, and the desktop one at its own size or a bit bigger.
            const im = shots[n % 3], k = n % 3 === 2 ? 1 + rnd() * 0.3 : 0.3 + rnd() * 0.2, w = Math.round(im.width * k), h = Math.round(im.height * k);
            x.drawImage(im, Math.floor(rnd() * (1280 - w)), Math.floor(rnd() * (720 - h)), w, h);
            const r = window.QuickGuideReader.read(x.getImageData(0, 0, 1280, 720).data, 1280, 720);
            const got = r.found ? r.rows.map((row) => (row.locked ? 'L' : row.done ? 'Y' : 'n')).join('') : 'none';
            const want = ['YYYYYYY', 'nYYYYYY', 'nnnLLYY'][n % 3];
            if (got !== want && got !== 'none') out.wrong.push(n + ':' + got);
            if (got === 'none') out.missed = (out.missed || 0) + 1;
          }
        }
        return out;
      }), [SHOT.ardougne, SHOT.senntisten, SHOT.daemonheim]);
    expect(res.empty).toBe(0);          // never a list where there is none
    expect(res.wrong).toEqual([]);      // never a wrong reading
    expect(res.missed || 0).toBeLessThanOrEqual(2);   // missing one now and then is fine: scanning tries again
  });

  test('it is quick: a full 1920 x 1080 screen in well under the time between scans', async ({ page }) => {
    const ms = await page.evaluate((s) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0, 1920, 1080 * im.height / im.width * 1920 / 1920);
        const d = x.getImageData(0, 0, 1920, 1080).data, t = performance.now();
        for (let i = 0; i < 5; i++) window.QuickGuideReader.read(d, 1920, 1080);
        done((performance.now() - t) / 5);
      };
      im.src = s;
    }), SHOT.senntisten);
    expect(ms).toBeLessThan(250);
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

  test('a desktop screenshot: done tasks ticked, locked ones counted, the rest left alone', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-file').setInputFiles(FILE.daemonheim);
    await expect(page.locator('#rd-msg')).toHaveText(/Found 7 tasks: 2 done, 2 locked\. Ticked 2\./);
    expect(await doneList(page, 8)).toEqual([false, false, false, false, false, true, true, false]);
  });

  test('the desktop "Set tasks" page ticks nothing', async ({ page }) => {
    await openArdougne(page);
    await page.locator('[data-act="read"]').click();
    await page.locator('#rd-file').setInputFiles(FILE.sets);
    await expect(page.locator('#rd-msg')).toBeVisible();
    await expect(page.locator('#rd-msg')).not.toHaveText(/Reading/);
    expect(await doneList(page, 23)).toEqual(Array(23).fill(false));
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
  // window.__shot picks the screenshot (when there are several), __closed shows a black screen, __broken makes it throw.
  async function fakeAlt1(page, src, h, scale) {
    await page.evaluate(([list, fh, k]) => Promise.all(list.map((s) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const w = Math.round(im.width * k), full = Math.round(im.height * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = full;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, full);
        done({ w, full, all: x.getImageData(0, 0, w, full).data });
      };
      im.src = s;
    }))).then((shots) => {
      window.__scroll = 0; window.__grabs = 0; window.__shot = 0; window.__closed = false; window.__broken = false;
      window.alt1 = {
        permissionPixel: true, rsLinked: true, rsWidth: shots[0].w, rsHeight: fh,
        getRegion: (rx, ry, rw, rh) => {
          window.__grabs++;
          if (window.__broken) throw new Error('capture failed');
          const { w, full, all } = shots[window.__shot], top = window.__scroll;
          let out = '';
          for (let yy = ry; yy < ry + rh; yy++) {
            for (let xx = rx; xx < rx + rw; xx++) {
              const sy = yy + top, i = (sy * w + xx) * 4;
              if (window.__closed || sy < 0 || sy >= full) { out += '\0\0\0\xff'; continue; }
              out += String.fromCharCode(all[i + 2], all[i + 1], all[i], 255);
            }
          }
          return btoa(out);
        }
      };
    }), [[].concat(src), h, scale || 0.5]);
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

  test('switching tier in the app waits until the game shows another list, then scans it from its first task', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, [SHOT.ardougne, SHOT.senntisten], 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(page.locator('#scan')).toContainText('Open Medium Ardougne in the game');
    await expect(page.locator('[data-act="scan-go"]')).toBeVisible();
    // The game still shows Easy: nothing is ticked in Medium.
    await frames(page, 4);
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    // Now the game shows another list.
    await page.evaluate(() => { window.__shot = 1; });
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
    await expect(page.locator('[data-act="scan-go"]')).toHaveCount(0);
    await page.locator('.tab[data-tier="easy"]').click();
    expect(await doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
  });

  test('Go: you already opened the tier in the game, so it scans right away', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.ardougne, 585);
    await page.locator('.tab[data-tier="medium"]').click();
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await page.locator('.tab[data-tier="hard"]').click();
    await frames(page, 3);
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    await page.locator('[data-act="scan-go"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
  });

  test('closing the list in the game and opening the new tier counts as a change', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.ardougne, 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
    await page.locator('.tab[data-tier="medium"]').click();
    await frames(page, 2);
    await page.evaluate(() => { window.__closed = true; });
    await frames(page, 3);
    await page.evaluate(() => { window.__closed = false; });
    await expect.poll(() => doneList(page, 8)).toEqual([...Array(7).fill(true), false]);
  });

  test('desktop: scanning at the real size, scrolling through locked rows', async ({ page }) => {
    await openArdougne(page);
    // The list part of the desktop picture is 400 pixels tall here; scroll it 10 pixels at a time.
    await fakeAlt1(page, SHOT.daemonheim, 470, 1);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await frames(page, 2);
    for (let y = 10; y <= 100; y += 10) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
    }
    await expect.poll(() => doneList(page, 8)).toEqual([false, false, false, false, false, true, true, false]);
    expect(page.errors).toEqual([]);
  });

  test('scrolling down and back up keeps each row on its own task', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 440);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await frames(page, 2);
    for (const y of [25, 50, 75, 100, 125, 145, 120, 95, 70, 45, 20, 0, 30, 60, 90]) {
      await page.evaluate((v) => { window.__scroll = v; }, y);
      await frames(page, 2);
    }
    await expect.poll(() => doneList(page, 9)).toEqual([false, true, true, true, true, true, true, false, false]);
    await expect(page.locator('#scan')).toContainText(/tasks \d+–\d+ in view/);
  });

  test('closing the list in the game: it keeps looking; open it again and it goes on', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.evaluate(() => { window.__closed = true; });
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await frames(page, 3);
    await expect(page.locator('#scan')).toContainText('Open Easy Ardougne in the game');
    expect(await doneList(page, 8)).toEqual(Array(8).fill(false));
    await page.evaluate(() => { window.__closed = false; });
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
  });

  test('a picture that fails to come through does not stop the scanning', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.evaluate(() => { window.__broken = true; });
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await frames(page, 3);
    await page.evaluate(() => { window.__broken = false; });
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
    expect(page.errors).toEqual([]);
  });

  test('ticks from scanning are saved, and the area list shows them', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect(page.locator('#pg-cnt')).toHaveText('6 / 23 tasks');
    await page.reload();
    await expect(page.locator('#pg-cnt')).toHaveText('6 / 23 tasks');
    await expect(page.locator('#scan')).toHaveCount(0);
    await page.locator('[data-act="change"]').click();
    await expect(page.locator('.q[data-area="Ardougne"][data-atier="easy"]')).toContainText('6 / 23');
  });

  test('newer Alt1: pictures come from alt1.capture as raw bytes', async ({ page }) => {
    await openArdougne(page);
    await fakeAlt1(page, SHOT.senntisten, 585);
    await page.evaluate(() => {
      const a = window.alt1;
      a.capture = (x, y, w, h) => { const b = atob(a.getRegion(x, y, w, h)), u = new Uint8ClampedArray(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
      const old = a.getRegion; a.getRegion = () => { throw new Error('should use capture'); }; a.__old = old;
      a.capture = ((cap) => (x, y, w, h) => { a.getRegion = old; const r = cap(x, y, w, h); a.getRegion = () => { throw new Error('should use capture'); }; return r; })(a.capture);
    });
    await page.locator('[data-act="read"]').click();
    await page.locator('[data-act="scan-start"]').click();
    await expect.poll(() => doneList(page, 8)).toEqual([false, true, true, true, true, true, true, false]);
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
