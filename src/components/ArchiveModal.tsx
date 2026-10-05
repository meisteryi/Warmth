'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryData } from '@/types/diary';
import { getRoomDiariesFromFirestore, getCachedRoomDiaries } from '@/lib/roomService';
import { generateFallbackWarmth } from '@/lib/gemini';
import { 
  BookOpen, 
  Calendar, 
  Sparkles, 
  X, 
  RefreshCw, 
  ChevronRight, 
  BarChart3, 
  Printer, 
  Flame, 
  Heart, 
  Download,
  Lock,
  AlertCircle
} from 'lucide-react';
import { soundEngine } from '@/lib/audio';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';

interface WarmthStats {
  totalDiaries: number;
  avgTemp: number;
  hottestDiary: DiaryData | null;
  maxTemp: number;
  topKeywords: [string, number][];
  monthlyCounts: [string, number][];
}

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  currentUserName: string;
  partnerName: string;
  onSelectDiary: (diary: DiaryData) => void;
  onOpenSealedLetter?: () => void;
}

// 상대방이 보낸 미개봉 비밀 편지는 React State/메모리 레벨에서도 완전히 마스킹 (F12/DevTools 스포일러 원천 차단)
function maskUnopenedDiaries(list: DiaryData[], currentUserName: string): DiaryData[] {
  return list.map((item) => {
    const isMine = item.authorName === currentUserName;
    if (!isMine && !item.isWaxBroken) {
      return {
        ...item,
        title: `${item.authorName} 님이 보낸 비밀 편지`,
        content: '실링 왁스로 봉인되어 있습니다. 메인 화면에서 관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.',
        photos: [],
        warmthScore: undefined,
        stamp: undefined,
      };
    }
    return item;
  });
}

export default function ArchiveModal({
  isOpen,
  onClose,
  roomCode,
  currentUserName,
  partnerName,
  onSelectDiary,
  onOpenSealedLetter,
}: ArchiveModalProps) {
  // SWR(Stale-While-Revalidate): 메모리 캐시가 있으면 즉시 초기값으로 렌더링
  const [diaries, setDiaries] = useState<DiaryData[]>(() => {
    if (typeof window !== 'undefined' && roomCode) {
      const cached = getCachedRoomDiaries(roomCode);
      if (cached && cached.length > 0) {
        return maskUnopenedDiaries(cached, currentUserName);
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'LIST' | 'REPORT' | 'BOOKLET'>('LIST');
  const [diaryLimit, setDiaryLimit] = useState(5);
  const [hasMore, setHasMore] = useState(false);

  const fetchDiaries = async (limitCount = 5) => {
    if (!roomCode) return;
    // 캐시된 데이터가 전혀 없을 때만 로딩 스피너 표시 (기존 데이터가 있으면 백그라운드 갱신)
    if (diaries.length === 0) {
      setIsLoading(true);
    }
    setLoadError(null);

    let isCompleted = false;
    // 브라우저 백그라운드 소켓 정체 시 무한 로딩을 차단하는 6초 안전 타임아웃
    const safetyTimer = setTimeout(() => {
      if (!isCompleted) {
        setIsLoading(false);
        if (diaries.length === 0) {
          setLoadError('네트워크 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
        }
      }
    }, 6000);

    try {
      const list = await getRoomDiariesFromFirestore(roomCode, limitCount);
      isCompleted = true;
      clearTimeout(safetyTimer);
      setHasMore(list.length >= limitCount);
      
      const sanitized = maskUnopenedDiaries(list, currentUserName);
      setDiaries(sanitized);
      setLoadError(null);
    } catch (e) {
      console.warn('Failed to fetch archive:', e);
      isCompleted = true;
      clearTimeout(safetyTimer);
      if (diaries.length === 0) {
        setLoadError('일기를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && roomCode) {
      soundEngine.playPaperRustle();
      setDiaryLimit(5);
      setLoadError(null);

      // 모달이 열릴 때 캐시가 있으면 즉시 화면에 주입하여 깜빡임 제거
      const cached = getCachedRoomDiaries(roomCode);
      if (cached && cached.length > 0) {
        setDiaries(maskUnopenedDiaries(cached, currentUserName));
      } else {
        setDiaries([]);
      }

      fetchDiaries(5);
    }
  }, [isOpen, roomCode]);

  const handleLoadMore = () => {
    const nextLimit = diaryLimit + 10;
    setDiaryLimit(nextLimit);
    fetchDiaries(nextLimit);
  };

  // [5번 요구사항] 월간 및 누적 온기 통계 & 키워드 분석
  const stats = useMemo<WarmthStats | null>(() => {
    // 상대방이 보낸 미개봉 비밀 편지는 스포일러 방지를 위해 온기 통계에서 제외
    const readableDiaries = diaries.filter(
      (d) => d.isWaxBroken || d.authorName === currentUserName
    );
    if (readableDiaries.length === 0) return null;

    let totalTemp = 0;
    let validTempCount = 0;
    let maxTemp = -999;
    let hottestDiary: DiaryData | null = null;
    const keywordCounts: { [kw: string]: number } = {};
    const monthlyCounts: { [month: string]: number } = {};

    readableDiaries.forEach((d) => {
      const warmth = (d.warmthScore && typeof d.warmthScore.temperature === 'number')
        ? d.warmthScore
        : generateFallbackWarmth(d.title, d.content);

      if (warmth && typeof warmth.temperature === 'number') {
        totalTemp += warmth.temperature;
        validTempCount++;
        if (warmth.temperature > maxTemp) {
          maxTemp = warmth.temperature;
          hottestDiary = d;
        }
        if (warmth.keywords) {
          warmth.keywords.forEach((kw) => {
            const clean = kw.trim();
            if (clean) keywordCounts[clean] = (keywordCounts[clean] || 0) + 1;
          });
        }
      }

      if (d.createdAt) {
        try {
          const date = new Date(d.createdAt);
          const mKey = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
          monthlyCounts[mKey] = (monthlyCounts[mKey] || 0) + 1;
        } catch { }
      }
    });

    const avgTemp = validTempCount > 0 ? Number((totalTemp / validTempCount).toFixed(1)) : 36.5;
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    return {
      totalDiaries: readableDiaries.length,
      avgTemp,
      hottestDiary,
      maxTemp: maxTemp > -999 ? maxTemp : avgTemp,
      topKeywords,
      monthlyCounts: Object.entries(monthlyCounts),
    };
  }, [diaries, currentUserName]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState('');

  // [2번 요구사항] 소책자 인쇄 / PDF 저장 (모바일 PWA 및 웹 완벽 대응)
  const handlePrintBooklet = async () => {
    soundEngine.playMissionPassChime();

    setIsGeneratingPdf(true);
    setPdfProgressText('소책자 페이지 준비 중...');

    try {
      const element = document.getElementById('warmth-booklet-printable');
      if (!element) {
        if (typeof window !== 'undefined') window.print();
        return;
      }

      setPdfProgressText('고화질 페이지 렌더링 중...');
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });

      setPdfProgressText('A4 PDF 파일 생성 중...');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const fileName = `온기_교환일기_소책자_${roomCode}.pdf`;
      const pdfBlob = pdf.output('blob');

      // 1. 모바일 환경: Web Share API로 네이티브 파일 저장 및 프린트 시트 띄우기 (iOS 파일에 저장, 카카오톡, AirPrint)
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [new File([pdfBlob], fileName, { type: 'application/pdf' })],
        })
      ) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          await navigator.share({
            title: '온기 (Warmth) 소책자',
            text: `${currentUserName} & ${partnerName} 둘만의 교환일기 소책자입니다.`,
            files: [file],
          });
          return;
        } catch (shareErr: unknown) {
          if ((shareErr as Error)?.name === 'AbortError') {
            return; // 사용자가 공유창을 직접 닫음
          }
          console.warn('Web Share failed, fallback to direct download:', shareErr);
        }
      }

      // 2. 모바일/데스크톱 공통: 다운로드 및 뷰어 트리거
      const url = URL.createObjectURL(pdfBlob);
      const isMobile = typeof window !== 'undefined' && (
        window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      );
      const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      );

      if (isMobile) {
        // 모바일 환경: 새 창/탭으로 PDF 직접 열기 (iOS Safari 및 Android 내장 뷰어에서 '파일에 저장', 'AirPrint' 직접 가능)
        const opened = window.open(url, '_blank');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // 데스크톱: 직접 다운로드 파일 링크
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      // 3. 데스크톱 일반 브라우저에서는 인쇄 대화상자도 함께 제공
      if (!isMobile && !isStandalone && typeof window !== 'undefined') {
        setTimeout(() => {
          window.print();
        }, 800);
      }
    } catch (err) {
      console.warn('PDF generation failed, fallback to print:', err);
      if (typeof window !== 'undefined') window.print();
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl max-h-[92dvh] flex flex-col bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#E8DFD3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* 모달 상단 헤더 */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#E8DFD3] bg-[#F4EFEA] flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-sm">
              <WarmthHanjaIcon className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-serif-warm font-bold text-stone-900">
                둘만의 서재
              </h2>
              <p className="text-xs text-stone-500 font-sans-ui mt-0.5">
                #{roomCode} · {currentUserName} & {partnerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchDiaries(diaryLimit)}
              disabled={isLoading}
              title="새로고침"
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 상단 탭 전환 네비게이션 */}
        <div className="flex border-b border-[#E8DFD3] bg-[#FAF6EE] px-4 sm:px-6 gap-2 text-xs font-sans-ui no-print">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LIST');
              soundEngine.playTileSlideSound();
            }}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'LIST'
                ? 'border-[#6B1724] text-[#6B1724]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>일기 보관함 ({diaries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REPORT');
              soundEngine.playTileSlideSound();
            }}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'REPORT'
                ? 'border-[#6B1724] text-[#6B1724]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-800" />
            <span>월간 온기 리포트</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('BOOKLET');
              soundEngine.playTileSlideSound();
            }}
            className={`py-3 px-3 border-b-2 font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'BOOKLET'
                ? 'border-[#6B1724] text-[#6B1724]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-stone-700" />
            <span>소책자 PDF / 인쇄</span>
          </button>
        </div>

        {/* 탭 1: 일기 목록 영역 */}
        {activeTab === 'LIST' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {isLoading && diaries.length === 0 ? (
              <div className="py-16 text-center text-stone-500 font-serif-warm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B1724] mb-2" />
                <p className="text-sm">보관된 일기를 불러오는 중입니다...</p>
              </div>
            ) : loadError && diaries.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-3 border border-rose-200 shadow-2xs">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                  일기를 불러오지 못했습니다
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed mb-4">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => fetchDiaries(diaryLimit)}
                  className="px-4 py-2 bg-[#6B1724] text-white rounded-xl text-xs font-serif-warm font-semibold shadow hover:bg-[#851E2E] transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 시도하기</span>
                </button>
              </div>
            ) : diaries.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100/70 text-[#6B1724] flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <BookOpen className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                  아직 보관된 일기가 없습니다
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  서로 주고받은 일기가 이곳에 소중히 보관됩니다.
                </p>
              </div>
            ) : (
              diaries.map((item) => {
                const isMine = item.authorName === currentUserName;
                const isUnopenedByMe = !isMine && !item.isWaxBroken;
                const isMyUnopenedLetter = isMine && !item.isWaxBroken;
                const formattedDate = formatDate(item.createdAt);

                // 상대방이 보낸 미개봉 비밀 편지인 경우 -> 잠금 카드 렌더링
                if (isUnopenedByMe) {
                  return (
                    <div
                      key={item.diaryId}
                      onClick={() => {
                        soundEngine.playPaperRustle();
                        if (onOpenSealedLetter) {
                          onOpenSealedLetter();
                        } else {
                          onClose();
                        }
                      }}
                      className="group relative p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-50/70 via-amber-50/40 to-stone-50 border border-rose-200/90 hover:border-rose-300 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            {formattedDate}
                          </span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-serif-warm font-bold border bg-rose-100/90 text-rose-950 border-rose-300 animate-pulse flex items-center gap-1">
                            <Lock className="w-3 h-3 text-rose-800" />
                            <span>미개봉 비밀 편지</span>
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border bg-rose-50 text-rose-900 border-rose-200">
                            {item.authorName}의 온기
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-serif-warm font-bold text-rose-900 group-hover:translate-x-0.5 transition-transform shrink-0">
                          <span>메인에서 개봉하기</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>

                      <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-snug flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#6B1724] text-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-amber-200" />
                        </div>
                        <span>{item.authorName} 님이 보낸 비밀 편지</span>
                      </h3>

                      <p className="text-xs text-stone-600 leading-relaxed font-serif-warm bg-white/80 p-3 rounded-xl border border-rose-100/80 flex items-center gap-2">
                        <span className="text-sm shrink-0">💌</span>
                        <span>실링 왁스로 봉인되어 있습니다. 메인 화면에서 관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.</span>
                      </p>
                    </div>
                  );
                }

                // 정상 열람 가능한 일기 (내가 쓴 일기 또는 이미 개봉된 일기)
                const itemWarmth = (item.warmthScore && typeof item.warmthScore.temperature === 'number')
                  ? item.warmthScore
                  : generateFallbackWarmth(item.title, item.content);

                return (
                  <div
                    key={item.diaryId}
                    onClick={() => {
                      soundEngine.playPaperRustle();
                      onSelectDiary(item);
                    }}
                    className="group relative p-4 rounded-2xl bg-white border border-[#E8DFD3] hover:border-[#6B1724]/40 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          {formattedDate}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border ${
                            isMine
                              ? 'bg-amber-100/80 text-amber-900 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200'
                          }`}
                        >
                          {item.authorName}의 기록
                        </span>

                        {isMyUnopenedLetter && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-serif-warm font-bold border bg-amber-50 text-amber-950 border-amber-200">
                            상대방 미개봉 ✉️
                          </span>
                        )}

                        {/* [3번 요구사항] 저장된 날씨·기분 잉크 도장 표시 */}
                        {item.stamp && item.stamp.style !== 'EMOJI_TITLE' && (
                          <span 
                            className="text-[10px] px-2 py-0.5 rounded-full border border-dashed font-serif-warm inline-flex items-center gap-1"
                            style={{
                              borderColor: item.stamp.color || '#A83232',
                              color: item.stamp.color || '#A83232',
                              backgroundColor: `${item.stamp.color || '#A83232'}0D`,
                            }}
                          >
                            <span>{item.stamp.symbol}</span>
                            <span>{item.stamp.name}</span>
                          </span>
                        )}

                        {itemWarmth && typeof itemWarmth.temperature === 'number' && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold inline-flex items-center gap-1 ${
                            itemWarmth.temperature <= 0
                              ? 'bg-sky-50 text-sky-900 border border-sky-200'
                              : 'bg-amber-50 text-amber-900 border border-amber-200/60'
                          }`}>
                            <Sparkles className={`w-3 h-3 ${itemWarmth.temperature <= 0 ? 'text-sky-600' : 'text-amber-600'}`} />
                            {itemWarmth.temperature > 0 ? `+${itemWarmth.temperature.toFixed(1)}` : itemWarmth.temperature.toFixed(1)}°C
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs font-serif-warm text-[#6B1724] group-hover:translate-x-0.5 transition-transform shrink-0">
                        <span>열람하기</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-snug group-hover:text-[#6B1724] transition-colors flex items-center gap-1.5">
                      {item.stamp && item.stamp.style === 'EMOJI_TITLE' && (
                        <span className="text-xl -rotate-6 inline-block shrink-0" title={item.stamp.name}>
                          {item.stamp.symbol}
                        </span>
                      )}
                      <span>{item.title || '(제목 없음)'}</span>
                    </h3>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-serif-warm">
                      {item.content}
                    </p>

                    {itemWarmth?.keywords && itemWarmth.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {itemWarmth.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-serif-warm"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {hasMore && (
              <div className="pt-2 pb-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/70 border border-amber-300/80 text-amber-950 text-xs font-serif-warm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? '불러오는 중...' : '📜 더 많은 지난 편지 불러오기 (+10건)'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 탭 2: [5번 요구사항] 월간 온기 리포트 & 키워드 분석 영역 */}
        {activeTab === 'REPORT' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {!stats || stats.totalDiaries === 0 ? (
              <div className="py-16 text-center text-stone-500 font-serif-warm">
                <BarChart3 className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                <p className="text-sm font-semibold">아직 분석할 편지 데이터가 없습니다</p>
                <p className="text-xs text-stone-400 mt-1">편지를 주고받으면 둘만의 감성 온도와 키워드가 분석됩니다.</p>
              </div>
            ) : (
              <>
                {/* 평균 온기 온도 대형 카드 */}
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#FFFBF4] to-[#F5ECE0] border border-[#E8DFC8] shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-sans-ui font-bold text-amber-900 tracking-wider">
                      둘만의 평균 온기 지수
                    </span>
                    <span className="text-xs font-serif-warm text-stone-500">
                      총 {stats.totalDiaries}편의 편지 분석
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 my-2">
                    <span className="font-mono text-4xl sm:text-5xl font-bold text-[#6B1724]">
                      +{stats.avgTemp.toFixed(1)}°C
                    </span>
                    <span className="text-xs sm:text-sm font-serif-warm text-stone-600">
                      {stats.avgTemp >= 30
                        ? '깊은 애정과 설렘이 가득한 뜨거운 온기'
                        : stats.avgTemp >= 15
                        ? '하루의 피로를 녹여주는 다정하고 포근한 온기'
                        : '잔잔하고 담담하게 서로를 지켜주는 온기'}
                    </span>
                  </div>
                </div>

                {/* 가장 뜨거웠던 편지 하이라이트 */}
                {stats.hottestDiary && (
                  <div className="p-4 rounded-2xl bg-white border border-[#E8DFD3] shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-[#6B1724] mb-1.5">
                      <Flame className="w-4 h-4 text-[#6B1724]" />
                      <span>우리 둘의 가장 뜨거웠던 순간</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-serif-warm font-bold text-stone-900 text-sm sm:text-base">
                        「{stats.hottestDiary.title}」
                      </h4>
                      <span className="font-mono font-bold text-sm text-[#6B1724] shrink-0">
                        +{stats.maxTemp.toFixed(1)}°C
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-serif-warm mt-1">
                      {formatDate(stats.hottestDiary.createdAt)} · 작성자 {stats.hottestDiary.authorName}
                    </p>
                  </div>
                )}

                {/* 다정한 키워드 구름 Top 12 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DFD3] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-stone-800 mb-3">
                    <Heart className="w-4 h-4 text-rose-600" />
                    <span>우리가 편지에서 가장 많이 나눈 다정한 단어들</span>
                  </div>

                  {stats.topKeywords.length === 0 ? (
                    <p className="text-xs text-stone-400 font-serif-warm py-4 text-center">
                      아직 추출된 감성 해시태그가 없습니다.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center justify-center py-2">
                      {stats.topKeywords.map(([kw, count], idx) => {
                        const isTop = idx < 3;
                        return (
                          <span
                            key={kw}
                            className={`px-3 py-1.5 rounded-xl font-serif-warm transition-all ${
                              isTop
                                ? 'bg-[#6B1724] text-amber-50 font-bold text-sm shadow-xs'
                                : 'bg-[#FAF4ED] text-stone-800 border border-[#E8DFD3] text-xs font-medium'
                            }`}
                          >
                            {kw}
                            <span className={`text-[10px] ml-1.5 ${isTop ? 'text-amber-200' : 'text-stone-400'}`}>
                              {count}회
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 월별 작성 편수 요약 */}
                {stats.monthlyCounts.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white border border-[#E8DFD3] shadow-xs">
                    <div className="text-xs font-sans-ui font-bold text-stone-800 mb-2">
                      월별 작성 기록
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stats.monthlyCounts.map(([month, count]) => (
                        <div key={month} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-center">
                          <div className="text-xs text-stone-600 font-serif-warm">{month}</div>
                          <div className="text-sm font-bold text-[#6B1724] font-mono mt-0.5">{count}편</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 탭 3: [2번 요구사항] 소책자 PDF / 인쇄 미리보기 영역 */}
        {activeTab === 'BOOKLET' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs no-print">
              <div>
                <h4 className="font-serif-warm font-bold text-sm sm:text-base text-stone-900 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-[#6B1724]" />
                  <span>아날로그 교환일기 소책자 인쇄 / PDF 저장</span>
                </h4>
                <p className="text-xs text-stone-600 font-sans-ui mt-0.5">
                  아래 &lsquo;PDF 다운로드 / 인쇄하기&rsquo;를 누르신 후 [PDF로 저장]을 선택하시면 영구 소장 책으로 저장됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrintBooklet}
                disabled={isGeneratingPdf}
                className={`px-4 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-95 text-amber-50 font-serif-warm font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                  isGeneratingPdf ? 'opacity-80 cursor-wait' : 'cursor-pointer'
                }`}
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{pdfProgressText || 'PDF 생성 중...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>PDF 다운로드 / 인쇄하기</span>
                  </>
                )}
              </button>
            </div>

            {/* 실제 인쇄 및 미리보기 소책자 컨테이너 */}
            <div
              id="warmth-booklet-printable"
              className="warmth-booklet-printable bg-white p-6 sm:p-10 rounded-2xl border border-[#E8DFC8] shadow-sm font-serif-warm text-stone-900 space-y-8"
            >
              {/* 1. 소책자 표지 */}
              <div className="text-center py-12 border-b-2 border-[#6B1724] print-page-break">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-md mb-4 border-2 border-amber-200">
                  <WarmthHanjaIcon className="w-8 h-8 text-amber-100" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mb-2">
                  온기 (Warmth)
                </h1>
                <p className="text-sm text-stone-600 mb-6 font-medium">
                  둘만의 비밀 교환일기
                </p>
                <div className="inline-block px-5 py-2 rounded-full border border-stone-300 text-xs text-stone-700 font-sans-ui">
                  {currentUserName} & {partnerName} · 비밀 서재 #{roomCode}
                </div>
                <p className="text-[11px] text-stone-400 font-mono mt-4">
                  총 {diaries.length}편의 이야기 수록 · 인쇄일자: {new Date().toLocaleDateString('ko-KR')}
                </p>
              </div>

              {/* 2. 목차 */}
              <div className="py-4 border-b border-stone-200 print-page-break">
                <h2 className="text-lg font-bold text-stone-900 mb-4 pb-1 border-b border-stone-300">
                  목차 (Contents)
                </h2>
                <div className="space-y-2 text-xs">
                  {diaries.map((d, idx) => {
                    const isUnopenedByMe = d.authorName !== currentUserName && !d.isWaxBroken;
                    return (
                      <div key={d.diaryId} className="flex justify-between items-baseline gap-2 border-b border-dashed border-stone-200 pb-1">
                        <span className="truncate">
                          #{idx + 1}. {isUnopenedByMe ? `🔒 ${d.authorName} 님의 비밀 편지 (미개봉)` : `${d.title || '(제목 없음)'} (${d.authorName})`}
                        </span>
                        <span className="font-mono text-stone-400 shrink-0">
                          {formatDate(d.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. 각 일기 본문 페이지들 (시간 순 정렬) */}
              {diaries.map((diary, idx) => {
                const isUnopenedByMe = diary.authorName !== currentUserName && !diary.isWaxBroken;

                if (isUnopenedByMe) {
                  return (
                    <div key={diary.diaryId} className="pt-4 pb-8 border-b border-stone-300 print-page-break space-y-4">
                      <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200">
                        <span>#{idx + 1}편 · {formatDate(diary.createdAt)}</span>
                        <span className="font-semibold text-rose-900">작성자: {diary.authorName}</span>
                      </div>
                      <div className="p-8 rounded-xl bg-stone-50 border border-dashed border-stone-300 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-900 flex items-center justify-center mx-auto">
                          <Lock className="w-5 h-5 text-rose-700" />
                        </div>
                        <h4 className="font-bold text-stone-900 text-base">미개봉 비밀 편지</h4>
                        <p className="text-xs text-stone-600">
                          수신자가 메인 화면에서 실링 왁스를 개봉한 후에 내용을 확인하실 수 있습니다.
                        </p>
                      </div>
                    </div>
                  );
                }

                const diaryWarmth = (diary.warmthScore && typeof diary.warmthScore.temperature === 'number')
                  ? diary.warmthScore
                  : generateFallbackWarmth(diary.title, diary.content);

                return (
                  <div key={diary.diaryId} className="pt-4 pb-8 border-b border-stone-300 print-page-break space-y-4">
                    <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-200">
                      <span>#{idx + 1}편 · {formatDate(diary.createdAt)}</span>
                      <div className="flex items-center gap-2">
                        {diary.stamp && diary.stamp.style !== 'EMOJI_TITLE' && (
                          <span className="px-2 py-0.5 rounded-full border border-stone-300 text-[10px]">
                            {diary.stamp.symbol} {diary.stamp.name}
                          </span>
                        )}
                        <span className="font-semibold text-stone-800">작성자: {diary.authorName}</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                      {diary.stamp && diary.stamp.style === 'EMOJI_TITLE' && (
                        <span className="text-2xl">{diary.stamp.symbol}</span>
                      )}
                      <span>{diary.title || '(제목 없음)'}</span>
                    </h3>

                    {diary.photos && diary.photos.length > 0 && (
                      <div className="my-4 flex flex-wrap gap-3">
                        {diary.photos.map((p, pIdx) => (
                          <div key={pIdx} className="w-48 aspect-[4/3] bg-stone-100 border border-stone-300 rounded overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p} alt="일기 사진" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm leading-relaxed text-stone-800 whitespace-pre-line my-4 font-serif-warm">
                      {diary.content}
                    </div>

                    {diaryWarmth && (
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
                        <span>온기의 온도: +{diaryWarmth.temperature.toFixed(1)}°C</span>
                        <span className="italic">&ldquo;{diaryWarmth.comment}&rdquo;</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 하단 닫기 바 (iOS 홈 제스처 바 여백 확보) */}
        <div className="px-5 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] border-t border-[#E8DFD3] bg-[#FAF7F2] flex justify-end shrink-0 no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-serif-warm font-bold transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
