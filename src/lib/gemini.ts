import { WarmthScore } from '@/types/diary';

// Google Gemini API Key (서버 사이드 환경변수 우선, 없으면 NEXT_PUBLIC_GEMINI_API_KEY)
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
  '';

/**
 * 1. ✉️ 일기 본문 기반 '맞춤형 관문 퀴즈' 생성
 */
export async function generateCustomQuiz(
  content: string,
  authorName: string = '주형',
  partnerName: string = '유라'
): Promise<{ prompt: string; answer: string; hint: string }> {
  if (!content || content.trim().length < 5) {
    return {
      prompt: `${authorName} 님이 오늘 일기에서 가장 전하고 싶었던 감정은?`,
      answer: '고마움',
      hint: '다정한 마음 세 글자',
    };
  }

  if (GEMINI_API_KEY) {
    try {
      const systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 다정한 어시스턴트입니다.
작성자(${authorName})가 연인(${partnerName})에게 쓴 일기를 읽고, ${partnerName}가 일기를 열기 위해 풀 재미있고 사랑스러운 '맞춤 퀴즈'를 1개 만들어주세요.
규칙:
1. 일기 내용 속 구체적인 디테일(오늘 먹은 음식, 장소, 사소한 사건, 감정)을 바탕으로 만드세요.
2. 정답은 1~6글자의 명사 또는 짧은 단어여야 합니다.
3. 힌트는 정답을 유추할 수 있는 다정한 문장이어야 합니다.
4. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${systemInstruction}\n\n[일기 본문]:\n${content}` },
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
          const parsed = JSON.parse(text);
          if (parsed.prompt && parsed.answer) {
            return {
              prompt: parsed.prompt,
              answer: String(parsed.answer).trim(),
              hint: parsed.hint || '일기를 꼼꼼히 생각해보면 알 수 있어!',
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini generateCustomQuiz fallback:', e);
    }
  }

  // Fallback: 스마트 감성 휴리스틱 퀴즈 생성
  return generateFallbackQuiz(content, authorName, partnerName);
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

  if (GEMINI_API_KEY && fullText.trim().length > 5) {
    try {
      const prompt = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 분석가입니다.
작성자(${authorName})가 연인(${partnerName})에게 쓴 편지를 읽고 '온기의 온도'를 측정해주세요.
규칙:
1. temperature: 다정함/애정/위로/고마움 등 편지에 포함되어 있는 감정의 깊이에 따라 0 ~ 100 사이의 정수로 산출하세요.
2. comment: 편지의 정서를 감성적이고 시적으로 묘사한 25자 이내의 한 줄 코멘트 (예: "지친 퇴근길을 포근하게 안아주는 봄날의 온기")
3. keywords: 이 편지의 핵심 단어/감정 해시태그 3개 (예: ["#퇴근길", "#붕어빵", "#다정한위로"])
4. 반드시 순수 JSON 형태로만 응답하세요: {"temperature": 88, "comment": "...", "keywords": ["...", "...", "..."]}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          const parsed = JSON.parse(text);
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
 * 3. 🕯️ '오늘 뭐 쓰지?' 둘만의 맞춤형 질문/글감 추천
 */
export const DAILY_PROMPTS_POOL = [
  '오늘 하루 중 유라에게 가장 먼저 말해주고 싶었던 사소한 순간은 무엇이었나요?',
  '우리가 처음 만났던 날 유라의 첫인상은 어땠어? 아직도 생생한 기억이 있다면.',
  '오늘 하루 나를 가장 웃게 만들었거나 울컥하게 했던 작은 일 한 가지.',
  '이번 주말 유라와 함께 가고 싶거나, 따뜻하게 나눠 먹고 싶은 음식은?',
  '유라에게 요즘 가장 고마웠지만 쑥스러워서 말로 다 못 전했던 이야기.',
  '10년 뒤 오늘, 우리는 어떤 모습으로 서로의 손을 잡고 있을까?',
  '퇴근길/하굣길 문득 유라가 떠올랐던 순간의 풍경이나 날씨.',
  '오늘 하루 고생한 나 자신과 서로에게 건네고 싶은 다정한 위로 한 마디.',
  '최근 우리가 함께 들었던 음악이나 나누었던 대화 중 귓가에 맴도는 것.',
  '유라의 수많은 표정 중에 내가 유독 좋아하는 표정이나 행동은?',
];

export async function getRandomPrompt(
  partnerName: string = '유라'
): Promise<string> {
  const index = Math.floor(Math.random() * DAILY_PROMPTS_POOL.length);
  return DAILY_PROMPTS_POOL[index].replace(/유라/g, partnerName);
}

/* ---------------- 내부 스마트 휴리스틱 엔진 ---------------- */

function generateFallbackQuiz(content: string, authorName: string, partnerName: string) {
  const sentences = content
    .split(/[.?!;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);

  // 음식, 장소, 행동 관련 키워드 탐색
  const foodKeywords = ['커피', '붕어빵', '베이글', '라면', '치킨', '파스타', '떡볶이', '된장찌개', '초밥', '빵', '밥'];
  const placeKeywords = ['카페', '서점', '회사', '도서관', '공원', '지하철', '한강', '집', '거리'];

  for (const food of foodKeywords) {
    if (content.includes(food)) {
      return {
        prompt: `오늘 ${authorName} 님이 일기에서 언급한 맛있는 메뉴는 무엇일까요?`,
        answer: food,
        hint: `오늘 편지 속에서 맛있게 등장한 음식이야!`,
      };
    }
  }

  for (const place of placeKeywords) {
    if (content.includes(place)) {
      return {
        prompt: `오늘 ${authorName} 님이 편지에서 머물렀다고 적은 장소는 어디일까요?`,
        answer: place,
        hint: `오늘의 하루가 머물렀던 공간이야.`,
      };
    }
  }

  if (sentences.length > 0) {
    const firstSentence = sentences[0];
    return {
      prompt: `오늘 일기에서 내가 ${partnerName} 님에게 전하고 싶었던 오늘의 핵심 키워드는?`,
      answer: '사랑',
      hint: `두 글자의 가장 따뜻한 마음!`,
    };
  }

  return {
    prompt: `오늘 일기 속에 담긴 ${authorName}의 진심 어린 감정은 무엇일까요?`,
    answer: '행복',
    hint: `함께 있을 때 느끼는 두 글자`,
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
