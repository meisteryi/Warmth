import { NextResponse } from 'next/server';
import { getSecureGeminiKey } from '@/lib/secureKeys';

// Vercel Serverless Function Timeout 설정 (이미지 생성 파이프라인 대응 최대 30초)
export const maxDuration = 30;

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
    let contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let generationConfig: Record<string, unknown> = { temperature: 0.7 };

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

      contents = [{ role: 'user', parts: [{ text: `${tempPrompt}\n\n[편지 내용]:\n${title}\n${content}` }] }];
      generationConfig = { responseMimeType: 'application/json', temperature: 0.5 };
    } else if (action === 'monthlyRecap') {
      const { monthLabel, userName, partnerName, letters } = payload;
      const cleanUser = (userName || '').trim() || '나';
      const cleanPartner = (partnerName || '').trim() || '상대방';
      const letterDigest = Array.isArray(letters)
        ? letters
            .map(
              (l: { date?: string; author?: string; title?: string; content?: string; temperature?: number }, idx: number) =>
                `[${idx + 1}] 날짜: ${l.date || ''} | 작성자: ${l.author || ''} | 온도: ${typeof l.temperature === 'number' ? `${l.temperature}°C` : '미측정'}\n제목: ${l.title || ''}\n본문: ${l.content || ''}`
            )
            .join('\n\n')
        : '';

      const recapPrompt = `당신은 아날로그 1:1 비밀 교환일기 '온기(Warmth)'의 다정한 월간 에세이 에디터입니다.
두 연인(${cleanUser}, ${cleanPartner})이 [${monthLabel || '이번 달'}] 한 달 동안 주고받은 편지들을 읽고, 마치 온기 우체국에서 보내는 따뜻한 월간 결산 편지처럼 아래 4가지를 작성해주세요.

★ 작성 규칙:
1. summary (온기 우체국이 전하는 이달의 이야기):
   - 두 사람이 이번 달 편지에서 나눈 실제 일상, 감정, 계절감, 음식, 산책, 서로를 향한 위로 등을 구체적으로 언급하며 3~4문장(130~220자 내외)의 다정하고 시적인 한국어 에세이 총평으로 작성하세요.
   - 두 사람의 이름(${cleanUser}, ${cleanPartner}) 또는 '두 분'이라는 표현을 자연스럽게 사용하세요.
2. bestQuote (이달의 가장 다정했던 한 줄):
   - 제공된 편지 본문들 중에서 가장 마음이 따뜻해지거나 애틋했던 실제 문장 1줄(20~65자 내외)을 원문 느낌 그대로 발췌하세요.
3. bestQuoteAuthor & bestQuoteDate:
   - 발췌한 문장이 담긴 편지의 작성자 이름과 날짜(예: "10월 17일")를 적으세요.
4. nextSuggestion (다음 달을 위한 작은 제안):
   - 이번 달 편지 속에서 두 사람이 나눴던 이야기나 다가오는 다음 달의 계절감을 바탕으로, 다음 달에 함께 해보면 좋을 소소하고 다정한 데이트/약속/글감 제안을 1~2문장(60~110자 내외)으로 작성하세요.
5. 반드시 마크다운 코드블록 없이 순수 JSON 형태로만 응답하세요:
{"summary": "...", "bestQuote": "...", "bestQuoteAuthor": "...", "bestQuoteDate": "...", "nextSuggestion": "..."}`;

      contents = [
        {
          role: 'user',
          parts: [{ text: `${recapPrompt}\n\n[이번 달 주고받은 편지 목록]:\n${letterDigest}` }],
        },
      ];
      generationConfig = { responseMimeType: 'application/json', temperature: 0.65 };
    } else if (action === 'generateLetterIllustration') {
      const { content } = payload;
      if (!content || typeof content !== 'string' || content.trim().length < 5) {
        return NextResponse.json({ error: '편지 내용이 너무 짧습니다.' }, { status: 400 });
      }

      // 1) Gemini로 온기 화풍에 맞춘 감성 영문 프롬프트 생성
      const promptInstruction = `당신은 아날로그 교환일기 '온기(Warmth)'의 감성 수채화 일러스트레이터입니다.
아래 편지 본문을 읽고, 편지의 가장 따뜻하고 서정적인 장면이나 사물을 포착한 영문 이미지 생성 프롬프트를 1개 만들어주세요.

[편지 본문]:
${content.trim().slice(0, 1000)}

★ 핵심 스타일 및 규칙:
1. 화풍: "warm nostalgic watercolor and colored pencil illustration, vintage storybook style, soft textured paper grain, gentle pastel and warm earth tones"
2. 분위기: 은은하고 따뜻하며 아늑한 아날로그 감성
3. 사생활 보호: 인물의 구체적인 얼굴 대신, 사물(찻잔, 편지, 창문, 식물 등)이나 뒷모습, 맞잡은 손 등 서정적인 분위기 위주로 묘사하세요.
4. 금지어(매우 중요): 글자나 텍스트가 절대 그림에 들어가면 안 됩니다. 끝에 반드시 "no text, no letters, no typography, clean illustration"을 포함하세요.
5. 출력 형식: 설명, 서론, 따옴표 없이 오직 완성된 영문 프롬프트 1문장만 출력하세요.`;

      const promptResponse = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptInstruction }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });

      let refinedPrompt = 'A cozy watercolor illustration of a warm cup of tea by a sunlit wooden window, vintage storybook art, muted warm tones, no text, no letters';
      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        const rawText = promptData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (rawText) {
          refinedPrompt = rawText.replace(/^["'「\s]+|["'」\s]+$/g, '').trim();
          if (!refinedPrompt.toLowerCase().includes('no text')) {
            refinedPrompt += ', no text, no letters';
          }
        }
      }

      // 2) Pollinations FLUX API로 이미지 생성 (정사각형 768x768)
      const randomSeed = Math.floor(Math.random() * 1000000);
      const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(refinedPrompt)}?width=768&height=768&model=flux&nologo=true&seed=${randomSeed}`;

      const imageController = new AbortController();
      const imageTimeout = setTimeout(() => imageController.abort(), 22000);

      try {
        const imageRes = await fetch(pollUrl, {
          signal: imageController.signal,
          headers: { 'User-Agent': 'WarmthDiary/1.0' },
        });
        clearTimeout(imageTimeout);

        if (!imageRes.ok) {
          throw new Error(`Pollinations HTTP error ${imageRes.status}`);
        }

        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        return NextResponse.json({
          success: true,
          dataUrl,
          prompt: refinedPrompt,
        });
      } catch (imageErr) {
        clearTimeout(imageTimeout);
        console.error('Pollinations fetch error:', imageErr);
        return NextResponse.json(
          { error: '이미지 생성 서버와의 통신이 지연되었습니다. 잠시 후 다시 시도해주세요.' },
          { status: 504 }
        );
      }
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
  } catch (err: unknown) {
    console.error('Server Gemini Proxy Error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message || '서버 프록시 처리 중 오류 발생' },
      { status: 500 }
    );
  }
}
