'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryData, DiaryReaction } from '@/types/diary';
import { generateFallbackWarmth } from '@/lib/gemini';
import { Feather, Calendar, Heart, MessageSquareQuote, PenLine, ThermometerSun, ThermometerSnowflake, Edit3, Check, X, Smile, Sparkles, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { updateDiaryDateInFirestore, updateDiaryReactionInFirestore } from '@/lib/roomService';
import { soundEngine } from '@/lib/audio';

interface OpenedLetterProps {
  diary: DiaryData;
  onWriteReply: () => void;
  onResetView?: () => void;
  userName?: string;
  roomCode?: string;
  onUpdateDiaryDate?: (diaryId: string, newIsoDate: string) => void;
  onUpdateDiaryReaction?: (diaryId: string, reaction: DiaryReaction | null) => void;
}

const EMOJI_CATEGORIES = [
  {
    id: 'love',
    name: '사랑 · 다정',
    icon: '❤️',
    emojis: ['❤️', '💖', '💌', '🥹', '🥰', '💕', '🤍', '🫶', '💓', '💘', '🫂', '🌷', '💐', '🍓', '🎁', '🍫', '✨', '🕊️'],
  },
  {
    id: 'cheer',
    name: '위로 · 응원',
    icon: '🌿',
    emojis: ['☕', '🍵', '🌿', '🌸', '🩹', '🌙', '🧸', '☁️', '🫧', '🕯️', '🌱', '🌼', '☔', '🪵', '💫', '☀️', '🌻', '🌾'],
  },
  {
    id: 'joy',
    name: '미소 · 기쁨',
    icon: '😊',
    emojis: ['😊', '😆', '🥳', '👏', '👍', '💛', '☺️', '😍', '😋', '🎉', '🍀', '😄', '🙌', '⭐', '🎈', '🤩', '😻', '🔥'],
  },
  {
    id: 'empathy',
    name: '공감 · 뭉클',
    icon: '🥺',
    emojis: ['🥺', '😭', '🥲', '💧', '💭', '🫥', '🌧️', '🌊', '🍂', '🌾', '💙', '🩹', '😞', '🫂', '🕊️', '🖤', '😿', '🌙'],
  },
  {
    id: 'daily',
    name: '일상 · 귀여움',
    icon: '🐱',
    emojis: ['🐱', '🐶', '🐾', '☘️', '🍰', '🥐', '🍙', '🎵', '🎨', '📖', '🌟', '🏠', '🍎', '🥞', '🐾', '🍩', '🥨', '☕'],
  },
];

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

  // 이모티콘 마음 반응 상태
  const [currentReaction, setCurrentReaction] = useState<DiaryReaction | null>(diary.reaction || null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSavingReaction, setIsSavingReaction] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('love');
  const [customEmojiInput, setCustomEmojiInput] = useState<string>('');

  useEffect(() => {
    setCurrentDiaryDate(diary.createdAt);
    try {
      const d = new Date(diary.createdAt);
      setEditDateValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } catch { }
  }, [diary.createdAt]);

  useEffect(() => {
    setCurrentReaction(diary.reaction || null);
  }, [diary.reaction]);

  const handleSelectEmoji = async (emoji: string) => {
    if (!emoji || isSavingReaction) return;
    setIsSavingReaction(true);
    const newReaction: DiaryReaction = {
      emoji: emoji.trim(),
      reactorName: userName || (language === 'en' ? 'Partner' : '상대방'),
      reactedAt: new Date().toISOString(),
    };

    try {
      setCurrentReaction(newReaction);
      setIsEmojiPickerOpen(false);
      setCustomEmojiInput('');
      soundEngine.playMissionPassChime();

      if (roomCode) {
        await updateDiaryReactionInFirestore(roomCode, diary.diaryId, newReaction);
      }
      onUpdateDiaryReaction?.(diary.diaryId, newReaction);
    } catch (e) {
      console.warn('Failed to update diary reaction:', e);
    } finally {
      setIsSavingReaction(false);
    }
  };

  const handleRemoveReaction = async () => {
    if (isSavingReaction) return;
    setIsSavingReaction(true);
    try {
      setCurrentReaction(null);
      setIsEmojiPickerOpen(false);
      soundEngine.playPaperRustle();

      if (roomCode) {
        await updateDiaryReactionInFirestore(roomCode, diary.diaryId, null);
      }
      onUpdateDiaryReaction?.(diary.diaryId, null);
    } catch (e) {
      console.warn('Failed to remove diary reaction:', e);
    } finally {
      setIsSavingReaction(false);
    }
  };

  const handleCustomEmojiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmojiInput.trim()) return;
    handleSelectEmoji(customEmojiInput.trim());
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
          {/* 상대방이 쓴 일기에 이모티콘으로 반응 남기기 & 표시 (글 부분과 오늘의 온기 온도 사이) */}
          {/* =============================================================== */}
          <div className="my-6">
            {currentReaction ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-[#FFFDF9] via-[#FAF6F0] to-[#F5ECE1] border border-[#EADBCC] shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* 선택된 유니코드 이모티콘 큰 배지 */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-[#E3D3C2] shadow-2xs flex items-center justify-center text-2xl sm:text-3xl shrink-0 select-none cursor-pointer"
                    onClick={() => {
                      if (!isAuthor || currentReaction.reactorName === userName) {
                        setIsEmojiPickerOpen(true);
                      }
                    }}
                    title={!isAuthor || currentReaction.reactorName === userName ? '이모티콘 변경하기' : undefined}
                  >
                    {currentReaction.emoji}
                  </motion.div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-sans-ui font-semibold text-[#8A5A44] tracking-wide">
                        {isAuthor
                          ? (language === 'en' ? `${currentReaction.reactorName}'s Reaction` : `${currentReaction.reactorName}님의 마음 반응`)
                          : (language === 'en' ? 'My Reaction' : '내가 남긴 마음 반응')}
                      </span>
                      {currentReaction.reactedAt && (
                        <span className="text-[10px] text-stone-400 font-sans-ui">
                          {formatReactionTime(currentReaction.reactedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-serif-warm text-stone-700 mt-0.5 line-clamp-2">
                      {isAuthor
                        ? (language === 'en'
                            ? `${currentReaction.reactorName} read this diary and left the ${currentReaction.emoji} reaction.`
                            : `상대방이 이 글을 읽고 ${currentReaction.emoji} 반응으로 따뜻한 온기를 전했어요.`)
                        : (language === 'en'
                            ? `You sent the ${currentReaction.emoji} reaction for this letter.`
                            : `상대방에게 ${currentReaction.emoji} 반응으로 다정한 마음을 전했어요.`)}
                    </p>
                  </div>
                </div>

                {/* 반응 변경 및 삭제 버튼 (남긴 사람이거나 파트너) */}
                {(!isAuthor || currentReaction.reactorName === userName) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEmojiPickerOpen(true)}
                      className="px-2.5 py-1.5 text-xs font-serif-warm text-[#6B1724] hover:bg-stone-100/80 bg-white rounded-lg border border-[#EADBCC] shadow-2xs transition-all active:scale-95 cursor-pointer font-medium"
                    >
                      {language === 'en' ? 'Change' : '변경'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveReaction}
                      disabled={isSavingReaction}
                      className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 bg-white rounded-lg border border-[#EADBCC] shadow-2xs transition-all active:scale-95 cursor-pointer"
                      title={language === 'en' ? 'Remove reaction' : '반응 지우기'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* 반응이 아직 없을 때 */
              !isAuthor ? (
                /* 내가 읽은 상대방의 일기: 이모티콘으로 반응 남기기 유도 */
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#FDFBF7] to-[#F7F2EB] border border-dashed border-[#DFCDBB] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FAF3EC] border border-[#E6D4C2] flex items-center justify-center text-base shrink-0">
                      💌
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-serif-warm font-semibold text-stone-800">
                        {language === 'en' ? 'Leave an emoji reaction for this letter' : '상대의 일기에 마음 이모티콘으로 반응해보세요'}
                      </p>
                      <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5">
                        {language === 'en' ? 'Pick an emoji to share your warmth.' : '하나의 이모티콘으로 다정한 공감과 온기를 전할 수 있어요.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-full bg-gradient-to-r from-[#6B1724] to-[#8C1F32] hover:brightness-110 active:scale-95 text-amber-50 text-xs sm:text-sm font-serif-warm font-medium shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Smile className="w-4 h-4 text-amber-200" />
                    <span>{language === 'en' ? 'React with Emoji' : '이모티콘 반응 남기기'}</span>
                  </button>
                </motion.div>
              ) : (
                /* 내가 쓴 일기를 내가 볼 때: 상대방 반응 대기 상태 표시 (단일 테스트 편의를 위해 반응 버튼도 제공) */
                <div className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 flex items-center justify-between text-xs text-stone-500 font-serif-warm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🫧</span>
                    <span>
                      {language === 'en'
                        ? "Waiting for partner's emoji reaction..."
                        : '상대방이 읽고 남길 다정한 이모티콘 반응을 기다리고 있어요'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(true)}
                    className="text-[11px] text-stone-400 hover:text-stone-700 underline font-sans-ui transition-colors cursor-pointer shrink-0 ml-2"
                  >
                    {language === 'en' ? 'Test Reaction' : '직접 반응 남겨보기'}
                  </button>
                </div>
              )
            )}
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
                        {language === 'en' ? `Today\'s Temperature` : `오늘의 온도`}
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
      {/* 유니코드 이모티콘 선택 팝업 창 (모달) */}
      {/* =============================================================== */}
      <AnimatePresence>
        {isEmojiPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
            onClick={() => setIsEmojiPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#FAF7F2] rounded-3xl border border-[#E5D7C7] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 상단 헤더 */}
              <div className="px-5 py-4 border-b border-[#EEDBCC] bg-gradient-to-r from-[#FAF4EC] to-[#F5ECE1] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-2xs shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-200" />
                  </div>
                  <div>
                    <h3 className="font-serif-warm font-bold text-stone-900 text-base">
                      {language === 'en' ? 'Choose Emoji Reaction' : '마음 이모티콘 선택'}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-sans-ui">
                      {language === 'en' ? 'Pick a single emoji to react to this diary' : '상대의 일기에 전하고 싶은 이모티콘을 골라주세요'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-200/60 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 카테고리 탭 바 */}
              <div className="px-4 py-2.5 bg-[#F4EDE3] border-b border-[#E8DFD3] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {EMOJI_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-serif-warm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-[#6B1724] text-amber-100 shadow-2xs'
                          : 'bg-white/70 text-stone-600 hover:bg-white border border-[#E2D5C5]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 이모티콘 그리드 영역 */}
              <div className="p-4 overflow-y-auto max-h-[280px]">
                {(() => {
                  const currentCategoryObj = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];
                  return (
                    <div className="grid grid-cols-6 gap-2">
                      {currentCategoryObj.emojis.map((emoji, idx) => {
                        const isSelected = currentReaction?.emoji === emoji;
                        return (
                          <motion.button
                            key={`${emoji}-${idx}`}
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSelectEmoji(emoji)}
                            className={`h-12 rounded-xl flex items-center justify-center text-2xl transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-100/90 border-[#6B1724] ring-2 ring-[#6B1724]/40 shadow-xs'
                                : 'bg-white/90 hover:bg-white border-[#E8DFD3] hover:border-[#D5C2AD] shadow-2xs'
                            }`}
                          >
                            {emoji}
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* 직접 유니코드 이모티콘 입력 영역 */}
              <form
                onSubmit={handleCustomEmojiSubmit}
                className="px-4 py-3 bg-[#F6EFE6] border-t border-[#EEDBCC] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={customEmojiInput}
                  onChange={(e) => setCustomEmojiInput(e.target.value)}
                  placeholder={language === 'en' ? 'Or enter any emoji directly (e.g. 🦄)' : '원하는 이모티콘 직접 입력 (예: 🐈, 🍓, 💌)'}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-[#DECBB8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#6B1724] text-stone-800 placeholder-stone-400 font-sans-ui"
                />
                <button
                  type="submit"
                  disabled={!customEmojiInput.trim() || isSavingReaction}
                  className="px-3.5 py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] disabled:opacity-40 text-amber-100 text-xs font-serif-warm font-semibold transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  {language === 'en' ? 'Select' : '선택'}
                </button>
              </form>

              {/* 모달 하단 액션 (반응 지우기 & 닫기) */}
              <div className="px-5 py-3 border-t border-[#E5D7C7] bg-[#FAF7F2] flex items-center justify-between">
                {currentReaction ? (
                  <button
                    type="button"
                    onClick={handleRemoveReaction}
                    disabled={isSavingReaction}
                    className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1 font-serif-warm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'en' ? 'Remove current reaction' : '현재 반응 지우기'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400 font-sans-ui">
                    {language === 'en' ? 'Tip: Tap any emoji to react.' : '원하는 이모티콘을 누르면 바로 반응이 남겨집니다.'}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen(false)}
                  className="px-4 py-1.5 rounded-full border border-stone-300 text-xs text-stone-600 hover:bg-stone-100 font-serif-warm transition-all cursor-pointer ml-auto"
                >
                  {language === 'en' ? 'Close' : '닫기'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
