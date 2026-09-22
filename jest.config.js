module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.tsx',
    '<rootDir>/app/**/__tests__/**/*.test.tsx',
  ],
  testPathIgnorePatterns: ['<rootDir>/functions/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  coverageThreshold: {
    // Baseline medido en Ronda 2; evita regresiones sin romper CI el día uno.
    './src/utils/permissions/': {
      statements: 61,
      branches: 33,
      functions: 56,
      lines: 62,
    },
    './src/services/billing/': {
      statements: 89,
      branches: 70,
      functions: 70,
      lines: 90,
    },
    global: {
      // Línea base medida en septiembre de 2026. Evita regresiones globales
      // mientras se aumenta cobertura de pantallas y flujos de integración.
      statements: 50,
      branches: 33,
      functions: 49,
      lines: 52,
    },
  },
};
