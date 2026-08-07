/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // Mapea imports relativos con extensión .js al archivo .ts equivalente
  // (necesario porque el código fuente usa NodeNext que requiere extensiones explícitas)
  moduleNameMapper: {
    '^(\\.{1,2}/.+)\\.js$': '$1',
    // firebase-admin >=14 arrastra jwks-rsa -> jose@6, que es ESM puro y Jest (CJS)
    // no puede parsear. Ninguna suite verifica JWTs reales: el stub falla ruidosamente
    // si alguna vez se intenta usar.
    '^jose$': '<rootDir>/src/__tests__/__stubs__/jose.ts',
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
