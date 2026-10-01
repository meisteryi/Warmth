import { 
  createRoomInFirestore, 
  joinRoomInFirestore, 
  getRoomDiariesFromFirestore,
  getOrFetchRoomSalt
} from '../src/lib/roomService.ts';
import { encryptDiaryData } from '../src/lib/crypto.ts';
import { db, doc, setDoc, updateDoc } from '../src/lib/firebase.ts';
import { WEATHER_STAMPS } from '../src/types/diary.ts';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('./recordings');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Step 1: Creating room in Firestore...');
  const roomCode = await createRoomInFirestore('주형');
  console.log(`✅ Room created with code: #${roomCode}`);

  console.log('🚀 Step 2: Joining room as 유라...');
  const joinRes = await joinRoomInFirestore(roomCode, '유라');
  console.log(`✅ Joined room:`, joinRes.success);

  const roomSalt = await getOrFetchRoomSalt(roomCode);

  console.log('🚀 Step 3: Populating 5 realistic historical sample diaries with varied dates, stamps, and photos...');

  const sampleDiaries = [
    {
      diaryId: `diary_${roomCode}_01`,
      authorId: 'uid_joohyoung',
      authorName: '주형',
      recipientId: 'uid_yura',
      recipientName: '유라',
      title: '서재 책상 위에 놓인 다이어리를 보며',
      content: '처음 이 교환일기를 시작했을 때 우리가 나눴던 다정한 눈빛이 아직도 생생해. 오늘 퇴근길에 네 생각이 문득 나서 작은 꽃 한 송이를 샀어. 내일 만나면 건네줄게. 오늘도 고생 많았어 사랑해.',
      photos: [
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#6B1724',
      createdAt: '2026-09-24T20:30:00.000Z',
      mission: {
        type: 'TEXT',
        prompt: '오늘 고생한 서로에게 다정한 한 줄 응원 남기기',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: '2026-09-24T21:00:00.000Z',
      warmthScore: {
        temperature: 38.2,
        comment: '심장이 두근거리는 다정하고 뜨거운 사랑의 온기',
        keywords: ['#첫일기', '#퇴근길꽃한송이', '#사랑해'],
      },
      stamp: WEATHER_STAMPS[1], // 🌸 두근두근 설렘
    },
    {
      diaryId: `diary_${roomCode}_02`,
      authorId: 'uid_yura',
      authorName: '유라',
      recipientId: 'uid_joohyoung',
      recipientName: '주형',
      title: '가을비 내리던 날의 돌담길 산책',
      content: '비가 보슬보슬 내리는 서촌 돌담길을 우산 하나 쓰고 나란히 걸었던 날. 네 어깨가 젖지 않게 우산을 기울여주던 네 다정함에 가슴이 뭉클했어. 따뜻한 차 한 잔 마시며 나눈 이야기들이 마음에 오래 남을 것 같아. 고마워 항상.',
      photos: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#B8860B',
      createdAt: '2026-09-26T21:15:00.000Z',
      mission: {
        type: 'TEXT',
        prompt: '오늘 가장 기억에 남는 순간 한 줄 적기',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: '2026-09-26T21:40:00.000Z',
      warmthScore: {
        temperature: 36.9,
        comment: '비 내리는 돌담길을 포근하게 감싸주는 다정한 온기',
        keywords: ['#가을비', '#돌담길산책', '#고마워'],
      },
      stamp: WEATHER_STAMPS[3], // 🌧️ 촉촉한 빗소리
    },
    {
      diaryId: `diary_${roomCode}_03`,
      authorId: 'uid_joohyoung',
      authorName: '주형',
      recipientId: 'uid_yura',
      recipientName: '유라',
      title: '밤하늘 별을 보며 나눈 약속',
      content: '야근을 마치고 지친 몸으로 집에 돌아왔는데, 네가 남겨준 편지 한 줄에 모든 피로가 사르르 녹아내렸어. 언제나 내 편이 되어주고 곁에서 웃어줘서 든든해. 우리 다음 주말에는 교외로 별 보러 드라이브 가자. 편안한 밤 보내.',
      photos: [],
      waxColor: '#2E473B',
      createdAt: '2026-09-28T22:00:00.000Z',
      mission: {
        type: 'TEXT',
        prompt: '하루를 마무리하며 내게 하고 싶은 말',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: '2026-09-28T22:30:00.000Z',
      warmthScore: {
        temperature: 37.5,
        comment: '지친 하루의 끝을 따스한 별빛처럼 비춰주는 온기',
        keywords: ['#별빛약속', '#야근위로', '#밤편지'],
      },
      stamp: WEATHER_STAMPS[2], // 🌙 고요한 밤하늘
    },
    {
      diaryId: `diary_${roomCode}_04`,
      authorId: 'uid_yura',
      authorName: '유라',
      recipientId: 'uid_joohyoung',
      recipientName: '주형',
      title: '햇살 눈부셨던 주말 한강 피크닉',
      content: '도시락 맛있게 먹어줘서 정말 뿌듯했어! 잔디밭에 돗자리 펴고 누워서 너랑 하늘 바라보던 시간이 이번 주 최고의 행복이었어. 바람도 시원하고 네 웃음소리도 예뻤던 날. 오래오래 기억하고 싶어.',
      photos: [
        'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80',
      ],
      waxColor: '#6B1724',
      createdAt: '2026-09-29T21:40:00.000Z',
      mission: {
        type: 'TEXT',
        prompt: '오늘 가장 행복했던 순간',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: '2026-09-29T22:00:00.000Z',
      warmthScore: {
        temperature: 39.0,
        comment: '눈부신 햇살처럼 벅차오르는 행복과 사랑의 온기',
        keywords: ['#주말피크닉', '#도시락', '#행복', '#사랑해'],
      },
      stamp: WEATHER_STAMPS[0], // ☀️ 맑고 화창한 날
    },
    {
      diaryId: `diary_${roomCode}_05`,
      authorId: 'uid_joohyoung',
      authorName: '주형',
      recipientId: 'uid_yura',
      recipientName: '유라',
      title: '서로에게 건네는 따뜻한 온기',
      content: '벌써 다섯 번째 편지네. 매일 밤 너한테 편지를 쓸 생각을 하면 하루가 더 소중하고 애틋하게 느껴져. 환절기 감기 조심하고, 오늘 밤도 이불 포근하게 덮고 좋은 꿈꿔. 사랑해 많이.',
      photos: [],
      waxColor: '#6B1724',
      createdAt: '2026-10-01T14:20:00.000Z',
      mission: {
        type: 'TEXT',
        prompt: '오늘 밤 서로에게 전하고 싶은 따뜻한 한마디',
        isCustom: false,
        isPassed: true,
      },
      isWaxBroken: true,
      openedAt: '2026-10-01T14:30:00.000Z',
      warmthScore: {
        temperature: 38.6,
        comment: '환절기 찬바람을 녹이는 다정하고 깊은 사랑의 온기',
        keywords: ['#소중한하루', '#좋은꿈', '#사랑해', '#고마워'],
      },
      stamp: WEATHER_STAMPS[6], // ☕ 수고한 지친 하루
    },
  ];

  console.log('DEBUG db:', db ? typeof db : 'undefined', db?.constructor?.name);
  for (const d of sampleDiaries) {
    console.log('Encrypting diary:', d.diaryId);
    const encrypted = await encryptDiaryData(roomCode, d, roomSalt);
    console.log('Encrypted diary done. Getting doc ref...');
    const dRef = doc(db, `rooms/${roomCode}/diaries/${d.diaryId}`);
    console.log('Doc ref path:', dRef.path);
    await setDoc(dRef, encrypted);
    console.log(`  -> Stored & Encrypted: 「${d.title}」 by ${d.authorName} (${d.stamp.symbol} ${d.stamp.name})`);
  }

  // 최신 일기 ID 업데이트
  await updateDoc(doc(db, `rooms/${roomCode}`), {
    latestDiaryId: sampleDiaries[sampleDiaries.length - 1].diaryId,
  });

  console.log('🚀 Step 4: Verifying getRoomDiariesFromFirestore decryption...');
  const fetched = await getRoomDiariesFromFirestore(roomCode);
  console.log(`✅ Fetched & decrypted ${fetched.length} diaries successfully!`);

  console.log('🚀 Step 5: Launching Puppeteer to test ArchiveModal UI, Report, and Booklet...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 450, height: 900 });

  // 주형의 방으로 localStorage 설정
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate((code) => {
    localStorage.setItem('warmth_active_room_code', code);
    localStorage.setItem('warmth_active_user_name', '주형');
    localStorage.setItem('warmth_active_partner_name', '유라');
    localStorage.setItem('warmth_active_user_role', 'CREATOR');
    sessionStorage.setItem('warmth_active_room_code', code);
    sessionStorage.setItem('warmth_active_user_name', '주형');
    sessionStorage.setItem('warmth_active_partner_name', '유라');
    sessionStorage.setItem('warmth_active_user_role', 'CREATOR');
  }, roomCode);

  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1500);

  // Helper to click element by text
  const clickByText = async (tag, text) => {
    const handle = await page.evaluateHandle((tag, text) => {
      const elements = Array.from(document.querySelectorAll(tag));
      return elements.find(el => el.textContent && el.textContent.includes(text));
    }, tag, text);
    const element = handle.asElement();
    if (!element) {
      throw new Error(`Element <${tag}> containing "${text}" not found`);
    }
    await element.click();
  };

  // 서재(아카이브) 버튼 클릭
  console.log('📖 Opening Archive Modal...');
  const archiveBtn = await page.waitForSelector('button[title*="둘만의 서재"], button[title*="서재"]', { timeout: 10000 });
  await archiveBtn.click();
  await sleep(1500);

  // 1. 일기 보관함 스크린샷
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'archive_list_tab.png') });
  console.log('📸 Captured archive_list_tab.png');

  // 2. 월간 온기 리포트 탭 클릭
  console.log('📊 Clicking Report Tab...');
  await clickByText('button', '월간 온기 리포트');
  await sleep(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'archive_report_tab.png') });
  console.log('📸 Captured archive_report_tab.png');

  // 3. 소책자 PDF / 인쇄 탭 클릭
  console.log('📖 Clicking Booklet Tab...');
  await clickByText('button', '소책자 PDF / 인쇄');
  await sleep(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'archive_booklet_tab.png') });
  console.log('📸 Captured archive_booklet_tab.png');

  // 4. 일기 열람 테스트 (첫 번째 편지 클릭하여 OpenedLetter 뷰 확인)
  console.log('💌 Testing Diary Detail View with Stamp...');
  await clickByText('button', '일기 보관함');
  await sleep(800);

  // 보관함 내 첫 번째 일기의 열람하기 클릭
  await page.evaluate(() => {
    const openBtns = Array.from(document.querySelectorAll('span')).filter(el => el.textContent && el.textContent.trim() === '열람하기');
    if (openBtns.length > 0) {
      // Find parent card or click directly
      const card = openBtns[0].closest('.group');
      if (card) {
        card.click();
      } else {
        openBtns[0].click();
      }
    }
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'opened_letter_with_stamp.png') });
  console.log('📸 Captured opened_letter_with_stamp.png');

  await browser.close();
  console.log('🎉 ALL MULTI-DIARY VERIFICATION STEPS PASSED!');
}

main().catch((e) => {
  console.error('Test error stack:', e?.stack || e);
  process.exit(1);
});
