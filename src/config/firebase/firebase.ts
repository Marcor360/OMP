import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyDPIp_Omy9GrNyCdmIgLz2RK4IjEfWpMnA",
  authDomain: "ormeprassig-public.firebaseapp.com",
  projectId: "ormeprassig-public",
  storageBucket: "ormeprassig-public.firebasestorage.app",
  messagingSenderId: "525513661085",
  appId: "1:525513661085:web:bb6db6d331f3e864e89274"
};

// Inicializar Firebase (solo una instancia)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializar Auth con persistencia adecuada según plataforma
let auth: ReturnType<typeof getAuth>;

if (Platform.OS === 'web') {
  auth = getAuth(app);
  // En web, Firebase usa localStorage por defecto automáticamente
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

// Inicializar Firestore
const db = getFirestore(app);

export { app, auth, db };
