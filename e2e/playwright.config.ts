import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8081',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx expo start --web --port 8081 --clear',
    cwd: '..',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EXPO_PUBLIC_USE_FIREBASE_EMULATORS: '1',
      EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-omp',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-omp.appspot.com',
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
      EXPO_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:e2e2e2',
    },
  },
});
