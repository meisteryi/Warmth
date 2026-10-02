import { NextResponse } from 'next/server';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BHTiYvqZhhwycXbqZBrkSi5P-YtHN-47QN1FJ-5cgY6mKSJ1oH3TSNcDu8MAPFpi9w3-grVbL6PdITNjk40FWc0';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'JuYCiqUhH3a5z-glEkvLO5qpiq5WUFhZgHnejxgJhZU';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:warmth-couple@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function POST(req: Request) {
  try {
    const { subscription, title, body, icon, url, tag } = await req.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: '유효한 Web Push 구독 정보(subscription)가 필요합니다.' },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: title || '온기 (Warmth)',
      body: body || '둘만의 일기장에 새로운 소식이 도착했습니다.',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'warmth-notification',
      url: url || '/',
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Web Push 발송 에러:', error);
    if (error.statusCode === 410 || error.statusCode === 404) {
      return NextResponse.json(
        { error: '구독이 만료되었거나 취소되었습니다.', expired: true },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error?.message || '푸시 알림 전송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
