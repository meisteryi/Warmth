'use client';

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SAMPLE_WAX_PIECES, WaxPieceData, MemoryJarCanvasHandle } from '@/features/memory-jar-3d';

// SSR 방지를 위해 클라이언트 전용 로딩
const MemoryJarCanvas = dynamic(
  () => import('@/features/memory-jar-3d').then((mod) => mod.MemoryJarCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-500">
        <div className="w-10 h-10 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">3D 광학 유리병 & 햇살 셰이더 로딩 중...</span>
      </div>
    ),
  }
);

class Safe3DBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Caught WebGL 3D error in ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-amber-200 gap-3">
          <span className="text-3xl">🏺</span>
          <p className="text-sm font-semibold text-amber-300">
            WebGL 3D 가속을 초기화할 수 없습니다.
          </p>
          <p className="text-xs text-stone-400 max-w-xs leading-relaxed">
            브라우저 설정(시스템 &gt; 가능한 경우 그래픽 가속 사용)을 켜거나 새로고침해 주세요.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function JarPreviewPage() {
  const jarCanvasRef = useRef<MemoryJarCanvasHandle>(null);
  const [pieces, setPieces] = useState<WaxPieceData[]>(SAMPLE_WAX_PIECES);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [enableGyroscope, setEnableGyroscope] = useState<boolean>(true);
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(true);
  const [lastSelected, setLastSelected] = useState<WaxPieceData | null>(null);

  // 테스트용 왁스 조각 추가
  const handleAddPiece = () => {
    const colors = [
      { hex: '#6B1724', label: '딥 버건디' },
      { hex: '#B8860B', label: '앤틱 골드' },
      { hex: '#2E473B', label: '포레스트 그린' },
    ];
    const picked = colors[Math.floor(Math.random() * colors.length)];
    const newPiece: WaxPieceData = {
      id: `wax-test-${Date.now()}`,
      color: picked.hex,
      label: picked.label,
      title: `새로 담긴 온기 조각 #${pieces.length + 1}`,
      date: new Date().toLocaleDateString('ko-KR'),
      authorName: Math.random() > 0.5 ? '민우' : '서연',
      shapeType: 'SEAL_COIN',
      size: 0.95 + Math.random() * 0.2,
    };
    setPieces((prev) => [...prev, newPiece]);
  };

  const handleResetPieces = () => {
    setPieces(SAMPLE_WAX_PIECES);
    setLastSelected(null);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col">
      {/* 상단 격리 안내 헤더 바 */}
      <header className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
            독립 테스트 샌드박스
          </span>
          <h1 className="text-lg font-serif font-bold tracking-tight text-amber-100">
            🏺 3D 온기 유리병 & 실링 왁스 프로토타입
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3.5 py-1.5 text-xs rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white transition-colors"
          >
            ← 메인 서비스(홈)로 이동
          </Link>
        </div>
      </header>

      {/* 안내 배너 */}
      <div className="bg-amber-950/30 border-b border-amber-900/40 px-6 py-2.5 text-xs text-amber-200/90 flex items-center justify-between">
        <p>
          💡 <strong>안내:</strong> 이 페이지는 기존 서비스에 전혀 영향을 주지 않는 별도의 독립 테스트 환경입니다. 모든 3D 에셋과 회전/물리 코드는{' '}
          <code className="text-amber-300 font-mono">src/features/memory-jar-3d/</code>에만 격리되어 있습니다.
        </p>
      </div>

      {/* 메인 뷰포트 영역 */}
      <main className="flex-1 p-4 md:p-8 flex flex-col lg:flex-row items-center justify-center gap-8 max-w-7xl mx-auto w-full">
        {/* 왼쪽: 3D 캔버스 뷰포트 (모바일 프레임 또는 전체 화면) */}
        <div className="flex flex-col items-center justify-center w-full lg:w-auto">
          <div
            className={`transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl border border-stone-700/80 bg-gradient-to-b from-stone-800/90 via-stone-900 to-stone-950 flex flex-col relative ${
              isMobileFrame
                ? 'w-[360px] h-[640px] max-w-full'
                : 'w-full max-w-3xl h-[580px]'
            }`}
          >
            {/* 상단 조명 시각화 헤더 */}
            <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 pointer-events-none">
              <span className="text-[11px] font-mono text-stone-400/90 bg-stone-900/70 px-2 py-0.5 rounded border border-stone-700/50">
                조각 수: {pieces.length}개
              </span>
            </div>

            {/* 실제 3D 유리병 컴포넌트 */}
            <div className="w-full flex-1">
              <Safe3DBoundary>
                <MemoryJarCanvas
                  ref={jarCanvasRef}
                  pieces={pieces}
                  options={{
                    autoRotate,
                    enableGyroscope,
                    enableSunlightParticles: true,
                  }}
                  onSelectPiece={(piece) => setLastSelected(piece)}
                />
              </Safe3DBoundary>
            </div>
          </div>

          <p className="text-xs text-stone-500 mt-3 text-center">
            마우스 좌클릭 또는 모바일 터치 드래그로 병을 360° 회전하고, 원하는 왁스 조각을 직접 눌러보세요.
          </p>
        </div>

        {/* 오른쪽: 조작 컨트롤러 & 기능 설명 패널 */}
        <div className="w-full lg:max-w-md space-y-6">
          {/* 1. 인터랙션 테스트 패널 */}
          <div className="p-5 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-4">
            <h2 className="text-sm font-bold text-amber-200 tracking-wide uppercase">
              🎮 인터랙션 테스트 컨트롤
            </h2>

            {/* 물리 흔들기 버튼 */}
            <button
              type="button"
              onClick={() => jarCanvasRef.current?.shake()}
              className="w-full py-3 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/40 active:scale-95 text-amber-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all cursor-pointer"
            >
              <span className="text-base">🎲</span>
              <span>병 흔들기 (물리 텀블링으로 묻힌 왁스 섞기)</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAutoRotate(!autoRotate)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all text-center ${
                  autoRotate
                    ? 'bg-amber-600/20 border-amber-500/50 text-amber-200'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400'
                }`}
              >
                쇼케이스 자동회전: {autoRotate ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileFrame(!isMobileFrame)}
                className="px-3 py-2 text-xs font-medium rounded-xl bg-stone-800/60 border border-stone-700 text-stone-300 hover:bg-stone-700 transition-all text-center"
              >
                뷰 모드: {isMobileFrame ? '모바일 프레임' : '넓은 화면'}
              </button>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddPiece}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                + 왁스 조각 1개 더 넣기
              </button>

              <button
                type="button"
                onClick={handleResetPieces}
                className="py-2.5 px-3 rounded-xl text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all cursor-pointer"
              >
                초기화
              </button>
            </div>
          </div>

          {/* 2. 그래픽 & 물리 엔진 상세 스펙 안내 */}
          <div className="p-5 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-3">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              ✨ 3D 그래픽 및 물리 세부 구현 내용
            </h3>
            <ul className="text-xs text-stone-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-amber-400">☀️</span>
                <div>
                  <strong className="text-amber-200">우측 상단 햇빛 (Top-Right):</strong>
                  <br />
                  오후의 따뜻한 골든 아워 방향광(+45°)으로 병의 굴절과 테이블 그림자, 햇살 속 부유하는 반짝이는 먼지 파티클 구현.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">🏺</span>
                <div>
                  <strong className="text-amber-200">PBR 광학 유리 재질:</strong>
                  <br />
                  굴절률 1.52의 물리 유리(MeshPhysicalMaterial)와 원목 코르크 마개, 황동 링 디테일.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">🏵️</span>
                <div>
                  <strong className="text-amber-200">버건디/골드/그린 왁스 코인:</strong>
                  <br />
                  온전한 온기 실링 왁스 인장 코인이 바닥부터 황금각 나선형으로 자연스럽게 쌓이는 구조.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">🚀</span>
                <div>
                  <strong className="text-amber-200">스마트폰 배터리 & 60FPS 최적화:</strong>
                  <br />
                  모바일에서도 버벅임이나 발열 없이 매끄럽게 회전하도록 GPU 가속 및 관성 댐핑(Lerp) 적용.
                </div>
              </li>
            </ul>
          </div>

          {/* 3. 최근 탭한 왁스 조각 정보 */}
          {lastSelected && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 space-y-1">
              <p className="font-semibold text-amber-300">🔍 최근 확인한 왁스 조각:</p>
              <p className="text-stone-300">
                &ldquo;{lastSelected.title}&rdquo; ({lastSelected.authorName}, {lastSelected.date})
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
