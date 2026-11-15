// The app's icon. One picture, icon.svg: in the title band of the start screen and on the browser tab.
// icon.png is made from it ("npm run icon"), for Alt1's list of apps.
// It is generic, so it fits both themes: a neutral grey tile with a silver rim, and a green tick (green is
// "done" in both themes). Nothing in it is brown or blue.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, openApp, seed } = require('./support/app');

// Draws a picture at size x size in the page, and gives back its pixels (RGBA).
function pixels(page, src, size) {
  return page.evaluate(([s, n]) => new Promise((done, fail) => {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0, n, n);
      done(Array.from(x.getImageData(0, 0, n, n).data));
    };
    im.onerror = () => fail(new Error('could not load ' + s));
    im.src = s;
  }), [src, size || 64]);
}
// Sorts the solid pixels of a picture by their colour.
function kinds(p) {
  const k = { green: 0, warm: 0, cool: 0, grey: 0, clear: 0 };
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], a = p[i + 3];
    if (a < 200) k.clear++;
    else if (g > r + 40 && g > b + 40) k.green++;
    else if (r > b + 20) k.warm++;
    else if (b > r + 20) k.cool++;
    else k.grey++;
  }
  return k;
}

test.describe('the app icon', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/__blank'); });

  test('icon.png is the same picture as icon.svg, 64 x 64 (npm run icon makes it)', async ({ page }) => {
    const png = fs.readFileSync(path.join(ROOT, 'icon.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([64, 64]);
    const a = await pixels(page, '/icon.svg'), b = await pixels(page, '/icon.png');
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
    expect(diff / a.length).toBeLessThan(2);
  });

  test('it fits both themes: a grey tile and a green tick, nothing brown or blue', async ({ page }) => {
    const k = kinds(await pixels(page, '/icon.svg'));
    expect(k.grey).toBeGreaterThan(64 * 64 * 0.6);
    expect(k.green).toBeGreaterThan(150);
    expect(k.warm).toBe(0);
    expect(k.cool).toBe(0);
  });

  test('round corners, and it fills its square', async ({ page }) => {
    const p = await pixels(page, '/icon.svg'), at = (x, y) => p[(y * 64 + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) expect(at(x, y), x + ',' + y).toBe(0);
    for (const [x, y] of [[32, 3], [3, 32], [60, 32], [32, 60]]) expect(at(x, y), x + ',' + y).toBe(255);
  });

  test('still clear when small: the tick shows on a browser tab (16 x 16)', async ({ page }) => {
    const k = kinds(await pixels(page, '/icon.svg', 16));
    expect(k.green).toBeGreaterThanOrEqual(10);
    expect(k.warm + k.cool).toBe(0);
  });

  test('the browser tab shows icon.svg (icon.png for an old browser), and Alt1 gets icon.png', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="icon" href="icon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="alternate icon" href="icon.png" type="image/png">');
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'appconfig.json'), 'utf8')).iconUrl).toBe('./icon.png');
  });
});

test.describe('in the title band', () => {
  for (const theme of ['brown', 'blue']) {
    test('the same icon in the ' + theme + ' theme, sharp at any text size', async ({ page }) => {
      await seed(page, { settings: { theme, fontSize: 20 } });
      await openApp(page, expect);
      const emb = page.locator('.hdr img.emb');
      await expect(emb).toHaveAttribute('src', 'icon.svg');
      expect(await emb.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
      // the window parts keep their size: the text size setting does not make it bigger
      expect(await emb.boundingBox()).toMatchObject({ width: 26, height: 26 });
      // it stands out from the band behind it: its silver rim is much lighter than the band just above it
      const hb = await page.locator('.hdr').boundingBox(), eb = await emb.boundingBox();
      const png = (await page.locator('.hdr').screenshot()).toString('base64');
      const lum = await page.evaluate(async ([src, e, w]) => {
        const im = new Image();
        im.src = 'data:image/png;base64,' + src;
        await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        const k = im.width / w, at = (px, py) => { const d = x.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
        return { rim: at(e.x + e.w / 2, e.y + 1), band: at(e.x + e.w / 2, e.y - 6) };
      }, [png, { x: eb.x - hb.x, y: eb.y - hb.y, w: eb.width }, hb.width]);
      expect(lum.rim - lum.band).toBeGreaterThan(60);
    });
  }
});
