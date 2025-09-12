// src/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ⚠️ Ruta a tu config JSON (desde src/)
const firebaseConfig = require('../firebase.config.json');

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
