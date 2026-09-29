'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaxColor, WAX_COLORS, MissionData, DiaryData } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { compressImage, uploadPhotoIfPossible, CompressedImageResult } from '@/lib/imageUtils';
import { 
  X, 
  Send, 
  Image as ImageIcon, 
  Sparkles, 
  Feather, 
  HelpCircle, 
  Upload, 
  Camera, 
  Check, 
  Loader2, 
  Trash2 
} from 'lucide-react';

interface WriteDiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDiary: (newDiary: Partial<DiaryData>) => void;
  currentUserName: string;
  partnerName: string;
  roomCode?: string;
}

export default function WriteDiaryModal({
  isOpen,
  onClose,
  onSaveDiary,
  currentUserName,
  partnerName,
  roomCode = '829104',
}: WriteDiaryModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<WaxColor>('#6B1724');
  const [missionType, setMissionType] = useState<'PUZZLE_PHOTO' | 'PUZZLE_STAMP' | 'SYSTEM' | 'CUSTOM'>('PUZZLE_PHOTO');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customQuizAnswer, setCustomQuizAnswer] = useState('');
  const [customQuizHint, setCustomQuizHint] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadedPhotoInfo, setUploadedPhotoInfo] = useState<CompressedImageResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 기기 내 사진 파일 선택 시 클라이언트 사이드 압축 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setIsCompressing(true);
    try {
      // 스마트폰 원본 사진을 1200px / ~150KB 수준으로 즉시 압축 (DB 용량 절약)
      const compressed = await compressImage(file);
      setUploadedPhotoInfo(compressed);
      setSelectedPhoto(compressed.dataUrl);
      soundEngine.playTileSlideSound();
    } catch (err) {
      console.error('Image compression error:', err);
      alert('사진을 불러오는 중 오류가 발생했습니다. 다른 사진을 선택해주세요.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || isSubmitting || isCompressing) return;

    // 사진 퍼즐 관문 선택 시 사진 첨부 필수 검증
    if (missionType === 'PUZZLE_PHOTO' && !selectedPhoto) {
      setPhotoError('사진 조각 퍼즐 관문을 풀게 하려면 사진을 1장 올려주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      try {
        soundEngine.playWaxCrackSound();
      } catch (audioErr) {
        console.warn('Audio notice:', audioErr);
      }

      let finalPhotoUrl = selectedPhoto;

      // 직접 업로드한 base64 사진인 경우, Storage 업로드 시도 (실패 시 base64 그대로 안전 저장)
      if (selectedPhoto && selectedPhoto.startsWith('data:')) {
        try {
          finalPhotoUrl = await uploadPhotoIfPossible(roomCode, selectedPhoto);
        } catch (e) {
          console.warn('Storage upload fallback:', e);
        }
      }

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
        photos: finalPhotoUrl ? [finalPhotoUrl] : [],
        waxColor: selectedColor,
        mission,
        authorName: currentUserName,
        recipientName: partnerName,
        createdAt: new Date().toISOString(),
        isWaxBroken: false,
      });

      // 입력 폼 초기화
      setTitle('');
      setContent('');
      setSelectedPhoto(null);
      setUploadedPhotoInfo(null);
      setPhotoError('');
      setCustomPrompt('');
      setCustomQuizAnswer('');
      setCustomQuizHint('');

      onClose();
    } catch (err) {
      console.error('Failed to save diary:', err);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
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

              {/* 사진 첨부 선택 (사용자 기기 직접 업로드) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-sans-ui text-stone-600 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                    <span>오늘의 사진 첨부 (선택)</span>
                  </label>
                  {uploadedPhotoInfo && (
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      직접 업로드됨 ({uploadedPhotoInfo.sizeKb}KB 압축)
                    </span>
                  )}
                </div>

                {/* 숨겨진 파일 인풋 (모바일 카메라/갤러리 대응) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* 업로드된 사진 미리보기 또는 업로드 버튼 */}
                {selectedPhoto && uploadedPhotoInfo ? (
                  <div className="flex items-center gap-3 p-3 bg-[#FAF6EE] rounded-xl border border-[#E0D3C1]">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-300 shrink-0 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedPhoto}
                        alt="Uploaded"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-serif-warm font-bold text-stone-800 truncate">
                        {uploadedPhotoInfo.fileName}
                      </p>
                      <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5">
                        {uploadedPhotoInfo.width}×{uploadedPhotoInfo.height}px · {uploadedPhotoInfo.sizeKb}KB로 자동 최적화됨
                      </p>
                      <div className="flex items-center gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-amber-900 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-700" />
                          <span>다른 사진으로 변경</span>
                        </button>
                        <span className="text-stone-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedPhotoInfo(null);
                            setSelectedPhoto(null);
                          }}
                          className="text-[11px] text-rose-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>사진 삭제</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isCompressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 px-4 rounded-xl border-2 border-dashed border-[#C4A882] hover:border-[#6B1724] bg-[#FAF6EE]/80 hover:bg-[#F5ECE0] text-stone-700 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.99] group cursor-pointer"
                  >
                    {isCompressing ? (
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        <Loader2 className="w-6 h-6 text-[#6B1724] animate-spin" />
                        <span className="text-xs font-serif-warm text-stone-700 font-bold">사진 최적화 압축 중...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-[#DECDBB] flex items-center justify-center group-hover:scale-105 transition-transform text-[#6B1724]">
                          <Upload className="w-5 h-5 stroke-[1.8]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-serif-warm font-bold text-stone-800">
                            내 앨범이나 카메라에서 사진 올리기
                          </p>
                          <p className="text-[11px] text-stone-500 font-sans-ui mt-0.5">
                            스마트폰 원본 사진을 올려도 용량이 자동으로 최적화됩니다
                          </p>
                        </div>
                      </>
                    )}
                  </button>
                )}

                {photoError && (
                  <p className="text-xs text-rose-600 font-sans-ui flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{photoError}</span>
                  </p>
                )}
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
                  disabled={isSubmitting || isCompressing}
                  className="w-full py-3.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] disabled:opacity-50 text-amber-50 font-serif-warm font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 text-amber-200 animate-spin" />
                      <span>실링 왁스로 봉인 중...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-amber-200" />
                      <span>실링 왁스로 꾹 봉인하여 발송하기</span>
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
