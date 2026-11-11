'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Puzzle, Stamp, HelpCircle, Heart, X, Sparkles, Lightbulb, CheckCircle2, Loader2 } from 'lucide-react';
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
  const assignedMode: 'PHOTO_PUZZLE' | 'STAMP_PUZZLE' | 'SURPRISE_QUIZ' | 'TELEPATHY' =
    mission.type === 'PUZZLE_STAMP'
      ? 'STAMP_PUZZLE'
      : mission.type === 'TELEPATHY'
      ? 'TELEPATHY'
      : mission.type === 'QUIZ' || mission.type === 'TEXT'
      ? 'SURPRISE_QUIZ'
      : 'PHOTO_PUZZLE';

  const [quizInput, setQuizInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [helpTrigger, setHelpTrigger] = useState(0);
  const [selectedTelepathySide, setSelectedTelepathySide] = useState<'A' | 'B' | null>(null);
  const [wrongTelepathySide, setWrongTelepathySide] = useState<'A' | 'B' | null>(null);
  const [prevOpenMission, setPrevOpenMission] = useState({ isOpen, mission });

  if (prevOpenMission.isOpen !== isOpen || prevOpenMission.mission !== mission) {
    setPrevOpenMission({ isOpen, mission });
    if (isOpen) {
      setQuizInput('');
      setShowHint(false);
      setErrorMsg('');
      setIsSuccess(false);
      setIsCheckingAnswer(false);
      setWrongCount(0);
      setHelpTrigger(0);
      setSelectedTelepathySide(null);
      setWrongTelepathySide(null);
    }
  }

  const modalScrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // 모달이 열릴 때 스크롤 상단 초기화
  useEffect(() => {
    if (isOpen) {
      modalScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      backdropRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [isOpen, mission]);

  // 퀴즈 문제 및 정답 (작성자가 지정한 값 또는 기본값)
  const quizPrompt = mission.prompt || '저번 편지에서 내가 가장 행복했다고 말했던 순간이 언제였게?';
  const quizAnswer = mission.quizAnswer || '너랑 통화할 때';
  const quizHint = mission.quizHint || '매일 밤 네 목소리가 들리는 시간이야!';

  // 텔레파시 문제 및 선택지 (작성자가 지정한 값 또는 기본값)
  const telepathyPrompt = mission.prompt || '오늘 내가 퇴근길에 가장 생각난 것은?';
  const telepathyOptionA = mission.optionA || '따뜻한 유자차 한 잔';
  const telepathyOptionB = mission.optionB || '포근한 이불 속 휴식';
  const telepathyAnswerSide: 'A' | 'B' = mission.quizAnswer === 'B' ? 'B' : 'A';

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

  // 텔레파시 2지선다 선택 핸들러
  const handleSelectTelepathy = (side: 'A' | 'B') => {
    if (isSuccess || isCheckingAnswer) return;

    const chosenText = side === 'A' ? telepathyOptionA : telepathyOptionB;
    if (side === telepathyAnswerSide) {
      setSelectedTelepathySide(side);
      setWrongTelepathySide(null);
      setErrorMsg('');
      setIsSuccess(true);
      soundEngine.playMissionPassChime();
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#6B1724', '#BE123C', '#B8860B', '#FDFBF7'],
      });

      setTimeout(() => {
        onPassMission(`💞 이심전심 텔레파시 성공: "${chosenText}"`);
        setIsSuccess(false);
        onClose();
      }, 1100);
    } else {
      soundEngine.playTileSlideSound();
      setWrongTelepathySide(side);
      setErrorMsg('앗, 이번엔 다른 쪽을 골랐어요! 나머지 선택지로 마음을 맞춰볼까요? 💭');
    }
  };

  // 하단 '도와줘!' 긴급 해제 버튼 핸들러
  const handleHelpMe = () => {
    if (isSuccess || isCheckingAnswer || helpTrigger > 0) return;

    if (assignedMode === 'PHOTO_PUZZLE') {
      soundEngine.playTileSlideSound();
      setHelpTrigger((prev) => prev + 1);
    } else if (assignedMode === 'STAMP_PUZZLE') {
      soundEngine.playTileSlideSound();
      setHelpTrigger((prev) => prev + 1);
    } else if (assignedMode === 'SURPRISE_QUIZ') {
      setQuizInput(quizAnswer);
      setErrorMsg('');
      setShowHint(true);
      handlePassQuizSuccess(quizAnswer);
    } else if (assignedMode === 'TELEPATHY') {
      handleSelectTelepathy(telepathyAnswerSide);
    }
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
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
        >
          <motion.div
            ref={modalScrollRef}
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
                {assignedMode === 'TELEPATHY' && <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-700 fill-rose-700/20" />}
              </div>
              <div>
                <h3 className="font-serif-warm text-base sm:text-xl font-bold text-stone-900 leading-tight">
                  {assignedMode === 'PHOTO_PUZZLE' && '하루 사진 조각 맞추기'}
                  {assignedMode === 'STAMP_PUZZLE' && '빈티지 우표 맞추기'}
                  {assignedMode === 'SURPRISE_QUIZ' && '봉인 해제 깜짝 퀴즈'}
                  {assignedMode === 'TELEPATHY' && '이심전심 텔레파시'}
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
                  {assignedMode === 'TELEPATHY' && <Heart className="w-3.5 h-3.5 text-rose-700 fill-rose-700/20" />}
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
                {assignedMode === 'TELEPATHY' && '텔레파시 2지선다'}
              </span>
            </div>

            {/* 모드 1: 사진 슬라이딩 퍼즐 */}
            {assignedMode === 'PHOTO_PUZZLE' && (
              <PhotoSlidingPuzzle
                imageUrl={diaryPhoto}
                partnerName={partnerName}
                onSolve={handlePhotoPuzzleSolved}
                autoSolveTrigger={helpTrigger}
              />
            )}

            {/* 모드 2: 빈티지 우표 맞추기 (내 사진이 들어간 커스텀 우표) */}
            {assignedMode === 'STAMP_PUZZLE' && (
              <StampJigsawPuzzle
                partnerName={partnerName}
                photoUrl={diaryPhoto}
                onSolve={handleStampPuzzleSolved}
                autoSolveTrigger={helpTrigger}
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

            {/* 모드 4: 이심전심 텔레파시 (2지선다) */}
            {assignedMode === 'TELEPATHY' && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF5EE] border border-[#E8DEC8] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#8C2131] font-semibold mb-2">
                    <Heart className="w-4 h-4 text-rose-600 fill-rose-600/20" />
                    <span>{partnerName} 님의 마음을 맞춰보세요</span>
                  </div>
                  <p className="font-serif-warm text-stone-900 font-semibold text-base sm:text-lg leading-relaxed">
                    &ldquo;{telepathyPrompt}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { side: 'A' as const, label: telepathyOptionA },
                    { side: 'B' as const, label: telepathyOptionB },
                  ]).map(({ side, label }) => {
                    const isPickedSuccess = isSuccess && selectedTelepathySide === side;
                    const isMarkedWrong = wrongTelepathySide === side;

                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => handleSelectTelepathy(side)}
                        disabled={isSuccess || isMarkedWrong}
                        className={`group relative text-left p-4 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98] disabled:cursor-default ${
                          isPickedSuccess
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md'
                            : isMarkedWrong
                            ? 'bg-stone-100/80 border-stone-200 text-stone-400 opacity-65'
                            : 'bg-white hover:bg-rose-50/70 border-[#E8DFC8] hover:border-[#8C2131]/50 text-stone-900 shadow-xs hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-7 h-7 rounded-full text-xs font-sans-ui font-bold flex items-center justify-center shrink-0 transition-colors ${
                              isPickedSuccess
                                ? 'bg-emerald-600 text-white'
                                : isMarkedWrong
                                ? 'bg-stone-200 text-stone-400'
                                : 'bg-[#6B1724]/10 text-[#6B1724] group-hover:bg-[#6B1724] group-hover:text-amber-50'
                            }`}
                          >
                            {isPickedSuccess ? <CheckCircle2 className="w-4 h-4" /> : side}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-serif-warm text-sm sm:text-base font-semibold leading-snug break-keep">
                              {label}
                            </p>
                            {isMarkedWrong && (
                              <p className="text-[11px] font-sans-ui text-stone-400 mt-1">
                                다른 선택지도 확인해 볼까요?
                              </p>
                            )}
                            {isPickedSuccess && (
                              <p className="text-[11px] font-sans-ui text-emerald-700 font-semibold mt-1">
                                마음이 통했어요! 💞
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {errorMsg && !isSuccess && (
                  <p className="text-xs text-[#9C2A3B] font-serif-warm text-center animate-pulse">
                    {errorMsg}
                  </p>
                )}

                {isSuccess && (
                  <div className="py-3 rounded-xl bg-emerald-600 text-white font-serif-warm font-semibold text-sm flex items-center justify-center gap-2 shadow-md">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>텔레파시 통했다! 봉인 해제 중...</span>
                  </div>
                )}
              </div>
            )}

            {/* 하단 조그마한 '도와줘!' 긴급 해제 버튼 */}
            <div className="mt-4 pt-3 border-t border-[#E8DFC8]/70 flex items-center justify-between text-xs font-serif-warm">
              <span className="text-[11px] text-stone-400">
                {assignedMode === 'PHOTO_PUZZLE' && '퍼즐 맞추기가 어렵다면?'}
                {assignedMode === 'STAMP_PUZZLE' && '우표 맞추기가 번거롭다면?'}
                {assignedMode === 'SURPRISE_QUIZ' && '퀴즈 정답이 기억나지 않는다면?'}
                {assignedMode === 'TELEPATHY' && '상대의 마음을 도저히 모르겠다면?'}
              </span>
              <button
                type="button"
                onClick={handleHelpMe}
                disabled={isSuccess || isCheckingAnswer || helpTrigger > 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-serif-warm font-medium text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300/80 shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>도와줘!</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
