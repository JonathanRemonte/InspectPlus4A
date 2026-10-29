module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'sync',
        'snapshot',
        'air',
        'water',
        'hazwaste',
        'eia',
        'survey',
        'establishments',
        'reports',
        'ci',
        'repo',
        'db',
        'supabase',
        'router',
        'region'
      ],
    ],
  },
};