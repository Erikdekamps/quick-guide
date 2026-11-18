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
| `MyListAdd.dc.html` | The Add a goal box (a list's menu → Add a goal here): the goal, the list, how often, a note |
| `MyListMenu.dc.html` | A goal's menu: edit, add a sub task, make it a list, open on the wiki, move to another list (or a new one), move up or down, remove |
| `MyListFrom.dc.html` | An area task's ⋯ menu: Add to list… |
| `MyListAddTo.dc.html` | The Add to list box: which list, with a dropdown (or a new list), and its parent: none, or a goal or a sub task of the list |
| `MyListQuest.dc.html` | A quest's ⋯ menu, next to its name under the title band: Add to list… first |
| `MyListEmpty.dc.html` | My list with no lists yet: how to start, with Create list and Import list |
| `MyListBlue.dc.html` | My list in the Blue theme |
| `Components.dc.html` | All parts, colors and type, the two themes side by side, the app icon on both, skill and quest requirements like the wiki, the parts of My list, and Add to list |
| `Data.dc.html` | The quest JSON shape, what is saved (My list too), and the export file |
| `canvas.json` | Board layout on the canvas: the screens in five rows of seven on the left (quests and settings, area tasks, My list twice, the Blue theme), Components and Data next to them |

These files are made for the design canvas. Opened on their own in a browser, they may not look right.

## Screenshots

PNG pictures of each board are in `screenshots/`, at 2× size.

Skill icons come from the wiki, in the pictures too.
