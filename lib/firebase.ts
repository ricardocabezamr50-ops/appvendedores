// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA9IYhlmuszTdg8FHLJNHDqRChusLK3E14',
  authDomain: 'mateo-vendedores.firebaseapp.com',
  projectId: 'mateo-vendedores',
  storageBucket: 'mateo-vendedores.firebasestorage.app',
  messagingSenderId: '954432665338',
  appId: '1:954432665338:web:95e7027458af53b415bb43',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
