// Temporary: reads the wiki's Area Tasks pages, to build the next feature. Remove before the PR.
const base = require('@playwright/test');
const test = base.test;
const API = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=';
const AREAS = ['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness'];

async function page(request, name) {
  const r = await request.get(API + encodeURIComponent(name));
  const d = await r.json();
  return d.parse ? d.parse.text : '';
}
// Smaller HTML: no picture sizes, srcsets, decoding hints or data-file attributes, no navboxes.
function slim(h) {
  return h.replace(/\s(srcset|decoding|loading|data-file-width|data-file-height|width|height|typeof|data-mw[\w-]*)="[^"]*"/g, '')
    .replace(/<table class="navbox[\s\S]*$/, '')
    .replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
}

test('probe: summary of all area pages', async ({ request }) => {
  for (const a of AREAS) {
    const h = await page(request, a + ' achievements');
    const heads = [...h.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => m[1] + ':' + m[2].replace(/<[^>]+>/g, '').trim());
    const tables = [...h.matchAll(/<table([^>]*)>([\s\S]*?)<\/table>/g)].map((m) => ((/class="([^"]*)"/.exec(m[1]) || [])[1] || '-').split(' ')[0] + '/' + (m[2].match(/<tr[\s>]/g) || []).length);
    console.log('SUM', a, '| len', h.length, '| H', heads.join(' ; '), '| T', tables.join(' '));
  }
});

test('probe: slim html of two area pages', async ({ request }) => {
  for (const a of ['Ardougne', 'Lumbridge']) {
    const s = slim(await page(request, a + ' achievements'));
    console.log('SLIMLEN', a, s.length);
    for (let i = 0; i < s.length; i += 4000) console.log('HTML|' + a + '|' + String(i / 4000).padStart(3, '0') + '|' + s.slice(i, i + 4000));
  }
});
