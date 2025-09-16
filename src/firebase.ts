// src/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Config DESDE src/ hacia la raíz
const firebaseConfig = require('../firebase.config.json');

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);

// Intentar usar persistencia con AsyncStorage; si no está, caer a memoria
let _auth;
try {
  // dynamic require para no romper el bundler si no está instalado aún
  const RNAsyncStorage = require('@react-native-async-storage/async-storage').default;
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(RNAsyncStorage),
  });
} catch (e) {
  // Fallback: sin persistencia (memoria)
  _auth = getAuth(app);
}
export const auth = _auth;

export const db = getFirestore(app);
export const storage = getStorage(app);
