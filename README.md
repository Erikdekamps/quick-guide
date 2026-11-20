# Quick Guide

A tick list for RuneScape 3, made for the [Alt1](https://runeapps.org/alt1) browser. It looks like the game's own Hero window,
in the brown interface the game has now, or the blue one it had before (a setting).

- **Quests:** every quest's [Quick guide](https://runescape.wiki/w/Category:Quick_guides) from the RuneScape Wiki, as steps you tick off.
- **Area tasks:** every tier of the 13 [Area Tasks](https://runescape.wiki/w/Area_Tasks_achievements), with what each one needs.
- **My list:** your own lists of goals (levels, items, unlocks, quests, area tasks), to plan your day or week.

## Add it to Alt1

With Alt1 running, paste this into your normal web browser's address bar and press Enter:

```
alt1://addapp/https://erikdekamps.github.io/quick-guide/appconfig.json
```

Alt1 asks if you want to add the app. Say yes. (Or open `https://erikdekamps.github.io/quick-guide/` in the Alt1 browser and press **Add app**.)

The app asks for one permission, **Overlay**: Alt1 wants at least one. The app draws nothing on the game.
Wiki links open in your normal browser, so the app stays on the guide.

## Quests

- The start screen lists every quest from the wiki's [List of quests](https://runescape.wiki/w/List_of_quests),
  and every miniquest from [Miniquests](https://runescape.wiki/w/Miniquests).
  Type to search; **Enter** opens the best match.
- Sort by name, **optimal order** (the wiki's [progression guide](https://runescape.wiki/w/Quests/Progression_guide)),
  difficulty, length, series or newest. Click a group name to fold it.
- Click a quest. Its guide is read from the wiki once, then kept on your computer. The title band on top holds the
  back button (to all quests), the quest's name and its **⋯** menu (with **Jump to next step**). A thin gold line
  under it shows how far you are. It has three tabs, each with its count under the name:
  - **Overview:** details, the quest tree, skills, enemies and rewards.
  - **Items:** what to bring, with tick boxes. The tab counts the items you have.
  - **Steps:** click a step to tick it. The next step moves to the top. **Done, next step** ticks it for you.
    A part folds shut when you finish it. Maps are the wiki's own (drag to move, + and − to zoom).
    The tab counts the steps you did.
- The bar at the bottom of every screen has **Quests**, **Area tasks**, **My list** and **Settings** (bottom right).
  The one you are in is lit in gold. Click one to go to its list, from anywhere.
- Boxes that fold (parts, pictures, maps, tables) start open. The app remembers the ones you close.
- A reload (or opening the app again) shows the screen, tab and tier you were on, scrolled where you left it.
  Each tab and tier keeps its own place, and the start screen keeps your search text and folded groups.

### Your character

In **Settings**, type your **character name** and press **Look up**. The app shows your quests done and,
when the game gives them, your quest points.

- Done quests turn green, started ones yellow. Quests you cannot start yet are grey and say **Locked**.
- Skill levels look like the wiki: "• 100 [icon] Mining ✓". A green ✓ follows a level you have, a red ✗ one you
  do not (point at it to see your level). A small "(boostable)" follows a level you may boost.
- Quests you need get a green ✓ when you have done them, in a quest's tree and in Area tasks.
- It updates by itself once a day. The round arrow updates it now; the ✕ forgets the character.

## Area tasks

**Area tasks** (in the bar at the bottom) has a row per tier (**Ardougne Easy**, **Ardougne Medium**, …) with its count and a progress bar,
under its area, in the game's order.

- Click a tier to open it. Its tab shows how many of its tasks you did; the other tiers' tabs show theirs.
  Each tier has **Needs** (levels, quests, items to bring, notes for Ironmen), **Tasks** and **Rewards**.
- Click a task to tick it. A task that needs more than you have says so with a red ✗, like "Needs 5 [icon] Thieving ✗".
  The wiki's tip for a task is right under it. **Done, next task** ticks the next one.
- A task with a numbered list on the wiki has steps. Other text, however long, is the task's tip (no tick boxes:
  tips are things to know, not things to do). Ticking the task ticks its steps;
  ticking all steps ticks the task.
- **Search** finds tiers ("ardougne hard") and tasks by name. Tick a task right in the results,
  or press **Enter** to open its tier. The first search reads all 13 areas once.

## My list

**My list** (in the bar at the bottom) holds your own lists of goals. Name them what you like: **Today**, **This week**,
**Skilling goals**, **Gathering**. Its button shows how many goals are still open.

- A goal is one flat row: a tick box, what it says, and its **⋯** menu.
- Start with **Create list**: a goal always goes in a list. **Import list** makes a list from goals you paste as
  plain text (see Paste a list).
- **Add a goal** in the box at the end of a list: type it, press Enter, and type the next one. It goes in as you
  typed it ("500 magic logs", "Buy a cape"). A skill level ("82 thieving" or "thieving 82") ticks itself once your
  character is looked up.
- **A quest, an area task or a tier:** its **⋯** menu has **Add to list…** (an area task has its own ⋯; a quest's
  and an area's menu is next to their name). A box asks which list, with a dropdown, or a new list, and its
  **parent**: none (it is a goal of the list), or a goal or a sub task of the list. Under a parent it is a sub
  task there and still the same task: one tick, here and in its area.
- The bar at the bottom stays on every screen, so in a quest or an area you see the number on **My list** go up
  when you add something.
  The message says where it went, with **Undo**. Once it is on a list, the menu says **Remove from …** instead.
- **+ goal** next to a level you do not have (in a quest's skills, an area's needs, a task's needs) opens the same box.
- You can tick any goal. Skill levels, quests and tiers also tick themselves. An area task is one tick, shown in
  the list and in its area; a quest ticked here is done in the quest list too.
- **Paste a list** (in a list's ⋯): type or paste goals as plain text, one on each line. A line that is further in
  goes under the one above, as a sub task. Bullets (`-`, `*`, `•`), numbers (`1.`) and tick boxes (`[ ]`, `[x]` for
  done) are understood, and each line is read like a goal you type ("82 thieving", "Quest: Cook's Assistant"). The box says what it reads while you type. Pasting more than one line in the box at
  the end of a list opens it too.

  ```
  - Hatchet of bloom and blight
    - Hatchet of ember and glade
      - [x] Crystal hatchet
  - 82 Thieving
  - Vis wax
  ```
- **Copy as text** (in a list's ⋯) gives the list in that same form, to keep, share or paste into another list.
- A list's **⋯**: add a goal (with every field: the goal, the list, its parent, a note), rename, move the list up or
  down, clear done goals, delete the list (two clicks when it has goals).
- A goal's **⋯**: edit, add a sub task, open it (its quest or area, or the wiki), move it to another list or a new
  one, move it up or down, remove it. Removing, clearing and deleting can be undone.
- **Make it a list** (in the ⋯ of a goal you wrote yourself) turns the goal into a list with its name. Its sub
  tasks are the goals of that list.
- **Open on the wiki:** a goal or sub task you wrote yourself gets this in its ⋯ when the wiki has a page for it
  ("Crystal Hatchet", "500 Magic logs" and "Unlock Soul Split" all find theirs). The app asks the wiki once for each.
- A done goal stays where it is, struck through, until you clear it.
- **Sub tasks:** a goal's ⋯ → **Add sub task** opens a box under it: type one, press Enter, and type the next
  (Esc or × closes the box). A sub task can have its own sub tasks, four deep, at most 20 in one place: "Hatchet
  of bloom and blight" needs a "Hatchet of ember and glade", which needs a "Crystal hatchet".
  Each is done when all under it are; ticking one ticks all under it.
- **Edit** (of a goal or a sub task) also has its **list** and its **parent**: pick another goal or sub task to
  move it under, or None to make it a goal of the list. A sub task can have a note too.
- A sub task's **⋯**: edit, add a sub task, move it up or down, move it out a level (at the top: make it a goal),
  delete it (two clicks, and Undo).
- At most 30 lists and 300 goals.

## Settings

**Settings** is the last button of the bar at the bottom: a screen of its own. It stays open after a reload. To go back,
press the button of the screen you came from (or Escape): a quest opens again at the tab and place you left it. Another
button goes to its list.

- **Player:** look up your character, update it, or forget it.
- **Show:** what the lists and guides show. A tick means you see them.
  - **Done quests and tiers**, **Miniquests** and **Locked quests and tiers**: in the quest list and Area tasks.
    A search still finds them all.
  - **Done steps and tasks**: ticked steps, items and tasks go away at first, so the next one is on top.
    Tick it to see them again, to untick one.
- **Lists:** how the quest list is sorted.
- **Display:** **Theme** (Brown, like the game now, or Blue, like the game before) and **Text size** (12 to 40).
- **Update quest list** reads the lists from the wiki again.
- **Backup:** **Export state** and **Import state** (below).
- **Delete everything** (at the very bottom) deletes all your ticks, guides, areas, lists, settings and your character.
  It takes two clicks, the second within 4 seconds.

The **⋯** button in a quest or area puts it (or the tier) on one of your lists, refreshes it from the wiki, opens it on
the wiki, or resets its progress. In a quest it also jumps to the next step.

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
`"500 Magic logs"`, `"Quest: While Guthix Sleeps"`, `"Task 448: Yoink! (Ardougne Easy)"`. A goal with a note or sub tasks is
`{ "done": false, "note": "…", "subs": { "Buy a rope": true } }`; a sub task with its own is
`{ "done": false, "subs": { … } }`. Add a list or a goal by hand and it comes in.

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
    "Today": { "Task 448: Yoink! (Ardougne Easy)": false, "Vis wax": true },
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
| `view` | Where you were: the search text, folded groups and lists, where each list, tab and tier is scrolled, and if Settings is open |
| `todo` | My list: your lists and their goals (never dropped to make room) |

Local storage holds about 5 MB. When it is full, the guides you opened longest ago are dropped (your ticks stay)
and read from the wiki again when you open them.

## How it reads the wiki

- `js/wiki/quests.js` reads the quest lists and the optimal order through the wiki's API, for example
  `https://runescape.wiki/api.php?action=parse&page=List_of_quests&origin=*`.
- `js/wiki/parser.js` reads one guide (`<Quest>/Quick_guide`, or the quest's own page if it has no Quick guide)
  and the area pages (`<Area>_achievements`), and turns them into JSON.
- Map pictures load from `maps.runescape.wiki`.
- The character lookup uses Jagex's [Player Data API](https://developer.runescape.com/platform/modules/adventurers-log/player-data.html)
  (quests, skill levels and quest points in one answer), through the wiki first, then at Jagex itself:
  `https://runescape.wiki/cors/m=adventurers-log/api/v1/playerData/<name>?includeQuests=true&includeSkills=true`, then
  `https://secure.runescape.com/m=adventurers-log/api/v1/playerData/<name>?…`.
  If neither answers, the older lookup is used, both passed on by the wiki:
  `https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/<name>` and
  `https://runescape.wiki/cors/m=hiscore/index_lite.json?player=<name>`.

- My list asks the wiki whether it has a page for a goal you wrote yourself (for **Open on the wiki**), for example
  `https://runescape.wiki/api.php?action=query&titles=Crystal%20hatchet&redirects=1&format=json&origin=*`.

No other service is used.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The page and its look (both themes: every colour is a token at the top of `style.css`) |
| `js/app/core.js` | What every screen shares: storage, settings, the player, menus, the window's parts, maps |
| `js/app/quests.js` | The quest list and the quest screen (Overview, Items, Steps) |
| `js/app/areas.js` | Area tasks: the list of tiers, search, and one area |
| `js/app/todo-data.js` | My list: the saved lists, goals and sub tasks, wiki links, export and import |
| `js/app/todo-view.js` | My list: what it shows, its count in the bar at the bottom, Add to list in the ⋯ menus, the menus and boxes |
| `js/app/todo.js` | My list: adding, ticking, and what the menus of a goal, a sub task and a list do |
| `js/app/backup.js` | Export and import |
| `js/app/main.js` | Loaded last: the clicks and keys of every screen, and the start |
| `js/wiki/parser.js` | Reads a quest guide or an area page from the wiki |
| `js/wiki/quests.js` | Reads the quest lists and the optimal order |
| `vendor/leaflet/` | Leaflet 1.9.4, the map library (BSD-2 licence) |
| `icon.svg` | The app's icon: a tick box with a green tick on a grey tile. Only greys and green, so it fits both themes |
| `appconfig.json`, `icon.png` | What Alt1 needs to add the app (`icon.png` is made from `icon.svg`: `npm run icon`) |
| `tools/icon.js` | Makes `icon.png` from `icon.svg` |
| `tests/`, `playwright.config.js`, `package.json` | The tests |
| `.github/workflows/tests.yml` | Runs the tests on GitHub |
| `.github/workflows/security.yml`, `tools/security.js` | Checks for known security problems and newer versions |
| `.github/dependabot.yml` | Asks Dependabot for a pull request when a newer version is out |
| `designs/` | Design boards (in `designs/canvas/`) and screenshots of every screen |

When you change a file, also raise the `?v=1.40.0` numbers in `index.html`. Alt1 keeps old copies of files otherwise.

## Tests

The tests use [Playwright](https://playwright.dev/) with Chromium, the browser Alt1 is built on. They open the app
in a 360 × 720 window, like Alt1, and click through it like a person would.

- They run on GitHub for every pull request and every push to `main` (the **Actions** tab).
- They use a fake copy of the wiki (`tests/fixtures/wiki/`), so they need no internet.
- Once a week, GitHub also checks the app against the real wiki (**Actions → Tests → Run workflow** starts it by hand).

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
working in [Claude Code](https://claude.com/claude-code): the app, the wiki parser,
the tests, the designs, the icon and this README. The ideas, the testing in the game and the screenshots
came from the repository owner.

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`).
