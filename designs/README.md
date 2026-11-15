# Designs

Design mockups for Quick Guide, copied from the "Quest Guide Overlay" design canvas.
They use the brown RuneScape 3 window look: a bronze rim, a dark title band,
dark panels, gold buttons and a gold scrollbar.

The screens are built from the real app (`style.css` and the app's own markup),
so they match it.

| File | What it shows |
| --- | --- |
| `Start.dc.html` | Start screen: the search box, a line that says how the list is set up, quests in optimal order, started ones first |
| `Areas.dc.html` | Area tasks tab: a row per tier (Ardougne Easy…), started ones first, with a bar; done and locked tiers |
| `AreaSearch.dc.html` | Searching the area tasks: tasks are ticked in the results, with the area and tier under each |
| `Area.dc.html` | An area, Easy tier: what it needs (your levels, quests, items to bring) |
| `AreaTasks.dc.html` | An area's tasks (Varrock Elite): tick boxes, the tip under each task, steps like a quest |
| `ReadGame.dc.html` | Scan achievements (in Alt1, from the settings): start at Easy Ardougne and go through them all |
| `Scanning.dc.html` | Scanning: the green bar with the tier it is on (1 of 52), ◀ ▶ and Stop |
| `Backup.dc.html` | Export state: every quest and task as true or false, Download file, Copy |
| `Settings.dc.html` | The settings (cog), the same everywhere: your player, sort and filters, display, backup |
| `SettingsEnd.dc.html` | The bottom of the settings: Backup, and the Danger zone with Delete everything (after the first click) |
| `Overview.dc.html` | Overview tab: all parts open, the quest tree ticked, your skill levels |
| `Items.dc.html` | Items tab: Required and Recommended, with "Show done steps" on |
| `Main.dc.html` | Steps tab: every part and box open |
| `Components.dc.html` | All parts, colors and type |
| `Data.dc.html` | The quest JSON shape, and what is saved |
| `canvas.json` | Board layout on the canvas |

These files are made for the design canvas. Opened on their own in a browser, they may not look right.

## Screenshots

PNG pictures of each board are in `screenshots/`, at 2× size.
