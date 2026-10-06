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

const PROMPT_CACHE_KEY = 'warmth_cached_daily_prompt';
let memoryCachedPrompt: string | null = null;
let promptFetchPromise: Promise<string> | null = null;

/**
 * 캐시된 오늘의 글감 조회 (메모리 -> sessionStorage)
 */
export function getCachedDailyPrompt(): string | null {
  if (memoryCachedPrompt) return memoryCachedPrompt;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PROMPT_CACHE_KEY);
      if (stored && stored.trim()) {
        memoryCachedPrompt = stored.trim();
        return memoryCachedPrompt;
      }
    } catch {}
  }
  return null;
}

/**
 * 3. 🕯️ '오늘 뭐 쓰지?' 둘만의 맞춤형 질문/글감 추천
 * - forceRefresh가 false인 경우: 이미 캐시된 글감이 있으면 API를 호출하지 않고 캐시 반환 (API 소모 방지)
 * - forceRefresh가 true인 경우: 새로고침 버튼을 눌렀을 때만 Gemini API를 직접 호출하여 새로운 글감 생성 및 캐시 갱신
 */
export async function fetchDailyPrompt(
  partnerName: string = '',
  forceRefresh: boolean = false
): Promise<string> {
  // 1) 새로고침이 아닌 일반 진입 시, 이미 캐시가 있으면 즉시 반환 (추가 API 소모 0)
  if (!forceRefresh) {
    const existing = getCachedDailyPrompt();
    if (existing) {
      return existing;
    }
  }

  // 2) 이미 동일한 요청이 네트워크 진행 중이면 중복 호출 방지
  if (promptFetchPromise) {
    return promptFetchPromise;
  }

  promptFetchPromise = (async () => {
    try {
      const prompt = await getRandomPrompt(partnerName);
      if (prompt && prompt.trim()) {
        memoryCachedPrompt = prompt.trim();
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(PROMPT_CACHE_KEY, memoryCachedPrompt);
          } catch {}
        }
        return memoryCachedPrompt;
      }
    } catch (e) {
      console.warn('fetchDailyPrompt error:', e);
    } finally {
      promptFetchPromise = null;
    }

    const clean = partnerName && partnerName.trim() && partnerName !== '상대방' && partnerName !== '파트너'
      ? `${partnerName.trim()}에게`
      : '너에게';
    const fallback = `오늘 하루 중 ${clean} 가장 먼저 말해주고 싶었던 사소한 순간은 무엇이었나요?`;
    if (!memoryCachedPrompt) {
      memoryCachedPrompt = fallback;
    }
    return memoryCachedPrompt;
  })();

  return promptFetchPromise;
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
