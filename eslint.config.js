// Code checks: npm run lint. They catch mistakes before the tests run, like a name that is not defined (a missing
// import between the app's files) or a variable that is never used. GitHub runs them on every pull request.
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

module.exports = [
  { ignores: ['vendor/**', 'designs/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    // The app: plain scripts in the Alt1 browser (and any Chromium). They share what they have on window.
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: { ...globals.browser, L: 'readonly' }
    },
    rules
  },
  {
    // The tests and tools run in Node; code in page.evaluate() runs in the browser.
    files: ['tests/**/*.js', 'tools/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      ...rules,
      'no-console': 'off',
      // Playwright reads a fixture's first argument to know what it needs: ({}, use) means nothing.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }]
    }
  }
];
