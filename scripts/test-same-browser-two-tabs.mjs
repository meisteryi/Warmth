import puppeteer from 'puppeteer-core';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve('recordings');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🧪 Testing SAME BROWSER CONTEXT (2 Pages in same Chrome sharing localStorage)...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=430,932'],
  });

  try {
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();

    await page1.setViewport({ width: 430, height: 932 });
    await page2.setViewport({ width: 430, height: 932 });

    const nameInputSelector = 'input[placeholder*="민우, 서연"]';

    // Step 1: Page 1 (방장) creates room
    console.log('\n--- Step 1: Page 1 (방장) creates room ---');
    await page1.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page1.click(nameInputSelector, { clickCount: 3 });
    await page1.type(nameInputSelector, '민우');

    const generateBtn = await page1.waitForSelector('xpath///button[contains(., "초대코드 발급받기")]');
    await generateBtn.click();

    await page1.waitForSelector('.font-mono.text-4xl, .font-mono.text-5xl');
    const codeEl = await page1.$('.font-mono.text-4xl, .font-mono.text-5xl');
    const roomCode = (await page1.evaluate(el => el.innerText, codeEl)).trim();
    console.log(`✅ Page 1 created room! Code: #${roomCode}`);

    // Step 2: Page 2 (참여자) joins room in SAME browser context
    console.log('\n--- Step 2: Page 2 (참여자) joins room in SAME browser context ---');
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    const joinTab = await page2.waitForSelector('xpath///button[contains(., "초대코드 입력하기")]');
    await joinTab.click();
    await sleep(300);

    const partnerNameInput = await page2.waitForSelector(nameInputSelector);
    await partnerNameInput.click({ clickCount: 3 });
    await partnerNameInput.type('서연');

    const codeInput = await page2.waitForSelector('input[maxLength="6"]');
    await codeInput.type(roomCode);

    const joinSubmitBtn = await page2.waitForSelector('xpath///button[contains(., "일기장 연결하기")]');
    await joinSubmitBtn.click();

    console.log('Page 2 clicked join. Waiting for match sync (3s)...');
    await sleep(3500);

    // Step 3: Verify Page 1 (방장) automatically transitioned
    console.log('\n--- Step 3: Verify Page 1 (방장) auto-transitioned from waiting screen ---');
    const page1Text = await page1.evaluate(() => document.body.innerText);
    const page1WaitingExited = !page1Text.includes('초대 코드가 발급되었습니다');
    const page1HasCreatorDesk = page1Text.includes('상대방의 첫 온기를 기다리고 있어요') || page1Text.includes('답장 대기 중');
    console.log(`🔍 [Page 1 - 방장] 대기 화면 탈출 여부: ${page1WaitingExited ? '✅ 성공!' : '❌ 실패'}`);
    console.log(`🔍 [Page 1 - 방장] 방장 서재 화면 표시 여부: ${page1HasCreatorDesk ? '✅ 성공!' : '❌ 실패'}`);

    // Step 4: Verify Page 2 (참여자) has first turn to write
    console.log('\n--- Step 4: Verify Page 2 (참여자) role & first turn ---');
    const page2Text = await page2.evaluate(() => document.body.innerText);
    const page2IsFirstWriter = page2Text.includes('첫 번째 온기를 띄워보세요') || page2Text.includes('첫 편지 쓰기');
    console.log(`🔍 [Page 2 - 참여자] 첫 편지 작성자 권한 정상 부여: ${page2IsFirstWriter ? '✅ 성공!' : '❌ 실패'}`);

    // Step 5: Refresh Page 1 (방장) and verify it does NOT become Page 2!
    console.log('\n--- Step 5: Refresh Page 1 and verify it retains 방장 state ---');
    await page1.reload({ waitUntil: 'networkidle2' });
    await sleep(2000);

    const page1ReloadedText = await page1.evaluate(() => document.body.innerText);
    const page1IsStillCreator = page1ReloadedText.includes('상대방의 첫 온기를 기다리고 있어요') && !page1ReloadedText.includes('첫 번째 온기를 띄워보세요');
    console.log(`🔍 [Page 1 - 새로고침 후] 방장 역할 유지 여부: ${page1IsStillCreator ? '✅ 방장 역할 완벽 유지!' : '❌ 실패 (참여자 화면으로 덮어씌워짐)'}`);

    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_same_browser_page1_reloaded.png') });
    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_same_browser_page2_partner.png') });

    if (page1WaitingExited && page1HasCreatorDesk && page2IsFirstWriter && page1IsStillCreator) {
      console.log('\n🎉 ALL SAME-BROWSER MULTI-TAB TESTS PASSED WITH 100% SUCCESS!');
    } else {
      throw new Error(`Test assertion failed: page1WaitingExited=${page1WaitingExited}, page1HasCreatorDesk=${page1HasCreatorDesk}, page2IsFirstWriter=${page2IsFirstWriter}, page1IsStillCreator=${page1IsStillCreator}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
