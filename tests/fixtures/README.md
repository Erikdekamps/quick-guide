# Test fixtures

What the tests read instead of the internet and the game.

## `wiki/`: pages of the RuneScape Wiki

The fake wiki in `tests/support/app.js` answers with these (see `Wiki.standard()` and `withAllAreas()`).

| File | What |
| --- | --- |
| `list-of-quests.html` | The wiki's list of quests (a short piece of it) |
| `miniquests.html` | The list of miniquests |
| `progression-guide.html` | The optimal quest order |
| `while-guthix-sleeps.html`, `while-guthix-sleeps.live.json` | A long quick guide, and its map data |
| `cooks-assistant.html` | A short quick guide |
| `rune-mysteries.html` | A quest with no quick guide: its full page |
| `ardougne-achievements.html`, `lumbridge-achievements.html` | Two whole Area Tasks pages |
| `varrock-excerpt.html` | Part of the Varrock page: tasks with steps |

## `game/`: pictures of the game, for Scan achievements

Screenshots of Hero > Achievements > Area Tasks on a desktop, at the game's normal interface size. The tests hand
them to the reader with a fake Alt1 (see `tests/game.spec.js`).

| File | What |
| --- | --- |
| `desktop-daemonheim-hard.png` | Hard Daemonheim: tasks to do, locked and done |
| `desktop-set-tasks.png` | The "Set tasks" before you pick a tier: nothing to tick |
| `desktop-alt1-ardougne-easy.png` | The game with this app open next to it, on Easy Ardougne (all done) |
| `desktop-alt1-easy-desert.png` | The same, on Easy Desert, scrolled down a little |
| `desktop-alt1-elite-desert.png` | Elite Desert, with no tier title in view |
| `badges.png`, `badges.json` | The sprite: each area's task badge, cut from the game (see below) |

### The badge sprite

Every task row starts with a badge. The emblem is the area's (a red shield for Ardougne, a blue one for Falador, a
palm for Karamja); the frame and the number (5, 10, 15, 25) are the tier. A done task has a green tick over its badge;
a locked one is grey with a lock. The reader finds the rows by their boxes and reads done from the gold title, so it
works for any badge; the tests put every badge of the sprite into real lists to check that.

`badges.png` has one row per area, in 28 × 28 cells. `badges.json` says where each one is, for example
`"Daemonheim": { "hard locked": [28, 28] }` (the top-left corner of the cell).

It has Ardougne, Daemonheim, Desert, Falador, Karamja, Varrock and Fremennik. To add an area: take a screenshot of
its tasks at the game's normal interface size, cut each badge as a 28 × 28 cell (the reader finds the rows: the
cell's top-left corner is 7 pixels left of `x0` and 21 pixels above a row's `y`), add the cells to `badges.png` and
their places to `badges.json`.
