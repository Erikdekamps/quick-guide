// Temporary: finds tasks with sub-steps on the wiki's area pages. Remove before the PR.
const base = require('@playwright/test');
const test = base.test;
const API = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=';
const AREAS = ['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness'];
const slim = (h) => h.replace(/\s(srcset|decoding|loading|data-file-width|data-file-height|width|height|typeof|style|class|data-mw[\w-]*)="[^"]*"/g, '').replace(/<img[^>]*>/g, '').replace(/\s+/g, ' ');

test('probe: where is Red, Red Pies of Summer, and what do list-notes look like', async ({ request }) => {
  let listRows = 0;
  for (const a of AREAS) {
    const d = await (await request.get(API + encodeURIComponent(a + ' achievements'))).json();
    const h = d.parse ? d.parse.text : '';
    const rows = h.match(/<tr data-rowid="\d+">[\s\S]*?<\/tr>/g) || [];
    for (const r of rows) {
      const name = ((/<td[^>]*><a[^>]*>([^<]*)<\/a>/.exec(r.replace(/<td>\d+<\/td>/, '')) || [])[1] || '');
      const tds = r.match(/<td[\s\S]*?<\/td>/g) || [];
      const notes = tds.length >= 6 ? tds[tds.length - 2] : '';
      const hasOl = /<ol/.test(notes), hasUl = /<ul/.test(notes);
      if (/Red, Red Pies/i.test(name)) console.log('PROBE FOUND', a, '|', name, '| ROW', slim(r).slice(0, 3000));
      if (hasOl || hasUl) { listRows++; console.log('PROBE LIST', a, '|', name, '|', hasOl ? 'OL' : 'UL', '|', slim(notes).slice(0, 220)); }
    }
  }
  console.log('PROBE LISTROWS', listRows);
});
