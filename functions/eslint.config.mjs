import js from '@eslint/js';
import { config, configs } from 'typescript-eslint';
import globals from 'globals';

export default config(
  { ignores: ['lib/**', 'generated/**', 'node_modules/**'] },
  js.configs.recommended,
  ...configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json'] },
    },
    rules: {
      // Alinear al estilo existente; evitar ruido masivo.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
);
