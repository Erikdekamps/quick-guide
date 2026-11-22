# Developing Quick Guide

How the app works inside, what it saves, and how it is built, tested and released. The [README](README.md) says what
the app does.

The app is plain files in the browser: no build step, and no npm packages in the app. Node.js 22 and `npm ci` give you
the tools to test it.

## The export file

**Export state** (in Settings) gives a JSON file with **every quest and every area task**, each `true` (done) or `false` (not done),
**the capes you opened** (each achievement, by category) and **your lists**.
It also lists the quests the game knows that the wiki's quest list does not have (parts of a bigger quest, like
Recipe for Disaster), so its done quests add up to what the game says. `tiers` is each tier's count ("7 / 12"),
to read at a glance; an import does not use it. Steps say all they say, nothing is cut off.
**Download file** saves it; **Copy** puts the text on the clipboard (use Copy inside Alt1 if the download does not work).

Change it in any text editor, then **Import state**, **Choose a file**, **Import**. The number at the start of a task
(`447 …`), a step (`993:1 …`) or an achievement (`4949 …`) is how the app finds it; a task can also be written by its name alone.
The achievements that tick themselves (Quest Cape, Master Skiller, and the two capes in the trimmed one) are only to read.

In `mylist`, each goal is a line, written the way you type it in the add box: `"82 Thieving"`,
`"500 Magic logs"`, `"Quest: While Guthix Sleeps"`, `"Task 448: Yoink! (Ardougne Easy)"`,
`"Achievement 2111: Advanced Sweeping (Master quest cape)"`. A goal with a note or sub tasks is
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
  "capes": {
    "Master quest cape": { "Lore": { "4949 A Sliver of Silver Helps the Sanguine Go Down": true }, "Completionist": { "1 Quest Cape": false } }
  },
  "mylist": {
    "Today": { "Task 448: Yoink! (Ardougne Easy)": false, "Vis wax": true },
    "Gathering": { "500 Magic logs": false }
  }
}
```

- Steps are only listed for quests you opened; the others are one line.
- Import replaces the ticks of the quests, areas and capes in the file and leaves the others alone.
  A file with `mylist` replaces your lists; a file without it leaves them alone.
  If a file has a mistake (in its lists too), it says what is wrong and changes nothing. Files from the first version still import.
- A file with area tasks: the app first reads the areas it does not know yet, so every task is found.

## What is saved

Everything is in the browser's local storage, on your computer. All keys start with `qg1.`:

| Key | What |
| --- | --- |
| `list`, `minis` | Every quest and miniquest, from the data's index |
| `order` | The wiki's optimal quest order |
| `quest.<page>`, `prog.<page>` | A quest's guide, and your ticks for it |
| `meta` | One small entry per quest you opened (steps done, total, last opened) |
| `qdone` | Quests marked done by an import |
| `area.<name>`, `aprog.<name>` | An area's page, and your ticks for it |
| `ameta`, `aidx` | Counts for the area list, and every task of every area (for search) |
| `cape.<key>`, `cprog.<key>` | A cape's achievements (`mqc`, `comp` or `trim`) with what each needs and its tip, and your ticks, tab and folded parts in it |
| `settings`, `last` | Your settings (the theme too), and the quest, area or cape that was open last |
| `upd` | When Update from the wiki last ran, and what it found |
| `player` | The character you looked up: quests done or started (and their names), skill levels, quest points |
| `view` | Where you were: the search text, folded groups, lists and sub tasks, where each list, tab and tier is scrolled, and if Settings is open |
| `todo` | My list: your lists and their goals (never dropped to make room) |

Your ticks in an area (`aprog`), in a cape (`cprog`) and My list (`todo`) say which shape they are saved in (`v`).
A change to that shape raises `APROG_VERSION`, `CPROG_VERSION` or `TODO_VERSION`, and the app upgrades older ones when
it reads them. Guides, areas and capes have their own version too: an older one is read from the wiki again.

Local storage holds about 5 MB. When it is full, the guides you opened longest ago are dropped, then the areas (your
ticks stay), and read from the wiki again when you open them. When there is still no room, the app says that your last
change is not saved: it is kept until you close the app, so **Export state** still has it.

A saved guide, area or cape that cannot be shown (it is broken) is dropped, and the list says so. It is read from the
wiki again when you open it; your ticks stay.

## How it reads the wiki

The app does not read the wiki's pages itself. A build does, every night, and keeps what it reads as files in `data/`
(see [The data](#the-data)). The app reads those files, from where it is served itself:

- `js/wiki/data.js` asks for `data/index.json` once at the start: the quest lists, the optimal order, and every area
  and cape, each with a mark (the hash of its file).
- A guide, an area or a cape is one more file, asked for when you open it, for example
  `data/quests/cooks-assistant.json?h=0a1b2c3d4e`. The mark in the address makes the browser take a new copy only when
  the file changed. What you opened is saved, so it opens without asking the next time.
- Update from the wiki asks for the index again, and reads again what has another mark than the one saved with it.
  A guide saved before the app had its data has no mark: its revision on the wiki says if it changed.

The build reads the wiki with the reader in `js/wiki/` (these files are not loaded by the app):

- `js/wiki/quests.js` reads the quest lists and the optimal order through the wiki's API, for example
  `https://runescape.wiki/api.php?action=parse&page=List_of_quests&origin=*`.
- `js/wiki/guide.js` reads one guide (`<Quest>/Quick_guide`, or the quest's own page if it has no Quick guide),
  `js/wiki/areas.js` the area pages (`<Area>_achievements`) and the capes' achievement lists (`Master_Quest_Cape_(achievement)`,
  `Completionist_Cape_(achievement)`, `Trimmed_Completionist_Cape_(achievement)`, in `js/wiki/capes.js`). Each turns its page into JSON. The levels
  come from `Master_quest_cape` (its minimum skill levels) and `Master_Skiller`. What each achievement needs, the capes
  it counts for and its tip come from its own page, 20 pages a time: the infobox of the first section, and the first
  paragraph, for example
  `https://runescape.wiki/api.php?action=query&prop=revisions|extracts&rvprop=content&rvsection=0&exintro=1&titles=Advanced_Sweeping|Annihilator&format=json&origin=*`.
- A name a guide or an area shows as a quest, which the quest lists do not have (a part of Recipe for Disaster, say),
  gets a file too when it has a Quick guide of its own. The index marks it `extra`: it is not in the quest list.

What the app itself still asks others:

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

- Every question goes through one helper, `askWiki` in `js/wiki/base.js`. It gives the wiki 25 seconds. When the wiki
  says it is busy (error 429 or 5xx, "maxlag", "ratelimited"), or the connection drops, the question is asked once
  more: after as long as the wiki asks (at most 5 seconds), else after a second. Any other error, also one inside a
  normal answer, is said in the wiki's own words. When a query's answer comes in parts (the wiki says `continue`), the
  rest is asked for too. A file of the data gets 25 seconds too, and is asked for once.

No other service is used. The fonts come with the app (`vendor/fonts/`).

## The data

`data/` holds everything the app shows of the wiki, as JSON files in git: an index of every quest, area and cape, and
one file for each guide, area and cape. [data/README.md](data/README.md) says what is in them. The app reads them
(see [How it reads the wiki](#how-it-reads-the-wiki)): a player's browser does not ask the wiki for guides.

- `npm run data` builds them. It reads the wiki with the app's own reader, in Chromium (about 400 requests, a few at a
  time, three minutes), and writes only the files that changed.
- GitHub runs it every night (`.github/workflows/data.yml`). When something changed it opens a pull request that says
  what, or updates the one that is open; the tests run on it. Nothing changes until you merge it.
- A file only changes when the wiki did. What is new gets the day it was first seen (`added`).
- When the wiki is broken (the lists cannot be read, an area or a cape is missing, more than 10 guides fail), the
  build stops and changes nothing. One guide that fails keeps its file from before.
- The data goes on GitHub Pages with the app, but is no part of the app's version: a change to it needs no new
  version and no line in the changelog.
- Once, in the repo settings: Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve
  pull requests". Without it the nightly build cannot open its pull request.

## Files

| File | What it is |
| --- | --- |
| `README.md`, `DEVELOPING.md` | What the app does; how it works inside (this file) |
| `index.html`, `style.css` | The page and its look (both themes: every colour is a token at the top of `style.css`) |
| `js/app/core.js` | What every screen shares: storage, settings, the player, menus, the window's parts, maps |
| `js/app/quests.js` | The quest list and the quest screen (Overview, Items, Steps) |
| `js/app/pages.js` | What an area and a cape share: they open, fold, reset, and are read again with what is new |
| `js/app/areas.js` | Achievements: the list of tiers, search, and one area |
| `js/app/capes.js` | Achievements: the cape cards, and one cape's page |
| `js/app/update.js` | Update from the wiki: asks the data what changed, reads again only that, marks what is new |
| `js/app/todo-data.js` | My list: the saved lists, goals and sub tasks, wiki links, export and import |
| `js/app/todo-view.js` | My list: what it shows, its count in the bar at the bottom, Add to list in the ⋯ menus, the menus and boxes |
| `js/app/todo.js` | My list: adding, ticking, and what the menus of a goal, a sub task and a list do |
| `js/app/backup.js` | Export and import |
| `js/app/main.js` | Loaded last: the clicks and keys of every screen, and the start |
| `js/wiki/base.js` | Shared by the app and the wiki reader: small helpers, links, the areas and capes there are, and `askWiki`, the one way to ask the wiki |
| `js/wiki/html.js` | The reader (the build loads it, the app does not): the wiki's HTML made small and safe (only a few tags survive), and a page's maps and pictures |
| `js/wiki/steps.js` | The reader: the parts of a guide: chat options, tables, text, "bring" boxes, steps and sub-steps |
| `js/wiki/guide.js` | The reader: a quest guide as JSON: its details box, its parts, and the ids of steps and items |
| `js/wiki/player.js` | A player's quests and levels, from Jagex |
| `js/wiki/areas.js` | The reader: an area page: its tiers, tasks, needs and rewards |
| `js/wiki/capes.js` | The reader: a cape's achievements, and what each one needs |
| `js/wiki/quests.js` | The reader: the quest lists and the optimal order |
| `js/wiki/data.js` | The app's side of the data: reads the files of `data/` and gives the app its lists, guides, areas and capes |
| `vendor/leaflet/` | Leaflet 1.9.4, the map library (BSD-2 licence) |
| `vendor/fonts/` | The fonts (Cinzel, Fira Sans, Fira Mono; SIL Open Font License), so the app needs no font service |
| `icon.svg` | The app's icon: a tick box with a green tick on a grey tile. Only greys and green, so it fits both themes |
| `appconfig.json`, `icon.png` | What Alt1 needs to add the app (`icon.png` is made from `icon.svg`: `npm run icon`) |
| `tools/icon.js` | Makes `icon.png` from `icon.svg` |
| `tools/serve.js` | Serves the app on your own computer: `npm start` |
| `data/` | The wiki's quests, area tasks and capes as JSON files, made by a build (see [The data](#the-data)). Its text is the wiki's, under CC BY-NC-SA 3.0 (`data/LICENSE.md`) |
| `tools/data/` | The build of `data/`: `npm run data` |
| `.github/workflows/data.yml` | Builds `data/` every night, and opens a pull request when the wiki changed |
| `CHANGELOG.md`, `tools/version.js` | What changed in each version, and the tool that raises and checks the version (see [Versions](#versions)). It also has the list of the app's files, and copies them for GitHub Pages |
| `tests/`, `playwright.config.js`, `package.json` | The tests |
| `tests/unit/` | The unit tests: the app's files in Node, without a browser (`tests/unit/load.js` loads them) |
| `tests/support/` | What the tests share: `app.js` (the fake wiki and the helpers of the browser tests) and `coverage.js` (which code no test runs) |
| `tests/fixtures/` | Pages of the wiki, saved, for the fake wiki (`tests/fixtures/wiki/`) |
| `tests/coverage.json` | The code no test runs yet (see [Tests](#tests)) |
| `tools/designs/` | Builds the design boards and their pictures from the app: `npm run designs` (see [designs/README.md](designs/README.md)) |
| `eslint.config.js` | The code check: `npm run lint` |
| `.github/workflows/tests.yml` | Every pull request: code check and security check, then the tests, then the live wiki check |
| `.github/actions/setup/` | What the jobs on GitHub start with: Node, the npm packages, and Chromium (kept between runs) |
| `.github/workflows/live.yml` | Checks the app against the real wiki every Monday |
| `.github/workflows/deploy.yml` | Puts the app from `main` on GitHub Pages (only the app's files), and makes a release of each new version |
| `.github/pull_request_template.md` | The checklist of a pull request |
| `CLAUDE.md` | The rules Claude follows when it works on the app |
| `.github/workflows/security.yml`, `tools/security.js` | Checks for known security problems and newer versions |
| `.github/dependabot.yml` | Asks Dependabot for a pull request when a newer version is out |
| `designs/` | Design boards (in `designs/canvas/`) and screenshots of every screen |

## Versions

The app has one version number, like `1.43.0`. Settings shows it at the bottom. [CHANGELOG.md](CHANGELOG.md) says what
changed in each version. The three numbers are MAJOR.MINOR.PATCH ([semantic versioning](https://semver.org/)):

- **MAJOR** goes up when saved data or the export file changes so that old ones no longer work as before.
- **MINOR** goes up for something new you can see or do.
- **PATCH** goes up for a fix, or a change you do not see.

The app is what GitHub Pages serves (next to `data/`, which has no version): `index.html`, `style.css`, `appconfig.json`, `icon.svg`, `icon.png`, `js/`, `vendor/`. Only these and `data/` go on the site.
Every change to the app gets a new version, in the same pull request:

1. Write what changed under `## [Unreleased]` in `CHANGELOG.md`.
2. Run `npm run bump -- minor` (or `patch`, or `major`). It raises the number in `package.json` and in every `?v=`
   in `index.html` (Alt1 keeps old copies of files otherwise), and puts your notes under the new number.

GitHub checks this on every pull request (`npm run check:version -- origin/main` does the same on your computer).
It compares with the version `main` had when your branch left it, so a branch that only changes the docs still passes
after `main` got a new version.
Once `main` is on GitHub Pages, GitHub makes a release of the new version, with a tag like `v1.43.0`
(**Releases**, on the repo's page).

## Tests

The tests use [Playwright](https://playwright.dev/) with Chromium, the browser Alt1 is built on. They open the app
in a 360 × 720 window, like Alt1, and click through it like a person would.

- **Unit tests** (`tests/unit/`) run the app's own files in Node, without a browser. All of them take a few
  seconds, and they run first: the browser tests only start when they pass. They test what needs no page: what you
  type, wiki text, ids, how the app asks the wiki, what Update from the wiki reads again. Code that needs a page
  says so ("needs a browser"), and is tested in the browser.
- The other tests open the app in the browser.
- On GitHub, every pull request runs its checks in three steps (`.github/workflows/tests.yml`). A step starts only
  when the one before it passed, so a mistake stops everything after it:
  1. **Code check** (`npm run lint`, and the version check) and **Security check** (`npm run security`, see below),
     side by side.
  2. **App tests**: `npm run coverage`. The unit tests run first, once; then the browser tests, and the coverage check.
  3. **Live wiki check**: only when the pull request changes how the app reads the wiki.

  Chromium is kept between runs, so it is not downloaded every time.

  `main` only takes pull requests whose checks passed, and is then put on GitHub Pages. (CodeQL, GitHub's own code
  scan, runs next to them: GitHub starts it by itself.)
- They use a fake copy of the wiki (`tests/fixtures/wiki/`), so they need no internet. The app's data is made from
  it for each test, by the reader and the build's own code, the way the nightly build makes `data/`.
- An error in the page that nobody catches fails the test, in every test.
- New code comes with tests. GitHub runs them with `npm run coverage`, which fails when a pull request adds code
  that no test runs (a part of an `if`, a fallback, a function), in the unit tests or in the browser.
  `tests/coverage.json` lists the code no test runs yet. The pieces of code themselves are compared, not how many
  there are: new code without a test fails, also when other code without a test went away.
- A test that passes only on its second try fails the run. The live wiki check is the exception: the real wiki is
  slow now and then.
- No test waits a fixed time or looks at the clock on the wall: a test that checks nothing happens moves the page's
  own clock, or counts what the app asked the wiki.
- `tests/unit/code.spec.js` checks the code's own rules without a browser: every file is loaded and listed, every name a
  file takes from another one is shared, and every saved key is in the table above.
- GitHub checks the reader and the app against the real wiki once a week, and on a pull request that changes the
  reader (`js/wiki/`). **Actions → Live wiki check → Run workflow** starts it by hand.

To open the app on your own computer, run `npm start` and open the address it prints (`http://localhost:8000/`, or
the next port when that one is in use). Opening `index.html` as a
file does not work: a browser does not let a page from a file read the files in `data/`, and the app says so.

To run the tests on your own computer, with [Node.js](https://nodejs.org/) 22:

```
npm ci
npx playwright install chromium
npm test
```

- `npm run test:unit` runs only the unit tests: a few seconds, no browser needed.
- `npm run lint` is the code check: names that are not defined or not used, and other mistakes. The app's files may
  use what a browser has, the tests and tools what Node has. The script in `index.html` is checked too.
- `npm run test:live` checks against the real wiki (needs the internet).
- `npm run coverage` runs the tests and shows how much of each file they run. It fails when there is code no test runs
  that `tests/coverage.json` does not list. When code in that list is gone, `npm run coverage -- --update` saves that.
- `npm run bump -- patch|minor|major` and `npm run check:version` (see [Versions](#versions)).
- `npm run security` checks for known security problems and newer versions (see below).
- `npm run icon` makes `icon.png` again after you change `icon.svg` (a test checks the two are the same picture).
- `npm run data` builds `data/` again from the wiki (see [The data](#the-data); needs the internet).
- `npm run designs` builds the design boards and their pictures again from the app (see [designs/README.md](designs/README.md)).

## Security and updates

The app itself has no npm packages: it runs as plain files in the browser. It uses Leaflet (a copy in
`vendor/leaflet/`), and the tests use Playwright (an npm package).

- **Security check**: on every pull request (next to the code check, see [Tests](#tests)), and every Monday
  (`.github/workflows/security.yml`). It fails when a known high or critical security problem affects Playwright or the Leaflet copy, and then
  you update. Lower-rated problems and newer versions show as notes on the run and in its summary.
  Run it yourself with `npm run security`.
- **Dependabot** (`.github/dependabot.yml`): every Monday it opens a pull request for a newer Playwright or a newer
  GitHub Action, so the tests run on it before you merge. It cannot see the Leaflet copy; the security check
  says when a newer Leaflet is out.
- To also get a pull request for a security fix as soon as one is out, turn on **Dependabot security updates** on
  GitHub: Settings → Code security → Dependabot.
