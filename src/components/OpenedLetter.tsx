'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DiaryData } from '@/types/diary';
import { Feather, Calendar, Heart, MessageSquareQuote, PenLine } from 'lucide-react';

interface OpenedLetterProps {
  diary: DiaryData;
  onWriteReply: () => void;
  onResetView?: () => void;
}

export default function OpenedLetter({
  diary,
  onWriteReply,
}: OpenedLetterProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto px-4 py-6"
    >
      {/* 양장 다이어리 내지 카드 */}
      <div className="relative bg-[#FFFDF9] rounded-2xl p-6 sm:p-10 paper-texture border border-[#E8DFC8] shadow-2xl overflow-hidden">
        {/* 장식용 종이 가장자리 바인딩 라인 (좌측 가죽 스티치) */}
        <div className="absolute top-0 bottom-0 left-0 w-3 bg-[#EFE6DA] border-r border-[#DECDBB] flex flex-col justify-around py-4">
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#B8A692] mx-auto" />
        </div>

        <div className="pl-4 sm:pl-6">
          {/* 헤더: 날짜와 작성자 */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#EADCCB] text-stone-600 text-xs sm:text-sm font-serif-warm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-800" />
              <span>{new Date(diary.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-stone-500 font-sans-ui text-xs">
              <Feather className="w-3.5 h-3.5 text-stone-600" />
              <span>작성자 <strong>{diary.authorName}</strong></span>
            </div>
          </div>

          {/* 제목 */}
          <div className="my-6">
            <h1 className="font-serif-warm text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-snug">
              {diary.title}
            </h1>
          </div>

          {/* 사진 갤러리 (폴라로이드 스타일) */}
          {diary.photos && diary.photos.length > 0 && (
            <div className="my-6 flex flex-wrap gap-4 justify-center sm:justify-start">
              {diary.photos.map((imgUrl, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.03, rotate: 0 }}
                  className={`polaroid-frame w-48 sm:w-56 transition-transform ${
                    idx % 2 === 0 ? '-rotate-1' : 'rotate-2'
                  }`}
                >
                  <div className="w-full aspect-[4/3] bg-stone-200 overflow-hidden rounded-xs relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={`일기 사진 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="mt-2 text-center font-serif-warm text-[11px] text-stone-500">
                    그날의 한 컷 #{idx + 1}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {/* 일기 본문 텍스트 (줄노트 감성) */}
          <div className="my-6 text-stone-800 font-serif-warm text-base sm:text-lg leading-relaxed whitespace-pre-line tracking-normal">
            {diary.content}
          </div>

          {/* 서로 공유한 미션 & 답변 카드 */}
          {diary.mission && (
            <div className="mt-10 p-5 rounded-xl bg-[#F8F3EA] border border-[#E5DAC8] text-stone-800 font-serif-warm">
              <div className="flex items-center gap-2 mb-2 text-amber-900 text-xs font-sans-ui font-semibold">
                <MessageSquareQuote className="w-4 h-4" />
                <span>오늘의 미션 & 함께 나눈 온기</span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mb-2 italic">
                Q. {diary.mission.prompt}
              </p>
              {diary.mission.submission && (
                <div className="p-3 bg-white/80 rounded-lg border border-[#E0D3BF] text-xs sm:text-sm text-stone-800 font-medium">
                  &ldquo;{diary.mission.submission.text}&rdquo;
                  <span className="block text-right text-[10px] text-stone-400 mt-1">
                    — {diary.recipientName} 작성
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 하단 서명 */}
          <div className="mt-8 pt-4 border-t border-[#EADCCB] flex items-center justify-between text-xs text-stone-500 font-serif-warm">
            <span className="flex items-center gap-1 text-rose-800/80">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>우리의 온기가 이어진 날</span>
            </span>
            <span>溫氣 No. 42</span>
          </div>
        </div>
      </div>

      {/* 하단 턴 액션 버튼 */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onWriteReply}
          className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#6B1724] hover:bg-[#831D2D] active:scale-95 text-amber-50 font-serif-warm text-base font-semibold shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <PenLine className="w-5 h-5 text-amber-200" />
          <span>답장 쓰기 (내 턴 시작하기)</span>
        </button>
      </div>
    </motion.div>
  );
}
