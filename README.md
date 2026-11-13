# Quick Guide

A tick list for RuneScape Wiki quest quick guides, made for the Alt1 browser.
You pick a quest from the list, and the app shows the guide as a checklist in the RS3 brown style.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `style.css` | The look |
| `parser.js` | Reads one quest guide and turns it into JSON |
| `quests.js` | Reads the list of all quests |
| `app.js` | The screens, ticks, buttons and maps |
| `vendor/leaflet/` | Leaflet 1.9.4, the map library (BSD-2 licence) |
| `appconfig.json`, `icon.png` | What Alt1 needs to add the app |

## 1. Put it online

Alt1 adds apps from a web address. GitHub Pages is free:

1. Make a new **public** repo on github.com, for example `quick-guide`.
2. Upload all the files in this folder, **including the `vendor` folder**, then commit.
3. In the repo, go to **Settings → Pages**. Under "Build and deployment", pick **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. Wait a minute. The app is now at `https://YOUR-NAME.github.io/quick-guide/`.

Any other web host works too, as long as it serves the files over `https`.

## 2. Add it to Alt1

With Alt1 running, paste this into your normal web browser's address bar and press Enter:

```
alt1://addapp/https://YOUR-NAME.github.io/quick-guide/appconfig.json
```

Alt1 asks if you want to add the app. Say yes.
You can also open the app page in a browser and click **Add this app to Alt1** at the bottom.

## 3. Use it

1. The first screen lists **every quest** from the wiki's [List of quests](https://runescape.wiki/w/List_of_quests).
   - Type in the box to search. Press **Open** (or Enter) to open the top match.
   - You can still paste a wiki link in the same box.
   - Sort by name, difficulty, length, series or newest. Click a group name (like **A**) to fold it shut or open.
2. Click a quest. Its guide is read from the wiki once, then kept on your computer.
3. The tabs: **Overview**, **Skills**, **Items**, **Enemies**, **Steps**, **Rewards**.
4. On **Steps**:
   - Click anywhere on a step to tick it. It goes away, and the next step moves to the top, right under the part's name.
   - **Show done steps** in the cog menu shows ticked steps again, so you can untick one.
   - **Done, next step** ticks the next step. **Jump to next step** is in the cog menu.
   - Opening or closing a part keeps that part at the top.
   - "Bring for this part" boxes close by themselves when every item in them is ticked.
   - Maps are the wiki's own map. Drag to move, + and − to zoom.
5. The **cog** button holds the settings:
   - **Jump to next step**, **Compact layout**, **Show done steps**, and **Text size** (12 to 40).
   - **Update quest list** reads the list from the wiki again, and tells you when it is done.
6. The **⋯** button (in a quest): refresh from the wiki, open on the wiki, reset progress.
7. The **←** button goes back to the quest list.

On a phone the page does not zoom when you pinch or double-tap.

## What is saved

Everything is in the browser's local storage, on that computer. All keys start with `qg1.`:

| Key | What |
| --- | --- |
| `list` | Every quest from the wiki list (name, members, length, difficulty, points, series, date) |
| `meta` | One small entry per quest you opened (ticks done, total, last opened) |
| `quest.<page>` | The full parsed guide of one quest, as JSON |
| `prog.<page>` | Your ticks for that quest |
| `settings`, `last` | Display settings, and the quest that was open last |

Local storage holds about 5 MB. If it gets full, the guides you opened longest ago are dropped
(your ticks stay). They are read from the wiki again when you open them.

## How it reads the wiki

- `quests.js` reads the quest list: `https://runescape.wiki/api.php?action=parse&page=List_of_quests&origin=*`
- `parser.js` reads one guide: `https://runescape.wiki/api.php?action=parse&page=<Quest>/Quick_guide&prop=text|jsconfigvars&origin=*`
  It turns the page into JSON with these parts: `overview`, `requiredItems`, `recommendedItems`,
  `sections` (each with `blocks`: steps, sub-steps, chat options, pictures, maps, tables, notes, warnings,
  "bring" lists), `rewards`, `music`, `achievements` and `requiredFor`.
  If a quest has no Quick guide, it falls back to the quest's main page.
- Map pictures load from `maps.runescape.wiki`.

## Credits

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`).
