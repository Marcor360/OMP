module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-rules/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
