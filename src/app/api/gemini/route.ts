import { NextResponse } from 'next/server';
import { getSecureGeminiKey } from '@/lib/secureKeys';

// Vercel Serverless Function Timeout 설정 (최대 15초)
export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    // 1. 서버 환경변수 우선 조회, 없으면 볼트에서 안전하게 조회
    const apiKey = process.env.GEMINI_API_KEY || getSecureGeminiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: '서버에 등록된 Gemini API Key가 없습니다.' },
        { status: 500 }
      );
    }

    const geminiEndpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

    // 2. 요청 action별 프롬프트 구성 및 실행
    let contents: any[] = [];
    let generationConfig: any = { temperature: 0.7 };

    if (action === 'customQuiz') {
      const { previousContent, isFirstLetter } = payload;
      let systemInstruction = '';
      if (!isFirstLetter) {
        systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 퀴즈 출제자입니다.
수신자가 편지를 열람하기 전, [상대방이 이미 본 지난 편지 본문]을 바탕으로 가벼운 과거 회상 퀴즈를 1개 만들어주세요.

★ 핵심 시제 및 어투 규칙 (매우 중요):
1. 질문의 시제는 반드시 과거 시제로, "저번 편지에서~~", "저번에~~" 와 같이 상대방이 지난 편지에서 썼던 내용을 다정하게 상기시키는 말투로 물어보세요.
2. 질문에 사람 이름이나 제3자적 호칭({발신자}, {수신자}, 이름 등)을 절대 넣지 마세요.
3. 연인이 평소 둘이서 대화하듯 친근하고 다정한 구어체 반말('나', '너')로 물어보세요.
4. 정답(answer)은 1~6글자의 명사 또는 짧은 단어여야 합니다.
5. 힌트(hint) 역시 연인에게 살짝 귓속말하듯 친근한 평소 말투로 작성하세요.
6. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
      } else {
        systemInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 어시스턴트입니다.
두 사람이 이제 막 시작한 교환일기의 첫 편지입니다.
상대방이 첫 편지를 열기 전에 풀 수 있는 둘만의 소소하고 다정한 추억 퀴즈를 1개 만들어주세요.

★ 핵심 시제 및 어투 규칙:
1. 질문의 시제는 반드시 과거 시제로, "저번에 우리가~", "저번에 내가~" 와 같이 과거 추억을 환기하는 말투로 물어보세요.
2. 질문에 사람 이름이나 제3자적 존칭을 절대 넣지 마세요.
3. 연인이 평소 둘이서 대화하듯 친근하고 다정한 구어체('나', '너')로 물어보세요.
4. 정답(answer)은 1~6글자의 명사 또는 짧은 단어여야 합니다.
5. 힌트(hint) 역시 친근한 평소 말투로 작성하세요.
6. 반드시 순수 JSON 형태로만 응답하세요: {"prompt": "...", "answer": "...", "hint": "..."}`;
      }

      contents = [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\n[상대방이 이미 본 지난 편지 본문]:\n${previousContent || '(첫 편지)'}` }],
        },
      ];
      generationConfig = { responseMimeType: 'application/json', temperature: 0.7 };
    } else if (action === 'evaluateAnswer') {
      const { prompt, expectedAnswer, userAnswer } = payload;
      const evalPrompt = `당신은 아날로그 연인 교환일기 '온기'의 다정한 퀴즈 채점자입니다.
문제와 출제자가 지정한 정답(정답 기준), 그리고 상대방(수신자)이 제출한 답변을 비교하여 유연하게 채점해주세요.

[문제]: ${prompt}
[출제자 정답]: ${expectedAnswer}
[상대방 답변]: ${userAnswer}

★ 채점 규칙 (매우 유연하고 너그럽게 판단):
1. 표현이 살짝 다르더라도 실제 같은 활동, 대상, 의미라면 무조건 정답(isCorrect: true)으로 인정하세요.
2. 완전히 다른 대상이거나 반대되는 의미인 경우에만 오답(isCorrect: false)으로 판정하세요.

반드시 순수 JSON 형식으로만 응답하세요:
{"isCorrect": true, "reason": "유의어이므로 정답 인정"} 또는
{"isCorrect": false, "reason": "서로 다른 의미이므로 오답"}`;

      contents = [{ role: 'user', parts: [{ text: evalPrompt }] }];
      generationConfig = { responseMimeType: 'application/json', temperature: 0.2 };
    } else if (action === 'randomPrompt') {
      const { partnerName } = payload;
      const cleanPartner = typeof partnerName === 'string' ? partnerName.trim() : '';
      const hasSpecificName = cleanPartner && cleanPartner !== '상대방' && cleanPartner !== '파트너';
      const nameInstruction = hasSpecificName
        ? `상대방의 실제 이름인 '${cleanPartner}'을 자연스럽게 부르거나(예: "${cleanPartner}에게~", "${cleanPartner}를 보며~"), '너' 또는 '우리'를 사용하세요. (실제 지정되지 않은 다른 가상의 인명은 절대 사용 금지)`
        : `특정 사람 이름을 임의로 지어내지 마시고, '너', '그대', '우리'와 같은 2인칭 대명사만 사용하세요. (임의의 가상 인명 절대 사용 금지)`;

      const promptInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 에디터입니다.
${hasSpecificName ? `연인(${cleanPartner})에게 보낼 오늘의 교환일기 글감(질문/주제)을 딱 1개만 지어주세요.` : '연인에게 보낼 오늘의 교환일기 글감(질문/주제)을 딱 1개만 지어주세요.'}
규칙:
1. 연인 사이에 자연스럽게 속마음을 털어놓거나 사소한 취향을 나눌 수 있는 질문이어야 합니다.
2. 질문은 45자 이내로 간결하고 시적으로 작성하세요.
3. [호칭 규칙]: ${nameInstruction}
4. 설명, 안내문, 따옴표 없이 오직 질문 한 문장만 순수 텍스트로 응답하세요.`;

      contents = [{ role: 'user', parts: [{ text: promptInstruction }] }];
      generationConfig = { temperature: 0.9 };
    } else if (action === 'temperature') {
      const { title, content, authorName, partnerName } = payload;
      const fullText = `${title || ''} ${content || ''}`.trim();

      // 내용이 너무 없는 경우에만 온도를 측정하지 않음
      if (fullText.length < 2) {
        return NextResponse.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      hasDistinctEmotion: false,
                      temperature: null,
                      comment: null,
                      keywords: [],
                    }),
                  },
                ],
              },
            },
          ],
        });
      }

      const cleanAuthor = (authorName || '').trim() || '작성자';
      const cleanPartner = (partnerName || '').trim() || '상대방';
      const tempPrompt = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 온도 분석가입니다.
작성자(${cleanAuthor})가 연인(${cleanPartner})에게 쓴 편지를 읽고 '온기의 온도'를 측정해주세요.

★ 매우 중요한 규칙:
1. 어떠한 감정도 담겨 있지 않은 무미건조한 사실/일정 나열(예: '오늘 2시에 회의함', '점심에 김밥 먹음')일 때만 온도를 측정하지 말고 {"hasDistinctEmotion": false, "temperature": null, "comment": null, "keywords": []} 로 응답하세요.
2. 비록 짧은 한두 문장이나 단문이라도 '사랑해', '고마워', '보고싶어', '힘들었어' 등 감정이나 애정이 담겨 있다면 반드시 정서적 온도를 정성껏 측정해야 합니다.
3. 온도 범위: 한국 날씨 기온 범위인 -20°C ~ 영상 40°C (정수 또는 소수점 1자리):
   - 혹한기 (-20°C ~ -1°C): 몹시 지치고 외롭거나, 마음이 시리고 아프며 서운하고 쓸쓸한 감정
   - 쌀쌀/차분 (0°C ~ 14°C): 담담하고 잔잔한 일상, 소소한 생각
   - 따스함 (15°C ~ 29°C): 다정하고 포근한 위로, 감사, 잔잔한 미소
   - 뜨거운 사랑 (30°C ~ 40°C): 깊은 애정, 심장이 뛰는 설렘, 벅차오르는 행복
4. comment: 편지의 정서를 시적으로 표현한 25자 이내의 한 줄 코멘트 (감정이 확실할 때만 작성)
5. keywords: 감정 및 핵심 단어 해시태그 1~3개
6. 반드시 순수 JSON 형태로만 응답하세요:
   {"hasDistinctEmotion": true, "temperature": 32.5, "comment": "...", "keywords": ["#키워드1", "#키워드2"]}
   또는 감정이 전혀 없는 사실 나열일 때:
   {"hasDistinctEmotion": false, "temperature": null, "comment": null, "keywords": []}`;

      contents = [{ role: 'user', parts: [{ text: `${tempPrompt}\n\n[편지 내용]:\n${title}\n${content}` }] }];
      generationConfig = { responseMimeType: 'application/json', temperature: 0.5 };
    } else {
      return NextResponse.json({ error: '알 수 없는 action입니다.' }, { status: 400 });
    }

    // Google Gemini API 호출
    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents, generationConfig }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Gemini API Error', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 글감 추천일 경우, 따옴표나 불필요한 줄바꿈 정제
    if (action === 'randomPrompt' && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text.trim();
      text = text.replace(/^["'「\s]+|["'」\s]+$/g, '');
      data.candidates[0].content.parts[0].text = text;
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Server Gemini Proxy Error:', err);
    return NextResponse.json(
      { error: err.message || '서버 프록시 처리 중 오류 발생' },
      { status: 500 }
    );
  }
}
