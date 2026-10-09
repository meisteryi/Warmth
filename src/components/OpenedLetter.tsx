'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryData, DiaryReaction, sanitizeDiaryReaction } from '@/types/diary';
import { generateFallbackWarmth } from '@/lib/gemini';
import { Feather, Calendar, Heart, MessageSquareQuote, PenLine, ThermometerSun, ThermometerSnowflake, Edit3, Check, X, Smile, Sparkles, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { updateDiaryDateInFirestore, updateDiaryReactionInFirestore } from '@/lib/roomService';
import { soundEngine } from '@/lib/audio';
import { forceScrollToTop } from '@/lib/scrollUtils';

interface OpenedLetterProps {
  diary: DiaryData;
  onWriteReply: () => void;
  onResetView?: () => void;
  userName?: string;
  roomCode?: string;
  onUpdateDiaryDate?: (diaryId: string, newIsoDate: string) => void;
  onUpdateDiaryReaction?: (diaryId: string, reaction: DiaryReaction | null) => void;
}

export default function OpenedLetter({
  diary,
  onWriteReply,
  onResetView,
  userName,
  roomCode,
  onUpdateDiaryDate,
  onUpdateDiaryReaction,
}: OpenedLetterProps) {
  const { language, t } = useLanguage();
  const isAuthor = Boolean(userName && diary.authorName === userName);
  const [currentDiaryDate, setCurrentDiaryDate] = useState<string>(diary.createdAt);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState<string>(() => {
    try {
      const d = new Date(diary.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  });
  const [isSavingDate, setIsSavingDate] = useState(false);

  // 포스트잇 이모티콘 + 20자 한 줄 코멘트 반응 상태 (해당 일기만의 독립된 반응 동기화)
  const [currentReaction, setCurrentReaction] = useState<DiaryReaction | null>(() => {
    return sanitizeDiaryReaction(diary).reaction || null;
  });
  const [isReactionModalOpen, setIsReactionModalOpen] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState(() => diary.reaction?.emoji || '❤️');
  const [reactionComment, setReactionComment] = useState(() => diary.reaction?.comment || '');
  const [isSavingReaction, setIsSavingReaction] = useState(false);

  // 일기(편지) 화면 열람 시 외부/이전 화면의 스크롤 위치가 승계되지 않도록 상단(0px)으로 초기화
  useEffect(() => {
    const cleanup = forceScrollToTop();
    return cleanup;
  }, [diary.diaryId]);

  useEffect(() => {
    setCurrentDiaryDate(diary.createdAt);
    try {
      const d = new Date(diary.createdAt);
      setEditDateValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } catch { }
  }, [diary.createdAt]);

  // 일기가 전환(diaryId 변경)되거나 해당 일기의 반응 prop이 변경되었을 때만 동기화
  useEffect(() => {
    const sanitized = sanitizeDiaryReaction(diary);
    setCurrentReaction(sanitized.reaction || null);
    if (sanitized.reaction) {
      setReactionEmoji(sanitized.reaction.emoji || '❤️');
      setReactionComment(sanitized.reaction.comment || '');
    } else {
      setReactionEmoji('❤️');
      setReactionComment('');
    }
  }, [diary.diaryId, diary.reaction]);

  const handleSaveReaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reactionEmoji.trim() || isSavingReaction) return;
    setIsSavingReaction(true);
    const newReaction: DiaryReaction = {
      emoji: reactionEmoji.trim(),
      comment: reactionComment.trim() ? reactionComment.trim().slice(0, 20) : undefined,
      reactorName: userName || (language === 'en' ? 'Partner' : '상대방'),
      reactedAt: new Date().toISOString(),
    };

    try {
      setCurrentReaction(newReaction);
      setIsReactionModalOpen(false);
      soundEngine.playMissionPassChime();

      if (roomCode) {
        await updateDiaryReactionInFirestore(roomCode, diary.diaryId, newReaction);
      }
      onUpdateDiaryReaction?.(diary.diaryId, newReaction);
    } catch (err) {
      console.warn('Failed to update diary reaction:', err);
    } finally {
      setIsSavingReaction(false);
    }
  };

  const handleRemoveReaction = async () => {
    if (isSavingReaction) return;
    setIsSavingReaction(true);
    try {
      setCurrentReaction(null);
      setIsReactionModalOpen(false);
      soundEngine.playPaperRustle();

      if (roomCode) {
        await updateDiaryReactionInFirestore(roomCode, diary.diaryId, null);
      }
      onUpdateDiaryReaction?.(diary.diaryId, null);
    } catch (err) {
      console.warn('Failed to remove diary reaction:', err);
    } finally {
      setIsSavingReaction(false);
    }
  };

  const handleOpenReactionModal = () => {
    if (currentReaction) {
      setReactionEmoji(currentReaction.emoji || '❤️');
      setReactionComment(currentReaction.comment || '');
    } else {
      setReactionEmoji('❤️');
      setReactionComment('');
    }
    setIsReactionModalOpen(true);
  };

  const formatReactionTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${m}월 ${day}일 ${h}:${min}`;
    } catch {
      return '';
    }
  };

  const handleSaveDate = async () => {
    if (!editDateValue || isSavingDate) return;
    setIsSavingDate(true);
    try {
      if (roomCode) {
        const res = await updateDiaryDateInFirestore(roomCode, diary.diaryId, editDateValue, diary.authorName);
        if (res.success) {
          setCurrentDiaryDate(res.newIsoDate);
          onUpdateDiaryDate?.(diary.diaryId, res.newIsoDate);
          soundEngine.playPaperRustle();
          setIsEditingDate(false);
        } else {
          soundEngine.playTileSlideSound();
          alert(language === 'en' ? 'Failed to update date. Please try again.' : '날짜 수정에 실패했습니다. 다시 시도해 주세요.');
        }
      } else {
        const parts = editDateValue.split('-').map(Number);
        const targetDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        const iso = targetDate.toISOString();
        setCurrentDiaryDate(iso);
        onUpdateDiaryDate?.(diary.diaryId, iso);
        soundEngine.playPaperRustle();
        setIsEditingDate(false);
      }
    } catch (e) {
      console.warn('Failed to update diary date:', e);
      soundEngine.playTileSlideSound();
      alert(language === 'en' ? 'Failed to update date. Please try again.' : '날짜 수정에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSavingDate(false);
    }
  };

  const warmth = (diary.warmthScore && typeof diary.warmthScore.temperature === 'number')
    ? diary.warmthScore
    : generateFallbackWarmth(diary.title, diary.content);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
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
          <div className="pb-4 border-b border-[#EADCCB] text-stone-600 text-xs sm:text-sm font-serif-warm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-800" />
                  <span suppressHydrationWarning>{new Date(currentDiaryDate).toLocaleDateString(language === 'en' ? 'en-US' : 'ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}</span>
                </div>

                {isAuthor && !isEditingDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDate(true);
                      soundEngine.playTileSlideSound();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 hover:bg-amber-100 text-stone-600 hover:text-amber-950 border border-stone-200 hover:border-amber-300 text-[11px] font-sans-ui font-medium transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                    title={language === 'en' ? 'Edit Diary Date' : '작성 날짜 수정'}
                  >
                    <Edit3 className="w-3 h-3 text-[#6B1724]" />
                    <span>{language === 'en' ? 'Edit Date' : '날짜 수정'}</span>
                  </button>
                )}
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
                  <span>{language === 'en' ? 'By ' : '작성자 '}<strong>{diary.authorName}</strong></span>
                </div>
              </div>
            </div>

            {/* 작성자 날짜 사후 수정 에디터 */}
            {isAuthor && isEditingDate && (
              <div className="w-full mt-2.5 p-2.5 bg-amber-50/80 border border-amber-200/90 rounded-xl flex flex-wrap items-center gap-2 text-xs font-sans-ui">
                <span className="font-semibold text-stone-700">{language === 'en' ? 'Change Date:' : '날짜 변경:'}</span>
                <input
                  type="date"
                  value={editDateValue}
                  onChange={(e) => setEditDateValue(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#6B1724] cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                      setEditDateValue(todayStr);
                      soundEngine.playTileSlideSound();
                    }}
                    className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 text-[11px] font-medium cursor-pointer"
                  >
                    {language === 'en' ? 'Today' : '오늘'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                      setEditDateValue(yStr);
                      soundEngine.playTileSlideSound();
                    }}
                    className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 text-[11px] font-medium cursor-pointer"
                  >
                    {language === 'en' ? 'Yesterday' : '어제'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    disabled={isSavingDate}
                    onClick={handleSaveDate}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#6B1724] hover:bg-[#851E2E] text-amber-50 font-bold text-xs cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingDate ? (language === 'en' ? 'Saving...' : '저장 중') : (language === 'en' ? 'Save' : '저장')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingDate(false);
                      soundEngine.playTileSlideSound();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-200/80 hover:bg-stone-300/80 text-stone-700 text-xs cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Cancel' : '취소'}</span>
                  </button>
                </div>
              </div>
            )}
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
            <h1 className={`font-serif-warm text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-snug ${diary.stamp?.style === 'EMOJI_TITLE' ? 'pt-2 sm:pt-1 pl-8 sm:pl-9' : ''
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
                  className={`polaroid-frame w-48 sm:w-56 transition-transform ${idx % 2 === 0 ? '-rotate-1' : 'rotate-2'
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

          {/* =============================================================== */}
          {/* 포스트잇 반응 표시 (일기 본문과 온기 온도 사이) */}
          {/* =============================================================== */}
          {currentReaction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: -1 }}
              className="relative my-6 max-w-sm ml-auto mr-1 sm:mr-3 p-4 sm:p-4.5 rounded-xs bg-gradient-to-br from-[#FFFDE6] via-[#FEF9C3] to-[#FEF08A]/90 border border-[#FDE68A] shadow-md shadow-amber-950/10 transition-transform hover:rotate-0"
            >
              {/* 포스트잇 상단 반투명 마스킹 테이프 효과 */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-white/75 border border-white/90 shadow-2xs backdrop-blur-2xs rotate-1 pointer-events-none" />

              <div className="flex items-start gap-3">
                {/* 이모티콘 */}
                <span className="text-3xl sm:text-4xl shrink-0 select-none leading-none pt-0.5">
                  {currentReaction.emoji}
                </span>

                {/* 코멘트 및 서명 */}
                <div className="min-w-0 flex-1">
                  {currentReaction.comment ? (
                    <p className="text-sm font-serif-warm font-semibold text-stone-800 leading-snug break-keep select-text">
                      {currentReaction.comment}
                    </p>
                  ) : (
                    <p className="text-xs font-serif-warm text-stone-600">
                      {currentReaction.reactorName}님의 마음 반응
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] font-sans-ui text-stone-500">
                    <span className="truncate">
                      — {currentReaction.reactorName}
                      {currentReaction.reactedAt && ` · ${formatReactionTime(currentReaction.reactedAt)}`}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={handleOpenReactionModal}
                        className="text-[11px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
                      >
                        {language === 'en' ? 'Edit' : '수정'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveReaction}
                        disabled={isSavingReaction}
                        className="text-[11px] text-stone-400 hover:text-rose-500 underline cursor-pointer"
                      >
                        {language === 'en' ? 'Remove' : '떼기'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 온도 위에 눈에 띄지 않게 조용한 텍스트로 '반응 추가하기+' */}
          <div className="flex justify-end items-center mb-1.5 -mt-2">
            <button
              type="button"
              onClick={handleOpenReactionModal}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors font-serif-warm cursor-pointer select-none py-0.5"
            >
              {currentReaction ? (language === 'en' ? 'Edit reaction' : '반응 수정하기') : (language === 'en' ? 'Add reaction +' : '반응 추가하기+')}
            </button>
          </div>

          {/* AI 온기 온도계 & 감정 날씨 배지 (편지 내용 밑으로 이동) */}
          {warmth && typeof warmth.temperature === 'number' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`my-6 p-3.5 sm:p-4 rounded-xl border shadow-xs ${warmth.temperature <= 0
                ? 'bg-gradient-to-r from-[#F0F7FF] via-[#F8FBFF] to-[#FAF7F2] border-[#D0E2F5]'
                : 'bg-gradient-to-r from-[#FFF7ED] via-[#FDF8F3] to-[#F7EDE2] border-[#ECDCCB]'
                }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#EBD6C2]/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-2xs shrink-0 ${warmth.temperature <= 0
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
                        {language === 'en' ? "Today's Temperature" : '오늘의 온도'}
                      </span>
                      <span
                        className={`text-xs font-serif-warm font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${warmth.temperature <= 0
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
                  <span className="text-[10px] font-sans-ui text-stone-400">{language === 'en' ? 'Keywords:' : '마음 키워드:'}</span>
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
                <span>{language === 'en' ? 'Mission' : '오늘의 미션'}</span>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 mb-2 italic">
                Q. {diary.mission.prompt}
              </p>
              {diary.mission.submission && (
                <div className="p-3 bg-white/80 rounded-lg border border-[#E0D3BF] text-xs sm:text-sm text-stone-800 font-medium">
                  &ldquo;{diary.mission.submission.text}&rdquo;
                  <span className="block text-right text-[10px] text-stone-400 mt-1">
                    {language === 'en' ? `— By ${diary.recipientName}` : `— ${diary.recipientName} 작성`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 하단 서명 */}
          <div className="mt-8 pt-4 border-t border-[#EADCCB] flex items-center justify-between text-xs text-stone-500 font-serif-warm">
            <span className="flex items-center gap-1 text-rose-800/80">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>{language === 'en' ? 'A Day Connected in Warmth' : '우리의 온기가 이어진 날'}</span>
            </span>
            <span>溫氣</span>
          </div>
        </div>
      </div>

      {/* 하단 턴 액션 버튼 (iOS 하단 제스처 여백 확보) */}
      <div className="mt-8 mb-6 pb-[max(env(safe-area-inset-bottom,0px),1rem)] flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        {onResetView && (
          <button
            onClick={onResetView}
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white hover:bg-stone-50 active:scale-95 text-stone-700 font-serif-warm text-sm font-semibold border border-stone-300 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <span>{t('opened.backHome')}</span>
          </button>
        )}
        {isAuthor ? (
          <div className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-serif-warm text-sm font-medium flex items-center justify-center gap-2 select-none shadow-xs whitespace-nowrap">
            <span className="truncate">{t('opened.waitingReply', { name: diary.recipientName })}</span>
          </div>
        ) : (
          <button
            onClick={onWriteReply}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#6B1724] hover:bg-[#831D2D] active:scale-95 text-amber-50 font-serif-warm text-base font-semibold shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PenLine className="w-5 h-5 text-amber-200" />
            <span>{t('opened.replyBtn')}</span>
          </button>
        )}
      </div>

      {/* =============================================================== */}
      {/* 포스트잇 반응 입력 모달 (이모티콘 하나 + 20자 이내 한 줄 코멘트) */}
      {/* =============================================================== */}
      <AnimatePresence>
        {isReactionModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs"
            onClick={() => setIsReactionModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12, rotate: -1.5 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-gradient-to-br from-[#FFFDE6] via-[#FEF9C3] to-[#FEF08A]/95 rounded-xs border border-[#FDE68A] shadow-2xl p-5 sm:p-6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 포스트잇 상단 반투명 마스킹 테이프 장식 */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-4 bg-white/80 border border-white/90 shadow-2xs backdrop-blur-2xs rotate-0.5 pointer-events-none" />

              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#FDE68A]/80">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📌</span>
                  <h3 className="font-serif-warm font-bold text-stone-800 text-base">
                    {language === 'en' ? 'Stick a Note' : '포스트잇 남기기'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReactionModalOpen(false)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveReaction} className="space-y-4">
                {/* 1. 이모티콘 입력 (직접 입력 가능 + 빠른 추천 칩) */}
                <div>
                  <label className="block text-xs font-serif-warm font-semibold text-stone-700 mb-1.5">
                    {language === 'en' ? 'Emoji' : '이모티콘 하나'}
                  </label>
                  <div className="flex items-center gap-3">
                    {/* 직접 이모티콘 입력 필드 */}
                    <input
                      type="text"
                      value={reactionEmoji}
                      onChange={(e) => setReactionEmoji(e.target.value.trim())}
                      placeholder="❤️"
                      className="w-14 h-14 text-3xl text-center bg-white/95 border border-[#FDE68A] rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-[#8A5A44]/40 text-stone-800 shrink-0 font-sans"
                    />
                    {/* 빠른 1-클릭 추천 이모지 칩 */}
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {['❤️', '🥰', '🥹', '😊', '🌿', '☕', '🍰', '💌'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setReactionEmoji(emoji)}
                          className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${
                            reactionEmoji === emoji
                              ? 'bg-amber-200 border border-amber-400 scale-110 shadow-xs'
                              : 'bg-white/80 hover:bg-white border border-[#FDE68A]/80'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 font-sans-ui mt-1">
                    {language === 'en' ? 'Type any emoji or pick one above' : '원하는 이모티콘을 직접 입력하거나 선택하세요'}
                  </p>
                </div>

                {/* 2. 20자 이내의 간단한 한 줄 코멘트 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-serif-warm font-semibold text-stone-700">
                      {language === 'en' ? 'Short Note (within 20 chars)' : '한 줄 코멘트 (20자 이내)'}
                    </label>
                    <span className={`text-[11px] font-sans-ui ${reactionComment.length >= 20 ? 'text-rose-500 font-bold' : 'text-stone-400'}`}>
                      {reactionComment.length}/20자
                    </span>
                  </div>
                  <input
                    type="text"
                    value={reactionComment}
                    maxLength={20}
                    onChange={(e) => setReactionComment(e.target.value.slice(0, 20))}
                    placeholder={language === 'en' ? 'e.g. Good job today!' : '예: 오늘도 고생 많았어 토닥토닥'}
                    className="w-full px-3.5 py-2.5 bg-white/95 border border-[#FDE68A] rounded-xl text-stone-800 placeholder-stone-400 font-serif-warm text-sm focus:outline-none focus:ring-2 focus:ring-[#8A5A44]/40 shadow-inner"
                  />
                </div>

                {/* 하단 액션 버튼 */}
                <div className="pt-2 flex items-center justify-between">
                  {currentReaction ? (
                    <button
                      type="button"
                      onClick={handleRemoveReaction}
                      disabled={isSavingReaction}
                      className="text-xs text-rose-500 hover:text-rose-700 underline font-serif-warm cursor-pointer"
                    >
                      {language === 'en' ? 'Remove note' : '포스트잇 떼기'}
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReactionModalOpen(false)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-serif-warm text-stone-600 hover:bg-black/5 border border-stone-300 transition-all cursor-pointer"
                    >
                      {language === 'en' ? 'Cancel' : '취소'}
                    </button>
                    <button
                      type="submit"
                      disabled={!reactionEmoji.trim() || isSavingReaction}
                      className="px-4 py-1.5 rounded-full bg-[#6B1724] hover:bg-[#831D2D] disabled:opacity-40 text-amber-50 font-serif-warm text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                      {language === 'en' ? 'Attach Note' : '포스트잇 붙이기'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
