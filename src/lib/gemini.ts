import { WarmthScore } from '@/types/diary';
import { getSecureGeminiKey } from './secureKeys';

/**
 * 🛡️ 서버 프록시(/api/gemini)를 우선 시도합니다.
 * Vercel 등 백엔드 지원 환경에서는 API 키가 클라이언트에 전혀 노출되지 않습니다.
 * 정적 호스팅(GitHub Pages 등) 환경에서는 클라이언트 폴백으로 원활히 작동합니다.
 */
async function callGeminiProxy(action: string, payload: any): Promise<any | null> {
  try {
    const res = await fetch('/api/gemini/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // 서버리스 미지원 환경 (GitHub Pages 정적 사이트 등)
  }
  return null;
}

/**
 * 1. ✉️ 상대방이 이미 읽은 편지 기반 '맞춤형 관문 복습 퀴즈' 생성
 */
export async function generateCustomQuiz(
  previousContent: string | null,
  authorName: string = '',
  partnerName: string = '',
  previousAuthorName?: string
): Promise<{ prompt: string; answer: string; hint: string }> {
  // 1) 서버 프록시 우선 시도 (보안 100% 모드)
  const proxyData = await callGeminiProxy('customQuiz', {
    previousContent,
    isFirstLetter: !(previousContent && previousContent.trim().length > 5),
  });
  if (proxyData?.candidates?.[0]?.content?.parts?.[0]?.text) {
    try {
      const cleanedJson = proxyData.candidates[0].content.parts[0].text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed.prompt && parsed.answer) {
        return {
          prompt: parsed.prompt,
          answer: String(parsed.answer).trim(),
          hint: parsed.hint || '지난 편지를 꼼꼼히 떠올려보면 알 수 있어!',
        };
      }
    } catch (e) {
      console.warn('Proxy quiz parse fallback:', e);
    }
  }

  // 2) 클라이언트 직접 호출 (정적 배포 환경용)
  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      let systemInstruction = '';
      if (previousContent && previousContent.trim().length > 5) {
        if (previousAuthorName === partnerName) {
          // 상대방(partnerName)이 지난번에 나에게 써준 편지인 경우
          systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 어시스턴트입니다.
상대방이 지난번에 나에게 썼던 이전 편지 본문을 바탕으로, 상대방이 자기가 썼던 내용을 기억하고 있는지 묻는 다정하고 장난스러운 퀴즈를 1개 만들어주세요.

★ 핵심 시제 및 어투 규칙 (매우 중요):
1. 질문의 시제는 반드시 '과거 시제'여야 합니다.
   - 예전 편지 내용을 환기해야 하므로, 질문은 반드시 "저번 편지에서~" 또는 "저번에~" 로 시작하세요.
   - 과거 시제 질문 예시:
     * "저번 편지에서 네가 요즘 푹 빠졌다고 했던 게 뭐였지?"
     * "저번에 네가 나한테 약속했던 곳이 어디였게?"
     * "저번 편지에서 네가 먹고 싶다고 했던 음식이 뭐였지?"
2. 질문에 사람 이름이나 제3자적 호칭/존칭을 절대 넣지 마세요. 연인 사이의 1:1 대화이므로 '나', '너'라는 대명사만 사용하세요.
3. 연인이 평소 둘이서 직접 대화하듯 친근하고 자연스러운 구어체('나', '너')를 사용하세요.
4. 정답(answer)은 1~6글자의 명사 또는 짧은 단어여야 합니다.
5. 힌트(hint) 역시 연인에게 살짝 귓속말하듯 친근한 평소 말투로 작성하세요. (예: "저번 편지 세 번째 줄을 떠올려봐!", "네가 정말 좋아하는 거잖아")
6. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
        } else {
          // 내가 지난번에 상대방에게 썼고, 상대방이 이미 열어서 읽은 편지인 경우
          systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 어시스턴트입니다.
내가 지난번에 상대방에게 썼고, 상대방이 이미 열어서 다 읽어본 이전 편지 본문입니다.
상대방이 내 지난 편지를 꼼꼼히 기억하고 있는지 확인하는 다정하고 사랑스러운 복습 퀴즈를 1개 만들어주세요.

★ 핵심 시제 및 어투 규칙 (매우 중요):
1. 질문의 시제는 반드시 '과거 시제'여야 합니다.
   - 예전 편지 내용을 환기해야 하므로, 질문은 반드시 "저번 편지에서~" 또는 "저번에~" 로 시작하세요.
   - 과거 시제 질문 예시:
     * "저번 편지에서 내가 너랑 가고 싶다고 했던 곳이 어디게?"
     * "저번에 내가 제일 먹고 싶다고 했던 음식이 뭐였을까?"
     * "저번 편지에서 내가 퇴근하고 마셨다고 적은 게 뭐였게?"
2. 질문에 사람 이름이나 제3자적 호칭/존칭을 절대 넣지 마세요. 연인 사이의 1:1 대화이므로 '나', '너'라는 대명사만 사용하세요.
3. 연인이 평소 둘이서 직접 대화하듯 친근하고 자연스러운 구어체('나', '너')를 사용하세요.
4. 정답(answer)은 1~6글자의 명사 또는 짧은 단어여야 합니다.
5. 힌트(hint) 역시 연인에게 살짝 귓속말하듯 친근한 평소 말투로 작성하세요. (예: "저번 편지 둘째 줄에 적어뒀지!", "너도 좋아하는 곳이야")
6. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
        }
      } else {
        // 지난 편지가 아직 없는 첫 편지인 경우
        systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 어시스턴트입니다.
두 사람이 이제 막 시작한 교환일기의 첫 편지입니다.
상대방이 첫 편지를 열기 전에 풀 수 있는 둘만의 소소하고 다정한 추억 퀴즈를 1개 만들어주세요.

★ 핵심 시제 및 어투 규칙 (매우 중요):
1. 질문의 시제는 반드시 과거 시제로, "저번에 우리가~", "저번에 내가~" 와 같이 과거 추억을 환기하는 말투로 물어보세요.
   - 좋은 질문 예시: "저번에 내가 제일 좋아한다고 했던 계절이 언제게?", "저번에 우리가 산책할 때 들었던 노래가 뭐였지?"
2. 질문에 사람 이름이나 제3자적 존칭을 절대 넣지 마세요.
3. 연인이 평소 둘이서 대화하듯 친근하고 다정한 구어체('나', '너')로 물어보세요.
4. 정답(answer)은 1~6글자의 명사 또는 짧은 단어여야 합니다.
5. 힌트(hint) 역시 친근한 평소 말투로 작성하세요. (예: "선선한 바람 부는 이 계절이야!", "매일 밤 네가 듣는 말이야")
6. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
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
 * 일기 내용이 너무 짧거나 감정을 확실하게 파악할 수 없을 때는 null을 반환합니다.
 * 온도 범위: 한국 날씨 기온 범위인 -20°C ~ 영상 40°C
 */
export async function analyzeWarmthTemperature(
  title: string,
  content: string,
  authorName: string = '',
  partnerName: string = ''
): Promise<WarmthScore | null> {
  const fullText = `${title || ''} ${content || ''}`.trim();

  // 내용이 없거나 10자 미만인 경우 온도를 매기지 않음
  if (fullText.length < 10) {
    return null;
  }

  const cleanAuthor = authorName && authorName.trim() ? authorName.trim() : '작성자';
  const cleanPartner = partnerName && partnerName.trim() ? partnerName.trim() : '상대방';

  // 1) 서버 프록시 우선 시도 (보안 100%)
  const proxyData = await callGeminiProxy('temperature', {
    title,
    content,
    authorName,
    partnerName,
  });
  if (proxyData?.candidates?.[0]?.content?.parts?.[0]?.text) {
    try {
      const text = proxyData.candidates[0].content.parts[0].text;
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.hasDistinctEmotion === false || parsed.temperature === null || parsed.temperature === undefined) {
        // AI가 단문이라는 이유 등으로 false를 주었더라도, 텍스트에 확실한 감정어(사랑, 고마워 등)가 있다면 휴리스틱으로 복원
        return generateFallbackWarmth(title, content);
      }

      if (typeof parsed.temperature === 'number') {
        const clampedTemp = Math.max(-20, Math.min(40, Number(Number(parsed.temperature).toFixed(1))));
        return {
          temperature: clampedTemp,
          comment: parsed.comment || (clampedTemp >= 20 ? '마음이 따스해지는 다정한 온기' : '잔잔한 마음의 기록'),
          keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords.slice(0, 3) : ['#마음', '#기록'],
        };
      }
    } catch (e) {
      console.warn('Proxy temperature parse error:', e);
    }
  }

  // 2) 클라이언트 직접 호출 (정적 배포 환경용)
  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      const prompt = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 온도 분석가입니다.
작성자(${cleanAuthor})가 연인(${cleanPartner})에게 쓴 편지를 읽고 '온기의 온도'를 측정해주세요.

★ 매우 중요한 분석 규칙 (특정 단어가 아닌 '텍스트 전체의 분위기와 뉘앙스' 종합 평가):
1. 특정 감정 단어(예: '사랑', '고마워', '슬퍼' 등)의 직접적인 등장 여부에만 얽매이지 마세요.
2. 텍스트 전체의 서사, 시각적·감각적 묘사(날씨, 창밖 풍경, 커피 향, 노을빛, 빗소리 등), 연인을 향한 태도, 문장 뒤에 스며있는 여운, 하루를 조곤조곤 들려주는 다정함 등 '글 전체에서 풍겨 나오는 공기와 분위기(Vibe & Atmosphere)'를 종합적으로 파악하여 온도를 측정하세요.
3. 예를 들어 감정 단어를 직접 쓰지 않고 담담하게 오늘 걸었던 골목길이나 마신 차 한 잔을 묘사했더라도, 연인에게 자신의 하루를 다정히 털어놓는 안락하고 평온한 분위기가 느껴진다면 충분히 따스한 온도(20°C~28°C)입니다.
4. 온도 범위: 한국 날씨 기온 범위인 -20.0°C ~ 영상 40.0°C (소수점 1자리):
   - 혹한기 (-20.0°C ~ -1.0°C): 마음이 시리고 쓸쓸하며 지친 날, 고단함, 고독, 위로가 필요한 무거운 분위기
   - 차분/사색 (0.0°C ~ 14.9°C): 맑고 서늘한 공기, 담담하고 잔잔한 생각, 고요하고 차분한 일상
   - 은은한 평온 (15.0°C ~ 25.9°C): 은은한 차 한 잔 같은 편안함, 햇살 같은 아늑함(Cozy), 서로를 생각하는 다정한 온기
   - 뭉클한 다정함 (26.0°C ~ 33.9°C): 깊은 애틋함, 신뢰와 감사, 미소 짓게 만드는 소중한 순간, 포근한 위로
   - 뜨거운 사랑 (34.0°C ~ 40.0°C): 깊은 설렘, 가슴 뛰는 애정, 벅차오르는 행복과 열정
5. 감정 미측정(hasDistinctEmotion: false) 조건:
   스팸, 무의미한 자음/알파벳 나열(예: 'ㄱㄴㄷㄹ', 'asdf'), 기계적인 일정 표기(예: '14시 미팅 15시 종료')처럼 사람의 감정이나 일상의 숨결이 전혀 느껴지지 않는 경우에만 예외적으로 {"hasDistinctEmotion": false, "temperature": null, "comment": null, "keywords": []} 로 응답하세요.
6. comment: 글 전체의 공기와 분위기를 감성적이고 시적으로 포착한 25자 이내의 한 줄 코멘트 (감정이 느껴질 때 작성)
7. keywords: 글의 전반적인 분위기와 정서를 대변하는 감성 해시태그 2~3개 (예: #차분한오후, #다정한여운, #따스한위로 등)
8. 반드시 순수 JSON 형태(마크다운 블록 없이)로만 응답하세요:
   {"hasDistinctEmotion": true, "temperature": 24.5, "comment": "창가에 스민 노을처럼 은은하고 다정한 온기", "keywords": ["#노을빛하루", "#잔잔한휴식", "#다정한여운"]}`;

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
                parts: [{ text: `${prompt}\n\n[편지 내용]:\n${fullText}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.5,
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
          if (parsed.hasDistinctEmotion === false || parsed.temperature === null || parsed.temperature === undefined) {
            return generateFallbackWarmth(title, content);
          }
          if (typeof parsed.temperature === 'number') {
            const clampedTemp = Math.max(-20, Math.min(40, Number(Number(parsed.temperature).toFixed(1))));
            return {
              temperature: clampedTemp,
              comment: parsed.comment || '서로를 향한 다정한 온기가 깃든 편지',
              keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0
                ? parsed.keywords.slice(0, 3)
                : ['#둘만의온기', '#소소한하루', '#마음'],
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini analyzeWarmthTemperature fallback:', e);
    }
  }

  // Fallback: 텍스트 키워드 기반 감성 분석 (감정 키워드가 없으면 null)
  return generateFallbackWarmth(title, content);
}

/**
 * 3. 🕯️ 날씨/시간에 국한되지 않고 다양한 주제(추억, 취향, 속마음, 미래, IF상상 등)를 다루는 Gemini AI 글감 생성
 */
export const PROMPT_THEMES = [
  { title: '설렘과 첫 기억', description: '처음 만났던 날, 처음 손잡았던 순간, 연애 초반 숨겨뒀던 속마음' },
  { title: '사소한 취향과 TMI', description: '상대방만 아는 나의 버릇, 나를 위로하는 최애 음식, 사소한 취향' },
  { title: '속마음과 고민', description: '요즘 남몰래 했던 생각, 지친 나를 안아줄 위로, 가장 솔직해지고 싶은 마음' },
  { title: '미래와 둘만의 로망', description: '10년 뒤 우리, 함께 꾸밀 공간, 여행 버킷리스트, 먼 훗날의 약속' },
  { title: '고마움과 애정 표현', description: '평소 쑥스러워 말로 다 전하지 못한 고마운 순간, 상대방을 보며 뭉클했던 기억' },
  { title: '유쾌한 IF 상상', description: '만약 학창 시절에 만났다면, 하루 동안 서로가 바뀐다면, 무인도 아지트' },
  { title: '가치관과 인생관', description: '나를 나답게 만들어주는 것, 살면서 소중해진 가치, 서로를 통해 배운 세상' },
  { title: '일상 속 쉼과 온기', description: '오늘 하루 나를 스쳐간 작은 행복, 나만의 힐링 루틴, 함께 멍때리고 싶은 순간' },
];

/**
 * 글감 텍스트에서 {partner} 토큰을 실제 상대방 이름으로 치환하고,
 * 지정되지 않은 경우 자연스러운 2인칭('너')으로 정제합니다.
 */
export function sanitizePromptText(text: string, partnerName?: string): string {
  if (!text) return '';
  const cleanName = (partnerName || '').trim();
  let sanitized = text.trim();

  // {partner} 템플릿 토큰 치환
  const actualTarget = cleanName && cleanName !== '상대방' && cleanName !== '파트너' ? cleanName : '너';
  sanitized = sanitized.replace(/\{partner\}/g, actualTarget);

  return sanitized;
}

export const DAILY_PROMPTS_POOL = [
  // 1. 설렘과 첫 기억
  '우리가 처음 만났던 날 {partner}의 첫인상은 어땠어? 아직도 생생한 기억이 있다면.',
  '연애 초반, {partner}에게 너무 긴장해서 차마 말하지 못했던 귀여운 속마음이 있어?',
  '{partner}를 보며 \'아, 이 사람과 오래 함께하고 싶다\'고 확신이 들었던 찰나의 순간.',
  '우리가 처음 손잡았던 날의 공기와 그때 느꼈던 솔직한 심장 소리.',

  // 2. 사소한 취향과 TMI
  '나만 알고 있는 {partner}만의 사랑스럽거나 귀여운 사소한 버릇 한 가지.',
  '요즘 내 플레이리스트에서 가장 아끼는 한 곡과, 그 노래를 들으면 떠오르는 {partner}의 표정.',
  '혼자만의 시간이 생겼을 때 나를 가장 위로해주는 음식이나 힐링 루틴은?',
  '만약 내일 단 하루, 둘만을 위한 순간이동 티켓이 생긴다면 {partner}와 어디로 가고 싶어?',
  '{partner}가 좋아하는 음식 중에, 먹는 모습만 봐도 덩달아 기분 좋아지는 메뉴는?',

  // 3. 속마음과 고민
  '요즘 마음 한구석을 남몰래 무겁게 채우고 있던 고민이나 생각이 있었나요?',
  '어른이 되었다고 느끼지만, 여전히 {partner} 앞에서는 아이처럼 서툴다고 느껴지는 순간.',
  '내가 지치고 힘들 때 {partner}에게 가장 받고 싶은 다정한 위로의 방식은?',
  '살면서 \'나 정말 나답게 살고 있다\'고 편안하게 느껴지는 순간은 언제일까?',
  '{partner}에게 털어놓고 싶은, 오늘 나를 작아지게 만들었던 사소한 일 한 가지.',

  // 4. 미래와 둘만의 로망
  '먼 훗날 우리가 함께 꾸밀 둘만의 공간에 꼭 두고 싶은 따뜻한 인테리어 로망은?',
  '할머니, 할아버지가 되었을 때도 {partner}에게 변함없이 꼭 해주고 싶은 다정한 일.',
  '은퇴 후 둘이서 한 달 동안 조용히 살아보고 싶은 낯선 여행지가 있다면?',
  '10년 뒤 오늘, 우리는 어떤 모습으로 서로의 손을 꼭 잡고 있을까?',
  '언젠가 {partner}와 꼭 함께 배우거나 도전해보고 싶은 둘만의 버킷리스트 한 가지.',

  // 5. 고마움과 애정 표현
  '평소에 너무 자연스럽고 익숙해서 고맙다는 말을 깜빡 놓쳤던 사소한 순간.',
  '최근 {partner}를 바라보며 \'참 다정하고 멋진 사람이다\'라고 마음속으로 감탄했던 기억.',
  '{partner}의 수많은 표정 중에 내가 유독 좋아하는 표정이나 눈빛은?',
  '지친 {partner}를 위해 오늘 밤 내가 선물해주고 싶은 마음의 온도는?',
  '{partner}가 내 곁에 있어줘서 참 다행이라고 마음 깊이 실감했던 순간.',

  // 6. 유쾌한 IF 상상
  '만약 우리가 학창 시절에 같은 반 짝꿍이었다면 우린 어떻게 친해졌을까?',
  '하루 동안 {partner}와 내 성격이나 능력을 바꿀 수 있다면 제일 먼저 해보고 싶은 것.',
  '만약 둘만의 무인도 아지트를 꾸민다면 꼭 가져갈 세 가지 물건은?',
  '둘만의 타임머신이 있다면 우리의 과거 중 언제로 다시 함께 돌아가 보고 싶어?',
  '만약 100억 복권에 당첨된다면 둘이서 제일 먼저 비밀로 하고 저지를 일은?',

  // 7. 가치관과 인생관
  '{partner}를 만나고 나서 내 세상이나 시야가 긍정적으로 달라진 부분이 있다면?',
  '내가 생각하는 \'좋은 사람\', \'따뜻한 어른\'의 모습은 어떤 모습일까?',
  '서로의 다름을 발견했을 때, 오히려 그게 매력적이거나 고맙게 느껴졌던 기억.',
  '어떤 일이 있어도 이것만은 서로 꼭 지키고 싶은 둘만의 가치관이나 약속.',

  // 8. 일상 속 쉼과 온기
  '오늘 하루 중 {partner}에게 가장 먼저 말해주고 싶었던 사소한 순간은?',
  '오늘 하루 나를 가장 웃게 만들었거나 뭉클하게 했던 작은 일 한 가지.',
  '아무것도 안 하고 가만히 누워있어도 {partner}와 함께라면 충분히 행복했던 날의 기억.',
  '오늘 하루 고생한 나 자신과 서로에게 건네고 싶은 다정한 위로 한 마디.',
];

export async function getRandomPrompt(
  partnerName?: string
): Promise<string> {
  const cleanName = (partnerName || '').trim();

  // 1) 서버 프록시 우선 시도 (보안 100%)
  const proxyData = await callGeminiProxy('randomPrompt', { partnerName: cleanName });
  if (proxyData?.candidates?.[0]?.content?.parts?.[0]?.text) {
    const raw = proxyData.candidates[0].content.parts[0].text.trim().replace(/^["'“”]/, '').replace(/["'“”]$/, '');
    const sanitized = sanitizePromptText(raw, cleanName);
    if (sanitized.length >= 6 && sanitized.length <= 60) {
      return sanitized;
    }
  }

  // 2) 클라이언트 직접 호출
  const randomTheme = PROMPT_THEMES[Math.floor(Math.random() * PROMPT_THEMES.length)];

  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      const hasSpecificName = cleanName && cleanName !== '상대방' && cleanName !== '파트너';
      const nameInstruction = hasSpecificName
        ? `상대방의 실제 이름인 '${cleanName}'을 자연스럽게 부르거나(예: "${cleanName}에게~", "${cleanName}를 보며~"), '너' 또는 '우리'를 사용하세요. (실제 지정되지 않은 다른 가상의 인명은 절대 사용 금지)`
        : `특정 사람 이름을 임의로 지어내지 마시고, '너', '그대', '우리'와 같은 2인칭 대명사만 사용하세요. (임의의 가상 인명 절대 사용 금지)`;

      const promptInstruction = `당신은 아날로그 1:1 비밀 교환일기 '온기'의 다정한 감성 에디터입니다.
날씨나 계절, 시간대에만 얽매이지 않고, 연인이 서로를 더 깊고 다정하게 알아갈 수 있는 무궁무진하고 특별한 질문을 만들어주세요.

이번 글감 테마: [${randomTheme.title}] (${randomTheme.description})

일기 작성자가 상대방에게 일기를 쓸 때 특별한 영감을 얻을 수 있는 '오늘의 질문'을 딱 1개 만들어주세요.

규칙:
1. 단순한 날씨, 계절, 퇴근길 같은 뻔한 주제에 국한되지 마세요. 연인 간의 추억, 사소한 취향, 깊은 속마음, 재미있는 상상, 미래 로망 등 다채로운 주제를 다루세요.
2. 질문은 연인이 서로에게 따뜻하고 진솔하게 속마음을 털어놓을 수 있도록 다정하고 친근한 어투여야 합니다.
3. [호칭 규칙]: ${nameInstruction}
4. 질문은 45자 이내로 간결하고 시적으로 작성하세요.
5. 설명, 안내문, 따옴표 없이 오직 질문 한 문장만 순수 텍스트로 응답하세요.`;

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
              temperature: 0.9,
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          const raw = text.replace(/^["'“”]/, '').replace(/["'“”]$/, '').trim();
          const sanitized = sanitizePromptText(raw, cleanName);
          if (sanitized.length >= 6 && sanitized.length <= 60) {
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.warn('Gemini dynamic prompt fallback:', e);
    }
  }

  // Fallback: 다채로운 풀에서 랜덤 선택 후 파트너 이름 치환 및 살균
  const index = Math.floor(Math.random() * DAILY_PROMPTS_POOL.length);
  return sanitizePromptText(DAILY_PROMPTS_POOL[index], cleanName);
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
      prompt: '저번에 내가 제일 좋아한다고 했던 계절이 언제게?',
      answer: '가을',
      hint: '선선한 바람이 부는 지금 이 계절이야!',
    };
  }

  const isPartnerAuthor = previousAuthorName === partnerName;
  const foodKeywords = ['커피', '붕어빵', '베이글', '라면', '치킨', '파스타', '떡볶이', '된장찌개', '초밥', '빵', '밥'];
  const placeKeywords = ['카페', '서점', '회사', '도서관', '공원', '지하철', '한강', '집', '거리'];

  for (const food of foodKeywords) {
    if (content.includes(food)) {
      return {
        prompt: isPartnerAuthor
          ? '저번 편지에서 네가 먹고 싶다고 했던 음식이 뭐였지?'
          : '저번 편지에서 내가 너랑 먹고 싶다고 했던 음식이 뭐게?',
        answer: food,
        hint: '저번 편지에 맛있게 등장했던 단어야!',
      };
    }
  }

  for (const place of placeKeywords) {
    if (content.includes(place)) {
      return {
        prompt: isPartnerAuthor
          ? '저번에 네가 머물렀다고 적었던 곳이 어디였지?'
          : '저번에 내가 너랑 같이 가자고 했던 곳이 어디게?',
        answer: place,
        hint: '저번 편지에 등장했던 따뜻한 장소야.',
      };
    }
  }

  return {
    prompt: isPartnerAuthor
      ? '저번 편지에서 네가 나한테 전했던 가장 다정한 마음이 뭐였을까?'
      : '저번 편지에서 내가 너한테 가장 전하고 싶었던 마음이 뭐였게?',
    answer: '고마움',
    hint: '마음을 가득 채운 세 글자야!',
  };
}

export function generateFallbackWarmth(title: string, content: string): WarmthScore | null {
  const full = `${title || ''} ${content || ''}`.trim();
  if (full.length < 2) {
    return null;
  }

  // 의미 없는 단순 자음/알파벳 나열(예: 'ㅋㅋㅋ', 'asdf') 필터링
  if (/^[ㄱ-ㅎㅏ-ㅣ\s\d.,!~?]+$/.test(full) && full.length < 10) {
    return null;
  }

  // 감성 어휘 및 분위기 분류기
  const loveWords = ['사랑', '알라뷰', '애정', '심쿵', '설레', '뽀뽀', '키스', '좋아해', '내 사람', '손잡', '두근', '영원히', '내편'];
  const warmWords = ['고마', '행복', '보고싶', '따뜻', '다정', '소중', '위로', '안아', '웃음', '감사', '좋아', '소소한', '예쁘', '귀여', '함께', '포근', '햇살', '온기', '평온', '노을', '기억'];
  const coldWords = ['외로', '힘들', '지쳐', '시려', '춥', '서운', '속상', '눈물', '슬프', '우울', '아파', '피곤', '답답', '미안', '한숨', '막막'];
  const cozySensoryWords = ['차 한 잔', '커피', '빗소리', '바람', '산책', '골목', '하늘', '밤하늘', '달빛', '음악', '책', '이불', '방 안', '휴식', '창밖'];

  let loveCount = 0;
  for (const w of loveWords) if (full.includes(w)) loveCount++;

  let warmCount = 0;
  for (const w of warmWords) if (full.includes(w)) warmCount++;

  let coldCount = 0;
  for (const w of coldWords) if (full.includes(w)) coldCount++;

  let cozyCount = 0;
  for (const w of cozySensoryWords) if (full.includes(w)) cozyCount++;

  // 교환일기의 기본 뉘앙스는 서로를 향한 포근한 안락함(Cozy Room Temperature: 22.5°C)에서 출발
  let score = 22.5;

  if (loveCount > 0) {
    score = 31.5 + Math.min(7.0, loveCount * 2.5);
  } else if (warmCount > 0) {
    score = 25.0 + Math.min(6.0, warmCount * 1.5);
  }

  score += cozyCount * 1.5;
  score -= coldCount * 6.0;

  // 글의 길이에 따른 정성 가산점 (글이 길고 정성스러울수록 따스한 온기 강화)
  if (full.length >= 80) score += 1.5;
  if (full.length >= 200) score += 1.5;

  const clamped = Math.max(-20, Math.min(40, Number(score.toFixed(1))));

  let comment = '하루를 포근하게 감싸주는 잔잔한 온기';
  if (clamped >= 33) {
    comment = '마음 깊은 곳까지 설레게 하는 뜨거운 사랑의 온기';
  } else if (clamped >= 26) {
    comment = '마음 깊은 곳까지 스며드는 다정하고 뭉클한 온기';
  } else if (clamped >= 15) {
    comment = '기분 좋은 오후의 햇살처럼 따사롭고 편안한 온기';
  } else if (clamped >= 0) {
    comment = '담담하고 차분하게 마음을 가라앉히는 서재의 공기';
  } else {
    comment = '지치고 시린 마음을 조용히 품어주는 위로의 계절';
  }

  const keywords: string[] = [];
  if (loveCount > 0 || full.includes('사랑')) keywords.push('#다정한사랑');
  if (full.includes('보고싶')) keywords.push('#그리움');
  if (warmCount > 0) keywords.push('#다정한온기');
  if (cozyCount > 0 || full.includes('산책')) keywords.push('#소소한하루');
  if (coldCount > 0) keywords.push('#토닥토닥위로');
  if (full.includes('커피') || full.includes('차')) keywords.push('#은은한휴식');
  if (full.includes('퇴근') || full.includes('오늘')) keywords.push('#오늘의이야기');

  return {
    temperature: clamped,
    comment,
    keywords: keywords.length > 0 ? keywords.slice(0, 3) : ['#둘만의온기', '#소소한하루', '#마음'],
  };
}

/* ---------------- 4. 🎯 깜짝 퀴즈 유연한 유사 정답 검증 (의미상 거의 맞으면 정답 인정) ---------------- */

function normalizeQuizWord(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.,!?~^;:'"()]+/g, '');
}

function stripKoreanParticles(str: string): string {
  return str.replace(
    /(이야|에요|예요|입니다|이다|이요|요|임|함|하기|먹기|가기|하기로한거|한거|인거|거|것|이|가|을|를|랑|과|와|도)$/,
    ''
  );
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function fallbackFlexibleAnswerCheck(expected: string, user: string): { isCorrect: boolean; reason?: string } {
  // 1) 부분 포함 (길이 2 이상)
  if (expected.length >= 2 && user.length >= 2) {
    if (expected.includes(user) || user.includes(expected)) {
      return { isCorrect: true, reason: '유사 단어 포함 인정' };
    }
  }

  // 2) 대표 동의어/유의어 사전 (예: 러닝 <-> 조깅/달리기, 아메리카노 <-> 아아)
  const synonymGroups = [
    ['러닝', '조깅', '달리기', '뜀걸음', '뜀박질', '뛰기', '런닝'],
    ['통화', '전화', '통화하기', '전화통화', '목소리', '통화한거'],
    ['아이스아메리카노', '아메리카노', '아아', '커피', '아이스커피', '아메'],
    ['붕어빵', '잉어빵', '팥붕어빵', '슈크림붕어빵', '붕방', '팥붕', '슈붕'],
    ['고마움', '감사', '감사함', '고마운마음', '고마운거'],
    ['서촌', '통인동', '서촌마을', '경복궁', '경복궁서쪽'],
    ['삼겹살', '고기', '돼지고기', '삼겹'],
    ['행복', '행복함', '기쁨', '즐거움'],
  ];

  for (const group of synonymGroups) {
    const normGroup = group.map((w) => normalizeQuizWord(w));
    const userInGroup = normGroup.some((w) => user.includes(w) || w.includes(user));
    const expInGroup = normGroup.some((w) => expected.includes(w) || w.includes(expected));
    if (userInGroup && expInGroup) {
      return { isCorrect: true, reason: '유의어 인정' };
    }
  }

  // 3) 오타 참작 레벤슈타인 거리 (1글자 오타 허용)
  if (levenshteinDistance(expected, user) <= 1 && Math.min(expected.length, user.length) >= 2) {
    return { isCorrect: true, reason: '오타 참작 인정' };
  }

  return { isCorrect: false, reason: '정답 불일치' };
}

/**
 * 퀴즈 답변을 Gemini API를 통해 의미상 유연하게 채점합니다.
 * 러닝 <-> 조깅, 아메리카노 <-> 아아 등 거의 맞은 답변을 정답으로 처리합니다.
 */
export async function evaluateQuizAnswerFlexibly(
  question: string,
  expectedAnswer: string,
  userAnswer: string
): Promise<{ isCorrect: boolean; reason?: string }> {
  // 1) 0ms 빠른 정확도 검사 (공백/문장부호/조사 제거)
  const cleanExp = normalizeQuizWord(expectedAnswer);
  const cleanUser = normalizeQuizWord(userAnswer);

  if (!cleanUser) {
    return { isCorrect: false, reason: '답변이 비어있습니다.' };
  }

  // 완전 일치
  if (cleanExp === cleanUser) {
    return { isCorrect: true, reason: '정확한 정답' };
  }

  // 한국어 어미/조사(은/는/이/가/을/를/이야/에요/요/임 등) 제거 후 일치 비교
  const stemExp = stripKoreanParticles(cleanExp);
  const stemUser = stripKoreanParticles(cleanUser);
  if (stemExp && stemUser && stemExp === stemUser) {
    return { isCorrect: true, reason: '조사/어미 일치 정답' };
  }

  // 2) 서버 프록시 우선 시도 (보안 100%)
  const proxyData = await callGeminiProxy('evaluateAnswer', {
    prompt: question,
    expectedAnswer,
    userAnswer,
  });
  if (proxyData?.candidates?.[0]?.content?.parts?.[0]?.text) {
    try {
      const text = proxyData.candidates[0].content.parts[0].text;
      const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      if (typeof parsed.isCorrect === 'boolean') {
        return {
          isCorrect: parsed.isCorrect,
          reason: parsed.reason || (parsed.isCorrect ? '유사 정답 인정' : '오답'),
        };
      }
    } catch (e) {
      console.warn('Proxy eval parse error:', e);
    }
  }

  // 3) Gemini AI 클라이언트 직접 채점
  const apiKey = getSecureGeminiKey();
  if (apiKey) {
    try {
      const prompt = `당신은 연인 간의 교환일기 퀴즈를 채점하는 다정하고 유연한 AI 채점관입니다.
질문: "${question}"
원래 출제자가 설정한 정답: "${expectedAnswer}"
상대방이 제출한 답변: "${userAnswer}"

채점 기준:
1. 답변이 원래 정답과 글자 그대로 완전히 일치하지 않더라도, **의미상 거의 같거나 유의어/동의어, 문맥상 동일한 대상을 지칭하는 경우 관대하고 유도리 있게 정답(isCorrect: true)**으로 인정해주세요.
   - 예시 (모두 정답 인정):
     * 정답: "러닝" / 답변: "조깅", "달리기", "뜀박질", "뛰기" -> 정답 (isCorrect: true)
     * 정답: "아이스 아메리카노" / 답변: "아아", "아메리카노", "커피", "아이스커피" -> 정답 (isCorrect: true)
     * 정답: "붕어빵" / 답변: "붕방", "잉어빵", "팥붕", "슈붕" -> 정답 (isCorrect: true)
     * 정답: "통화" / 답변: "전화", "밤에 전화한 거", "목소리 들은 거", "전화통화" -> 정답 (isCorrect: true)
     * 정답: "서촌" / 답변: "경복궁 옆", "통인동", "서촌마을" -> 정답 (isCorrect: true)
     * 정답: "삼겹살" / 답변: "고기", "삼겹살구이", "돼지고기" -> 정답 (isCorrect: true)
     * 정답: "고마움" / 답변: "감사", "고마운 마음", "고마워하는 마음" -> 정답 (isCorrect: true)
     * 오타나 맞춤법 오차(예: "떡복이", "설레임" 등)도 의도가 맞으면 정답 인정.
2. 완전히 다른 대상이거나 반대되는 의미, 명백한 오답인 경우에만 오답(isCorrect: false)으로 판정하세요.
   - 오답 예시:
     * 정답: "치킨" / 답변: "피자" -> 오답 (isCorrect: false)
     * 정답: "봄" / 답변: "겨울" -> 오답 (isCorrect: false)
     * 정답: "행복" / 답변: "슬픔" -> 오답 (isCorrect: false)

반드시 순수 JSON 형식으로만 응답하세요:
{"isCorrect": true, "reason": "유의어이므로 정답 인정"} 또는
{"isCorrect": false, "reason": "서로 다른 의미이므로 오답"}`;

      // 타임아웃 2.5초 설정
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

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
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedJson);
          if (typeof parsed.isCorrect === 'boolean') {
            return {
              isCorrect: parsed.isCorrect,
              reason: parsed.reason || (parsed.isCorrect ? '유사 정답 인정' : '오답'),
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini evaluateQuizAnswerFlexibly error:', e);
    }
  }

  // 3) 스마트 휴리스틱 대체 (오프라인 / API 장애 시)
  return fallbackFlexibleAnswerCheck(stemExp || cleanExp, stemUser || cleanUser);
}
