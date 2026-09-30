import { WarmthScore } from '@/types/diary';
import {
  generateCustomQuiz,
  analyzeWarmthTemperature,
  getRandomPrompt,
} from '@/lib/gemini';

/**
 * 1. ✉️ 일기 본문 기반 '맞춤형 관문 퀴즈' 생성
 * (Static Export 및 로컬/배포 환경 모두 100% 완벽 호환)
 */
export async function fetchAiQuiz(
  content: string,
  authorName: string = '주형',
  partnerName: string = '유라'
): Promise<{ prompt: string; answer: string; hint: string }> {
  try {
    return await generateCustomQuiz(content, authorName, partnerName);
  } catch (e) {
    console.warn('fetchAiQuiz error:', e);
    return {
      prompt: `오늘 일기에서 내가 ${partnerName} 님에게 전하고 싶었던 가장 큰 감정은?`,
      answer: '고마움',
      hint: '다정한 세 글자',
    };
  }
}

/**
 * 2. 🌡️ '오늘의 온기 온도(°C)' & 감성 분석
 */
export async function fetchWarmthScore(
  title: string,
  content: string,
  authorName: string = '주형',
  partnerName: string = '유라'
): Promise<WarmthScore> {
  try {
    return await analyzeWarmthTemperature(title, content, authorName, partnerName);
  } catch (e) {
    console.warn('fetchWarmthScore error:', e);
    return {
      temperature: 37.8,
      comment: '하루를 포근하게 감싸주는 다정하고 따뜻한 온기',
      keywords: ['#둘만의온기', '#소소한하루', '#고마움'],
    };
  }
}

/**
 * 3. 🕯️ '오늘 뭐 쓰지?' 둘만의 맞춤형 질문/글감 추천
 */
export async function fetchDailyPrompt(partnerName: string = '유라'): Promise<string> {
  try {
    return await getRandomPrompt(partnerName);
  } catch (e) {
    console.warn('fetchDailyPrompt error:', e);
    return `오늘 하루 중 ${partnerName}에게 가장 먼저 말해주고 싶었던 사소한 순간은 무엇이었나요?`;
  }
}
