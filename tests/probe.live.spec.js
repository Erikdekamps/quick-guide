// Temporary: reads the wiki's Area Tasks pages, to design the next feature. Remove before the PR.
const base = require('@playwright/test');
const test = base.test;
const API = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=';

async function page(request, name) {
  const r = await request.get(API + encodeURIComponent(name));
  const d = await r.json();
  return d.parse ? { title: d.parse.title, html: d.parse.text } : { error: JSON.stringify(d.error) };
}
function outline(html) {
  const out = [];
  const re = /<(h[2-4])[^>]*>([\s\S]*?)<\/\1>|<table([^>]*)>([\s\S]*?)<\/table>/g;
  let m;
  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  while ((m = re.exec(html))) {
    if (m[1]) out.push('HEAD ' + m[1] + ': ' + strip(m[2]).slice(0, 80));
    else {
      const rows = m[4].split(/<tr[\s>]/).slice(1);
      out.push('TABLE class=' + ((/class="([^"]*)"/.exec(m[3]) || [])[1] || '') + ' rows=' + rows.length);
      rows.slice(0, 4).forEach((r) => out.push('  ROW ' + strip(r).slice(0, 260)));
      rows.slice(0, 2).forEach((r) => out.push('  RAW ' + r.slice(0, 1200).replace(/\s+/g, ' ')));
    }
  }
  return out;
}

test('probe: Area Tasks achievements', async ({ request }) => {
  const p = await page(request, 'Area Tasks achievements');
  console.log('PROBE TITLE', p.title || p.error);
  if (p.html) {
    console.log('PROBE LEN', p.html.length);
    outline(p.html).slice(0, 80).forEach((l) => console.log('PROBE', l));
    const links = [...new Set([...p.html.matchAll(/href="\/w\/([^"#?]+)"/g)].map((m) => decodeURIComponent(m[1])))].filter((l) => /achievements|Area_Tasks|tasks/i.test(l));
    console.log('PROBE LINKS', JSON.stringify(links.slice(0, 80)));
  }
});

test('probe: one area page', async ({ request }) => {
  for (const name of ['Ardougne achievements', 'Ardougne area tasks', 'Ardougne Area Tasks achievements']) {
    const p = await page(request, name);
    console.log('PROBE AREA', name, '->', p.title || p.error);
    if (!p.html) continue;
    console.log('PROBE LEN', p.html.length);
    outline(p.html).slice(0, 60).forEach((l) => console.log('PROBE', l));
    break;
  }
});

test('probe: RuneMetrics has no achievements, check what profile has', async ({ request }) => {
  const r = await request.get('https://runescape.wiki/cors/m=adventurers-log/api/v1/profile?user=Zezima&activities=0');
  const t = await r.text();
  console.log('PROBE PROFILE', r.status(), t.slice(0, 600));
});
