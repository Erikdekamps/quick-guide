// The designs tool (tools/designs/board.js): a board file from the app's markup and style.css, a board as a plain page
// for its picture, and one part of the Components sheet. Building the boards themselves needs the app in a browser:
// npm run designs.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const B = require('../../tools/designs/board');

const CSS = ':root {\n  --grain: url("data:image/svg+xml,%3Csvg%3E");  /* more */\n}\n[data-theme="blue"] {\n  --grain: url("data:x");\n}\n.t { color: red; }\n';
const APP = '<div id="app"><input class="cb" type="checkbox" checked=""><input class="cb" type="checkbox"><p class="err" hidden=""></p>' +
  '<details open=""><summary>Map</summary></details><select><option value="a">A</option><option value="b" selected="">B</option></select>' +
  '<button disabled="">Up</button><form novalidate=""><input value="75 magic"></form><img src="http://quick-guide.test/icon.svg" alt=""></div>';

test.describe('a board', () => {
  test('has the app\'s markup as it is, with what is on or off written the way the canvas reads it', () => {
    expect(B.boardMarkup(APP)).toBe('<div id="app"><input class="cb" type="checkbox" checked="{{ true }}"><input class="cb" type="checkbox"><p class="err" hidden="true"></p>' +
      '<details open="{{ true }}"><summary>Map</summary></details><select><option value="a">A</option><option value="b" selected="{{ true }}">B</option></select>' +
      '<button disabled="{{ true }}">Up</button><form novalidate=""><input value="75 magic"></form><img src="https://erikdekamps.github.io/quick-guide/icon.svg" alt=""></div>');
  });

  test('has style.css as it is, without the grain', () => {
    expect(B.boardCss(CSS)).toBe(':root {\n  --grain: none;  /* more */\n}\n[data-theme="blue"] {\n  --grain: none;\n}\n.t { color: red; }\n');
  });

  test('is a file for the canvas: the title, the styles, the size, and the theme when it is not the usual one', () => {
    const text = B.board({ title: "My list: a goal's menu", html: APP, theme: '', css: CSS });
    expect(text).toContain("<title>My list: a goal's menu – Quick Guide</title>\n<script src=\"./support.js\"></script>");
    expect(text).toContain('<style>\n' + B.boardCss(CSS) + '\n</style>\n</helmet>\n<div style="width: 360px; height: 720px">\n<div id="app">');
    expect(text).toContain('data-props=\'{"$preview":{"width":360,"height":720}}\'');
    expect(text.endsWith('</script>\n</body>\n</html>\n')).toBe(true);
    const blue = B.board({ title: 'Blue', html: APP, theme: 'blue', css: CSS, width: 400, height: 300 });
    expect(blue).toContain('<div style="width: 400px; height: 300px" data-theme="blue">\n<div id="app">');
    expect(B.parts(blue)).toMatchObject({ title: 'Blue – Quick Guide', width: 400, height: 300 });
  });

  test('reads back: its parts, and a plain page for the picture that a browser shows without the canvas', () => {
    const text = B.board({ title: 'T', html: APP, theme: 'blue', css: CSS });
    const p = B.parts(text);
    expect(p.head).toContain('fonts.googleapis.com');
    expect(p.head).toContain('.t { color: red; }');
    expect(p.body).toBe('<div style="width: 360px; height: 720px" data-theme="blue">\n' + B.boardMarkup(APP) + '\n</div>\n');
    const page = B.page(text);
    // on or off the way HTML says it; the app's own markup is back as it was (but for the icon's address)
    expect(page).toContain(APP.replace(/ (checked|hidden|open|selected|disabled)=""/g, ' $1').replace('http://quick-guide.test/', B.SITE));
    expect(page).not.toContain('{{');
    expect(page).not.toContain('support.js');
    expect(page).not.toContain('x-dc');
    expect(page).toContain('html, body { margin: 0; width: 360px; height: 720px; overflow: hidden; }');
    expect(() => B.parts('<html><body>Hello</body></html>')).toThrow('Not a design board');
  });
});

test.describe('the Components sheet', () => {
  const part = (name, key, pane, cap) => '<section class="spec"><h2>' + name + ' <code>' + key + '</code></h2><div class="pane">' + pane + '</div><p class="cap">' + cap + '</p></section>';
  const SHEET = '<x-dc>\n<helmet>\n<style>\n.old { color: blue; }\n\n' + B.SHEET_CSS + '\n.sheet { width: 1536px; }\n</style>\n</helmet>\n<div class="sheet">\n' +
    part('Buttons', 'app', '<div><button>Go</button></div>', 'Buttons.') + '\n' + part('My list', 'todo', '<ul class="todo"><li><div>Old</div></li></ul>', 'Old words.') + '\n' +
    part('Search box', 'start screen', '<input>', 'Search.') + '\n</div>\n</x-dc>\n<script data-props=\'{"$preview":{"width":1536,"height":3012}}\'></script>\n';

  test('one part gets new markup and new words; the others stay', () => {
    const text = B.sheetPart(SHEET, 'My list', '<ul class="todo"><li><input type="checkbox" checked=""></li></ul>', 'New words.');
    expect(text).toBe(SHEET.replace('<ul class="todo"><li><div>Old</div></li></ul>', '<ul class="todo"><li><input type="checkbox" checked="{{ true }}"></li></ul>').replace('Old words.', 'New words.'));
    // again: the same
    expect(B.sheetPart(text, 'My list', '<ul class="todo"><li><input type="checkbox" checked=""></li></ul>', 'New words.')).toBe(text);
    expect(() => B.sheetPart(SHEET, 'Maps', '<p></p>', 'x')).toThrow('The sheet has no part "Maps"');
  });

  test('a part without a pane and a caption of its own is refused', () => {
    const odd = SHEET.replace('</div><p class="cap">Old words.</p>', '</div>');
    expect(() => B.sheetPart(odd, 'My list', '<p></p>', 'x')).toThrow('The sheet has no part "My list"');
  });

  test('gets the current style.css, and keeps its own styles', () => {
    const text = B.sheetCss(SHEET, CSS);
    expect(text).toContain('<style>\n' + B.boardCss(CSS) + '\n' + B.SHEET_CSS + '\n.sheet { width: 1536px; }\n</style>');
    expect(text).not.toContain('.old');
    expect(B.sheetCss(text, CSS)).toBe(text);
    expect(() => B.sheetCss('<style>\n.a {}\n</style>', CSS)).toThrow('The sheet has no styles of its own');
  });

  test('gets a new height', () => {
    expect(B.parts(B.sheetHeight(SHEET, 3170))).toMatchObject({ width: 1536, height: 3170 });
    expect(() => B.sheetHeight('<p></p>', 10)).toThrow('The sheet has no size');
  });
});

test.describe('this project', () => {
  test('a board is in designs/canvas and its picture in designs/screenshots; the ones the tool built are there', () => {
    expect(B.file('MyList')).toBe(path.join(B.ROOT, 'designs', 'canvas', 'MyList.dc.html'));
    expect(B.picture('MyList')).toBe(path.join(B.ROOT, 'designs', 'screenshots', 'MyList.png'));
    for (const name of ['MyList', 'MyListFold', 'Components']) {
      expect(fs.existsSync(B.file(name)), name).toBe(true);
      expect(fs.existsSync(B.picture(name)), name).toBe(true);
      expect(() => B.page(fs.readFileSync(B.file(name), 'utf8'))).not.toThrow();
    }
  });

  test('save writes a board only when it changed', () => {
    const name = '../../test-results/board-' + process.pid;
    fs.mkdirSync(path.dirname(B.file(name)), { recursive: true });
    fs.rmSync(B.file(name), { force: true });
    expect(B.save(name, 'one')).toBe(true);
    expect(B.save(name, 'one')).toBe(false);
    expect(B.save(name, 'two')).toBe(true);
    expect(fs.readFileSync(B.file(name), 'utf8')).toBe('two');
    fs.rmSync(B.file(name));
  });
});
