import { WarmthScore } from '@/types/diary';
import { getSecureGeminiKey } from './secureKeys';

/**
 * 1. ✉️ 상대방이 이미 읽은 편지 기반 '맞춤형 관문 복습 퀴즈' 생성
 */
export async function generateCustomQuiz(
  previousContent: string | null,
  authorName: string = '주형',
  partnerName: string = '유라',
  previousAuthorName?: string
): Promise<{ prompt: string; answer: string; hint: string }> {
  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      let systemInstruction = '';
      if (previousContent && previousContent.trim().length > 5) {
        if (previousAuthorName === partnerName) {
          // 상대방(partnerName)이 지난번에 나에게 써준 편지인 경우
          systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 다정한 어시스턴트입니다.
상대방(${partnerName})이 지난번에 나(${authorName})에게 썼던 편지 본문을 분석하여, ${partnerName}가 자기가 썼던 내용을 제대로 기억하고 있는지 확인할 수 있는 다정하고 재치 있는 복습 퀴즈를 1개 만들어주세요.
규칙:
1. 질문은 상대방이 지난번에 썼던 편지의 구체적인 디테일(음식, 장소, 언급한 노래, 사소한 사건, 약속 등)을 묻는 질문이어야 합니다. (예: "지난 편지에서 네가 요즘 푹 빠졌다고 했던 노래는?", "지난번 편지에서 네가 나한테 약속했던 장소는?")
2. 정답은 1~6글자의 명사 또는 짧은 단어여야 합니다.
3. 힌트는 정답을 유추할 수 있는 다정한 문장이어야 합니다.
4. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
        } else {
          // 내가 지난번에 상대방에게 썼고, 상대방이 이미 열어서 읽은 편지인 경우
          systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 다정한 어시스턴트입니다.
작성자(${authorName})가 지난번에 상대방(${partnerName})에게 썼고, ${partnerName}가 이미 열어서 다 읽어본 지난 편지 본문입니다.
${partnerName}가 내 지난 편지를 정성껏 기억하고 있는지 확인할 수 있는 다정하고 재치 있는 복습 퀴즈를 1개 만들어주세요.
규칙:
1. 질문은 지난 편지 속 구체적인 디테일(내가 언급한 음식, 장소, 선물, 기분, 추천한 것 등)을 묻는 질문이어야 합니다. (예: "지난 편지에서 내가 요즘 가장 가고 싶다고 한 곳은?", "지난 편지에서 내가 너에게 꼭 해주고 싶다고 한 요리는?")
2. 정답은 1~6글자의 명사 또는 짧은 단어여야 합니다.
3. 힌트는 정답을 유추할 수 있는 다정한 문장이어야 합니다.
4. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
        }
      } else {
        // 지난 편지가 아직 없는 첫 편지인 경우
        systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 다정한 어시스턴트입니다.
두 사람(${authorName}와 ${partnerName})이 이제 막 시작한 교환일기의 첫 편지입니다.
아직 주고받은 지난 편지가 없으므로, ${partnerName}가 첫 편지를 열람할 수 있도록 둘만의 소소한 취향이나 마음을 묻는 사랑스러운 퀴즈를 1개 만들어주세요.
규칙:
1. 둘만의 소소하고 따뜻한 퀴즈를 만드세요. (예: "내가 가장 좋아하는 계절은?", "우리가 매일 밤 나누는 다정한 인사는?")
2. 정답은 1~6글자의 명사 또는 짧은 단어여야 합니다.
3. 힌트는 정답을 유추할 수 있는 다정한 문장이어야 합니다.
4. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
      }

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${systemInstruction}\n\n[상대방이 이미 본 지난 편지 본문]:\n${previousContent || '(첫 편지)'}` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);
          if (parsed.prompt && parsed.answer) {
            return {
              prompt: parsed.prompt,
              answer: String(parsed.answer).trim(),
              hint: parsed.hint || '지난 편지를 꼼꼼히 떠올려보면 알 수 있어!',
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini generateCustomQuiz fallback:', e);
    }
  }

  // Fallback: 스마트 감성 휴리스틱 퀴즈 생성
  return generateFallbackQuiz(previousContent, authorName, partnerName, previousAuthorName);
}

/**
 * 2. 🌡️ '오늘의 온기 온도(°C)' & 감성 분석
 */
export async function analyzeWarmthTemperature(
  title: string,
  content: string,
  authorName: string = '주형',
  partnerName: string = '유라'
): Promise<WarmthScore> {
  const fullText = `${title}\n${content}`;

  const apiKey = getSecureGeminiKey();
  if (apiKey && fullText.trim().length > 5) {
    try {
      const prompt = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 분석가입니다.
작성자(${authorName})가 연인(${partnerName})에게 쓴 편지를 읽고 '온기의 온도'를 측정해주세요.
규칙:
1. temperature: 다정함/애정/위로/고마움 등 편지에 포함되어 있는 감정의 깊이에 따라 0 ~ 100 사이의 정수로 산출하세요.
2. comment: 편지의 정서를 감성적이고 시적으로 묘사한 25자 이내의 한 줄 코멘트 (예: "지친 퇴근길을 포근하게 안아주는 봄날의 온기")
3. keywords: 이 편지의 핵심 단어/감정 해시태그 3개 (예: ["#퇴근길", "#붕어빵", "#다정한위로"])
4. 반드시 순수 JSON 형태로만 응답하세요: {"temperature": 88, "comment": "...", "keywords": ["...", "...", "..."]}`;

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${prompt}\n\n[편지 내용]:\n${fullText}` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.6,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);
          if (typeof parsed.temperature === 'number') {
            return {
              temperature: Math.min(100, Math.max(0, Math.round(Number(parsed.temperature)))),
              comment: parsed.comment || '서로를 향한 다정한 온기가 깃든 편지',
              keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0
                ? parsed.keywords.slice(0, 3)
                : ['#둘만의온기', '#소소한하루', '#고마움'],
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini analyzeWarmthTemperature fallback:', e);
    }
  }

  // Fallback: 텍스트 키워드 기반 감성 분석
  return generateFallbackWarmth(title, content);
}

/**
 * 3. 🕯️ 계절, 요일, 시간대를 반영한 Gemini AI 맞춤형 오늘의 글감 동적 생성
 */
function getCurrentTimeContext() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDay();
  const hour = now.getHours();

  // 계절
  let season = '가을';
  if (month >= 3 && month <= 5) season = '봄';
  else if (month >= 6 && month <= 8) season = '여름';
  else if (month >= 9 && month <= 11) season = '가을';
  else season = '겨울';

  // 요일 분위기
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = days[day];
  let dayVibe = '평일';
  if (day === 5) dayVibe = '주말을 앞둔 금요일 저녁';
  else if (day === 6 || day === 0) dayVibe = '여유로운 주말';
  else if (day === 1) dayVibe = '새로운 한 주를 여는 월요일';

  // 시간대
  let timeOfDay = '오후';
  if (hour >= 5 && hour < 12) timeOfDay = '아침';
  else if (hour >= 12 && hour < 18) timeOfDay = '오후';
  else if (hour >= 18 && hour < 23) timeOfDay = '저녁';
  else timeOfDay = '깊은 밤';

  return { season, dayName, dayVibe, timeOfDay };
}

export const DAILY_PROMPTS_POOL = [
  '오늘 하루 중 유라에게 가장 먼저 말해주고 싶었던 사소한 순간은?',
  '우리가 처음 만났던 날 유라의 첫인상은 어땠어? 아직도 생생한 기억이 있다면.',
  '오늘 하루 나를 가장 웃게 만들었거나 뭉클하게 했던 작은 일 한 가지.',
  '이번 주말 유라와 함께 가고 싶거나, 따뜻하게 나눠 먹고 싶은 음식은?',
  '유라에게 요즘 가장 고마웠지만 쑥스러워서 말로 다 못 전했던 이야기.',
  '10년 뒤 오늘, 우리는 어떤 모습으로 서로의 손을 잡고 있을까?',
  '퇴근길 문득 유라가 떠올랐던 순간의 풍경이나 바람.',
  '오늘 하루 고생한 나 자신과 서로에게 건네고 싶은 다정한 위로 한 마디.',
  '유라의 수많은 표정 중에 내가 유독 좋아하는 표정이나 행동은?',
  '오늘 날씨와 바람을 느끼며 문득 함께 걷고 싶었던 골목길이 있었나요?',
];

export async function getRandomPrompt(
  partnerName: string = '유라'
): Promise<string> {
  const { season, dayName, dayVibe, timeOfDay } = getCurrentTimeContext();

  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      const promptInstruction = `당신은 아날로그 1:1 비밀 교환일기 '온기'의 다정한 감성 에디터입니다.
현재 시점:
- 계절: ${season}
- 요일: ${dayName} (${dayVibe})
- 시간대: ${timeOfDay}

일기 작성자가 상대방(${partnerName})에게 일기를 쓸 때 영감을 얻을 수 있는 '오늘의 글감 질문'을 딱 1개 만들어주세요.

규칙:
1. 현재 계절(${season}), 요일(${dayName}), 시간대(${timeOfDay})의 분위기를 자연스럽게 녹여내세요. (예: 쌀쌀한 가을밤, 나른한 일요일 오후, 퇴근길 저녁 등)
2. 서로의 사소한 하루, 따뜻한 기억, 고마움, 함께 먹고 싶은 음식 등을 나눌 수 있는 다정하고 감성적인 질문이어야 합니다.
3. 반드시 상대방 이름("${partnerName}")을 다정하게 포함하세요.
4. 설명이나 따옴표 없이 오직 35자 이내의 질문 한 문장만 순수 텍스트로 응답하세요.`;

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: promptInstruction }],
              },
            ],
            generationConfig: {
              temperature: 0.85,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          const cleaned = text.replace(/^["'“”]/, '').replace(/["'“”]$/, '').trim();
          if (cleaned.length >= 6 && cleaned.length <= 60) {
            return cleaned;
          }
        }
      }
    } catch (e) {
      console.warn('Gemini dynamic prompt fallback:', e);
    }
  }

  // Fallback: 풀에서 랜덤 선택 후 파트너 이름 치환
  const index = Math.floor(Math.random() * DAILY_PROMPTS_POOL.length);
  return DAILY_PROMPTS_POOL[index].replace(/유라/g, partnerName);
}

/* ---------------- 내부 스마트 휴리스틱 엔진 ---------------- */

function generateFallbackQuiz(
  content: string | null,
  authorName: string,
  partnerName: string,
  previousAuthorName?: string
) {
  if (!content || content.trim().length < 5) {
    return {
      prompt: `${authorName}와 ${partnerName}가 함께 나누는 가장 따뜻한 감정은?`,
      answer: '사랑',
      hint: '다정한 마음 두 글자',
    };
  }

  const isPartnerAuthor = previousAuthorName === partnerName;
  const foodKeywords = ['커피', '붕어빵', '베이글', '라면', '치킨', '파스타', '떡볶이', '된장찌개', '초밥', '빵', '밥'];
  const placeKeywords = ['카페', '서점', '회사', '도서관', '공원', '지하철', '한강', '집', '거리'];

  for (const food of foodKeywords) {
    if (content.includes(food)) {
      return {
        prompt: isPartnerAuthor
          ? `지난 편지에서 ${partnerName} 님이 언급했던 맛있는 음식은?`
          : `지난번 내 편지에서 내가 ${partnerName} 님에게 추천했던 음식은?`,
        answer: food,
        hint: `지난 편지에 맛있게 등장했던 단어야!`,
      };
    }
  }

  for (const place of placeKeywords) {
    if (content.includes(place)) {
      return {
        prompt: isPartnerAuthor
          ? `지난 편지에서 ${partnerName} 님이 머물렀다고 적었던 공간은?`
          : `지난번 편지에서 내가 ${partnerName} 님과 함께 가고 싶다고 한 장소는?`,
        answer: place,
        hint: `지난 편지에 등장했던 따뜻한 장소야.`,
      };
    }
  }

  return {
    prompt: isPartnerAuthor
      ? `지난 편지에서 ${partnerName} 님이 건넸던 가장 다정한 마음의 단어는?`
      : `지난 편지에서 내가 ${partnerName} 님에게 전하고 싶었던 가장 큰 감정은?`,
    answer: '고마움',
    hint: `마음을 가득 채운 세 글자`,
  };
}

function generateFallbackWarmth(title: string, content: string): WarmthScore {
  const full = `${title} ${content}`;
  let score = 36.8;

  const warmWords = ['사랑', '고마', '행복', '보고싶', '따뜻', '다정', '소중', '위로', '안아', '웃음'];
  let warmCount = 0;
  for (const w of warmWords) {
    if (full.includes(w)) {
      warmCount++;
      score += 0.4;
    }
  }

  score = Math.min(40.2, Number(score.toFixed(1)));

  let comment = '하루를 포근하게 감싸주는 잔잔한 온기';
  if (score >= 38.5) {
    comment = '마음 깊은 곳까지 스며드는 뜨겁고 다정한 온기';
  } else if (score >= 37.5) {
    comment = '기분 좋은 햇살처럼 따사롭고 편안한 온기';
  }

  const keywords: string[] = [];
  if (full.includes('커피') || full.includes('카페')) keywords.push('#은은한커피향');
  if (full.includes('퇴근') || full.includes('하루')) keywords.push('#오늘의하루');
  if (full.includes('고마') || full.includes('감사')) keywords.push('#고마운마음');
  if (full.includes('사랑') || full.includes('좋아')) keywords.push('#다정한사랑');

  while (keywords.length < 3) {
    const pool = ['#소소한행복', '#둘만의온기', '#함께하는순간', '#느린우체통'];
    const pick = pool[keywords.length % pool.length];
    if (!keywords.includes(pick)) keywords.push(pick);
  }

  return {
    temperature: score,
    comment,
    keywords: keywords.slice(0, 3),
  };
}
