import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/yijoohyoung/.gemini/antigravity-ide/brain/a5db37b1-28ff-4ea3-a82f-5b3c26a9bea6';

async function main() {
  console.log('🚀 Verifying UGC EULA & Demo Room flow with Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // 1. 약관 보기 클릭
  console.log('Clicking "약관 보기"...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('약관 보기'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_eula_modal.png') });
  console.log('📸 1. Captured web_eula_modal.png');

  // 약관 모달 닫기
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('확인 및 닫기'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 2. 심사용 둘러보기 방 1초 입장 클릭
  console.log('Clicking "#777777 둘러보기 방"...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent?.includes('#777777'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_demo_room_desk.png') });
  console.log('📸 2. Captured web_demo_room_desk.png');

  // 3. 책상 위 편지 클릭하여 일기 열람 모드로 진입
  console.log('Opening diary letter...');
  await page.evaluate(() => {
    const clickable = document.querySelector('[data-testid="desk-letter"]') || document.querySelector('button[title*="일기"]');
    if (clickable) {
      clickable.click();
    } else {
      const allDivs = Array.from(document.querySelectorAll('div, button'));
      const letter = allDivs.find(d => d.textContent?.includes('도착한 편지') || d.textContent?.includes('개봉'));
      if (letter) letter.click();
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_diary_opened.png') });
  console.log('📸 3. Captured web_diary_opened.png');

  await browser.close();
  console.log('🎉 Done!');
}

main().catch(console.error);
