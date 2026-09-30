// 온기 (Warmth) Service Worker for Web Push & Offline Support

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 푸시 알림 수신 이벤트 (FCM / Web Push)
self.addEventListener('push', (event) => {
  let data = {
    title: '온기 (Warmth)',
    body: '둘만의 일기장에 새로운 소식이 도착했습니다.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'warmth-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'warmth-notification',
    renotify: true,
    data: {
      url: '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭 시 앱 열기 / 포커스
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 창이 있으면 포커스
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // 열린 창이 없으면 메인 페이지 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
