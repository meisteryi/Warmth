import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warmth.app',
  appName: '온기',
  webDir: 'public',
  server: {
    // iOS 시뮬레이터에서 로컬 Next.js 서버의 모든 API(Gemini, Push 등) 및 실시간 핫리로드 지원
    url: 'http://localhost:3000',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#FAF7F2',
  },
};

export default config;
