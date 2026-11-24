import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/gallery.capture.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  outputDir: '../tmp/gallery-test-results',
  use: {
    baseURL: 'http://127.0.0.1:8081',
    browserName: 'chromium',
    deviceScaleFactor: 1,
    colorScheme: 'light',
    timezoneId: 'America/Mexico_City',
    locale: 'es-MX',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx expo start --web --port 8081 --clear',
    cwd: '..',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      EXPO_PUBLIC_USE_FIREBASE_EMULATORS: '1',
      EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-omp',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-omp.appspot.com',
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
      EXPO_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:e2e2e2',
      EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY: '',
      EXPO_OFFLINE: '1',
    },
  },
});
