import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getSecureFirebaseConfig } from './secureKeys';

const firebaseConfig = getSecureFirebaseConfig();

// Next.js SSR 환경에서 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 모바일 웹/PWA 오프라인 회복력 및 다중 탭 동기화를 위한 IndexedDB 영구 캐시 활성화
let firestoreDb;
try {
  firestoreDb = typeof window !== 'undefined'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : getFirestore(app);
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

export { doc, setDoc, updateDoc, collection, getDoc, getDocs } from 'firebase/firestore';

export default app;
