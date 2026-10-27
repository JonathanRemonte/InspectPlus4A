module.exports = {
  root: true,
  extends: ['expo'],
  overrides: [
    {
      // The Expo config gives *.test.* files the Jest globals but not the
      // setup file Jest itself runs before them, which calls jest.mock at
      // top level. CI lints the whole repo (`eslint .`), so without this
      // that one line fails ci/lint-typecheck with no-undef.
      files: ['jest.setup.js'],
      env: { jest: true },
    },
    {
      files: ['scripts/**/*.js'],
      env: { node: true, jest: true },
      rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
      // The foundation/region boundary — see docs/upstream-merge.md. Outside
      // src/region/, region code is reachable only through its entry points:
      // src/region (light data), src/region/db (a leaf src/db can import
      // without a cycle) and src/region/modules (per-type UI and logic).
      files: ['src/**/*.{ts,tsx}', '__tests__/**/*.{ts,tsx}'],
      excludedFiles: ['src/region/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/region/**', '!**/region/db', '!**/region/modules'],
                message: 'Import region code only through src/region, src/region/db or src/region/modules (docs/upstream-merge.md).',
              },
            ],
          },
        ],
      },
    },
  ],
};
