# Quick Guide

A tick list for RuneScape 3, made for the [Alt1](https://runeapps.org/alt1) browser. It looks like the game's own Hero
window, in the brown interface or the blue one (a setting).

- **Quests:** every quest's [Quick guide](https://runescape.wiki/w/Category:Quick_guides) from the RuneScape Wiki, as
  steps you tick off.
- **Achievements:** the master quest, completionist and trimmed completionist capes, and every tier of the 13
  [Area Tasks](https://runescape.wiki/w/Area_Tasks_achievements), with what each one needs.
- **My list:** your own lists of goals, with sub tasks, to plan your day or week.
- **Your character:** look it up in Settings, and the app shows the quests you did and the levels you have.

## Add it to Alt1

With Alt1 running, paste this into your normal web browser's address bar and press Enter:

```
alt1://addapp/https://erikdekamps.github.io/quick-guide/appconfig.json
```

Alt1 asks if you want to add the app. Say yes. (Or open `https://erikdekamps.github.io/quick-guide/` in the Alt1
browser and press **Add app**.)

The app asks for one permission, **Overlay**, because Alt1 wants at least one. It draws nothing on the game.

## Your data

- Everything stays on your computer, in the browser's storage. There is no account.
- The app only talks to the RuneScape Wiki, and to Jagex when you look up your character.
- **Settings → Export state** saves your ticks and lists to a file. **Import state** brings them back.
- **Update from the wiki** (in Settings) brings in new quests, tasks and achievements. The app also does this once a week.

## Working on it

See [DEVELOPING.md](DEVELOPING.md): how it works, what it saves, and how it is tested and released.

## Credits

Built by **Claude**, Anthropic's AI, working in [Claude Code](https://claude.com/claude-code). The ideas, the testing in
the game and the screenshots came from the repository owner.

Guide text, pictures and map tiles come from the [RuneScape Wiki](https://runescape.wiki/) (CC BY-NC-SA 3.0).
Maps use [Leaflet](https://leafletjs.com/) (BSD-2 licence, see `vendor/leaflet/LICENSE`). The fonts are Cinzel, Fira Sans
and Fira Mono (SIL Open Font License, see `vendor/fonts/`); they come with the app.
