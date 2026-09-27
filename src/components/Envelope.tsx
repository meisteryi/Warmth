'use client';

import React from 'react';
import { motion } from 'framer-motion';
import WaxSeal from './WaxSeal';
import { DiaryData } from '@/types/diary';
import { Mail, Stamp, Sparkles } from 'lucide-react';

interface EnvelopeProps {
  diary: DiaryData;
  isLocked: boolean;
  onOpenMission: () => void;
  onUnsealComplete: () => void;
}

export default function Envelope({
  diary,
  isLocked,
  onOpenMission,
  onUnsealComplete,
}: EnvelopeProps) {
  return (
    <div className="relative w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center">
      {/* 상태 안내 뱃지 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-900/10 border border-amber-900/20 text-stone-800 text-xs font-sans-ui mb-2">
          {isLocked ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
              <span>미션 게이트 대기 중</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="font-semibold text-amber-900">봉인 해제 준비 완료</span>
            </>
          )}
        </div>
        <h2 className="font-serif-warm text-xl sm:text-2xl font-bold text-stone-900">
          {diary.authorName} 님에게서 온 편지
        </h2>
        <p className="text-stone-600 text-xs sm:text-sm mt-1 font-serif-warm">
          {isLocked
            ? '오늘의 미션을 완수하면 실링 왁스의 봉인을 풀 수 있습니다.'
            : '실링 왁스를 3초간 꾹 눌러 봉투를 열어보세요.'}
        </p>
      </motion.div>

      {/* 빈티지 편지 봉투 카드 본체 */}
      <motion.div
        className="relative w-full aspect-[4/3] rounded-2xl envelope-shadow overflow-hidden bg-[#FAF6EE] border border-[#E3DACB]"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* 종이 표면 그레인 & 빈티지 그라데이션 */}
        <div 
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#D6C6B2 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* 앤틱 우표 & 소인 날짜 스탬프 (우측 상단) */}
        <div className="absolute top-4 right-4 flex flex-col items-center select-none pointer-events-none">
          <div className="w-14 h-16 bg-[#FFFDF9] border border-dashed border-[#B89B72] rounded-sm p-1 shadow-sm flex flex-col items-center justify-between">
            <span className="text-[8px] text-stone-400 font-sans tracking-widest uppercase">AIR MAIL</span>
            <Stamp className="w-6 h-6 text-stone-700 opacity-60" />
            <span className="text-[9px] font-serif-warm text-stone-600 font-bold">온기 溫</span>
          </div>
          {/* 동그란 우체국 소인 도장 */}
          <div className="relative -mt-3 -mr-3 w-12 h-12 rounded-full border border-stone-500/40 flex flex-col items-center justify-center -rotate-12 text-[7px] text-stone-600/70 font-mono">
            <span>WARMTH</span>
            <span>26.09.27</span>
            <span>SEOUL</span>
          </div>
        </div>

        {/* 발신 / 수신 라벨 (좌측 상단) */}
        <div className="absolute top-5 left-5 text-left select-none font-serif-warm">
          <p className="text-[11px] text-stone-500 tracking-wider">From.</p>
          <p className="text-sm font-bold text-stone-800 mt-0.5">{diary.authorName}</p>
          <div className="w-16 h-px bg-stone-300 mt-1" />
          <p className="text-[11px] text-stone-500 tracking-wider mt-3">To.</p>
          <p className="text-sm font-bold text-stone-800 mt-0.5">{diary.recipientName}</p>
        </div>

        {/* 봉투 날개 폴딩 섀도우 (하단 & 측면 삼각 폴드 라인) */}
        <div 
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(230, 218, 202, 0.45), transparent)',
          }}
        />
        {/* 대각선 폴드 라인 SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" preserveAspectRatio="none" viewBox="0 0 400 300">
          <path d="M 0,300 L 200,165 L 400,300" fill="none" stroke="#8C7355" strokeWidth="1.5" />
          <path d="M 0,0 L 200,160 L 400,0" fill="none" stroke="#8C7355" strokeWidth="1.5" />
        </svg>

        {/* 봉투 상단 덮개 (삼각형) */}
        <div 
          className="absolute top-0 inset-x-0 h-1/2 pointer-events-none"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            background: 'linear-gradient(180deg, #F3ECE1 0%, #E8DFC8 100%)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
            borderBottom: '1px solid rgba(180, 160, 140, 0.4)',
          }}
        />

        {/* 중앙 실링 왁스 위치 */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pt-4">
          <WaxSeal
            color={diary.waxColor}
            isLocked={isLocked}
            onClickLocked={onOpenMission}
            onBroken={onUnsealComplete}
          />
        </div>
      </motion.div>

      {/* 하단 인터랙션 가이드 */}
      <div className="mt-6 flex flex-col items-center text-center">
        {isLocked ? (
          <button
            onClick={onOpenMission}
            className="px-6 py-2.5 rounded-full bg-[#6B1724] hover:bg-[#851C2C] text-amber-50 font-serif-warm text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            <Mail className="w-4 h-4 text-amber-200" />
            <span>오늘의 미션 확인하고 봉인 풀기</span>
          </button>
        ) : (
          <p className="text-xs text-stone-600 font-sans-ui flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#6B1724]" />
            <span>손가락으로 인장을 <strong>3초 동안 꾹</strong> 누르면 왁스가 부서집니다</span>
          </p>
        )}
      </div>
    </div>
  );
}
