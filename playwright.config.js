// @ts-check
// Tests for Quick Guide.
// "unit" tests run the app's files in Node, without a browser: they take seconds, and run first (npm run test:unit).
// "app" tests run the app in Chromium (like the Alt1 browser) at the Alt1 window size, with a fake wiki and no
// internet. They start when the unit tests passed. "live" tests read the real RuneScape Wiki.
const { defineConfig } = require('@playwright/test');

// True for "playwright test --project=live" (npm run test:live): only the tests that read the real wiki run.
const LIVE_RUN = /--project[= ]live(\s|$)/.test(process.argv.slice(2).join(' '));

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that only passes on its second try still fails the run: a retry must not hide a problem.
  // (The retry still runs, so its trace shows what went wrong.) Not in a run of the live tests: the real wiki is slow
  // now and then, so a live test that passes on its second try passes.
  failOnFlakyTests: !!process.env.CI && !LIVE_RUN,
  // One worker per processor: the tests mostly wait on the browser, so this is about twice as fast as the default (half).
  workers: '100%',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30000,
  // A coverage run (npm run coverage) counts every line the app runs, which makes it slower: it waits longer.
  expect: { timeout: process.env.QG_COVERAGE ? 15000 : 5000 },
  use: {
    browserName: 'chromium',
    baseURL: 'http://quick-guide.test',
    viewport: { width: 360, height: 720 },
    trace: 'on-first-retry',
    reducedMotion: 'reduce'
  },
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'app', testIgnore: [/live\.spec\.js$/, /[\\/]unit[\\/]/], dependencies: ['unit'] },
    { name: 'live', testMatch: /live\.spec\.js$/, timeout: 90000, expect: { timeout: 30000 } },
    // Not tests: npm run designs builds the design boards and their pictures (tools/designs/boards.spec.js).
    { name: 'designs', testDir: './tools/designs', testMatch: /boards\.spec\.js$/, retries: 0, timeout: 90000 }
  ]
});
