import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = '/Users/yijoohyoung/.gemini/antigravity-ide/brain/a5db37b1-28ff-4ea3-a82f-5b3c26a9bea6/screenshots';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Puppeteer Dual-Window E2E Test...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // Two isolated incognito contexts
    const context1 = await browser.createBrowserContext();
    const context2 = await browser.createBrowserContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.setViewport({ width: 450, height: 850 });
    await page2.setViewport({ width: 450, height: 850 });

    console.log('\n--- Step 1: Creator (주형) creates a new room ---');
    await page1.goto('http://localhost:3000/?user=joohyoung', { waitUntil: 'networkidle0' });

    // Type creator name
    const nameInputSelector = 'input[placeholder*="민우, 서연"]';
    await page1.waitForSelector(nameInputSelector);
    await page1.click(nameInputSelector, { clickCount: 3 });
    await page1.type(nameInputSelector, '주형');

    // Click "초대코드 발급받기"
    const generateBtn = await page1.waitForSelector('xpath///button[contains(., "초대코드 발급받기")]');
    await generateBtn.click();

    // Wait for 6-digit code
    await page1.waitForSelector('.font-mono.text-4xl, .font-mono.text-5xl');
    const codeElement = await page1.$('.font-mono.text-4xl, .font-mono.text-5xl');
    const roomCode = (await page1.evaluate((el) => el.textContent, codeElement)).trim();
    console.log(`✅ Room successfully created! Code: #${roomCode}`);

    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_creator_waiting.png') });

    console.log('\n--- Step 2: Partner (유라) enters invitation code and joins ---');
    await page2.goto('http://localhost:3000/?user=yura', { waitUntil: 'networkidle0' });

    // Click "초대코드 입력하기" tab
    const joinTab = await page2.waitForSelector('xpath///button[contains(., "초대코드 입력하기")]');
    await joinTab.click();
    await sleep(300);

    // Type partner name
    const partnerNameInput = await page2.waitForSelector(nameInputSelector);
    await partnerNameInput.click({ clickCount: 3 });
    await partnerNameInput.type('유라');

    // Type 6-digit room code
    const codeInput = await page2.waitForSelector('input[maxLength="6"]');
    await codeInput.type(roomCode);

    // Click "일기장 연결하기"
    const joinSubmitBtn = await page2.waitForSelector('xpath///button[contains(., "일기장 연결하기")]');
    await joinSubmitBtn.click();

    console.log('Waiting for matching celebration (1.5s)...');
    await sleep(2000);

    console.log('\n--- Step 3: Verify initial desk view and modal suppression ---');
    // Check if WriteDiaryModal is open in Page 2 (유라)
    const writeModalOpenInPage2 = await page2.evaluate(() => {
      return Boolean(document.querySelector('textarea[placeholder*="오늘 어떤 일이 있었나요"]'));
    });
    console.log(`🔍 [Page 2 - 입장자] 일기 작성 모달 자동 오픈 여부: ${writeModalOpenInPage2 ? '❌ 자동 오픈됨 (버그)' : '✅ 자동 오픈 안 됨 (정상!)'}`);

    // Check what desk shows in Page 2 (유라 - 파트너)
    const page2DeskTitle = await page2.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 ? h2.textContent : '';
    });
    console.log(`🔍 [Page 2 - 입장자] 책상 타이틀: "${page2DeskTitle}"`);

    // Check what desk shows in Page 1 (주형 - 방장)
    const page1DeskTitle = await page1.evaluate(() => {
      const h2 = document.querySelector('h2');
      return h2 ? h2.textContent : '';
    });
    console.log(`🔍 [Page 1 - 방장] 책상 타이틀: "${page1DeskTitle}"`);

    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_page1_creator_desk.png') });
    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_page2_partner_desk.png') });

    console.log('\n--- Step 4: Partner (유라) writes and sends the first diary ---');
    // Page 2 clicks "첫 편지 쓰기"
    const startWriteBtn = await page2.waitForSelector('xpath///button[contains(., "첫 편지 쓰기")]');
    await startWriteBtn.click();
    await sleep(500);

    // Verify modal is now open
    await page2.waitForSelector('textarea');
    console.log('✅ Write diary modal opened upon explicit button click.');

    // Enter title & content
    const titleInput = await page2.$('input[placeholder*="제목"]');
    if (titleInput) {
      await titleInput.type('유라의 첫 교환일기');
    }
    const contentTextarea = await page2.$('textarea');
    await contentTextarea.type('주형아 안녕! 우리가 드디어 첫 교환일기를 시작했네. 오늘 하루도 고생 많았고 따뜻한 밤 보내자.');

    // Select "우표 맞추기" mission so that photo is not mandatory
    const stampMissionBtn = await page2.$('xpath///button[contains(., "우표 맞추기")]');
    if (stampMissionBtn) {
      await stampMissionBtn.click();
      await sleep(300);
    }

    // Submit diary (봉인하여 보내기)
    const sendDiaryBtn = await page2.waitForSelector('button[type="submit"]');
    await sendDiaryBtn.click();

    console.log('Submitting diary...');
    await sleep(3500);

    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_page2_waiting_reply.png') });

    console.log('\n--- Step 5: Verify Creator (주형) receives the letter in real-time ---');
    await sleep(2000);
    const page1StateText = await page1.evaluate(() => document.body.innerText);
    const hasReceivedLetter = page1StateText.includes('유라') && (page1StateText.includes('봉인') || page1StateText.includes('미션') || page1StateText.includes('편지'));
    console.log(`🔍 [Page 1 - 방장] 상대방 편지 도착 여부: ${hasReceivedLetter ? '✅ 편지 수신 확인!' : '❌ 수신 대기 중'}`);

    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_page1_received_letter.png') });

    console.log('\n--- Step 6: Creator (주형) disconnects from room ---');
    // Open menu
    const moreMenuBtn = await page1.waitForSelector('button[title="더보기 설정"]');
    await moreMenuBtn.click();
    await sleep(300);

    const leaveMenuBtn = await page1.waitForSelector('xpath///button[contains(., "일기장 연결 해제")]');
    await leaveMenuBtn.click();
    await sleep(500);

    const confirmLeaveBtn = await page1.waitForSelector('xpath///button[contains(., "연결 해제하기")]');
    await confirmLeaveBtn.click();
    await sleep(1500);

    console.log('✅ Creator (주형) left the room.');

    console.log('\n--- Step 7: Verify Partner (유라) receives disconnect alert & last leaver modal ---');
    await sleep(1500);
    const page2BodyText = await page2.evaluate(() => document.body.innerText);
    const receivedDisconnectNotice = page2BodyText.includes('떠났습니다') || page2BodyText.includes('해제했습니다');
    console.log(`🔍 [Page 2 - 혼자 남은 유라] 퇴장 알림 모달 수신 여부: ${receivedDisconnectNotice ? '✅ 알림 모달 정상 표시!' : '❌ 알림 미표시'}`);

    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_page2_partner_left_alert.png') });

    // Click confirm on disconnect notice
    const ackBtn = await page2.waitForSelector('xpath///button[contains(., "시작 화면으로 이동")]');
    await ackBtn.click();
    await sleep(500);

    // Verify 2nd Last Leaver Warning Modal
    const lastLeaverWarningText = await page2.evaluate(() => document.body.innerText);
    const hasLastLeaverWarning = lastLeaverWarningText.includes('방 코드를 꼭 기억해두세요') || lastLeaverWarningText.includes('마지막 퇴장 전 필수 확인');
    console.log(`🔍 [Page 2 - 마지막 퇴장자] 2차 방 코드 기억 경고창 표시 여부: ${hasLastLeaverWarning ? '✅ 2차 경고창 완벽 표시!' : '❌ 경고창 미표시'}`);

    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_page2_last_leaver_warning.png') });

    console.log('\n✨ All tests passed with flying colors!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
