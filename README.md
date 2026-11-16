# Quick Guide

A tick list for RuneScape 3, made for the [Alt1](https://runeapps.org/alt1) browser. It looks like the game's own Hero window,
in the brown interface the game has now, or the blue one it had before (a setting).

- **Quests:** every quest's [Quick guide](https://runescape.wiki/w/Category:Quick_guides) from the RuneScape Wiki, as steps you tick off.
- **Area tasks:** every tier of the 13 [Area Tasks](https://runescape.wiki/w/Area_Tasks_achievements), with what each one needs.
- **My list:** your own lists of goals (levels, items, unlocks, quests, area tasks), to plan your day or week.
- **Scan achievements:** Alt1 reads the game's achievement list and ticks the tasks you have done.

## Add it to Alt1

With Alt1 running, paste this into your normal web browser's address bar and press Enter:

```
alt1://addapp/https://erikdekamps.github.io/quick-guide/appconfig.json
```

Alt1 asks if you want to add the app. Say yes. (Or open `https://erikdekamps.github.io/quick-guide/` in the Alt1 browser and press **Add app**.)

The app asks for two permissions:

- **View screen** (`pixel`): for **Scan achievements**. It looks at the game only while you scan.
- **Overlay**: Alt1 wants at least one. The app draws nothing on the game.

If you added the app before the scan existed, remove it in Alt1 and add it again, so Alt1 asks for the screen permission.
Wiki links open in your normal browser, so the app stays on the guide.

## Quests

- The start screen lists every quest from the wiki's [List of quests](https://runescape.wiki/w/List_of_quests),
  and every miniquest from [Miniquests](https://runescape.wiki/w/Miniquests).
  Type to search; **Enter** opens the best match.
- Sort by name, **optimal order** (the wiki's [progression guide](https://runescape.wiki/w/Quests/Progression_guide)),
  difficulty, length, series or newest. Click a group name to fold it.
- Click a quest. Its guide is read from the wiki once, then kept on your computer. The title band stays on top;
  under it are the back button (to all quests), the quest's name and its **⋯** menu. It has three tabs:
  - **Overview:** details, the quest tree, skills, enemies and rewards.
  - **Items:** what to bring, with tick boxes.
  - **Steps:** click a step to tick it. The next step moves to the top. **Done, next step** ticks it for you.
    A part folds shut when you finish it. Maps are the wiki's own (drag to move, + and − to zoom).
- Boxes that fold (parts, pictures, maps, tables) start open. The app remembers the ones you close.
- A reload (or opening the app again) shows the screen, tab and tier you were on, scrolled where you left it.
  Each tab and tier keeps its own place, and the start screen keeps your search text and folded groups.

### Your character

In the settings, type your **character name** and press **Look up**. The app shows your quests done and,
when the game gives them, your quest points.

- Done quests turn green, started ones yellow. Quests you cannot start yet are grey and say **Locked**.
- Skill levels look like the wiki: "• 100 [icon] Mining ✓". A green ✓ follows a level you have, a red ✗ one you
  do not (point at it to see your level). A small "(boostable)" follows a level you may boost.
- Quests you need get a green ✓ when you have done them, in a quest's tree and in Area tasks.
- It updates by itself once a day. The round arrow updates it now; the ✕ forgets the character.

## Area tasks

The **Area tasks** tab has a row per tier (**Ardougne Easy**, **Ardougne Medium**, …) with its count and a progress bar,
under its area, in the game's order.

- Click a tier to open it. Each tier has **Needs** (levels, quests, items to bring, notes for Ironmen),
  **Tasks** and **Rewards**.
- Click a task to tick it. A task that needs more than you have says so with a red ✗, like "Needs 5 [icon] Thieving ✗".
  The wiki's tip for a task is right under it. **Done, next task** ticks the next one.
- A task with a numbered list on the wiki has steps. Other text, however long, is the task's tip (no tick boxes:
  tips are things to know, not things to do). Ticking the task ticks its steps;
  ticking all steps ticks the task.
- **Search** finds tiers ("ardougne hard") and tasks by name. Tick a task right in the results,
  or press **Enter** to open its tier. The first search reads all 13 areas once.

## My list

The **My list** tab holds your own lists of goals. Name them what you like: **Today**, **This week**,
**Skilling goals**, **Gathering**. The tab shows how many goals are still open.

- A goal is one flat row: a tick box, what it says, and its **⋯** menu.
- **Add a goal** in the box at the top. It goes in the list next to the box, as you typed it ("500 magic logs",
  "Buy a cape"). A skill level ("82 thieving" or "thieving 82") ticks itself once your character is looked up.
- **A quest, an area task or a tier:** its **⋯** menu has **Add to list…** (an area task has its own ⋯; a quest's
  and an area's menu is next to their name). A box asks which list, with a dropdown, or a new list.
  The message says where it went, with **Undo**. Once it is on a list, the menu says **Remove from …** instead.
- **+ goal** next to a level you do not have (in a quest's skills, an area's needs, a task's needs) opens the same box.
- Skill levels, quests and tiers tick themselves. An area task is one tick, shown in the list and in its area.
- A list's **⋯**: add a goal (with every field: the goal, the list, how often, a note), rename, move the list up or
  down, clear done goals, delete the list (two clicks when it has goals).
- A goal's **⋯**: edit, open it (its quest or area, or the wiki), move it to another list or a new one, move it up
  or down, remove it. Removing, clearing and deleting can be undone.
- Done goals go to the bottom of their list, struck through, until you clear them.
- A goal can come back **every day** or **every week**. It is unticked at the game's reset: 00:00 UTC each day,
  and Wednesday 00:00 UTC each week. Until then it says when it is back, in your own time.
- At most 30 lists and 300 goals.

## Scan achievements

In the settings, only in Alt1. The app reads the game and sets every task to what the game shows:
done is ticked, not done (or locked) is unticked.

1. In the game, open **Hero → Achievements → Area Tasks** and click a tier, for example **Easy Ardougne**.
   Keep **Show Completed** on and **List Mode** off.
2. Press **Start**. A green bar at the top names the tier and the tasks in view.
3. Scroll each list down, then click the next tier in the game. Go through them all, top to bottom.

How it knows where it is:

- **The rows:** every task is a box with a small gold icon and a title. A task is done when its title is gold
  (and its icon a star). That is the same in every area, whatever the area's badge looks like.
- **The tier:** the one with the gold box in the list on the left. The app comes with what each of the 52 tier
  names looks like (`tiernames.js`), so it knows the tier you clicked right away. Names of one area look much
  alike ("Hard Ardougne", "Elite Ardougne"), so a name only counts when it is nearly pixel for pixel the same.
  At another interface size the names do not fit: then it counts from the **Area Tasks** title above
  Easy Ardougne (or the next title, below the last tier), and remembers the names it sees. If it cannot tell,
  it asks you to scroll the list on the left: until the gold box shows, or up until **Area Tasks** shows.
- **The tasks:** a new tier starts at the top of its list (the scrollbar says when it is). When you scroll,
  each row is matched to the row it looks most like in the last look. A tier or a task only changes when two looks
  in a row agree, so a tooltip or a moving background does not confuse it.
- A task you opened up in the game (its arrow, to see its steps) pushes the tasks under it out of place.
  The app reads the tasks down to it, and asks you to close it.
- If the bar shows the wrong tier, use **◀ ▶**. They hold until you click another tier in the game.
  **Stop** ends the scan.
- The scrollbar is the first one right of the list, a narrow handle in a dark track, so the window's gold edge
  or sand and rocks behind the window are not taken for it. The rest of the screen (like a chat full of green
  lines) does not fool it either. If it cannot see the list, the bar says so.

## Settings (the cog)

The same on every screen:

- **Player:** look up your character, update it, or forget it.
- **Quest list:** sort, **Hide completed**, **Hide miniquests**, **Hide locked**. Hide completed and Hide locked work for area tiers too.
- **Display:** **Theme** (Brown, like the game now, or Blue, like the game before), **Show done steps** (to untick one)
  and **Text size** (12 to 40).
- **Update quest list** reads the lists from the wiki again.
- **Scan achievements** (only in Alt1).
- **Backup:** **Export state** and **Import state** (below).
- **Delete everything** (at the very bottom) deletes all your ticks, guides, areas, lists, settings and your character.
  It takes two clicks, the second within 4 seconds.

The **⋯** button in a quest or area puts it (or the tier) on one of your lists, refreshes it from the wiki, opens it on
the wiki, or resets its progress.

## Export and import

**Export state** gives a JSON file with **every quest and every area task**, each `true` (done) or `false` (not done),
and **your lists**.
It also lists the quests the game knows that the wiki's quest list does not have (parts of a bigger quest, like
Recipe for Disaster), so its done quests add up to what the game says. `tiers` is each tier's count ("7 / 12"),
to read at a glance; an import does not use it. Steps say all they say, nothing is cut off.
**Download file** saves it; **Copy** puts the text on the clipboard (use Copy inside Alt1 if the download does not work).

Change it in any text editor, then **Import state**, **Choose a file**, **Import**. The number at the start of a task
(`447 …`) or a step (`993:1 …`) is how the app finds it; a task can also be written by its name alone.

In `mylist`, each goal is a line, written the way you type it in the add box: `"82 Thieving"`,
`"500 Magic logs"`, `"Quest: While Guthix Sleeps"`, `"Task 448: Yoink! (Ardougne Easy)"`,
`"Vis wax (every day)"`. Add a list or a goal by hand and it comes in. Skill, quest, task and tier goals tick themselves,
so their `true` or `false` is only to read.

```json
{
  "app": "Quick Guide",
  "format": 2,
  "settings": { "hideDone": false, "fontSize": 14, "sort": "name", "home": "areas" },
  "player": { "name": "Zezima", "quests": { "cooksassistant": 2 }, "levels": { "magic": 80 } },
  "quests": {
    "Cook's Assistant": true,
    "While Guthix Sleeps": {
      "done": false,
      "progress": "10 / 118",
      "steps": { "starting-out:19 In Taverley, talk to Ivy Sophista…": true },
      "items": { "req:1x3k9a Ring of charos (a)": false }
    }
  },
  "tiers": { "Ardougne": { "Easy": "1 / 23" } },
  "areas": {
    "Ardougne": { "Easy": { "447 The Essence of Magic": true, "448 Yoink!": false } }
  },
  "mylist": {
    "Today": { "Task 448: Yoink! (Ardougne Easy)": false, "Vis wax (every day)": true },
    "Gathering": { "500 Magic logs": false }
  }
}
```

- Steps are only listed for quests you opened; the others are one line.
- Import replaces the ticks of the quests and areas in the file and leaves the others alone.
  A file with `mylist` replaces your lists; a file without it leaves them alone.
  If a file has a mistake, it says what is wrong and changes nothing. Files from the first version still import.

## What is saved

Everything is in the browser's local storage, on your computer. All keys start with `qg1.`:

| Key | What |
| --- | --- |
| `list`, `minis` | Every quest and miniquest from the wiki's lists |
| `order` | The wiki's optimal quest order |
| `quest.<page>`, `prog.<page>` | A quest's guide, and your ticks for it |
| `meta` | One small entry per quest you opened (steps done, total, last opened) |
| `qdone` | Quests marked done by an import |
| `area.<name>`, `aprog.<name>` | An area's page, and your ticks for it |
| `ameta`, `aidx` | Counts for the area list, and every task of every area (for search) |
| `settings`, `last` | Your settings (the theme too), and the quest or area that was open last |
| `player` | The character you looked up: quests done or started (and their names), skill levels, quest points |
| `tiernames` | What each tier's name looks like in the game, as learnt by Scan achievements |
| `view` | Where you were: the search text, folded groups and lists, and where each list, tab and tier is scrolled |
| `todo` | My list: your lists and their goals (never dropped to make room) |

Local storage holds about 5 MB. When it is full, the guides you opened longest ago are dropped (your ticks stay)
and read from the wiki again when you open them.

## How it reads the wiki

- `quests.js` reads the quest lists and the optimal order through the wiki's API, for example
  `https://runescape.wiki/api.php?action=parse&page=List_of_quests&origin=*`.
- `parser.js` reads one guide (`<Quest>/Quick_guide`, or the quest's own page if it has no Quick guide)
  and the area pages (`<Area>_achievements`), and turns them into JSON.
- Map pictures load from `maps.runescape.wiki`.
- The character lookup uses Jagex's [Player Data API](https://developer.runescape.com/platform/modules/adventurers-log/player-data.html)
  (quests, skill levels and quest points in one answer), through the wiki first, then at Jagex itself:
  `https://runescape.wiki/cors/m=adventurers-log/api/v1/playerData/<name>?includeQuests=true&includeSkills=true`, then
  `https://secure.runescape.com/m=adventurers-log/api/v1/playerData/<name>?…`.
  If neither answers, the older lookup is used, both passed on by the wiki:
  `https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/<name>` and
  `https://runescape.wiki/cors/m=hiscore/index_lite.json?player=<name>`.

No other service is used.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The page and its look (both themes: every colour is a token at the top of `style.css`) |
| `app-core.js` | What every screen shares: storage, settings, the player, menus, the window's parts, maps |
| `app-quests.js` | The quest list and the quest screen (Overview, Items, Steps) |
| `app-areas.js` | Area tasks: the list of tiers, search, and one area |
| `app-todo.js` | My list: your lists of goals, Add to list (in the ⋯ menus) and "+ goal", goals that come back |
| `app-backup.js` | Export and import |
| `app-scan.js` | Scan achievements (Alt1) |
| `app.js` | Loaded last: the clicks and keys of every screen, and the start |
| `parser.js` | Reads a quest guide or an area page from the wiki |
| `quests.js` | Reads the quest lists and the optimal order |
| `reader.js` | Reads the game's task list from the screen (for Scan achievements) |
| `tiernames.js` | What each of the 52 tier names looks like in the game (for Scan achievements) |
| `vendor/leaflet/` | Leaflet 1.9.4, the map library (BSD-2 licence) |
| `icon.svg` | The app's icon: a tick box with a green tick on a grey tile. Only greys and green, so it fits both themes |
| `appconfig.json`, `icon.png` | What Alt1 needs to add the app (`icon.png` is made from `icon.svg`: `npm run icon`) |
| `tools/icon.js` | Makes `icon.png` from `icon.svg` |
| `tests/`, `playwright.config.js`, `package.json` | The tests |
| `.github/workflows/tests.yml` | Runs the tests on GitHub |
| `.github/workflows/security.yml`, `tools/security.js` | Checks for known security problems and newer versions |
| `.github/dependabot.yml` | Asks Dependabot for a pull request when a newer version is out |
| `designs/` | Design boards and screenshots of every screen |
| `docs/my-list-plan.md` | The plan My list was built from, and what could come later |

When you change a file, also raise the `?v=1.35.0` numbers in `index.html`. Alt1 keeps old copies of files otherwise.

## Tests

The tests use [Playwright](https://playwright.dev/) with Chromium, the browser Alt1 is built on. They open the app
in a 360 × 720 window, like Alt1, and click through it like a person would.

- They run on GitHub for every pull request and every push to `main` (the **Actions** tab).
- They use a fake copy of the wiki (`tests/fixtures/wiki/`), so they need no internet.
- Once a week, GitHub also checks the app against the real wiki (**Actions → Tests → Run workflow** starts it by hand).
- **Scan achievements** is tested on screenshots of the game (`tests/fixtures/game/`) with a fake Alt1: done, not done
  and locked tasks; every area's badge (a sprite cut from the game, `badges.png`); a task opened up; every tier name the app comes with; bigger screens
  and interface sizes; blurry, dark and JPEG pictures; busy screens where no list may be found; scrolling (slow,
  fast, too far); tooltips; both ways Alt1 hands over pictures; and how fast one look is.

To run them on your own computer, with [Node.js](https://nodejs.org/) 22:

```
npm ci
npx playwright install chromium
npm test
```

- `npm run test:live` checks against the real wiki (needs the internet).
- `npm run coverage` runs the tests and shows how much of each file they run.
- `npm run security` checks for known security problems and newer versions (see below).
- `npm run icon` makes `icon.png` again after you change `icon.svg` (a test checks the two are the same picture).

## Security and updates

The app itself has no npm packages: it runs as plain files in the browser. It uses Leaflet (a copy in
`vendor/leaflet/`), and the tests use Playwright (an npm package).

- **Security check** (`.github/workflows/security.yml`): on every pull request, every push to `main`, and every
  Monday. It fails when a known high or critical security problem affects Playwright or the Leaflet copy, and then
  you update. Lower-rated problems and newer versions show as notes on the run and in its summary.
  Run it yourself with `npm run security`.
- **Dependabot** (`.github/dependabot.yml`): every Monday it opens a pull request for a newer Playwright or a newer
  GitHub Action, so the tests run on it before you merge. It cannot see the Leaflet copy; the security check
  says when a newer Leaflet is out.
- To also get a pull request for a security fix as soon as one is out, turn on **Dependabot security updates** on
  GitHub: Settings → Code security → Dependabot.

## Credits

Built by **Claude**, Anthropic's AI ([Claude Opus 5.5 and Claude Fable 5.2](https://www.anthropic.com/claude)),
working in [Claude Code](https://claude.com/claude-code): the app, the wiki parser, the game screen reader,
the tests, the designs, the icon and this README. The ideas, the testing in the game and the screenshots
came from the repository owner.

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`).
