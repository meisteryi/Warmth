'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Calendar,
  Sparkles,
  PenLine,
  BookOpen,
  Bell,
  ChevronRight,
  Copy,
  Check,
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
  ResetCountdownInfo 
} from '@/lib/dateUtils';
import { updateAnniversaryDateInFirestore } from '@/lib/roomService';
import { fetchDailyPrompt } from '@/lib/aiClient';
import { soundEngine } from '@/lib/audio';

interface HomeViewProps {
  partnerName: string;
  userName: string;
  roomCode: string;
  roomData?: RoomData | null;
  diary?: DiaryData | null;
  isMyTurn: boolean;
  hasMyQuotaBeenUsedToday?: boolean;
  userRole?: 'CREATOR' | 'PARTNER';
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
  onOpenWriteModal,
  onOpenArchive,
  onSendKnock,
  onOpenSealedLetter,
  onOpenDiary,
}: HomeViewProps) {
  const [copied, setCopied] = useState(false);
  const [knockCooldown, setKnockCooldown] = useState(false);
  const [dailyPrompt, setDailyPrompt] = useState<string>('오늘 하루 중 너에게 가장 먼저 말해주고 싶었던 사소한 순간은?');
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);

  // 매일 새벽 04:00 초기화 실시간 카운트다운 타이머 (1초 주기 갱신)
  const [countdown, setCountdown] = useState<ResetCountdownInfo>(() => getTimeUntilNextReset());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilNextReset());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 이어진 날짜 계산 (기념일 설정값 -> 매칭일 -> 방 생성일 -> 오늘 순 우선순위)
  const effectiveStartDate = roomData?.anniversaryDate || roomData?.matchedAt || roomData?.createdAt || null;
  const daysInfo: DaysTogetherInfo = calculateDaysTogether(effectiveStartDate);

  // 추천 글감 로드
  useEffect(() => {
    fetchDailyPrompt(partnerName).then((prompt) => {
      if (prompt) setDailyPrompt(prompt);
    });
  }, [partnerName]);

  const handleCopyCode = () => {
    soundEngine.playTileSlideSound();
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 space-y-6">
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-[#E5DAC8] shadow-2xs mb-4">
            <span className="font-serif-warm font-bold text-stone-900 text-xs sm:text-sm">
              {userName}
            </span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span className="font-serif-warm font-bold text-stone-900 text-xs sm:text-sm">
              {partnerName}
            </span>
            <span className="text-stone-300">·</span>
            <button
              onClick={handleCopyCode}
              className="text-[11px] font-mono text-stone-500 hover:text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
              title="초대코드 복사"
            >
              <span>#{roomCode}</span>
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-400" />}
            </button>
          </div>

          {/* D-Day 대형 타이틀 */}
          <p className="font-serif-warm text-stone-600 text-xs sm:text-sm tracking-wide font-medium">
            우리가 온기로 이어진 지
          </p>
          <div className="flex items-baseline justify-center gap-2 my-1">
            <span className="font-serif-warm font-black text-4xl sm:text-5xl text-[#6B1724] tracking-tight">
              {daysInfo.days}
            </span>
            <span className="font-serif-warm font-bold text-xl sm:text-2xl text-stone-800">
              일 차
            </span>
          </div>

          {/* 시작일 및 수정 버튼 */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-serif-warm mt-1">
            <span>{daysInfo.formattedStartDate}부터 함께</span>
            <button
              onClick={() => {
                setCustomStartDate(daysInfo.startDateIso);
                setIsDateModalOpen(true);
              }}
              title="시작일(처음 만난 날) 설정"
              className="p-1 rounded-md hover:bg-stone-200/60 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>

          {/* 매일 새벽 04시 초기화 타이머 뱃지 (하루 1통) */}
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/5 border border-amber-900/15 text-stone-700 text-xs font-serif-warm shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-800" />
            <span>매일 04:00 리셋</span>
            <span className="text-stone-300">·</span>
            <span className="font-mono font-bold text-[#6B1724]">
              {hasMyQuotaBeenUsedToday ? `오늘 작성 완료 (다음 편지까지 ${countdown.formatted})` : `오늘 작성 가능 (${countdown.formatted} 남음)`}
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
                오늘의 교환일기
              </h3>
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-sans-ui truncate">
                {hasIncomingSealedLetter
                  ? `${partnerName} 님이 보낸 비밀 편지 도착`
                  : isMyLetterUnopenedByPartner
                  ? `${partnerName} 님이 아직 편지를 읽지 않음 (미개봉)`
                  : isMyLetterOpenedWaitingReply
                  ? `${partnerName} 님이 편지를 읽음 (답장 대기 중)`
                  : hasMyQuotaBeenUsedToday
                  ? `오늘 나의 온기 작성 완료 (새벽 04시 리셋)`
                  : isMyTurn
                  ? '내가 오늘 편지를 쓸 차례'
                  : `${partnerName} 님의 오늘 작성 차례`}
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-serif-warm font-bold border whitespace-nowrap shrink-0 text-center select-none ${
              hasIncomingSealedLetter
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
              ? '새 편지 도착 📬'
              : isMyLetterUnopenedByPartner
              ? '상대방 미개봉 ✉️'
              : isMyLetterOpenedWaitingReply
              ? '상대방 답장 대기 ⏳'
              : hasMyQuotaBeenUsedToday
              ? '오늘 작성 완료 🌙'
              : isMyTurn
              ? '내 턴 ✍️'
              : '상대방 턴 ⏳'}
          </span>
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
                  {partnerName} 님이 보낸 비밀 편지가 도착했어요!
                </p>
                <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                  관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                soundEngine.playPaperRustle();
                onOpenSealedLetter();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <span>편지 열어보기</span>
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
                    {partnerName} 님이 아직 편지를 읽지 않았어요
                  </p>
                  <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                    내가 보낸 편지가 안전하게 봉인되어 상대방의 확인을 기다리고 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200/60 text-[11px] font-serif-warm text-amber-950 flex items-center gap-1.5">
              <span>💡</span>
              <span>상대방이 편지를 확인하고 답장을 보내기 전까지는 새 일기를 작성할 수 없습니다.</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  soundEngine.playPaperRustle();
                  onOpenDiary();
                }}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs"
              >
                내가 보낸 편지 확인하기
              </button>
              <button
                onClick={handleKnock}
                disabled={knockCooldown}
                className="flex-1 py-2 rounded-xl border border-amber-300 bg-amber-100/70 hover:bg-amber-200/70 text-amber-950 text-xs font-serif-warm font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Bell className="w-3.5 h-3.5 text-amber-800" />
                <span>{knockCooldown ? '노크 전송 완료 ✉️' : '풍경 소리 노크하기'}</span>
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
                    {partnerName} 님이 내가 보낸 편지를 읽었어요!
                  </p>
                  <p className="text-xs text-stone-600 font-serif-warm mt-0.5">
                    소중한 온기가 전해졌습니다. 이제 {partnerName} 님이 답장을 작성할 차례입니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 border border-stone-200/80 text-[11px] font-serif-warm text-stone-600 flex items-center gap-1.5">
              <span>✉️</span>
              <span>교환일기 특성상 상대방의 답장이 서재에 도착한 후에 새 일기를 쓸 수 있습니다.</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  soundEngine.playPaperRustle();
                  onOpenDiary();
                }}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs"
              >
                내가 보낸 편지 다시 읽기
              </button>
              <button
                onClick={handleKnock}
                disabled={knockCooldown}
                className="flex-1 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/60 text-amber-950 text-xs font-serif-warm font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Bell className="w-3.5 h-3.5 text-amber-700" />
                <span>{knockCooldown ? '노크 전송 완료 ✉️' : '풍경 소리 노크하기'}</span>
              </button>
            </div>
          </div>
        ) : isPartnerLetterOpenedByMe && diary ? (
          // 4. 상대방이 보낸 편지를 내가 이미 열어본 상태 (최근 편지 요약 & 내가 답장할 차례)
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E8DFC8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-serif-warm">
                {partnerName} 님이 보낸 최근 편지
              </span>
              {diary.warmthScore && typeof diary.warmthScore.temperature === 'number' && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    diary.warmthScore.temperature <= 0
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
                className="flex-1 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-2xs"
              >
                편지 다시 읽기
              </button>
              {hasMyQuotaBeenUsedToday ? (
                <div
                  title={`오늘 일기는 이미 작성하셨습니다 (하루 각자 1통). 내일 새벽 04:00 이후에 답장을 쓸 수 있습니다. (남은 시간: ${countdown.formatted})`}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 text-xs font-serif-warm font-medium flex items-center justify-center gap-1.5 shadow-2xs select-none"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span className="truncate">04시 리셋 ({countdown.formatted})</span>
                </div>
              ) : isMyTurn ? (
                <button
                  onClick={() => {
                    soundEngine.playTileSlideSound();
                    onOpenWriteModal();
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold cursor-pointer transition-colors shadow-xs"
                >
                  답장 쓰러 가기 ✍️
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          // D. 아직 첫 편지 작성 전 (초기 상태)
          <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-[#E8DFC8] text-center space-y-2.5">
            <p className="font-serif-warm text-stone-800 text-sm font-semibold">
              {isMyTurn
                ? `방에 초대된 ${userName} 님이 첫 편지를 시작할 차례예요.`
                : `${partnerName} 님의 첫 번째 편지를 기다리고 있어요.`}
            </p>
            <p className="text-xs text-stone-500 font-serif-warm">
              서로에게 전하는 첫 온기로 둘만의 교환일기를 환하게 밝혀보세요.
            </p>
            <div className="pt-1">
              {isMyTurn ? (
                <button
                  onClick={() => {
                    soundEngine.playPaperRustle();
                    onOpenWriteModal();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-200" />
                  <span>첫 번째 온기 작성하기</span>
                </button>
              ) : (
                <button
                  onClick={handleKnock}
                  disabled={knockCooldown}
                  className="px-4 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 text-xs font-serif-warm font-semibold shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-700" />
                  <span>{knockCooldown ? '노크 전송 완료 ✉️' : '기다림의 노크 보내기'}</span>
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
                오늘의 추천 글감
              </span>
              <button
                onClick={handleRefreshPrompt}
                disabled={isRefreshingPrompt}
                title="다른 글감 뽑기"
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
              className="w-full py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-serif-warm font-semibold transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1"
            >
              <span>이 글감으로 일기 쓰기</span>
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
                둘만의 서재
              </span>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h4 className="font-serif-warm font-bold text-stone-900 text-base leading-snug">
              함께 쌓아온 온기의 아카이브
            </h4>
            <p className="text-xs text-stone-500 font-serif-warm mt-1 leading-relaxed">
              종단간 암호화로 안전하게 지켜진 둘만의 지난 편지들을 꺼내 읽어보세요.
            </p>
          </div>

          <div className="pt-3">
            <div className="w-full py-2 rounded-xl bg-white group-hover:bg-amber-50/50 border border-stone-200 group-hover:border-amber-300/60 text-stone-700 group-hover:text-amber-950 text-xs font-serif-warm font-semibold transition-colors flex items-center justify-center gap-1 shadow-2xs">
              <span>서재 열람하기</span>
              <BookOpen className="w-3.5 h-3.5 text-[#6B1724]" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4. 기념일 / 시작일 변경 모달 */}
      <AnimatePresence>
        {isDateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8DFC8]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif-warm font-bold text-stone-900 text-base">
                    이어진 시작일 설정
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
                  교환일기를 시작한 날이나 연애를 시작한 기념일 날짜를 지정하세요. D-Day 일수와 기념일이 자동으로 계산됩니다.
                </p>
                <div className="w-full min-w-0">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full max-w-full box-border px-3 sm:px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-sm font-sans-ui focus:outline-none focus:border-[#6B1724] shadow-2xs block"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveAnniversary}
                  disabled={isSavingDate || !customStartDate}
                  className="flex-1 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSavingDate ? '저장 중...' : '적용하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
