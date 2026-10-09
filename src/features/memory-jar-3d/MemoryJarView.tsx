'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Shuffle, BookOpen } from 'lucide-react';
import { DiaryData, WAX_COLORS } from '@/types/diary';
import { getRoomDiariesFromFirestore, getCachedRoomDiaries } from '@/lib/roomService';
import { WaxPieceData } from './types';
import { MemoryJarCanvas, MemoryJarCanvasHandle } from './MemoryJarCanvas';

interface MemoryJarViewProps {
  roomCode: string;
  currentUserName: string;
  partnerName: string;
  onGoHome: () => void;
  onSelectDiary: (diary: DiaryData) => void;
}

/**
 * 날짜 포맷 헬퍼 (YYYY.MM.DD)
 */
function formatDiaryDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString || '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  } catch {
    return dateString || '';
  }
}

export default function MemoryJarView({
  roomCode,
  currentUserName,
  partnerName,
  onGoHome,
  onSelectDiary,
}: MemoryJarViewProps) {
  const jarCanvasRef = useRef<MemoryJarCanvasHandle>(null);
  const [diaries, setDiaries] = useState<DiaryData[]>(() => {
    if (typeof window !== 'undefined' && roomCode) {
      const cached = getCachedRoomDiaries(roomCode);
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(diaries.length === 0);

  // 병 흔들기 속도 제한 (1초에 1번만 가능하도록 쿨다운 적용)
  const lastShakeTimeRef = useRef<number>(0);
  const [isThrottled, setIsThrottled] = useState(false);
  const [cooldownToast, setCooldownToast] = useState(false);

  const handleShakeClick = () => {
    const now = performance.now();
    if (now - lastShakeTimeRef.current < 1000) {
      setCooldownToast(true);
      setTimeout(() => setCooldownToast(false), 800);
      return;
    }

    const ok = jarCanvasRef.current?.shake();
    if (ok !== false) {
      lastShakeTimeRef.current = now;
      setIsThrottled(true);
      setTimeout(() => {
        setIsThrottled(false);
      }, 1000);
    }
  };

  // Firestore에서 현재 방의 모든 일기 로드
  useEffect(() => {
    if (!roomCode) return;
    let isMounted = true;

    async function loadDiaries() {
      try {
        const list = await getRoomDiariesFromFirestore(roomCode);
        if (isMounted) {
          if (list && list.length > 0) {
            setDiaries(list);
          } else {
            const cached = getCachedRoomDiaries(roomCode);
            if (cached && cached.length > 0) {
              setDiaries(cached);
            } else {
              setDiaries([]);
            }
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load diaries for MemoryJarView:', err);
        if (isMounted) {
          const cached = getCachedRoomDiaries(roomCode);
          if (cached && cached.length > 0) setDiaries(cached);
          setIsLoading(false);
        }
      }
    }

    loadDiaries();
    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // 일기 목록을 1:1 대응되는 WaxPieceData 배열로 변환
  const waxPieces: WaxPieceData[] = React.useMemo(() => {
    return diaries.map((diary, index) => {
      const ensuredDiaryId = diary.diaryId || `diary-${index}-${diary.createdAt || Date.now()}`;
      const safeDiary: DiaryData = {
        ...diary,
        diaryId: ensuredDiaryId,
      };
      const hexColor = safeDiary.waxColor || '#6B1724';
      const colorOption = WAX_COLORS.find(
        (c) => c.hex.toLowerCase() === hexColor.toLowerCase()
      );

      return {
        id: ensuredDiaryId,
        diaryId: ensuredDiaryId,
        color: hexColor,
        label: colorOption ? colorOption.name : '실링 왁스',
        title: safeDiary.title || '소중한 온기 편지',
        date: formatDiaryDate(safeDiary.createdAt),
        authorName: safeDiary.authorName || '익명',
        shapeType: 'SEAL_COIN' as const,
        size: 0.95 + ((index % 3) * 0.08), // 미세한 자연스러운 크기 차이
        photoUrl: safeDiary.photos && safeDiary.photos.length > 0 ? safeDiary.photos[0] : undefined,
        diary: safeDiary,
      };
    });
  }, [diaries]);

  // 메모이제이션된 렌더 옵션 (불필요한 리렌더링 및 센서 간섭 차단, 파티클 제거)
  const jarRenderOptions = React.useMemo(
    () => ({
      autoRotate: false, // 손으로만 회전
      enableSunlightParticles: false, // 반짝이 파티클 제거
      enableGyroscope: false, // 센서 노이즈로 인한 덜덜 떨림 방지
    }),
    []
  );

  return (
    <div className="relative w-full h-[calc(100dvh-4.25rem)] sm:h-[calc(100vh-4.5rem)] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#F8F5EE] via-[#F3EDE2] to-[#EBE2D4] select-none">
      {/* 종이 결 감성 오버레이 */}
      <div className="absolute inset-0 pointer-events-none paper-texture opacity-60 z-0" />

      {/* 좌측 상단: 홈으로 돌아가기 버튼 */}
      <div className="absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-stone-700 hover:text-stone-900 border border-stone-200/90 shadow-sm backdrop-blur-md text-xs font-serif-warm font-bold active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-stone-600" />
          <span>홈으로 돌아가기</span>
        </button>
      </div>

      {/* 중앙 메인: 3D 온기 유리병 캔버스 (자동 회전 OFF, 손으로만 횡방향 회전) */}
      <div className="relative w-full max-w-xl h-full flex items-center justify-center z-10">
        {isLoading && waxPieces.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-stone-500">
            <div className="w-8 h-8 border-2 border-[#6B1724] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-serif-warm font-medium">유리병 안의 온기 조각을 모으는 중...</span>
          </div>
        ) : waxPieces.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            {/* 빈 병 렌더링 */}
            <div className="w-full h-[70%] max-h-[460px]">
              <MemoryJarCanvas
                ref={jarCanvasRef}
                pieces={[]}
                options={jarRenderOptions}
                showInternalShakeButton={false}
                showSunlightBadge={false}
                showHint={false}
              />
            </div>
            <div className="mt-2 p-4 rounded-2xl bg-white/80 border border-stone-200/80 shadow-sm max-w-xs space-y-1 backdrop-blur-xs">
              <p className="font-serif-warm font-bold text-sm text-stone-800">
                아직 병에 담긴 온기가 없습니다
              </p>
              <p className="text-xs text-stone-500 leading-relaxed font-sans-ui">
                둘만의 첫 교환일기를 작성하면 소중한 실링 왁스가 이 유리병 안에 차곡차곡 모입니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <MemoryJarCanvas
              ref={jarCanvasRef}
              pieces={waxPieces}
              options={jarRenderOptions}
              showInternalShakeButton={false}
              showSunlightBadge={false}
              showHint={false}
              onOpenDiaryPiece={(piece) => {
                // piece.diaryId로 diaries 최신 목록에서 직접 1:1 매칭 (불일치 원천 차단)
                const targetDiary =
                  diaries.find((d) => d.diaryId && d.diaryId === piece.diaryId) ||
                  (piece.diary as DiaryData | undefined) ||
                  diaries.find((d) => d.title === piece.title);
                if (targetDiary) {
                  onSelectDiary(targetDiary);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 하단: 병 흔들기 액션 버튼 및 쿨다운 알림 */}
      {waxPieces.length > 0 && (
        <div className="absolute bottom-6 inset-x-0 mx-auto w-fit z-20 flex flex-col items-center gap-2">
          {cooldownToast && (
            <div className="animate-fade-in px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-[11px] text-amber-200 font-sans-ui shadow-lg">
              잠시 후 다시 흔들어주세요 (1초에 1번)
            </div>
          )}
          <button
            type="button"
            onClick={handleShakeClick}
            disabled={isThrottled}
            className={`px-5 py-2.5 rounded-full text-xs font-serif-warm font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer border ${
              isThrottled
                ? 'bg-[#5C1A24]/70 text-amber-200/60 border-[#5C1A24] cursor-not-allowed scale-95'
                : 'bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 shadow-[#6B1724]/20 border-[#831D2D] active:scale-95'
            }`}
            title="병을 흔들어 묻혀 있는 왁스들을 물리 엔진으로 섞습니다 (1초에 1번)"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-300" />
            <span>병 흔들기 (왁스 섞기)</span>
          </button>
        </div>
      )}
    </div>
  );
}
