# Plan: My list

The plan for the third tab in Quick Guide: your own lists of goals.
**It is built** (`js/app/todo-data.js`, `todo-view.js` and `todo.js`, tested in `tests/todo.spec.js`). The README's "My list" part says how to use it.
The designs are in `designs/` (the `MyList…` boards) and `designs/screenshots/`, made from the real app.

## Changed after the first build

- **No stars.** An area task has a ⋯ menu with **Add to list…**; a quest's and an area's own menu have it too.
  It opens a box with a dropdown of your lists (or a new list). "+ goal" opens the same box. So "Change list" in the
  message is gone: you pick the list first.
- **Flat goals.** A goal is a tick box, what it says, and its menu. No tag for its kind, no detail line, no bar, and
  no counter: "500 Magic logs" is a goal you tick, as you typed it. Items and unlocks are no kinds of their own any
  more (saved ones become plain goals).
- **Any goal can be ticked by hand.** Skill levels, quests and tiers also tick themselves. A quest ticked on a list is
  done in the quest list too (one tick, shown in two places, like an area task).
- **Sub tasks:** a goal can have its own checklist under it, and a sub task its own, four deep (at most 20 in one
  place). Each is done when all under it are; ticking one ticks all under it. A sub task has a ⋯ menu: edit, add a
  sub task, move up, down or out a level, delete (two clicks).
- **The box at the end of each list** takes the next goal (Enter, and type another); the add box at the top of the
  tab is gone. "Add sub task" opens the same kind of box under the goal.
- **Make it a list:** a goal you wrote yourself becomes a list with its name; its sub tasks are the goals.
- **Open on the wiki:** goals and sub tasks you wrote yourself are looked up on the wiki once (as typed, with small
  letters, and without a number or a word like "Buy a" in front); the page's name is kept in `wiki`.
- **The code is in `js/`:** `js/app` (the app, with My list in three files), `js/wiki` (reading the wiki) and
  `js/game` (reading the game).
- **A done goal stays where it is**, struck through, until you clear it: it no longer drops to the bottom of its
  list (the next goal would move under your mouse).
- **Repeat:** Never, Daily, Weekly or Monthly. The monthly reset is the 1st of the month, 00:00 UTC. In a file a goal
  that repeats ends in " (daily)", " (weekly)" or " (monthly)"; the older " (every day)" still reads.
- **The title band** (the emblem, Quick Guide, the cog) is on every screen. On a quest or an area, the back button,
  the name and its ⋯ menu are in a bar under it.

The rest of this plan is as it was written before the build.

## What it is for

You make your own lists and put in what you want to get done. A list can be anything:
**Today**, **This week**, **Skilling goals**, **Gathering**, **Ardougne diary**, **Unlocks**.

What can go in a list:

- **Unlocks:** "Unlock Soul Split", "Get the Ardougne cloak 3".
- **Skill goals:** "82 Thieving". The app knows your level and ticks the goal itself.
- **Item goals:** "500 Magic logs", with a counter you move up as you go.
- **Achievements:** one area (diary) task like "Yoink!", or a whole tier like "Ardougne Hard".
- **Quests:** "While Guthix Sleeps".
- **Anything else:** "Buy a Quest point cape", "Vis wax" every day.

## Designs

| Board | What it shows |
| --- | --- |
| `MyList.dc.html` | The My list tab: the add box, then your lists (Today, Skilling goals, Gathering, and a folded one), with every kind of goal |
| `MyListNew.dc.html` | The "New list" box: type a name |
| `MyListLists.dc.html` | A list's menu: add a goal here, rename, move the list up or down, clear done goals, delete the list |
| `MyListAdd.dc.html` | The "Add a goal" box, set to a skill goal, with the list it goes in |
| `MyListMenu.dc.html` | A goal's menu: edit, open, move to another list (or a new one), move up or down, remove |
| `MyListFrom.dc.html` | Adding from an area: a star on every task, "+ goal" next to a level you miss, and the "Added to Today" message with Change list and Undo |
| `MyListEmpty.dc.html` | No lists yet: it says how to start |
| `MyListBlue.dc.html` | The tab in the Blue theme |

These eight boards are made from the real app, like the other boards.

## How it works

### The tab

- The start screen gets a third tab: **Quests · Area tasks · My list**. The tab shows how many goals are open.
- `settings.home` gets a third value, `todo`. The tab, its scroll position and its folded lists are kept across
  a reload, like the other two (the `view` item already does this per place).
- A line under the add box says how many lists and goals there are, and how many are done.

### Lists

- A list has a name you choose and holds goals. Its bar shows the name and "1 / 4" (done / all), and folds the list.
- **New list** (the button under the lists) asks for a name, and offers a few to start from:
  Today, This week, Skilling goals, Gathering, Unlocks. Those are only names: the app treats every list the same.
- A list's ⋯ menu: **Add a goal here**, **Rename**, **Move list up / down**, **Clear done goals**, **Delete list**.
  Deleting a list with goals in it takes two clicks, like Reset progress.
- Two lists cannot have the same name. A name is at most 30 letters.
- A goal is in one list. Its menu moves it to another list, or to a new one.
- With no lists yet, the first goal you add makes a list called **My list**.

### A goal's row

Every row has a tick box, the goal, a small tag with its kind, one line of detail, and a ⋯ button.
A goal with a number also has a progress bar.

| Kind | Tag | Detail line | Ticks itself? |
| --- | --- | --- | --- |
| Skill goal | Skill | "Now 79 · 3 levels to go", with the skill's icon | Yes, from your character's levels |
| Item goal | Item | "180 to go", with − and + and the count "320 / 500" | When the count reaches the target |
| Area task | Task | "Ardougne Easy" | Yes, when the task is ticked (by you, or by Scan achievements) |
| Area tier | Tier | "9 / 17 tasks" | Yes, when every task of the tier is ticked |
| Quest | Quest | "10 / 118 steps", or "Started" | Yes, when the quest is done (your ticks, or the game) |
| Unlock | Unlock | Your note | No, you tick it |
| Other | Goal | Your note | No, you tick it |

- A goal that ticks itself has a greyed tick box: you cannot tick it by hand, only remove it.
- Ticking an **area task** in a list ticks it in its area too, and the other way round. It is one tick, shown twice.
- Clicking a quest, task or tier goal opens that quest or area. Another goal's ⋯ menu has "Open on the wiki" when
  the goal has a wiki page.
- A done goal stays in its list, at the bottom, struck through. **Clear done goals** in the list's menu removes them.

### Adding a goal

Three ways, so adding is one step wherever you are:

1. **The add box** at the top of the tab, with the list it goes in next to it (the list you used last).
   Type and press Enter (or Add). The app reads what you typed:
   - "82 thieving" or "thieving 82" → a skill goal (the word is one of the 29 skills, the number is 2 to 120).
   - "500 magic logs" or "magic logs x500" → an item goal with a counter.
   - "unlock soul split" → an unlock.
   - anything else → an "Other" goal with that text.
2. **The star** on a quest (in the list and in its title band), on an area task, and on a tier row.
   A filled star means it is in one of your lists; pressing it again takes it out.
3. **"+ goal"** next to a skill level you do not have yet (in a quest's skills, an area's needs, a task's needs).
   It adds that skill and level as a skill goal.

A star and "+ goal" put the goal in the list you used last. A message says which ("Added to **Today**"), with
**Change list** and **Undo**.

The **Add a goal** box ("Add a goal here" in a list's menu, and "Edit" in a goal's menu) has every field:
what kind, the skill and level or the item and how many, the list, again (Once, Every day, Every week) and a note.

### Goals that come back

For things you do every day or every week (Vis wax, Penguin Hide and Seek):

- A goal can be set to **Every day** or **Every week**. Its tag says Daily or Weekly.
- Ticking it greys it out where it is, with "Back tomorrow, 01:00" or "Back Wednesday, 01:00".
- At the game's reset it is unticked again: 00:00 UTC each day, and Wednesday 00:00 UTC each week, shown in your
  own time. The app checks this when it starts, and once a minute while open.
- Clear done goals leaves it alone.

### What the app already knows

No new lookups are needed for the first version:

- **Levels and quests done:** the player lookup (`S.player`).
- **Area tasks and tiers:** your ticks (`aprog.<area>`), set by hand or by Scan achievements.
- **Quest steps:** your ticks (`prog.<page>`, `meta`).
- **Skill icons:** the wiki's, as in the skill lists.

## Data

One new item in local storage, `todo`:

```json
{
  "v": 1,
  "last": "l1",
  "lists": [
    { "id": "l1", "name": "Today", "items": [
      { "id": "t7e8f9", "kind": "task", "area": "Ardougne", "tier": "easy", "tname": "Easy", "task": "448", "title": "Yoink!", "at": 1794816200000 },
      { "id": "t0aa11", "kind": "other", "title": "Vis wax", "repeat": "day", "done": 1794787200000, "upd": 1794787200000, "at": 1794816600000 },
      { "id": "t56789", "kind": "unlock", "title": "Soul Split", "note": "Needs The Temple at Senntisten", "at": 1794816500000 }
    ] },
    { "id": "l2", "name": "Skilling goals", "items": [
      { "id": "t1a2b3", "kind": "skill", "skill": "thieving", "level": 82, "note": "For the Ardougne Hard tasks", "at": 1794816000000 }
    ] },
    { "id": "l3", "name": "Gathering", "items": [
      { "id": "t4c5d6", "kind": "item", "title": "Magic logs", "have": 320, "want": 500, "at": 1794816100000 }
    ] }
  ]
}
```

- `lists` is in the order you see them; `items` is in the order of the list. `last` is the list you added to last.
- `kind`: `skill`, `item`, `task`, `tier`, `quest`, `unlock`, `other`.
- `done`: the time it was ticked. Goals that tick themselves get it when the app first sees them finished,
  so done goals sort the same way for every kind.
- `repeat`: `day`, `week`, or nothing (only for items, unlocks and other goals). `upd`: when a goal that comes back
  last changed, so the app knows which reset it belongs to.
- A task goal keeps the task's name too, so the row can be drawn before its area is read from the wiki.
- At most 30 lists and 300 goals in all. The item is small (about 150 bytes per goal), so it does not get in the way
  of saved guides, and it is never dropped to make room.
- Which lists are folded is kept in `view.closed`, like the folded groups of the other tabs.

### Export and import

The export file gets a `mylist` part, one entry per list, readable and editable like the rest:

```json
"mylist": {
  "Today": { "Task 448: Yoink! (Ardougne Easy)": false, "Vis wax (every day)": true, "Unlock: Soul Split": { "done": false, "note": "Needs The Temple at Senntisten" } },
  "Skilling goals": { "82 Thieving": false, "Quest: While Guthix Sleeps": false, "Tier: Ardougne Hard": false },
  "Gathering": { "500 Magic logs": "320 / 500" }
}
```

- A line is read back the same way the add box reads what you type, so you can add goals and lists by hand in the file.
- An import replaces your lists when the file has a `mylist` part, and leaves them alone when it has none.
- Delete everything deletes the lists too.

## Code

A new file, `app-todo.js`, loaded after `app-areas.js` (it needs quests and areas). The split follows the other files.

| Where | What |
| --- | --- |
| `app-todo.js` (new) | The lists: load and save `todo`; lists (new, rename, move, delete, clear done); `parseGoal(text)`; `goalState(item)` (done, progress and detail line for every kind); `todoHtml()`; the add box, the two menus and the two boxes; the resets for daily and weekly goals; `starHtml(kind, ref)` and `toggleStar` |
| `app-core.js` | `HOMES` gets `['todo', 'My list']`; `homeHtml()` shows it; the tab's count; "+ goal" in `skillHtml` when a level is too low; `todo` in the list of saved items at the top |
| `app-quests.js` | A star in each quest row and in the quest's title band |
| `app-areas.js` | A star in each task row and each tier row; ticking a task redraws its goal |
| `app-backup.js` | `mylist` in the export and the import |
| `app.js` | The clicks: star, + goal, the add box, the menus, − and +, the tick box |
| `style.css` | The new CSS below, in both themes (it only uses the theme's colours) |
| `index.html` | The new script tag, and the cache number |

`goalState(item)` is the heart of it, and has no screen code in it, so it is easy to test:

```
goalState(item) -> { done, auto, have, want, detail, opens }
```

### New CSS

The classes the boards use, to be added to `style.css`:
`.todo` (a list's goals), `.tsub` (the detail line), `.tag` and `.tag.rep` (kind and Daily/Weekly),
`.num` (the − count + of an item goal), `.star`, `.addgoal` ("+ goal"), `.seg` (the choice rows in the add box),
`.fld` (a field with its label), `.cb.auto` (a tick box that ticks itself), `.tab .tc` (the count on the tab),
`.gh.lh` (a list's bar with its menu button), `.newlist` (the New list button).

## Build order

It was built in one pull request, in this order, with its tests written first.

1. **Lists and plain goals.** The tab; new, rename, move, delete a list; the add box (only "Other" goals) with its
   list; tick, move to another list, move up and down, remove, clear done; saved in `todo`, kept across a reload.
   Tests: all of those, the limits, both themes.
2. **Goals with numbers.** Skill goals (tick themselves from the player) and item goals (− and +, type a number).
   The add box reads "82 thieving" and "500 magic logs". The full Add a goal box, and Edit.
   Tests: every way of typing a goal; a level reached after a player update ticks the goal.
3. **Stars.** On quests, area tasks and tiers; "+ goal" on a level you miss; Change list and Undo in the message.
   Goals of those kinds tick themselves, and a task goal and its task share one tick.
   Tests: star and unstar everywhere; tick in the area, see it in the list; a scan that ticks a task finishes its goal.
4. **Goals that come back.** Every day and every week, with the game's reset times. Tests with a fake clock:
   before and after the daily reset, across a Wednesday, the app closed over a reset.
5. **Export and import**, Delete everything, the README, and the eight boards made from the real app.

## Tests

A new `tests/todo.spec.js`, in the style of the others (the app in a 360 × 720 window, clicked like a person would):

- **Lists:** make one (typed, and from a suggestion), rename, the same name twice is refused, move up and down,
  fold, delete (two clicks when it has goals), the order after a reload.
- **Adding:** each way of typing a goal gives the right kind; nonsense becomes an "Other" goal; an empty box adds nothing;
  the goal lands in the chosen list; Undo takes it out again; Change list moves it.
- **Each kind:** its row, its tag, its detail line, its bar, and when it ticks itself.
- **One tick, two places:** an area task in a list and in its area.
- **Moving:** to another list, to a new list, up and down.
- **Done:** done goals sink to the bottom; Clear done goals removes them and leaves daily and weekly ones.
- **Coming back:** daily and weekly resets with a fake clock, in two time zones.
- **Limits:** 30 lists, 300 goals; long names wrap; a 280 px window does not scroll sideways.
- **Storage:** what `todo` holds; broken `todo` data does not stop the app; storage full keeps the lists.
- **Export and import:** out and back in gives the same lists; a list and a goal added by hand in the file.
- **Coverage:** `app-todo.js` at 100% of its lines, like the other files.

## Later, not in the first version

- **Item names from the wiki:** suggestions while you type an item, with its icon and a link.
- **Counting items by itself:** not possible from the game's data; a bank or inventory reader in Alt1 would be a
  feature of its own.
- **"What can I do now?":** only show goals you have the levels and quests for.
- **A goal that needs another:** "82 Thieving" under "Ardougne Hard", ticked off as a group.
- **Dragging** goals and lists to sort them (the menus' Move up and Move down do the same for now).
- **A list that empties itself:** a "Today" that clears at the game's daily reset.

## Questions

Built with the first answer to each; the other is easy to add later.

1. **A goal in more than one list:** no, one list each (simpler, and a star is either on or off), or yes?
2. **Done goals:** stay in their list until you clear them, or disappear by themselves the next day?
