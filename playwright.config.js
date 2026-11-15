// @ts-check
// Tests for Quick Guide. The app runs in Chromium (like the Alt1 browser) at the Alt1 window size.
// "app" tests use a fake wiki and need no internet. "live" tests read the real RuneScape Wiki.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that only passes on its second try still fails the run: a retry must not hide a problem.
  // (The retry still runs, so its trace shows what went wrong.)
  failOnFlakyTests: !!process.env.CI,
  // One worker per processor: the tests mostly wait on the browser, so this is about twice as fast as the default (half).
  workers: '100%',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    browserName: 'chromium',
    baseURL: 'http://quick-guide.test',
    viewport: { width: 360, height: 720 },
    trace: 'on-first-retry',
    reducedMotion: 'reduce'
  },
  projects: [
    { name: 'app', testIgnore: /live\.spec\.js$/ },
    { name: 'live', testMatch: /live\.spec\.js$/, timeout: 90000, expect: { timeout: 30000 } }
  ]
});
