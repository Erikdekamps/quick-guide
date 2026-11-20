# Test fixtures

What the tests read instead of the internet.

## `wiki/`: pages of the RuneScape Wiki

The fake wiki in `tests/support/app.js` answers with these (see `Wiki.standard()`, `withAllAreas()` and `withCapes()`).

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
| `master-quest-cape-achievement.html`, `completionist-cape-achievement.html`, `trimmed-completionist-cape-achievement.html` | Part of each cape's achievement list (see `withCapes()`) |
| `master-quest-cape.html` | The master quest cape's item page: the levels it needs |
| `master-skiller.html` | The Master Skiller achievement: the levels the completionist cape needs |
| `cape-achievements.json` | The achievements' own pages, for those capes: each page's first section (wikitext) and first paragraphs |
