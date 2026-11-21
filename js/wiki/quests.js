/*!
 * Quick Guide - js/wiki/quests.js
 * The list of all quests, from the wiki's "List of quests" page, and the miniquests from "Miniquests".
 */
(function (W) {
  'use strict';
  if (!W) return;
  var API = W.API, askWiki = W.askWiki;
  var LIST_PAGE = 'List of quests';
  var ORDER_PAGE = 'Quests/Progression guide';
  var MINI_PAGE = 'Miniquests';

  function err(code, message) { var e = new Error(message); e.code = code; return e; }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

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
  // mini: the Miniquests page. Only its main table counts (it has a Difficulty column; the
  // "one-off content" table below it does not), and each entry is marked as a miniquest.
  function parseList(html, mini) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    var out = [], seen = {};
    Array.prototype.forEach.call(doc.querySelectorAll('table'), function (table) {
      var rows = table.querySelectorAll('tr');
      if (rows.length < (mini ? 2 : 5)) return;
      var cols = Array.prototype.map.call(rows[0].children, colOf);
      if (cols.indexOf('name') < 0 || (mini && cols.indexOf('dif') < 0)) return;
      for (var r = 1; r < rows.length; r++) {
        var cells = rows[r].children, q = mini ? { t: '', mini: true } : { t: '' };
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
  function pageApi(page) {
    return API + '?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1' +
      '&disablelimitreport=1&origin=*&page=' + encodeURIComponent(page);
  }
  function loadList() {
    return askWiki(pageApi(LIST_PAGE)).then(function (d) {
      if (!d.parse) throw err('format', 'The wiki did not send the quest list.');
      var text = d.parse.text;
      if (text && typeof text === 'object') text = text['*'];
      var quests = parseList(String(text || ''));
      if (quests.length < 5) throw err('format', 'Could not read the quest list on the wiki.');
      return { at: Date.now(), quests: quests };
    });
  }

  function parseMinis(html) { return parseList(html, true); }
  function loadMinis() {
    return askWiki(pageApi(MINI_PAGE)).then(function (d) {
      if (!d.parse) throw err('format', 'The wiki did not send the miniquest list.');
      var text = d.parse.text;
      if (text && typeof text === 'object') text = text['*'];
      var quests = parseMinis(String(text || ''));
      if (!quests.length) throw err('format', 'Could not read the miniquest list on the wiki.');
      return { at: Date.now(), quests: quests };
    });
  }

  // ---------- the optimal order ----------
  // The wiki's progression guide is one big table. Each quest row carries the quest's page name;
  // the rows in between ("Train Magic to 10") are skipped.
  function parseOrder(html) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    var table = doc.querySelector('table.oqg-table'), best = 0;
    if (!table) {
      Array.prototype.forEach.call(doc.querySelectorAll('table'), function (t) {
        var n = t.querySelectorAll('tr[data-rowid]').length;
        if (n > best) { best = n; table = t; }
      });
    }
    var out = [], seen = {};
    if (!table) return out;
    Array.prototype.forEach.call(table.querySelectorAll('tr[data-rowid]'), function (tr) {
      var t = clean(tr.getAttribute('data-rowid'));
      if (!t || seen[t]) return;
      seen[t] = 1;
      out.push(t);
    });
    return out;
  }
  function loadOrder() {
    return askWiki(pageApi(ORDER_PAGE)).then(function (d) {
      if (!d.parse) throw err('format', 'The wiki did not send the quest order.');
      var text = d.parse.text;
      if (text && typeof text === 'object') text = text['*'];
      var order = parseOrder(String(text || ''));
      if (order.length < 5) throw err('format', 'Could not read the order on the wiki.');
      return { at: Date.now(), order: order };
    });
  }

  window.QuickGuideData = {
    LIST_PAGE: LIST_PAGE, ORDER_PAGE: ORDER_PAGE, MINI_PAGE: MINI_PAGE,
    parseList: parseList, loadList: loadList, parseMinis: parseMinis, loadMinis: loadMinis, parseOrder: parseOrder, loadOrder: loadOrder
  };
  W.loaded.quests = true;
})(window.QuickGuideWiki);
