'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Feather, Bell, Clock, Compass, Send, CheckCircle2 } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

const KNOCK_PRESETS = [
  '오늘의 교환일기를 기다리고 있어요 ✉️',
  '오늘 하루는 어땠어? 네 이야기가 궁금해 ✨',
  '차 한잔 마시며 편안한 시간에 적어줘 🍵',
];

interface WaitingLetterProps {
  partnerName: string;
  onSendKnock?: (message: string) => Promise<void> | void;
}

export default function WaitingLetter({
  partnerName,
  onSendKnock,
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
    <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full bg-[#FAF6EE] rounded-2xl p-6 sm:p-8 envelope-shadow border border-[#E3DACB] relative overflow-hidden"
      >
        {/* 상단 은은한 펜촉 애니메이션 */}
        <div className="relative w-18 h-18 mx-auto mb-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-900/5 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-[#FFFDF9] border border-[#E0D3C1] shadow-inner flex items-center justify-center">
            <motion.div
              animate={{
                rotate: [0, -12, 10, -5, 0],
                x: [0, -3, 3, -1, 0],
                y: [0, -2, 2, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 4,
                ease: 'easeInOut',
              }}
            >
              <Feather className="w-7 h-7 text-[#6B1724]" />
            </motion.div>
          </div>
        </div>

        {/* 턴 대기 텍스트 */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/10 text-stone-700 text-xs font-sans-ui mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-800 animate-spin" />
          <span>상대방의 턴</span>
        </div>

        <h3 className="font-serif-warm text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
          {partnerName} 님이<br />
          펜을 들고 일기를 적고 있어요
        </h3>

        <p className="mt-2.5 text-stone-600 text-xs sm:text-sm font-serif-warm leading-relaxed">
          오늘의 소중한 일상과 마음에 귀 기울이는 중입니다.<br />
          일기가 도착하면 왁스 봉인과 함께 알려드릴게요.
        </p>

        {/* 빈티지 대기 장식선 */}
        <div className="my-5 flex items-center justify-center gap-2 text-stone-400">
          <span className="w-8 h-px bg-stone-300" />
          <Compass className="w-3.5 h-3.5 text-stone-400" />
          <span className="w-8 h-px bg-stone-300" />
        </div>

        {/* 노크 메시지 선택 영역 */}
        <div className="w-full text-left mb-4 bg-[#F5EFE6]/70 rounded-xl p-3 border border-[#E3DACB]/80">
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700 mb-2">
            <Bell className="w-3.5 h-3.5 text-amber-700" />
            <span>노크 문구 고르기</span>
          </div>
          <div className="space-y-1.5">
            {KNOCK_PRESETS.map((msg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedMessage(msg)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                  selectedMessage === msg
                    ? 'bg-[#6B1724] text-amber-50 font-medium shadow-xs'
                    : 'bg-white/80 hover:bg-white text-stone-700 border border-stone-200/70'
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
          className={`w-full py-3 rounded-xl active:scale-98 text-xs sm:text-sm font-sans-ui font-medium transition-all flex items-center justify-center gap-2 shadow-sm ${
            cooldown > 0
              ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
              : 'bg-[#6B1724] hover:bg-[#58131e] text-[#FFFDF9]'
          }`}
        >
          {cooldown > 0 ? (
            <>
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>노크 전송됨 ({cooldown}초 후 다시 가능)</span>
            </>
          ) : (
            <>
              <Bell className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>{partnerName} 님에게 살포시 노크 보내기</span>
              <Send className="w-3.5 h-3.5 opacity-70" />
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
              className="mt-3 text-[11px] text-amber-900 bg-amber-500/10 rounded-lg py-1.5 px-3 font-serif-warm"
            >
              🔔 {partnerName} 님에게 노크를 보냈습니다. 상대방이 접속하면 은은한 풍경 종소리와 함께 알림이 전달돼요.
            </motion.p>
          ) : (
            <p className="mt-2.5 text-[11px] text-stone-400 font-sans-ui">
              💡 상대방이 웹 앱에 접속해 있거나 접속할 때 실시간 풍경 종소리와 팝업으로 알려줍니다.
            </p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

