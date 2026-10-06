'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaxColor, WAX_COLORS, MissionData, DiaryData, WarmthScore, WEATHER_STAMPS, WeatherStamp, StampStyle } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { compressImage, uploadPhotoIfPossible, CompressedImageResult } from '@/lib/imageUtils';
import { fetchAiQuiz, fetchWarmthScore, fetchDailyPrompt, getCachedDailyPrompt } from '@/lib/aiClient';
import { generateFallbackWarmth } from '@/lib/gemini';
import { getLatestReadDiaryForPartner } from '@/lib/roomService';
import { 
  X, 
  Send, 
  Image as ImageIcon, 
  Sparkles, 
  Feather, 
  HelpCircle, 
  Upload, 
  Camera, 
  Loader2, 
  Trash2,
  Dices,
  BookOpen,
  Save,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface WriteDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDiary: (newDiary: Partial<DiaryData>) => Promise<boolean> | void;
  currentUserName: string;
  partnerName: string;
  roomCode?: string;
  fallbackPreviousDiary?: DiaryData | null;
  initialTitle?: string;
}

export default function WriteDiaryModal({
  isOpen,
  onClose,
  onSaveDiary,
  currentUserName,
  partnerName,
  roomCode = '829104',
  fallbackPreviousDiary,
  initialTitle,
}: WriteDiaryModalProps) {
  const { language, t } = useLanguage();
  const getTodayDateString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [diaryDate, setDiaryDate] = useState<string>(getTodayDateString);
  const safeInitialTitle = typeof initialTitle === 'string' ? initialTitle : '';
  const [title, setTitle] = useState(safeInitialTitle);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<WaxColor>('#6B1724');
  const [customColor, setCustomColor] = useState<string>('#9E2A3C');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const isCustomColor = !WAX_COLORS.some((w) => w.hex.toLowerCase() === selectedColor.toLowerCase());
  const [missionType, setMissionType] = useState<'PUZZLE_PHOTO' | 'PUZZLE_STAMP' | 'SYSTEM' | 'CUSTOM'>('PUZZLE_PHOTO');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customQuizAnswer, setCustomQuizAnswer] = useState('');
  const [customQuizHint, setCustomQuizHint] = useState('');
  const [quizSourceInfo, setQuizSourceInfo] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadedPhotoInfo, setUploadedPhotoInfo] = useState<CompressedImageResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [selectedStamp, setSelectedStamp] = useState<WeatherStamp>(WEATHER_STAMPS[0]);
  const [stampStyle, setStampStyle] = useState<StampStyle>('BADGE');
  const [hasDraftNotice, setHasDraftNotice] = useState(false);
  const [lastSavedDraftTime, setLastSavedDraftTime] = useState<string | null>(null);
  const draftKey = `warmth_diary_draft_${roomCode}`;
  const [dailyPrompt, setDailyPrompt] = useState<string>(() => {
    const clean = partnerName && partnerName.trim() && partnerName !== '상대방' && partnerName !== '파트너'
      ? `${partnerName.trim()}에게`
      : '너에게';
    return `오늘 하루 중 ${clean} 가장 먼저 말해주고 싶었던 사소한 순간은?`;
  });
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 모달이 열릴 때 캐시된 글감 우선 적용 (API 추가 소모 없이 즉각 반영)
  useEffect(() => {
    if (isOpen) {
      if (typeof initialTitle === 'string' && initialTitle) {
        setTitle(initialTitle);
      }
      const cached = getCachedDailyPrompt();
      if (cached) {
        setDailyPrompt(cached);
      } else {
        const clean = partnerName && partnerName.trim() && partnerName !== '상대방' && partnerName !== '파트너'
          ? `${partnerName.trim()}에게`
          : '너에게';
        setDailyPrompt(`오늘 하루 중 ${clean} 가장 먼저 말해주고 싶었던 사소한 순간은?`);

        fetchDailyPrompt(partnerName, false).then((prompt) => {
          if (prompt) setDailyPrompt(prompt);
        });
      }
    }
  }, [isOpen, partnerName, initialTitle]);

  // 모달이 열릴 때 작성 중이던 임시 저장본 및 비상 아웃박스 잔여 데이터 확인
  useEffect(() => {
    if (isOpen) {
      try {
        let raw = localStorage.getItem(draftKey);
        if (!raw && roomCode) {
          raw = localStorage.getItem(`warmth_last_outbox_${roomCode}`);
        }
        if (!raw) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            if (k.startsWith('warmth_') && (k.includes('draft') || k.includes('outbox'))) {
              const candidate = localStorage.getItem(k);
              if (candidate && (candidate.includes('content') || candidate.includes('title'))) {
                raw = candidate;
                break;
              }
            }
          }
        }

        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.title || parsed.content)) {
            setHasDraftNotice(true);
            setLastSavedDraftTime(parsed.savedAt || '이전 저장본');
          }
        }
      } catch {}
    } else {
      setHasDraftNotice(false);
    }
  }, [isOpen, draftKey, roomCode]);

  // [1번 요구사항] 편지 작성 중 실시간 자동 임시 저장 (디바운스 600ms)
  useEffect(() => {
    if (!isOpen) return;
    if (!title.trim() && !content.trim()) return;

    const timer = setTimeout(() => {
      try {
        const draftData = {
          title,
          content,
          diaryDate,
          selectedColor,
          customColor,
          selectedPhoto,
          missionType,
          customPrompt,
          customQuizAnswer,
          customQuizHint,
          selectedStampId: selectedStamp.id,
          stampStyle,
          savedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        };
        localStorage.setItem(draftKey, JSON.stringify(draftData));
        setLastSavedDraftTime(draftData.savedAt);
      } catch {}
    }, 600);

    return () => clearTimeout(timer);
  }, [isOpen, title, content, diaryDate, selectedColor, customColor, selectedPhoto, missionType, customPrompt, customQuizAnswer, customQuizHint, selectedStamp, stampStyle, draftKey]);

  // 임시 저장본 불러와 이어쓰기 (초안 및 아웃박스 복원)
  const handleRestoreDraft = () => {
    try {
      let raw = localStorage.getItem(draftKey);
      if (!raw && roomCode) {
        raw = localStorage.getItem(`warmth_last_outbox_${roomCode}`);
      }
      if (!raw) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) || '';
          if (k.startsWith('warmth_') && (k.includes('draft') || k.includes('outbox'))) {
            const candidate = localStorage.getItem(k);
            if (candidate && (candidate.includes('content') || candidate.includes('title'))) {
              raw = candidate;
              break;
            }
          }
        }
      }

      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.title === 'string') setTitle(parsed.title);
      if (typeof parsed.content === 'string') setContent(parsed.content);
      if (parsed.diaryDate) setDiaryDate(parsed.diaryDate);
      if (parsed.selectedColor) setSelectedColor(parsed.selectedColor);
      if (parsed.customColor) setCustomColor(parsed.customColor);
      if (parsed.selectedPhoto) setSelectedPhoto(parsed.selectedPhoto);
      if (parsed.missionType) setMissionType(parsed.missionType);
      if (parsed.customPrompt) setCustomPrompt(parsed.customPrompt);
      if (parsed.customQuizAnswer) setCustomQuizAnswer(parsed.customQuizAnswer);
      if (parsed.customQuizHint) setCustomQuizHint(parsed.customQuizHint);
      if (parsed.selectedStampId) {
        const found = WEATHER_STAMPS.find((s) => s.id === parsed.selectedStampId);
        if (found) setSelectedStamp(found);
      }
      if (parsed.stampStyle) {
        setStampStyle(parsed.stampStyle);
      }
      setHasDraftNotice(false);
      soundEngine.playPaperRustle();
    } catch {}
  };

  // 임시 저장본 폐기하고 새로 작성
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setDiaryDate(getTodayDateString());
    setHasDraftNotice(false);
    soundEngine.playTileSlideSound();
  };

  // 다른 글감 뽑기 (Gemini AI 실시간 생성 - 새로고침 클릭 시에만 API 호출)
  const handleRefreshPrompt = async () => {
    if (isRefreshingPrompt) return;
    setIsRefreshingPrompt(true);
    soundEngine.playTileSlideSound();
    try {
      const nextPrompt = await fetchDailyPrompt(partnerName, true);
      if (nextPrompt) setDailyPrompt(nextPrompt);
    } catch (e) {
      console.warn('Failed to refresh prompt:', e);
    } finally {
      setIsRefreshingPrompt(false);
    }
  };

  // 글감을 일기 작성창에 쏙 적용
  const handleApplyPrompt = () => {
    soundEngine.playTileSlideSound();
    if (!title.trim()) {
      setTitle(dailyPrompt.slice(0, 60));
    }
    const prefix = `[💡 오늘의 질문: ${dailyPrompt}]\n\n`;
    if (!content.includes(dailyPrompt)) {
      setContent((prev) => (prev ? `${prefix}${prev}` : prefix));
    }
  };

  // AI 퀴즈 자동 생성: 상대방이 이미 읽은 편지 중 가장 최근 편지 기반!
  const handleGenerateAiQuiz = async () => {
    setIsGeneratingQuiz(true);
    soundEngine.playTileSlideSound();
    try {
      let targetDiary: DiaryData | null = null;
      if (roomCode) {
        targetDiary = await getLatestReadDiaryForPartner(roomCode, currentUserName, partnerName);
      }
      if (!targetDiary && fallbackPreviousDiary) {
        if (fallbackPreviousDiary.authorName === currentUserName && fallbackPreviousDiary.isWaxBroken) {
          targetDiary = fallbackPreviousDiary;
        }
      }

      if (targetDiary) {
        const quiz = await fetchAiQuiz(
          targetDiary.content,
          currentUserName,
          partnerName,
          targetDiary.authorName
        );
        setCustomPrompt(quiz.prompt);
        setCustomQuizAnswer(quiz.answer);
        setCustomQuizHint(quiz.hint);
        setQuizSourceInfo(`내가 썼고 ${partnerName} 님이 읽은 최근 편지「${targetDiary.title || '제목 없음'}」기반`);
      } else {
        // 지난 편지가 아직 없는 첫 편지인 경우
        const quiz = await fetchAiQuiz(null, currentUserName, partnerName);
        setCustomPrompt(quiz.prompt);
        setCustomQuizAnswer(quiz.answer);
        setCustomQuizHint(quiz.hint);
        setQuizSourceInfo('상대방이 읽은 내 지난 편지가 없어 둘만의 첫인사 퀴즈로 생성');
      }
      soundEngine.playMissionPassChime();
    } catch (e) {
      console.warn('AI quiz error:', e);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // 기기 내 사진 파일 선택 시 클라이언트 사이드 압축 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setIsCompressing(true);
    try {
      // 스마트폰 원본 사진을 1200px / ~150KB 수준으로 즉시 압축 (DB 용량 절약)
      const compressed = await compressImage(file);
      setUploadedPhotoInfo(compressed);
      setSelectedPhoto(compressed.dataUrl);
      soundEngine.playTileSlideSound();
    } catch (err) {
      console.error('Image compression error:', err);
      alert('사진을 불러오는 중 오류가 발생했습니다. 다른 사진을 선택해주세요.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || isSubmitting || isCompressing) return;

    // 사진 퍼즐 관문 선택 시 사진 첨부 필수 검증
    if (missionType === 'PUZZLE_PHOTO' && !selectedPhoto) {
      setPhotoError('사진 조각 퍼즐 관문을 풀게 하려면 사진을 1장 올려주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      try {
        soundEngine.playWaxCrackSound();
      } catch (audioErr) {
        console.warn('Audio notice:', audioErr);
      }

      let finalPhotoUrl = selectedPhoto;

      // 직접 업로드한 base64 사진인 경우, Storage 업로드 시도 (실패 시 base64 그대로 안전 저장)
      if (selectedPhoto && selectedPhoto.startsWith('data:')) {
        try {
          finalPhotoUrl = await uploadPhotoIfPossible(roomCode, selectedPhoto);
        } catch (e) {
          console.warn('Storage upload fallback:', e);
        }
      }

      let mission: MissionData;
      if (missionType === 'PUZZLE_PHOTO') {
        mission = {
          type: 'PUZZLE_PHOTO',
          prompt: `${partnerName} 님이 남긴 오늘의 한 컷 조각 퍼즐 맞추기`,
          quizAnswer: null,
          isCustom: false,
          submission: null,
          isPassed: false,
        };
      } else if (missionType === 'PUZZLE_STAMP') {
        mission = {
          type: 'PUZZLE_STAMP',
          prompt: '편지 봉투의 빈티지 우표 조각 4개를 맞추고 소인 찍기',
          quizAnswer: null,
          isCustom: false,
          submission: null,
          isPassed: false,
        };
      } else if (missionType === 'CUSTOM') {
        mission = {
          type: 'QUIZ',
          prompt: customPrompt || '저번 편지에서 내가 제일 먹고 싶다고 했던 음식이 뭐였게?',
          quizAnswer: customQuizAnswer || '붕어빵',
          quizHint: customQuizHint || '달콤하고 따뜻한 겨울 간식이야!',
          isCustom: true,
          submission: null,
          isPassed: false,
        };
      } else {
        mission = {
          type: 'TEXT',
          prompt: '오늘 고생한 나 또는 서로에게 다정한 한 줄 응원을 남겨주세요 (10자 이상)',
          quizAnswer: null,
          isCustom: false,
          submission: null,
          isPassed: false,
        };
      }

      // AI 온기 온도 및 감성 분석
      let warmthScore: WarmthScore | null = null;
      try {
        warmthScore = await Promise.race([
          fetchWarmthScore(title, content, currentUserName, partnerName),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]);
      } catch {
        warmthScore = null;
      }

      // AI 호출 지연/실패/단문 판정 시에도 '사랑해' 등 감정 키워드가 있다면 즉시 감성 휴리스틱으로 복원
      if (!warmthScore) {
        warmthScore = generateFallbackWarmth(title, content);
      }

      // 사용자가 지정한 일기 날짜(diaryDate) 반영
      let diaryCreatedAt = new Date().toISOString();
      if (diaryDate) {
        try {
          const [year, month, day] = diaryDate.split('-').map(Number);
          // 정오(12:00:00) 로컬 타임으로 생성하여 타임존(UTC) 변환 시 날짜 역전 방지
          const selectedDate = new Date(year, month - 1, day, 12, 0, 0);
          if (!isNaN(selectedDate.getTime())) {
            diaryCreatedAt = selectedDate.toISOString();
          }
        } catch {}
      }

      const diaryPayload: Partial<DiaryData> = {
        title,
        content,
        photos: finalPhotoUrl ? [finalPhotoUrl] : [],
        waxColor: selectedColor,
        mission,
        authorName: currentUserName,
        recipientName: partnerName,
        createdAt: diaryCreatedAt,
        isWaxBroken: false,
        warmthScore,
        stamp: {
          ...selectedStamp,
          style: stampStyle,
        },
      };

      // 안전 비상 백업: 전송 도중 네트워크가 끊기더라도 글이 사라지지 않도록 아웃박스 보관
      try {
        localStorage.setItem(`warmth_last_outbox_${roomCode}`, JSON.stringify(diaryPayload));
      } catch {}

      // 서버 저장 완료 대기
      const saveResult = await onSaveDiary(diaryPayload);

      // 서버 저장에 성공했거나 반환값이 없을 때만 임시 저장본 삭제 및 폼 초기화 후 모달 닫기
      if (saveResult !== false) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}

        setTitle('');
        setContent('');
        setDiaryDate(getTodayDateString());
        setSelectedPhoto(null);
        setUploadedPhotoInfo(null);
        setPhotoError('');
        setCustomPrompt('');
        setCustomQuizAnswer('');
        setCustomQuizHint('');

        onClose();
      }
    } catch (err) {
      console.error('Failed to save diary:', err);
    } finally {
      setIsSubmitting(false);
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
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl my-auto bg-[#FFFDF9] rounded-2xl p-4 sm:p-8 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900 max-h-[92dvh] overflow-y-auto overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors z-10 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 */}
            <div className="flex items-center gap-2 mb-5 pr-8">
              <Feather className="w-5 h-5 text-[#6B1724] shrink-0" />
              <h2 className="font-serif-warm text-lg sm:text-xl font-bold text-stone-900">
                {t('write.title')}
              </h2>
              <span className="text-xs text-stone-500 font-sans-ui ml-auto">
                To. {partnerName}
              </span>
            </div>

            {/* 오늘의 글감 추천 배너 (긴 글감도 잘림 없이 전체 표시) */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-[#FAF4EC] via-[#F6ECE0] to-[#F2E5D6] border border-[#E4D5BF] shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm select-none">🕯️</span>
                  <span className="text-[11px] font-sans-ui text-amber-900 font-bold tracking-wider">오늘의 추천 글감</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshPrompt}
                    disabled={isRefreshingPrompt}
                    title="다른 글감 뽑기"
                    className="p-1.5 px-2 rounded-lg bg-white/90 hover:bg-white text-stone-600 hover:text-stone-900 border border-stone-200 transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1 text-[11px] font-sans-ui"
                  >
                    <Dices className={`w-3.5 h-3.5 ${isRefreshingPrompt ? 'animate-spin text-[#6B1724]' : ''}`} />
                    <span className="hidden sm:inline">다른 글감</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyPrompt}
                    className="px-2.5 py-1.5 rounded-lg bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-[11px] font-sans-ui font-semibold transition-all active:scale-95 shadow-xs cursor-pointer"
                  >
                    글감 적용
                  </button>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-serif-warm text-stone-850 font-medium leading-relaxed break-keep">
                &ldquo;{dailyPrompt}&rdquo;
              </p>
            </div>

            {/* [1번 요구사항] 임시 저장본 복원 배너 */}
            {hasDraftNotice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-amber-50/95 border border-amber-300 text-stone-800 flex flex-wrap items-center justify-between gap-2 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base select-none">✍️</span>
                  <div className="text-xs font-sans-ui">
                    <strong className="text-[#6B1724]">작성 중이던 임시 저장 편지</strong>가 있습니다.
                    {lastSavedDraftTime && <span className="text-stone-500 ml-1.5 font-normal">({lastSavedDraftTime})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="px-2.5 py-1 rounded-lg bg-[#6B1724] text-amber-50 text-xs font-serif-warm font-bold hover:bg-[#831D2D] active:scale-95 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <span>이어서 쓰기</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="px-2 py-1 rounded-lg text-stone-500 hover:text-stone-800 text-xs font-sans-ui hover:bg-stone-200/50 transition-all cursor-pointer"
                  >
                    새로 쓰기
                  </button>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* [3번 요구사항] 오늘의 날씨 & 기분 빈티지 잉크 스탬프 선택 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 font-sans-ui flex items-center gap-1.5">
                    <span>🏷️</span>
                    <span>오늘의 날씨·기분 잉크 도장</span>
                  </label>
                  <span className="text-[11px] font-serif-warm text-stone-500">
                    편지 귀퉁이에 빈티지 인장으로 찍힙니다
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                  {WEATHER_STAMPS.map((st) => {
                    const isSelected = selectedStamp.id === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setSelectedStamp(st);
                          soundEngine.playPaperRustle();
                        }}
                        className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-xs font-serif-warm flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FAF4ED] border-[#6B1724] text-[#6B1724] font-bold shadow-xs scale-102 ring-1 ring-[#6B1724]/30'
                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                      >
                        <span className="text-sm">{st.symbol}</span>
                        <span>{st.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 스티커 표기 방식 선택 (인장 도장 vs 제목 위 대형 스티커) */}
                <div className="mt-2.5 pt-2 border-t border-stone-200/70 flex items-center justify-between gap-2">
                  <span className="text-xs font-sans-ui text-stone-600 font-medium">
                    스티커 표기 위치
                  </span>
                  <div className="inline-flex rounded-lg bg-stone-100/90 p-0.5 border border-stone-200 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStampStyle('BADGE');
                        soundEngine.playPaperRustle();
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-sans-ui transition-all cursor-pointer ${
                        stampStyle === 'BADGE'
                          ? 'bg-white text-[#6B1724] font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      🏷️ 날짜 옆 인장 도장
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStampStyle('EMOJI_TITLE');
                        soundEngine.playPaperRustle();
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-sans-ui transition-all cursor-pointer ${
                        stampStyle === 'EMOJI_TITLE'
                          ? 'bg-white text-[#6B1724] font-bold shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ✨ 제목 위 대형 스티커
                    </button>
                  </div>
                </div>
              </div>

              {/* [NEW] 일기 날짜 선택 및 빠른 프리셋 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 font-sans-ui flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#6B1724]" />
                    <span>일기 날짜</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] font-sans-ui">
                    <button
                      type="button"
                      onClick={() => {
                        setDiaryDate(getTodayDateString());
                        soundEngine.playPaperRustle();
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        diaryDate === getTodayDateString()
                          ? 'bg-[#6B1724] text-amber-50 font-bold shadow-2xs'
                          : 'bg-stone-100 hover:bg-stone-200/70 text-stone-600'
                      }`}
                    >
                      오늘
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                        setDiaryDate(yStr);
                        soundEngine.playPaperRustle();
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        (() => {
                          const y = new Date();
                          y.setDate(y.getDate() - 1);
                          const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                          return diaryDate === yStr
                            ? 'bg-[#6B1724] text-amber-50 font-bold shadow-2xs'
                            : 'bg-stone-100 hover:bg-stone-200/70 text-stone-600';
                        })()
                      }`}
                    >
                      어제
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={diaryDate}
                    onChange={(e) => {
                      if (e.target.value) setDiaryDate(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-mono text-sm text-stone-900 cursor-pointer shadow-2xs"
                  />
                </div>
              </div>

              {/* 제목 입력 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-sans-ui text-stone-600">
                    {language === 'en' ? 'Letter Title' : '일기 제목'}
                  </label>
                  {stampStyle === 'EMOJI_TITLE' && (
                    <span className="text-[11px] font-serif-warm text-[#6B1724] flex items-center gap-1">
                      <span>{selectedStamp.symbol}</span>
                      <span>{language === 'en' ? 'Sticker will appear above title' : '스티커가 제목 왼쪽 위에 크게 표시됩니다'}</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  {stampStyle === 'EMOJI_TITLE' && (
                    <div 
                      className="absolute -top-3.5 left-2 sm:-top-4 sm:left-2.5 z-10 text-2xl sm:text-3xl filter drop-shadow-sm pointer-events-none select-none -rotate-12 transition-transform duration-200"
                      title={language === 'en' ? 'Preview sticker above title' : '제목 위 스티커 미리보기'}
                    >
                      {selectedStamp.symbol}
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                    placeholder={t('write.titlePlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-base sm:text-sm text-stone-900 ${
                      stampStyle === 'EMOJI_TITLE' ? 'pl-11 sm:pl-12' : ''
                    }`}
                  />
                </div>
              </div>

              {/* 본문 입력 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-sans-ui text-stone-600">
                    {language === 'en' ? 'Letter Content' : '일기 내용'}
                  </label>
                  <span className="text-[11px] font-sans-ui text-stone-400">
                    <span className={content.length >= 1000 ? 'text-rose-600 font-bold' : 'text-stone-600'}>
                      {content.length}
                    </span>
                    /1000
                  </span>
                </div>
                <textarea
                  required
                  rows={6}
                  maxLength={1000}
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 1000))}
                  placeholder={t('write.contentPlaceholder')}
                  className="w-full p-3.5 rounded-xl border border-stone-300 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-base sm:text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 resize-none"
                />
              </div>

              {/* 사진 첨부 선택 (사용자 기기 직접 업로드) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-sans-ui text-stone-600 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    <span>오늘의 사진 첨부 (선택)</span>
                  </label>
                  {uploadedPhotoInfo && (
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      직접 업로드됨 ({uploadedPhotoInfo.sizeKb}KB 압축)
                    </span>
                  )}
                </div>

                {/* 숨겨진 파일 인풋 (모바일 카메라/갤러리 대응) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* 업로드된 사진 미리보기 또는 업로드 버튼 */}
                {selectedPhoto && uploadedPhotoInfo ? (
                  <div className="flex items-center gap-3 p-3 bg-[#FAF6EE] rounded-xl border border-[#E0D3C1]">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-300 shrink-0 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedPhoto}
                        alt="Uploaded"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-serif-warm font-bold text-stone-800 truncate">
                        {uploadedPhotoInfo.fileName}
                      </p>
                      <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5">
                        {uploadedPhotoInfo.width}×{uploadedPhotoInfo.height}px · {uploadedPhotoInfo.sizeKb}KB로 자동 최적화됨
                      </p>
                      <div className="flex items-center gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-amber-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-700" />
                          <span>다른 사진으로 변경</span>
                        </button>
                        <span className="text-stone-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedPhotoInfo(null);
                            setSelectedPhoto(null);
                          }}
                          className="text-[11px] text-rose-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>사진 삭제</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isCompressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 px-4 rounded-xl border-2 border-dashed border-[#C4A882] hover:border-[#6B1724] bg-[#FAF6EE]/80 hover:bg-[#F5ECE0] text-stone-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.99] group cursor-pointer"
                  >
                    {isCompressing ? (
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        <Loader2 className="w-6 h-6 text-[#6B1724] animate-spin" />
                        <span className="text-xs font-serif-warm text-stone-700 font-bold">사진 최적화 압축 중...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-[#DECDBB] flex items-center justify-center group-hover:scale-105 transition-transform text-[#6B1724]">
                          <Upload className="w-5 h-5 stroke-[1.8]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-serif-warm font-bold text-stone-800">
                            내 앨범이나 카메라에서 사진 올리기
                          </p>
                          <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5">
                            스마트폰 원본 사진을 올려도 용량이 자동으로 최적화됩니다
                          </p>
                        </div>
                      </>
                    )}
                  </button>
                )}

                {photoError && (
                  <p className="text-xs text-rose-600 font-sans-ui flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{photoError}</span>
                  </p>
                )}
              </div>

              {/* 실링 왁스 색상 선택 (버건디 / 골드 / 그린 / 직접 선택) */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-2">
                  봉인할 실링 왁스 인장 색상
                </label>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {WAX_COLORS.map((wax) => (
                    <button
                      key={wax.hex}
                      type="button"
                      onClick={() => setSelectedColor(wax.hex)}
                      className={`py-2 px-1.5 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-sans-ui flex items-center justify-center gap-1.5 transition-all ${
                        selectedColor.toLowerCase() === wax.hex.toLowerCase()
                          ? 'border-stone-800 bg-white shadow-sm ring-2 ring-stone-800/10 font-bold text-stone-900'
                          : 'border-stone-200 bg-stone-50/70 text-stone-600 hover:border-stone-300'
                      }`}
                      title={wax.label}
                    >
                      <span
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-inner shrink-0"
                        style={{ backgroundColor: wax.hex }}
                      />
                      <span className="truncate">
                        {wax.name === 'Burgundy' ? '버건디' : wax.name === 'Antique Gold' ? '골드' : '그린'}
                      </span>
                    </button>
                  ))}

                  {/* 4번째 옵션: 직접 선택 (포토샵 컬러 휠 원형 팔레트) */}
                  <div className="relative">
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={customColor}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setCustomColor(newColor);
                        setSelectedColor(newColor);
                      }}
                      onInput={(e) => {
                        const newColor = e.currentTarget.value;
                        setCustomColor(newColor);
                        setSelectedColor(newColor);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="포토샵 컬러 휠에서 직접 색상 선택"
                      aria-label="실링 왁스 인장 색상 직접 선택"
                    />
                    <div
                      className={`w-full h-full py-2 px-1.5 sm:px-2 rounded-xl border text-[11px] sm:text-xs font-sans-ui flex items-center justify-center gap-1.5 transition-all pointer-events-none ${
                        isCustomColor
                          ? 'border-stone-800 bg-white shadow-sm ring-2 ring-stone-800/10 font-bold text-stone-900'
                          : 'border-stone-200 bg-stone-50/70 text-stone-600'
                      }`}
                    >
                      {/* 포토샵 컬러 원형 (Hue Ring) 스타일 아이콘 */}
                      <div
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full p-[1.5px] shrink-0 flex items-center justify-center shadow-xs"
                        style={{
                          background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                        }}
                      >
                        <div
                          className="w-full h-full rounded-full border border-black/15 shadow-inner transition-colors"
                          style={{
                            backgroundColor: isCustomColor ? customColor : '#ffffff',
                          }}
                        />
                      </div>
                      <span className="truncate">직접 선택</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 미션 설정 (사진 퍼즐, 우표 퍼즐, 시스템 데일리, 커스텀 퀴즈) */}
              <div className="pt-2 border-t border-stone-200">
                <label className="block text-xs font-sans-ui text-stone-600 mb-2">
                  상대방이 풀 관문 선택
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-[11px] font-sans-ui mb-3">
                  <button
                    type="button"
                    onClick={() => setMissionType('PUZZLE_PHOTO')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'PUZZLE_PHOTO' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>🧩 사진 퍼즐</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMissionType('PUZZLE_STAMP')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'PUZZLE_STAMP' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>📮 우표 맞추기</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMissionType('CUSTOM')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'CUSTOM' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>❓ 깜짝 퀴즈</span>
                  </button>
                </div>

                {missionType === 'PUZZLE_PHOTO' && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs font-serif-warm text-stone-700">
                    🧩 <strong>사진 조각 퍼즐</strong>: 내가 첨부한 사진이 3×3 슬라이딩 조각으로 분리되어, {partnerName} 님이 조각을 맞추면 일기가 개봉됩니다.
                  </div>
                )}

                {missionType === 'PUZZLE_STAMP' && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs font-serif-warm text-stone-700">
                    📮 <strong>빈티지 우표 맞추기</strong>: 편지 봉투의 우표 조각 4개를 순서대로 맞춰 소인 도장을 찍으면 일기가 개봉됩니다.
                  </div>
                )}

                {missionType === 'CUSTOM' && (
                  <div className="space-y-2.5 p-3 bg-amber-50/60 rounded-xl border border-amber-200/70">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-sans-ui text-amber-900 font-bold flex items-center gap-1">
                        <span>❓ 저번 편지 복습 퀴즈</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateAiQuiz}
                        disabled={isGeneratingQuiz}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-200/90 hover:bg-amber-300 active:scale-95 text-amber-950 text-[11px] font-sans-ui font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-amber-800 ${isGeneratingQuiz ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingQuiz ? '상대가 본 최근 편지 분석 중...' : '✨ 상대가 본 최근 편지 기반 AI 퀴즈'}</span>
                      </button>
                    </div>

                    {quizSourceInfo && (
                      <div className="text-[11px] font-sans-ui text-amber-900/90 bg-amber-100/70 px-2.5 py-1.5 rounded-lg border border-amber-300/60 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                        <span className="font-medium truncate">{quizSourceInfo}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-sans-ui text-stone-600 mb-1 font-medium">
                          질문 내용
                        </label>
                        <input
                          type="text"
                          placeholder="예: 저번 편지에서 내가 주말에 가자고 했던 곳이 어디였게?"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-serif-warm focus:outline-none focus:ring-1 focus:ring-amber-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-sans-ui text-stone-600 mb-1 font-medium">
                          정답
                        </label>
                        <input
                          type="text"
                          placeholder="예: 서촌 (상대방이 입력할 단어)"
                          value={customQuizAnswer}
                          onChange={(e) => setCustomQuizAnswer(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-serif-warm focus:outline-none focus:ring-1 focus:ring-amber-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-sans-ui text-stone-600 mb-1 font-medium">
                          힌트
                        </label>
                        <input
                          type="text"
                          placeholder="예: 저번 편지 셋째 줄에 적어뒀지!"
                          value={customQuizHint}
                          onChange={(e) => setCustomQuizHint(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-serif-warm focus:outline-none focus:ring-1 focus:ring-amber-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 발송 버튼 & 자동 임시 저장 상태 */}
              <div className="pt-3 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
                  className="w-full py-3.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] disabled:opacity-50 text-amber-50 font-serif-warm font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 text-amber-200 animate-spin" />
                      <span>{language === 'en' ? 'Sealing Letter...' : '일기 봉인 중...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-amber-200" />
                      <span>{t('write.btn.save')}</span>
                    </>
                  )}
                </button>
                {lastSavedDraftTime && (
                  <div className="text-center text-[11px] text-stone-400 font-sans-ui flex items-center justify-center gap-1">
                    <Save className="w-3 h-3 text-stone-400" />
                    <span>{language === 'en' ? `Draft safely saved at ${lastSavedDraftTime}` : `작성 중인 내용이 ${lastSavedDraftTime}에 안전하게 임시 저장되었습니다`}</span>
                  </div>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
