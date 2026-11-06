import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// 웹 푸시 및 브라우저 / iOS 네이티브 알림 매니저

export interface NotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  isStandalonePWA: boolean;
  isNativeApp?: boolean;
}

// 네이티브 앱 환경에서의 권한 캐시 (동기식 상태 반환용)
let cachedNativePermission: NotificationPermission = 'default';

/**
 * 네이티브 및 웹 알림 권한 비동기 재확인 및 캐시 갱신
 */
export async function refreshNotificationPermissionAsync(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'default';

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      const mapped: NotificationPermission =
        perm.display === 'granted' ? 'granted' : perm.display === 'denied' ? 'denied' : 'default';
      cachedNativePermission = mapped;
      return mapped;
    } catch {
      return cachedNativePermission;
    }
  }

  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
}

/**
 * 현재 기기/브라우저/네이티브 앱의 알림 지원 여부 확인
 */
export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined') {
    return { isSupported: false, permission: 'default', isStandalonePWA: false, isNativeApp: false };
  }

  const isNativeApp = Capacitor.isNativePlatform();

  // 네이티브 iOS (Capacitor IPA) 환경
  if (isNativeApp) {
    return {
      isSupported: true,
      permission: cachedNativePermission,
      isStandalonePWA: false,
      isNativeApp: true,
    };
  }

  // 웹 브라우저 / Safari PWA 환경
  const isStandalonePWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  const permission = isSupported ? Notification.permission : 'denied';

  return {
    isSupported,
    permission,
    isStandalonePWA,
    isNativeApp: false,
  };
}

/**
 * Service Worker 등록
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    // 서비스 워커가 정상적으로 활성화될 때까지 ready 대기 (최대 2초 타임아웃)
    if ('ready' in navigator.serviceWorker) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

let memoryCachedVapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();

/**
 * VAPID Public Key 조회
 * - 클라이언트 빌드 시점에 inlining된 NEXT_PUBLIC_VAPID_PUBLIC_KEY를 1차 확인
 * - Vercel에서 NEXT_PUBLIC_ 접두어 없이 VAPID_PUBLIC_KEY로 등록되었거나 환경변수 갱신 직후인 경우 /api/push/를 통해 동적 획득
 */
export async function getVapidPublicKey(): Promise<string> {
  if (memoryCachedVapidKey) return memoryCachedVapidKey;

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/push/', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.publicKey) {
          memoryCachedVapidKey = String(data.publicKey).trim();
          return memoryCachedVapidKey;
        }
      }
    } catch (e) {
      console.warn('[WebPush] Failed to fetch VAPID public key from API:', e);
    }
  }

  return '';
}

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 브라우저 백그라운드 웹 푸시(Web Push) 구독 등록 및 PushSubscription 객체 반환
 * - 네이티브 앱(IPA) 환경에서는 W3C Web Push 대신 Capacitor Local Notifications를 사용하므로 건너뜁니다.
 * - VAPID 키 교체(회전) 시 브라우저 내 구버전 구독을 자동 감지하고 구독을 재발급하여 알림 불통을 원천 해결합니다.
 */
export async function subscribeToWebPush(): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }

  try {
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.pushManager) return null;

    const currentVapidKey = await getVapidPublicKey();
    if (!currentVapidKey) {
      console.warn('[WebPush] VAPID public key is not configured.');
      return null;
    }
    const convertedKey = urlBase64ToUint8Array(currentVapidKey);

    let sub = await reg.pushManager.getSubscription();

    // VAPID 키 회전(재발급) 감지: 기존 브라우저 구독의 applicationServerKey가 현재 VAPID 키와 불일치하면 구독 재발급
    if (sub && sub.options && sub.options.applicationServerKey) {
      const existingKeyBytes = new Uint8Array(sub.options.applicationServerKey);
      let isKeyMatched = existingKeyBytes.length === convertedKey.length;
      if (isKeyMatched) {
        for (let i = 0; i < convertedKey.length; i++) {
          if (existingKeyBytes[i] !== convertedKey[i]) {
            isKeyMatched = false;
            break;
          }
        }
      }

      if (!isKeyMatched) {
        console.info('[WebPush] VAPID key rotation detected. Unsubscribing outdated subscription...');
        try {
          await sub.unsubscribe();
        } catch (unsubErr) {
          console.warn('[WebPush] Failed to unsubscribe outdated subscription:', unsubErr);
        }
        sub = null;
      }
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
      console.info('[WebPush] Successfully subscribed with current VAPID key.');
    }
    return sub;
  } catch (err) {
    console.warn('[WebPush] Web push subscription registration failed:', err);
    return null;
  }
}

/**
 * 웹 푸시 / 브라우저 및 iOS 네이티브 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') {
    return 'denied';
  }

  // 1. iOS 네이티브(Capacitor IPA) 앱 환경
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      const mapped: NotificationPermission =
        res.display === 'granted' ? 'granted' : res.display === 'denied' ? 'denied' : 'default';
      cachedNativePermission = mapped;
      if (mapped === 'granted') {
        window.dispatchEvent(new CustomEvent('warmth-notification-permission-granted'));
      }
      return mapped;
    } catch (err) {
      console.warn('[NativeNotif] Permission request failed:', err);
      return 'denied';
    }
  }

  // 2. 웹 브라우저 / Safari PWA 환경 (기존 로직 100% 동일 유지)
  if (!('Notification' in window)) {
    return 'denied';
  }

  try {
    await registerServiceWorker();
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await subscribeToWebPush();
      window.dispatchEvent(new CustomEvent('warmth-notification-permission-granted'));
    }
    return result;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return 'denied';
  }
}

/**
 * 백엔드 서버 푸시(/api/push)를 통해 상대방 기기의 OS 화면에 알림 전송 (앱이 꺼져 있어도 수신됨)
 */
export async function sendServerWebPush(
  subscription: PushSubscription | PushSubscriptionJSON | Record<string, unknown> | string | null | undefined,
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (!subscription) return false;
  try {
    const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    const res = await fetch('/api/push/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subObj,
        title,
        body,
        tag: tag || `warmth-${Date.now()}`,
        icon: '/icon-192.png',
        url: '/',
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to send server web push:', err);
    return false;
  }
}

// 중복 알림 방지용 캐시 (태그 기준 4초 내 동일 이벤트 중복 발송 원천 차단)
const recentNotificationTags = new Map<string, number>();

function isDuplicateNotification(tag: string): boolean {
  const now = Date.now();
  const last = recentNotificationTags.get(tag);
  for (const [k, t] of recentNotificationTags.entries()) {
    if (now - t > 60000) recentNotificationTags.delete(k);
  }
  if (last && now - last < 4000) {
    return true;
  }
  recentNotificationTags.set(tag, now);
  return false;
}

function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

/**
 * 로컬 시스템 알림 발송 (새 일기 도착, 실링 개봉, 포스트잇 반응, 노크 등)
 * - iOS 네이티브(IPA): UNUserNotificationCenter 기반 네이티브 배너/사운드 알림
 * - 웹 PWA: ServiceWorkerRegistration.showNotification()을 사용
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const notificationTag = tag || `warmth-${Date.now()}`;

  // 웹과 네이티브 모두에서 4초 내 동일 이벤트 중복 알림 원천 차단
  if (isDuplicateNotification(notificationTag)) {
    return false;
  }

  // 1. 네이티브 iOS (Capacitor IPA) 환경: UNUserNotificationCenter를 통한 실시간 시스템 알림 발송
  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt') {
        perm = await LocalNotifications.requestPermissions();
      }
      if (perm.display !== 'granted') {
        return false;
      }

      const notifId = hashStringToId(notificationTag);
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: notifId,
            sound: 'default',
            extra: {
              tag: notificationTag,
              url: '/',
            },
          },
        ],
      });
      return true;
    } catch (err) {
      console.warn('[NativeNotif] Failed to schedule local notification:', err);
      return false;
    }
  }

  // 2. 웹 브라우저 / Safari PWA 환경 (기존 로직 100% 동일 유지)
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    // 1) Service Worker 등록 객체를 통해 알림 띄우기 (PWA 및 모바일 표준)
    if ('serviceWorker' in navigator) {
      let reg: ServiceWorkerRegistration | null | undefined = null;
      try {
        reg = await navigator.serviceWorker.ready;
      } catch {
        reg = await navigator.serviceWorker.getRegistration();
      }

      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: notificationTag,
          renotify: true,
          data: {
            url: '/',
          },
        } as NotificationOptions & { renotify?: boolean });
        return true;
      }
    }

    // 2) 데스크톱 브라우저 일반 Notification 생성자 폴백
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: notificationTag,
      });
      return true;
    } catch {
      return false;
    }
  } catch (e) {
    console.warn('Failed to display local notification:', e);
    return false;
  }
}
