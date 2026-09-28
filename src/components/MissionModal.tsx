'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissionData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import PhotoSlidingPuzzle from './PhotoSlidingPuzzle';
import StampJigsawPuzzle from './StampJigsawPuzzle';
import { 
  X, 
  HelpCircle, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  HeartHandshake, 
  Puzzle, 
  Stamp, 
  PenTool, 
  Heart 
} from 'lucide-react';

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
  // 모달 탭 모드: 기본적으로 미션 타입에 맞추되 사용자가 자유롭게 전환 가능
  const initialMode = mission.type === 'PUZZLE_PHOTO' 
    ? 'PHOTO_PUZZLE' 
    : mission.type === 'PUZZLE_STAMP' 
    ? 'STAMP_PUZZLE' 
    : 'PHOTO_PUZZLE'; // 사진 퍼즐을 기본 게임으로 노출!

  const [activeTab, setActiveTab] = useState<'PHOTO_PUZZLE' | 'STAMP_PUZZLE' | 'TEXT_NOTE'>(initialMode);
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

  // 1. 사진 퍼즐 클리어
  const handlePhotoPuzzleSolved = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onPassMission('🧩 유라의 하루 사진 퍼즐을 성공적으로 맞췄습니다!');
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  // 2. 우표 퍼즐 클리어
  const handleStampPuzzleSolved = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onPassMission('📮 빈티지 우표 퍼즐을 완성하고 소인을 찍었습니다!');
      setIsSuccess(false);
      onClose();
    }, 1000);
  };

  // 3. 텍스트 쪽지 / 퀴즈 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg my-8 bg-[#FFFDF9] rounded-2xl p-6 sm:p-8 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900"
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
              <div className="w-9 h-9 rounded-full bg-[#6B1724]/10 border border-[#6B1724]/20 flex items-center justify-center text-[#6B1724]">
                <Puzzle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-sans-ui text-[#6B1724] font-semibold tracking-wider uppercase">
                  DAILY UNLOCK GATE
                </span>
                <h3 className="font-serif-warm text-lg sm:text-xl font-bold text-stone-900">
                  봉인을 풀기 위한 관문
                </h3>
              </div>
            </div>

            {/* 3가지 관문 선택 탭 */}
            <div className="flex bg-[#F4EFEA] p-1 rounded-xl mb-5 text-xs font-sans-ui">
              <button
                type="button"
                onClick={() => setActiveTab('PHOTO_PUZZLE')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'PHOTO_PUZZLE'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Puzzle className="w-3.5 h-3.5 text-[#6B1724]" />
                <span>사진 조각 퍼즐</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('STAMP_PUZZLE')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'STAMP_PUZZLE'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Stamp className="w-3.5 h-3.5 text-amber-800" />
                <span>우표 퍼즐</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('TEXT_NOTE')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'TEXT_NOTE'
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-stone-600" />
                <span>다정 쪽지 쓰기</span>
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

            {/* 모드 3: 텍스트 쪽지 작성 / 퀴즈 */}
            {activeTab === 'TEXT_NOTE' && (
              <div>
                <div className="my-4 p-4 rounded-xl bg-[#FAF6EE] border border-[#EADECE]">
                  <p className="font-serif-warm text-sm sm:text-base text-stone-800 leading-relaxed font-semibold">
                    &ldquo;{currentPrompt}&rdquo;
                  </p>
                  {!mission.isCustom && changeCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#EADECE] flex items-center justify-between text-[11px] text-stone-500 font-sans-ui">
                      <span>다른 미션을 원하시나요?</span>
                      <button
                        type="button"
                        onClick={handleShuffleMission}
                        className="inline-flex items-center gap-1 text-amber-800 hover:underline font-medium"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>변경 ({changeCount}회)</span>
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-sans-ui text-stone-600 mb-1.5">
                      오늘의 감정 스탬프
                    </label>
                    <div className="flex gap-1.5">
                      {emotions.map((em) => (
                        <button
                          key={em.label}
                          type="button"
                          onClick={() => setSelectedEmotion(em.label === selectedEmotion ? null : em.label)}
                          className={`flex-1 py-1.5 px-1 rounded-xl text-center border text-[11px] font-sans-ui transition-all ${
                            selectedEmotion === em.label
                              ? 'border-[#6B1724] bg-[#6B1724]/10 text-[#6B1724] font-bold shadow-xs'
                              : 'border-stone-200 bg-white/70 text-stone-600'
                          }`}
                        >
                          <span className="block text-sm mb-0.5">{em.icon}</span>
                          <span>{em.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-sans-ui text-stone-600 mb-1">
                      다정한 한 줄 쪽지 (10자 이상)
                    </label>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="마음을 담아 적어보세요..."
                      rows={3}
                      className="w-full p-3 rounded-xl border border-stone-300 bg-white/80 font-serif-warm text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724]"
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
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>쪽지 남기고 봉인 풀기</span>
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
