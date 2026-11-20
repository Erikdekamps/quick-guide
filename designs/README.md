# Designs

Design mockups for Quick Guide, copied from the "Quest Guide Overlay" design canvas.
They look like the game's Hero window (Hero > Achievements): a bronze rim, a dark title band with the
name in gold capitals on the left, square bronze buttons, tabs on a bronze line (the open one lit in warm
brown), warm dark grey panels, bronze tick boxes with a gold tick, gold buttons and a gold scrollbar.
The Blue theme (Settings > Theme) is the same window in the game's earlier blue interface: steel blue rims and
panels, light blue buttons and ticks. The `…Blue` boards show it: every main screen has one.

Every screen has the same frame:

- **The title band** on top. On the start screen and in Settings: the app's emblem and the name. In a quest, an
  area or a cape: the back button, the name of what is open and its **⋯** menu.
- In a quest, an area or a cape, **a thin gold line** right under the band shows the progress, and **one row of tabs**
  has the counts under their names (Steps 10 / 118, Items 4 / 26, each tier its own tasks, each category its achievements).
- **The bar at the bottom**: Quests, Achievements, My list and Settings, on every screen. The one you are in is lit in gold.
  Settings is a screen of its own; the button of the screen you came from takes you back.

The screens are built from the real app (`style.css` and the app's own markup),
so they match it.

The boards (`.dc.html`) and `canvas.json` are in `canvas/`. Their pictures are in `screenshots/`.

| File in `canvas/` | What it shows |
| --- | --- |
| `Start.dc.html` | Start screen: the search box, a line that says how the list is set up, quests in optimal order, started ones first |
| `Areas.dc.html` | Achievements: the Capes on top, a card each (how far you are, and where to go on), then a row per tier (Ardougne Easy…) under its area |
| `AreaSearch.dc.html` | Searching the area tasks: tasks are ticked in the results, with the area and tier under each |
| `Area.dc.html` | An area, Easy tier: what it needs (your levels, quests, items to bring) |
| `AreaTasks.dc.html` | An area's tasks (Varrock Elite): tick boxes, the tip under each task, steps like a quest |
| `CapeMasterQuest.dc.html` | The master quest cape: a tab per category with its count, the cape and where to buy it, Needs with your levels (three too low) |
| `CapeCompletionist.dc.html` | The completionist cape, Skills: a part per big subcategory (Slayer, Necromancy…), the next achievement lit; a level too low has a red ✗ and + goal |
| `CapeTrimmed.dc.html` | The trimmed completionist cape, Other: the other two capes tick their own lines, with Open it |
| `CapeAchievements.dc.html` | A cape's achievements, like area tasks: what each needs (your levels ✓ or ✗, quests), the wiki's tip, and a ⋯ |
| `CapeMenu.dc.html` | An achievement's ⋯ menu: Add to list…, Open on the wiki |
| `CapeAddTo.dc.html` | The Add to list box for an achievement: "Advanced Sweeping · Master quest cape" |
| `MyListCheevo.dc.html` | Achievements on My list: a goal's menu opens its cape, or its page on the wiki |
| `Backup.dc.html` | Export state: every quest and task as true or false, Download file, Copy |
| `Settings.dc.html` | Settings (the last button of the bar): your player, Show (a tick means you see them), the sort, display, backup, the danger zone |
| `SettingsEnd.dc.html` | Settings scrolled down, with Delete everything after the first click: "Click again to delete everything" |
| `Overview.dc.html` | Overview tab: all parts open, the quest tree ticked, your skill levels |
| `Items.dc.html` | Items tab: Required and Recommended, with "Done steps and tasks" ticked |
| `Main.dc.html` | Steps tab: every part and box open |
| `StartBlue.dc.html` | The start screen in the Blue theme |
| `SettingsBlue.dc.html` | Settings in the Blue theme, with Theme set to Blue |
| `MainBlue.dc.html` | Steps tab in the Blue theme |
| `OverviewBlue.dc.html` | Overview tab in the Blue theme |
| `ItemsBlue.dc.html` | Items tab in the Blue theme |
| `AreasBlue.dc.html` | Achievements in the Blue theme |
| `AreaBlue.dc.html` | An area, Easy tier, in the Blue theme |
| `AreaTasksBlue.dc.html` | An area's tasks (Varrock Elite) in the Blue theme |
| `MyList.dc.html` | My list: your lists (Today, Skilling goals, Gathering, and a folded one) with flat goals, one with sub tasks two deep; each list ends with the box for the next goal |
| `MyListType.dc.html` | Typing the next goal in the box at the end of a list |
| `MyListNew.dc.html` | Create list: type a name |
| `MyListImport.dc.html` | Import list: a name, and the goals as plain text; it makes a new list from them |
| `MyListLists.dc.html` | A list's menu: add a goal here, paste a list, copy as text, rename, move the list, clear done goals, delete the list |
| `MyListPaste.dc.html` | Paste a list: goals as plain text, one on each line, indented lines as sub tasks; the box says what it reads |
| `MyListCopy.dc.html` | Copy as text: the list in the same form, to copy |
| `MyListSub.dc.html` | Adding sub tasks to a goal: the box under it, for one after the other |
| `MyListSubMenu.dc.html` | A sub task's menu: edit, add a sub task, open on the wiki, move up, down or out a level, delete |
| `MyListToList.dc.html` | A goal made into a list: its sub tasks are the goals, with Undo |
| `MyListAdd.dc.html` | The Add a goal box (a list's menu → Add a goal here): the goal, the list, its parent, a note |
| `MyListMenu.dc.html` | A goal's menu: edit, add a sub task, make it a list, open on the wiki, move to another list (or a new one), move up or down, remove |
| `MyListFrom.dc.html` | An area task's ⋯ menu: Add to list… |
| `MyListAddTo.dc.html` | The Add to list box: which list, with a dropdown (or a new list), and its parent: none, or a goal or a sub task of the list |
| `MyListQuest.dc.html` | A quest's ⋯ menu, next to its name in the title band: Jump to next step, then Add to list… |
| `MyListEmpty.dc.html` | My list with no lists yet: how to start, with Create list and Import list |
| `MyListBlue.dc.html` | My list in the Blue theme |
| `CapeMasterQuestBlue.dc.html` | The master quest cape in the Blue theme, with Needs folded: its achievements |
| `Components.dc.html` | All parts, colors and type, the window, the two themes, the bar at the bottom, tabs with a count, the settings and the quest menu, the app icon on both, skill and quest requirements like the wiki, the parts of My list, and Add to list |
| `Data.dc.html` | The quest JSON shape, what is saved (the capes and My list too), and the export file |
| `canvas.json` | Board layout on the canvas: the screens in rows of seven on the left (quests and settings, achievements, the capes, My list twice, the Blue theme in two), Components and Data next to them |

These files are made for the design canvas. Opened on their own in a browser, they may not look right.

## Screenshots

PNG pictures of each board are in `screenshots/`, at 2× size.

Skill icons and the capes' pictures come from the wiki, in the pictures too.
