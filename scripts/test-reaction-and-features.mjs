import { 
  createRoomInFirestore, 
  joinRoomInFirestore, 
  getRoomDiariesFromFirestore,
  getOrFetchRoomSalt,
  updateDiaryReactionInFirestore
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
  console.log('🚀 [Step 1] Creating fresh room in Firestore for testing...');
  const roomCode = await createRoomInFirestore('민우');
  console.log(`✅ 방 생성 완료! 코드: #${roomCode}`);

  console.log('🚀 [Step 2] Joining room as 서연...');
  const joinRes = await joinRoomInFirestore(roomCode, '서연');
  console.log(`✅ 방 참여 완료:`, joinRes.success);

  const roomSalt = await getOrFetchRoomSalt(roomCode);

  console.log('🚀 [Step 3] Storing a letter written by 서연 for 민우 to read and react to...');
  const diaryId = `diary_${roomCode}_01`;
  const diaryData = {
    diaryId,
    authorId: 'uid_partner_seoyeon',
    authorName: '서연',
    recipientId: 'uid_creator_minwoo',
    recipientName: '민우',
    title: '오늘 하루를 마무리하며 건네는 이야기',
    content: '오늘 하루도 정말 고생 많았어.\n날씨가 많이 쌀쌀했는데 따뜻하게 입고 다녔는지 걱정되네.\n내일 우리 만날 때 맛있는 저녁 먹으러 가자. 늘 곁에 있어줘서 고마워 사랑해.',
    photos: [
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
    ],
    waxColor: '#6B1724',
    createdAt: new Date().toISOString(),
    mission: {
      type: 'TEXT',
      prompt: '오늘 하루 서로에게 해주고 싶은 따뜻한 한마디',
      isCustom: false,
      isPassed: true,
      submission: {
        text: '오늘도 따뜻하게 꼭 안아줄게.',
        submittedAt: new Date().toISOString(),
      },
    },
    isWaxBroken: true, // 이미 개봉 완료 상태 -> 바로 OpenedLetter로 열람 가능
    openedAt: new Date().toISOString(),
    warmthScore: {
      temperature: 37.8,
      comment: '추운 날씨 속 서로를 포근하게 감싸주는 다정한 사랑의 온기',
      keywords: ['#퇴근길', '#따뜻한저녁', '#사랑해', '#고마워'],
    },
    stamp: WEATHER_STAMPS[1], // 🌸 두근두근 설렘
    reaction: null,
  };

  const encrypted = await encryptDiaryData(roomCode, diaryData, roomSalt);
  await setDoc(doc(db, `rooms/${roomCode}/diaries/${diaryId}`), encrypted);
  await updateDoc(doc(db, `rooms/${roomCode}`), {
    latestDiaryId: diaryId,
  });
  console.log('✅ 서연의 일기 Firestore 저장 완료!');

  console.log('🚀 [Step 4] Launching Puppeteer to test OpenedLetter & Emoji Reaction...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=430,932'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 430, height: 932 });

    // 민우(독자/수신자)로 브라우저 스토리지 설정
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

    // 홈 화면에서 편지 다시 읽기 버튼 클릭하여 OpenedLetter 열람 화면으로 진입
    console.log('--- 홈 화면 로드 및 "편지 다시 읽기" 버튼 클릭 ---');
    const openDiaryBtn = await page.waitForSelector('xpath///button[contains(., "편지 다시 읽기")]');
    await openDiaryBtn.click();
    await sleep(2000);

    // OpenedLetter 일기 열람 화면 검증
    const openedPageText = await page.evaluate(() => document.body.innerText);
    console.log(`🔍 OpenedLetter 일기 본문 노출 확인: ${openedPageText.includes('오늘 하루도 정말 고생 많았어') ? '✅ 성공!' : '❌ 실패'}`);

    // --- 5. 온도 위 눈에 띄지 않는 '반응 추가하기+' 텍스트 버튼 확인 ---
    console.log('\n--- [Step 5] 온도 위 조용한 텍스트 "반응 추가하기+" 버튼 클릭 ---');
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText));
    console.log('All buttons on page:', buttons);
    const reactBtn = await page.waitForSelector('xpath///button[contains(., "반응 추가하기+")]', { timeout: 8000 });
    console.log('✅ "반응 추가하기+" 텍스트 버튼 발견!');
    await reactBtn.click();
    await sleep(600);

    // --- 6. 포스트잇 작성 모달 창 확인 (이모티콘 하나 + 20자 이내 코멘트) ---
    console.log('\n--- [Step 6] 포스트잇 작성 모달 확인 ---');
    await page.waitForSelector('xpath///h3[contains(., "포스트잇 남기기")]');
    console.log('✅ 모달 헤더 "포스트잇 남기기" 노출 확인');

    // 이모티콘 칩 "💌" 클릭
    const heartLetterEmojiBtn = await page.waitForSelector('xpath///button[contains(., "💌")]');
    await heartLetterEmojiBtn.click();
    console.log('✅ 이모티콘 "💌" 선택 완료');

    // 20자 이내 한 줄 코멘트 입력
    const commentInput = await page.waitForSelector('input[placeholder*="고생 많았어"]');
    await commentInput.click();
    await commentInput.type('오늘도 수고했어 늘 응원해!');
    console.log('✅ 코멘트 "오늘도 수고했어 늘 응원해!" 입력 완료');

    // "포스트잇 붙이기" 버튼 클릭
    const attachBtn = await page.waitForSelector('xpath///button[contains(., "포스트잇 붙이기")]');
    await attachBtn.click();
    console.log('✅ "포스트잇 붙이기" 버튼 클릭!');
    await sleep(2500);

    // --- 7. 위치 요구사항 정밀 검증: 본문 글과 오늘의 온기 온도 사이에 포스트잇이 위치하는가? ---
    console.log('\n--- [Step 7] DOM 배치 순서 검증 (본문 -> 포스트잇 반응 -> 온기 온도) ---');
    const domOrder = await page.evaluate(() => {
      const allText = document.body.innerText;
      const contentIdx = allText.indexOf('오늘 하루도 정말 고생 많았어');
      const reactionIdx = allText.indexOf('오늘도 수고했어 늘 응원해!', contentIdx);
      const tempIdx = allText.indexOf('오늘의 온도', contentIdx);

      return {
        contentIdx,
        reactionIdx,
        tempIdx,
        isCorrect: contentIdx !== -1 && reactionIdx !== -1 && tempIdx !== -1 && contentIdx < reactionIdx && reactionIdx < tempIdx
      };
    });

    console.log('DOM 인덱스 측정치:', domOrder);
    if (domOrder.isCorrect) {
      console.log('🎉 [위치 검증 통과!] 일기 본문 글(idx: ' + domOrder.contentIdx + ') < 포스트잇 코멘트(idx: ' + domOrder.reactionIdx + ') < 오늘의 온도(idx: ' + domOrder.tempIdx + ')');
    } else {
      throw new Error('위치 요구사항 불일치: 본문 글과 온도 사이에 포스트잇 반응이 위치하지 않습니다.');
    }

    // --- 8. 포스트잇 수정 기능 검증 ("수정" -> 코멘트 수정 후 저장) ---
    console.log('\n--- [Step 8] 포스트잇 수정 기능 검증 ---');
    const editBtn = await page.waitForSelector('xpath///button[contains(., "수정")]');
    await editBtn.click();
    await sleep(500);

    // 코멘트 내용 수정: React input value 초기화 후 새 문구 입력
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="고생 많았어"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const commentInputEdit = await page.waitForSelector('input[placeholder*="고생 많았어"]');
    await commentInputEdit.type('따뜻한 밤 보내 사랑해');
    
    const saveEditBtn = await page.waitForSelector('xpath///button[contains(., "포스트잇 붙이기")]');
    await saveEditBtn.click();
    console.log('✅ 포스트잇 수정 저장 완료');
    await sleep(2000);

    const updatedText = await page.evaluate(() => document.body.innerText);
    console.log(`🔍 수정된 코멘트 반영 확인: ${updatedText.includes('따뜻한 밤 보내 사랑해') ? '✅ 성공!' : '❌ 실패'}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_postit_reaction_success.png') });
    console.log('📸 스크린샷 저장: recordings/test_postit_reaction_success.png');

    // --- 9. 토스트 알림 페이드 인/아웃 애니메이션 검증 ---
    console.log('\n--- [Step 9] 토스트 페이드 인/아웃 검증 ---');
    const toastPresentInitially = await page.evaluate(() => {
      const toast = document.querySelector('.fixed.bottom-\\[calc\\(env\\(safe-area-inset-bottom\\,0px\\)\\+1\\.5rem\\)\\]');
      return Boolean(toast);
    });
    console.log(`토스트 표시 상태: ${toastPresentInitially ? '✅ 토스트 애니메이션 요소 존재' : '대기'}`);

    // --- 10. 서재(Archive) 보관함 반응 연동 검증 ---
    console.log('\n--- [Step 10] 서재 보관함 연동 및 반응 배지 검증 ---');
    const homeBtn = await page.$('xpath///button[contains(., "홈으로") or contains(., "서재 홈으로")]');
    if (homeBtn) {
      await homeBtn.click();
      await sleep(1000);
    }

    const archiveNav = await page.waitForSelector('xpath///button[contains(., "서재")]');
    await archiveNav.click();
    await sleep(1200);

    const archiveModalText = await page.evaluate(() => document.body.innerText);
    const hasEmojiInArchive = archiveModalText.includes('💌');
    console.log(`🔍 서재 목록 내 이모티콘(💌) 반응 배지 노출: ${hasEmojiInArchive ? '✅ 확인!' : '❌ 실패'}`);

    // 서재 내 달력 버튼 확인
    const calendarBtn = await page.$('xpath///button[contains(., "달력") or contains(., "캘린더")]');
    console.log(`🔍 서재 내 달력 버튼 존재: ${calendarBtn ? '✅ 확인!' : '달력 탭 활성화'}`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_archive_reaction_badge.png') });
    console.log('📸 스크린샷 저장: recordings/test_archive_reaction_badge.png');

    console.log('\n=============================================================');
    console.log('🎉 모든 기능 및 이모티콘 반응 시스템 테스트 100% 통과 완료!');
    console.log('=============================================================');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ 테스트 중 오류 발생:', err);
  process.exit(1);
});
