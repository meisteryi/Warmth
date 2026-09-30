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

/**
 * 웹 푸시 / 브라우저 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    await registerServiceWorker();
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return 'denied';
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
          icon: '/icon',
          badge: '/icon',
          tag: 'warmth-event',
        });
        return true;
      }
    }

    // 2. 데스크톱 일반 알림 폴백
    new Notification(title, {
      body,
      icon: '/icon',
      badge: '/icon',
    });
    return true;
  } catch (e) {
    console.warn('Failed to display notification:', e);
    return false;
  }
}
