/*!
 * Quick Guide - js/wiki/player.js
 * A player's quests and levels, from Jagex: the Player Data API, else RuneMetrics and the hiscores.
 * Guide text and pictures belong to the RuneScape Wiki (CC BY-NC-SA 3.0).
 */
(function (W) {
  'use strict';
  if (!W) return;
  var WIKI = W.WIKI, clean = W.clean, getJson = W.getJson, normName = W.normName;

  // ---------- player stats ----------
  var HISCORE_SKILLS = ['Overall', 'Attack', 'Defence', 'Strength', 'Constitution', 'Ranged', 'Prayer', 'Magic', 'Cooking',
    'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving',
    'Slayer', 'Farming', 'Runecrafting', 'Hunter', 'Construction', 'Summoning', 'Dungeoneering', 'Divination', 'Invention',
    'Archaeology', 'Necromancy'];
  function playerResult(name, source, quests, levels, locked, titles) {
    var done = 0, started = 0;
    Object.keys(quests).forEach(function (k) { if (quests[k] === 2) done++; else if (quests[k] === 1) started++; });
    return { name: name, source: source, at: new Date().toISOString(), quests: quests, titles: titles || {}, levels: levels, locked: locked || {}, done: done, started: started };
  }
  // The game's quest objects (a list, or a map by quest id), as { quests, titles, locked }; null when there are none.
  function questsOf(ql) {
    var o = { quests: {}, titles: {}, locked: {} }, got = false;
    (Array.isArray(ql) ? ql : ql && typeof ql === 'object' ? Object.keys(ql).map(function (k) { return ql[k]; }) : []).forEach(function (it) {
      if (!it || !it.title) return;
      got = true;
      var k = normName(it.title), st = it.status === 'COMPLETED' ? 2 : it.status === 'STARTED' ? 1 : 0;
      o.quests[k] = st;
      o.titles[k] = clean(it.title);
      if (st === 0 && it.eligible === false) o.locked[k] = 1;
    });
    return got ? o : null;
  }
  // Jagex's Player Data API (developer.runescape.com): quests, skill levels and quest points in one answer, more
  // up to date than the hiscores. Asked through the wiki first, then at Jagex itself. Gives null when neither
  // answers with quests (then fromRuneMetrics is used); a player the game does not know is an error at once.
  var PLAYER_DATA = [WIKI + '/cors/m=adventurers-log', 'https://secure.runescape.com/m=adventurers-log'];
  // The game's own skill names that differ from the ones the wiki uses.
  var SKILL_NAMES = { hitpoints: 'constitution', runecraft: 'runecrafting' };
  function fromPlayerData(name) {
    var enc = encodeURIComponent(name);
    function ask(i) {
      if (i >= PLAYER_DATA.length) return Promise.resolve(null);
      return getJson(PLAYER_DATA[i] + '/api/v1/playerData/' + enc + '?includeQuests=true&includeSkills=true').then(function (r) {
        var j = r.json, q = r.ok && j ? questsOf(j.quests) : null;
        if (j && j.error === 'PLAYER_NOT_FOUND') { var e = new Error('No such player.'); e.code = 'nodata'; throw e; }
        if (!q) return ask(i + 1);
        var levels = {};
        Object.keys(j.skills && typeof j.skills === 'object' ? j.skills : {}).forEach(function (k) {
          var lv = j.skills[k] && +j.skills[k].level;
          if (isFinite(lv)) levels[SKILL_NAMES[k] || k] = lv;
        });
        var p = playerResult(clean(j.name || '') || name, 'Player Data', q.quests, levels, q.locked, q.titles);
        if (isFinite(+j.qp) && j.qp != null) p.qp = +j.qp;
        if (isFinite(+j.qp_max) && j.qp_max != null) p.qpMax = +j.qp_max;
        return p;
      }, function (err) {
        if (err && err.code === 'nodata') throw err;
        return ask(i + 1);
      });
    }
    return ask(0);
  }
  // RuneMetrics: the quests (playerQuests), and the levels from the hiscores, both passed on by the wiki.
  function fromRuneMetrics(name) {
    var enc = encodeURIComponent(name), fails = [];
    function soft(p) { return p.then(function (r) { return r.ok ? r.json : null; }, function (e) { fails.push(e); return null; }); }
    return Promise.all([
      soft(getJson(WIKI + '/cors/m=adventurers-log/api/v1/playerQuests/' + enc)),
      soft(getJson(WIKI + '/cors/m=hiscore/index_lite.json?player=' + enc))
    ]).then(function (res) {
      var q = questsOf(res[0] && res[0].quests) || { quests: {}, titles: {}, locked: {} };
      var quests = q.quests, levels = {}, locked = q.locked, titles = q.titles, got = Object.keys(quests).length > 0;
      (res[1] && Array.isArray(res[1].skills) ? res[1].skills : []).forEach(function (it) {
        var nm = it && HISCORE_SKILLS[it.id];
        if (!nm || !isFinite(+it.level)) return;
        got = true;
        levels[nm.toLowerCase()] = +it.level;
      });
      if (!got) {
        var e = new Error('No player data.');
        e.code = fails.length === 2 ? (fails[0] && fails[0].code === 'timeout' ? 'timeout' : 'network') : 'nodata';
        throw e;
      }
      return playerResult(name, 'RuneMetrics', quests, levels, locked, titles);
    });
  }
  // Quests and levels of one player, from Jagex: the Player Data API when it answers, else RuneMetrics.
  // (The wiki passes both on and lets any web page read them, so this works from GitHub Pages.)
  function loadPlayer(name) {
    name = clean(name);
    return fromPlayerData(name).then(function (p) { return p || fromRuneMetrics(name); });
  }

  W.publish({ loadPlayer: loadPlayer });
  W.loaded.player = true;
})(window.QuickGuideWiki);
