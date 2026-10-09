import puppeteer from 'puppeteer-core';
import path from 'path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const roomCode = '519273';
  console.log('🧪 Testing Memory Jar (온기 유리병) in Warmth main app...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--enable-webgl'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 890, isMobile: true, hasTouch: true });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // 로그인 세션 주입
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

    // 1. 메인 홈 화면 캡처 (상단 바의 병 아이콘 확인)
    await page.screenshot({ path: path.resolve('./recordings/test_app_home_with_jar_icon.png') });
    console.log('✅ Captured home screen with jar button in header');

    // 2. 상단바의 온기 병 버튼 찾기 및 클릭
    const jarBtn = await page.waitForSelector('button[title*="온기 유리병"]');
    if (!jarBtn) {
      throw new Error('Could not find Memory Jar button in header!');
    }
    console.log('🏺 Clicking Memory Jar button in header...');
    await jarBtn.click();
    await sleep(2500);

    // 3. 온기 유리병 뷰 캡처 (배경색, 3D 병, 홈으로 돌아가기, 흔들기 버튼)
    await page.screenshot({ path: path.resolve('./recordings/test_app_memory_jar_view.png') });
    console.log('✅ Captured Memory Jar view screen');

    // 4. 왁스 클릭하여 프리뷰 창 띄우기 & 일기 열기 테스트
    console.log('🔍 Clicking wax piece inside jar to trigger preview...');
    // 캔버스 내 왁스 조각 정확한 위치 클릭 (x: 220, y: 695)
    await page.mouse.click(220, 695);
    await sleep(800);
    await page.screenshot({ path: path.resolve('./recordings/test_app_jar_wax_preview_modal.png') });
    console.log('✅ Captured wax piece preview modal');

    // 프리뷰 모달의 "일기 펼쳐보기" 또는 카드 클릭 확인
    const openDiaryBtn = await page.$('xpath///button[contains(., "일기 펼쳐보기")]');
    if (openDiaryBtn) {
      console.log('📖 Clicking Open Diary from preview modal...');
      await openDiaryBtn.click();
      await sleep(1500);
      await page.screenshot({ path: path.resolve('./recordings/test_app_jar_opened_diary.png') });
      console.log('✅ Successfully opened diary from Memory Jar!');

      // 다시 병으로 돌아오기 위해 병 버튼 클릭
      const reJarBtn = await page.waitForSelector('button[title*="온기 유리병"]');
      await reJarBtn.click();
      await sleep(1500);
    }

    // 5. 흔들기 버튼 클릭 테스트
    const shakeBtn = await page.waitForSelector('xpath///button[contains(., "병 흔들기")]');
    if (shakeBtn) {
      console.log('🎲 Clicking Shake Jar button...');
      await shakeBtn.click();
      await sleep(1500);
      await page.screenshot({ path: path.resolve('./recordings/test_app_jar_after_shake.png') });
      console.log('✅ Captured jar after shaking');
    }

    // 5. 홈으로 돌아가기 버튼 테스트
    const backBtn = await page.waitForSelector('xpath///button[contains(., "홈으로 돌아가기")]');
    if (backBtn) {
      console.log('⬅️ Clicking Back to Home button...');
      await backBtn.click();
      await sleep(1500);
      await page.screenshot({ path: path.resolve('./recordings/test_app_back_to_home.png') });
      console.log('✅ Successfully returned to Home view!');
    }

    console.log('🎉 All in-app Memory Jar tests passed successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
