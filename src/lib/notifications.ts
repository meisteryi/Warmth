// 웹 푸시 및 브라우저 알림 매니저

export interface NotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission;
  isStandalonePWA: boolean;
}

/**
 * 현재 기기/브라우저의 알림 지원 여부 확인
 */
export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined') {
    return { isSupported: false, permission: 'default', isStandalonePWA: false };
  }

  const isStandalonePWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  const permission = isSupported ? Notification.permission : 'denied';

  return {
    isSupported,
    permission,
    isStandalonePWA,
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
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BHTiYvqZhhwycXbqZBrkSi5P-YtHN-47QN1FJ-5cgY6mKSJ1oH3TSNcDu8MAPFpi9w3-grVbL6PdITNjk40FWc0';

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
 */
export async function subscribeToWebPush(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return null;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }
    return sub;
  } catch (err) {
    console.warn('Web push subscription registration failed:', err);
    return null;
  }
}

/**
 * 웹 푸시 / 브라우저 알림 권한 요청 및 백그라운드 푸시 구독 동시 진행
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
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
  subscription: any,
  title: string,
  body: string
): Promise<boolean> {
  if (!subscription) return false;
  try {
    const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subObj,
        title,
        body,
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

/**
 * 로컬 시스템 알림 발송 (새 일기 도착, 노크 등)
 */
export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // 1. Service Worker 등록 객체를 통해 알림 띄우기 (PWA 및 모바일 권장)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'warmth-event',
        });
        return true;
      }
    }

    // 2. 데스크톱 일반 알림 폴백
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    return true;
  } catch (e) {
    console.warn('Failed to display notification:', e);
    return false;
  }
}
