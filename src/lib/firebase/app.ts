import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

import { logFirestoreConfig } from '@/src/services/firebase/firestore-debug';

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyDPIp_Omy9GrNyCdmIgLz2RK4IjEfWpMnA',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'ormeprassig-public.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'ormeprassig-public',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'ormeprassig-public.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '525513661085',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:525513661085:web:bb6db6d331f3e864e89274',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// App Check (solo web). Protege el backend frente a clientes no autorizados.
// - Solo se activa en web y si hay site key configurada (no rompe nada si falta).
// - El enforcement se activa por separado en la consola de Firebase tras validar trafico.
// - App Check nativo (iOS/Android) requiere @react-native-firebase/app-check + dev build:
//   queda como follow-up; el SDK JS solo soporta reCAPTCHA en web.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const appCheckSiteKey = process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY;
  if (appCheckSiteKey) {
    void import('firebase/app-check')
      .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
        // Token de depuracion para desarrollo local (no afecta produccion).
        if (__DEV__) {
          (
            self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
          ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      })
      .catch(() => {
        // No bloquear el arranque si App Check no carga.
      });
  }
}

type FirebaseAuthWithReactNativePersistence = typeof FirebaseAuth & {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
};

let authInstance: ReturnType<typeof getAuth>;

if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  const persistenceFactory =
    (FirebaseAuth as FirebaseAuthWithReactNativePersistence).getReactNativePersistence;
  const persistence = persistenceFactory?.(AsyncStorage);

  try {
    authInstance = persistence
      ? initializeAuth(app, { persistence: persistence as never })
      : getAuth(app);
  } catch {
    authInstance = getAuth(app);
  }
}

export const auth = authInstance;

const isWebBrowserEnvironment =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined';

const initializeDb = (): Firestore => {
  if (!isWebBrowserEnvironment) {
    logFirestoreConfig('persistence platform=mobile/default');
    return getFirestore(app);
  }

  try {
    const firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined),
      }),
    });

    logFirestoreConfig('persistence platform=web mode=persistentLocalCache');
    return firestore;
  } catch (error) {
    logFirestoreConfig(
      `persistence platform=web mode=fallback reason=${
        error instanceof Error ? error.message : 'unknown'
      }`
    );
    return getFirestore(app);
  }
};

export const db = initializeDb();
export const functions = getFunctions(app);
