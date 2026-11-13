# Quick Guide

A tick list for RuneScape Wiki quest quick guides, made for the Alt1 browser.
You paste a quest link, and the app shows the guide as a checklist in the RS3 brown style.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `style.css` | The look |
| `parser.js` | Reads the wiki page and turns it into JSON |
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

1. Paste a quest link from runescape.wiki and press **Load**. The quest page or its Quick guide both work. You can also type a quest name.
2. The tabs:
   - **Overview**: start point (with a map), members, length, quest tree.
   - **Skills**: skill levels and other things you need.
   - **Items**: tick what you have packed.
   - **Enemies**: what you fight, and their levels.
   - **Steps**: the guide as a tick list.
   - **Rewards**: rewards, music, and quests this one unlocks.
3. On **Steps**:
   - Click anywhere on a step to tick it. This works for sub-steps too, left or right of the text.
   - Gold link words still open the wiki. Picture, table and map boxes open without ticking.
   - **Done, next step** ticks the next step and scrolls on. The target button jumps to it. The eye button hides done steps.
   - "Bring for this part" boxes have their own tick boxes.
   - Chat options show under a step: the number key first, then the text.
   - Maps are the wiki's own map. Drag to move. Use + and − to zoom, or click the map once and use the mouse wheel.
4. The **⋯** menu: change quest, refresh from the wiki, open on the wiki, reset progress.
   It also has the settings: **Compact layout** (less space between rows) and **Text size** (− and +).

Your ticks and settings are saved in the app's own storage, on that computer.
On a narrow window, the tabs show icons instead of words.

## How it reads the wiki

`parser.js` asks the wiki's API for the page:
`https://runescape.wiki/api.php?action=parse&page=<Quest>/Quick_guide&prop=text|jsconfigvars&origin=*`
It turns the page into JSON with these parts: `overview`, `requiredItems`, `recommendedItems`,
`sections` (each with `blocks`: steps, sub-steps, chat options, pictures, maps, tables, notes, warnings,
"bring" lists), `rewards`, `music`, `achievements` and `requiredFor`.
Map pins and areas come from the page's map data (`wgKartographerLiveData`).
Map pictures load from `maps.runescape.wiki`.
If a quest has no Quick guide, it falls back to the quest's main page.

## Credits

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`).
