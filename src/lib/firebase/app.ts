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
  apiKey: 'AIzaSyDPIp_Omy9GrNyCdmIgLz2RK4IjEfWpMnA',
  authDomain: 'ormeprassig-public.firebaseapp.com',
  projectId: 'ormeprassig-public',
  storageBucket: 'ormeprassig-public.firebasestorage.app',
  messagingSenderId: '525513661085',
  appId: '1:525513661085:web:bb6db6d331f3e864e89274',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

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
