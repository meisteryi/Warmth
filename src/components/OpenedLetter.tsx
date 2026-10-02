'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DiaryData } from '@/types/diary';
import { generateFallbackWarmth } from '@/lib/gemini';
import { Feather, Calendar, Heart, MessageSquareQuote, PenLine, ThermometerSun, ThermometerSnowflake } from 'lucide-react';

interface OpenedLetterProps {
  diary: DiaryData;
  onWriteReply: () => void;
  onResetView?: () => void;
}

export default function OpenedLetter({
  diary,
  onWriteReply,
  onResetView,
}: OpenedLetterProps) {
  const warmth = (diary.warmthScore && typeof diary.warmthScore.temperature === 'number')
    ? diary.warmthScore
    : generateFallbackWarmth(diary.title, diary.content);
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
              <span suppressHydrationWarning>{new Date(diary.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}</span>
            </div>
            <div className="flex items-center gap-3">
              {diary.stamp && diary.stamp.style !== 'EMOJI_TITLE' && (
                <div 
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed text-xs font-serif-warm select-none rotate-[-2deg] shadow-2xs"
                  style={{
                    borderColor: diary.stamp.color || '#A83232',
                    color: diary.stamp.color || '#A83232',
                    backgroundColor: `${diary.stamp.color || '#A83232'}10`,
                  }}
                  title={`오늘의 날씨·기분 도장: ${diary.stamp.name}`}
                >
                  <span className="text-xs">{diary.stamp.symbol}</span>
                  <span className="font-semibold text-[10px] tracking-wide">{diary.stamp.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-stone-500 font-sans-ui text-xs">
                <Feather className="w-3.5 h-3.5 text-stone-600" />
                <span>작성자 <strong>{diary.authorName}</strong></span>
              </div>
            </div>
          </div>

          {/* 제목 및 스티커 */}
          <div className="my-6 relative">
            {diary.stamp && diary.stamp.style === 'EMOJI_TITLE' && (
              <motion.div
                initial={{ scale: 0, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: -10, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                className="absolute -top-7 -left-3 sm:-top-8 sm:-left-4 text-4xl sm:text-5xl select-none pointer-events-none z-10 filter drop-shadow-md"
                title={`오늘의 감정 스티커: ${diary.stamp.name}`}
              >
                <span>{diary.stamp.symbol}</span>
              </motion.div>
            )}
            <h1 className={`font-serif-warm text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-snug ${
              diary.stamp?.style === 'EMOJI_TITLE' ? 'pt-2 sm:pt-1 pl-8 sm:pl-9' : ''
            }`}>
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

          {/* AI 온기 온도계 & 감정 날씨 배지 (편지 내용 밑으로 이동) */}
          {warmth && typeof warmth.temperature === 'number' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`my-6 p-3.5 sm:p-4 rounded-xl border shadow-xs ${
                warmth.temperature <= 0
                  ? 'bg-gradient-to-r from-[#F0F7FF] via-[#F8FBFF] to-[#FAF7F2] border-[#D0E2F5]'
                  : 'bg-gradient-to-r from-[#FFF7ED] via-[#FDF8F3] to-[#F7EDE2] border-[#ECDCCB]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EBD6C2]/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-2xs shrink-0 ${
                      warmth.temperature <= 0
                        ? 'bg-sky-100/90 border-sky-200/80 text-sky-800'
                        : 'bg-rose-100/90 border-rose-200/80 text-rose-800'
                    }`}
                  >
                    {warmth.temperature <= 0 ? (
                      <ThermometerSnowflake className="w-4 h-4" />
                    ) : (
                      <ThermometerSun className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-sans-ui text-stone-500 font-semibold tracking-wider">
                        오늘의 온기 온도
                      </span>
                      <span
                        className={`text-xs font-serif-warm font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                          warmth.temperature <= 0
                            ? 'text-sky-900 bg-sky-50 border-sky-200'
                            : 'text-rose-900 bg-rose-50 border-rose-200'
                        }`}
                      >
                        {warmth.temperature > 0 ? `+${warmth.temperature}` : warmth.temperature}°C
                      </span>
                    </div>
                    {warmth.comment && (
                      <p className="text-xs sm:text-sm font-serif-warm text-stone-700 mt-0.5 font-medium">
                        &ldquo;{warmth.comment}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {warmth.keywords && warmth.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
                  <span className="text-[10px] font-sans-ui text-stone-400">마음 키워드:</span>
                  {warmth.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/90 border border-[#DFCEBA] text-[11px] font-serif-warm text-stone-600 shadow-2xs"
                    >
                      {kw.startsWith('#') ? kw : `#${kw}`}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

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

      {/* 하단 턴 액션 버튼 (iOS 하단 제스처 여백 확보) */}
      <div className="mt-8 mb-6 pb-[max(env(safe-area-inset-bottom,0px),1rem)] flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        {onResetView && (
          <button
            onClick={onResetView}
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white hover:bg-stone-50 active:scale-95 text-stone-700 font-serif-warm text-sm font-semibold border border-stone-300 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>← 홈 화면으로</span>
          </button>
        )}
        <button
          onClick={onWriteReply}
          className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#6B1724] hover:bg-[#831D2D] active:scale-95 text-amber-50 font-serif-warm text-base font-semibold shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <PenLine className="w-5 h-5 text-amber-200" />
          <span>답장 쓰기 (내 턴 시작하기)</span>
        </button>
      </div>
    </motion.div>
  );
}
