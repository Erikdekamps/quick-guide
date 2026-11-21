// A design board: one screen of the app as a file for the design canvas (designs/canvas/<Name>.dc.html).
// A board is the app's own markup, taken from the running app, with the current style.css in it. Nothing in a board
// is written by hand: npm run designs builds them (tools/designs/boards.spec.js has what each board shows).
//
// The canvas draws a board with its own script, support.js. That file belongs to the canvas and is not in this repo.
// The pictures in designs/screenshots do not need it: page() turns a board into a plain page that any browser shows.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANVAS = path.join(ROOT, 'designs', 'canvas'), SHOTS = path.join(ROOT, 'designs', 'screenshots');
// Where the app is on the internet: a board's pictures of the app itself (the icon) come from there.
const SITE = 'https://erikdekamps.github.io/quick-guide/';
const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&amp;family=Fira+Mono:wght@500&amp;family=Fira+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&amp;display=swap';
// On or off in HTML, and how a board says "on": the canvas reads {{ true }} as a value, hidden takes plain "true".
const SWITCHES = ['checked', 'disabled', 'open', 'selected'];

// style.css for a board. The grain (a noise filter over the window) is left out: the canvas draws many boards at once.
function boardCss(css) { return css.replace(/--grain: url\([^;]*\);/g, '--grain: none;'); }

// Runs in the page: the screen as it is now, as HTML. What you typed and ticked is only in the page's memory, so it is
// written into the markup first (on a copy).
// pick: only these parts of the screen (selectors), one after the other; without it, the whole screen.
function snapshot(pick) {
  const app = document.getElementById('app'), copy = app.cloneNode(true);
  const live = app.querySelectorAll('input, textarea, option'), kept = copy.querySelectorAll('input, textarea, option');
  live.forEach((el, i) => {
    const to = kept[i];
    if (el.tagName === 'TEXTAREA') to.textContent = el.value;
    else if (el.tagName === 'OPTION') to.toggleAttribute('selected', el.selected);
    else if (el.type === 'checkbox' || el.type === 'radio') to.toggleAttribute('checked', el.checked);
    else if (el.value) to.setAttribute('value', el.value); else to.removeAttribute('value');
  });
  // A picture of the app itself gets its full address.
  copy.querySelectorAll('img[src]').forEach((im) => { im.setAttribute('src', im.src); });
  const html = pick ? pick.map((sel) => copy.querySelector(sel).outerHTML).join('') : copy.outerHTML;
  return { html, theme: document.documentElement.getAttribute('data-theme') || '' };
}

// The markup of a screen, the way a board holds it.
function boardMarkup(html) {
  let s = html.split('http://quick-guide.test/').join(SITE);
  for (const name of SWITCHES) s = s.replace(new RegExp(' ' + name + '=""', 'g'), ' ' + name + '="{{ true }}"');
  return s.replace(/ hidden=""/g, ' hidden="true"');
}

// The board file. o: { title, html (from snapshot), theme, css (style.css), width, height }
function board(o) {
  const w = o.width || 360, h = o.height || 720;
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + o.title + ' – Quick Guide</title>\n' +
    '<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n<link rel="stylesheet" href="' + FONTS + '">\n' +
    '<style>\n' + boardCss(o.css) + '\n</style>\n</helmet>\n' +
    '<div style="width: ' + w + 'px; height: ' + h + 'px"' + (o.theme ? ' data-theme="' + o.theme + '"' : '') + '>\n' + boardMarkup(o.html) + '\n</div>\n</x-dc>\n' +
    '<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":' + w + ',"height":' + h + '}}\'>\n' +
    'class Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}\n</script>\n</body>\n</html>\n';
}

// The parts of a board file: { title, head (what is in <helmet>), body (what the canvas draws), width, height }.
function parts(text) {
  const head = /<helmet>\n?([\s\S]*?)<\/helmet>/.exec(text), body = /<\/helmet>\n?([\s\S]*?)<\/x-dc>/.exec(text);
  const size = /"\$preview":\{"width":(\d+),"height":(\d+)\}/.exec(text), title = /<title>([\s\S]*?)<\/title>/.exec(text);
  if (!head || !body || !size) throw new Error('Not a design board: it has no <helmet>, <x-dc> or size');
  return { title: title ? title[1] : '', head: head[1], body: body[1], width: +size[1], height: +size[2] };
}

// A board as a plain page, for its picture: what support.js does on the canvas, as far as a picture needs it.
function page(text) {
  const p = parts(text);
  let body = p.body.replace(/ hidden="true"/g, ' hidden');
  for (const name of SWITCHES) body = body.replace(new RegExp(' ' + name + '="\\{\\{ true \\}\\}"', 'g'), ' ' + name);
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + p.title + '</title>\n' + p.head +
    '<style>html, body { margin: 0; width: ' + p.width + 'px; height: ' + p.height + 'px; overflow: hidden; }</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n';
}

// ---------- a sheet: a board with many parts of the app next to each other (Components) ----------
// Its styles are style.css, then the sheet's own, which start at this line.
const SHEET_CSS = '/* the design sheet around the parts */';
// One part of a sheet is <section class="spec"><h2>Name <code>key</code></h2><div class="pane">the app's markup</div>
// <p class="cap">what it shows</p></section>.
function partAt(text, name) {
  const start = text.indexOf('<section class="spec"><h2>' + name + ' <code>');
  const pane = start < 0 ? -1 : text.indexOf('<div class="pane', start), open = pane < 0 ? -1 : text.indexOf('>', pane) + 1;
  const cap = open < 1 ? -1 : text.indexOf('</div><p class="cap">', open), end = cap < 0 ? -1 : text.indexOf('</p></section>', cap);
  if (end < 0 || text.indexOf('<section', start + 1) < end) throw new Error('The sheet has no part "' + name + '" with a pane and a caption');
  return { open, cap, capOpen: cap + '</div><p class="cap">'.length, end };
}
// The sheet with new markup (from snapshot) and a new caption in one of its parts.
function sheetPart(text, name, html, caption) {
  const at = partAt(text, name);
  return text.slice(0, at.open) + boardMarkup(html) + text.slice(at.cap, at.capOpen) + caption + text.slice(at.end);
}
// The sheet with the current style.css; its own styles stay.
function sheetCss(text, css) {
  const from = text.indexOf('<style>\n'), own = text.indexOf(SHEET_CSS);
  if (from < 0 || own < from) throw new Error('The sheet has no styles of its own ("' + SHEET_CSS + '")');
  return text.slice(0, from + 8) + boardCss(css) + '\n' + text.slice(own);
}
// The sheet with a new height (what the canvas gives it).
function sheetHeight(text, height) {
  const re = /("\$preview":\{"width":\d+,"height":)\d+/;
  if (!re.test(text)) throw new Error('The sheet has no size');
  return text.replace(re, '$1' + height);
}

function file(name) { return path.join(CANVAS, name + '.dc.html'); }
function picture(name) { return path.join(SHOTS, name + '.png'); }
// Writes a board. Returns true when the file changed.
function save(name, text) {
  const f = file(name), was = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (was !== text) fs.writeFileSync(f, text);
  return was !== text;
}

module.exports = { ROOT, CANVAS, SHOTS, SITE, SHEET_CSS, boardCss, snapshot, boardMarkup, board, parts, page, sheetPart, sheetCss, sheetHeight, file, picture, save };
