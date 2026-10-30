import { NextResponse } from 'next/server';
import webpush from 'web-push';

function getVapidConfig() {
  const publicKey = (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    ''
  ).trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (
    process.env.VAPID_SUBJECT ||
    'mailto:yjh020701@gmail.com'
  ).trim();

  return { publicKey, privateKey, subject };
}

let isVapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (isVapidConfigured) return true;

  const { publicKey, privateKey, subject } = getVapidConfig();
  if (!publicKey || !privateKey) {
    console.warn('[WebPush] VAPID keys missing in runtime env. hasPublicKey:', Boolean(publicKey), 'hasPrivateKey:', Boolean(privateKey));
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidConfigured = true;
    return true;
  } catch (err) {
    console.error('[WebPush] Failed to configure VAPID details:', err);
    return false;
  }
}

// 1. GET /api/push: 클라이언트가 VAPID Public Key를 동적으로 획득 (Vercel 환경변수 접두어 누락 대응)
export async function GET() {
  const { publicKey, privateKey } = getVapidConfig();
  const configured = Boolean(publicKey && privateKey);

  return NextResponse.json(
    {
      configured,
      publicKey: publicKey || '',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

// 2. POST /api/push: 웹 푸시 발송
export async function POST(req: Request) {
  try {
    const configured = ensureVapidConfigured();
    if (!configured) {
      const { publicKey, privateKey } = getVapidConfig();
      return NextResponse.json(
        {
          error: '서버에 Web Push VAPID 키가 올바르게 설정되지 않았습니다.',
          details: {
            hasPublicKey: Boolean(publicKey),
            hasPrivateKey: Boolean(privateKey),
          },
        },
        { status: 500 }
      );
    }

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
    console.error('[WebPush] 발송 에러:', error);
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
