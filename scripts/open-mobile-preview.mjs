import puppeteer from 'puppeteer-core';
import path from 'path';

async function main() {
  const roomCode = '519273';
  console.log('🚀 Launching real mobile-sized Chrome window on macOS...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=440,950',
      '--app=http://localhost:3000',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await page.setViewport({ width: 412, height: 890, isMobile: true, hasTouch: true });

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
  await new Promise((r) => setTimeout(r, 2000));

  // 1. 편지 열어보기 클릭
  const openBtn = await page.waitForSelector('xpath///button[contains(., "편지 열어보기")]');
  await openBtn.click();
  await new Promise((r) => setTimeout(r, 1500));

  // 2. 오늘의 미션 확인하고 봉인 풀기 클릭
  const missionBtn = await page.waitForSelector('xpath///button[contains(., "미션 확인") or contains(., "봉인 풀기")]');
  await missionBtn.click();
  await new Promise((r) => setTimeout(r, 1500));

  // 3. 미션 모달 스크린샷 캡처
  await page.screenshot({ path: path.resolve('./recordings/mobile_mission_modal_preview.png') });
  console.log('✅ Mobile preview window is open, and screenshot saved at recordings/mobile_mission_modal_preview.png');
}

main().catch(console.error);
