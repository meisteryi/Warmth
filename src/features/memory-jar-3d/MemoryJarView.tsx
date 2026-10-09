'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Shuffle, ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
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

/**
 * 날짜에서 YYYY-MM 추출 (월별 그룹핑용)
 */
function getYearMonthKey(dateString?: string): string {
  if (!dateString) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '2026-10';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '2026-10';
  }
}

interface MonthJarGroup {
  key: string;       // "2026-10"
  year: number;      // 2026
  month: number;     // 10
  label: string;     // "2026년 10월"
  shortLabel: string;// "10월"
  diaries: DiaryData[];
  isLatest: boolean; // 가장 최신 월인가? (최신이면 코르크 마개 열림)
}

export default function MemoryJarView({
  roomCode,
  currentUserName,
  partnerName,
  onGoHome,
  onSelectDiary,
}: MemoryJarViewProps) {
  const jarCanvasRef = useRef<MemoryJarCanvasHandle>(null);

  // Firestore에서 현재 방의 모든 일기 로드
  const [roomDiaries, setRoomDiaries] = useState<DiaryData[]>(() => {
    if (typeof window !== 'undefined' && roomCode) {
      const cached = getCachedRoomDiaries(roomCode);
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(roomDiaries.length === 0);

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

  useEffect(() => {
    if (!roomCode) return;
    let isMounted = true;

    async function loadDiaries() {
      try {
        const list = await getRoomDiariesFromFirestore(roomCode);
        if (isMounted) {
          if (list && list.length > 0) {
            setRoomDiaries(list);
          } else {
            const cached = getCachedRoomDiaries(roomCode);
            if (cached && cached.length > 0) {
              setRoomDiaries(cached);
            }
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load diaries for MemoryJarView:', err);
        if (isMounted) {
          const cached = getCachedRoomDiaries(roomCode);
          if (cached && cached.length > 0) setRoomDiaries(cached);
          setIsLoading(false);
        }
      }
    }

    loadDiaries();
    return () => {
      isMounted = false;
    };
  }, [roomCode]);

  // 편지가 작성된 달들만 추출하여 월별 병(MonthJarGroup) 목록 생성
  const monthJars: MonthJarGroup[] = useMemo(() => {
    if (roomDiaries.length === 0) return [];

    const map = new Map<string, DiaryData[]>();

    roomDiaries.forEach((d) => {
      const key = getYearMonthKey(d.createdAt);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(d);
    });

    // 연월 오름차순 (과거 -> 현재) 정렬
    const sortedKeys = Array.from(map.keys()).sort();

    return sortedKeys.map((key, index) => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr, 10) || 2026;
      const month = parseInt(monthStr, 10) || 10;
      const diariesInMonth = map.get(key)!;
      const isLatest = index === sortedKeys.length - 1;

      return {
        key,
        year,
        month,
        label: `${year}년 ${month}월`,
        shortLabel: `${month}월`,
        diaries: diariesInMonth,
        isLatest,
      };
    });
  }, [roomDiaries]);

  // 현재 선택된 월 인덱스 (기본값: 가장 최신 월)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  // monthJars가 갱신될 때 최신 달로 자동 포커스
  useEffect(() => {
    if (monthJars.length > 0) {
      setSelectedMonthIndex(monthJars.length - 1);
    }
  }, [monthJars.length]);

  // 안전한 현재 월 데이터
  const currentJar: MonthJarGroup | undefined = monthJars[selectedMonthIndex] || monthJars[0];

  // 3D 병 슬라이드 전환 진행 여부 (중복 연타 방지)
  const [isSliding, setIsSliding] = useState<boolean>(false);

  // 중앙 버튼 클릭 시 연도/월 선택 팝오버 상태
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isPickerOpen) return;
    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isPickerOpen]);

  // 화살표 네비게이션: 책상은 멈춰있고 병만 책상 위를 스르륵 미끄러져 사라졌다가 새로운 병이 반대편에서 나타남
  const handleNavigateMonth = (direction: 'prev' | 'next') => {
    if (isSliding || monthJars.length <= 1) return;

    const nextIndex = direction === 'prev' ? selectedMonthIndex - 1 : selectedMonthIndex + 1;
    if (nextIndex < 0 || nextIndex >= monthJars.length) return;

    setIsSliding(true);
    setIsPickerOpen(false);

    const started = jarCanvasRef.current?.slideTransition(direction, () => {
      // 3D 병이 화면 밖으로 완전히 나간 순간에 새로운 달 데이터 및 왁스 교체
      setSelectedMonthIndex(nextIndex);
    });

    if (!started) {
      setSelectedMonthIndex(nextIndex);
      setIsSliding(false);
    } else {
      setTimeout(() => {
        setIsSliding(false);
      }, 700);
    }
  };

  // 팝오버에서 특정 달 직접 선택 시 3D 슬라이드 연동
  const handleSelectMonthDirectly = (targetIndex: number) => {
    if (targetIndex === selectedMonthIndex || isSliding) {
      setIsPickerOpen(false);
      return;
    }

    setIsPickerOpen(false);
    const direction = targetIndex > selectedMonthIndex ? 'next' : 'prev';
    setIsSliding(true);

    const started = jarCanvasRef.current?.slideTransition(direction, () => {
      setSelectedMonthIndex(targetIndex);
    });

    if (!started) {
      setSelectedMonthIndex(targetIndex);
      setIsSliding(false);
    } else {
      setTimeout(() => {
        setIsSliding(false);
      }, 700);
    }
  };

  // 현재 선택된 월의 일기들을 1:1 WaxPieceData로 변환
  const waxPieces: WaxPieceData[] = useMemo(() => {
    if (!currentJar) return [];

    return currentJar.diaries.map((diary, index) => {
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
        size: 0.95 + ((index % 3) * 0.08),
        photoUrl: safeDiary.photos && safeDiary.photos.length > 0 ? safeDiary.photos[0] : undefined,
        diary: safeDiary,
      };
    });
  }, [currentJar]);

  // 메모이제이션된 3D 렌더 옵션 (최신 달: 마개 열림 / 과거 달: 마개 닫힘)
  const isCorkOpen = currentJar?.isLatest ?? true;
  const jarRenderOptions = useMemo(
    () => ({
      autoRotate: false,
      enableSunlightParticles: false,
      enableGyroscope: false,
      isCorkOpen,
    }),
    [isCorkOpen]
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



      {/* 중앙 메인: 3D 온기 유리병 캔버스 (책상은 고정, 병만 좌우로 스르륵 미끄러짐) */}
      <div className="relative w-full max-w-xl h-full flex items-center justify-center z-10">
        {isLoading && waxPieces.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-stone-500">
            <div className="w-8 h-8 border-2 border-[#6B1724] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-serif-warm font-medium">유리병 안의 온기 조각을 모으는 중...</span>
          </div>
        ) : monthJars.length === 0 || waxPieces.length === 0 ? (
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
            <div className="mt-2 p-4 rounded-2xl bg-white/80 border border-stone-200/80 shadow-sm max-w-xs space-y-1.5 backdrop-blur-xs">
              <p className="font-serif-warm font-bold text-sm text-stone-800">
                아직 병에 담긴 온기가 없습니다
              </p>
              <p className="text-xs text-stone-500 leading-relaxed font-sans-ui">
                둘만의 첫 교환일기를 작성하면 소중한 실링 왁스가 이 유리병 안에 차곡차곡 모입니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <MemoryJarCanvas
              ref={jarCanvasRef}
              pieces={waxPieces}
              options={jarRenderOptions}
              showInternalShakeButton={false}
              showSunlightBadge={false}
              showHint={false}
              onOpenDiaryPiece={(piece) => {
                const targetDiary =
                  currentJar?.diaries.find((d) => d.diaryId && d.diaryId === piece.diaryId) ||
                  (piece.diary as DiaryData | undefined) ||
                  currentJar?.diaries.find((d) => d.title === piece.title);
                if (targetDiary) {
                  onSelectDiary(targetDiary);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 하단: 월별 온기 병 네비게이션 & 병 흔들기 액션 컨트롤 */}
      {monthJars.length > 0 && currentJar && (
        <div className="absolute bottom-6 inset-x-0 mx-auto w-fit z-20 flex flex-col items-center gap-2.5">
          {cooldownToast && (
            <div className="animate-fade-in px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-[11px] text-amber-200 font-sans-ui shadow-lg">
              잠시 후 다시 흔들어주세요 (1초에 1번)
            </div>
          )}

          {/* 1. 상단 행: [이전 동그란 버튼] [중앙 날짜 타원] [다음 동그란 버튼] */}
          <div className="relative flex items-center gap-2.5">
            {/* 연도와 월 선택 팝오버 (중앙 타원 클릭 시 표시) */}
            {isPickerOpen && (
              <div
                ref={pickerRef}
                className="absolute bottom-full mb-3 inset-x-0 mx-auto w-64 p-3 rounded-2xl bg-[#52131D]/95 border border-[#831D2D] shadow-2xl backdrop-blur-md text-amber-50 z-30 animate-fade-in"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-900/40 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-serif-warm font-bold text-amber-200">
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>온기 병 선택</span>
                  </div>
                  <span className="text-[10px] text-amber-300/70 font-sans-ui">
                    {monthJars.length}개의 온기 달
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                  {monthJars.map((jar, idx) => {
                    const isSelected = idx === selectedMonthIndex;
                    return (
                      <button
                        key={jar.key}
                        type="button"
                        onClick={() => handleSelectMonthDirectly(idx)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-serif-warm transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#831D2D] text-amber-200 font-bold border border-amber-300/40 shadow-sm'
                            : 'hover:bg-white/10 text-amber-100/90 hover:text-amber-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={isSelected ? 'text-amber-300 font-bold' : 'text-amber-400/40'}>•</span>
                          <span>{jar.label}</span>
                          {jar.isLatest && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                              기록 중
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-amber-200/60 font-sans-ui">
                          {jar.diaries.length}편
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 이전 달 화살표 동그란 버튼 */}
            <button
              type="button"
              onClick={() => handleNavigateMonth('prev')}
              disabled={selectedMonthIndex <= 0 || isSliding}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#6B1724] border border-[#831D2D] shadow-lg shadow-[#6B1724]/20 text-amber-300 hover:text-amber-100 hover:bg-[#831D2D] active:scale-90 ${
                selectedMonthIndex <= 0 || isSliding
                  ? 'opacity-25 cursor-not-allowed hover:bg-[#6B1724]'
                  : 'cursor-pointer'
              }`}
              title="이전 달의 온기 병으로 이동"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* 중앙: 날짜만 표시하는 타원형 버튼 (고정 너비 w-40, 높이 h-10) */}
            <button
              type="button"
              onClick={() => setIsPickerOpen((prev) => !prev)}
              className="h-10 w-40 rounded-full flex items-center justify-center gap-1.5 bg-[#6B1724] border border-[#831D2D] shadow-lg shadow-[#6B1724]/20 text-amber-50 text-xs font-serif-warm font-bold hover:bg-[#831D2D] active:scale-95 transition-all cursor-pointer group"
              title="클릭하여 다른 연도와 월을 선택합니다"
            >
              <span className="tracking-wide text-amber-50 text-xs font-bold group-hover:text-amber-200">
                {currentJar.label}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-amber-300/80 transition-transform duration-200 ${
                  isPickerOpen ? 'rotate-180 text-amber-200' : ''
                }`}
              />
            </button>

            {/* 다음 달 화살표 동그란 버튼 */}
            <button
              type="button"
              onClick={() => handleNavigateMonth('next')}
              disabled={selectedMonthIndex >= monthJars.length - 1 || isSliding}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#6B1724] border border-[#831D2D] shadow-lg shadow-[#6B1724]/20 text-amber-300 hover:text-amber-100 hover:bg-[#831D2D] active:scale-90 ${
                selectedMonthIndex >= monthJars.length - 1 || isSliding
                  ? 'opacity-25 cursor-not-allowed hover:bg-[#6B1724]'
                  : 'cursor-pointer'
              }`}
              title="다음 달의 온기 병으로 이동"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. 하단: 병 흔들기 버튼 (중앙 타원과 완벽히 동일한 h-10 높이, w-[260px]로 상하 일체 정렬) */}
          {waxPieces.length > 0 && (
            <button
              type="button"
              onClick={handleShakeClick}
              disabled={isThrottled || isSliding}
              className={`h-10 w-[260px] rounded-full text-xs font-serif-warm font-bold shadow-lg shadow-[#6B1724]/20 flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                isThrottled || isSliding
                  ? 'bg-[#5C1A24]/70 text-amber-200/60 border-[#5C1A24] cursor-not-allowed scale-95'
                  : 'bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 border-[#831D2D] active:scale-95'
              }`}
              title="병을 흔들어 묻혀 있는 왁스들을 물리 엔진으로 섞습니다 (1초에 1번)"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-300" />
              <span>병 흔들기 (왁스 섞기)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
