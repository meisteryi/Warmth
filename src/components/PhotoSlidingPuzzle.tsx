'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, CheckCircle2, Hand } from 'lucide-react';

interface PhotoSlidingPuzzleProps {
  imageUrl?: string;
  onSolve: () => void;
  partnerName?: string;
}

const GRID_SIZE = 3; // 3x3 퍼즐

export default function PhotoSlidingPuzzle({
  imageUrl = 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80',
  onSolve,
  partnerName = '유라',
}: PhotoSlidingPuzzleProps) {
  // 타일 배열: 인덱스는 위치(0~8), 값은 원래 타일 번호 (0~7은 조각, 8은 빈 칸)
  const [tiles, setTiles] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const [moves, setMoves] = useState(0);
  const [isSolved, setIsSolved] = useState(false);

  // 물리 드래그/슬라이드 제스처 상태
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // 인접 여부 확인 함수
  const isAdjacent = (idx1: number, idx2: number) => {
    const row1 = Math.floor(idx1 / GRID_SIZE);
    const col1 = idx1 % GRID_SIZE;
    const row2 = Math.floor(idx2 / GRID_SIZE);
    const col2 = idx2 % GRID_SIZE;
    return Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1;
  };

  // 10~14회 인접 스왑으로 항상 해결 가능한 퍼즐 생성
  const shuffleTiles = useCallback(() => {
    let current = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let emptyIdx = 8;
    let prevMove = -1;

    for (let step = 0; step < 12; step++) {
      const neighbors: number[] = [];
      for (let i = 0; i < 9; i++) {
        if (i !== prevMove && isAdjacent(i, emptyIdx)) {
          neighbors.push(i);
        }
      }
      if (neighbors.length > 0) {
        const nextIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
        [current[emptyIdx], current[nextIdx]] = [current[nextIdx], current[emptyIdx]];
        prevMove = emptyIdx;
        emptyIdx = nextIdx;
      }
    }

    setTiles(current);
    setMoves(0);
    setIsSolved(false);
    setDraggingIdx(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    shuffleTiles();
  }, [shuffleTiles]);

  // 타일 이동 로직
  const moveTile = useCallback((clickedIdx: number) => {
    const emptyIdx = tiles.indexOf(8);
    if (!isAdjacent(clickedIdx, emptyIdx)) return;

    soundEngine.playTileSlideSound();
    const newTiles = [...tiles];
    [newTiles[clickedIdx], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[clickedIdx]];
    setTiles(newTiles);
    setMoves((m) => m + 1);

    // 완성 검사
    const solved = newTiles.every((val, i) => val === i);
    if (solved) {
      setIsSolved(true);
      soundEngine.playMissionPassChime();

      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#6B1724', '#B8860B', '#FFFDF9', '#E3B338'],
      });

      setTimeout(() => {
        onSolve();
      }, 1200);
    }
  }, [tiles, onSolve]);

  // 터치 및 마우스 드래그 슬라이드 제스처 핸들러
  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    if (isSolved) return;
    const emptyIdx = tiles.indexOf(8);
    if (!isAdjacent(idx, emptyIdx)) return;

    setDraggingIdx(idx);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragOffset({ x: 0, y: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !dragStartPos.current) return;
    const emptyIdx = tiles.indexOf(8);

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    const row = Math.floor(draggingIdx / GRID_SIZE);
    const col = draggingIdx % GRID_SIZE;
    const emptyRow = Math.floor(emptyIdx / GRID_SIZE);
    const emptyCol = emptyIdx % GRID_SIZE;

    const allowedDx = emptyCol - col; // -1, 0, 1
    const allowedDy = emptyRow - row; // -1, 0, 1

    const tileSize = 85; // 약 타일 크기 픽셀

    // 허용된 빈 칸 방향으로만 드래그 오프셋 적용
    let clampedX = 0;
    let clampedY = 0;

    if (allowedDx !== 0) {
      if (allowedDx > 0) {
        clampedX = Math.max(0, Math.min(deltaX, tileSize));
      } else {
        clampedX = Math.min(0, Math.max(deltaX, -tileSize));
      }
    } else if (allowedDy !== 0) {
      if (allowedDy > 0) {
        clampedY = Math.max(0, Math.min(deltaY, tileSize));
      } else {
        clampedY = Math.min(0, Math.max(deltaY, -tileSize));
      }
    }

    setDragOffset({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;

    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    const threshold = 22; // 22px 이상 슬라이드 시 이동 확정
    const movedDistance = Math.abs(dragOffset.x) + Math.abs(dragOffset.y);

    if (movedDistance >= threshold) {
      moveTile(draggingIdx);
    } else {
      // 아주 짧은 탭/클릭인 경우에도 인접하면 바로 슬라이드
      if (dragStartPos.current) {
        const totalDist = Math.hypot(
          e.clientX - dragStartPos.current.x,
          e.clientY - dragStartPos.current.y
        );
        if (totalDist < 8) {
          moveTile(draggingIdx);
        }
      }
    }

    setDraggingIdx(null);
    dragStartPos.current = null;
    setDragOffset({ x: 0, y: 0 });
  };

  // 자동 완성 (패스 기능)
  const handleAutoSolve = () => {
    setTiles([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    setIsSolved(true);
    soundEngine.playMissionPassChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#6B1724', '#B8860B', '#FFFDF9'],
    });
    setTimeout(() => onSolve(), 1200);
  };

  return (
    <div className="flex flex-col items-center select-none touch-none">
      {/* 가이드 안내 */}
      <div className="text-center mb-3">
        <p className="text-stone-800 font-serif-warm text-sm font-semibold flex items-center justify-center gap-1.5">
          <span>🧩 {partnerName} 님의 하루 사진 맞추기</span>
        </p>
        <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5 flex items-center justify-center gap-1">
          <Hand className="w-3 h-3 text-amber-700" />
          <span>조각을 빈 칸 쪽으로 <strong>밀어서(슬라이드)</strong> 맞춰보세요!</span>
        </p>
      </div>

      {/* 3x3 퍼즐 보드: 여백 거의 없는(gap-[1px]) 일체형 사진 프레임 */}
      <div 
        ref={boardRef}
        onPointerMove={handlePointerMove}
        className="relative w-56 h-56 sm:w-64 sm:h-64 p-1 bg-[#D8CEBE] rounded-xl border border-[#BFAFA0] shadow-md overflow-hidden"
      >
        <div className="grid grid-cols-3 grid-rows-3 gap-[1px] w-full h-full bg-[#C2B4A2]">
          {tiles.map((tileNum, currentIdx) => {
            const isEmpty = tileNum === 8 && !isSolved;
            const isCurrentDragging = draggingIdx === currentIdx;

            // 원본 타일 위치 (0~8)
            const origRow = Math.floor(tileNum / GRID_SIZE);
            const origCol = tileNum % GRID_SIZE;
            const xPercent = (origCol / (GRID_SIZE - 1)) * 100;
            const yPercent = (origRow / (GRID_SIZE - 1)) * 100;

            if (isEmpty) {
              return (
                <div
                  key="empty-slot"
                  className="w-full h-full bg-[#DED6C9] flex items-center justify-center text-[10px] text-stone-400 font-serif-warm italic shadow-inner"
                >
                  빈자리
                </div>
              );
            }

            return (
              <motion.div
                key={tileNum}
                onPointerDown={(e) => handlePointerDown(currentIdx, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: '300% 300%',
                  backgroundPosition: `${xPercent}% ${yPercent}%`,
                  transform: isCurrentDragging
                    ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`
                    : 'translate3d(0, 0, 0)',
                  zIndex: isCurrentDragging ? 30 : 10,
                  transition: isCurrentDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                className={`relative w-full h-full cursor-grab active:cursor-grabbing rounded-none shadow-2xs ${
                  isSolved ? 'ring-0' : 'hover:brightness-95'
                }`}
              >
                {/* 힌트 조각 번호: 좌상단 미세 워터마크 */}
                {!isSolved && (
                  <span className="absolute top-1 left-1 bg-black/40 text-white/90 text-[8px] font-mono px-1 rounded-xs backdrop-blur-2xs pointer-events-none">
                    {tileNum + 1}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 퍼즐 완성 시 축하 오버레이 */}
        <AnimatePresence>
          {isSolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-amber-100 z-40"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-1.5 animate-bounce" />
              <p className="font-serif-warm font-bold text-base">사진 완성!</p>
              <p className="text-xs text-amber-200 font-sans-ui mt-0.5">봉인이 해제됩니다...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 하단 컨트롤러 */}
      <div className="mt-2.5 flex items-center justify-between w-56 sm:w-64 text-xs font-sans-ui text-stone-600">
        <span className="text-stone-500">
          이동: <strong className="font-mono text-stone-800">{moves}</strong>회
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={shuffleTiles}
            title="퍼즐 다시 섞기"
            className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleAutoSolve}
            className="px-2.5 py-1 rounded-lg bg-amber-100/70 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-medium flex items-center gap-1 active:scale-95"
          >
            <Sparkles className="w-3 h-3 text-amber-700" />
            <span>바로 완성하기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
