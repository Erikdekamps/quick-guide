# data/ (an example, not used by the app yet)

This folder shows what the wiki's data could look like as JSON files in git. A pipeline would build them from the
RuneScape Wiki, so the app reads these files and players' browsers no longer ask the wiki.

The files here are real: they were read from the wiki on 2026-11-22 with the app's own reader (`js/wiki/`).
Only a few are here, to look at the shape.

| File | What it is |
| --- | --- |
| `index.json` | What the start screens need: every quest and miniquest (342), the 13 areas with their tiers, the 3 capes. Complete. |
| `quests/<id>.json` | One quest guide. Here: `cooks-assistant` (small), `while-guthix-sleeps` and `desert-treasure` (the two biggest), `bar-crawl-miniquest` (a miniquest). |
| `achievements/areas/<id>.json` | One area with all its tiers and tasks. Here: `ardougne` and `lumbridge`. |
| `achievements/capes/<id>.json` | One cape with its achievements: `mqc`, `comp` and `trim`. All three are here. |

How to read them:

- `format` is the shape of the file. A change to the shape raises it.
- `rev` is the wiki's revision of the page a file was read from. The pipeline writes a file again only when it changed.
- An `id` of a step, an item, a task or an achievement is the one the app saves your ticks by today.
- Tasks, steps and achievements are lists, in the wiki's order. (JSON does not keep the order of keys that are numbers.)
- Text with links is HTML that the reader already made safe.
- Pictures and map tiles are not copied: the files hold their address on the wiki.

The index names every quest, area and cape; most of their files are not in this example.

The text in these files comes from the [RuneScape Wiki](https://runescape.wiki/) and is under CC BY-NC-SA 3.0, not
under the licence of the code: see `LICENSE.md` in this folder.
