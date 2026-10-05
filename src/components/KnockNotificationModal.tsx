'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Feather, X, Sparkles } from 'lucide-react';
import { KnockData } from '@/types/diary';

interface KnockNotificationModalProps {
  isOpen: boolean;
  knock: KnockData | null;
  onClose: () => void;
  onWriteDiary: () => void;
}

export default function KnockNotificationModal({
  isOpen,
  knock,
  onClose,
  onWriteDiary,
}: KnockNotificationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && knock && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-4 sm:p-7 shadow-2xl border border-[#E3DACB] text-center relative overflow-hidden my-auto"
          >
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>

          {/* 상단 풍경 종소리 아이콘 애니메이션 */}
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2.5 sm:mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping" />
            <motion.div
              animate={{
                rotate: [0, 15, -12, 10, -6, 0],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: 'easeInOut',
              }}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#FAF4EA] border border-[#E0D3C1] flex items-center justify-center shadow-inner"
            >
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 fill-amber-700/20" />
            </motion.div>
          </div>

          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-800 text-[10px] sm:text-[11px] font-sans-ui mb-1.5">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>풍경 종소리가 울렸어요</span>
          </div>

          <h3 className="font-serif-warm text-lg sm:text-xl font-bold text-stone-900 leading-snug">
            똑똑! {knock.senderName} 님이<br />
            노크를 보냈어요
          </h3>

          {/* 상대방의 전언 메시지 카드 */}
          <div className="mt-2.5 sm:mt-4 p-2.5 sm:p-3.5 bg-[#FAF6EE] rounded-xl border border-[#E5DAC8] text-left">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-stone-500 font-sans-ui mb-1">
              <span className="font-semibold text-stone-700">{knock.senderName} 님의 한마디:</span>
            </div>
            <p className="font-serif-warm text-xs sm:text-sm text-stone-800 leading-relaxed italic">
              &ldquo;{knock.message}&rdquo;
            </p>
          </div>

          <p className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-stone-500 font-sans-ui leading-tight">
            기다리고 있는 {knock.senderName} 님에게 오늘의 다정한 일기를 선물해보세요.
          </p>

          {/* 하단 액션 버튼 */}
          <div className="mt-3.5 sm:mt-5 space-y-1.5 sm:space-y-2">
            <button
              onClick={() => {
                onClose();
                onWriteDiary();
              }}
              className="w-full py-2.5 sm:py-3 rounded-xl bg-[#6B1724] hover:bg-[#58131e] active:scale-98 text-[#FFFDF9] text-xs sm:text-sm font-sans-ui font-medium shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Feather className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200" />
              <span>지금 답장 일기 쓰기</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-sans-ui text-stone-500 hover:text-stone-700 transition-colors"
            >
              나중에 작성할게요
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
}
