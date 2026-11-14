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

Alt1 adds apps from a web address, so the files must be on the web. GitHub Pages is free:

1. On github.com, open the repo and go to **Settings → Pages**.
2. Under "Build and deployment", pick **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. Wait a minute. The app is now at `https://erikdekamps.github.io/quick-guide/`.

The repo must be **public** for free GitHub Pages.
Any other web host works too, as long as it serves the files over `https`.

## 2. Add it to Alt1

With Alt1 running, paste this into your normal web browser's address bar and press Enter:

```
alt1://addapp/https://erikdekamps.github.io/quick-guide/appconfig.json
```

Alt1 asks if you want to add the app. Say yes.

Two other ways:

- Open `https://erikdekamps.github.io/quick-guide/` in a normal browser and click **Add this app to Alt1** at the bottom.
- Open that same address in the **Alt1 browser**. Alt1 shows an **Add app** button.

The app asks for no Alt1 permissions. It does not read your screen or draw on the game.
Inside Alt1, wiki links open in your normal browser, so the app stays on the guide.

### After a change

Alt1 keeps old copies of files. When you change a file, also change the `?v=1.1.0` numbers in `index.html`, so Alt1 loads the new ones.

## 3. Use it

1. The first screen lists **every quest** from the wiki's [List of quests](https://runescape.wiki/w/List_of_quests).
   - Type in the box to search. Press **Open** (or Enter) to open the top match.
   - You can still paste a wiki link in the same box.
   - Sort by name, difficulty, length, series or newest. Click a group name (like **A**) to fold it shut or open.
2. Click a quest. Its guide is read from the wiki once, then kept on your computer.
3. Three tabs: **Overview**, **Items** and **Steps**.
   - Overview has four parts that fold open and shut: **Details**, **Skills**, **Enemies**, **Rewards**.
     They start open. The app remembers which ones you closed.
   - Items has the **Required** and **Recommended** items, each with a tick box.
   - Boxes for pictures, maps, tables and music also remember if you opened them.
4. On **Steps**:
   - Click anywhere on a step to tick it. It goes away, and the next step moves to the top, right under the part's name.
   - A part folds shut when you finish it.
   - **Show done steps** in the cog menu shows ticked steps again, so you can untick one.
     With it on, finished parts and "Bring" boxes stay open.
   - **Done, next step** ticks the next step. **Jump to next step** is in the cog menu.
   - Opening or closing a part keeps that part at the top.
   - "Bring for this part" boxes close by themselves when every item in them is ticked.
   - Maps are the wiki's own map. Drag to move, + and − to zoom.
5. The **cog** button holds the settings:
   - **Jump to next step**, **Show done steps**, and **Text size** (12 to 40).
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
