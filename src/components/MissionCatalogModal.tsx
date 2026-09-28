'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SYSTEM_MISSIONS, SystemMissionItem } from '@/data/missions';
import { 
  X, 
  Scroll, 
  Heart, 
  Camera, 
  HelpCircle, 
  Mic, 
  CheckCircle2 
} from 'lucide-react';

interface MissionCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMission?: (mission: SystemMissionItem) => void;
}

export default function MissionCatalogModal({
  isOpen,
  onClose,
  onSelectMission,
}: MissionCatalogModalProps) {
  const [filter, setFilter] = useState<'ALL' | 'EMOTION' | 'DAILY' | 'QUIZ' | 'REVIEW'>('ALL');

  const filteredMissions = SYSTEM_MISSIONS.filter((item) => {
    if (filter === 'ALL') return true;
    return item.category === filter;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'EMOTION': return <Heart className="w-3.5 h-3.5 text-rose-600" />;
      case 'DAILY': return <Camera className="w-3.5 h-3.5 text-sky-600" />;
      case 'QUIZ': return <HelpCircle className="w-3.5 h-3.5 text-amber-600" />;
      case 'REVIEW': return <Mic className="w-3.5 h-3.5 text-emerald-600" />;
      default: return null;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'TEXT': return '✍️ 텍스트 쪽지';
      case 'PHOTO': return '📷 사진 인증';
      case 'QUIZ': return '❓ 퀴즈 풀기';
      case 'VOICE': return '🎙️ 3초 음성';
      default: return '텍스트';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl my-8 bg-[#FFFDF9] rounded-2xl p-6 sm:p-8 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900 max-h-[85vh] flex flex-col"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 */}
            <div className="flex items-center gap-2.5 mb-4 shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#6B1724]/10 border border-[#6B1724]/20 flex items-center justify-center text-[#6B1724]">
                <Scroll className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-sans-ui text-[#6B1724] font-semibold tracking-wider uppercase">
                  DAILY MISSION GUIDE
                </span>
                <h2 className="font-serif-warm text-xl font-bold text-stone-900">
                  데일리 미션 도감 (요일별 로테이션)
                </h2>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 font-serif-warm mb-5 shrink-0">
              일기를 열람하기 전, 서로의 일상과 마음을 나누는 12가지 감성 미션 목록입니다.
            </p>

            {/* 필터 탭 */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 shrink-0 text-xs font-sans-ui">
              {[
                { id: 'ALL', label: '전체 (12)' },
                { id: 'EMOTION', label: '월/화 (감정·애정)' },
                { id: 'DAILY', label: '수/목 (시선·일상)' },
                { id: 'QUIZ', label: '금/토 (퀴즈·추억)' },
                { id: 'REVIEW', label: '일 (회고·음성)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                    filter === tab.id
                      ? 'border-[#6B1724] bg-[#6B1724]/10 text-[#6B1724] font-bold shadow-xs'
                      : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 미션 카드 리스트 (스크롤) */}
            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {filteredMissions.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#FAF6EE] border border-[#EADECE] hover:border-amber-400/80 transition-all text-left flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans-ui font-semibold border ${item.badgeColor}`}>
                        {getCategoryIcon(item.category)}
                        <span>{item.days} · {item.categoryLabel}</span>
                      </span>
                      <span className="text-[11px] font-sans-ui text-stone-500">
                        {getTypeName(item.type)}
                      </span>
                    </div>

                    {onSelectMission && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMission(item);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 hover:bg-[#6B1724] hover:text-white hover:border-[#6B1724] text-[11px] font-serif-warm transition-all flex items-center gap-1 active:scale-95"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>이 미션 선택</span>
                      </button>
                    )}
                  </div>

                  <h3 className="font-serif-warm text-sm sm:text-base font-bold text-stone-900 leading-snug">
                    &ldquo;{item.prompt}&rdquo;
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 font-serif-warm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            {/* 하단 닫기 */}
            <div className="mt-4 pt-3 border-t border-stone-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-sans-ui font-medium text-stone-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
