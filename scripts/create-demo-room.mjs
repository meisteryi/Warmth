import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';

const DEFAULT_ENCRYPTED_VAULT =
  'nuVsc38I8XcfZfVQid+q86dvb46R60/pazFQbtRPjhuolUtVCRq0FG1D4ibF1VskNBedNS2cevZw81JxVRp0xcCkW4zq343QvakLPcuh5T/EWMZphsRl11/kbFYhGm4ONQ8dSyybO+zZ1HMu2xdVndrmSxRtJDfUpJIRDMITOiLMuQkuAbNhRcPfkvUD6i27A2IriBz8IOYV1IvcWDTQATLksoC4P/U9DjVkP80XGD71yoRjGT9x1WqHeWildv2hVhZn1uvBQ67ZKyOIjB1vpDgCZZcpx6EeAJ0sXy+q8PzeF0Qwnrh6x0uD9JuMtrTjcjIXgemJETxmgiXgyGIAnVBRGyimqGfvhHMWpzBp80Amb1F4eshqWMKj0+z7jbcbDteiKuwOLEUFJsHWhPszoFmiFjGN8GAFyRNGdNF4+pNFcnWVAzLWLNnl35wRCJ6hXgkxt1ARtkA6';

function generateKeyStream(seed, length) {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 16777619);
  }
  const stream = new Uint8Array(length);
  let state = s >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    stream[i] = (state ^ (state >>> 8) ^ (state >>> 16) ^ (state >>> 24)) & 0xff;
  }
  return stream;
}

function getFirebaseConfig() {
  const binaryString = atob(DEFAULT_ENCRYPTED_VAULT);
  const cipherBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    cipherBytes[i] = binaryString.charCodeAt(i);
  }
  const seed = 'warmth_secure_vault_secret_entropy_token_2026';
  const keyStream = generateKeyStream(seed, cipherBytes.length);
  const decryptedBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    decryptedBytes[i] = cipherBytes[i] ^ keyStream[i];
  }
  const json = JSON.parse(new TextDecoder().decode(decryptedBytes));
  return json.firebase;
}

async function main() {
  console.log('✨ [1/4] Firebase 연결 중...');
  const config = getFirebaseConfig();
  const app = initializeApp(config);
  const db = getFirestore(app);

  const roomCode = '987654'; // 시연용 6자리 코드
  const creatorUid = 'uid_demo_minwoo';
  const partnerUid = 'uid_demo_jieun';
  const roomSalt = 'DEMO_SALT_WARMTH_2026';

  console.log(`✨ [2/4] 방 생성 (WAITING_PARTNER)...`);
  await setDoc(doc(db, 'rooms', roomCode), {
    roomId: roomCode,
    roomCode: roomCode,
    status: 'WAITING_PARTNER',
    currentTurn: '지은',
    members: [creatorUid],
    memberInfo: {
      [creatorUid]: {
        nickname: '민우',
        role: 'CREATOR',
      },
    },
    roomSalt: roomSalt,
    createdAt: new Date().toISOString(),
  });

  console.log(`✨ [3/4] 파트너 입장 (MATCHED로 업데이트)...`);
  await updateDoc(doc(db, 'rooms', roomCode), {
    status: 'MATCHED',
    members: [creatorUid, partnerUid],
    memberInfo: {
      [creatorUid]: {
        nickname: '민우',
        role: 'CREATOR',
      },
      [partnerUid]: {
        nickname: '지은',
        role: 'PARTNER',
      },
    },
  });

  console.log(`✨ [4/4] 8월, 9월, 10월의 6편의 일기 등록...`);
  const sampleDiaries = [
    // 2026년 8월
    {
      diaryId: `diary_${roomCode}_08_01`,
      authorId: creatorUid,
      authorName: '민우',
      recipientId: partnerUid,
      recipientName: '지은',
      title: '한여름 밤의 바닷가 산책',
      content: '파도 소리가 정말 좋았던 8월의 밤. 모래사장에 앉아 밤하늘 별 보며 나누었던 이야기들이 아직도 기억나.',
      photos: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'],
      waxColor: '#B8860B',
      createdAt: '2026-08-12T20:00:00.000Z',
      mission: { type: 'TEXT', prompt: '바다 소감', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-08-12T21:00:00.000Z',
    },
    {
      diaryId: `diary_${roomCode}_08_02`,
      authorId: partnerUid,
      authorName: '지은',
      recipientId: creatorUid,
      recipientName: '민우',
      title: '시원한 수박 화채와 웃음소리',
      content: '너무 더웠지만 함께 수박 화채 만들어 먹으면서 엄청 웃었던 하루! 네가 곁에 있어서 여름도 시원했어.',
      photos: [],
      waxColor: '#2B5B84',
      createdAt: '2026-08-25T15:30:00.000Z',
      mission: { type: 'TEXT', prompt: '여름 디저트', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-08-25T16:00:00.000Z',
    },

    // 2026년 9월
    {
      diaryId: `diary_${roomCode}_09_01`,
      authorId: creatorUid,
      authorName: '민우',
      recipientId: partnerUid,
      recipientName: '지은',
      title: '선선한 초가을 바람과 따뜻한 커피',
      content: '아침저녁으로 바람이 기분 좋게 부네. 서촌 골목길 걸으며 테이크아웃했던 라떼 향이 아직도 맴돌아.',
      photos: ['https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80'],
      waxColor: '#2E473B',
      createdAt: '2026-09-08T18:20:00.000Z',
      mission: { type: 'TEXT', prompt: '가을 날씨 소감', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-09-08T19:00:00.000Z',
    },
    {
      diaryId: `diary_${roomCode}_09_02`,
      authorId: partnerUid,
      authorName: '지은',
      recipientId: creatorUid,
      recipientName: '민우',
      title: '서로의 하루를 꼭 안아주기',
      content: '힘든 날이었는데 네 목소리 들으니 모든 긴장이 스르륵 풀렸어. 언제나 내 편이 되어줘서 고마워.',
      photos: [],
      waxColor: '#6B4C7D',
      createdAt: '2026-09-22T22:15:00.000Z',
      mission: { type: 'TEXT', prompt: '응원의 말', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-09-22T22:30:00.000Z',
    },

    // 2026년 10월
    {
      diaryId: `diary_${roomCode}_10_01`,
      authorId: creatorUid,
      authorName: '민우',
      recipientId: partnerUid,
      recipientName: '지은',
      title: '책상 위 3D 온기 유리병 완성',
      content: '우리의 지난 계절들이 차곡차곡 유리병에 담겨 빛나고 있어. 이렇게 모인 편지들을 보니 마음이 뭉클하다.',
      photos: ['https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80'],
      waxColor: '#C47B6A',
      createdAt: '2026-10-05T19:00:00.000Z',
      mission: { type: 'TEXT', prompt: '오늘의 감사', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-10-05T20:00:00.000Z',
    },
    {
      diaryId: `diary_${roomCode}_10_02`,
      authorId: partnerUid,
      authorName: '지은',
      recipientId: creatorUid,
      recipientName: '민우',
      title: '가장 따뜻한 10월의 약속',
      content: '앞으로도 매달 새로운 유리병을 아름다운 온기로 가득 채워나가자. 사랑해 민우야!',
      photos: [],
      waxColor: '#6B1724',
      createdAt: '2026-10-09T14:30:00.000Z',
      mission: { type: 'TEXT', prompt: '마음 전하기', isPassed: true },
      isWaxBroken: true,
      openedAt: '2026-10-09T15:00:00.000Z',
    },
  ];

  for (const d of sampleDiaries) {
    await setDoc(doc(db, 'rooms', roomCode, 'diaries', d.diaryId), d);
  }

  await updateDoc(doc(db, 'rooms', roomCode), {
    latestDiaryId: sampleDiaries[sampleDiaries.length - 1].diaryId,
  });

  console.log('\n=============================================');
  console.log(`🎉 [시연 준비 완료] 방 코드: ${roomCode}`);
  console.log('=============================================\n');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
