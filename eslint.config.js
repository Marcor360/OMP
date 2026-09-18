// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // eslint-config-expo@57 extiende plugin:react-hooks/recommended, y
    // react-hooks@7 envía la familia de reglas de React Compiler como error.
    // Este proyecto SÍ tiene reactCompiler activado (app.json > expo.experiments),
    // pero estas reglas disparan en archivos preexistentes anteriores a la
    // migración. Se mantienen en 'warn' de forma TEMPORAL mientras se limpian.
    // Plan: warn → limpiar warnings por dominio → error.
    // No añadir reglas nuevas a esta lista.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'error',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // React Compiler analiza componentes de ejecución; los harnesses de Jest y
    // los tipos generados de Expo no forman parte del bundle de la aplicación.
    files: ['**/__tests__/**/*.{ts,tsx}', '.expo/**/*.{ts,tsx,d.ts}'],
    rules: {
      'react-hooks/globals': 'off',
      'import/first': 'off',
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
    ignores: ['.expo/**/*', 'dist/*', 'functions/lib/*', 'node_modules/*'],
  },
]);
