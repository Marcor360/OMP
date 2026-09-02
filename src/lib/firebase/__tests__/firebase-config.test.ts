import {
  DEV_FALLBACK_FIREBASE_CONFIG,
  resolveFirebaseConfigValues,
  type FirebaseEnvironmentValues,
} from '@/src/lib/firebase/firebase-config';

const completeEnv: FirebaseEnvironmentValues = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'api',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'auth.example',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'project',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'bucket',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'sender',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'app',
};

describe('resolveFirebaseConfigValues', () => {
  it('uses supplied values in development and production', () => {
    expect(resolveFirebaseConfigValues(completeEnv, false)).toEqual({
      config: { apiKey: 'api', authDomain: 'auth.example', projectId: 'project', storageBucket: 'bucket', messagingSenderId: 'sender', appId: 'app' },
      missingEnvKeys: [],
    });
  });

  it('allows the known fallback only in development', () => {
    const resolved = resolveFirebaseConfigValues({}, true);
    expect(resolved.config).toEqual(DEV_FALLBACK_FIREBASE_CONFIG);
    expect(resolved.missingEnvKeys).toHaveLength(6);
  });

  it('never uses the development project when production variables are missing', () => {
    const resolved = resolveFirebaseConfigValues({}, false);
    expect(resolved.missingEnvKeys).toHaveLength(6);
    expect(resolved.config.projectId).toBe('missing-projectId');
    expect(resolved.config.projectId).not.toBe(DEV_FALLBACK_FIREBASE_CONFIG.projectId);
  });
});

