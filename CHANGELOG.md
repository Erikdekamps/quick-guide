# Changelog

What changed in each version of Quick Guide. The newest is on top. Settings shows the version you have.

The version is three numbers, MAJOR.MINOR.PATCH ([semantic versioning](https://semver.org/)):

- **MAJOR** goes up when saved data or the export file changes so that old ones no longer work as before.
- **MINOR** goes up for something new you can see or do.
- **PATCH** goes up for a fix, or a change you do not see.

## [Unreleased]

## [1.43.2] - 2026-11-21

### Fixed

- A link in a guide to a wiki page called "WARNING", or one with "()" in its name, keeps its address. A warning in a list of things to bring is marked once, not twice.
- A guide, an area or a cape that is read again while the Add to list box or a My list menu is open waits with drawing until you close it, so what you typed stays.
- Forget this player while the character is looked up: it stays forgotten. Before, the answer brought it back.
- Delete everything starts the app again, so nothing of before is left and an answer that was still on its way is not saved after all.

## [1.43.1] - 2026-11-21

### Fixed

- When the storage is full and nothing is left to drop, the app says that your change is not saved, and keeps it until you close the app. Before, it was lost without a word.
- A task, an achievement or a quest on a list, ticked in its own screen, is no longer unticked there when it has a sub task that is still open.
- A list called "Constructor" is no longer lost after a reload, and "82 constructor" is a goal like any other.
- An import with a mistake in its lists says what is wrong and leaves your lists. Before, it could empty them.
- A quest, an area or a cape that is still being read no longer opens over the screen you went to. It is saved, and opens at once when you click it again.
- A saved guide, area or cape that is broken no longer stops the app at every start. It is dropped and read from the wiki again; your ticks stay.
- A read from the wiki that starts and never ends is cut off after its time, so it cannot block the ones after it.
- When the wiki is busy, or the connection drops, the app asks once more after a moment. Before, a group of achievements could lose what they need without a word.
- A cape keeps its levels, and what each achievement needs, when the wiki cannot give them during an update. The next update reads them again.
- A quest guide whose page got another name on the wiki is no longer kept twice. Your ticks go with it to the new name.

## [1.43.0] - 2026-11-21

### Added

- Settings shows the app's version at the bottom.

### Changed

- For people who work on the app: one version number for everything (`npm run bump`), this list, and a release on
  GitHub for each version. Every pull request runs its checks one after the other, and a failed one stops the rest:
  code check, security check, unit tests (seconds, no browser), the app in the browser with a coverage check, and
  the real wiki when the reader changed. Any error in the page fails a test.

### Fixed

- For people who work on the app: the weekly check against the real wiki passes again. It still expected long tips
  to become steps, which they no longer do since 1.29.0.

## [1.42.0] - 2026-11-21

### Added

- Update from the wiki, in Settings: one button checks every quest, area and cape you have, and reads again only the
  pages that changed. It also runs by itself once a week. What is new says "New" for a while.
  ([#45](https://github.com/Erikdekamps/quick-guide/pull/45))

### Fixed

- The reader takes comments and line breaks out of wiki text completely, also when they are nested.

## [1.41.0] - 2026-11-20

### Added

- Achievements: the master quest, completionist and trimmed completionist capes. Each achievement shows what it
  needs (a red ✗ when you do not have it yet) and the wiki's tip, and can go on My list.
  ([#44](https://github.com/Erikdekamps/quick-guide/pull/44))

## [1.40.0] - 2026-11-20

### Changed

- A new look: one title band, counts in the tabs, and a bar at the bottom with Settings.
  ([#43](https://github.com/Erikdekamps/quick-guide/pull/43))

## [1.39.0] - 2026-11-18

### Removed

- Scan achievements, repeating goals in My list, and the My list plan. ([#40](https://github.com/Erikdekamps/quick-guide/pull/40))

## [1.38.0] - 2026-11-17

### Added

- My list: paste a list as plain text, and copy a list as text. ([#38](https://github.com/Erikdekamps/quick-guide/pull/38))

## [1.37.0] - 2026-11-17

### Added

- My list: sub tasks in sub tasks, a menu for each sub task, a goal can become a list, wiki links, and a box in each
  list. ([#35](https://github.com/Erikdekamps/quick-guide/pull/35))

## [1.36.0] - 2026-11-16

### Added

- My list: sub tasks under a goal. ([#34](https://github.com/Erikdekamps/quick-guide/pull/34))

## [1.35.0] - 2026-11-16

### Added

- My list: your own lists of goals. The title band is on every screen. ([#33](https://github.com/Erikdekamps/quick-guide/pull/33))

## [1.34.0] - 2026-11-16

### Changed

- A reload shows the same view: the screen, tab, tier, scroll, search and folded parts. ([#32](https://github.com/Erikdekamps/quick-guide/pull/32))

## [1.33.0] - 2026-11-16

### Security

- No tags are taken out of wiki HTML with a pattern any more. ([#31](https://github.com/Erikdekamps/quick-guide/pull/31))

## [1.32.0] - 2026-11-15

### Changed

- Player lookup asks Jagex's Player Data API first, and the older lookup when that fails. ([#28](https://github.com/Erikdekamps/quick-guide/pull/28))

## [1.31.0] - 2026-11-15

### Added

- The blue theme, and a new app icon. The app is split into files. ([#27](https://github.com/Erikdekamps/quick-guide/pull/27))

## [1.29.0] - 2026-11-15

### Changed

- Export: tips are no tick boxes, every quest the game counts is in it, with tier counts and the whole step text.
  ([#26](https://github.com/Erikdekamps/quick-guide/pull/26))

## [1.28.0] - 2026-11-15

### Changed

- Scan works in every area, and knows all 52 tiers by name. ([#25](https://github.com/Erikdekamps/quick-guide/pull/25))

## [1.27.0] - 2026-11-15

### Fixed

- Scan: the window's gold edge and rocks are not taken for the scrollbar. ([#24](https://github.com/Erikdekamps/quick-guide/pull/24))

## [1.26.0] - 2026-11-15

### Fixed

- Scan: the chat no longer fools it. ([#23](https://github.com/Erikdekamps/quick-guide/pull/23))

## [1.25.0] - 2026-11-15

### Changed

- Scan works on big screens. Requirements look like the wiki's. ([#22](https://github.com/Erikdekamps/quick-guide/pull/22))

## [1.24.0] - 2026-11-15

### Changed

- Skill levels look like the wiki's. Scan remembers tier names and does not get stuck. ([#21](https://github.com/Erikdekamps/quick-guide/pull/21))

## [1.23.0] - 2026-11-15

### Fixed

- Scan reads Elite Desert right, finds locked tasks, and never shifts rows by one. ([#20](https://github.com/Erikdekamps/quick-guide/pull/20))

## [1.22.0] - 2026-11-15

### Changed

- Scan finds the tier by itself and keeps its place. Area tiers stay in their area. ([#19](https://github.com/Erikdekamps/quick-guide/pull/19))

## [1.21.0] - 2026-11-15

### Fixed

- Scan keeps its place while you scroll, and when nothing moves. ([#18](https://github.com/Erikdekamps/quick-guide/pull/18))

## [1.20.0] - 2026-11-15

### Changed

- Scan reads the tier you picked in the game, and is fast. ([#17](https://github.com/Erikdekamps/quick-guide/pull/17))

## [1.19.0] - 2026-11-15

### Added

- Scan achievements: one scan from Settings, through every tier. ([#16](https://github.com/Erikdekamps/quick-guide/pull/16))

## [1.18.0] - 2026-11-15

### Added

- Read from the game: tick area tasks from the in-game Achievements list. ([#15](https://github.com/Erikdekamps/quick-guide/pull/15))

## [1.13.0] - 2026-11-14

### Fixed

- Area tasks work on a phone. ([#14](https://github.com/Erikdekamps/quick-guide/pull/14))

## [1.12.0] - 2026-11-14

### Added

- Danger zone: Delete everything. Older saved areas open at once. ([#13](https://github.com/Erikdekamps/quick-guide/pull/13))

## [1.11.0] - 2026-11-14

### Changed

- Export makes a file you can change, with every quest and task. Long task text becomes steps. ([#12](https://github.com/Erikdekamps/quick-guide/pull/12))

## [1.10.0] - 2026-11-14

### Added

- Area tasks per tier, task search and steps. Export and import. ([#11](https://github.com/Erikdekamps/quick-guide/pull/11))

## [1.8.0] - 2026-11-14

### Added

- Area Tasks, and clearer list switches. ([#10](https://github.com/Erikdekamps/quick-guide/pull/10))

## [1.6.0] - 2026-11-14

### Added

- A Settings menu, miniquests, locked quests, quest links that open in the app, and neat League rows.
  ([#9](https://github.com/Erikdekamps/quick-guide/pull/9))

## [1.4.0] - 2026-11-14

### Added

- The optimal quest order, and hiding done quests. Everything is open at the start. ([#8](https://github.com/Erikdekamps/quick-guide/pull/8))

## [1.3.0] - 2026-11-14

### Added

- Player lookup: the quests you did in the game, and your skill levels. ([#7](https://github.com/Erikdekamps/quick-guide/pull/7))

## [1.2.1] - 2026-11-14

### Fixed

- Three bugs that the first tests found. ([#5](https://github.com/Erikdekamps/quick-guide/pull/5))

## [1.2.0] - 2026-11-14

### Added

- The Items tab, open Overview parts, and the brown RuneScape 3 look. ([#4](https://github.com/Erikdekamps/quick-guide/pull/4))

## [1.1.0] - 2026-11-14

### Added

- The app is ready for Alt1, on GitHub Pages. ([#3](https://github.com/Erikdekamps/quick-guide/pull/3))
