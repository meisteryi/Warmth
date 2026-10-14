import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warmth.app',
  appName: '온기',
  webDir: 'public',
  server: {
    // 상용 Vercel 서버 도메인 연결 (앱스토어 출시 및 실사용 환경)
    url: 'https://warmth-swart.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#FDFBF7',
  },
};

export default config;
