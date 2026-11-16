# Designs

Design mockups for Quick Guide, copied from the "Quest Guide Overlay" design canvas.
They look like the game's Hero window (Hero > Achievements): a bronze rim, a dark title band with the
name in gold capitals on the left, square bronze buttons, tabs on a bronze line (the open one lit in warm
brown), warm dark grey panels, bronze tick boxes with a gold tick, gold buttons and a gold scrollbar.
The Blue theme (Settings > Theme) is the same window in the game's earlier blue interface: steel blue rims and
panels, light blue buttons and ticks. The `…Blue` boards show it.

The screens are built from the real app (`style.css` and the app's own markup),
so they match it.

| File | What it shows |
| --- | --- |
| `Start.dc.html` | Start screen: the search box, a line that says how the list is set up, quests in optimal order, started ones first |
| `Areas.dc.html` | Area tasks tab: a row per tier (Ardougne Easy…) under its area, with a bar when started; done and locked tiers |
| `AreaSearch.dc.html` | Searching the area tasks: tasks are ticked in the results, with the area and tier under each |
| `Area.dc.html` | An area, Easy tier: what it needs (your levels, quests, items to bring) |
| `AreaTasks.dc.html` | An area's tasks (Varrock Elite): tick boxes, the tip under each task, steps like a quest |
| `ReadGame.dc.html` | Scan achievements (in Alt1, from the settings): pick a tier in the game and press Start |
| `Scanning.dc.html` | Scanning: the green bar with the tier it is on (1/52), the tasks in view, ◀ ▶ and Stop |
| `Backup.dc.html` | Export state: every quest and task as true or false, Download file, Copy |
| `Settings.dc.html` | The settings (cog), the same everywhere: your player, sort and filters, display, backup |
| `SettingsEnd.dc.html` | The bottom of the settings: Backup, and the Danger zone with Delete everything (after the first click) |
| `Overview.dc.html` | Overview tab: all parts open, the quest tree ticked, your skill levels |
| `Items.dc.html` | Items tab: Required and Recommended, with "Show done steps" on |
| `Main.dc.html` | Steps tab: every part and box open |
| `StartBlue.dc.html` | The start screen in the Blue theme |
| `SettingsBlue.dc.html` | The settings in the Blue theme, with Theme set to Blue |
| `MainBlue.dc.html` | Steps tab in the Blue theme |
| `AreaBlue.dc.html` | An area, Easy tier, in the Blue theme |
| `MyList….dc.html` (6 boards) | **Planned, not built yet:** the My list tab, adding a goal, a goal's menu, adding from an area, the empty list, and the Blue theme. Drawn by hand on the app's stylesheet. See `docs/my-list-plan.md` |
| `Components.dc.html` | All parts, colors and type, the two themes side by side, the app icon on both, and skill and quest requirements like the wiki |
| `Data.dc.html` | The quest JSON shape, and what is saved |
| `canvas.json` | Board layout on the canvas |

These files are made for the design canvas. Opened on their own in a browser, they may not look right.

## Screenshots

PNG pictures of each board are in `screenshots/`, at 2× size.

Skill icons come from the wiki. In the pictures, Mining, Smithing and Necromancy are the wiki's own icons; any other
skill shows a dashed square where its icon goes (the app and the boards load the real one from the wiki).
