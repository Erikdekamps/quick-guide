# Quick Guide

A tick list for RuneScape 3, made for the [Alt1](https://runeapps.org/alt1) browser, in the game's brown window style.

- **Quests:** every quest's [Quick guide](https://runescape.wiki/w/Category:Quick_guides) from the RuneScape Wiki, as steps you tick off.
- **Area tasks:** every tier of the 13 [Area Tasks](https://runescape.wiki/w/Area_Tasks_achievements), with what each one needs.
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
- Click a quest. Its guide is read from the wiki once, then kept on your computer. It has three tabs:
  - **Overview:** details, the quest tree, skills, enemies and rewards.
  - **Items:** what to bring, with tick boxes.
  - **Steps:** click a step to tick it. The next step moves to the top. **Done, next step** ticks it for you.
    A part folds shut when you finish it. Maps are the wiki's own (drag to move, + and − to zoom).
- Boxes that fold (parts, pictures, maps, tables) start open. The app remembers the ones you close.

### Your character

In the settings, type your **character name** and press **Look up** (your RuneMetrics profile must be public).

- Done quests turn green, started ones yellow. Quests you cannot start yet are grey and say **Locked**.
- Skill levels show like the wiki: "16 [icon] Thieving". The level is green with a ✓ when you have it,
  red with a ✗ and your own level when you do not. "(boostable)" follows a level you may boost.
- Quests you need get a green ✓ when done and a red ✗ when not, in a quest's tree and in Area tasks.
- It updates by itself once a day. The round arrow updates it now; the ✕ forgets the character.

## Area tasks

The **Area tasks** tab has a row per tier (**Ardougne Easy**, **Ardougne Medium**, …) with its count and a progress bar,
under its area, in the game's order.

- Click a tier to open it. Each tier has **Needs** (levels, quests, items to bring, notes for Ironmen),
  **Tasks** and **Rewards**.
- Click a task to tick it. A task that needs more than you have says so in red, like "Needs 5 Thieving ✗ (you: 3)".
  The wiki's tip for a task is right under it. **Done, next task** ticks the next one.
- A task with a numbered list on the wiki (or a lot of text) has steps. Ticking the task ticks its steps;
  ticking all steps ticks the task.
- **Search** finds tiers ("ardougne hard") and tasks by name. Tick a task right in the results,
  or press **Enter** to open its tier. The first search reads all 13 areas once.

## Scan achievements

In the settings, only in Alt1. The app reads the game and sets every task to what the game shows:
done is ticked, not done (or locked) is unticked.

1. In the game, open **Hero → Achievements → Area Tasks** and click a tier, for example **Easy Ardougne**.
   Keep **Show Completed** on and **List Mode** off.
2. Press **Start**. A green bar at the top names the tier and the tasks in view.
3. Scroll each list down, then click the next tier in the game. Go through them all, top to bottom.

How it knows where it is:

- **The tier:** the one with the gold box in the list on the left. The app counts it from the **Area Tasks**
  title above Easy Ardougne (or the next title, below the last tier). It remembers what each tier's name looks like,
  so after one scan with the title in view it knows them without it. If it cannot tell, it asks you to scroll the
  list on the left up until **Area Tasks** shows.
- **The tasks:** a new tier starts at the top of its list (the scrollbar says when it is). When you scroll,
  each row is matched to the row it looks most like in the last look. A tier or a task only changes when two looks
  in a row agree, so a tooltip or a moving background does not confuse it.
- If the bar shows the wrong tier, use **◀ ▶**. They hold until you click another tier in the game.
  **Stop** ends the scan.
- It works at any interface size and on big screens. If it cannot see the list, the bar says so.

## Settings (the cog)

The same on every screen:

- **Player:** look up your character, update it, or forget it.
- **Quest list:** sort, **Hide completed**, **Hide miniquests**, **Hide locked**. Hide completed and Hide locked work for area tiers too.
- **Display:** **Show done steps** (to untick one) and **Text size** (12 to 40).
- **Update quest list** reads the lists from the wiki again.
- **Scan achievements** (only in Alt1).
- **Backup:** **Export state** and **Import state** (below).
- **Delete everything** (at the very bottom) deletes all your ticks, guides, areas, settings and your character.
  It takes two clicks, the second within 4 seconds.

The **⋯** button in a quest or area refreshes it from the wiki, opens it on the wiki, or resets its progress.

## Export and import

**Export state** gives a JSON file with **every quest and every area task**, each `true` (done) or `false` (not done).
**Download file** saves it; **Copy** puts the text on the clipboard (use Copy inside Alt1 if the download does not work).

Change it in any text editor, then **Import state**, **Choose a file**, **Import**. The number at the start of a task
(`447 …`) or a step (`993:1 …`) is how the app finds it; a task can also be written by its name alone.

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
  "areas": {
    "Ardougne": { "Easy": { "447 The Essence of Magic": true, "448 Yoink!": false } }
  }
}
```

- Steps are only listed for quests you opened; the others are one line.
- Import replaces the ticks of the quests and areas in the file and leaves the others alone.
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
| `settings`, `last` | Your settings, and the quest or area that was open last |
| `player` | The character you looked up: quests done or started, skill levels |
| `scannames` | What each tier's name looks like in the game (for Scan achievements) |

Local storage holds about 5 MB. When it is full, the guides you opened longest ago are dropped (your ticks stay)
and read from the wiki again when you open them.

## How it reads the wiki

- `quests.js` reads the quest lists and the optimal order through the wiki's API, for example
  `https://runescape.wiki/api.php?action=parse&page=List_of_quests&origin=*`.
- `parser.js` reads one guide (`<Quest>/Quick_guide`, or the quest's own page if it has no Quick guide)
  and the area pages (`<Area>_achievements`), and turns them into JSON.
- Map pictures load from `maps.runescape.wiki`.
- The character lookup goes through the wiki too, which passes on Jagex's RuneMetrics data:
  `https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/<name>` and
  `https://runescape.wiki/cors/m=hiscore/index_lite.json?player=<name>`.

No other service is used.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The page and its look |
| `app.js` | The screens, ticks, settings, export and import, and the scan |
| `parser.js` | Reads a quest guide or an area page from the wiki |
| `quests.js` | Reads the quest lists and the optimal order |
| `reader.js` | Reads the game's task list from the screen (for Scan achievements) |
| `vendor/leaflet/` | Leaflet 1.9.4, the map library (BSD-2 licence) |
| `appconfig.json`, `icon.png` | What Alt1 needs to add the app |
| `tests/`, `playwright.config.js`, `package.json` | The tests |
| `.github/workflows/tests.yml` | Runs the tests on GitHub |
| `designs/` | Design boards and screenshots of every screen |

When you change a file, also raise the `?v=1.25.0` numbers in `index.html`. Alt1 keeps old copies of files otherwise.

## Tests

The tests use [Playwright](https://playwright.dev/) with Chromium, the browser Alt1 is built on. They open the app
in a 360 × 720 window, like Alt1, and click through it like a person would.

- They run on GitHub for every pull request and every push to `main` (the **Actions** tab).
- They use a fake copy of the wiki (`tests/fixtures/`), so they need no internet.
- Once a week, GitHub also checks the app against the real wiki (**Actions → Tests → Run workflow** starts it by hand).
- **Scan achievements** is tested on screenshots of the game (`tests/fixtures/game/`) with a fake Alt1: done, not done
  and locked tasks; bigger screens and interface sizes; blurry, dark and JPEG pictures; busy screens where no list
  may be found; scrolling (slow, fast, too far); tooltips; a see-through window; both ways Alt1 hands over pictures;
  and how fast one look is.

To run them on your own computer, with [Node.js](https://nodejs.org/) 22:

```
npm ci
npx playwright install chromium
npm test
```

- `npm run test:live` checks against the real wiki (needs the internet).
- `npm run coverage` runs the tests and shows how much of each file they run.

## Credits

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`).
