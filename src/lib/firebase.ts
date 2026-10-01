import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getSecureFirebaseConfig } from './secureKeys';

const firebaseConfig = getSecureFirebaseConfig();

// Next.js SSR 환경에서 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export { doc, setDoc, updateDoc, collection, getDoc, getDocs } from 'firebase/firestore';

export default app;
