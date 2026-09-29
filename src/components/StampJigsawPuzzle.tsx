'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, Stamp, RotateCw, Hand } from 'lucide-react';

interface StampJigsawPuzzleProps {
  onSolve: () => void;
  partnerName?: string;
}

const STAMP_WIDTH = 154;
const STAMP_HEIGHT = 196;
const BOARD_WIDTH = 308;
const BOARD_HEIGHT = 455;
const TARGET_X = (BOARD_WIDTH - STAMP_WIDTH) / 2; // 77px
const TARGET_Y = 10; // 10px from top

interface TornData {
  midX: number;
  midY: number;
  paths: string[];
}

// 찢어진 종이의 거친 섬유와 이빨을 시뮬레이션하는 지그재그 세그먼트 생성
function generateJaggedSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  steps: number = 10,
  maxDev: number = 7
): [number, number][] {
  const points: [number, number][] = [[x1, y1]];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const baseTx = x1 + dx * t;
    const baseTy = y1 + dy * t;
    // 불규칙한 찢김 이빨과 미세 진동
    const tooth = (i % 2 === 0 ? 1 : -1) * (1.8 + Math.random() * 3.2);
    const jitter = (Math.random() - 0.5) * maxDev;
    const offset = tooth + jitter;
    points.push([
      Math.round((baseTx + nx * offset) * 10) / 10,
      Math.round((baseTy + ny * offset) * 10) / 10,
    ]);
  }
  points.push([x2, y2]);
  return points;
}

// 새로고침이나 재생성 시 매번 무작위로 찢긴 4조각 패스 생성
function generateTornPaths(stampWidth: number, stampHeight: number): TornData {
  // 중심 찢김 시작점 (42% ~ 58% 영역 내 무작위)
  const midX = Math.round(stampWidth * (0.42 + Math.random() * 0.16));
  const midY = Math.round(stampHeight * (0.42 + Math.random() * 0.16));

  const steps = 8 + Math.floor(Math.random() * 5); // 8 ~ 12개의 이빨

  // 상단에서 중앙
  const topToCenter = generateJaggedSegment(midX, 0, midX, midY, steps, 6);
  // 중앙에서 하단
  const centerToBottom = generateJaggedSegment(midX, midY, midX, stampHeight, steps, 6);
  // 좌측에서 중앙
  const leftToCenter = generateJaggedSegment(0, midY, midX, midY, steps, 6);
  // 중앙에서 우측
  const centerToRight = generateJaggedSegment(midX, midY, stampWidth, midY, steps, 6);

  // 1. 좌상단 조각 (Top-Left)
  const p0 = [
    'M 0,0',
    ...topToCenter.map(([x, y]) => `L ${x},${y}`),
    ...leftToCenter.slice().reverse().map(([x, y]) => `L ${x},${y}`),
    'Z',
  ].join(' ');

  // 2. 우상단 조각 (Top-Right)
  const p1 = [
    `M ${topToCenter[0][0]},0`,
    `L ${stampWidth},0`,
    `L ${centerToRight[centerToRight.length - 1][0]},${centerToRight[centerToRight.length - 1][1]}`,
    ...centerToRight.slice().reverse().map(([x, y]) => `L ${x},${y}`),
    ...topToCenter.slice().reverse().map(([x, y]) => `L ${x},${y}`),
    'Z',
  ].join(' ');

  // 3. 좌하단 조각 (Bottom-Left)
  const p2 = [
    `M 0,${leftToCenter[0][1]}`,
    ...leftToCenter.slice(1).map(([x, y]) => `L ${x},${y}`),
    ...centerToBottom.slice(1).map(([x, y]) => `L ${x},${y}`),
    `L 0,${stampHeight}`,
    'Z',
  ].join(' ');

  // 4. 우하단 조각 (Bottom-Right)
  const p3 = [
    `M ${midX},${midY}`,
    ...centerToRight.slice(1).map(([x, y]) => `L ${x},${y}`),
    `L ${stampWidth},${stampHeight}`,
    `L ${centerToBottom[centerToBottom.length - 1][0]},${stampHeight}`,
    ...centerToBottom.slice().reverse().map(([x, y]) => `L ${x},${y}`),
    'Z',
  ].join(' ');

  return {
    midX,
    midY,
    paths: [p0, p1, p2, p3],
  };
}

// 앤틱 대형 우표 원본 그래픽 SVG 컴포넌트
function LargeStampArt({ partnerName }: { partnerName: string }) {
  return (
    <svg
      width={STAMP_WIDTH}
      height={STAMP_HEIGHT}
      viewBox={`0 0 ${STAMP_WIDTH} ${STAMP_HEIGHT}`}
      className="w-full h-full select-none"
    >
      <defs>
        <linearGradient id="stampPaperGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFDF9" />
          <stop offset="50%" stopColor="#F9F3EA" />
          <stop offset="100%" stopColor="#F2E8D8" />
        </linearGradient>

        <linearGradient id="stampInkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8C2131" />
          <stop offset="100%" stopColor="#54121C" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={STAMP_WIDTH} height={STAMP_HEIGHT} fill="url(#stampPaperGrad)" />

      {/* 외곽 천공 점선 */}
      <rect
        x="4"
        y="4"
        width={STAMP_WIDTH - 8}
        height={STAMP_HEIGHT - 8}
        fill="none"
        stroke="#C4A882"
        strokeWidth="1.2"
        strokeDasharray="3.5 2.5"
      />

      {/* 앤틱 우표 이중 프레임 */}
      <rect
        x="10"
        y="10"
        width={STAMP_WIDTH - 20}
        height={STAMP_HEIGHT - 20}
        fill="none"
        stroke="#8C2131"
        strokeWidth="1.8"
      />
      <rect
        x="12.5"
        y="12.5"
        width={STAMP_WIDTH - 25}
        height={STAMP_HEIGHT - 25}
        fill="none"
        stroke="#B8860B"
        strokeWidth="0.7"
      />

      {/* 상단 텍스트 */}
      <text
        x={STAMP_WIDTH / 2}
        y="26"
        textAnchor="middle"
        fill="#8C2131"
        fontSize="10"
        fontFamily="serif"
        fontWeight="bold"
        letterSpacing="2.5"
      >
        大韓 溫氣 郵便
      </text>
      <text
        x={STAMP_WIDTH / 2}
        y="37"
        textAnchor="middle"
        fill="#7A6855"
        fontSize="6.5"
        fontFamily="sans-serif"
        letterSpacing="2"
      >
        SPECIAL CORRESPONDENCE
      </text>

      {/* 중앙 타원형 앤틱 일러스트 프레임 */}
      <ellipse
        cx={STAMP_WIDTH / 2}
        cy={STAMP_HEIGHT / 2 + 3}
        rx="50"
        ry="42"
        fill="#FAF5ED"
        stroke="#B8860B"
        strokeWidth="1"
        strokeDasharray="2 2"
      />

      {/* 중앙 만년필 깃펜 & 촛불 심볼 */}
      <g transform={`translate(${STAMP_WIDTH / 2 - 14}, ${STAMP_HEIGHT / 2 - 18})`}>
        <path
          d="M 14,3 C 20,10 20,21 14,32 C 8,21 8,10 14,3 Z"
          fill="url(#stampInkGrad)"
          opacity="0.85"
        />
        <circle cx="14" cy="14" r="2.5" fill="#E3B338" />
        <path d="M 12.5,18 L 15.5,18 L 14,35 Z" fill="#3D0B14" />
      </g>

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT / 2 + 28}
        textAnchor="middle"
        fill="#8C2131"
        fontSize="11"
        fontFamily="serif"
        fontWeight="bold"
      >
        온기 · 溫氣
      </text>

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT / 2 + 39}
        textAnchor="middle"
        fill="#66594C"
        fontSize="8"
        fontFamily="serif"
        fontStyle="italic"
      >
        To. {partnerName}
      </text>

      {/* 좌우 하단 우표 액면가 */}
      <text x="16" y={STAMP_HEIGHT - 16} fill="#8C2131" fontSize="13" fontFamily="serif" fontWeight="bold">
        42
      </text>
      <text x="16" y={STAMP_HEIGHT - 27} fill="#7A6855" fontSize="5.5" fontFamily="sans-serif">
        WON
      </text>

      <text x={STAMP_WIDTH - 16} y={STAMP_HEIGHT - 16} textAnchor="end" fill="#8C2131" fontSize="13" fontFamily="serif" fontWeight="bold">
        1926
      </text>
      <text x={STAMP_WIDTH - 16} y={STAMP_HEIGHT - 27} textAnchor="end" fill="#7A6855" fontSize="5.5" fontFamily="sans-serif">
        YEAR
      </text>

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT - 14}
        textAnchor="middle"
        fill="#B8860B"
        fontSize="6.5"
        fontFamily="sans-serif"
        letterSpacing="1.5"
      >
        ★ TWO SOULS UNITED ★
      </text>
    </svg>
  );
}

export default function StampJigsawPuzzle({
  onSolve,
  partnerName = '유라',
}: StampJigsawPuzzleProps) {
  const [tornData, setTornData] = useState<TornData | null>(null);
  const [snapped, setSnapped] = useState<boolean[]>([false, false, false, false]);
  const [rotations, setRotations] = useState<number[]>([90, 180, 270, 90]);
  const [activePiece, setActivePiece] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stampKey, setStampKey] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const targetSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

  // 퍼즐 초기화 (새로운 무작위 찢김 및 무작위 회전)
  const initPuzzle = useCallback(() => {
    const data = generateTornPaths(STAMP_WIDTH, STAMP_HEIGHT);
    setTornData(data);
    setSnapped([false, false, false, false]);

    // 회전 각도 무작위화: 90, 180, 270 중 무작위 배치 (0도는 처음에 나오지 않음)
    const angles = [90, 180, 270];
    const randRots = [
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
    ];
    setRotations(randRots);
    setIsCompleted(false);
    setStampKey((k) => k + 1);
  }, []);

  useEffect(() => {
    initPuzzle();
  }, [initPuzzle]);

  // 90도 회전 (버튼 클릭 시) -> 조각 고유의 중심(50% 50%)을 축으로 항상 시계 방향으로만 회전!
  const handleRotate = (pieceIdx: number) => {
    soundEngine.playTileSlideSound();
    setRotations((prev) => {
      const next = [...prev];
      next[pieceIdx] = next[pieceIdx] + 90; // % 360을 하지 않아야 framer-motion이 역회전하지 않고 항상 시계방향으로 회전함
      return next;
    });
  };

  // 드래그 종료 시 위치 및 회전각 검증 -> 정답 슬롯 위치 + 정방향(0°)일 때만 결합!
  const checkSnap = (pieceIdx: number) => {
    if (snapped[pieceIdx] || isCompleted) return;

    const pieceEl = pieceRefs.current[pieceIdx];
    const slotEl = targetSlotRefs.current[pieceIdx];
    if (!pieceEl || !slotEl) return;

    const pRect = pieceEl.getBoundingClientRect();
    const sRect = slotEl.getBoundingClientRect();

    // 조각 중심과 타겟 슬롯 중심 간의 거리 계산
    const pCenter = { x: pRect.left + pRect.width / 2, y: pRect.top + pRect.height / 2 };
    const sCenter = { x: sRect.left + sRect.width / 2, y: sRect.top + sRect.height / 2 };
    const dist = Math.hypot(pCenter.x - sCenter.x, pCenter.y - sCenter.y);

    // 360도 배수일 때 올바른 정방향 (0도, 360도, 720도 등)
    const isOrientationCorrect = ((rotations[pieceIdx] % 360) + 360) % 360 === 0;

    // 타겟 슬롯(거리 40px 이내)에 정확히 올려놓았고, 사용자가 올바른 방향(0도)을 찾아 돌려놓았을 때만 체결!
    if (dist < 40 && isOrientationCorrect) {
      soundEngine.playTileSlideSound();
      const nextSnapped = [...snapped];
      nextSnapped[pieceIdx] = true;
      setSnapped(nextSnapped);

      if (nextSnapped.every((s) => s)) {
        triggerSuccess();
      }
    }
  };

  // 4조각 모두 결합 완료 시 소인 타격 및 봉인 해제
  const triggerSuccess = () => {
    setIsCompleted(true);

    setTimeout(() => {
      soundEngine.playStampThudSound(); // 쿵! 도장 소인 타격음
    }, 350);

    setTimeout(() => {
      soundEngine.playMissionPassChime();
      confetti({
        particleCount: 65,
        spread: 75,
        origin: { y: 0.5 },
        colors: ['#8C2131', '#B8860B', '#FFFDF9', '#E3B338'],
      });
    }, 700);

    setTimeout(() => {
      onSolve();
    }, 1800);
  };

  // 우표 바로 완성 (치트/테스트용)
  const handleAutoSolve = () => {
    setRotations([0, 0, 0, 0]);
    setSnapped([true, true, true, true]);
    triggerSuccess();
  };

  if (!tornData) return null;

  const { midX, midY } = tornData;

  // 4개 조각 각각의 고유 크기 및 원점 정보
  const pieceMeta = [
    { width: midX, height: midY, originX: 0, originY: 0 }, // 0: 좌상단
    { width: STAMP_WIDTH - midX, height: midY, originX: midX, originY: 0 }, // 1: 우상단
    { width: midX, height: STAMP_HEIGHT - midY, originX: 0, originY: midY }, // 2: 좌하단
    { width: STAMP_WIDTH - midX, height: STAMP_HEIGHT - midY, originX: midX, originY: midY }, // 3: 우하단
  ];

  // 4개 조각이 작업대(하단 2x2)에서 화면 밖으로 절대 나가지 않고 서로 겹치지 않는 시작 위치 (모바일 308px 최적화)
  const initialPositions = [
    { x: 18, y: 228 }, // 0: 작업대 좌상단
    { x: 168, y: 228 }, // 1: 작업대 우상단
    { x: 18, y: 338 }, // 2: 작업대 좌하단
    { x: 168, y: 338 }, // 3: 작업대 우하단
  ];

  return (
    <div className="flex flex-col items-center select-none w-full max-w-sm mx-auto touch-none">
      {/* 가이드 안내 (스포일러 없이 직관적인 퍼즐 규칙 안내) */}
      <div className="text-center mb-2">
        <p className="text-stone-800 font-serif-warm text-sm font-semibold flex items-center justify-center gap-1.5">
          <span>📮 찢어진 우표 조각 맞추기</span>
        </p>
        <p className="text-[11px] text-stone-600 font-sans-ui mt-0.5 flex items-center justify-center gap-1">
          <Hand className="w-3.5 h-3.5 text-amber-700" />
          <span>조각의 <strong>[🔄]</strong>로 회전시켜 맞는 방향을 찾은 뒤, <strong>우표 틀의 제자리로 끌어다</strong> 맞추세요!</span>
        </p>
      </div>

      {/* 퍼즐 작업대 (화면 밖 이탈 방지 안전 영역) */}
      <div
        ref={boardRef}
        className="relative bg-[#F5EFE6] rounded-2xl border-2 border-[#C4B29A] shadow-inner overflow-hidden touch-none select-none"
        style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
      >
        {/* 상단 타겟: 우표 결합 틀 */}
        <div
          className="absolute rounded-lg overflow-hidden bg-[#EFE7DC]/70 border border-dashed border-[#B89B72]/60 shadow-xs"
          style={{
            width: STAMP_WIDTH,
            height: STAMP_HEIGHT,
            left: TARGET_X,
            top: TARGET_Y,
          }}
        >
          {/* 밑바탕 가이드 실루엣 */}
          <div className="absolute inset-0 opacity-15 pointer-events-none filter grayscale">
            <LargeStampArt partnerName={partnerName} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-serif-warm text-[#8C2131]/30 font-bold uppercase tracking-widest pointer-events-none">
            {snapped.some((s) => s) ? '' : '우표 틀에 조각을 맞춰 넣으세요'}
          </div>

          {/* 4개의 결합 슬롯 (각 슬롯의 위치에 맞춰 정확히 결합) */}
          {pieceMeta.map((meta, idx) => (
            <div
              key={`target-slot-${idx}`}
              ref={(el) => {
                targetSlotRefs.current[idx] = el;
              }}
              className="absolute"
              style={{
                left: meta.originX,
                top: meta.originY,
                width: meta.width,
                height: meta.height,
              }}
            >
              {snapped[idx] && (
                <motion.div
                  initial={{ scale: 1.08, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="relative overflow-hidden w-full h-full pointer-events-none"
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -meta.originX,
                      top: -meta.originY,
                      width: STAMP_WIDTH,
                      height: STAMP_HEIGHT,
                      clipPath: `path('${tornData.paths[idx]}')`,
                    }}
                  >
                    <LargeStampArt partnerName={partnerName} />
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <path
                        d={tornData.paths[idx]}
                        fill="none"
                        stroke="#FFFDF9"
                        strokeWidth="1.2"
                        opacity="0.6"
                      />
                    </svg>
                  </div>
                </motion.div>
              )}
            </div>
          ))}

          {/* 4조각 모두 결합 시 매끄러운 원본 우표 완성 효과 */}
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              <LargeStampArt partnerName={partnerName} />
            </motion.div>
          )}

          {/* 쿵! 소인 도장 타격 애니메이션 */}
          <AnimatePresence>
            {isCompleted && (
              <motion.div
                initial={{ scale: 3, opacity: 0, rotate: -28 }}
                animate={{ scale: 1, opacity: 0.9, rotate: -12 }}
                transition={{ type: 'spring', damping: 14, stiffness: 280, delay: 0.2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <div className="w-28 h-28 rounded-full border-[2.2px] border-dashed border-[#6B1724] text-[#6B1724] flex flex-col items-center justify-center font-mono text-[8px] p-2 bg-[#6B1724]/10 backdrop-blur-2xs shadow-xl">
                  <Stamp className="w-6 h-6 stroke-[2.2] mb-0.5" />
                  <span className="font-bold tracking-widest text-[9px]">WARMTH SEOUL</span>
                  <span className="font-bold text-[8px]">2026.09.28</span>
                  <span className="text-[7.5px] tracking-wider uppercase font-sans">OFFICIALLY RESTORED</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 구분선 (작업대 라벨) */}
        <div className="absolute top-[214px] inset-x-3 flex items-center gap-2 pointer-events-none opacity-40">
          <div className="h-px flex-1 bg-stone-400 border-t border-dashed border-stone-500" />
          <span className="text-[9px] font-mono text-stone-600">조각 작업대</span>
          <div className="h-px flex-1 bg-stone-400 border-t border-dashed border-stone-500" />
        </div>

        {/* 4개의 직접 손으로 움직이고 조각 자체 중심으로 회전하는 찢어진 조각들 */}
        {pieceMeta.map((meta, idx) => {
          if (snapped[idx]) return null;

          const rot = rotations[idx];
          const isCurrentActive = activePiece === idx;

          return (
            <motion.div
              key={`piece-${idx}-${stampKey}`}
              ref={(el) => {
                pieceRefs.current[idx] = el;
              }}
              drag
              dragConstraints={boardRef}
              dragElastic={0.05}
              dragMomentum={false}
              onDragStart={() => setActivePiece(idx)}
              onDragEnd={() => checkSnap(idx)}
              animate={{ rotate: rot }}
              transition={{ rotate: { type: 'spring', stiffness: 350, damping: 25 } }}
              style={{
                position: 'absolute',
                left: initialPositions[idx].x,
                top: initialPositions[idx].y,
                width: meta.width,
                height: meta.height,
                transformOrigin: 'center center', // ★ 조각 고유의 중심을 축으로 제자리 회전!
                zIndex: isCurrentActive ? 40 : 20 + idx,
                cursor: 'grab',
                filter: isCurrentActive
                  ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.3))'
                  : 'drop-shadow(0 3px 6px rgba(0,0,0,0.18))',
              }}
              whileTap={{ cursor: 'grabbing', scale: 1.02 }}
            >
              {/* 조각 그래픽 컨테이너 */}
              <div
                className="relative overflow-hidden w-full h-full pointer-events-none rounded-xs select-none"
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -meta.originX,
                    top: -meta.originY,
                    width: STAMP_WIDTH,
                    height: STAMP_HEIGHT,
                    clipPath: `path('${tornData.paths[idx]}')`,
                  }}
                >
                  <LargeStampArt partnerName={partnerName} />
                  {/* 찢긴 종이 흰색 섬유 질감 테두리 */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d={tornData.paths[idx]}
                      fill="none"
                      stroke="#FFFDF9"
                      strokeWidth="1.8"
                      strokeDasharray="2 1"
                      opacity="0.85"
                    />
                  </svg>
                </div>
              </div>

              {/* 조각 중심에 달린 회전 버튼 ([🔄]) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotate(idx);
                }}
                className="absolute z-30 inset-0 m-auto w-6 h-6 rounded-full bg-white/95 text-stone-700 shadow-md border border-stone-300 hover:bg-amber-100 hover:text-amber-900 active:scale-85 transition-transform flex items-center justify-center cursor-pointer pointer-events-auto"
                title="회전하기"
              >
                <RotateCw className="w-3 h-3 stroke-[2.2]" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* 하단 컨트롤러 */}
      <div className="mt-3 flex items-center justify-between w-full max-w-sm text-xs font-sans-ui text-stone-500 px-1">
        <button
          type="button"
          onClick={initPuzzle}
          title="새로운 무작위 찢김과 회전으로 다시 도전"
          className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 active:scale-95 flex items-center gap-1 text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>새로 찢기</span>
        </button>

        <span className="text-[11px] text-stone-500 font-mono">
          완성 {snapped.filter((s) => s).length}/4
        </span>

        <button
          type="button"
          onClick={handleAutoSolve}
          className="px-2.5 py-1.5 rounded-lg bg-amber-100/70 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-medium flex items-center gap-1 active:scale-95"
        >
          <Sparkles className="w-3 h-3 text-amber-700" />
          <span>우표 바로 완성</span>
        </button>
      </div>
    </div>
  );
}
