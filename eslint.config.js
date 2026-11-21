// Code checks: npm run lint. They catch mistakes before the tests run, like a name that is not defined (a missing
// import between the app's files) or a variable that is never used. GitHub runs them on every pull request.
// The app's files may use what a browser has, the tests and tools what Node has: a name from the other side fails.
const js = require('@eslint/js');
const globals = require('globals');

// Mistakes, not style: what the app may not do.
const rules = {
  // a name nobody uses is often a mistake (a typo, or a step that was forgotten)
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  // == only to mean "null or undefined"
  eqeqeq: ['error', 'smart'],
  'no-implicit-globals': 'error',
  'no-console': 'error',
  'no-alert': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-self-compare': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unreachable-loop': 'error',
  'no-template-curly-in-string': 'error',
  'array-callback-return': 'error',
  'no-constructor-return': 'error',
  'no-promise-executor-return': 'error',
  radix: 'error'
};

// The scripts written in an HTML file itself (not the ones it loads with src), so they are checked too. Each keeps its
// line numbers: the lines before it are left empty.
const inlineScripts = {
  preprocess(text) {
    const out = [];
    // <script> and </script> in any case, and an end tag with spaces or more after its name (</script >).
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
      if (/\ssrc\s*=/i.test(m[1]) || !m[2].trim()) continue;
      const before = text.slice(0, m.index + m[0].indexOf('>') + 1);
      out.push({ text: before.replace(/[^\n]/g, '') + m[2], filename: out.length + '.js' });
    }
    return out;
  },
  postprocess(messages) { return messages.flat(); }
};

// The app runs in the Alt1 browser (and any Chromium), as plain scripts.
const browser = { ecmaVersion: 2017, sourceType: 'script', globals: { ...globals.browser, L: 'readonly' } };
// The tests and tools run in Node.
const node = { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node };
// What a browser test uses of the page: the code it hands to page.evaluate() runs in the browser.
const inPage = Object.fromEntries(['window', 'document', 'localStorage', 'getComputedStyle', 'innerWidth', 'Image', 'DataTransfer', 'ClipboardEvent', 'MutationObserver', 'Storage']
  .map((name) => [name, 'readonly']));
const nodeRules = {
  ...rules,
  'no-console': 'off',
  // Playwright reads a fixture's first argument to know what it needs: ({}, use) means nothing.
  'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }]
};

module.exports = [
  { ignores: ['vendor/**', 'designs/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**', '_site/**'] },
  js.configs.recommended,
  // The app's files share what they have on window.
  { files: ['js/**/*.js'], languageOptions: browser, rules },
  // index.html's own script: the one that says a file did not load.
  { files: ['index.html'], processor: inlineScripts },
  { files: ['index.html/*.js'], languageOptions: browser, rules },
  // Node only: a name of the browser (window, document) is a mistake here.
  { files: ['tools/**/*.js', '*.config.js', 'tests/unit/**/*.js', 'tests/support/coverage.js'], languageOptions: node, rules: nodeRules },
  // The browser tests and the designs tool: Node, and the page inside page.evaluate().
  {
    files: ['tests/*.js', 'tests/support/**/*.js', 'tools/designs/**/*.js'],
    ignores: ['tests/support/coverage.js'],
    languageOptions: { ...node, globals: { ...globals.node, ...inPage } },
    rules: nodeRules
  }
];
