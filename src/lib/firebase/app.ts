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

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__ === true;

// Valores del proyecto de desarrollo por defecto. La apiKey web no es secreta
// (identificador publico protegido por Rules + App Check); el riesgo real es
// conectar en silencio a este proyecto cuando faltan las env vars de produccion.
const DEV_FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDPIp_Omy9GrNyCdmIgLz2RK4IjEfWpMnA',
  authDomain: 'ormeprassig-public.firebaseapp.com',
  projectId: 'ormeprassig-public',
  storageBucket: 'ormeprassig-public.firebasestorage.app',
  messagingSenderId: '525513661085',
  appId: '1:525513661085:web:bb6db6d331f3e864e89274',
} as const;

// Nota: Expo solo inlinea env vars EXPO_PUBLIC_* cuando el acceso es estatico
// (process.env.EXPO_PUBLIC_X). Por eso cada variable se lee de forma literal
// en vez de con un bucle dinamico (process.env[key] no se reemplaza en build).
const resolveFirebaseValue = (
  envKey: string,
  envValue: string | undefined,
  devFallback: string,
  missingEnvKeys: string[]
): string => {
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue;
  }

  if (isDevelopment) {
    console.warn(`[firebase] Falta ${envKey}; usando valor de desarrollo por defecto.`);
    return devFallback;
  }

  missingEnvKeys.push(envKey);
  return devFallback;
};

const resolveFirebaseConfig = (): Record<keyof typeof DEV_FALLBACK_FIREBASE_CONFIG, string> => {
  const missingEnvKeys: string[] = [];

  const config = {
    apiKey: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      DEV_FALLBACK_FIREBASE_CONFIG.apiKey,
      missingEnvKeys
    ),
    authDomain: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      DEV_FALLBACK_FIREBASE_CONFIG.authDomain,
      missingEnvKeys
    ),
    projectId: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      DEV_FALLBACK_FIREBASE_CONFIG.projectId,
      missingEnvKeys
    ),
    storageBucket: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      DEV_FALLBACK_FIREBASE_CONFIG.storageBucket,
      missingEnvKeys
    ),
    messagingSenderId: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      DEV_FALLBACK_FIREBASE_CONFIG.messagingSenderId,
      missingEnvKeys
    ),
    appId: resolveFirebaseValue(
      'EXPO_PUBLIC_FIREBASE_APP_ID',
      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      DEV_FALLBACK_FIREBASE_CONFIG.appId,
      missingEnvKeys
    ),
  };

  if (missingEnvKeys.length > 0) {
    throw new Error(
      `Configuracion de Firebase incompleta en produccion. Faltan variables de entorno: ${missingEnvKeys.join(', ')}`
    );
  }

  return config;
};

const firebaseConfig = resolveFirebaseConfig();

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

// En movil, la sesion debe sobrevivir a cerrar/reabrir la app: eso solo pasa si
// initializeAuth recibe getReactNativePersistence(AsyncStorage). getAuth(app) sin
// persistencia explicita usa memoria y pierde la sesion al matar el proceso, por
// eso cualquier caida a ese camino se reporta en voz alta durante desarrollo en
// vez de fallar en silencio.
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  const persistenceFactory =
    (FirebaseAuth as FirebaseAuthWithReactNativePersistence).getReactNativePersistence;

  if (!persistenceFactory) {
    if (isDevelopment) {
      console.error(
        '[firebase] getReactNativePersistence no esta disponible en este build de firebase/auth. ' +
          'La sesion movil NO se conservara entre reinicios de la app (persistencia en memoria).'
      );
    }
    authInstance = getAuth(app);
  } else {
    try {
      authInstance = initializeAuth(app, {
        persistence: persistenceFactory(AsyncStorage) as never,
      });
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;

      if (errorCode === 'auth/already-initialized') {
        // Fast Refresh / doble evaluacion del modulo en desarrollo: la instancia
        // ya existe (con la persistencia correcta), solo hace falta recuperarla.
        authInstance = getAuth(app);
      } else {
        if (isDevelopment) {
          console.error(
            '[firebase] initializeAuth con getReactNativePersistence fallo. ' +
              'La sesion movil NO se conservara entre reinicios de la app.',
            error
          );
        }
        authInstance = getAuth(app);
      }
    }
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
