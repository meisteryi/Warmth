import { 
  getRoomDiariesFromFirestore,
  getOrFetchRoomSalt,
  setCachedRoomSalt
} from '../src/lib/roomService.ts';
import { encryptDiaryData, generateRoomSalt } from '../src/lib/crypto.ts';
import { db, doc, setDoc, updateDoc, getDoc } from '../src/lib/firebase.ts';
import { WEATHER_STAMPS } from '../src/types/diary.ts';

const DEMO_ROOM_CODE = '777777';

async function main() {
  console.log(`🍎 Seeding dedicated Apple Review & Testing room: #${DEMO_ROOM_CODE}...`);

  const uid1 = 'uid_demo_minwoo_01';
  const uid2 = 'uid_demo_seoyeon_02';
  const salt = 'demo_salt_warmth_777777_e2ee';

  const roomRef = doc(db, 'rooms', DEMO_ROOM_CODE);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    // 1-1. WAITING_PARTNER 상태로 생성 (규칙 준수: size == 1, roomSalt 필드)
    await setDoc(roomRef, {
      roomId: DEMO_ROOM_CODE,
      roomCode: DEMO_ROOM_CODE,
      status: 'WAITING_PARTNER',
      currentTurn: '',
      members: [uid1],
      memberInfo: {
        [uid1]: {
          nickname: '민우',
          role: 'CREATOR',
          joinedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
      },
      roomSalt: salt,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    });
    console.log('Room created as WAITING_PARTNER.');
  }

  // 1-2. MATCHED 상태로 업데이트 (파트너 서연 입장)
  await updateDoc(roomRef, {
    status: 'MATCHED',
    currentTurn: '서연',
    members: [uid1, uid2],
    memberInfo: {
      [uid1]: {
        nickname: '민우',
        role: 'CREATOR',
        joinedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      [uid2]: {
        nickname: '서연',
        role: 'PARTNER',
        joinedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    },
  });
  console.log('Room updated to MATCHED.');

  setCachedRoomSalt(DEMO_ROOM_CODE, salt);

  // 2. 5편의 교환일기
  const sampleDiaries = [
    {
      diaryId: `diary_${DEMO_ROOM_CODE}_01`,
      authorId: uid1,
      authorName: '민우',
      recipientId: uid2,
      recipientName: '서연',
      title: '서재 책상 위에 놓인 다이어리를 보며',
      content: '처음 이 교환일기를 시작했을 때 우리가 나눴던 다정한 눈빛이 아직도 생생해. 오늘 퇴근길에 네 생각이 문득 나서 작은 꽃 한 송이를 샀어. 내일 만나면 건네줄게. 오늘도 고생 많았어 사랑해.',
      photos: [
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#6B1724',
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      mission: {
        type: 'TEXT',
        prompt: '오늘 고생한 서로에게 다정한 한 줄 응원 남기기',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: new Date(Date.now() - 6 * 86400000 + 1800000).toISOString(),
      warmthScore: {
        temperature: 38.2,
        comment: '심장이 두근거리는 다정하고 뜨거운 사랑의 온기',
        keywords: ['#첫일기', '#퇴근길꽃한송이', '#사랑해'],
      },
      stamp: WEATHER_STAMPS[1],
      reaction: {
        emoji: '💐',
        reactorName: '서연',
        reactorId: uid2,
        reactedAt: new Date(Date.now() - 6 * 86400000 + 3600000).toISOString(),
        comment: '퇴근길에 꽃이라니 감동이야 고마워 민우야! 내일 만나요 :)',
      },
    },
    {
      diaryId: `diary_${DEMO_ROOM_CODE}_02`,
      authorId: uid2,
      authorName: '서연',
      recipientId: uid1,
      recipientName: '민우',
      title: '가을비 내리던 날의 돌담길 산책',
      content: '비가 보슬보슬 내리는 서촌 돌담길을 우산 하나 쓰고 나란히 걸었던 날. 네 어깨가 젖지 않게 우산을 기울여주던 네 다정함에 가슴이 뭉클했어. 따뜻한 차 한 잔 마시며 나눈 이야기들이 마음에 오래 남을 것 같아. 고마워 항상.',
      photos: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#B8860B',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      mission: {
        type: 'TEXT',
        prompt: '오늘 가장 기억에 남는 순간 한 줄 적기',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: new Date(Date.now() - 4 * 86400000 + 1800000).toISOString(),
      warmthScore: {
        temperature: 36.9,
        comment: '비 내리는 돌담길을 포근하게 감싸주는 다정한 온기',
        keywords: ['#가을비', '#돌담길산책', '#고마워'],
      },
      stamp: WEATHER_STAMPS[3],
      reaction: {
        emoji: '☕',
        reactorName: '민우',
        reactorId: uid1,
        reactedAt: new Date(Date.now() - 4 * 86400000 + 3600000).toISOString(),
        comment: '그 찻집 빗소리 참 좋았지. 다음 비 오는 날에도 또 가자.',
      },
    },
    {
      diaryId: `diary_${DEMO_ROOM_CODE}_03`,
      authorId: uid1,
      authorName: '민우',
      recipientId: uid2,
      recipientName: '서연',
      title: '밤하늘 별을 보며 나눈 약속',
      content: '야근을 마치고 지친 몸으로 집에 돌아왔는데, 네가 남겨준 편지 한 줄에 모든 피로가 사르르 녹아내렸어. 언제나 내 편이 되어주고 곁에서 웃어줘서 든든해. 우리 다음 주말에는 교외로 별 보러 드라이브 가자. 편안한 밤 보내.',
      photos: [],
      waxColor: '#2E473B',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      mission: {
        type: 'TEXT',
        prompt: '하루를 마무리하며 내게 하고 싶은 말',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: new Date(Date.now() - 3 * 86400000 + 1800000).toISOString(),
      warmthScore: {
        temperature: 37.5,
        comment: '지친 하루의 끝을 따스한 별빛처럼 비춰주는 온기',
        keywords: ['#별빛약속', '#야근위로', '#밤편지'],
      },
      stamp: WEATHER_STAMPS[2],
    },
    {
      diaryId: `diary_${DEMO_ROOM_CODE}_04`,
      authorId: uid2,
      authorName: '서연',
      recipientId: uid1,
      recipientName: '민우',
      title: '작은 베이커리에서 마주친 행복',
      content: '주말 아침 골목길 작은 빵집에서 갓 구운 바게트 향기가 가득했어. 네가 좋아하는 크루아상을 골라 담으면서 네 생각에 혼자 미소 지었어. 주말 아침마다 이렇게 소소하고 따스한 행복을 함께 나눌 수 있어서 감사해.',
      photos: [
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#8C4B64',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      mission: {
        type: 'TEXT',
        prompt: '오늘 상대방 덕분에 웃었던 기억',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: new Date(Date.now() - 2 * 86400000 + 1800000).toISOString(),
      warmthScore: {
        temperature: 39.1,
        comment: '갓 구운 빵 냄새처럼 고소하고 달콤한 사랑의 온기',
        keywords: ['#주말아침', '#크루아상', '#소소한행복'],
      },
      stamp: WEATHER_STAMPS[0],
    },
    {
      diaryId: `diary_${DEMO_ROOM_CODE}_05`,
      authorId: uid1,
      authorName: '민우',
      recipientId: uid2,
      recipientName: '서연',
      title: '서로에게 건네는 따뜻한 온기',
      content: '벌써 다섯 번째 편지네. 매일 밤 너한테 편지를 쓸 생각을 하면 하루가 더 소중하고 애틋하게 느껴져. 환절기 감기 조심하고, 오늘 밤도 이불 포근하게 덮고 좋은 꿈꿔. 사랑해 많이.',
      photos: [],
      waxColor: '#6B1724',
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      mission: {
        type: 'TEXT',
        prompt: '오늘 밤 서로에게 전하고 싶은 따뜻한 한마디',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: new Date(Date.now() - 1 * 86400000 + 1800000).toISOString(),
      warmthScore: {
        temperature: 38.6,
        comment: '환절기 찬바람을 녹이는 다정하고 깊은 사랑의 온기',
        keywords: ['#소중한하루', '#좋은꿈', '#사랑해', '#고마워'],
      },
      stamp: WEATHER_STAMPS[6],
    },
  ];

  for (const d of sampleDiaries) {
    const encrypted = await encryptDiaryData(DEMO_ROOM_CODE, d, salt);
    const dRef = doc(db, `rooms/${DEMO_ROOM_CODE}/diaries/${d.diaryId}`);
    await setDoc(dRef, encrypted);
    console.log(`  -> Stored & Encrypted: 「${d.title}」 by ${d.authorName}`);
  }

  await updateDoc(roomRef, {
    latestDiaryId: sampleDiaries[sampleDiaries.length - 1].diaryId,
  });

  console.log(`✅ Demo room #${DEMO_ROOM_CODE} successfully created & populated!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to seed demo room:', err);
  process.exit(1);
});
