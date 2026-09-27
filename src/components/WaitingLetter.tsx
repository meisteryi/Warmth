'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Feather, Bell, Clock, Compass } from 'lucide-react';

interface WaitingLetterProps {
  partnerName: string;
  onSendKnock?: () => void;
}

export default function WaitingLetter({
  partnerName,
  onSendKnock,
}: WaitingLetterProps) {
  return (
    <div className="w-full max-w-md mx-auto px-4 py-12 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full bg-[#FAF6EE] rounded-2xl p-8 sm:p-10 envelope-shadow border border-[#E3DACB] relative overflow-hidden"
      >
        {/* 상단 은은한 펜촉 애니메이션 */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
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
              <Feather className="w-8 h-8 text-[#6B1724]" />
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

        <p className="mt-3 text-stone-600 text-xs sm:text-sm font-serif-warm leading-relaxed">
          오늘의 소중한 일상과 마음에 귀 기울이는 중입니다.<br />
          일기가 봉인되어 도착하면 알림으로 알려드릴게요.
        </p>

        {/* 빈티지 대기 장식선 */}
        <div className="my-6 flex items-center justify-center gap-2 text-stone-400">
          <span className="w-8 h-px bg-stone-300" />
          <Compass className="w-4 h-4 text-stone-400" />
          <span className="w-8 h-px bg-stone-300" />
        </div>

        {/* 노크하기 버튼 */}
        <button
          onClick={onSendKnock}
          className="w-full py-2.5 rounded-xl bg-[#FFFDF9] hover:bg-stone-50 border border-stone-300 active:scale-98 text-xs font-sans-ui font-medium text-stone-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5 text-amber-700" />
          <span>{partnerName} 님에게 살포시 노크 보내기</span>
        </button>
      </motion.div>
    </div>
  );
}
