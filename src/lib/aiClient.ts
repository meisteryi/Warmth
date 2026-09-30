import { WarmthScore } from '@/types/diary';
import {
  generateCustomQuiz,
  analyzeWarmthTemperature,
  getRandomPrompt,
  evaluateQuizAnswerFlexibly,
} from '@/lib/gemini';

/**
 * 1. ✉️ 상대방이 이미 읽은 편지 기반 '맞춤형 관문 복습 퀴즈' 생성
 * (Static Export 및 로컬/배포 환경 모두 100% 완벽 호환)
 */
export async function fetchAiQuiz(
  previousContent: string | null,
  authorName: string = '',
  partnerName: string = '',
  previousAuthorName?: string
): Promise<{ prompt: string; answer: string; hint: string }> {
  try {
    return await generateCustomQuiz(previousContent, authorName, partnerName, previousAuthorName);
  } catch (e) {
    console.warn('fetchAiQuiz error:', e);
    return {
      prompt: '저번 편지에서 내가 너한테 가장 전하고 싶었던 마음이 뭐였게?',
      answer: '고마움',
      hint: '마음을 가득 채운 세 글자야!',
    };
  }
}

/**
 * 2. 🌡️ '오늘의 온기 온도(°C)' & 감성 분석
 */
export async function fetchWarmthScore(
  title: string,
  content: string,
  authorName: string = '',
  partnerName: string = ''
): Promise<WarmthScore | null> {
  try {
    return await analyzeWarmthTemperature(title, content, authorName, partnerName);
  } catch (e) {
    console.warn('fetchWarmthScore error:', e);
    return null;
  }
}

/**
 * 3. 🕯️ '오늘 뭐 쓰지?' 둘만의 맞춤형 질문/글감 추천
 */
export async function fetchDailyPrompt(partnerName: string = ''): Promise<string> {
  try {
    return await getRandomPrompt(partnerName);
  } catch (e) {
    console.warn('fetchDailyPrompt error:', e);
    const clean = partnerName && partnerName.trim() && partnerName !== '상대방' && partnerName !== '파트너'
      ? `${partnerName.trim()}에게`
      : '너에게';
    return `오늘 하루 중 ${clean} 가장 먼저 말해주고 싶었던 사소한 순간은 무엇이었나요?`;
  }
}

/**
 * 4. 💡 깜짝 퀴즈 답변 유연한 유사 정답 검증 (러닝 <-> 조깅 등 의미상 거의 맞으면 정답 인정)
 */
export async function verifyFlexibleQuizAnswer(
  question: string,
  expectedAnswer: string,
  userAnswer: string
): Promise<{ isCorrect: boolean; reason?: string }> {
  try {
    return await evaluateQuizAnswerFlexibly(question, expectedAnswer, userAnswer);
  } catch (e) {
    console.warn('verifyFlexibleQuizAnswer error:', e);
    const cleanExp = expectedAnswer.trim().toLowerCase().replace(/\s+/g, '');
    const cleanUser = userAnswer.trim().toLowerCase().replace(/\s+/g, '');
    return { isCorrect: cleanExp === cleanUser, reason: cleanExp === cleanUser ? '일치' : '불일치' };
  }
}
