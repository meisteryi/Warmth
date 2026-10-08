'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Puzzle, Stamp, HelpCircle, X, Sparkles, Lightbulb, CheckCircle2, Loader2 } from 'lucide-react';
import { verifyFlexibleQuizAnswer } from '@/lib/aiClient';
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
  partnerName = '상대방',
}: MissionModalProps) {
  // 편지 작성자가 지정한 관문 (수신자는 작성자가 지정한 미션만 수행할 수 있음)
  const assignedMode: 'PHOTO_PUZZLE' | 'STAMP_PUZZLE' | 'SURPRISE_QUIZ' =
    mission.type === 'PUZZLE_STAMP'
      ? 'STAMP_PUZZLE'
      : mission.type === 'QUIZ' || mission.type === 'TEXT'
      ? 'SURPRISE_QUIZ'
      : 'PHOTO_PUZZLE';

  const [quizInput, setQuizInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setQuizInput('');
      setShowHint(false);
      setErrorMsg('');
      setIsSuccess(false);
      setIsCheckingAnswer(false);
      setWrongCount(0);
    }
  }, [isOpen, mission]);

  // 퀴즈 문제 및 정답 (작성자가 지정한 값 또는 기본값)
  const quizPrompt = mission.prompt || '저번 편지에서 내가 가장 행복했다고 말했던 순간이 언제였게?';
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

  // 퀴즈 정답 통과 공통 핸들러
  const handlePassQuizSuccess = (displayAnswer: string) => {
    setIsSuccess(true);
    soundEngine.playMissionPassChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#6B1724', '#B8860B', '#FDFBF7'],
    });

    setTimeout(() => {
      onPassMission(`💡 깜짝 퀴즈 정답 통과: "${displayAnswer}"`);
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  // 3. 깜짝 퀴즈 정답 검증 및 제출 (AI 기반 유연한 유사 정답 판정)
  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCheckingAnswer || isSuccess) return;
    setErrorMsg('');

    if (!quizInput.trim()) {
      setErrorMsg('정답을 입력해주세요.');
      return;
    }

    // 1) 0ms 빠른 단순 일치 검사
    const normalizedInput = quizInput.trim().replace(/\s+/g, '').toLowerCase();
    const normalizedAnswer = quizAnswer.trim().replace(/\s+/g, '').toLowerCase();

    if (normalizedInput === normalizedAnswer) {
      handlePassQuizSuccess(quizAnswer);
      return;
    }

    // 2) API 및 스마트 휴리스틱 유연 채점 (러닝 <-> 조깅 등 의미상 거의 맞으면 정답 인정)
    setIsCheckingAnswer(true);
    try {
      const result = await verifyFlexibleQuizAnswer(quizPrompt, quizAnswer, quizInput);
      setIsCheckingAnswer(false);

      if (result.isCorrect) {
        const displayAnswer =
          quizInput.trim() !== quizAnswer.trim()
            ? `${quizInput.trim()} (정답 인정 / 원문: ${quizAnswer})`
            : quizAnswer;
        handlePassQuizSuccess(displayAnswer);
      } else {
        const nextCount = wrongCount + 1;
        setWrongCount(nextCount);
        setErrorMsg(`정답이 아닙니다. (${nextCount}회 시도)`);
        setShowHint(true); // 오답 시 자동으로 힌트 노출
        soundEngine.playTileSlideSound();
      }
    } catch {
      setIsCheckingAnswer(false);
      const nextCount = wrongCount + 1;
      setWrongCount(nextCount);
      setErrorMsg(`정답이 아닙니다. (${nextCount}회 시도)`);
      setShowHint(true);
      soundEngine.playTileSlideSound();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
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
            <div className="flex items-center gap-2.5 mb-3 sm:mb-4 pr-8">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#6B1724]/10 border border-[#6B1724]/20 flex items-center justify-center text-[#6B1724] shrink-0">
                {assignedMode === 'PHOTO_PUZZLE' && <Puzzle className="w-4 h-4 sm:w-5 sm:h-5 text-[#6B1724]" />}
                {assignedMode === 'STAMP_PUZZLE' && <Stamp className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800" />}
                {assignedMode === 'SURPRISE_QUIZ' && <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-700" />}
              </div>
              <div>
                <h3 className="font-serif-warm text-base sm:text-xl font-bold text-stone-900 leading-tight">
                  {assignedMode === 'PHOTO_PUZZLE' && '하루 사진 조각 맞추기'}
                  {assignedMode === 'STAMP_PUZZLE' && '빈티지 우표 맞추기'}
                  {assignedMode === 'SURPRISE_QUIZ' && '봉인 해제 깜짝 퀴즈'}
                </h3>
              </div>
            </div>

            {/* 편지 작성자가 지정한 봉인 해제 관문 안내 (선택 변경 불가) */}
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[#F4EFEA] border border-[#E8DFC8]/80 mb-3 sm:mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-white shadow-2xs border border-[#E8DFC8] flex items-center justify-center text-stone-700 shrink-0">
                  {assignedMode === 'PHOTO_PUZZLE' && <Puzzle className="w-3.5 h-3.5 text-[#6B1724]" />}
                  {assignedMode === 'STAMP_PUZZLE' && <Stamp className="w-3.5 h-3.5 text-amber-800" />}
                  {assignedMode === 'SURPRISE_QUIZ' && <HelpCircle className="w-3.5 h-3.5 text-rose-700" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-serif-warm text-stone-600 truncate">
                    <strong className="text-stone-900 font-semibold">{partnerName}</strong> 님이 지정한 봉인 해제 관문
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans-ui font-semibold bg-white text-stone-800 shadow-2xs border border-stone-200 shrink-0 ml-2">
                {assignedMode === 'PHOTO_PUZZLE' && '사진 조각 맞추기'}
                {assignedMode === 'STAMP_PUZZLE' && '우표 퍼즐 맞추기'}
                {assignedMode === 'SURPRISE_QUIZ' && '깜짝 퀴즈 풀기'}
              </span>
            </div>

            {/* 모드 1: 사진 슬라이딩 퍼즐 */}
            {assignedMode === 'PHOTO_PUZZLE' && (
              <PhotoSlidingPuzzle
                imageUrl={diaryPhoto}
                partnerName={partnerName}
                onSolve={handlePhotoPuzzleSolved}
              />
            )}

            {/* 모드 2: 빈티지 우표 맞추기 (내 사진이 들어간 커스텀 우표) */}
            {assignedMode === 'STAMP_PUZZLE' && (
              <StampJigsawPuzzle
                partnerName={partnerName}
                photoUrl={diaryPhoto}
                onSolve={handleStampPuzzleSolved}
              />
            )}

            {/* 모드 3: 깜짝 퀴즈 풀기 */}
            {assignedMode === 'SURPRISE_QUIZ' && (
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
                      disabled={isCheckingAnswer || isSuccess}
                      value={quizInput}
                      onChange={(e) => setQuizInput(e.target.value)}
                      placeholder="정답을 입력하세요... (예: 러닝, 조깅)"
                      className="w-full p-3 rounded-xl border border-stone-300 bg-white font-serif-warm text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] disabled:opacity-60"
                    />
                    <p className="mt-1 text-[11px] text-stone-400 font-sans-ui">
                      💡 글자가 완전히 같지 않아도 의미가 통하면 정답으로 인정돼요. (예: 러닝 ↔ 조깅)
                    </p>
                  </div>

                  {errorMsg && (
                    <p className="text-xs text-rose-600 font-sans-ui flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{errorMsg}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSuccess || isCheckingAnswer}
                    className="w-full py-3 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {isCheckingAnswer ? (
                      <>
                        <Loader2 className="w-4 h-4 text-amber-200 animate-spin" />
                        <span>답변 확인 중...</span>
                      </>
                    ) : isSuccess ? (
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
