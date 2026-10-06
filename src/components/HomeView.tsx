'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Calendar,
  Sparkles,
  PenLine,
  BookOpen,
  Bell,
  ChevronRight,
  RefreshCw,
  Edit3,
  X,
  Mail,
  Lock,
  Clock,
  ThermometerSun,
  ThermometerSnowflake,
  CheckCheck,
} from 'lucide-react';
import { DiaryData, RoomData } from '@/types/diary';
import {
  calculateDaysTogether,
  DaysTogetherInfo,
  getTimeUntilNextReset,
  ResetCountdownInfo,
  formatDiaryDateWithRelative,
} from '@/lib/dateUtils';
import { updateAnniversaryDateInFirestore, getRoomDiariesFromFirestore } from '@/lib/roomService';
import { fetchDailyPrompt } from '@/lib/aiClient';
import { soundEngine } from '@/lib/audio';
import { useLanguage } from '@/lib/i18n';

interface HomeViewProps {
  partnerName: string;
  userName: string;
  roomCode: string;
  roomData?: RoomData | null;
  diary?: DiaryData | null;
  isMyTurn: boolean;
  hasMyQuotaBeenUsedToday?: boolean;
  userRole?: 'CREATOR' | 'PARTNER';
  userBirthDate?: string;
  onOpenWriteModal: (initialTitle?: string) => void;
  onOpenArchive: () => void;
  onSendKnock: () => void;
  onOpenSealedLetter: () => void;
  onOpenDiary: () => void;
}

export default function HomeView({
  partnerName,
  userName,
  roomCode,
  roomData,
  diary,
  isMyTurn,
  hasMyQuotaBeenUsedToday,
  userBirthDate,
  onOpenWriteModal,
  onOpenArchive,
  onSendKnock,
  onOpenSealedLetter,
  onOpenDiary,
}: HomeViewProps) {
  const { language, t } = useLanguage();
  const [knockCooldown, setKnockCooldown] = useState(false);
  const [dailyPrompt, setDailyPrompt] = useState<string>('오늘 하루 중 너에게 가장 먼저 말해주고 싶었던 사소한 순간은?');
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);

  // 매일 새벽 04:00 초기화 실시간 카운트다운 타이머 (1초 주기 갱신)
  const [countdown, setCountdown] = useState<ResetCountdownInfo>(() => getTimeUntilNextReset(new Date(), language));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilNextReset(new Date(), language));
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  // 둘만의 교환일기 중 가장 최근 일기 작성 일시 추적 ("우리의 마지막 일기")
  const [lastDiaryDate, setLastDiaryDate] = useState<string | null>(null);

  useEffect(() => {
    // 1) 현재 구독 중인 최신 diary가 있는 경우 최우선 적용
    if (diary && diary.createdAt) {
      setLastDiaryDate(diary.createdAt);
      return;
    }

    // 2) 실제 보관함에서 가장 최신 일기 1건 탐색
    if (roomCode) {
      getRoomDiariesFromFirestore(roomCode, 1)
        .then((list) => {
          if (list.length > 0 && list[0].createdAt) {
            setLastDiaryDate(list[0].createdAt);
          } else if (roomData?.lastWrittenByUser) {
            const validTimes = Object.values(roomData.lastWrittenByUser)
              .filter((t) => typeof t === 'string' && t !== 'user_ssr')
              .map((t) => new Date(t).getTime())
              .filter((t) => !isNaN(t));
            if (validTimes.length > 0) {
              setLastDiaryDate(new Date(Math.max(...validTimes)).toISOString());
            }
          }
        })
        .catch(() => { });
    }
  }, [diary, roomData, roomCode]);

  // 우리의 마지막 일기 감성 상대 날짜 포맷팅 (오늘 / 어제 / 그저께 / N일 전)
  const lastDiaryInfo = useMemo(() => formatDiaryDateWithRelative(lastDiaryDate, language), [lastDiaryDate, language]);

  // 상대방의 생년월일 추출
  const partnerBirthDate = useMemo(() => {
    if (!roomData?.memberInfo) return null;
    const partnerEntry = Object.entries(roomData.memberInfo).find(
      ([key, info]) => key !== userName && info.nickname !== userName
    );
    return partnerEntry?.[1]?.birthDate || null;
  }, [roomData, userName]);

  // 이어진 날짜 계산 (기념일 설정값 -> 매칭일 -> 방 생성일 -> 오늘 순 우선순위)
  const effectiveStartDate = roomData?.anniversaryDate || roomData?.matchedAt || roomData?.createdAt || null;
  const daysInfo: DaysTogetherInfo = calculateDaysTogether(effectiveStartDate, language);

  // 추천 글감 로드
  useEffect(() => {
    fetchDailyPrompt(partnerName).then((prompt) => {
      if (prompt) setDailyPrompt(prompt);
    });
  }, [partnerName]);

  const handleKnock = () => {
    if (knockCooldown) return;
    soundEngine.playWindChimeKnock();
    onSendKnock();
    setKnockCooldown(true);
    setTimeout(() => setKnockCooldown(false), 3000);
  };

  const handleRefreshPrompt = async () => {
    if (isRefreshingPrompt) return;
    setIsRefreshingPrompt(true);
    soundEngine.playTileSlideSound();
    try {
      const next = await fetchDailyPrompt(partnerName);
      if (next) setDailyPrompt(next);
    } finally {
      setIsRefreshingPrompt(false);
    }
  };

  const handleSaveAnniversary = async () => {
    if (!customStartDate) return;
    setIsSavingDate(true);
    try {
      await updateAnniversaryDateInFirestore(roomCode, new Date(customStartDate).toISOString());
      soundEngine.playMissionPassChime();
      setIsDateModalOpen(false);
    } catch (e) {
      console.warn('Failed to save anniversary:', e);
    } finally {
      setIsSavingDate(false);
    }
  };

  // 편지 상태 분석
  const isMine = Boolean(diary && diary.authorName === userName);
  const isPartner = Boolean(diary && diary.authorName !== userName);

  // 1) 상대방이 보낸 편지인데 내가 아직 왁스를 안 깬 경우: 새 봉인 편지 도착!
  const hasIncomingSealedLetter = Boolean(diary && isPartner && !diary.isWaxBroken);

  // 2) 내가 보낸 편지인데 상대방이 아직 왁스를 안 깬 경우: 상대방 미개봉 상태!
  const isMyLetterUnopenedByPartner = Boolean(diary && isMine && !diary.isWaxBroken);

  // 3) 내가 보낸 편지인데 상대방이 이미 열어본 경우 (하지만 상대방이 아직 답장을 안 씀): 답장 대기 중!
  const isMyLetterOpenedWaitingReply = Boolean(diary && isMine && diary.isWaxBroken);

  // 4) 상대방이 보낸 편지를 내가 이미 열어본 상태: 내가 답장할 차례!
  const isPartnerLetterOpenedByMe = Boolean(diary && isPartner && diary.isWaxBroken);

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.98 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 space-y-6"
    >
      {/* 1. 커플 D-Day 메인 카드 (우리가 온기로 이어진 지 N일 차) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] border border-[#E8DFD3] shadow-lg paper-texture"
      >
        {/* 장식용 은은한 온기 배경 블러 */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#6B1724]/8 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* 커플 닉네임 뱃지 */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-[#E5DAC8] shadow-2xs mb-2">
            <span className="font-serif-warm font-bold text-stone-900 text-xs sm:text-sm">
              {userName}
            </span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
            <span className="font-serif-warm font-bold text-stone-900 text-xs sm:text-sm">
              {partnerName}
            </span>
          </div>

          {/* 생일 정보 뱃지 (생년월일이 등록된 경우 표시) */}
          {(userBirthDate || partnerBirthDate) && (
            <div className="flex items-center gap-1.5 text-[10.5px] font-sans-ui text-stone-500 mb-3 flex-wrap justify-center">
              {userBirthDate && (
                <span className="inline-flex items-center gap-1 bg-amber-50/90 border border-amber-200/90 px-2 py-0.5 rounded-md text-amber-900 shadow-2xs">
                  <span>🎂 {userName}:</span>
                  <span className="font-semibold font-mono">
                    {language === 'en'
                      ? new Date(userBirthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : userBirthDate.slice(5).replace('-', '월 ') + '일'}
                  </span>
                </span>
              )}
              {partnerBirthDate && (
                <span className="inline-flex items-center gap-1 bg-rose-50/90 border border-rose-200/90 px-2 py-0.5 rounded-md text-rose-900 shadow-2xs">
                  <span>🎂 {partnerName}:</span>
                  <span className="font-semibold font-mono">
                    {language === 'en'
                      ? new Date(partnerBirthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : partnerBirthDate.slice(5).replace('-', '월 ') + '일'}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* D-Day 대형 타이틀 */}
          <p className="font-serif-warm text-stone-600 text-xs sm:text-sm tracking-wide font-medium">
            {t('home.togetherDaysPrefix')}
          </p>
          <div className="flex items-baseline justify-center gap-2 my-1">
            <span className="font-serif-warm font-black text-4xl sm:text-5xl text-[#6B1724] tracking-tight">
              {daysInfo.days}
            </span>
            <span className="font-serif-warm font-bold text-xl sm:text-2xl text-stone-800">
              {t('home.daysUnit')}
            </span>
          </div>

          {/* 시작일 및 수정 버튼 */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-serif-warm mt-1">
            <span>{t('home.togetherSince', { date: daysInfo.formattedStartDate })}</span>
            <button
              onClick={() => {
                setCustomStartDate(daysInfo.startDateIso);
                setIsDateModalOpen(true);
              }}
              title={language === 'en' ? 'Edit Anniversary' : '시작일(처음 만난 날) 설정'}
              className="p-1 rounded-md hover:bg-stone-200/60 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>

          {/* 매일 새벽 04시 초기화 타이머 뱃지 (한 줄 표시 보장 & 모바일 최적화) */}
          <div className="mt-4 inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-amber-950/5 border border-amber-900/15 text-stone-700 text-[11px] sm:text-xs font-serif-warm shadow-2xs max-w-full overflow-hidden whitespace-nowrap">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-800 shrink-0" />
            <span className="shrink-0 font-medium">{t('home.dailyReset')}</span>
            <span className="text-stone-300 shrink-0">·</span>
            <span className="font-mono font-bold text-[#6B1724] truncate">
              {hasMyQuotaBeenUsedToday ? (
                <>
                  <span className="hidden sm:inline">{t('home.quotaUsedFull', { time: countdown.formatted })}</span>
                  <span className="sm:hidden">{t('home.quotaUsedShort', { time: countdown.formatted })}</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">{t('home.quotaAvailableFull', { time: countdown.formatted })}</span>
                  <span className="sm:hidden">{t('home.quotaAvailableShort', { time: countdown.formatted })}</span>
                </>
              )}
            </span>
          </div>
        </div>
      </motion.div>

      {/* 2. 오늘의 교환일기 상태 카드 (Cozy Desk Widget) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        className="rounded-3xl p-5 sm:p-6 bg-white border border-[#E8DFD3] shadow-md paper-texture space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#E8DFD3]/70 pb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-900 shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif-warm font-bold text-stone-900 text-sm sm:text-base truncate">
                {t('home.widgetTitle')}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-sans-ui truncate">
                {hasIncomingSealedLetter
                  ? t('home.status.sealedArrived', { partner: partnerName })
                  : isMyLetterUnopenedByPartner
                    ? t('home.status.unopened', { partner: partnerName })
                    : isMyLetterOpenedWaitingReply
                      ? t('home.status.waitingReply', { partner: partnerName })
                      : hasMyQuotaBeenUsedToday
                        ? t('home.status.quotaUsed')
                        : isMyTurn
                          ? t('home.status.myTurn')
                          : t('home.status.partnerTurn', { partner: partnerName })}
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-serif-warm font-bold border whitespace-nowrap shrink-0 text-center select-none ${hasIncomingSealedLetter
                ? 'bg-rose-100/90 text-rose-950 border-rose-300 animate-pulse'
                : isMyLetterUnopenedByPartner
                  ? 'bg-amber-100/80 text-amber-950 border-amber-300'
                  : isMyLetterOpenedWaitingReply
                    ? 'bg-stone-100 text-stone-700 border-stone-300'
                    : hasMyQuotaBeenUsedToday
                      ? 'bg-amber-100/80 text-amber-950 border-amber-300'
                      : isMyTurn
                        ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/30'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
          >
            {hasIncomingSealedLetter
              ? t('badge.sealedArrived')
              : isMyLetterUnopenedByPartner
                ? t('badge.unopened')
                : isMyLetterOpenedWaitingReply
                  ? t('badge.waitingReply')
                  : hasMyQuotaBeenUsedToday
                    ? t('badge.quotaUsed')
                    : isMyTurn
                      ? t('badge.myTurn')
                      : t('badge.partnerTurn')}
          </span>
        </div>

        {/* 우리의 마지막 일기 안내 바 (가운데 정렬: 오늘 / 어제 / 그저께 / N일 전 강조) */}
        <div className="py-2.5 sm:py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FAF6EE] via-[#FDFBF7] to-[#FAF6EE] border border-[#E8DFC8] flex items-center justify-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-serif-warm shadow-2xs">
          <span className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-white border border-[#DECDBB] text-[#6B1724] shadow-2xs shrink-0">
            <PenLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
          <div className="flex items-center gap-2 font-serif-warm">
            <span className="text-stone-600 font-medium text-xs sm:text-sm whitespace-nowrap">
              {t('home.lastDiaryLabel')}
            </span>
            {lastDiaryInfo ? (
              <span
                className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm sm:text-base font-black tracking-tight shadow-xs border transition-all whitespace-nowrap ${
                  lastDiaryInfo.relativeText === '오늘' || lastDiaryInfo.relativeText === 'Today'
                    ? 'bg-rose-50 text-[#6B1724] border-rose-300 ring-2 ring-rose-200/50'
                    : lastDiaryInfo.relativeText === '어제' || lastDiaryInfo.relativeText === 'Yesterday'
                    ? 'bg-amber-50 text-amber-950 border-amber-300'
                    : lastDiaryInfo.relativeText === '그저께' || lastDiaryInfo.relativeText === '2 days ago'
                    ? 'bg-stone-50 text-stone-900 border-stone-300'
                    : 'bg-white text-stone-800 border-stone-300'
                }`}
              >
                {lastDiaryInfo.relativeText}
              </span>
            ) : (
              <span className="text-stone-400 italic font-normal text-xs sm:text-sm whitespace-nowrap">
                {t('home.lastDiaryEmpty')}
              </span>
            )}
          </div>
        </div>

        {/* 상태별 콘텐츠 */}
        {hasIncomingSealedLetter ? (
          // 1. 상대방이 보낸 미개봉 봉인 편지 도착
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50/80 via-amber-50/40 to-stone-50 border border-rose-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-12 h-12 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-sm shrink-0">
                <Lock className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <p className="font-serif-warm font-bold text-stone-900 text-sm">
                  {t('action.letterDesc.sealedArrived', { partner: partnerName })}
                </p>
                <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                  {t('action.letterDesc.sealedSub')}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                soundEngine.playPaperRustle();
                onOpenSealedLetter();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>{t('action.openSealed')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : isMyLetterUnopenedByPartner ? (
          // 2. 내가 마지막으로 편지를 보냈고, 상대방이 아직 안 읽은 상태 (미개봉)
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shadow-2xs shrink-0 border border-amber-200">
                  <Lock className="w-5 h-5 text-amber-800" />
                </div>
                <div>
                  <p className="font-serif-warm font-bold text-stone-900 text-sm">
                    {t('action.letterDesc.unopened', { partner: partnerName })}
                  </p>
                  <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                    {t('action.letterDesc.unopenedSub')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200/60 text-[11px] font-serif-warm text-amber-950 flex items-center gap-1.5">
              <span>💡</span>
              <span>{t('action.notice.lock')}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  soundEngine.playPaperRustle();
                  onOpenDiary();
                }}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap truncate px-2"
              >
                {t('action.checkMyLetter')}
              </button>
              <button
                onClick={handleKnock}
                disabled={knockCooldown}
                className="flex-1 py-2 rounded-xl border border-amber-300 bg-amber-100/70 hover:bg-amber-200/70 text-amber-950 text-xs font-serif-warm font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap truncate px-2"
              >
                <Bell className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span className="truncate">{knockCooldown ? t('action.knockSent') : (language === 'en' ? 'Send Knock ✉️' : '풍경 소리 노크하기')}</span>
              </button>
            </div>
          </div>
        ) : isMyLetterOpenedWaitingReply ? (
          // 3. 내가 보낸 편지를 상대방이 읽었지만, 아직 답장을 작성하지 않은 상태 (답장 대기)
          <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70 space-y-3 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center justify-center shadow-2xs shrink-0 border border-emerald-200">
                  <CheckCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="font-serif-warm font-bold text-stone-900 text-sm">
                    {language === 'en' ? `${partnerName} opened your letter!` : `${partnerName} 님이 내가 보낸 편지를 읽었어요!`}
                  </p>
                  <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                    {language === 'en' ? `Your warmth was delivered. Now it's ${partnerName}'s turn to reply.` : `소중한 온기가 전해졌습니다. 이제 ${partnerName} 님이 답장을 작성할 차례입니다.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-stone-200/80 text-[11px] font-serif-warm text-stone-600 flex items-center gap-1.5">
              <span>✉️</span>
              <span>{language === 'en' ? 'You can write your next letter after your partner replies.' : '교환일기 특성상 상대방의 답장이 서재에 도착한 후에 새 일기를 쓸 수 있습니다.'}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  soundEngine.playPaperRustle();
                  onOpenDiary();
                }}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap truncate px-2"
              >
                {language === 'en' ? 'Re-read My Letter' : '내가 보낸 편지 다시 읽기'}
              </button>
              <button
                onClick={handleKnock}
                disabled={knockCooldown}
                className="flex-1 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/60 text-amber-950 text-xs font-serif-warm font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap truncate px-2"
              >
                <Bell className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{knockCooldown ? t('action.knockSent') : (language === 'en' ? 'Send Knock ✉️' : '풍경 소리 노크하기')}</span>
              </button>
            </div>
          </div>
        ) : isPartnerLetterOpenedByMe && diary ? (
          // 4. 상대방이 보낸 편지를 내가 이미 열어본 상태 (최근 편지 요약 & 내가 답장할 차례)
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-serif-warm">
                {language === 'en' ? `Recent letter from ${partnerName}` : `${partnerName} 님이 보낸 최근 편지`}
              </span>
              {diary.warmthScore && typeof diary.warmthScore.temperature === 'number' && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${diary.warmthScore.temperature <= 0
                      ? 'bg-sky-50 text-sky-800 border border-sky-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                >
                  {diary.warmthScore.temperature <= 0 ? (
                    <ThermometerSnowflake className="w-3 h-3" />
                  ) : (
                    <ThermometerSun className="w-3 h-3" />
                  )}
                  <span>
                    {diary.warmthScore.temperature > 0
                      ? `+${diary.warmthScore.temperature}`
                      : diary.warmthScore.temperature}
                    °C
                  </span>
                </span>
              )}
            </div>

            <div>
              <h4 className="font-serif-warm font-bold text-stone-900 text-base leading-snug">
                {diary.title}
              </h4>
              <p className="text-xs text-stone-600 line-clamp-2 font-serif-warm mt-1 leading-relaxed">
                {diary.content}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  soundEngine.playPaperRustle();
                  onOpenDiary();
                }}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap truncate px-2"
              >
                {language === 'en' ? 'Re-read Letter' : '편지 다시 읽기'}
              </button>
              {hasMyQuotaBeenUsedToday ? (
                <div
                  title={language === 'en' ? `Written today (1 per day each). You can write a reply tomorrow after 04:00 AM. (${countdown.formatted} left)` : `오늘 일기는 이미 작성하셨습니다 (하루 각자 1통). 내일 새벽 04:00 이후에 답장을 쓸 수 있습니다. (남은 시간: ${countdown.formatted})`}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 text-xs font-serif-warm font-medium flex items-center justify-center gap-1.5 shadow-2xs select-none whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span className="truncate">{language === 'en' ? `Reset 04:00 (${countdown.formatted})` : `04시 리셋 (${countdown.formatted})`}</span>
                </div>
              ) : isMyTurn ? (
                <button
                  onClick={() => {
                    soundEngine.playTileSlideSound();
                    onOpenWriteModal();
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-xs whitespace-nowrap truncate px-2"
                >
                  {t('opened.replyBtn')} ✍️
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          // D. 아직 첫 편지 작성 전 (초기 상태)
          <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DFC8] text-center space-y-2.5">
            <p className="font-serif-warm text-stone-800 text-sm font-semibold">
              {isMyTurn
                ? language === 'en'
                  ? `It's ${userName}'s turn to write the first letter.`
                  : `방에 초대된 ${userName} 님이 첫 편지를 시작할 차례예요.`
                : language === 'en'
                  ? `Waiting for ${partnerName}'s first letter.`
                  : `${partnerName} 님의 첫 번째 편지를 기다리고 있어요.`}
            </p>
            <p className="text-xs text-stone-500 font-serif-warm">
              {language === 'en'
                ? 'Brighten up your exchange journal with the first warmth shared between each other.'
                : '서로에게 전하는 첫 온기로 둘만의 교환일기를 환하게 밝혀보세요.'}
            </p>
            <div className="pt-1">
              {isMyTurn ? (
                <button
                  onClick={() => {
                    soundEngine.playPaperRustle();
                    onOpenWriteModal();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-200" />
                  <span>{language === 'en' ? 'Write First Letter' : '첫 번째 온기 작성하기'}</span>
                </button>
              ) : (
                <button
                  onClick={handleKnock}
                  disabled={knockCooldown}
                  className="px-4 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 text-xs font-serif-warm font-semibold shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-700" />
                  <span>{knockCooldown ? t('action.knockSent') : (language === 'en' ? 'Send a Knock ✉️' : '기다림의 노크 보내기')}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* 3. 오늘의 추천 글감 & 둘만의 서재 바로가기 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 오늘의 추천 글감 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          className="rounded-3xl p-5 bg-[#FAF7F2] border border-[#E8DFD3] shadow-xs paper-texture flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-sans-ui text-amber-900 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-700" />
                {t('topic.title')}
              </span>
              <button
                onClick={handleRefreshPrompt}
                disabled={isRefreshingPrompt}
                title={t('topic.refresh')}
                className="p-1 rounded-md hover:bg-stone-200/60 text-stone-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrompt ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="font-serif-warm text-stone-800 text-xs sm:text-sm leading-relaxed italic">
              &ldquo;{dailyPrompt}&rdquo;
            </p>
          </div>

          <div className="pt-3">
            <button
              onClick={() => {
                soundEngine.playTileSlideSound();
                onOpenWriteModal(dailyPrompt);
              }}
              className="w-full py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-semibold transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <span>{t('topic.writeWithTopic')}</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            </button>
          </div>
        </motion.div>

        {/* 둘만의 비밀 서재 카드 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
          onClick={() => {
            soundEngine.playPaperRustle();
            onOpenArchive();
          }}
          className="rounded-3xl p-5 bg-[#FAF7F2] border border-[#E8DFD3] shadow-xs paper-texture flex flex-col justify-between hover:border-[#6B1724]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-sans-ui text-[#6B1724] font-semibold flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#6B1724]" />
                {t('archiveCard.title')}
              </span>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h4 className="font-serif-warm font-bold text-stone-900 text-base leading-snug">
              {language === 'en' ? 'Archive of Shared Memories' : '함께 쌓아온 온기의 아카이브'}
            </h4>
            <p className="text-xs text-stone-500 font-serif-warm mt-1 leading-relaxed">
              {t('archiveCard.sub')}
            </p>
          </div>

          <div className="pt-3">
            <div className="w-full py-2 rounded-xl bg-white group-hover:bg-amber-50/50 border border-stone-200 group-hover:border-amber-300/60 text-stone-700 group-hover:text-amber-950 text-xs font-serif-warm font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs whitespace-nowrap">
              <span>{t('archiveCard.btn')}</span>
              <BookOpen className="w-3.5 h-3.5 text-[#6B1724]" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. 기념일 / 시작일 변경 모달 */}
      <AnimatePresence>
        {isDateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#E8DFC8]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif-warm font-bold text-stone-900 text-base">
                    {language === 'en' ? 'Set Starting Anniversary' : '이어진 시작일 설정'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsDateModalOpen(false)}
                  className="p-1 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-stone-600 font-serif-warm leading-relaxed">
                  {language === 'en'
                    ? 'Set the day you started dating or began your exchange journal. D-day count will be calculated automatically.'
                    : '교환일기를 시작한 날이나 연애를 시작한 기념일 날짜를 지정하세요. D-Day 일수와 기념일이 자동으로 계산됩니다.'}
                </p>
                <div className="w-full min-w-0">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full min-w-0 max-w-full box-border px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-sm font-sans-ui focus:outline-none focus:border-[#6B1724] shadow-2xs block"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAnniversary}
                  disabled={isSavingDate || !customStartDate}
                  className="flex-1 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSavingDate ? (language === 'en' ? 'Saving...' : '저장 중...') : (language === 'en' ? 'Apply' : '적용하기')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
