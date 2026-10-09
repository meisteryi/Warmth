/**
 * 온기 웹 앱 스크롤 상단 초기화 유틸리티
 * 새 창(일기 열람, 서재에서 일기 선택, 모달 진입, 홈 복귀 등) 진입 시
 * 이전 화면이나 외부(메인 컨테이너 및 윈도우)의 스크롤 위치가 유지되는 현상을 완벽하게 방지합니다.
 */

export function scrollToTopInstant(container?: HTMLElement | null): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  if (container) {
    container.scrollTop = 0;
  }

  if (typeof document !== 'undefined') {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }
}

/**
 * 브라우저 렌더링 프레임 및 framer-motion 애니메이션 지연을 고려하여
 * 마운트 직후 및 연속 프레임에서 상단 위치(0px)를 보장하는 함수
 */
export function forceScrollToTop(container?: HTMLElement | null): () => void {
  scrollToTopInstant(container);

  const rafId = typeof requestAnimationFrame !== 'undefined'
    ? requestAnimationFrame(() => scrollToTopInstant(container))
    : null;

  const timer1 = setTimeout(() => {
    scrollToTopInstant(container);
  }, 40);

  const timer2 = setTimeout(() => {
    scrollToTopInstant(container);
  }, 120);

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    clearTimeout(timer1);
    clearTimeout(timer2);
  };
}
