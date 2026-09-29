'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaxColor, WAX_COLORS, MissionData, DiaryData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { X, Send, Image as ImageIcon, Sparkles, Feather, HelpCircle } from 'lucide-react';

interface WriteDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDiary: (newDiary: Partial<DiaryData>) => void;
  currentUserName: string;
  partnerName: string;
}

export default function WriteDiaryModal({
  isOpen,
  onClose,
  onSaveDiary,
  currentUserName,
  partnerName,
}: WriteDiaryModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<WaxColor>('#6B1724');
  const [missionType, setMissionType] = useState<'PUZZLE_PHOTO' | 'PUZZLE_STAMP' | 'SYSTEM' | 'CUSTOM'>('PUZZLE_PHOTO');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customQuizAnswer, setCustomQuizAnswer] = useState('');
  const [customQuizHint, setCustomQuizHint] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string>(
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80'
  );

  const samplePhotos = [
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    soundEngine.playWaxCrackSound();

    let mission: MissionData;
    if (missionType === 'PUZZLE_PHOTO') {
      mission = {
        type: 'PUZZLE_PHOTO',
        prompt: `${partnerName} 님이 남긴 오늘의 한 컷 조각 퍼즐 맞추기`,
        quizAnswer: null,
        isCustom: false,
        submission: null,
        isPassed: false,
      };
    } else if (missionType === 'PUZZLE_STAMP') {
      mission = {
        type: 'PUZZLE_STAMP',
        prompt: '편지 봉투의 빈티지 우표 조각 4개를 맞추고 소인 찍기',
        quizAnswer: null,
        isCustom: false,
        submission: null,
        isPassed: false,
      };
    } else if (missionType === 'CUSTOM') {
      mission = {
        type: 'QUIZ',
        prompt: customPrompt || '내가 오늘 가장 맛있게 먹었던 음식은 무엇일까요?',
        quizAnswer: customQuizAnswer || '된장찌개',
        quizHint: customQuizHint || '구수한 국물 요리야!',
        isCustom: true,
        submission: null,
        isPassed: false,
      };
    } else {
      mission = {
        type: 'TEXT',
        prompt: '오늘 고생한 나 또는 서로에게 다정한 한 줄 응원을 남겨주세요 (10자 이상)',
        quizAnswer: null,
        isCustom: false,
        submission: null,
        isPassed: false,
      };
    }

    onSaveDiary({
      title,
      content,
      photos: [selectedPhoto],
      waxColor: selectedColor,
      mission,
      authorName: currentUserName,
      recipientName: partnerName,
      createdAt: new Date().toISOString(),
      isWaxBroken: false,
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl my-auto bg-[#FFFDF9] rounded-2xl p-4 sm:p-8 paper-texture border border-[#E8DFC8] shadow-2xl text-stone-900 max-h-[92dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors z-10 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 */}
            <div className="flex items-center gap-2 mb-5 pr-8">
              <Feather className="w-5 h-5 text-[#6B1724] shrink-0" />
              <h2 className="font-serif-warm text-lg sm:text-xl font-bold text-stone-900">
                새 교환일기 쓰기
              </h2>
              <span className="text-xs text-stone-500 font-sans-ui ml-auto">
                To. {partnerName}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* 제목 입력 */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-1">
                  일기 제목
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 서촌 골목길을 걷다가 문득..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-base sm:text-sm text-stone-900"
                />
              </div>

              {/* 본문 입력 */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-1">
                  일기 내용
                </label>
                <textarea
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="오늘 하루 나누고 싶었던 둘만의 소소하고 따뜻한 이야기를 적어보세요..."
                  className="w-full p-3.5 rounded-xl border border-stone-300 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-base sm:text-sm leading-relaxed text-stone-900 placeholder:text-stone-400"
                />
              </div>

              {/* 사진 첨부 선택 */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-1.5 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                  <span>오늘의 사진 1장 첨부</span>
                </label>
                <div className="flex gap-2.5">
                  {samplePhotos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedPhoto(url)}
                      className={`relative w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedPhoto === url
                          ? 'border-[#6B1724] ring-2 ring-[#6B1724]/30 scale-105'
                          : 'border-stone-200 opacity-60 hover:opacity-90'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="sample" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 실링 왁스 색상 선택 */}
              <div>
                <label className="block text-xs font-sans-ui text-stone-600 mb-2">
                  봉인할 실링 왁스 인장 색상
                </label>
                <div className="flex gap-3">
                  {WAX_COLORS.map((wax) => (
                    <button
                      key={wax.hex}
                      type="button"
                      onClick={() => setSelectedColor(wax.hex)}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-sans-ui flex items-center justify-center gap-2 transition-all ${
                        selectedColor === wax.hex
                          ? 'border-stone-800 bg-white shadow-sm ring-2 ring-stone-800/10 font-bold'
                          : 'border-stone-200 bg-stone-50/70 text-stone-600'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shadow-inner"
                        style={{ backgroundColor: wax.hex }}
                      />
                      <span className="hidden sm:inline">{wax.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 미션 설정 (사진 퍼즐, 우표 퍼즐, 시스템 데일리, 커스텀 퀴즈) */}
              <div className="pt-2 border-t border-stone-200">
                <label className="block text-xs font-sans-ui text-stone-600 mb-2">
                  상대방이 풀 관문 선택
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-[11px] font-sans-ui mb-3">
                  <button
                    type="button"
                    onClick={() => setMissionType('PUZZLE_PHOTO')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'PUZZLE_PHOTO' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>🧩 사진 퍼즐</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMissionType('PUZZLE_STAMP')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'PUZZLE_STAMP' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>📮 우표 맞추기</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMissionType('CUSTOM')}
                    className={`py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      missionType === 'CUSTOM' ? 'bg-white shadow-xs font-bold text-stone-900' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span>❓ 깜짝 퀴즈</span>
                  </button>
                </div>

                {missionType === 'PUZZLE_PHOTO' && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs font-serif-warm text-stone-700">
                    🧩 <strong>사진 조각 퍼즐</strong>: 내가 첨부한 사진이 3×3 슬라이딩 조각으로 분리되어, {partnerName} 님이 조각을 맞추면 일기가 개봉됩니다.
                  </div>
                )}

                {missionType === 'PUZZLE_STAMP' && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs font-serif-warm text-stone-700">
                    📮 <strong>빈티지 우표 맞추기</strong>: 편지 봉투의 우표 조각 4개를 순서대로 맞춰 소인 도장을 찍으면 일기가 개봉됩니다.
                  </div>
                )}

                {missionType === 'CUSTOM' && (
                  <div className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
                    <input
                      type="text"
                      placeholder="질문 (예: 내가 오늘 점심에 먹은 메뉴는?)"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-serif-warm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="정답 (예: 김치찌개)"
                        value={customQuizAnswer}
                        onChange={(e) => setCustomQuizAnswer(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-serif-warm"
                      />
                      <input
                        type="text"
                        placeholder="힌트 (예: 얼큰한 찌개)"
                        value={customQuizHint}
                        onChange={(e) => setCustomQuizHint(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-serif-warm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 발송 버튼 */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 text-amber-200" />
                  <span>실링 왁스로 꾹 봉인하여 발송하기</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
