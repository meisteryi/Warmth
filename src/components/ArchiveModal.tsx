'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryData, MonthlyRecapData, sanitizeDiaryReaction, isDiaryWrittenByMe } from '@/types/diary';
import {
  getRoomDiariesFromFirestore,
  getCachedRoomDiaries,
  backfillRoomDiariesWarmthOnce,
  getSavedMonthlyRecap,
  saveMonthlyRecapToRoom,
  getOrCreateUserId,
} from '@/lib/roomService';
import { generateFallbackWarmth, generateMonthlyRecap } from '@/lib/gemini';
import { 
  BookOpen, 
  Calendar, 
  Sparkles, 
  X, 
  RefreshCw, 
  ChevronLeft,
  ChevronRight, 
  BarChart3, 
  Printer, 
  Flame, 
  Heart, 
  Download,
  Lock,
  AlertCircle,
  MessageSquareQuote,
  Camera,
  TrendingUp,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { soundEngine } from '@/lib/audio';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';
import { useLanguage } from '@/lib/i18n';

interface WarmthStats {
  totalDiaries: number;
  avgTemp: number;
  hottestDiary: DiaryData | null;
  maxTemp: number;
  topKeywords: [string, number][];
  monthlyCounts: [string, number][];
}

interface MonthlyDetailStats {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // 'YYYY년 M월'
  monthShortLabel: string; // 'M월'
  diaries: DiaryData[];
  avgTemp: number;
  prevMonthDiff: number | null;
  prevMonthShortLabel: string | null;
  topStamp: { symbol: string; name: string } | null;
  hottestDiary: DiaryData | null;
  maxTemp: number;
  topKeywords: [string, number][];
  chartPoints: Array<{
    dateLabel: string;
    fullDateLabel: string;
    temp: number;
    diary: DiaryData;
  }>;
  photos: Array<{
    url: string;
    caption?: string | null;
    dateLabel: string;
    authorName: string;
    diary: DiaryData;
  }>;
}

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  currentUserName: string;
  partnerName: string;
  onSelectDiary: (diary: DiaryData) => void;
  onOpenSealedLetter?: () => void;
  initialTab?: 'LIST' | 'REPORT' | 'BOOKLET';
  initialReportMonth?: string;
  isInlineView?: boolean;
}

// 상대방이 보낸 미개봉 비밀 편지는 React State/메모리 레벨에서도 완전히 마스킹 (F12/DevTools 스포일러 원천 차단)
function maskUnopenedDiaries(list: DiaryData[], currentUserName: string, partnerName?: string): DiaryData[] {
  const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
  return list.map((rawItem) => {
    const item = sanitizeDiaryReaction(rawItem);
    const isMine = isDiaryWrittenByMe(item, currentUserName, myUid, partnerName);
    if (!isMine && !item.isWaxBroken) {
      return {
        ...item,
        title: `${item.authorName} 님이 보낸 비밀 편지`,
        content: '실링 왁스로 봉인되어 있습니다. 메인 화면에서 관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.',
        photos: [],
        warmthScore: undefined,
        stamp: undefined,
        reaction: null,
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
  initialTab,
  initialReportMonth,
  isInlineView = false,
}: ArchiveModalProps) {
  const { language, t } = useLanguage();
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
  const [activeTab, setActiveTab] = useState<'LIST' | 'REPORT' | 'BOOKLET'>(initialTab || 'LIST');
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>(initialReportMonth || 'ALL');
  const [recapMap, setRecapMap] = useState<Record<string, MonthlyRecapData>>({});
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
  const [isSavingRecapImage, setIsSavingRecapImage] = useState(false);

  // [요구사항] 10개씩 페이지네이션 및 달력 인터페이스 상태
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());

  // 서재 내부 탭 및 페이지 전환 시 상단 스크롤 초기화
  const listContainerRef = useRef<HTMLDivElement>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const bookletContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      listContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      reportContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      bookletContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [isOpen, activeTab, currentPage]);

  const fetchDiaries = useCallback(async () => {
    if (!roomCode) return;
    // 캐시된 데이터가 전혀 없을 때만 로딩 스피너 표시 (기존 데이터가 있으면 백그라운드 갱신)
    setDiaries((prev) => {
      if (prev.length === 0) {
        setIsLoading(true);
      }
      return prev;
    });
    setLoadError(null);

    let isCompleted = false;
    // 브라우저 백그라운드 소켓 정체 시 무한 로딩을 차단하는 6초 안전 타임아웃
    const safetyTimer = setTimeout(() => {
      if (!isCompleted) {
        setIsLoading(false);
        setDiaries((prev) => {
          if (prev.length === 0) {
            setLoadError('네트워크 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
          }
          return prev;
        });
      }
    }, 6000);

    try {
      // 서재에는 언제나 모든 일기가 표시되도록 limit 없이 전체 조회
      const list = await getRoomDiariesFromFirestore(roomCode);
      isCompleted = true;
      clearTimeout(safetyTimer);
      
      const sanitized = maskUnopenedDiaries(list, currentUserName);
      setDiaries(sanitized);
      setLoadError(null);

      // 기존 편지에 대해 1회 한정 Gemini AI 온기 측정 백필
      backfillRoomDiariesWarmthOnce(roomCode, (updatedList) => {
        setDiaries(maskUnopenedDiaries(updatedList, currentUserName));
      });
    } catch (e) {
      console.warn('Failed to fetch archive:', e);
      isCompleted = true;
      clearTimeout(safetyTimer);
      setDiaries((prev) => {
        if (prev.length === 0) {
          setLoadError('일기를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.');
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, currentUserName]);

  useEffect(() => {
    if (isOpen && roomCode) {
      soundEngine.playPaperRustle();
      const cached = getCachedRoomDiaries(roomCode);
      queueMicrotask(() => {
        setLoadError(null);
        if (initialTab) {
          setActiveTab(initialTab);
        }
        if (initialReportMonth) {
          setSelectedReportMonth(initialReportMonth);
        }
        // 모달이 열릴 때 캐시가 있으면 즉시 화면에 주입하여 깜빡임 제거
        if (cached && cached.length > 0) {
          setDiaries(maskUnopenedDiaries(cached, currentUserName));
        } else {
          setDiaries([]);
        }
        void fetchDiaries();
      });
    }
  }, [isOpen, roomCode, currentUserName, fetchDiaries, initialTab, initialReportMonth]);

  // [5번 요구사항] 월간 및 누적 온기 통계 & 키워드 분석
  const stats = useMemo<WarmthStats | null>(() => {
    const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
    // 상대방이 보낸 미개봉 비밀 편지는 스포일러 방지를 위해 온기 통계에서 제외
    const readableDiaries = diaries.filter(
      (d) => d.isWaxBroken || isDiaryWrittenByMe(d, currentUserName, myUid, partnerName)
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
  }, [diaries, currentUserName, partnerName]);

  // [이달의 온기 결산] 월별 상세 통계 및 온도 흐름, 폴라로이드 필름 롤 계산
  const monthlyDetails = useMemo<MonthlyDetailStats[]>(() => {
    const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
    const readableDiaries = diaries.filter(
      (d) => d.isWaxBroken || isDiaryWrittenByMe(d, currentUserName, myUid, partnerName)
    );
    if (readableDiaries.length === 0) return [];

    const grouped: Record<string, DiaryData[]> = {};
    readableDiaries.forEach((d) => {
      if (!d.createdAt) return;
      const date = new Date(d.createdAt);
      if (isNaN(date.getTime())) return;
      const mKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[mKey]) grouped[mKey] = [];
      grouped[mKey].push(d);
    });

    // 시간순 정렬 (과거 월 -> 최신 월) 후 전월 대비 온도 증감 계산
    const chronologicalKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const computedAsc: MonthlyDetailStats[] = [];

    chronologicalKeys.forEach((mKey, idx) => {
      const [yStr, mStr] = mKey.split('-');
      const monthNum = parseInt(mStr, 10);
      const monthLabel = `${yStr}년 ${monthNum}월`;
      const monthShortLabel = `${monthNum}월`;

      const monthDiaries = [...grouped[mKey]].sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      let totalTemp = 0;
      let validTempCount = 0;
      let maxTemp = -999;
      let hottestDiary: DiaryData | null = null;
      const keywordCounts: Record<string, number> = {};
      const stampCounts: Record<string, { count: number; symbol: string; name: string }> = {};
      const chartPoints: MonthlyDetailStats['chartPoints'] = [];
      const photos: MonthlyDetailStats['photos'] = [];

      monthDiaries.forEach((d) => {
        const warmth =
          d.warmthScore && typeof d.warmthScore.temperature === 'number'
            ? d.warmthScore
            : generateFallbackWarmth(d.title, d.content);

        const temp =
          warmth && typeof warmth.temperature === 'number' ? warmth.temperature : 36.5;

        totalTemp += temp;
        validTempCount++;
        if (temp > maxTemp) {
          maxTemp = temp;
          hottestDiary = d;
        }

        if (warmth?.keywords) {
          warmth.keywords.forEach((kw) => {
            const clean = kw.trim();
            if (clean) keywordCounts[clean] = (keywordCounts[clean] || 0) + 1;
          });
        }

        if (d.stamp?.symbol && d.stamp?.name) {
          const sKey = `${d.stamp.symbol}|${d.stamp.name}`;
          if (!stampCounts[sKey]) {
            stampCounts[sKey] = { count: 0, symbol: d.stamp.symbol, name: d.stamp.name };
          }
          stampCounts[sKey].count += 1;
        }

        const dt = d.createdAt ? new Date(d.createdAt) : new Date();
        const dateLabel = `${dt.getMonth() + 1}/${dt.getDate()}`;
        const fullDateLabel = `${dt.getMonth() + 1}월 ${dt.getDate()}일`;

        chartPoints.push({
          dateLabel,
          fullDateLabel,
          temp: Number(temp.toFixed(1)),
          diary: d,
        });

        if (d.photos && d.photos.length > 0) {
          d.photos.forEach((url, pIdx) => {
            if (!url) return;
            photos.push({
              url,
              caption: d.photoCaptions?.[pIdx] || d.title,
              dateLabel: fullDateLabel,
              authorName: d.authorName,
              diary: d,
            });
          });
        }
      });

      const avgTemp =
        validTempCount > 0 ? Number((totalTemp / validTempCount).toFixed(1)) : 36.5;

      const prevDetail = idx > 0 ? computedAsc[idx - 1] : null;
      const prevMonthDiff = prevDetail
        ? Number((avgTemp - prevDetail.avgTemp).toFixed(1))
        : null;
      const prevMonthShortLabel = prevDetail ? prevDetail.monthShortLabel : null;

      const topStampEntry = Object.values(stampCounts).sort((a, b) => b.count - a.count)[0];
      const topStamp = topStampEntry
        ? { symbol: topStampEntry.symbol, name: topStampEntry.name }
        : { symbol: '☀️', name: '따스한 온기' };

      const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      computedAsc.push({
        monthKey: mKey,
        monthLabel,
        monthShortLabel,
        diaries: monthDiaries,
        avgTemp,
        prevMonthDiff,
        prevMonthShortLabel,
        topStamp,
        hottestDiary,
        maxTemp: maxTemp > -999 ? Number(maxTemp.toFixed(1)) : avgTemp,
        topKeywords,
        chartPoints,
        photos,
      });
    });

    // 화면 노출용은 최신 월 우선 정렬
    return computedAsc.reverse();
  }, [diaries, currentUserName, partnerName]);

  const currentMonthDetail = useMemo<MonthlyDetailStats | null>(() => {
    if (selectedReportMonth === 'ALL') return null;
    return monthlyDetails.find((m) => m.monthKey === selectedReportMonth) || null;
  }, [monthlyDetails, selectedReportMonth]);

  const currentRecap = selectedReportMonth !== 'ALL' ? recapMap[selectedReportMonth] || null : null;

  // 월간 온기 결산 AI 내러티브 생성 / 갱신 함수
  const runMonthlyRecapGeneration = useCallback(
    async (detail: MonthlyDetailStats, forceRefresh = false) => {
      if (!roomCode || detail.diaries.length < 2) return;
      setIsGeneratingRecap(true);
      try {
        if (!forceRefresh) {
          const saved = await getSavedMonthlyRecap(roomCode, detail.monthKey);
          if (saved && saved.summary) {
            setRecapMap((prev) => ({ ...prev, [detail.monthKey]: saved }));
            setIsGeneratingRecap(false);
            return;
          }
        }

        const diaryInputs = detail.diaries.map((d) => {
          const dt = d.createdAt ? new Date(d.createdAt) : new Date();
          const dateLabel = `${dt.getMonth() + 1}월 ${dt.getDate()}일`;
          const warmth =
            d.warmthScore && typeof d.warmthScore.temperature === 'number'
              ? d.warmthScore
              : generateFallbackWarmth(d.title, d.content);
          return {
            author: d.authorName,
            title: d.title,
            content: d.content,
            date: dateLabel,
            temperature: warmth?.temperature,
          };
        });

        const generated = await generateMonthlyRecap(
          detail.monthKey,
          detail.monthLabel,
          currentUserName,
          partnerName,
          diaryInputs
        );

        setRecapMap((prev) => ({ ...prev, [detail.monthKey]: generated }));
        await saveMonthlyRecapToRoom(roomCode, detail.monthKey, generated);
      } catch (e) {
        console.warn('Failed to load/generate monthly recap:', e);
      } finally {
        setIsGeneratingRecap(false);
      }
    },
    [roomCode, currentUserName, partnerName]
  );

  // REPORT 탭에서 특정 월을 선택했을 때 E2EE 저장본 조회 후 없으면 1회 자동 생성
  useEffect(() => {
    if (!isOpen || activeTab !== 'REPORT' || !currentMonthDetail) return;
    if (recapMap[currentMonthDetail.monthKey]) return;
    if (currentMonthDetail.diaries.length < 2) return;

    queueMicrotask(() => {
      void runMonthlyRecapGeneration(currentMonthDetail, false);
    });
  }, [isOpen, activeTab, currentMonthDetail, recapMap, runMonthlyRecapGeneration]);

  // 월간 온기 결산 카드를 고화질 PNG 이미지로 저장 / 공유
  const handleSaveRecapImage = async () => {
    if (!currentMonthDetail || isSavingRecapImage) return;
    soundEngine.playMissionPassChime();
    setIsSavingRecapImage(true);

    try {
      const element = document.getElementById('warmth-monthly-recap-card');
      if (!element) return;

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#FAF7F2',
        ignoreElements: (el) => el.classList.contains('no-export'),
      });

      const fileName = `온기_${currentMonthDetail.monthKey}_결산카드_${roomCode}.png`;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
      );
      if (!blob) return;

      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [new File([blob], fileName, { type: 'image/png' })],
        })
      ) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          await navigator.share({
            title: `온기 (Warmth) · ${currentMonthDetail.monthLabel}의 온기 결산`,
            text: `${currentUserName} & ${partnerName} 두 사람의 ${currentMonthDetail.monthLabel} 온기 결산 카드입니다.`,
            files: [file],
          });
          return;
        } catch (shareErr: unknown) {
          if ((shareErr as Error)?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.warn('Failed to save monthly recap image:', e);
    } finally {
      setIsSavingRecapImage(false);
    }
  };

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

  // 일기 작성 일시(ISO)로부터 'YYYY-MM-DD' 로컬 날짜 키 반환
  const getDiaryLocalDateKey = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  // 날짜별 일기 목록 맵 (달력 표시용)
  const diariesByDateMap = useMemo(() => {
    const map: Record<string, DiaryData[]> = {};
    diaries.forEach((d) => {
      const key = getDiaryLocalDateKey(d.createdAt);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(d);
      }
    });
    return map;
  }, [diaries]);

  // 날짜 필터가 적용된 일기 목록
  const filteredDiaries = useMemo(() => {
    if (!selectedDateFilter) return diaries;
    return diaries.filter((d) => getDiaryLocalDateKey(d.createdAt) === selectedDateFilter);
  }, [diaries, selectedDateFilter]);

  // 총 페이지 수 (10개씩)
  const totalPages = Math.max(1, Math.ceil(filteredDiaries.length / PAGE_SIZE));

  // 현재 페이지에 노출할 10개 일기
  const paginatedDiaries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDiaries.slice(start, start + PAGE_SIZE);
  }, [filteredDiaries, currentPage]);

  // 페이지 보정
  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => {
        setCurrentPage(totalPages);
      });
    }
  }, [totalPages, currentPage]);

  // 블로그 스타일 페이지 번호 리스트 (예: 1 2 3...)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  // 달력 그리드 계산 (해당 월의 1일 요일 및 날짜 목록)
  const calendarGridDays = useMemo(() => {
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const days: { day: number; dateKey: string; hasDiary: boolean; diaryCount: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const diariesOnDay = diariesByDateMap[dateKey] || [];
      days.push({
        day,
        dateKey,
        hasDiary: diariesOnDay.length > 0,
        diaryCount: diariesOnDay.length,
      });
    }

    return { firstDayOfWeek, days };
  }, [calendarYear, calendarMonth, diariesByDateMap]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear((prev) => prev - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear((prev) => prev + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  const renderCardContent = () => (
    <>
      {/* 서재 상단 헤더 (인라인 뷰일 때는 창 윤곽선 없이 자연스러운 섹션 헤더로 렌더링) */}
      <div className={`flex items-center justify-between shrink-0 no-print ${
        isInlineView
          ? 'px-2 sm:px-3 py-3 mb-2 bg-transparent border-b border-stone-200/50'
          : 'px-5 sm:px-6 py-4 border-b border-[#E8DFD3] bg-[#F4EFEA]'
      }`}>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-xs shrink-0">
            <WarmthHanjaIcon className="w-5 h-5 text-amber-100" />
          </div>
          <div className="flex items-center min-w-0">
            <h2 className="text-base sm:text-xl font-serif-warm font-bold text-stone-900 whitespace-nowrap shrink-0">
              {t('archive.title')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchDiaries()}
            disabled={isLoading}
            title={language === 'en' ? 'Refresh' : '새로고침'}
            className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isInlineView ? (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 text-xs font-serif-warm font-medium transition-all active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title={language === 'en' ? 'Back to Desk' : '책상으로 돌아가기'}
            >
              <span>책상 복귀</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 상단 탭 전환 네비게이션 (인라인 뷰일 때는 세련된 세그먼트 컨트롤 형태) */}
      <div className={`flex overflow-x-auto shrink-0 gap-1.5 sm:gap-2 text-xs font-sans-ui no-print touch-pan-x ${
        isInlineView
          ? 'p-1.5 bg-stone-200/50 rounded-2xl mb-4 border border-stone-200/60'
          : 'border-b border-[#E8DFD3] bg-[#FAF6EE] px-3 sm:px-6'
      }`}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('LIST');
            soundEngine.playTileSlideSound();
          }}
          className={`py-2 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'LIST'
              ? isInlineView
                ? 'bg-white text-[#6B1724] shadow-xs font-bold'
                : 'border-b-2 border-[#6B1724] text-[#6B1724]'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{language === 'en' ? `Letters (${diaries.length})` : `일기 보관함 (${diaries.length})`}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('REPORT');
            soundEngine.playTileSlideSound();
          }}
          className={`py-2 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'REPORT'
              ? isInlineView
                ? 'bg-white text-[#6B1724] shadow-xs font-bold'
                : 'border-b-2 border-[#6B1724] text-[#6B1724]'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-800" />
          <span>{t('archive.tab.report')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('BOOKLET');
            soundEngine.playTileSlideSound();
          }}
          className={`py-2 px-3.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'BOOKLET'
              ? isInlineView
                ? 'bg-white text-[#6B1724] shadow-xs font-bold'
                : 'border-b-2 border-[#6B1724] text-[#6B1724]'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Printer className="w-3.5 h-3.5 text-stone-700" />
          <span>{t('archive.tab.booklet')}</span>
        </button>
      </div>

        {/* 탭 1: 일기 목록 영역 */}
        {activeTab === 'LIST' && (
          <div ref={listContainerRef} className={isInlineView ? 'flex-1 space-y-3 pb-4' : 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-3'}>
            {/* 날짜 필터 활성화 시 안내 배너 */}
            {selectedDateFilter && (
              <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-amber-100/90 border border-amber-300 text-stone-800 text-xs font-serif-warm shadow-2xs no-print whitespace-nowrap overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 shrink-0">
                  <Calendar className="w-4 h-4 text-[#6B1724]" />
                  <span>
                    <strong>{selectedDateFilter}</strong>에 작성된 편지 ({filteredDiaries.length}편)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter(null);
                    setCurrentPage(1);
                    soundEngine.playTileSlideSound();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-semibold cursor-pointer text-[11px] transition-colors shrink-0"
                >
                  전체 편지 보기 ✕
                </button>
              </div>
            )}

            {isLoading && diaries.length === 0 ? (
              <div className="py-16 text-center text-stone-500 font-serif-warm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B1724] mb-2" />
                <p className="text-sm">{t('archive.loading')}</p>
              </div>
            ) : loadError && diaries.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto mb-3 border border-rose-200 shadow-2xs">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                  {t('archive.loadFailed')}
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed mb-4">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => fetchDiaries()}
                  className="px-4 py-2 bg-[#6B1724] text-white rounded-xl text-xs font-serif-warm font-semibold shadow hover:bg-[#851E2E] transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('archive.retry')}</span>
                </button>
              </div>
            ) : diaries.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100/70 text-[#6B1724] flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <BookOpen className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                  {t('archive.empty')}
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  {t('archive.emptySub')}
                </p>
              </div>
            ) : selectedDateFilter && filteredDiaries.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100/70 text-[#6B1724] flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Calendar className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                  선택하신 날짜에 작성된 편지가 없습니다
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed mb-4">
                  달력에서 표시(●)가 있는 날짜를 선택하시거나 전체 목록을 확인해보세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter(null);
                    setCurrentPage(1);
                    soundEngine.playTileSlideSound();
                  }}
                  className="px-4 py-2 bg-[#6B1724] text-white rounded-xl text-xs font-serif-warm font-semibold shadow hover:bg-[#851E2E] transition-all cursor-pointer"
                >
                  모든 편지 보기
                </button>
              </div>
            ) : (
              paginatedDiaries.map((item) => {
                const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
                const isMine = isDiaryWrittenByMe(item, currentUserName, myUid, partnerName);
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
                      <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-0.5 min-w-0">
                        <span className="text-xs text-stone-500 font-mono flex items-center gap-1 whitespace-nowrap shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          {formattedDate}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border bg-rose-100/90 text-rose-950 border-rose-300 animate-pulse flex items-center gap-1 whitespace-nowrap shrink-0">
                          <Lock className="w-3 h-3 text-rose-800" />
                          <span>{t('archive.unopenedByMe')}</span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border bg-rose-50 text-rose-900 border-rose-200 whitespace-nowrap shrink-0">
                          {language === 'en' ? `${item.authorName}'s Letter` : `${item.authorName}의 온기`}
                        </span>
                      </div>

                      <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-snug flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#6B1724] text-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                          <Lock className="w-3.5 h-3.5 text-amber-200" />
                        </div>
                        <span>{t('archive.secretLetter', { name: item.authorName })}</span>
                      </h3>

                      <p className="text-xs text-stone-600 leading-relaxed font-serif-warm bg-white/80 p-3 rounded-xl border border-rose-100/80 flex items-center gap-2">
                        <span className="text-sm shrink-0">💌</span>
                        <span>{t('archive.secretMasked')}</span>
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
                    <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-0.5 min-w-0">
                      <span className="text-xs text-stone-500 font-mono flex items-center gap-1 whitespace-nowrap shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        {formattedDate}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border whitespace-nowrap shrink-0 ${
                          isMine
                            ? 'bg-amber-100/80 text-amber-900 border-amber-200'
                            : 'bg-rose-50 text-rose-900 border-rose-200'
                        }`}
                      >
                        {language === 'en' ? `${item.authorName}'s Journal` : `${item.authorName}의 기록`}
                      </span>

                      {isMyUnopenedLetter && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-serif-warm font-bold border bg-amber-50 text-amber-950 border-amber-200 whitespace-nowrap shrink-0">
                          {t('badge.unopened')}
                        </span>
                      )}

                      {/* [3번 요구사항] 저장된 날씨·기분 잉크 도장 표시 */}
                      {item.stamp && item.stamp.style !== 'EMOJI_TITLE' && (
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full border border-dashed font-serif-warm inline-flex items-center gap-1 whitespace-nowrap shrink-0"
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
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                          itemWarmth.temperature <= 0
                            ? 'bg-sky-50 text-sky-900 border border-sky-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200/60'
                        }`}>
                          <Sparkles className={`w-3 h-3 ${itemWarmth.temperature <= 0 ? 'text-sky-600' : 'text-amber-600'}`} />
                          {itemWarmth.temperature > 0 ? `+${itemWarmth.temperature.toFixed(1)}` : itemWarmth.temperature.toFixed(1)}°C
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-snug group-hover:text-[#6B1724] transition-colors flex items-center gap-1.5">
                      {item.stamp && item.stamp.style === 'EMOJI_TITLE' && (
                        <span className="text-xl -rotate-6 inline-block shrink-0" title={item.stamp.name}>
                          {item.stamp.symbol}
                        </span>
                      )}
                      <span>{item.title || (language === 'en' ? '(Untitled)' : '(제목 없음)')}</span>
                    </h3>

                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-serif-warm">
                      {item.content}
                    </p>

                    {itemWarmth?.keywords && itemWarmth.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {itemWarmth.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-serif-warm whitespace-nowrap"
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

            {/* 블로그 스타일 페이지네이션 (1, 2, 3...) */}
            {totalPages > 1 && (
              <div className="pt-4 pb-2 flex items-center justify-center gap-1 font-serif-warm text-xs select-none no-print">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => {
                    if (currentPage > 1) {
                      setCurrentPage((prev) => prev - 1);
                      soundEngine.playTileSlideSound();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{language === 'en' ? 'Prev' : '이전'}</span>
                </button>

                <div className="flex items-center gap-1 mx-1">
                  {pageNumbers.map((num, idx) => {
                    if (num === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-1 text-stone-400 font-bold">
                          …
                        </span>
                      );
                    }
                    const page = num as number;
                    const isActive = page === currentPage;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => {
                          setCurrentPage(page);
                          soundEngine.playTileSlideSound();
                        }}
                        className={`min-w-7 h-7 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                          isActive
                            ? 'bg-[#6B1724] text-amber-50 shadow-xs scale-105'
                            : 'border border-stone-200 bg-white hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage((prev) => prev + 1);
                      soundEngine.playTileSlideSound();
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-0.5"
                >
                  <span>{language === 'en' ? 'Next' : '다음'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 탭 2: [5번 요구사항 & 이달의 온기 결산] 월간 온기 리포트 & 키워드 분석 영역 */}
        {activeTab === 'REPORT' && (
          <div ref={reportContainerRef} className={isInlineView ? 'flex-1 space-y-4 pb-4' : 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-4'}>
            {!stats || stats.totalDiaries === 0 ? (
              <div className="py-16 text-center text-stone-500 font-serif-warm">
                <BarChart3 className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                <p className="text-sm font-semibold">아직 분석할 편지 데이터가 없습니다</p>
                <p className="text-xs text-stone-400 mt-1">편지를 주고받으면 둘만의 감성 온도와 키워드가 분석됩니다.</p>
              </div>
            ) : (
              <>
                {/* 상단 월별 선택 탭 바 (전체 누적 + 각 월별 온기 결산 탭) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-print touch-pan-x">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportMonth('ALL');
                      soundEngine.playTileSlideSound();
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-serif-warm font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      selectedReportMonth === 'ALL'
                        ? 'bg-[#6B1724] text-amber-50 border-[#6B1724] shadow-xs'
                        : 'bg-white text-stone-700 border-[#E8DFD3] hover:bg-amber-50/60'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>전체 누적 리포트</span>
                  </button>

                  {monthlyDetails.map((m) => {
                    const isSelected = selectedReportMonth === m.monthKey;
                    return (
                      <button
                        key={m.monthKey}
                        type="button"
                        onClick={() => {
                          setSelectedReportMonth(m.monthKey);
                          soundEngine.playTileSlideSound();
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-serif-warm font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#6B1724] text-amber-50 border-[#6B1724] shadow-xs'
                            : 'bg-[#FFFBF4] text-amber-950 border-amber-300/80 hover:bg-amber-100/60'
                        }`}
                      >
                        <Sparkles className={`w-3 h-3 ${isSelected ? 'text-amber-200' : 'text-amber-700'}`} />
                        <span>{m.monthLabel} 결산</span>
                      </button>
                    );
                  })}
                </div>

                {/* A. 전체 누적 리포트 뷰 */}
                {selectedReportMonth === 'ALL' || !currentMonthDetail ? (
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
                      <div
                        onClick={() => {
                          if (!stats.hottestDiary) return;
                          soundEngine.playPaperRustle();
                          onSelectDiary(stats.hottestDiary);
                        }}
                        className="p-4 rounded-2xl bg-white border border-[#E8DFD3] hover:border-[#6B1724]/40 transition-all cursor-pointer shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-[#6B1724]">
                            <Flame className="w-4 h-4 text-[#6B1724]" />
                            <span>우리 둘의 가장 뜨거웠던 순간</span>
                          </div>
                          <span className="text-[11px] font-serif-warm text-stone-400 flex items-center gap-0.5">
                            <span>편지 펼치기</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
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

                    {/* 월별 온기 결산 바로가기 그리드 */}
                    {monthlyDetails.length > 0 && (
                      <div className="p-4 rounded-2xl bg-white border border-[#E8DFD3] shadow-xs">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-sans-ui font-bold text-stone-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                            <span>월별 온기 결산 아카이브</span>
                          </span>
                          <span className="text-[11px] font-serif-warm text-stone-400">
                            월을 누르면 상세 결산이 열립니다
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {monthlyDetails.map((m) => (
                            <button
                              key={m.monthKey}
                              type="button"
                              onClick={() => {
                                setSelectedReportMonth(m.monthKey);
                                soundEngine.playPaperRustle();
                              }}
                              className="p-3 rounded-xl bg-gradient-to-br from-[#FFFDF9] to-[#F7EFE4] hover:from-amber-50 hover:to-amber-100/70 border border-[#E8DFC8] hover:border-[#6B1724]/40 text-left transition-all cursor-pointer group shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-stone-700 font-serif-warm font-bold">
                                  {m.monthLabel}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#6B1724] group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-sm font-bold text-[#6B1724] font-mono">
                                  +{m.avgTemp.toFixed(1)}°C
                                </span>
                                <span className="text-[11px] text-stone-500 font-serif-warm">
                                  {m.topStamp?.symbol} {m.topStamp?.name}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* B. 선택한 달의 [이달의 온기 결산 (Monthly Warmth Recap)] 상세 뷰 */
                  <div className="space-y-4">
                    {/* 캡처 및 공유 대상 결산 카드 영역 */}
                    <div
                      id="warmth-monthly-recap-card"
                      className="p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] border border-[#E5DAC8] shadow-md paper-texture space-y-4"
                    >
                      {/* 결산 카드 상단 타이틀 헤더 */}
                      <div className="text-center border-b border-[#E5DAC8]/80 pb-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-300/80 text-[10px] font-sans-ui font-bold text-amber-950 tracking-widest uppercase">
                          <Sparkles className="w-3 h-3 text-amber-700" />
                          <span>Monthly Warmth Recap</span>
                        </span>
                        <h3 className="font-serif-warm font-bold text-stone-900 text-lg sm:text-xl mt-1.5">
                          {currentMonthDetail.monthLabel}의 온기 결산
                        </h3>
                        <p className="text-xs text-stone-500 font-serif-warm mt-0.5">
                          {currentUserName} ♥ {partnerName} · 우리 둘이 나눈 한 달의 기억
                        </p>
                      </div>

                      {/* ① 한눈에 보는 이달의 숫자 (편지 수 분할 제외, 평균 온기 지수 & 대표 우표 2열 구성) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* 이달의 평균 온기 지수 & 전월 대비 비교 */}
                        <div className="p-4 rounded-2xl bg-white/90 border border-[#E8DFC8] shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                            <span className="text-xs font-sans-ui font-bold text-amber-900 shrink-0">
                              🌡️ 이달의 평균 온기 지수
                            </span>
                            <TrendingUp className="w-3.5 h-3.5 text-[#6B1724] shrink-0" />
                          </div>
                          <div className="my-1.5 flex items-baseline gap-2">
                            <span className="font-mono text-3xl sm:text-4xl font-bold text-[#6B1724] whitespace-nowrap">
                              +{currentMonthDetail.avgTemp.toFixed(1)}°C
                            </span>
                          </div>
                          <p className="text-[11px] font-serif-warm text-stone-600 whitespace-nowrap overflow-x-auto no-scrollbar">
                            {currentMonthDetail.prevMonthDiff !== null && currentMonthDetail.prevMonthShortLabel ? (
                              currentMonthDetail.prevMonthDiff > 0 ? (
                                <span>
                                  지난 {currentMonthDetail.prevMonthShortLabel}보다{' '}
                                  <strong className="text-[#6B1724] font-mono">
                                    +{currentMonthDetail.prevMonthDiff.toFixed(1)}°C
                                  </strong>{' '}
                                  더 따뜻해졌어요 🔥
                                </span>
                              ) : currentMonthDetail.prevMonthDiff < 0 ? (
                                <span>
                                  지난 {currentMonthDetail.prevMonthShortLabel}과 비슷한 포근한 온기 (
                                  <span className="font-mono">{currentMonthDetail.prevMonthDiff.toFixed(1)}°C</span>)
                                </span>
                              ) : (
                                <span>
                                  지난 {currentMonthDetail.prevMonthShortLabel}과 똑같은 온도로 다정함을 이어갔어요
                                </span>
                              )
                            ) : (
                              <span>우리가 함께 기록한 소중한 달의 평균 온도예요</span>
                            )}
                          </p>
                        </div>

                        {/* 이달의 대표 우표 */}
                        <div className="p-4 rounded-2xl bg-white/90 border border-[#E8DFC8] shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                            <span className="text-xs font-sans-ui font-bold text-amber-900 shrink-0">
                              📮 이달의 대표 우표
                            </span>
                            <span className="text-[11px] font-serif-warm text-stone-400 shrink-0">
                              가장 많이 붙인 감정
                            </span>
                          </div>
                          <div className="my-1.5 flex items-center gap-2.5">
                            <span className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-2xl shadow-2xs shrink-0">
                              {currentMonthDetail.topStamp?.symbol || '☀️'}
                            </span>
                            <div className="min-w-0">
                              <div className="font-serif-warm font-bold text-stone-900 text-base whitespace-nowrap">
                                {currentMonthDetail.topStamp?.name || '따스한 온기'}
                              </div>
                              <div className="text-[11px] text-stone-500 font-serif-warm whitespace-nowrap overflow-x-auto no-scrollbar">
                                {currentMonthDetail.monthShortLabel}의 편지를 가장 많이 장식한 우표
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ② 이달의 온도 흐름 차트 (Interactive SVG Line Chart) */}
                      {currentMonthDetail.chartPoints.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white/95 border border-[#E8DFC8] shadow-2xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-sans-ui font-bold text-stone-800 flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-[#6B1724]" />
                              <span>📈 {currentMonthDetail.monthShortLabel}의 온도 흐름</span>
                            </span>
                            <span className="text-[10px] font-serif-warm text-stone-400 no-export">
                              점을 누르면 그날의 편지가 펼쳐집니다
                            </span>
                          </div>

                          {(() => {
                            const pts = currentMonthDetail.chartPoints;
                            const temps = pts.map((p) => p.temp);
                            const minT = Math.min(...temps, 36.0) - 0.5;
                            const maxT = Math.max(...temps, 38.0) + 0.5;
                            const rangeT = Math.max(1, maxT - minT);
                            const svgWidth = Math.max(280, pts.length * 56);
                            const svgHeight = 128;
                            const padX = 28;
                            const padTop = 26;
                            const padBottom = 26;
                            const plotW = svgWidth - padX * 2;
                            const plotH = svgHeight - padTop - padBottom;

                            const coords = pts.map((p, i) => {
                              const x =
                                pts.length === 1
                                  ? svgWidth / 2
                                  : padX + (i / (pts.length - 1)) * plotW;
                              const y = padTop + (1 - (p.temp - minT) / rangeT) * plotH;
                              return { x, y, ...p };
                            });

                            const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
                            const areaPoints =
                              coords.length > 1
                                ? `${coords[0].x},${svgHeight - padBottom} ${polylinePoints} ${
                                    coords[coords.length - 1].x
                                  },${svgHeight - padBottom}`
                                : '';

                            return (
                              <div className="w-full overflow-x-auto pb-1 touch-pan-x">
                                <svg
                                  width={svgWidth}
                                  height={svgHeight}
                                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                  className="min-w-full overflow-visible"
                                >
                                  <defs>
                                    <linearGradient id="warmthAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#6B1724" stopOpacity="0.22" />
                                      <stop offset="100%" stopColor="#6B1724" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>

                                  {/* 가이드 수평선 */}
                                  <line
                                    x1={padX}
                                    y1={padTop + plotH / 2}
                                    x2={svgWidth - padX}
                                    y2={padTop + plotH / 2}
                                    stroke="#E8DFD3"
                                    strokeDasharray="3 3"
                                    strokeWidth="1"
                                  />

                                  {/* 영역 그라데이션 */}
                                  {areaPoints && (
                                    <polygon points={areaPoints} fill="url(#warmthAreaGrad)" />
                                  )}

                                  {/* 온도 연결 선 */}
                                  {coords.length > 1 && (
                                    <polyline
                                      fill="none"
                                      stroke="#6B1724"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      points={polylinePoints}
                                    />
                                  )}

                                  {/* 각 일기 온도 포인트 노드 */}
                                  {coords.map((c, idx) => (
                                    <g
                                      key={`${c.diary.diaryId}-${idx}`}
                                      onClick={() => {
                                        soundEngine.playPaperRustle();
                                        onSelectDiary(c.diary);
                                      }}
                                      className="cursor-pointer group"
                                    >
                                      <circle
                                        cx={c.x}
                                        cy={c.y}
                                        r={5}
                                        fill="#FFFDF9"
                                        stroke="#6B1724"
                                        strokeWidth="2.5"
                                      />
                                      <text
                                        x={c.x}
                                        y={c.y - 9}
                                        textAnchor="middle"
                                        className="fill-[#6B1724] font-mono text-[10px] font-bold select-none"
                                      >
                                        +{c.temp.toFixed(1)}°
                                      </text>
                                      <text
                                        x={c.x}
                                        y={svgHeight - 8}
                                        textAnchor="middle"
                                        className="fill-stone-500 font-sans-ui text-[10px] select-none"
                                      >
                                        {c.dateLabel}
                                      </text>
                                    </g>
                                  ))}
                                </svg>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ③ Gemini AI 온기 우체국 총평 & 이달의 베스트 문장 & 다음 달 제안 */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FFFDF9] to-[#F8EFE2] border border-amber-300/80 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-1 sm:gap-1.5 text-[11.5px] sm:text-xs font-sans-ui font-bold text-[#6B1724] shrink-0">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 shrink-0" />
                            <span className="whitespace-nowrap">💌 온기 우체국이 전하는 {currentMonthDetail.monthShortLabel}의 이야기</span>
                          </div>

                          {currentMonthDetail.diaries.length >= 2 && (
                            <button
                              type="button"
                              disabled={isGeneratingRecap}
                              onClick={() => {
                                soundEngine.playTileSlideSound();
                                void runMonthlyRecapGeneration(currentMonthDetail, true);
                              }}
                              className="no-export shrink-0 whitespace-nowrap ml-auto px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/90 hover:bg-amber-50 border border-amber-300/80 text-[10.5px] sm:text-[11px] font-serif-warm font-semibold text-amber-950 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 shrink-0 ${isGeneratingRecap ? 'animate-spin' : ''}`} />
                              <span className="whitespace-nowrap">
                                {currentRecap && currentRecap.analyzedCount < currentMonthDetail.diaries.length
                                  ? '새 편지 반영하기'
                                  : '다시 쓰기'}
                              </span>
                            </button>
                          )}
                        </div>

                        {currentMonthDetail.diaries.length < 2 ? (
                          <div className="p-4 rounded-xl bg-white/80 border border-amber-200/70 text-center space-y-1">
                            <p className="text-xs font-serif-warm font-semibold text-stone-700">
                              아직 {currentMonthDetail.monthShortLabel}에 주고받은 편지가 1통뿐이에요 ✉️
                            </p>
                            <p className="text-[11px] font-serif-warm text-stone-500 leading-relaxed">
                              두 분의 이야기가 2통 이상 쌓이면 온기 우체국 AI가 그달의 다정한 회고록과 베스트 문장을 적어드립니다.
                            </p>
                          </div>
                        ) : isGeneratingRecap && !currentRecap ? (
                          <div className="py-8 px-4 rounded-xl bg-white/80 border border-amber-200/70 text-center space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[#6B1724] mx-auto" />
                            <p className="text-xs font-serif-warm font-semibold text-stone-700">
                              온기 우체국이 두 분의 {currentMonthDetail.monthShortLabel} 편지를 읽으며 결산 편지를 적고 있어요...
                            </p>
                            <p className="text-[11px] font-serif-warm text-stone-400">
                              잠시만 기다려 주시면 둘만의 다정한 한 달 회고가 완성됩니다
                            </p>
                          </div>
                        ) : currentRecap ? (
                          <>
                            {/* AI 감성 요약문 */}
                            <div className="p-3.5 sm:p-4 rounded-xl bg-white/90 border border-[#E8DFC8] font-serif-warm text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-line">
                              {currentRecap.summary}
                            </div>

                            {/* 이달의 가장 다정했던 한 줄 (Best Quote) */}
                            {currentRecap.bestQuote && (
                              <div className="p-4 rounded-xl bg-[#FAF4ED] border border-amber-300/70 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-sans-ui font-bold text-amber-900">
                                  <MessageSquareQuote className="w-3.5 h-3.5 text-[#6B1724]" />
                                  <span>이달의 가장 다정했던 한 줄</span>
                                </div>
                                <p className="font-serif-warm font-bold text-stone-900 text-xs sm:text-sm italic leading-relaxed">
                                  &ldquo;{currentRecap.bestQuote}&rdquo;
                                </p>
                                <p className="text-[11px] font-serif-warm text-stone-500 text-right">
                                  — {currentRecap.bestQuoteDate ? `${currentRecap.bestQuoteDate}, ` : ''}
                                  {currentRecap.bestQuoteAuthor} 님의 편지 중에서
                                </p>
                              </div>
                            )}

                            {/* 다음 달을 위한 작은 제안 */}
                            {currentRecap.nextSuggestion && (
                              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2">
                                <span className="text-sm shrink-0">🌱</span>
                                <div className="text-xs font-serif-warm text-amber-950 leading-relaxed">
                                  <strong className="font-bold">다음 달을 위한 작은 제안: </strong>
                                  <span>{currentRecap.nextSuggestion}</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>

                      {/* ④ 이달의 가장 뜨거웠던 순간 */}
                      {currentMonthDetail.hottestDiary && (
                        <div
                          onClick={() => {
                            if (!currentMonthDetail.hottestDiary) return;
                            soundEngine.playPaperRustle();
                            onSelectDiary(currentMonthDetail.hottestDiary);
                          }}
                          className="p-4 rounded-2xl bg-white/95 border border-[#E8DFC8] hover:border-[#6B1724]/40 transition-all cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-[#6B1724]">
                              <Flame className="w-4 h-4 text-[#6B1724]" />
                              <span>🔥 {currentMonthDetail.monthShortLabel}의 가장 뜨거웠던 순간</span>
                            </div>
                            <span className="font-mono font-bold text-sm text-[#6B1724]">
                              +{currentMonthDetail.maxTemp.toFixed(1)}°C
                            </span>
                          </div>
                          <h4 className="font-serif-warm font-bold text-stone-900 text-sm sm:text-base">
                            「{currentMonthDetail.hottestDiary.title}」
                          </h4>
                          <p className="text-xs text-stone-500 font-serif-warm mt-0.5">
                            {formatDate(currentMonthDetail.hottestDiary.createdAt)} · 작성자{' '}
                            {currentMonthDetail.hottestDiary.authorName}
                          </p>
                        </div>
                      )}

                      {/* ⑤ 이달의 다정한 키워드 */}
                      {currentMonthDetail.topKeywords.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white/95 border border-[#E8DFC8] shadow-2xs">
                          <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-stone-800 mb-2.5">
                            <Heart className="w-3.5 h-3.5 text-rose-600" />
                            <span>{currentMonthDetail.monthShortLabel}에 우리가 자주 나눈 마음들</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {currentMonthDetail.topKeywords.map(([kw, count], idx) => (
                              <span
                                key={kw}
                                className={`px-2.5 py-1 rounded-xl font-serif-warm text-xs ${
                                  idx < 3
                                    ? 'bg-[#6B1724] text-amber-50 font-bold'
                                    : 'bg-[#FAF4ED] text-stone-800 border border-[#E8DFD3]'
                                }`}
                              >
                                {kw}
                                <span
                                  className={`text-[10px] ml-1 ${
                                    idx < 3 ? 'text-amber-200' : 'text-stone-400'
                                  }`}
                                >
                                  {count}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ⑥ 이달의 폴라로이드 필름 롤 */}
                      {currentMonthDetail.photos.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white/95 border border-[#E8DFC8] shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-sans-ui font-bold text-stone-800">
                              <Camera className="w-3.5 h-3.5 text-[#6B1724]" />
                              <span>
                                🖼️ {currentMonthDetail.monthShortLabel}의 폴라로이드 필름 롤 (
                                {currentMonthDetail.photos.length}장)
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 touch-pan-x">
                            {currentMonthDetail.photos.map((photo, idx) => (
                              <div
                                key={`${photo.diary.diaryId}-photo-${idx}`}
                                onClick={() => {
                                  soundEngine.playPaperRustle();
                                  onSelectDiary(photo.diary);
                                }}
                                className="w-36 sm:w-40 shrink-0 p-2 pb-2.5 rounded-xl bg-[#FFFDF9] border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                              >
                                <div className="w-full h-28 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/60">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photo.url}
                                    alt={photo.caption || '추억 사진'}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <p className="text-[11px] font-serif-warm font-bold text-stone-800 truncate mt-2">
                                  {photo.caption || '소중한 순간'}
                                </p>
                                <p className="text-[10px] font-serif-warm text-stone-400 mt-0.5">
                                  {photo.dateLabel} · {photo.authorName}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 결산 카드 이미지 저장 버튼 */}
                    <div className="flex justify-end no-print">
                      <button
                        type="button"
                        disabled={isSavingRecapImage}
                        onClick={handleSaveRecapImage}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-sm cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {isSavingRecapImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>결산 카드 이미지 만드는 중...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>📸 {currentMonthDetail.monthShortLabel} 결산 카드 이미지로 저장</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 탭 3: [2번 요구사항] 소책자 PDF / 인쇄 미리보기 영역 */}
        {activeTab === 'BOOKLET' && (
          <div ref={bookletContainerRef} className={isInlineView ? 'flex-1 space-y-4 pb-4' : 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-4'}>
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
                    const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
                    const isUnopenedByMe = !isDiaryWrittenByMe(d, currentUserName, myUid, partnerName) && !d.isWaxBroken;
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
                const myUid = typeof window !== 'undefined' ? getOrCreateUserId() : '';
                const isUnopenedByMe = !isDiaryWrittenByMe(diary, currentUserName, myUid, partnerName) && !diary.isWaxBroken;

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
                        {diary.photos.map((p, pIdx) => {
                          const caption = (diary.photoCaptions && diary.photoCaptions[pIdx]) ||
                            (pIdx === 0 && diary.photoCaption ? diary.photoCaption : null) ||
                            `그날의 한 컷 #${pIdx + 1}`;
                          return (
                            <div key={pIdx} className="w-48 bg-stone-100 border border-stone-300 rounded overflow-hidden shadow-2xs">
                              <div className="w-full aspect-[4/3]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p} alt="편지 사진" className="w-full h-full object-cover" />
                              </div>
                              <p 
                                className="px-2 py-1 text-[11px] !text-black font-medium font-serif-warm text-center break-words [overflow-wrap:anywhere] leading-snug"
                                style={{ color: '#1C1917' }}
                              >
                                {caption}
                              </p>
                            </div>
                          );
                        })}
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

        {/* 하단 닫기 바 & 달력 인터페이스 (인라인 뷰일 때는 창 윤곽선 없이 자연스러운 하단 바로 렌더링) */}
        <div className={`flex items-center justify-between gap-2 shrink-0 no-print relative ${
          isInlineView
            ? 'px-2 sm:px-3 py-4 mt-6 border-t border-stone-200/60 bg-transparent'
            : 'px-4 sm:px-5 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] border-t border-[#E8DFD3] bg-[#FAF7F2]'
        }`}>
          {/* 맨 왼쪽: 달력 인터페이스 */}
          <div className="relative">
            {isCalendarOpen && (
              <div 
                className="fixed inset-0 z-20" 
                onClick={() => setIsCalendarOpen(false)} 
              />
            )}

            {isCalendarOpen && (
              <div className="absolute bottom-full left-0 mb-3 w-[290px] sm:w-[320px] bg-[#FFFDF9] rounded-2xl p-3.5 border border-[#E8DFC8] shadow-2xl z-30 font-sans-ui paper-texture">
                {/* 달력 헤더: 년/월 및 이전/다음 버튼 */}
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#EFE7DC]">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
                    title="이전 달"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="font-serif-warm font-bold text-stone-900 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#6B1724]" />
                    <span>{calendarYear}년 {calendarMonth + 1}월</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
                    title="다음 달"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-stone-400 mb-1">
                  <span className="text-rose-500">일</span>
                  <span>월</span>
                  <span>화</span>
                  <span>수</span>
                  <span>목</span>
                  <span>금</span>
                  <span className="text-sky-600">토</span>
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {Array.from({ length: calendarGridDays.firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8" />
                  ))}

                  {calendarGridDays.days.map(({ day, dateKey, hasDiary, diaryCount }) => {
                    const isSelected = selectedDateFilter === dateKey;
                    const isToday = dateKey === getDiaryLocalDateKey(new Date().toISOString());

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDateFilter(dateKey);
                          setActiveTab('LIST');
                          setCurrentPage(1);
                          setIsCalendarOpen(false);
                          soundEngine.playPaperRustle();
                        }}
                        className={`h-8 rounded-lg text-xs font-serif-warm relative flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#6B1724] text-amber-50 font-bold shadow-xs'
                            : hasDiary
                            ? 'bg-amber-100/90 hover:bg-amber-200/90 text-amber-950 font-bold border border-amber-300/80 shadow-2xs'
                            : isToday
                            ? 'bg-stone-100 text-stone-800 font-semibold'
                            : 'text-stone-400 hover:bg-stone-100'
                        }`}
                        title={hasDiary ? `${dateKey} (${diaryCount}편의 편지)` : dateKey}
                      >
                        <span className="leading-none">{day}</span>
                        {hasDiary && (
                          <span
                            className={`w-1 h-1 rounded-full mt-0.5 ${
                              isSelected ? 'bg-amber-200' : 'bg-[#6B1724]'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 하단 범례 및 이번 달/필터 해제 바로가기 */}
                <div className="mt-3 pt-2 border-t border-[#EFE7DC] flex items-center justify-between text-[11px] text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6B1724]" />
                    <span>편지 작성된 날</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedDateFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateFilter(null);
                          setCurrentPage(1);
                          setIsCalendarOpen(false);
                          soundEngine.playTileSlideSound();
                        }}
                        className="text-[#6B1724] font-bold hover:underline cursor-pointer"
                      >
                        전체 보기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCalendarYear(now.getFullYear());
                        setCalendarMonth(now.getMonth());
                      }}
                      className="text-stone-600 hover:text-stone-900 cursor-pointer"
                    >
                      이번 달
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 달력 열기 버튼 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsCalendarOpen(!isCalendarOpen);
                  soundEngine.playTileSlideSound();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-serif-warm font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs ${
                  selectedDateFilter
                    ? 'bg-[#6B1724] text-amber-50 border-[#6B1724]'
                    : 'bg-amber-50/90 hover:bg-amber-100/80 text-stone-700 border-amber-200/90'
                }`}
                title={language === 'en' ? 'Select Date' : '날짜별 달력'}
              >
                <Calendar className={`w-3.5 h-3.5 ${selectedDateFilter ? 'text-amber-200' : 'text-[#6B1724]'}`} />
                <span>{selectedDateFilter ? `${selectedDateFilter}` : (language === 'en' ? 'Calendar' : '날짜별 달력')}</span>
              </button>

              {selectedDateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter(null);
                    setCurrentPage(1);
                    soundEngine.playTileSlideSound();
                  }}
                  className="p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  title="날짜 필터 해제"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 맨 오른쪽: 닫기 버튼 */}
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 active:scale-95 text-stone-800 text-xs font-serif-warm font-bold transition-all cursor-pointer shrink-0"
          >
            {isInlineView
              ? (language === 'en' ? 'Back to Desk' : '책상으로 돌아가기')
              : (language === 'en' ? 'Close' : '닫기')}
          </button>
        </div>
      </>
    );

    return (
      <AnimatePresence>
        {isOpen && (
          isInlineView ? (
            <motion.div
              key="inline-archive-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-2xl flex flex-col my-1 sm:my-2"
            >
              {renderCardContent()}
            </motion.div>
          ) : (
            <motion.div
              key="modal-archive-popup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
              onClick={onClose}
            >
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-2xl my-auto flex flex-col bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#E8DFD3] overflow-hidden max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.75rem)] sm:max-h-[88vh]"
                onClick={(e) => e.stopPropagation()}
              >
                {renderCardContent()}
              </motion.div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    );
  }
