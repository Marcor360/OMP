// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // eslint-config-expo@57 extends plugin:react-hooks/recommended, and
    // react-hooks@7's "recommended" preset newly ships the React Compiler
    // rule family as errors. This project doesn't opt into React Compiler,
    // and these fire across dozens of pre-existing, unrelated files.
    // Downgrading to warn avoids an unreviewed mass refactor while still
    // surfacing them for cleanup.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Scripts de Node (CommonJS) fuera del bundle de la app.
    files: ['*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/*', 'functions/lib/*', 'node_modules/*'],
  },
]);
