# Plan: My list

A plan for a third list in Quick Guide: your own goals, to plan a day, a week or longer.
Nothing in this plan is built yet. The designs are in `designs/` (the `MyList…` boards) and
`designs/screenshots/`.

## What it is for

You pick what you want to get done, and the app keeps it in one place:

- **Unlocks:** "Unlock Soul Split", "Get the Ardougne cloak 3".
- **Skill goals:** "82 Thieving". The app knows your level and ticks the goal itself.
- **Item goals:** "500 Magic logs", with a counter you move up as you go.
- **Achievements:** one area task ("Yoink!") or a whole tier ("Ardougne Hard").
- **Quests:** "While Guthix Sleeps".
- **Anything else:** "Buy a Quest point cape", "Vis wax" every day.

Each goal sits under **Today**, **This week** or **Later**, so the list is a plan and not just a pile.

## Designs

| Board | What it shows |
| --- | --- |
| `MyList.dc.html` | The My list tab: the add box, then Today, This week, Later and Done, with every kind of goal |
| `MyListAdd.dc.html` | The "Add a goal" box, set to a skill goal |
| `MyListMenu.dc.html` | A goal's menu: edit, open on the wiki, move to another part, move up or down, remove |
| `MyListFrom.dc.html` | Adding from an area: a star on every task, "+ goal" next to a level you miss, and the "Added" message with Undo |
| `MyListEmpty.dc.html` | The empty list, which says how to add things |
| `MyListBlue.dc.html` | The tab in the Blue theme |

These six boards are drawn by hand on the app's own stylesheet, plus the new CSS listed under
[New CSS](#new-css). Once the feature is built they are made from the real app, like the other boards.

## How it works

### The tab

- The start screen gets a third tab: **Quests · Area tasks · My list**. The tab shows how many goals are open.
- `settings.home` gets a third value, `todo`. The tab, its scroll position and its folded parts are kept across
  a reload, like the other two (the `view` item already does this per place).
- Four parts that fold: **Today**, **This week**, **Later**, **Done**. Done starts folded. An empty part is left out.
- A line under the add box says how many goals there are and how many you did today.

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
- Ticking an **area task** on the list ticks it in its area too, and the other way round. It is one tick, shown twice.
- Clicking a quest, task or tier goal opens that quest or area. Clicking another goal does nothing; its ⋯ menu has
  "Open on the wiki" when the goal has a wiki page.
- A done goal moves to **Done**, with "Done today" (or the date). Done goals older than 30 days are deleted.

### Adding a goal

Three ways, so adding is one step wherever you are:

1. **The add box** at the top of the tab. Type and press Enter (or Add). The app reads what you typed:
   - "82 thieving" or "thieving 82" → a skill goal (the word is one of the 29 skills, the number is 2 to 120).
   - "500 magic logs" or "magic logs x500" → an item goal with a counter.
   - "unlock soul split" → an unlock.
   - anything else → an "Other" goal with that text.
   A new goal goes under **Today**. A message says what was added, with **Undo**.
2. **The star** on a quest (in the list and in its title band), on an area task, and on a tier row.
   A filled star means it is on your list; pressing it again takes it off.
3. **"+ goal"** next to a skill level you do not have yet (in a quest's skills, an area's needs, a task's needs).
   It adds that skill and level as a skill goal.

The **Add a goal** box (the button on the empty list, and "Edit" in a goal's menu) has every field:
what kind, the skill and level or the item and how many, when (Today, This week, Later),
again (Once, Every day, Every week) and a note.

### Planning: Today, This week, Later

- A goal is in one of the three parts. Its ⋯ menu moves it to another, and moves it up or down inside its part.
- **Today does not empty itself.** A goal you did not finish stays under Today the next day. The app does not
  guess what you still want to do.
- The game's day starts at 00:00 UTC, and its week on Wednesday 00:00 UTC. The app shows those in your own time
  ("Back tomorrow, 01:00").

### Goals that come back

For things you do every day or every week (Vis wax, Penguin Hide and Seek):

- A goal can be set to **Every day** or **Every week**. Its tag says Daily or Weekly.
- Ticking it greys it out where it is, with "Back tomorrow, 01:00" or "Back Wednesday, 01:00".
- At the game's reset it is unticked again. The app checks this when it starts, and once a minute while open.
- It never moves to Done.

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
  "items": [
    { "id": "t1a2b3", "kind": "skill", "skill": "thieving", "level": 82,
      "when": "today", "repeat": "", "note": "For the Ardougne Hard tasks", "at": 1794816000000 },
    { "id": "t4c5d6", "kind": "item", "title": "Magic logs", "have": 320, "want": 500, "when": "today", "at": 1794816100000 },
    { "id": "t7e8f9", "kind": "task", "area": "Ardougne", "task": "448", "title": "Yoink!", "when": "today", "at": 1794816200000 },
    { "id": "tabc12", "kind": "tier", "area": "Ardougne", "tier": "hard", "when": "week", "at": 1794816300000 },
    { "id": "tdef34", "kind": "quest", "title": "While Guthix Sleeps", "when": "week", "at": 1794816400000 },
    { "id": "t56789", "kind": "unlock", "title": "Soul Split", "note": "Needs The Temple at Senntisten", "when": "week", "at": 1794816500000 },
    { "id": "t0aa11", "kind": "other", "title": "Vis wax", "repeat": "day", "done": 1794787200000, "when": "today", "at": 1794816600000 }
  ]
}
```

- `kind`: `skill`, `item`, `task`, `tier`, `quest`, `unlock`, `other`.
- `when`: `today`, `week`, `later`. The order inside a part is the order in `items`.
- `done`: the time it was ticked, for goals you tick yourself. Goals that tick themselves have no `done` until
  the app first sees them finished; then it is set, so "Done today" and the 30 days work the same for all.
- `repeat`: `day`, `week`, or nothing.
- A task goal keeps the task's name too, so the row can be drawn before its area is read from the wiki.
- At most 200 goals. The item is small (about 150 bytes per goal), so it does not get in the way of saved guides.

### Export and import

The export file gets a `mylist` part, readable and editable like the rest:

```json
"mylist": {
  "Today": { "82 Thieving": false, "500 Magic logs": "320 / 500", "Yoink! (Ardougne Easy)": false, "Vis wax (every day)": true },
  "This week": { "While Guthix Sleeps": false, "Unlock: Soul Split": false, "Ardougne Hard": false },
  "Later": {}
}
```

- A line is read back the same way the add box reads what you type, so you can add goals by hand in the file.
- An import replaces the list when the file has a `mylist` part, and leaves it alone when it has none.
- Delete everything deletes the list too.

## Code

A new file, `app-todo.js`, loaded after `app-areas.js` (it needs quests and areas). The split follows the other files.

| Where | What |
| --- | --- |
| `app-todo.js` (new) | The list: load and save `todo`, `parseGoal(text)`, `goalState(item)` (done, progress and detail line for every kind), `todoHtml()`, the add box, the goal menu, the resets for daily and weekly goals, `starHtml(kind, ref)` and `toggleStar` |
| `app-core.js` | `HOMES` gets `['todo', 'My list']`; `homeHtml()` shows it; the tab's count; "+ goal" in `skillHtml` when a level is too low; `todo` in the list of saved items at the top |
| `app-quests.js` | A star in each quest row and in the quest's title band |
| `app-areas.js` | A star in each task row and each tier row; ticking a task redraws its goal |
| `app-backup.js` | `mylist` in the export and the import |
| `app.js` | The clicks: star, + goal, the add box, the goal menu, − and +, the tick box |
| `style.css` | The new CSS below, in both themes (it only uses the theme's colours) |
| `index.html` | The new script tag, and the cache number |

`goalState(item)` is the heart of it, and has no screen code in it, so it is easy to test:

```
goalState(item) -> { done, auto, have, want, detail, opens }
```

### New CSS

The classes the boards use, to be added to `style.css`:
`.todo` (the list), `.tsub` (the detail line), `.tag` and `.tag.rep` (kind and Daily/Weekly),
`.num` (the − count + of an item goal), `.star`, `.addgoal` ("+ goal"), `.seg` (the choice rows in the add box),
`.fld` (a field with its label), `.cb.auto` (a tick box that ticks itself), `.tab .tc` (the count on the tab).

## Build order

Each step is a pull request that works on its own, with its tests written first.

1. **The list, by hand.** The tab, the add box (only "Other" goals), tick, move between parts, move up and down,
   remove, Done, saved in `todo`, kept across a reload. Tests: add, tick, move, remove, reload, 200 goals, both themes.
2. **Goals with numbers.** Skill goals (tick themselves from the player) and item goals (− and +, type a number).
   The add box reads "82 thieving" and "500 magic logs". The full Add a goal box, and Edit.
   Tests: every way of typing a goal; a level reached after a player update ticks the goal.
3. **Stars.** On quests, area tasks and tiers; "+ goal" on a level you miss. Goals of those kinds tick themselves,
   and a task goal and its task share one tick. Tests: star and unstar everywhere; tick in the area, see it on the list;
   a scan that ticks a task finishes its goal.
4. **Goals that come back.** Every day and every week, with the game's reset times. Tests with a fake clock:
   before and after the daily reset, across a Wednesday, the app closed over a reset.
5. **Export and import**, Delete everything, the README, and the six boards made from the real app.

## Tests

A new `tests/todo.spec.js`, in the style of the others (the app in a 360 × 720 window, clicked like a person would):

- **Adding:** each way of typing a goal gives the right kind; nonsense becomes an "Other" goal; an empty box adds nothing;
  Undo takes it off again.
- **Each kind:** its row, its tag, its detail line, its bar, and when it ticks itself.
- **One tick, two places:** an area task on the list and in its area.
- **Planning:** move to another part, move up and down, the order after a reload.
- **Coming back:** daily and weekly resets with a fake clock, in two time zones.
- **Limits:** 200 goals; long names wrap; a 280 px window does not scroll sideways.
- **Storage:** what `todo` holds; broken `todo` data does not stop the app; storage full keeps the list (it is never dropped
  to make room, like ticks).
- **Export and import:** out and back in gives the same list; a goal added by hand in the file.
- **Coverage:** `app-todo.js` at 100% of its lines, like the other files.

## Later, not in the first version

- **Item names from the wiki:** suggestions while you type an item, with its icon and a link.
- **Counting items by itself:** not possible from the game's data; a bank or inventory reader in Alt1 would be a
  feature of its own.
- **"What can I do now?":** only show goals you have the levels and quests for.
- **A goal that needs another:** "82 Thieving" under "Ardougne Hard", ticked off as a group.
- **Dragging** rows to sort them (the menu's Move up and Move down do the same for now).

## Questions for you

My pick is first each time; say so if you want the other.

1. **Unfinished goals under Today:** stay under Today (my pick, described above), or move back to This week at the
   game's daily reset?
2. **The Done part:** keep done goals for 30 days (my pick), or only until the next day?
