'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Feather, Bell, Clock, Compass, Send, CheckCircle2, Calendar } from 'lucide-react';
import { soundEngine } from '@/lib/audio';
import { formatTodayKorean } from '@/lib/dateUtils';

const KNOCK_PRESETS = [
  '오늘의 교환일기를 기다리고 있어요 ✉️',
  '오늘 하루는 어땠어? 네 이야기가 궁금해 ✨',
  '차 한잔 마시며 편안한 시간에 적어줘 🍵',
];

interface WaitingLetterProps {
  partnerName: string;
  onSendKnock?: (message: string) => Promise<void> | void;
  onGoHome?: () => void;
}

export default function WaitingLetter({
  partnerName,
  onSendKnock,
  onGoHome,
}: WaitingLetterProps) {
  const [selectedMessage, setSelectedMessage] = useState(KNOCK_PRESETS[0]);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleKnock = async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    soundEngine.playWindChimeKnock();

    try {
      if (onSendKnock) {
        await onSendKnock(selectedMessage);
      }
      setJustSent(true);
      setCooldown(20); // 20초 쿨다운
      setTimeout(() => setJustSent(false), 4000);
    } catch (e) {
      console.warn('Knock failed:', e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-sm sm:max-w-md mx-auto px-3 sm:px-4 py-1 sm:py-6 flex flex-col items-center text-center my-auto"
    >
      <div
        className="w-full bg-[#FAF6EE] rounded-2xl p-4 sm:p-7 envelope-shadow border border-[#E3DACB] relative overflow-hidden"
      >
        {/* 상단 은은한 펜촉 애니메이션 */}
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2.5 sm:mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-900/5 animate-ping" />
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#FFFDF9] border border-[#E0D3C1] shadow-inner flex items-center justify-center">
            <motion.div
              animate={{
                rotate: [0, -12, 10, -5, 0],
                x: [0, -2, 2, -1, 0],
                y: [0, -1, 1, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 4,
                ease: 'easeInOut',
              }}
            >
              <Feather className="w-5 h-5 sm:w-6 sm:h-6 text-[#6B1724]" />
            </motion.div>
          </div>
        </div>

        {/* 턴 대기 & 오늘 날짜 텍스트 */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-900/10 text-stone-700 text-[11px] sm:text-xs font-sans-ui">
            <Clock className="w-3 h-3 text-amber-800 animate-spin" />
            <span>상대방의 턴</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 border border-[#DECDBB] text-stone-600 text-[11px] sm:text-xs font-serif-warm shadow-2xs">
            <Calendar className="w-3 h-3 text-amber-800" />
            <span>오늘 {formatTodayKorean(new Date(), false)}</span>
          </div>
        </div>

        <h3 className="font-serif-warm text-xl sm:text-2xl font-bold text-stone-900 leading-tight">
          {partnerName} 님이<br />
          일기를 적고 있어요
        </h3>

        <p className="mt-2 text-stone-600 text-sm sm:text-base font-serif-warm leading-snug font-medium">
          편지가 도착하면 실링 왁스와 함께 알려드릴게요.
        </p>

        {/* 빈티지 대기 장식선 */}
        <div className="my-3 sm:my-4 flex items-center justify-center gap-2 text-stone-400">
          <span className="w-8 sm:w-10 h-px bg-stone-300" />
          <Compass className="w-3.5 h-3.5 text-stone-400" />
          <span className="w-8 sm:w-10 h-px bg-stone-300" />
        </div>

        {/* 노크 메시지 선택 영역 */}
        <div className="w-full text-left mb-3 sm:mb-4 bg-[#F5EFE6]/80 rounded-xl p-3 border border-[#E3DACB]/80">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-700 mb-2 font-sans-ui">
            <Bell className="w-3.5 h-3.5 text-amber-700" />
            <span>노크 문구 고르기</span>
          </div>
          <div className="space-y-1.5">
            {KNOCK_PRESETS.map((msg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedMessage(msg)}
                className={`w-full text-left px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm transition-all flex items-center justify-between font-sans-ui cursor-pointer ${
                  selectedMessage === msg
                    ? 'bg-[#6B1724] text-amber-50 font-bold shadow-xs'
                    : 'bg-white/90 hover:bg-white text-stone-700 border border-stone-200/70 font-medium'
                }`}
              >
                <span className="truncate pr-2">{msg}</span>
                {selectedMessage === msg && <CheckCircle2 className="w-3.5 h-3.5 text-amber-200 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* 노크하기 버튼 */}
        <button
          onClick={handleKnock}
          disabled={cooldown > 0 || isSending}
          className={`w-full py-3 sm:py-3.5 rounded-xl active:scale-98 text-sm sm:text-base font-sans-ui font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
            cooldown > 0
              ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
              : 'bg-[#6B1724] hover:bg-[#58131e] text-[#FFFDF9]'
          }`}
        >
          {cooldown > 0 ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>노크 전송됨 ({cooldown}초 대기)</span>
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>{partnerName} 님에게 노크 보내기</span>
              <Send className="w-3.5 h-3.5 opacity-75" />
            </>
          )}
        </button>

        {/* 전송 성공 및 실시간 안내 피드백 */}
        <AnimatePresence>
          {justSent ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2.5 text-xs text-amber-900 bg-amber-500/10 rounded-lg py-1.5 px-3 font-serif-warm font-medium"
            >
              🔔 {partnerName} 님에게 노크 알림을 전했습니다.
            </motion.p>
          ) : (
            <p className="mt-2 text-xs text-stone-400 font-sans-ui">
              상대방이 접속하면 풍경 종소리와 함께 알림이 뜹니다.
            </p>
          )}
        </AnimatePresence>

        {/* 홈 화면으로 돌아가기 버튼 */}
        {onGoHome && (
          <div className="mt-4 pt-3 border-t border-[#E3DACB]/60">
            <button
              type="button"
              onClick={onGoHome}
              className="w-full py-2.5 rounded-xl border border-stone-300 hover:bg-white text-stone-700 text-xs font-serif-warm font-semibold transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              ← 홈 화면으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

