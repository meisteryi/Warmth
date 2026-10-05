'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Calendar, Cake, X, Check, Sparkles } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentBirthDate?: string;
  onSave: (newName: string, newBirthDate: string) => Promise<boolean | void> | boolean | void;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  currentName,
  currentBirthDate,
  onSave,
}: ProfileEditModalProps) {
  const [name, setName] = useState(currentName);
  const [birthDate, setBirthDate] = useState(currentBirthDate || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setBirthDate(currentBirthDate || '');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentName, currentBirthDate]);

  // 오늘 날짜 문자열 (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  // 생일까지 남은 일수 계산
  const birthdayDDay = React.useMemo(() => {
    if (!birthDate) return null;
    const parts = birthDate.split('-');
    if (parts.length !== 3) return null;
    const birthMonth = parseInt(parts[1], 10) - 1;
    const birthDay = parseInt(parts[2], 10);

    const now = new Date();
    const currentYear = now.getFullYear();
    let nextBday = new Date(currentYear, birthMonth, birthDay);

    // 올해 생일이 이미 지난 경우 내년 생일로 계산
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (nextBday.getTime() < todayMidnight) {
      nextBday = new Date(currentYear + 1, birthMonth, birthDay);
    }

    const diffDays = Math.ceil((nextBday.getTime() - todayMidnight) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [birthDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('이름(닉네임)을 1자 이상 입력해주세요.');
      return;
    }
    if (trimmedName.length > 12) {
      setErrorMessage('이름은 12자 이내로 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    soundEngine.playTileSlideSound();

    try {
      await onSave(trimmedName, birthDate.trim());
      soundEngine.playMissionPassChime();
      onClose();
    } catch (err) {
      console.warn('Profile save failed:', err);
      setErrorMessage('프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4"
          >
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFC8]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#6B1724]/10 border border-[#6B1724]/20 flex items-center justify-center text-[#6B1724]">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif-warm font-bold text-stone-900 text-base">
                    내 프로필 편집
                  </h3>
                  <p className="text-[10.5px] text-stone-500 font-sans-ui">
                    일기장과 편지 봉투에 표시될 정보입니다
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 프로필 입력 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. 이름 (닉네임) 입력 */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-stone-800 font-serif-warm">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#6B1724]" />
                    <span>나의 이름 (닉네임)</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-sans-ui font-normal">
                    {name.trim().length}/12자
                  </span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={12}
                  placeholder="예: 지우, 민준이, 곰돌이"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-sm font-sans-ui focus:outline-none focus:border-[#6B1724] shadow-2xs"
                  required
                />
                <p className="text-[10.5px] text-stone-500 font-sans-ui leading-tight">
                  편지 발송인과 홈 화면 커플 뱃지에 표시됩니다.
                </p>
              </div>

              {/* 2. 생년월일 입력 */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-stone-800 font-serif-warm">
                  <span className="flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-amber-700" />
                    <span>생년월일 (선택)</span>
                  </span>
                  {birthdayDDay !== null && (
                    <span className="text-[10px] font-sans-ui font-semibold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300">
                      {birthdayDDay === 0 ? '🎉 오늘 생일!' : `생일까지 D-${birthdayDDay}`}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={birthDate}
                    max={todayStr}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-sm font-sans-ui focus:outline-none focus:border-[#6B1724] shadow-2xs block"
                  />
                </div>
                <p className="text-[10.5px] text-stone-500 font-sans-ui leading-tight">
                  생일 및 둘만의 기념일 계산에 활용됩니다.
                </p>
              </div>

              {/* 에러 메시지 */}
              {errorMessage && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-sans-ui">
                  {errorMessage}
                </div>
              )}

              {/* 하단 버튼 */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold font-sans-ui cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold font-sans-ui shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>저장 중...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>프로필 저장</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
