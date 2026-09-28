import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCIfNG-1rDFGxssmKrTc1AW5cDYVKADnos",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "warmth-105e4.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "warmth-105e4",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "warmth-105e4.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "974150176555",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:974150176555:web:f89bf1d7e0fc93601dff6e",
};

// Next.js SSR 환경에서 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
