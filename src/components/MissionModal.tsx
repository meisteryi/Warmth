'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Puzzle, Stamp, HelpCircle, X, Sparkles, Lightbulb, CheckCircle2 } from 'lucide-react';
import PhotoSlidingPuzzle from './PhotoSlidingPuzzle';
import StampJigsawPuzzle from './StampJigsawPuzzle';

interface MissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: MissionData;
  onPassMission: (submissionText: string) => void;
  diaryPhoto?: string;
  partnerName?: string;
}

export default function MissionModal({
  isOpen,
  onClose,
  mission,
  onPassMission,
  diaryPhoto = 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80',
  partnerName = '유라',
}: MissionModalProps) {
  // 모달 초기 탭: 일기 작성자가 지정한 미션에 맞추되, 언제든 3가지 중 자유롭게 전환 가능
  const initialMode =
    mission.type === 'PUZZLE_STAMP'
      ? 'STAMP_PUZZLE'
      : mission.type === 'QUIZ'
      ? 'SURPRISE_QUIZ'
      : 'PHOTO_PUZZLE';

  const [activeTab, setActiveTab] = useState<'PHOTO_PUZZLE' | 'STAMP_PUZZLE' | 'SURPRISE_QUIZ'>(initialMode);
  const [quizInput, setQuizInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  // 퀴즈 문제 및 정답 (작성자가 지정한 값 또는 기본값)
  const quizPrompt = mission.prompt || `${partnerName}가 낸 깜짝 퀴즈: 오늘 내가 가장 행복했던 순간은 언제였을까요?`;
  const quizAnswer = mission.quizAnswer || '너랑 통화할 때';
  const quizHint = mission.quizHint || '매일 밤 네 목소리가 들리는 시간이야!';

  // 1. 사진 퍼즐 클리어
  const handlePhotoPuzzleSolved = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onPassMission(`🧩 ${partnerName}의 하루 사진 조각을 성공적으로 맞췄습니다!`);
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  // 2. 우표 퍼즐 클리어
  const handleStampPuzzleSolved = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onPassMission(`📮 찢어진 우표 조각 4개를 완벽하게 복원하고 소인을 찍었습니다!`);
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  // 3. 깜짝 퀴즈 정답 검증 및 제출
  const handleQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!quizInput.trim()) {
      setErrorMsg('정답을 입력해주세요.');
      return;
    }

    // 공백 및 대소문자 무시 비교
    const normalizedInput = quizInput.trim().replace(/\s+/g, '').toLowerCase();
    const normalizedAnswer = quizAnswer.trim().replace(/\s+/g, '').toLowerCase();

    if (normalizedInput !== normalizedAnswer) {
      const nextCount = wrongCount + 1;
      setWrongCount(nextCount);
      setErrorMsg(`정답이 아닙니다. (${nextCount}회 시도)`);
      setShowHint(true); // 오답 시 자동으로 힌트 노출
      soundEngine.playTileSlideSound();
      return;
    }

    // 정답 통과!
    setIsSuccess(true);
    soundEngine.playMissionPassChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#6B1724', '#B8860B', '#FDFBF7'],
    });

    setTimeout(() => {
      onPassMission(`💡 깜짝 퀴즈 정답 통과: "${quizAnswer}"`);
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg my-auto bg-[#FFFDF9] rounded-2xl p-3 sm:p-7 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900 max-h-[94dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors z-10 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 */}
            <div className="flex items-center gap-2 mb-2 sm:mb-3.5 pr-8">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#6B1724]/10 border border-[#6B1724]/20 flex items-center justify-center text-[#6B1724] shrink-0">
                <Puzzle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <span className="text-[9px] sm:text-[10px] font-sans-ui text-[#6B1724] font-semibold tracking-wider uppercase">
                  DAILY UNLOCK GATE
                </span>
                <h3 className="font-serif-warm text-sm sm:text-xl font-bold text-stone-900 leading-tight">
                  봉인을 풀기 위한 관문
                </h3>
              </div>
            </div>

            {/* 3가지 관문 선택 탭 (사진 퍼즐 / 우표 맞추기 / 깜짝 퀴즈) */}
            <div className="flex bg-[#F4EFEA] p-1 rounded-xl mb-3 sm:mb-5 text-xs font-sans-ui">
              <button
                type="button"
                onClick={() => setActiveTab('PHOTO_PUZZLE')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'PHOTO_PUZZLE'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Puzzle className="w-3.5 h-3.5 text-[#6B1724]" />
                <span>사진 퍼즐</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('STAMP_PUZZLE')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'STAMP_PUZZLE'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Stamp className="w-3.5 h-3.5 text-amber-800" />
                <span>우표 맞추기</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SURPRISE_QUIZ')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'SURPRISE_QUIZ'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-rose-700" />
                <span>깜짝 퀴즈</span>
              </button>
            </div>

            {/* 모드 1: 사진 슬라이딩 퍼즐 */}
            {activeTab === 'PHOTO_PUZZLE' && (
              <PhotoSlidingPuzzle
                imageUrl={diaryPhoto}
                partnerName={partnerName}
                onSolve={handlePhotoPuzzleSolved}
              />
            )}

            {/* 모드 2: 빈티지 우표 맞추기 */}
            {activeTab === 'STAMP_PUZZLE' && (
              <StampJigsawPuzzle
                partnerName={partnerName}
                onSolve={handleStampPuzzleSolved}
              />
            )}

            {/* 모드 3: 깜짝 퀴즈 풀기 */}
            {activeTab === 'SURPRISE_QUIZ' && (
              <div className="space-y-4">
                {/* 퀴즈 문제 카드 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF5EE] border border-[#E8DEC8] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#8C2131] font-semibold mb-2">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>{partnerName} 님이 남긴 깜짝 퀴즈</span>
                  </div>
                  <p className="font-serif-warm text-base sm:text-lg text-stone-800 font-bold leading-snug">
                    &ldquo;{quizPrompt}&rdquo;
                  </p>

                  {/* 힌트 토글 영역 */}
                  <div className="mt-3 pt-3 border-t border-[#E8DEC8]/80 flex items-center justify-between text-xs font-sans-ui text-stone-500">
                    {showHint ? (
                      <div className="flex items-center gap-1 text-amber-800 font-medium bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        <span>💡 힌트: {quizHint}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowHint(true)}
                        className="text-amber-800 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>힌트 확인하기</span>
                      </button>
                    )}
                    {wrongCount > 0 && (
                      <span className="text-stone-400 text-[11px]">시도 {wrongCount}회</span>
                    )}
                  </div>
                </div>

                {/* 정답 입력 폼 */}
                <form onSubmit={handleQuizSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-sans-ui text-stone-600 mb-1">
                      퀴즈 정답 입력
                    </label>
                    <input
                      type="text"
                      value={quizInput}
                      onChange={(e) => setQuizInput(e.target.value)}
                      placeholder="정답을 입력하세요..."
                      className="w-full p-3 rounded-xl border border-stone-300 bg-white font-serif-warm text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724]"
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-xs text-rose-600 font-sans-ui flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{errorMsg}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSuccess}
                    className="w-full py-3 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>정답입니다! 봉인 해제 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-200" />
                        <span>정답 확인하고 봉인 풀기</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
