/*!
 * Quick Guide - quests.js
 * The list of all quests, from the wiki's "List of quests" page.
 */
(function () {
  'use strict';

  var API = 'https://runescape.wiki/api.php';
  var LIST_PAGE = 'List of quests';

  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  // One spelling for a quest name, so names from the game and from the wiki match.
  function norm(s) {
    return clean(s).toLowerCase().replace(/&/g, ' and ').replace(/\((quest|miniquest|saga)\)/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
  }

  // ---------- the quest list ----------
  function colOf(th) {
    var t = clean(th.textContent).toLowerCase();
    if (/^(name|quest)\b/.test(t)) return 'name';
    if (/length/.test(t)) return 'len';
    if (/difficulty/.test(t)) return 'dif';
    if (/^age/.test(t)) return 'age';
    if (/combat/.test(t)) return 'cb';
    if (/^qp|quest points/.test(t)) return 'qp';
    if (/series/.test(t)) return 'ser';
    if (/release|date/.test(t)) return 'rel';
    if (/member/.test(t) || (!t && th.querySelector('a, img'))) return 'mem';
    var a = th.querySelector('a[title], a[href]');
    if (a && /member/i.test((a.getAttribute('title') || '') + (a.getAttribute('href') || ''))) return 'mem';
    return '';
  }
  function membersOf(td) {
    var s = clean(td.textContent) + ' ' + (td.getAttribute('data-sort-value') || '');
    Array.prototype.forEach.call(td.querySelectorAll('a, img'), function (n) {
      s += ' ' + (n.getAttribute('title') || '') + ' ' + (n.getAttribute('alt') || '') + ' ' + (n.getAttribute('href') || '') + ' ' + (n.getAttribute('src') || '');
    });
    s = s.toLowerCase();
    if (/free|f2p/.test(s)) return false;
    if (/member|p2p|^\s*yes/.test(s)) return true;
    return null;
  }
  function parseList(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    var out = [], seen = {};
    Array.prototype.forEach.call(doc.querySelectorAll('table'), function (table) {
      var rows = table.querySelectorAll('tr');
      if (rows.length < 5) return;
      var cols = Array.prototype.map.call(rows[0].children, colOf);
      if (cols.indexOf('name') < 0) return;
      for (var r = 1; r < rows.length; r++) {
        var cells = rows[r].children, q = { t: '' };
        if (cells.length < 2) continue;
        for (var c = 0; c < cells.length && c < cols.length; c++) {
          var k = cols[c], td = cells[c];
          if (!k) continue;
          if (k === 'name') {
            var a = td.querySelector('a[title], a');
            q.t = clean(a ? (a.getAttribute('title') || a.textContent) : td.textContent);
          } else if (k === 'mem') q.m = membersOf(td);
          else if (k === 'qp') q.qp = parseInt(clean(td.textContent), 10) || 0;
          else q[k] = clean(td.textContent);
        }
        if (!q.t || seen[q.t]) continue;
        seen[q.t] = 1;
        out.push(q);
      }
    });
    return out;
  }
  function getJson(url, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : 0;
    return fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw err('http', 'The server answered with an error (' + res.status + ').');
      return res.json();
    }, function (e) {
      clearTimeout(timer);
      throw (e && e.name === 'AbortError') ? err('timeout') : e;
    });
  }
  function loadList() {
    var url = API + '?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1' +
      '&disablelimitreport=1&origin=*&page=' + encodeURIComponent(LIST_PAGE);
    return getJson(url).then(function (d) {
      if (!d || d.error || !d.parse) throw err((d && d.error && d.error.code) || 'format', 'The wiki did not send the quest list.');
      var text = d.parse.text;
      if (text && typeof text === 'object') text = text['*'];
      var quests = parseList(String(text || ''));
      if (quests.length < 5) throw err('format', 'Could not read the quest list on the wiki.');
      return { at: Date.now(), quests: quests };
    });
  }

  window.QuickGuideData = { LIST_PAGE: LIST_PAGE, norm: norm, parseList: parseList, loadList: loadList };
})();
