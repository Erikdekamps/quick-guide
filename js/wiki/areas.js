/*!
 * Quick Guide - js/wiki/areas.js
 * Area Tasks: the "<Area> achievements" pages, each tier with its tasks, needs and rewards.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var AREA_VERSION = W.AREA_VERSION;
  var arr = W.arr, clean = W.clean, fetchPage = W.fetchPage, hash = W.hash, kids = W.kids, pageUrl = W.pageUrl,
    plainOf = W.plainOf, scratch = W.scratch, text = W.text, inline = W.inline, isHidden = W.isHidden, tidy = W.tidy,
    unwrapSections = W.unwrapSections;

  // ---------- Area Tasks: the "<Area> achievements" pages ----------
  var TIER_RE = /^(Beginner|Easy|Medium|Hard|Elite)_achievements$/;

  // The parts of a page between two headings of one level: [{ head, nodes }]
  function partsBy(root, level, test) {
    var out = [], cur = null;
    arr(root.children).forEach(function (n) {
      var h = /^H[1-6]$/.test(n.tagName) ? n : (n.classList.contains('mw-heading') ? n.querySelector('h1, h2, h3, h4, h5, h6') : null);
      var lv = h ? +h.tagName.charAt(1) : 0;
      if (h && lv <= level) {
        cur = lv === level && test(h) ? { head: h, nodes: [] } : null;
        if (cur) out.push(cur);
        return;
      }
      if (cur) cur.nodes.push(n);
    });
    return out;
  }
  // One need from a list: a level ("16 Thieving"), a quest, or something else (as safe HTML).
  function needOf(li, page, into) {
    var t = text(li);
    if (!t || /^none\.?$/i.test(t)) return;
    var sk = li.querySelectorAll('.skillreq[data-skill]');
    // A level on its own, or with "(b)" after it: the wiki's mark for a level you may boost.
    var rest = sk.length === 1 ? clean(t.replace(text(sk[0]), '')) : null;
    if (sk.length === 1 && (rest === '' || /^\(\s*b\s*\)$/i.test(rest))) {
      var need = { skill: sk[0].getAttribute('data-skill'), level: +sk[0].getAttribute('data-level') || 0 };
      if (rest) need.boost = true;
      into.skills.push(need);
      return;
    }
    var q = li.querySelector('.achievement-req-quest[data-quest]');
    if (q && clean(t.replace(text(q), '')) === '') { into.quests.push(q.getAttribute('data-quest')); return; }
    var a = li.querySelectorAll('a');
    if (!sk.length && a.length === 1 && text(a[0]) === t && !/^File:/.test(a[0].getAttribute('title') || '')) {
      into.quests.push(clean(a[0].getAttribute('title') || t));
      return;
    }
    var h = tidy(inline(li, page, { alt: true }));
    if (plainOf(h)) into.other.push(h);
  }
  function needsOf(cell, page, into) {
    arr(cell.querySelectorAll('li')).forEach(function (li) {
      if (li.closest('.im-task-reqs') && !cell.classList.contains('im-task-reqs')) return;
      if (li.parentNode.closest('li')) return;   // a line inside a line: part of its parent
      needOf(li, page, into);
    });
  }
  // The Notes cell of a task: a numbered list of two or more lines is the steps of the task. A line under a step
  // (a bulleted list inside it) is a note for that step. Everything else stays as the task's tip, however long:
  // tips are things to know, not things to do, so they get no tick boxes.
  function stepsOf(cell, page, taskId) {
    var cc = cell.cloneNode(true), subs = [];
    var lists = arr(cc.querySelectorAll('ol')).filter(function (o) { return !o.parentNode.closest('li') && kids(o, 'LI').length >= 2; });
    lists.forEach(function (ol) {
      kids(ol, 'LI').forEach(function (li) {
        var notes = [];
        var inner = arr(li.querySelectorAll('ul, ol')).filter(function (l) { return l.parentNode.closest('li') === li; });
        inner.forEach(function (l) {
          kids(l, 'LI').forEach(function (n) { var h = tidy(inline(n, page)); if (plainOf(h)) notes.push(h); });
        });
        arr(li.querySelectorAll('ul, ol')).forEach(function (l) { l.remove(); });
        subs.push({ id: taskId + ':' + (subs.length + 1), html: tidy(inline(li, page)), notes: notes });
      });
      ol.remove();
    });
    return { notes: tidy(inline(cc, page)), subs: subs };
  }
  function areaTier(part, page) {
    var name = text(part.head).replace(/\s*achievements$/i, '');
    var t = { id: name.toLowerCase(), name: name, skills: [], quests: [], other: [], items: [], ironman: '', tasks: [],
      reward: { intro: '', items: [], perks: [] } };
    var wrap = scratch.createElement('div');
    part.nodes.forEach(function (n) { wrap.appendChild(n.cloneNode(true)); });
    partsBy(wrap, 3, function () { return true; }).forEach(function (sub) {
      var h = text(sub.head).toLowerCase();
      var box = scratch.createElement('div');
      sub.nodes.forEach(function (n) { box.appendChild(n); });
      arr(box.querySelectorAll('.musicplayer, audio')).forEach(function (n) { n.remove(); });
      if (/^requirements/.test(h)) {
        arr(box.querySelectorAll('table.achievementsdetails > tbody > tr, table.achievementsdetails > tr')).forEach(function (tr) {
          var th = tr.querySelector('th'), td = tr.querySelector('td');
          if (!th || !td) return;
          var im = td.querySelector('.im-task-reqs');
          if (im) {
            var body = im.querySelectorAll('tr')[1] || im;
            t.ironman = tidy(inline(body, page, { alt: false }));
            im.remove();
          }
          if (/item/i.test(text(th))) {
            arr(td.querySelectorAll('li')).forEach(function (li) {
              if (li.parentNode.closest('li')) return;
              var x = tidy(inline(li, page, { alt: true }));
              if (plainOf(x)) t.items.push(x);
            });
          } else needsOf(td, page, t);
        });
      } else if (/^list of/.test(h)) {
        var table = box.querySelector('table');
        if (!table) return;
        var rows = arr(table.querySelectorAll('tr')), cols = rows.length ? arr(rows[0].children).map(function (c) { return text(c).toLowerCase(); }) : [];
        var ci = function (re) { for (var i = 0; i < cols.length; i++) if (re.test(cols[i])) return i; return -1; };
        var cName = ci(/^name/), cDesc = ci(/^description/), cReq = ci(/^requirement/), cNotes = ci(/^notes?/), cMem = ci(/^members/);
        rows.slice(1).forEach(function (tr) {
          var c = tr.children;
          if (cName < 0 || !c[cName]) return;
          var a = c[cName].querySelector('a');
          var task = { id: tr.getAttribute('data-rowid') || hash(t.id + text(c[cName])), name: text(a || c[cName]),
            desc: cDesc >= 0 && c[cDesc] ? text(c[cDesc]) : '', members: cMem >= 0 && c[cMem] ? /member|p2p/i.test(c[cMem].innerHTML) : null,
            skills: [], quests: [], other: [], notes: '' };
          if (cReq >= 0 && c[cReq]) needsOf(c[cReq], page, task);
          task.subs = [];
          if (cNotes >= 0 && c[cNotes]) { var sp = stepsOf(c[cNotes], page, task.id); task.notes = sp.notes; task.subs = sp.subs; }
          if (task.name) t.tasks.push(task);
        });
      } else if (/^rewards?/.test(h)) {
        var intro = [];
        arr(box.children).forEach(function (n) {
          if (n.tagName === 'P') { var x = tidy(inline(n, page)); if (plainOf(x)) intro.push(x); }
          else if (n.tagName === 'UL') arr(n.children).forEach(function (li) { var y = tidy(inline(li, page)); if (plainOf(y)) t.reward.items.push(y); });
        });
        t.reward.intro = intro.join('<br>');
        arr(box.querySelectorAll('table tr')).forEach(function (tr) {
          if (isHidden(tr) || tr.querySelector('th')) return;
          arr(tr.children).slice(1).forEach(function (td) {
            // The perks are shown as plain text: the reward table's links are not needed.
            arr(td.querySelectorAll('li')).forEach(function (li) { var z = text(li); if (z) t.reward.perks.push(z); });
          });
        });
      }
    });
    return t;
  }
  function parseArea(html, name) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    var root = doc.querySelector('.mw-parser-output') || doc.body;
    while (root.children.length === 1 && root.firstElementChild.classList.contains('mw-parser-output')) root = root.firstElementChild;
    unwrapSections(root);
    var page = name + ' achievements';
    var tiers = partsBy(root, 2, function (h) { return TIER_RE.test(h.id || '') || /^(Beginner|Easy|Medium|Hard|Elite) achievements$/i.test(text(h)); })
      .map(function (p) { return areaTier(p, page); })
      .filter(function (t) { return t.tasks.length; });
    if (!tiers.length) { var e = new Error('This page has no area tasks.'); e.code = 'format'; throw e; }
    return { version: AREA_VERSION, name: name, page: page, source: pageUrl(page), fetchedAt: new Date().toISOString(), tiers: tiers };
  }
  function loadArea(name) {
    return fetchPage(name + ' achievements').then(function (p) { var a = parseArea(p.html, name); a.revid = p.revid; return a; });
  }

  W.publish({ parseArea: parseArea, loadArea: loadArea });
  W.loaded.areas = true;
})(window.QuickGuideWiki);
