'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { 
  X, 
  HelpCircle, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  HeartHandshake, 
  Camera, 
  Smile, 
  Check 
} from 'lucide-react';

interface MissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: MissionData;
  onPassMission: (submissionText: string) => void;
}

export default function MissionModal({
  isOpen,
  onClose,
  mission,
  onPassMission,
}: MissionModalProps) {
  const [inputText, setInputText] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [changeCount, setChangeCount] = useState(1);
  const [currentPrompt, setCurrentPrompt] = useState(mission.prompt);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  const fallbackMissions = [
    '오늘 하루 고생한 나 또는 상대방에게 20자 이상의 다정한 한 줄 쪽지를 남겨주세요.',
    '오늘 있었던 일 중 가장 작지만 소소하게 웃음 지었던 순간을 한 줄로 적어보세요.',
    '오늘 떠오르는 상대방의 가장 사랑스러운 모습 한 가지를 전해보세요.',
  ];

  const handleShuffleMission = () => {
    if (changeCount <= 0) return;
    setChangeCount((prev) => prev - 1);
    const nextIdx = Math.floor(Math.random() * fallbackMissions.length);
    setCurrentPrompt(fallbackMissions[nextIdx]);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // 퀴즈 타입인 경우
    if (mission.type === 'QUIZ' && mission.quizAnswer) {
      if (inputText.trim().toLowerCase() !== mission.quizAnswer.trim().toLowerCase()) {
        const nextWrong = wrongCount + 1;
        setWrongCount(nextWrong);
        if (nextWrong >= 3) {
          setErrorMsg(`힌트: ${mission.quizHint || '작성자와의 소중한 추억을 떠올려보세요!'}`);
        } else {
          setErrorMsg(`정답이 아닙니다. (${nextWrong}/3회 시도)`);
        }
        return;
      }
    } else {
      // 텍스트 미션인 경우 (최소 20자 체크 등)
      if (inputText.trim().length < 10 && !selectedEmotion) {
        setErrorMsg('마음을 담아 10자 이상 정성스럽게 적어주세요.');
        return;
      }
    }

    setIsSuccess(true);
    soundEngine.playMissionPassChime();

    setTimeout(() => {
      onPassMission(selectedEmotion ? `[감정: ${selectedEmotion}] ${inputText}` : inputText);
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const emotions = [
    { label: '설렘', icon: '🌸' },
    { label: '평온', icon: '☕' },
    { label: '고단함', icon: '🌙' },
    { label: '보고픔', icon: '💌' },
    { label: '감사함', icon: '🌿' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-[#FFFDF9] rounded-2xl p-6 sm:p-8 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-sans-ui text-amber-800 font-semibold tracking-wider uppercase">
                  DAILY MISSION GATE
                </span>
                <h3 className="font-serif-warm text-lg sm:text-xl font-bold text-stone-900">
                  봉인을 풀기 위한 오늘의 미션
                </h3>
              </div>
            </div>

            {/* 미션 안내 카드 */}
            <div className="my-5 p-4 rounded-xl bg-[#FAF6EE] border border-[#EADECE] relative">
              <p className="font-serif-warm text-base sm:text-lg text-stone-800 leading-relaxed font-semibold">
                &ldquo;{currentPrompt}&rdquo;
              </p>

              {/* 하루 1회 미션 변경권 */}
              {!mission.isCustom && changeCount > 0 && (
                <div className="mt-3 pt-2 border-t border-[#EADECE] flex items-center justify-between text-xs text-stone-500 font-sans-ui">
                  <span>어려운 미션인가요?</span>
                  <button
                    type="button"
                    onClick={handleShuffleMission}
                    className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-medium hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>다른 미션으로 변경 (잔여 {changeCount}회)</span>
                  </button>
                </div>
              )}
            </div>

            {/* 폼 입력 영역 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 감정 스탬프 선택 (옵션) */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-2">
                  오늘 나의 감정 날씨 스탬프 (선택)
                </label>
                <div className="flex gap-2 justify-between">
                  {emotions.map((em) => (
                    <button
                      key={em.label}
                      type="button"
                      onClick={() => setSelectedEmotion(em.label === selectedEmotion ? null : em.label)}
                      className={`flex-1 py-2 px-1 rounded-xl text-center border text-xs font-sans-ui transition-all ${
                        selectedEmotion === em.label
                          ? 'border-[#6B1724] bg-[#6B1724]/10 text-[#6B1724] font-bold shadow-sm'
                          : 'border-stone-200 bg-white/70 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <span className="text-base block mb-0.5">{em.icon}</span>
                      <span>{em.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 텍스트 입력란 */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-1.5">
                  미션 답변 또는 한 줄 다정 쪽지
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="따뜻한 마음을 담아 적어보세요..."
                  rows={3}
                  className="w-full p-3.5 rounded-xl border border-stone-300 bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/30 focus:border-[#6B1724] font-serif-warm text-stone-800 placeholder:text-stone-400 text-sm leading-relaxed"
                />
              </div>

              {/* 에러 메시지 */}
              {errorMsg && (
                <p className="text-xs text-rose-600 font-sans-ui flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{errorMsg}</span>
                </p>
              )}

              {/* 제출 버튼 */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSuccess}
                  className={`w-full py-3 rounded-xl font-serif-warm font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                    isSuccess
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50'
                  }`}
                >
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-200 animate-bounce" />
                      <span>미션 완료! 봉인이 해제되었습니다</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>미션 제출하고 실링 왁스 봉인 풀기</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
