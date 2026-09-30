import puppeteer from 'puppeteer-core';
import path from 'path';

const SCREENSHOTS_DIR = '/Users/yijoohyoung/.gemini/antigravity-ide/brain/a5db37b1-28ff-4ea3-a82f-5b3c26a9bea6/screenshots';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🧪 Testing SAME BROWSER CONTEXT (2 Pages in same Chrome sharing localStorage)...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=430,932'],
  });

  try {
    // Both pages in the DEFAULT browser context (NO ?user= query param, sharing localStorage!)
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();

    await page1.setViewport({ width: 430, height: 932 });
    await page2.setViewport({ width: 430, height: 932 });

    page1.on('dialog', async (d) => {
      console.log('Page 1 Dialog:', d.message());
      await d.dismiss();
    });
    page2.on('dialog', async (d) => {
      console.log('Page 2 Dialog:', d.message());
      await d.dismiss();
    });

    const nameInputSelector = 'input[placeholder*="민우, 서연"]';

    // Step 1: Page 1 (Creator) creates room
    console.log('\n--- Step 1: Page 1 (주형) creates room at plain localhost:3000 ---');
    await page1.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page1.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page1.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await sleep(500);

    await page1.waitForSelector(nameInputSelector);
    await page1.evaluate((sel) => {
      const input = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '주형');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, nameInputSelector);
    await sleep(300);

    const generateBtn = await page1.waitForSelector('xpath///button[contains(., "초대코드 발급받기")]');
    await generateBtn.click();

    await page1.waitForSelector('.font-mono.text-4xl, .font-mono.text-5xl');
    const codeElement = await page1.$('.font-mono.text-4xl, .font-mono.text-5xl');
    const roomCode = (await page1.evaluate((el) => el.textContent, codeElement)).trim();
    console.log(`✅ Page 1 created room! Code: #${roomCode}`);
    console.log('Page 1 is now on the waiting screen.');

    // Step 2: Page 2 (Partner) joins room in the SAME browser
    console.log('\n--- Step 2: Page 2 (유라) joins room in SAME browser context (no ?user= param) ---');
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await sleep(500);

    const joinTab = await page2.waitForSelector('xpath///button[contains(., "초대코드 입력하기")]');
    await joinTab.click();
    await sleep(300);

    const nameInput2 = await page2.waitForSelector(nameInputSelector);
    await page2.evaluate((sel) => {
      const input = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '유라');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, nameInputSelector);

    await page2.waitForSelector('input[maxLength="6"]');
    await page2.evaluate((code) => {
      const input = document.querySelector('input[maxLength="6"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, code);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, roomCode);
    await sleep(300);

    const joinSubmitBtn = await page2.waitForSelector('xpath///button[contains(., "일기장 연결하기")]');
    await joinSubmitBtn.click();

    console.log('Page 2 clicked join. Waiting for match synchronization (2s)...');
    await sleep(3000);

    // Step 3: Verify Page 1 (방장) automatically transitioned
    console.log('\n--- Step 3: Verify Page 1 (방장) auto-transitioned from waiting screen ---');
    const page1Text = await page1.evaluate(() => document.body.innerText);
    const page1Transitioned = !page1Text.includes('초대 코드가 발급되었습니다') && page1Text.includes('상대방의 첫 온기를 기다리고 있어요');
    console.log(`🔍 [Page 1 - 방장] 대기 화면 탈출 및 서재 자동 진입: ${page1Transitioned ? '✅ 성공!' : '❌ 실패 (여전히 대기화면)'}`);

    // Step 4: Verify Page 2 (참여자) has first turn to write
    console.log('\n--- Step 4: Verify Page 2 (참여자) role & first turn ---');
    const page2Text = await page2.evaluate(() => document.body.innerText);
    const page2IsFirstWriter = page2Text.includes('첫 번째 온기를 띄워보세요') && page2Text.includes('첫 편지 쓰기');
    console.log(`🔍 [Page 2 - 참여자] 첫 편지 작성자 권한 정상 부여: ${page2IsFirstWriter ? '✅ 성공!' : '❌ 실패'}`);

    // Step 5: Refresh Page 1 (방장) and verify it does NOT become Page 2!
    console.log('\n--- Step 5: Refresh Page 1 and verify it retains 방장 (주형) state ---');
    await page1.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);

    const page1ReloadedText = await page1.evaluate(() => document.body.innerText);
    const page1IsStillCreator = page1ReloadedText.includes('상대방의 첫 온기를 기다리고 있어요') && !page1ReloadedText.includes('첫 번째 온기를 띄워보세요');
    console.log(`🔍 [Page 1 - 새로고침 후] 방장 역할 유지 여부: ${page1IsStillCreator ? '✅ 방장 역할 완벽 유지!' : '❌ 실패 (참여자 화면으로 덮어씌워짐)'}`);

    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_same_browser_page1_after_reload.png') });
    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test_same_browser_page2.png') });

    if (page1Transitioned && page2IsFirstWriter && page1IsStillCreator) {
      console.log('\n🎉 ALL SAME-BROWSER MULTI-TAB TESTS PASSED PERFECTLY!');
    } else {
      throw new Error(`Test assertion failed. page1Transitioned=${page1Transitioned}, page2IsFirstWriter=${page2IsFirstWriter}, page1IsStillCreator=${page1IsStillCreator}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
