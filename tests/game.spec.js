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
  desert: '/tests/fixtures/game/desktop-alt1-easy-desert.png',
  // Elite Desert: 4 not done (Desert's badge is red and green, with no tick), 1 locked (only its lock shows),
  // 1 done; no title in view in the list on the left.
  elite: '/tests/fixtures/game/desktop-alt1-elite-desert.png'
};
// The chat, as on a real game screen: the same green line over and over ("The ensouled moonstone consumes…"),
// whose letters line up like a column of ticks, more of them than the tasks in view.
const CHAT = 'The ensouled moonstone consumes the escaped spirit of the rock.';
const HARD_DAEMONHEIM = ['not', 'not', 'not', 'locked', 'locked', 'done', 'done'];
// The badges of each area, cut from the game: where each one is in tests/fixtures/game/badges.png.
const BADGES = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'game', 'badges.json'), 'utf8'));
// Reads a picture with each row's badge swapped for one of the same state from the sprite: cells.todo, cells.done
// and cells.locked (a row of a state the sprite has no badge for keeps its own).
function readWithBadges(page, src, cells) {
  return page.evaluate(async ([s, c]) => {
    const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const im = await load(s), sprite = await load('/tests/fixtures/game/badges.png');
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const R = window.QuickGuideReader, before = R.read(x.getImageData(0, 0, im.width, im.height).data, im.width, im.height);
    before.rows.forEach((row) => {
      const at = row.done ? c.done : row.locked ? c.locked : c.todo;
      if (at) x.drawImage(sprite, at[0], at[1], 28, 28, before.x0 - 7, row.y - 21, 28, 28);
    });
    const r = R.read(x.getImageData(0, 0, im.width, im.height).data, im.width, im.height);
    return r.found ? r.rows.map((row) => (row.locked ? 'locked' : row.done ? 'done' : 'not')) : null;
  }, [src, cells]);
}

// Reads a picture with the reader, in the page. scale resizes it first; cut keeps only the top part;
// filter is a canvas filter, or 'jpeg' to save it as a JPEG first.
function readShot(page, src, o) {
  o = Object.assign({ scale: 1, cut: 1, filter: '', open: null, raw: false }, o);
  return page.evaluate(([s, k, c, f, open, o]) => new Promise((done, fail) => {
    const im = new Image();
    im.onload = async () => {
      const w = Math.round(im.width * k), h = Math.round(im.height * k * c);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      if (f && f !== 'jpeg') x.filter = f;
      x.drawImage(im, 0, 0, w, Math.round(im.height * k));
      if (f === 'jpeg') { const j = new Image(); j.src = cv.toDataURL('image/jpeg', 0.6); await j.decode(); x.drawImage(j, 0, 0); }
      const d = x.getImageData(0, 0, w, h);
      // A task opened up: everything from this height down moves down, and the box above it grows.
      if (open) {
        const from = open[0], by = open[1], copy = new Uint8ClampedArray(d.data);
        for (let yy = h - 1; yy >= from + by; yy--) d.data.set(copy.subarray((yy - by) * w * 4, (yy - by + 1) * w * 4), yy * w * 4);
        for (let yy = from; yy < from + by; yy++) d.data.set(copy.subarray((from - 3) * w * 4, (from - 2) * w * 4), yy * w * 4);
      }
      const r = window.QuickGuideReader.read(d.data, w, h);
      if (o.raw) return done({ found: r.found, sure: !!r.sure, opened: !!r.opened, rows: r.rows.map((row) => (row.done ? 'done' : 'not')) });
      done(r.found ? r.rows.map((row) => (row.locked ? 'locked' : row.done ? 'done' : 'not') + (row.partial ? ' cut' : '')) : null);
    };
    im.onerror = fail;
    im.src = s;
  }), [src, o.scale, o.cut, o.filter, o.open, { raw: o.raw }]);
}

test.describe('the screen reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/js/game/reader.js' });
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

  test('Elite Desert: the green in Desert\'s badge is not a tick, and a locked task with only its lock showing is found', async ({ page }) => {
    expect(await readShot(page, SHOT.elite)).toEqual(['not', 'not', 'not', 'not', 'locked', 'done']);
  });

  test('a bigger interface (Alt1 at a higher interface scale) reads the same', async ({ page }) => {
    for (const k of [1.25, 1.5, 2]) expect(await readShot(page, SHOT.daemonheim, { scale: k }), String(k)).toEqual(HARD_DAEMONHEIM);
  });

  // Every area has its own badge (Falador's is a blue shield, Karamja's a palm), cut from the game into a sprite
  // (tests/fixtures/game/badges.png, with badges.json saying where each one is). Each area's badges go over the
  // badges of a real list: its rows are still found by their boxes, done is still the gold title, and a lock is a lock.
  test('every area\'s own badges, from the sprite: the list is read the same', async ({ page }) => {
    expect((await readShot(page, SHOT.daemonheim, { raw: true })).sure).toBe(true);
    for (const [area, cells] of Object.entries(BADGES.areas)) {
      const c = {};
      for (const [k, at] of Object.entries(cells)) { const st = /locked$/.test(k) ? 'locked' : /done$/.test(k) ? 'done' : 'todo'; if (!c[st]) c[st] = at; }
      expect(await readWithBadges(page, SHOT.daemonheim, c), area).toEqual(HARD_DAEMONHEIM);
      expect(await readWithBadges(page, SHOT.desert, c), area + ' (Desert\'s list)').toEqual(['not', 'not', 'done', 'done', 'done', 'done']);
    }
  });

  test('the sprite of badges: every badge in badges.json is a whole 28 x 28 cell of badges.png', async ({ page }) => {
    const size = await page.evaluate(async () => { const im = new Image(); im.src = '/tests/fixtures/game/badges.png'; await im.decode(); return [im.width, im.height]; });
    const all = Object.values(BADGES.areas).flatMap((cells) => Object.values(cells));
    expect(all.length).toBeGreaterThanOrEqual(15);
    for (const [x, y] of all) {
      expect(x % BADGES.cell + y % BADGES.cell).toBe(0);
      expect(x + BADGES.cell <= size[0] && y + BADGES.cell <= size[1]).toBe(true);
    }
  });

  test('a task opened up to show its steps: only the rows above it are read', async ({ page }) => {
    // The fifth row (from 405 to 464) is opened up by 40 pixels: the rows down to it are read.
    const r = await readShot(page, SHOT.daemonheim, { open: [464, 40], raw: true });
    expect(r).toEqual({ found: true, sure: true, opened: true, rows: ['not', 'not', 'not', 'not', 'not'] });
    // The second row opened up: the rows under it are more, but they are out of place. None is read.
    expect(await readShot(page, SHOT.daemonheim, { open: [278, 40], raw: true })).toEqual({ found: true, sure: true, opened: true, rows: [] });
  });

  test('the tier names the app comes with: all 52, each unlike the others, and they fit the game', async ({ page }) => {
    await page.addScriptTag({ url: '/js/game/tiernames.js' });
    const res = await page.evaluate((src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; }).then((im) => {
      const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', R = window.QuickGuideReader;
      const unpack = (str) => {
        const p = str.split(','), w = +p[0], h = +p[1], m = new Uint8Array(w * h);
        for (let i = 0; i < p[2].length; i++) { const v = B64.indexOf(p[2][i]); for (let b = 5; b >= 0; b--) { const j = i * 6 + (5 - b); if (j < m.length) m[j] = (v >> b) & 1; } }
        return { w, h, m };
      };
      const keys = Object.keys(window.QuickGuideTierNames), base = keys.map((k) => unpack(window.QuickGuideTierNames[k]));
      let closest = 1;
      for (let a = 0; a < base.length; a++) for (let b = a + 1; b < base.length; b++) closest = Math.min(closest, R.textDiffer(base[a], base[b]));
      // The rows of the tier list in a picture of the game: each is the name it should be, and no other.
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      const r = R.read(x.getImageData(0, 0, im.width, im.height).data, im.width, im.height);
      const seen = r.panel.rows.filter((row) => row.at >= 0).map((row) => {
        let d1 = 1, d2 = 1, at = -1;
        base.forEach((b, k) => { const d = R.textDiffer(row.sig, b); if (d < d1) { d2 = d1; d1 = d; at = k; } else if (d < d2) d2 = d; });
        return d1 < 0.2 && d1 < d2 * 0.7 ? keys[at] : '?';
      });
      return { keys, closest, seen };
    }), SHOT.screen);
    expect(res.keys.length).toBe(52);
    expect(res.keys.slice(0, 5)).toEqual(['Ardougne|easy', 'Ardougne|medium', 'Ardougne|hard', 'Ardougne|elite', 'Daemonheim|easy']);
    expect(res.keys).toContain('Lumbridge|beginner');
    expect(res.keys).toContain("Seers' Village|elite");
    expect(res.closest).toBeGreaterThan(0.24);
    expect(res.seen.slice(0, 9)).toEqual(['Ardougne|easy', 'Ardougne|medium', 'Ardougne|hard', 'Ardougne|elite', 'Daemonheim|easy', 'Daemonheim|medium', 'Daemonheim|hard', 'Daemonheim|elite', 'Desert|easy']);
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
    test.skip(!!process.env.QG_COVERAGE, 'measuring which code runs makes it slow');
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

  // The list of tiers on the left: which row has the gold box, and where the "Area Tasks" title is.
  function readPanel(page, src, k, smooth) {
    return page.evaluate(([s, k, sm]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const w = Math.round(im.width * k), h = Math.round(im.height * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d'); x.imageSmoothingEnabled = sm; x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data, R = window.QuickGuideReader, r = R.read(d, w, h);
        const p = r.found ? (r.panel || R.panel(d, w, h, r.x0)) : null;
        done(p && { head: p.head, tail: p.tail, rows: p.rows.length });
      };
      im.src = s;
    }), [src, k, smooth]);
  }

  test('the list of tiers on the left: the "Area Tasks" title says which row is picked', async ({ page }) => {
    // Easy Ardougne is picked, right under the title; on Easy Desert, the title is 8 rows up.
    expect(await readPanel(page, SHOT.screen, 1, false)).toMatchObject({ head: 0 });
    expect(await readPanel(page, SHOT.desert, 1, false)).toMatchObject({ head: -8 });
    // No title in view: it does not guess.
    expect(await readPanel(page, SHOT.elite, 1, false)).toMatchObject({ head: null, tail: null });
  });

  // A big screen (like 2560 x 1360) shows the interface bigger: the gold box's edge is 2 or 3 pixels thick,
  // and the rows are taller. It must read the same.
  for (const k of [2, 2.06, 3]) {
    test('the list of tiers on a bigger screen (' + k + ' times as big) reads the same', async ({ page }) => {
      for (const smooth of [false, true]) {
        expect(await readPanel(page, SHOT.screen, k, smooth), 'Ardougne ' + smooth).toMatchObject({ head: 0 });
        expect(await readPanel(page, SHOT.desert, k, smooth), 'Desert ' + smooth).toMatchObject({ head: -8 });
        const e = await readPanel(page, SHOT.elite, k, smooth);
        expect(e, 'Elite ' + smooth).toMatchObject({ head: null, tail: null });
        expect(e.rows, 'Elite ' + smooth).toBeGreaterThanOrEqual(10);
      }
    });
  }

  // A chat full of one green line: its letters, the same on every line, line up like a
  // column of ticks, more of them than the tasks in view. The list is the one with the tier list (and its gold box)
  // on its left; with no tier list in view, only a column whose rows are as far apart as a task list's.
  // The whole game screen picture with a chat under it: lines of a font size, so far apart, then made scale times as big.
  function readWithChat(page, o) {
    return page.evaluate(([src, chat, o]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height + o.lines * o.gap + 40;
        const x = cv.getContext('2d'); x.fillStyle = '#16120e'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0);
        if (o.noBox) { x.fillStyle = 'rgb(40,36,33)'; x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 145, 1); }
        x.fillStyle = '#00ff00'; x.font = o.font + 'px sans-serif';
        for (let i = 0; i < o.lines; i++) x.fillText('[17:3' + (i % 10) + ':50] ' + chat + ' (' + (30 + i) + '/50)', 10, im.height + 30 + i * o.gap);
        const w = Math.round(cv.width * o.scale), h = Math.round(cv.height * o.scale), big = document.createElement('canvas');
        big.width = w; big.height = h;
        const bx = big.getContext('2d'); bx.drawImage(cv, 0, 0, w, h);
        const R = window.QuickGuideReader, r = R.read(bx.getImageData(0, 0, w, h).data, w, h);
        done(r.found ? r.rows.map((q) => (q.done ? 'Y' : 'n')).join('') + (r.panel ? ' head ' + r.panel.head : ' no tier list') : 'none');
      };
      im.src = src;
    }), [SHOT.screen, CHAT, o]);
  }

  test('a chat full of the same green line never wins over the list, however many lines, big or small', async ({ page }) => {
    for (const [font, gap] of [[12, 15], [13, 17], [14, 18]]) {
      for (const lines of [8, 16]) {
        for (const scale of [1, 1.28, 2]) {
          expect(await readWithChat(page, { font, gap, lines, scale }), [font, gap, lines, scale].join(' ')).toBe('YYYYYYY head 0');
        }
      }
    }
  });

  test('with the tier list out of view, the chat is still not taken for the list', async ({ page }) => {
    for (const scale of [1, 1.28]) expect(await readWithChat(page, { font: 13, gap: 17, lines: 16, scale, noBox: true }), String(scale)).toBe('YYYYYYY no tier list');
  });

  // A picture made smaller or blurred: the gold box's lines come out darker, and one can break.
  test('a dim gold box with a broken line is still found', async ({ page }) => {
    const res = await page.evaluate((src) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        x.fillStyle = 'rgb(40,36,33)'; x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 145, 1); x.fillRect(514, 244, 1, 30); x.fillRect(658, 244, 1, 30);
        x.fillStyle = 'rgb(175,159,101)';
        x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 50, 1); x.fillRect(567, 273, 92, 1); x.fillRect(658, 244, 1, 30);
        const R = window.QuickGuideReader, d = x.getImageData(0, 0, im.width, im.height).data, r = R.read(d, im.width, im.height);
        done(r.panel ? { head: r.panel.head, box: r.panel.box } : null);
      };
      im.src = src;
    }), SHOT.screen);
    expect(res).toMatchObject({ head: 0, box: { x0: 514, x1: 658 } });
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
      // Looks at the game 10 times a second, not 2, so the tests are quick. Two looks in a row must still agree.
      window.__scanMs = 100;
      window.__scroll = 0; window.__grabs = 0; window.__closed = false; window.__broken = false; window.__shot = null; window.__noise = 0; window.__wobble = 0; window.__patches = 0;
      window.alt1 = {
        permissionPixel: pixel, rsLinked: true, rsWidth: fw, rsHeight: fh,
        getRegion: (rx, ry, rw, rh) => {
          window.__grabs++;
          if (window.__broken) throw new Error('capture failed');
          if (limit && rw * rh * 4 > limit) return '';
          const s = window.__shot, top = window.__scroll, noise = window.__noise, u = new Uint8Array(rw * rh * 4);
          new Uint32Array(u.buffer).fill(0xff000000);   // black, not see-through
          if (!s || window.__closed) return bytes(u);
          // Each badge's edge moves a little from look to look, each its own way (the text next to it does not).
          // What shows through the window: patches of 16 x 16 pixels, each a little lighter or darker, new every look.
          const pat = {};
          const patch = (x, y) => { const k = (x >> 4) + ',' + (y >> 4); if (!(k in pat)) pat[k] = Math.round((Math.random() * 2 - 1) * window.__patches); return pat[k]; };
          const wobs = [];
          for (let k = 0; k < 16; k++) wobs.push(window.__wobble ? Math.round((Math.random() * 2 - 1) * window.__wobble) : 0);
          const x1 = Math.min(rx + rw, s.w);
          for (let yy = ry; yy < ry + rh; yy++) {
            const o = (yy - ry) * rw * 4, sy = yy + top;
            if (sy >= 0 && sy < s.h && x1 > rx) u.set(s.bgra.subarray((sy * s.w + rx) * 4, (sy * s.w + x1) * 4), o);
            if (window.__wobble) {
              const wob = wobs[Math.max(0, Math.floor((yy + top - 150) / 62)) % 16], wy = sy + wob;
              for (let xx = Math.max(rx, 690); xx <= Math.min(718, x1 - 1); xx++) {
                const j = o + (xx - rx) * 4;
                if (wy < 0 || wy >= s.h) { u[j] = u[j + 1] = u[j + 2] = 0; continue; }
                const i = (wy * s.w + xx) * 4;
                u[j] = s.bgra[i]; u[j + 1] = s.bgra[i + 1]; u[j + 2] = s.bgra[i + 2];
              }
            }
            if ((noise || window.__patches) && sy >= 0 && sy < s.h) {
              for (let xx = rx; xx < x1; xx++) {
                const j = o + (xx - rx) * 4, n = (noise ? Math.round((Math.random() * 2 - 1) * noise) : 0) + (window.__patches ? patch(xx, yy) : 0);
                if (n) for (let k = 0; k < 3; k++) u[j + k] = Math.max(0, Math.min(255, u[j + k] + n));
              }
            }
          }
          return bytes(u);
        }
      };
      function bytes(u) {
        let out = '';
        for (let i = 0; i < u.length; i += 32768) out += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
        return btoa(out);
      }
    }, [o.w, o.h, o.pixel, o.limit]);
  }
  // Puts a screenshot on the fake game screen. On the whole-screen one, pick: the row of the tier list on the left
  // that has the gold box (0 is Easy Ardougne), and other: another list on the right (rows 1 to 6 upside down),
  // as when another tier is clicked in the game. scale: a bigger screen (smooth: blurred a little, as when resized).
  // list: the task list scrolled down that many pixels (one row is 62). chat: that many lines of chat under the game.
  async function show(page, src, o) {
    await page.evaluate(([s, pick, other, cover, scale, smooth, list, chat, line, edge, notitle, nobox, open]) => new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height + (chat ? 300 : 0);
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        // The "Area Tasks" title's green icon painted away: as if the list on the left has no title in view.
        if (notitle) { x.fillStyle = 'rgb(47,45,43)'; x.fillRect(508, 200, 36, 37); }
        if (pick) {
          x.fillStyle = 'rgb(40,36,33)';
          x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 145, 1); x.fillRect(514, 244, 1, 30); x.fillRect(658, 244, 1, 30);
          const y = 244 + 36 * pick;
          x.fillStyle = 'rgb(255,203,5)';
          x.fillRect(514, y, 145, 1); x.fillRect(514, y + 29, 145, 1); x.fillRect(514, y, 1, 30); x.fillRect(658, y, 1, 30);
        }
        // The gold box painted away: as if the tier you clicked is scrolled out of view in the list on the left.
        if (nobox) { x.fillStyle = 'rgb(40,36,33)'; x.fillRect(514, 244, 145, 1); x.fillRect(514, 273, 145, 1); x.fillRect(514, 244, 1, 30); x.fillRect(658, 244, 1, 30); }
        if (other) for (let k = 0; k < 6; k++) x.drawImage(im, 686, 176 + k * 62, 484, 62, 686, 176 + (5 - k) * 62, 484, 62);
        if (cover) {
          // A tooltip over three rows, with text in it.
          x.fillStyle = 'rgb(24,22,20)'; x.fillRect(700, 250, 330, 170);
          x.fillStyle = '#ddd'; x.font = '13px sans-serif';
          for (let k = 0; k < 8; k++) x.fillText('Some words about this task, line ' + (k + 1), 712, 272 + k * 19);
        }
        if (edge) {
          // Right of the scrollbar: the window's gold edge (it starts well above the list and ends inside it, with
          // dark ground under it), and sand-coloured rocks. Both have the colour of the scrollbar's handle.
          x.fillStyle = 'rgb(12,10,8)'; x.fillRect(1182, 0, cv.width - 1182, cv.height);
          x.fillStyle = 'rgb(185,160,119)'; x.fillRect(1188, 40, 2, 560);
          x.fillStyle = 'rgb(196,168,124)'; x.fillRect(1200, 230, 60, 300);
        }
        if (chat) {
          // A chat under the game: the same green line, chat times.
          x.fillStyle = '#16120e'; x.fillRect(0, im.height, cv.width, 300);
          x.fillStyle = '#00ff00'; x.font = '13px sans-serif';
          for (let i = 0; i < chat; i++) x.fillText('[17:3' + (i % 10) + ':50] ' + line + ' (' + (30 + i) + '/50)', 10, im.height + 24 + i * 17);
        }
        if (list) {
          // The task list scrolled down by list pixels, as in the game: only the rows move (what comes in at the
          // bottom is left empty), and the scrollbar's handle moves down its track.
          const X0 = 686, X1 = 1167, Y0 = 176, Y1 = 572, h = Y1 - Y0 - list, was = document.createElement('canvas');
          was.width = cv.width; was.height = cv.height; was.getContext('2d').drawImage(cv, 0, 0);
          x.fillStyle = 'rgb(18,16,14)'; x.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
          if (h > 0) x.drawImage(was, X0, Y0 + list, X1 - X0, h, X0, Y0, X1 - X0, h);
          x.fillStyle = 'rgb(11,9,7)'; x.fillRect(1171, 189, 7, 383);
          x.drawImage(was, 1171, 189, 7, 113, 1171, 189 + Math.round(list * 0.262), 7, 113);
        }
        if (open) {
          // A task opened up to show its steps: the list from that height down moves down, and the row above grows.
          const X0 = 686, X1 = 1167, was = document.createElement('canvas');
          was.width = cv.width; was.height = cv.height; was.getContext('2d').drawImage(cv, 0, 0);
          x.drawImage(was, X0, open[0], X1 - X0, 572 - open[0] - open[1], X0, open[0] + open[1], X1 - X0, 572 - open[0] - open[1]);
          x.drawImage(was, X0, open[0] - 3, X1 - X0, 1, X0, open[0], X1 - X0, open[1]);
        }
        // A bigger screen: the same picture, scale times as big.
        const W = Math.round(cv.width * scale), H = Math.round(cv.height * scale), big = document.createElement('canvas');
        big.width = W; big.height = H;
        const bx = big.getContext('2d'); bx.imageSmoothingEnabled = scale === 1 || smooth; bx.drawImage(cv, 0, 0, W, H);
        const d = bx.getImageData(0, 0, W, H).data, bgra = new Uint8Array(d.length);
        for (let i = 0; i < d.length; i += 4) { bgra[i] = d[i + 2]; bgra[i + 1] = d[i + 1]; bgra[i + 2] = d[i]; bgra[i + 3] = 255; }
        window.__shot = { w: W, h: H, bgra };
        done();
      };
      im.src = s;
    }), [src, (o && o.pick) || 0, !!(o && o.other), !!(o && o.cover), (o && o.scale) || 1, !!(o && o.smooth), (o && o.list) || 0, (o && o.chat) || 0, CHAT, !!(o && o.edge), !!(o && o.notitle), !!(o && o.nobox), (o && o.open) || null]);
  }
  // Daemonheim and Desert with 4 tiers each, as in the game (the other areas have one tier on the fake wiki).
  function fourTiers(wiki) {
    for (const n of ['Daemonheim', 'Desert']) {
      wiki.page(n + ' achievements', areaPage(['Easy', 'Medium', 'Hard', 'Elite'].map((t, i) => ({
        name: t, tasks: Array.from({ length: 12 }, (_, k) => ({ id: 7000 + (n === 'Desert' ? 100 : 0) + i * 20 + k, name: n + ' ' + t + ' task ' + (k + 1), desc: 'A task.' }))
      }))));
    }
  }
  // Counts each time the bar says "Lost my place" from now on (in window.__lost).
  function countLost(page) {
    return page.evaluate(() => {
      window.__lost = 0;
      new MutationObserver(() => { const m = document.getElementById('scan-msg'); if (m && /Lost/.test(m.textContent)) window.__lost++; })
        .observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true });
    });
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

  test('the window\'s gold edge and sand-coloured rocks next to the list are not taken for the scrollbar', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    for (const scale of [1, 2, 1]) {
      await show(page, SHOT.screen, { edge: true, scale });
      if (!(await bar(page).count())) await startScan(page);
      await expect(tier(page)).toHaveText('Easy Ardougne');
      await expect(page.locator('#scan-msg'), 'scale ' + scale).toHaveText('Tasks 1–7 of 23.');
    }
    // Scrolled down a row: the handle is still found, and says so.
    await show(page, SHOT.screen, { edge: true, list: 62 });
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 2–7 of 23.');
    expect(page.errors).toEqual([]);
  });

  test('a big screen, twice as big: it finds the tier by itself and ticks the done tasks', async ({ page }) => {
    await inAlt1(page, { w: 2488, h: 1494 });
    await openApp(page, expect);
    await show(page, SHOT.screen, { scale: 2 });
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // And the next tier, clicked in the game.
    await show(page, SHOT.screen, { scale: 2, pick: 1, other: true });
    await expect(tier(page)).toHaveText('Medium Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 1, 8)).toEqual(ALL7);
  });

  test('the whole game screen with a chat full of green lines: it finds Easy Ardougne by itself and ticks its tasks', async ({ page }) => {
    await inAlt1(page, { h: 747 + 300 });
    await openApp(page, expect);
    await show(page, SHOT.screen, { chat: 16 });
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
  });

  test('it starts at the tier picked in the game, found from the "Area Tasks" title above it', async ({ page, wiki }) => {
    fourTiers(wiki);   // as in the game, so the ninth tier is Easy Desert
    await inAlt1(page, { w: 1174, h: 718 });
    await openApp(page, expect);
    await show(page, SHOT.desert);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Desert');
    // The list is scrolled down (the scrollbar says so), so it does not know which task the first row is yet.
    await expect(page.locator('#scan-msg')).toHaveText('Scroll this list to the top.');
    expect(await ticked(page, 'Desert', 0, 12)).toEqual(Array(12).fill(false));
  });

  test('the list on the left scrolled on, no title in view: it knows the picked tier from the rows around it', async ({ page, wiki }) => {
    fourTiers(wiki);
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // Now Elite Desert is picked in the game; the rows around it are ones it saw on the first screen.
    await show(page, SHOT.elite);
    await expect(tier(page)).toHaveText('Elite Desert', { timeout: 10000 });
    await expect.poll(() => ticked(page, 'Desert', 3, 7)).toEqual([false, false, false, false, false, true, false]);
  });

  test('the tier names are remembered: a later scan, after a reload, knows them without the title in view', async ({ page, wiki }) => {
    fourTiers(wiki);
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await page.locator('[data-act="scan-stop"]').click();
    await page.reload();
    await expect(page.locator('#qcount')).toBeVisible();
    await show(page, SHOT.elite);
    await startScan(page);
    await expect(tier(page)).toHaveText('Elite Desert', { timeout: 10000 });
    await expect.poll(() => ticked(page, 'Desert', 3, 7)).toEqual([false, false, false, false, false, true, false]);
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

  test('no title in view: the next tier of the same area (the names look alike) is still seen as another tier', async ({ page, wiki }) => {
    fourTiers(wiki);
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // "Easy Ardougne", "Hard Ardougne" and "Elite Ardougne" share most of their letters.
    for (const [pick, name] of [[2, 'Hard Ardougne'], [3, 'Elite Ardougne'], [1, 'Medium Ardougne'], [5, 'Medium Daemonheim'], [0, 'Easy Ardougne']]) {
      await show(page, SHOT.screen, { pick, notitle: true, other: pick % 2 === 1 });
      await expect(tier(page), name).toHaveText(name);
      await expect(page.locator('#scan-msg'), name).toHaveText(/^Tasks 1–\d of \d+/);
    }
    expect(page.errors).toEqual([]);
  });

  test('the tier you clicked is out of view in the list on the left: it says so, and goes on when it shows', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen, { nobox: true });
    await startScan(page);
    await expect(page.locator('#scan-msg')).toHaveText('Which tier is this? Scroll the list on the left until the tier you clicked (the gold box) shows.');
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(Array(8).fill(false));
    await show(page, SHOT.screen);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // Out of view again, later: the tier stays as it was.
    await show(page, SHOT.screen, { nobox: true });
    await frames(page, 3);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
  });

  test('a task opened up in the game: the tasks down to it are set, and the bar says to close it', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    // The third task (from 301 to 360) is opened up by 40 pixels.
    await show(page, SHOT.screen, { open: [361, 40] });
    await startScan(page);
    await expect(tier(page)).toHaveText('Easy Ardougne');
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–3 of 23. A task is opened up in the game: close it (click its arrow) to scan the tasks under it.');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual([true, true, true, false, false, false, false, false]);
    // The first task opened up: nothing under it can be placed.
    await show(page, SHOT.screen, { open: [237, 40] });
    await expect(page.locator('#scan-msg')).toHaveText('A task is opened up in the game: close it (click its arrow) to scan the tasks under it.');
    // Closed again: the rest is read.
    await show(page, SHOT.screen);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    expect(page.errors).toEqual([]);
  });

  test('a task the game shows as not done (or locked) is unticked', async ({ page }) => {
    await inAlt1(page, { w: 1602, h: 1166 });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    const boxes = page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task] > .row > input[data-acb]');
    for (let i = 0; i < 4; i++) await boxes.nth(i).check();
    await boxes.nth(9).check();
    // Twice the normal interface size: the tier names the app comes with do not fit. This picture has no title in
    // view in the list on the left either, so the app cannot tell which tier it is.
    await show(page, SHOT.daemonheim, { scale: 2 });
    await startScan(page);
    await expect(page.locator('#scan-msg')).toHaveText('Which tier is this? Scroll the list on the left up until Area Tasks shows (only needed once).');
    expect(await ticked(page, 'Ardougne', 0, 10)).toEqual([true, true, true, true, false, false, false, false, false, true]);
    await page.locator('[data-act="scan-next"]').click();
    await expect(tier(page)).toHaveText('Easy Ardougne');
    // Rows 1 to 7 are set to what the game shows; task 10 is not on the screen, so it stays.
    await expect.poll(() => ticked(page, 'Ardougne', 0, 10)).toEqual([...DAEM.slice(0, 7), false, false, true]);
  });

  test('no title in view, first scan ever: the app knows the tier by its name, and sets its tasks', async ({ page, wiki }) => {
    fourTiers(wiki);
    await inAlt1(page, { w: 801, h: 583 });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Daemonheim"][data-atier="hard"]').click();
    const boxes = page.locator('section[data-asec="tasks"] .secb > ul.steps > li[data-task] > .row > input[data-acb]');
    for (let i = 0; i < 4; i++) await boxes.nth(i).check();
    await boxes.nth(9).check();
    // Hard Daemonheim has the gold box; the "Area Tasks" title is not in view.
    await show(page, SHOT.daemonheim);
    await startScan(page);
    await expect(tier(page)).toHaveText('Hard Daemonheim');
    await expect.poll(() => ticked(page, 'Daemonheim', 2, 10)).toEqual([...DAEM.slice(0, 7), false, false, true]);
    // Nothing was learnt or saved: the names it came with were enough.
    expect(await stored(page, 'tiernames')).toBeNull();
    expect(page.errors).toEqual([]);
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

  test('scrolling the task list in the game (the rows move, the scrollbar does not): each row stays on its task', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // Half a row, one row, two rows down: the rows are matched to the last look by their text.
    for (const [dy, msg] of [[31, /^Tasks [12]–7 of 23\.$/], [62, 'Tasks 2–7 of 23.'], [124, 'Tasks 3–7 of 23.'], [93, /^Tasks [23]–7 of 23\.$/]]) {
      await show(page, SHOT.screen, { list: dy });
      await expect(page.locator('#scan-msg'), String(dy)).toHaveText(msg);
      await expect(tier(page)).toHaveText('Easy Ardougne');
    }
    // Back at the top: the scrollbar says so again.
    await show(page, SHOT.screen);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
    // Nothing was shifted by a row: the eighth task (never in view) is still not ticked.
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
  });

  test('scrolled too far in one go (no row like the last look): it says so, and finds its place at the top again', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    // Rows from another list, scrolled: nothing like the last look.
    await show(page, SHOT.screen, { other: true, list: 62 });
    await expect(page.locator('#scan-msg')).toHaveText('Lost my place: scroll back a little.');
    expect(await ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await show(page, SHOT.screen);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1–7 of 23.');
  });

  // The window is a little see-through, so every look at
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
    await page.evaluate(() => { window.__noise = 6; window.__patches = 10; });
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8)).toEqual(ALL7);
    await countLost(page);
    await frames(page, 10);
    expect(await page.evaluate(() => window.__lost)).toBe(0);
    await expect(page.locator('#scan-msg')).toHaveText('Tasks 1\u20137 of 23.');
    await expect(tier(page)).toHaveText('Easy Ardougne');
  });

  test('badges that move a few pixels on every look, and no scrolling: it never loses its place', async ({ page }) => {
    await inAlt1(page);
    await openApp(page, expect);
    await show(page, SHOT.screen);
    await page.evaluate(() => { window.__noise = 10; window.__wobble = 2; });
    await startScan(page);
    // A wobble can hide a row for a look, and each task needs two looks in a row that agree: on a slow machine
    // that can take a few seconds.
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8), { timeout: 15000 }).toEqual(ALL7);
    await countLost(page);
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
    // Another row picked in the game: the arrows no longer hold, the gold box counts again.
    await show(page, SHOT.screen, { pick: 4 });
    await expect(tier(page)).toHaveText('Easy Daemonheim');
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
    test.skip(!!process.env.QG_COVERAGE, 'measuring which code runs makes it slow');
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
        if (ms === window.__scanMs && window.__last) { const l = window.__last; window.__ticks.push(performance.now() - l.t - (window.__fake - l.f)); window.__last = null; }
        return st.apply(this, arguments);
      };
    });
    await startScan(page);
    await expect.poll(() => ticked(page, 'Ardougne', 0, 8), { timeout: 20000 }).toEqual(ALL7);
    await expect.poll(() => page.evaluate(() => window.__ticks.length), { timeout: 20000 }).toBeGreaterThanOrEqual(8);
    const ms = await page.evaluate(() => window.__ticks.slice(2));
    // The middle one: one slow look (the test machine is busy with other tests) does not count.
    const mid = ms.slice().sort((a, b) => a - b)[Math.floor(ms.length / 2)];
    // The app looks every 500 ms, so a look must stay well under that: at most 150 ms, or on a slow machine 25
    // times a plain pass over as many pixels as one look reads (the middle one of 9; a look takes about 15). The
    // test machines on GitHub differ and are shared, and the pass is timed after the looks, when the machine
    // may be less busy than during them: the limit leaves room for that.
    const ref = await page.evaluate(() => {
      const n = 1048 * 1360, px = new Uint8ClampedArray(n * 4).fill(37), out = new Uint8Array(n), times = [];
      for (let k = 0; k < 9; k++) {
        const t = performance.now();
        for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = ((px[j] + px[j + 1] + px[j + 2]) * 21846) >> 16;
        times.push(performance.now() - t);
      }
      return times.sort((x, y) => x - y)[4];
    });
    const limit = Math.max(150, 25 * ref);
    console.log('one look, ms:', ms.map((x) => Math.round(x)).join(' '), 'middle', Math.round(mid), '| plain pass', ref.toFixed(1), 'ms, limit', Math.round(limit));
    expect(mid).toBeLessThan(limit);
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
    await page.waitForTimeout(500);
    expect(await grabs(page)).toBe(g);

    await startScan(page);
    await openCog(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    await expect(bar(page)).toHaveCount(0);
    const g2 = await grabs(page);
    await page.waitForTimeout(500);
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
