'use client';

import React, { useState, useEffect } from 'react';
import { DiaryData } from '@/types/diary';
import { getRoomDiariesFromFirestore } from '@/lib/roomService';
import { generateFallbackWarmth } from '@/lib/gemini';
import { BookOpen, Calendar, Heart, Sparkles, X, RefreshCw, ChevronRight } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  currentUserName: string;
  partnerName: string;
  onSelectDiary: (diary: DiaryData) => void;
}

export default function ArchiveModal({
  isOpen,
  onClose,
  roomCode,
  currentUserName,
  partnerName,
  onSelectDiary,
}: ArchiveModalProps) {
  const [diaries, setDiaries] = useState<DiaryData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDiaries = async () => {
    if (!roomCode) return;
    setIsLoading(true);
    try {
      const list = await getRoomDiariesFromFirestore(roomCode);
      setDiaries(list);
    } catch (e) {
      console.warn('Failed to fetch archive:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      soundEngine.playPaperRustle();
      fetchDiaries();
    }
  }, [isOpen, roomCode]);

  if (!isOpen) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-[#FAF7F2] rounded-3xl shadow-2xl border border-[#E8DFD3] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#E8DFD3] bg-[#F4EFEA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-serif-warm font-bold text-stone-900">
                둘만의 서재
              </h2>
              <p className="text-xs text-stone-500 font-sans-ui mt-0.5">
                #{roomCode} · {currentUserName} & {partnerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchDiaries}
              disabled={isLoading}
              title="새로고침"
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 일기 목록 영역 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-stone-500 font-serif-warm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#6B1724] mb-2" />
              <p className="text-sm">보관된 일기를 불러오는 중입니다...</p>
            </div>
          ) : diaries.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100/70 text-[#6B1724] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <BookOpen className="w-8 h-8 opacity-80" />
              </div>
              <h3 className="font-serif-warm font-bold text-stone-800 text-base mb-1">
                아직 보관된 일기가 없습니다
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                서로 주고받은 일기가 이곳에 보관됩니다.
              </p>
            </div>
          ) : (
            diaries.map((item) => {
              const isMine = item.authorName === currentUserName;
              const formattedDate = formatDate(item.createdAt);
              const itemWarmth = (item.warmthScore && typeof item.warmthScore.temperature === 'number')
                ? item.warmthScore
                : generateFallbackWarmth(item.title, item.content);

              return (
                <div
                  key={item.diaryId}
                  onClick={() => {
                    soundEngine.playPaperRustle();
                    onSelectDiary(item);
                  }}
                  className="group relative p-4 rounded-2xl bg-white border border-[#E8DFD3] hover:border-[#6B1724]/40 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        {formattedDate}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-serif-warm font-bold border ${
                          isMine
                            ? 'bg-amber-100/80 text-amber-900 border-amber-200'
                            : 'bg-rose-50 text-rose-900 border-rose-200'
                        }`}
                      >
                        {item.authorName}의 기록
                      </span>
                      {itemWarmth && typeof itemWarmth.temperature === 'number' && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold inline-flex items-center gap-1 ${
                          itemWarmth.temperature <= 0
                            ? 'bg-sky-50 text-sky-900 border border-sky-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200/60'
                        }`}>
                          <Sparkles className={`w-3 h-3 ${itemWarmth.temperature <= 0 ? 'text-sky-600' : 'text-amber-600'}`} />
                          {itemWarmth.temperature > 0 ? `+${itemWarmth.temperature.toFixed(1)}` : itemWarmth.temperature.toFixed(1)}°C
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-serif-warm text-[#6B1724] group-hover:translate-x-0.5 transition-transform">
                      <span>열람하기</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-snug group-hover:text-[#6B1724] transition-colors">
                    {item.title || '(제목 없음)'}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-serif-warm">
                    {item.content}
                  </p>

                  {itemWarmth?.keywords && itemWarmth.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {itemWarmth.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-serif-warm"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 하단 닫기 바 (iOS 홈 제스처 바 여백 확보) */}
        <div className="px-5 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] border-t border-[#E8DFD3] bg-[#FAF7F2] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-serif-warm font-bold transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
