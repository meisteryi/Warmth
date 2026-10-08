import { 
  createRoomInFirestore, 
  joinRoomInFirestore, 
  getOrFetchRoomSalt,
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
  console.log('🚀 [Step 1] Creating fresh room in Firestore for custom photo stamp test...');
  const roomCode = await createRoomInFirestore('민우');
  console.log(`✅ 방 생성 완료! 코드: #${roomCode}`);

  console.log('🚀 [Step 2] Joining room as 서연...');
  await joinRoomInFirestore(roomCode, '서연');
  const roomSalt = await getOrFetchRoomSalt(roomCode);

  console.log('🚀 [Step 3] Storing a letter with PUZZLE_STAMP and photo...');
  const diaryId = `diary_${roomCode}_01`;
  const diaryData = {
    diaryId,
    authorId: 'uid_partner_seoyeon',
    authorName: '서연',
    recipientId: 'uid_creator_minwoo',
    recipientName: '민우',
    title: '나만의 우표 퍼즐 테스트 일기',
    content: '우표 안에 우리가 함께 찍은 사진이 쏙 들어가 있는 특별한 우표야!',
    photos: [
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
    ],
    waxColor: '#6B1724',
    createdAt: new Date().toISOString(),
    mission: {
      type: 'PUZZLE_STAMP',
      prompt: '우표 조각 4개를 맞춰 일기를 개봉하세요',
      isCustom: false,
      isPassed: false,
    },
    isWaxBroken: false,
    stamp: WEATHER_STAMPS[0],
    warmthScore: {
      temperature: 36.5,
      comment: '포근한 온기',
      keywords: ['#행복'],
    },
    reaction: null,
  };

  const encrypted = await encryptDiaryData(roomCode, diaryData, roomSalt);
  await setDoc(doc(db, `rooms/${roomCode}/diaries/${diaryId}`), encrypted);
  await updateDoc(doc(db, `rooms/${roomCode}`), {
    latestDiaryId: diaryId,
  });
  console.log('✅ 편지 저장 완료!');

  console.log('🚀 [Step 4] Launching Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=430,932'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 430, height: 932 });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.evaluate((code) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('warmth_active_room_code', code);
      localStorage.setItem('warmth_active_user_name', '민우');
      localStorage.setItem('warmth_active_partner_name', '서연');
      localStorage.setItem('warmth_active_user_role', 'CREATOR');
      sessionStorage.setItem('warmth_active_room_code', code);
      sessionStorage.setItem('warmth_active_user_name', '민우');
      sessionStorage.setItem('warmth_active_partner_name', '서연');
      sessionStorage.setItem('warmth_active_user_role', 'CREATOR');
    }, roomCode);

    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);

    // 1. 홈 화면에서 '편지 열어보기' 클릭
    console.log('--- 홈 화면에서 "편지 열어보기" 클릭 ---');
    const openDiaryBtn = await page.waitForSelector('xpath///button[contains(., "편지 열어보기")]');
    await openDiaryBtn.click();
    await sleep(2000);

    // 2. 봉투 화면에서 '오늘의 미션 확인하고 봉인 풀기' 클릭
    console.log('--- 봉투 화면에서 "오늘의 미션 확인하고 봉인 풀기" 클릭 ---');
    const missionBtn = await page.waitForSelector('xpath///button[contains(., "미션 확인") or contains(., "봉인 풀기")]');
    await missionBtn.click();
    await sleep(2500);

    // 미션 모달에서 우표 퍼즐이 노출되는지 확인
    console.log('--- 미션 모달 확인 및 우표 내 커스텀 사진 이미지 요소 검증 ---');
    const hasCustomImageInStamp = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('image'));
      return images.some(img => img.getAttribute('href')?.includes('unsplash'));
    });
    console.log(`🔍 우표 내 커스텀 사진 image 요소 확인: ${hasCustomImageInStamp ? '✅ 성공!' : '❌ 실패'}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_custom_photo_stamp_modal.png') });
    console.log('📸 스크린샷 저장: recordings/test_custom_photo_stamp_modal.png');

    console.log('\n=============================================================');
    console.log('🎉 나만의 사진 우표 직소 퍼즐 검증 완료!');
    console.log('=============================================================');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ 테스트 오류:', err);
  process.exit(1);
});
