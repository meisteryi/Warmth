import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * iOS Taptic Engine 및 브라우저를 통합 지원하는 햅틱 피드백 유틸리티
 */
export const hapticFeedback = {
  /**
   * 가벼운 터치/녹는 중 틱 (Light Impact)
   */
  light: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    }
  },

  /**
   * 일반 클릭 / 노크 / 흔들림 (Medium Impact)
   */
  medium: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40);
      }
    }
  },

  /**
   * 왁스 파쇄 / 강한 파괴감 (Heavy Impact)
   */
  heavy: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([60, 40, 80]);
      }
    }
  },

  /**
   * 편지 개봉 성공 축하 햅틱 (Success Notification Pattern)
   */
  success: async () => {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 60, 120]);
      }
    }
  },

  /**
   * 왁스 녹이기 전용 펄스 (진행도에 따라 단계별 햅틱)
   */
  meltPulse: async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }
  },
};
