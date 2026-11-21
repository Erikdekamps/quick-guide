# Rules for Claude

Quick Guide is plain files in the browser: no build step, and no npm packages in the app. README.md says how it works.

## Before every push

- Run `npm run lint` and `npm test` (the unit tests run first); everything must pass.
- When the app changed, run `npm run check:version -- origin/main`.
- Never commit local changes to playwright.config.js (like a Chromium path).

## Git and pull requests

- Before pushing, check the branch's pull request is still open; if it was merged, start a new branch from main and open a new PR.
- Never force-push or rewrite pushed history; fix things in new commits on top.
- Look at main with git fetch and git log/diff; never check out origin/main itself.
- No Claude session links in commits or pull request text; commits end with only the Co-Authored-By line.
- Fill in the pull request template (.github/pull_request_template.md).

## Versions

- A change to the app (index.html, style.css, appconfig.json, icon.svg, icon.png, js/, vendor/) gets a new version in the same PR: a line under "## [Unreleased]" in CHANGELOG.md, then `npm run bump -- patch|minor|major`.
- Never change the version or a ?v= number by hand; `npm run bump` changes them all together.
- MAJOR: saved data or the export file changes so old ones no longer work as before. MINOR: something new to see or do. PATCH: a fix, or a change you cannot see.

## Files

- A new file in js/app goes into index.html (before main.js), main.js's loaded list, the top of core.js and the README files table; tests/unit/code.spec.js checks it.
- Files share names only through A.share(); a name a file takes when it loads must come from a file loaded before it.

## Saved data

- Keep old saved data working: raise the matching *_VERSION when a saved shape changes, and key ticks by the wiki's stable ids.
- Every localStorage key goes through sget/sset (they add qg1.) and is listed in the README's "What is saved" table and at the top of core.js.

## Wiki and safety

- Never strip markup with a single regex replace: repeat it until nothing changes, or use DOMParser.
- Text from the wiki goes through esc() before it becomes HTML, unless the parser already cleaned it.
- When the app reads a new kind of wiki page, add a check for it to tests/live.spec.js.

## Tests

- Test logic with a unit test in tests/unit/ (Node, no browser, milliseconds); use a browser test only for what needs a page.
- Browser tests use the fake wiki in tests/support/app.js; only the *live.spec.js files go online.
- Any error the page throws fails the test; a test that means to cause one lists it with `test.use({ pageErrors: [/text/] })`.
- New code comes with tests: `npm run coverage` fails when it finds new code that no test runs. Only when that is right, run `npm run coverage -- --update` and say why in the PR.
- Only change what a test expects when the new behaviour is wanted, and say so in the commit.

## Docs and designs

- Every visible change updates README.md, designs/ (boards and screenshots) and the design canvas in the same PR.
- Build design boards from the app's own markup and the current style.css, not by hand: `npm run designs` (a board without a recipe gets one in tools/designs/boards.spec.js).
- Write UI text, comments, commits and PR text in short, plain sentences, like the README.
