import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

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
export const db = getFirestore(app);
export const functions = getFunctions(app);