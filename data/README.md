# data/

The quests, area tasks and capes of the RuneScape Wiki, as JSON files. A build makes them from the wiki with the app's
own reader (`js/wiki/`): `npm run data`. GitHub runs it every night and opens a pull request when the wiki changed
(`.github/workflows/data.yml`). Do not change these files by hand: the next build writes them again.

The app does not read these files yet. When it does, a player's browser no longer asks the wiki for them.

| File | What it is |
| --- | --- |
| `index.json` | What the lists need: every quest and miniquest, the 13 areas with their tiers, the 3 capes |
| `quests/<id>.json` | One quest guide |
| `achievements/areas/<id>.json` | One area, with all its tiers and tasks |
| `achievements/capes/<id>.json` | One cape with its achievements: `mqc`, `comp` and `trim` |

How to read them:

- `format` is the shape of the file. A change to the shape raises it (`FORMAT` in `tools/data/shape.js`).
- `rev` is the wiki's revision of the page a file was read from.
- `hash`, in the index, is a short mark of a file's text. It changes when the file does: the app sees by it what changed.
- `added` is the day a build first saw a quest, a task or an achievement. The first build marked nothing.
- A quest with `extra` in the index is no quest of the wiki's lists: it is a part of a bigger quest (of Recipe for
  Disaster, say) that has a Quick guide of its own. The app opens it from a link, and does not list it.
- `updated`, in the index, is the day the data last changed.
- An `id` of a step, an item, a task or an achievement is the one the app saves your ticks by.
- Tasks, steps and achievements are lists, in the wiki's order. (JSON does not keep the order of keys that are numbers.)
- Text with links is HTML that the reader already made safe.
- Pictures and map tiles are not copied: the files hold their address on the wiki.
- A quest in the index without `rev` has no guide on the wiki yet, and no file.

A file only changes when the wiki did: nothing in it says when it was built. So a pull request shows what changed on
the wiki, and nothing else.

The text in these files comes from the [RuneScape Wiki](https://runescape.wiki/) and is under CC BY-NC-SA 3.0, not
under the licence of the code: see `LICENSE.md` in this folder.
