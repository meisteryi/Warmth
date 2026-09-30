'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PenLine, Feather, Sparkles, Heart, BookOpen, Send } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

interface EmptyDeskViewProps {
  partnerName: string;
  userName: string;
  onOpenWriteModal: () => void;
  roomCode: string;
}

export default function EmptyDeskView({
  partnerName,
  userName,
  onOpenWriteModal,
  roomCode,
}: EmptyDeskViewProps) {
  const handleStartWriting = () => {
    soundEngine.playPaperRustle();
    onOpenWriteModal();
  };

  return (
    <div className="relative w-full max-w-lg sm:max-w-xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col items-center justify-center my-auto">
      {/* 상태 안내 뱃지 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 sm:mb-5 text-center"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/10 border border-amber-900/20 text-stone-800 text-xs font-sans-ui mb-2 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
          <span className="font-semibold text-amber-900">새 교환일기장 개시</span>
          <span className="text-stone-400">·</span>
          <span className="font-mono text-stone-600">#{roomCode}</span>
        </div>
        <h2 className="font-serif-warm text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
          첫 번째 온기를 띄워보세요
        </h2>
        <p className="text-stone-600 text-xs sm:text-sm mt-1.5 font-serif-warm max-w-md mx-auto leading-relaxed">
          <strong className="text-[#6B1724]">{partnerName}</strong> 님과의 비밀 교환일기가 열렸습니다.<br className="hidden sm:inline" />
          오늘 있었던 소소한 일이나 전하고 싶었던 진심을 담아 첫 편지를 시작해보세요.
        </p>
      </motion.div>

      {/* 빈티지 양장 편지지 데스크 카드 */}
      <motion.div
        className="relative w-full rounded-3xl p-6 sm:p-9 bg-[#FFFDF9] border border-[#E8DFC8] shadow-2xl overflow-hidden paper-texture"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* 장식용 종이 가장자리 가죽 스티치 라인 */}
        <div className="absolute top-0 bottom-0 left-0 w-3 bg-[#EFE6DA] border-r border-[#DECDBB] flex flex-col justify-around py-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
        </div>

        <div className="pl-3 sm:pl-5 flex flex-col items-center text-center">
          {/* 깃펜 및 실링 아이콘 */}
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-50 border-2 border-dashed border-amber-300 flex items-center justify-center mb-4 shadow-inner group">
            <Feather className="w-8 h-8 sm:w-10 sm:h-10 text-[#6B1724] transform -rotate-12 transition-transform group-hover:rotate-0" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center text-[10px] font-serif-warm font-bold shadow-sm">
              溫
            </div>
          </div>

          <h3 className="font-serif-warm font-bold text-stone-800 text-lg sm:text-xl mb-1.5">
            비어 있는 첫 페이지
          </h3>
          <p className="font-serif-warm text-xs sm:text-sm text-stone-600 max-w-sm mb-6 leading-relaxed">
            내가 첫 편지를 써서 실링 왁스로 봉인하면,<br />
            <span className="text-[#6B1724] font-semibold">{partnerName}</span> 님이 관문 미션을 풀고 편지를 열어보게 됩니다.
          </p>

          {/* 메인 첫 편지 쓰기 버튼 */}
          <button
            type="button"
            onClick={handleStartWriting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 font-serif-warm font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer group"
          >
            <PenLine className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200 group-hover:rotate-12 transition-transform" />
            <span>첫 편지 쓰기</span>
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 opacity-70 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* 소소한 안내 */}
          <div className="mt-5 pt-4 border-t border-[#EAE0D1] w-full flex items-center justify-center gap-4 text-[11px] text-stone-600 font-serif-warm">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              둘만의 1:1 비밀 공간
            </span>
            <span className="text-stone-300">|</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              하루걸러 교환하는 느린 편지
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
