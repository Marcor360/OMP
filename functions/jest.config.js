/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // Mapea imports relativos con extensión .js al archivo .ts equivalente
  // (necesario porque el código fuente usa NodeNext que requiere extensiones explícitas)
  moduleNameMapper: {
    '^(\\.{1,2}/.+)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
};
