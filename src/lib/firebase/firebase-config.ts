export const DEV_FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDPIp_Omy9GrNyCdmIgLz2RK4IjEfWpMnA',
  authDomain: 'ormeprassig-public.firebaseapp.com',
  projectId: 'ormeprassig-public',
  storageBucket: 'ormeprassig-public.firebasestorage.app',
  messagingSenderId: '525513661085',
  appId: '1:525513661085:web:bb6db6d331f3e864e89274',
} as const;

export type FirebaseConfigValues = Record<keyof typeof DEV_FALLBACK_FIREBASE_CONFIG, string>;

export type FirebaseEnvironmentValues = Partial<Record<
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID',
  string
>>;

const ENV_TO_CONFIG = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'appId',
} as const;

export const resolveFirebaseConfigValues = (
  env: FirebaseEnvironmentValues,
  isDevelopment: boolean
): { config: FirebaseConfigValues; missingEnvKeys: string[] } => {
  const missingEnvKeys: string[] = [];
  const config = {} as FirebaseConfigValues;
  for (const [envKey, configKey] of Object.entries(ENV_TO_CONFIG) as [
    keyof typeof ENV_TO_CONFIG,
    keyof FirebaseConfigValues,
  ][]) {
    const value = env[envKey]?.trim();
    if (value) {
      config[configKey] = value;
    } else {
      missingEnvKeys.push(envKey);
      config[configKey] = isDevelopment
        ? DEV_FALLBACK_FIREBASE_CONFIG[configKey]
        : `missing-${configKey}`;
    }
  }
  return { config, missingEnvKeys };
};
