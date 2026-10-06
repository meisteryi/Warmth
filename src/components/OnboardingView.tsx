'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { soundEngine } from '@/lib/audio';
import { createRoomInFirestore, joinRoomInFirestore, subscribeRoom } from '@/lib/roomService';
import {
  KeyRound,
  Copy,
  Check,
  Share2,
  Sparkles,
  BookHeart,
  HeartHandshake,
  Clock,
  Loader2,
  Globe,
} from 'lucide-react';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';
import { useLanguage } from '@/lib/i18n';

const PENDING_ROOM_KEY = 'warmth_pending_created_room';

interface OnboardingViewProps {
  onMatched: (roomCode: string, myName: string, partnerName: string, role?: 'CREATOR' | 'PARTNER') => void;
}

export default function OnboardingView({ onMatched }: OnboardingViewProps) {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [myName, setMyName] = useState('');

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isWaitingPartner, setIsWaitingPartner] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // [2번 요구사항] 앱 재실행 시 초대코드 발급 후 대기 중이던 방 상태 자동 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(PENDING_ROOM_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.code && data?.creatorName) {
        // 24시간 이내에 생성된 유효한 대기 방만 복구
        if (Date.now() - (data.createdAt || 0) < 24 * 60 * 60 * 1000) {
          setGeneratedCode(data.code);
          setMyName(data.creatorName);
          setIsWaitingPartner(true);
          setActiveTab('CREATE');
        } else {
          localStorage.removeItem(PENDING_ROOM_KEY);
        }
      }
    } catch { }
  }, []);

  // Firestore 실시간 구독: 상대방이 방에 입장하면 자동으로 매칭 축하 및 입장 처리
  useEffect(() => {
    if (!generatedCode || !isWaitingPartner) return;

    const unsubscribe = subscribeRoom(generatedCode, (room) => {
      if (room.status === 'MATCHED' && room.members.length >= 2) {
        let partner = '상대방';
        if (room.memberInfo) {
          const otherKey = Object.keys(room.memberInfo).find(
            (k) => room.memberInfo[k]?.role === 'PARTNER'
          );
          if (otherKey && room.memberInfo[otherKey]) {
            partner = room.memberInfo[otherKey].nickname;
          }
        }
        triggerMatchCelebration(generatedCode, myName, partner, 'CREATOR');
      }
    });

    return () => unsubscribe();
  }, [generatedCode, isWaitingPartner, myName]);

  // 대기 취소 및 새로운 코드 발급으로 전환
  const handleCancelWaiting = () => {
    try {
      localStorage.removeItem(PENDING_ROOM_KEY);
    } catch { }
    setGeneratedCode(null);
    setIsWaitingPartner(false);
  };

  // 1. 6자리 난수 코드 발급 및 실제 Firestore에 방 저장 (대기 상태 임시 저장)
  const handleGenerateCode = async () => {
    if (!myName.trim()) {
      alert('일기장에 사용할 나의 이름이나 별명을 먼저 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const code = await createRoomInFirestore(myName.trim());
      setGeneratedCode(code);
      setIsWaitingPartner(true);
      try {
        localStorage.setItem(
          PENDING_ROOM_KEY,
          JSON.stringify({
            code,
            creatorName: myName.trim(),
            createdAt: Date.now(),
          })
        );
      } catch { }
      soundEngine.playPaperRustle();
    } catch (e) {
      console.error('Failed to create room in Firestore', e);
      // 에러 발생 시 오프라인/로컬 난수 발급 fallback
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(fallbackCode);
      setIsWaitingPartner(true);
      try {
        localStorage.setItem(
          PENDING_ROOM_KEY,
          JSON.stringify({
            code: fallbackCode,
            creatorName: myName.trim(),
            createdAt: Date.now(),
          })
        );
      } catch { }
    } finally {
      setIsLoading(false);
    }
  };

  // 클립보드 복사
  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 초대 링크 / 텍스트 공유
  const handleShareInvite = () => {
    if (!generatedCode) return;
    const shareText = `📮 [온기: 둘만의 비밀 교환일기]\n${myName} 님이 보낸 교환일기 초대코드입니다: [${generatedCode}]\n아날로그 서재에서 함께 일기를 써보아요.`;
    navigator.clipboard.writeText(shareText).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 코드 입력하여 Firestore에서 방 조회 및 매칭
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    if (!myName.trim()) {
      setJoinError('일기장에 사용할 나의 이름이나 별명을 먼저 입력해주세요.');
      return;
    }

    if (inputCode.trim().length !== 6) {
      setJoinError('6자리 초대 코드를 올바르게 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await joinRoomInFirestore(inputCode.trim(), myName.trim());
      if (!res.success) {
        setJoinError(res.message);
        setIsLoading(false);
        return;
      }

      // 파트너 닉네임 결정
      let partner = '상대방';
      if (res.room && res.room.memberInfo) {
        const otherKey = Object.keys(res.room.memberInfo).find(
          (k) => res.room?.memberInfo[k]?.role === 'CREATOR'
        );
        if (otherKey && res.room.memberInfo[otherKey]) {
          partner = res.room.memberInfo[otherKey].nickname;
        }
      }

      triggerMatchCelebration(inputCode.trim(), myName, partner, 'PARTNER');
    } catch (err) {
      console.error(err);
      setJoinError('데이터베이스 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 매칭 완료 축하 연출
  const triggerMatchCelebration = (
    code: string, 
    me: string, 
    partner: string, 
    role?: 'CREATOR' | 'PARTNER'
  ) => {
    try {
      localStorage.removeItem(PENDING_ROOM_KEY);
    } catch { }

    soundEngine.playMissionPassChime();

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#6B1724', '#B8860B', '#FDFBF7', '#E3B338'],
    });

    setTimeout(() => {
      onMatched(code, me, partner, role);
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto px-3 sm:px-4 py-2 sm:py-6 flex flex-col items-center my-auto"
    >
      {/* 우측 상단 언어 전환 토글 */}
      <div className="w-full flex justify-end mb-2">
        <div className="inline-flex rounded-lg border border-stone-200 bg-white/90 p-0.5 text-[11px] font-sans-ui shadow-2xs backdrop-blur-xs">
          <button
            type="button"
            onClick={() => {
              setLanguage('ko');
              soundEngine.playTileSlideSound();
            }}
            className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
              language === 'ko' ? 'bg-[#6B1724] text-amber-50 shadow-xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => {
              setLanguage('en');
              soundEngine.playTileSlideSound();
            }}
            className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
              language === 'en' ? 'bg-[#6B1724] text-amber-50 shadow-xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* 헤더 타이틀 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3 sm:mb-5"
      >
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-md border-2 border-amber-200/40 mb-2">
          <WarmthHanjaIcon className="w-6 h-6 sm:w-7 sm:h-7 text-amber-100" />
        </div>
        <h1 className="font-serif-warm text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          {language === 'en' ? 'Warmth' : '온기'}
        </h1>
        <p className="mt-1 text-stone-600 font-serif-warm text-sm font-medium">
          {t('onboarding.subtitle')}
        </p>
      </motion.div>

      {/* 가죽 양장 스타일 카드 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full bg-[#FFFDF9] rounded-2xl p-4 sm:p-7 paper-texture border border-[#E8DFC8] shadow-xl relative overflow-hidden"
      >
        {/* 상단 탭 전환 (방 생성 vs 코드 참여) */}
        <div className="flex bg-[#F4EFEA] p-1 rounded-xl mb-4 sm:mb-6 text-sm font-sans-ui">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE');
              setJoinError('');
            }}
            className={`flex-1 py-2.5 sm:py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'CREATE'
              ? 'bg-white shadow-xs text-stone-900 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
              }`}
          >
            <BookHeart className="w-4 h-4 text-[#6B1724]" />
            <span>{t('onboarding.createRoom')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('JOIN');
              setJoinError('');
            }}
            className={`flex-1 py-2.5 sm:py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'JOIN'
              ? 'bg-white shadow-xs text-stone-900 font-bold'
              : 'text-stone-500 hover:text-stone-800 font-medium'
              }`}
          >
            <KeyRound className="w-4 h-4 text-amber-800" />
            <span>{t('onboarding.joinRoom')}</span>
          </button>
        </div>

        {/* 사용자 이름 입력 필드 (공통) */}
        <div className="mb-4 sm:mb-5">
          <label className="block text-xs sm:text-sm font-semibold text-stone-700 mb-1.5 font-sans-ui">
            {language === 'en' ? 'My Name / Nickname' : '내 이름 / 애칭'}
          </label>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            disabled={isWaitingPartner}
            placeholder="예: 민우, 서연 또는 나만의 애칭"
            className="w-full px-3.5 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-base text-stone-900 font-medium placeholder:text-stone-400 disabled:bg-stone-100 disabled:text-stone-500"
          />
        </div>

        {/* 탭 1: 방 새로 만들기 */}
        {activeTab === 'CREATE' && (
          <div className="space-y-4">
            {!generatedCode ? (
              <div className="text-center py-3 sm:py-4">
                <p className="text-stone-700 text-sm sm:text-base font-serif-warm mb-5 leading-relaxed font-medium">
                  초대코드를 발급받아 상대방에게 전해보세요.
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGenerateCode}
                  className="w-full py-3.5 sm:py-4 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-200" />
                  )}
                  <span>초대코드 발급받기</span>
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 sm:space-y-5"
              >
                {/* 6자리 난수 코드 카드 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-[#D9CEBE] text-center relative overflow-hidden">
                  <div className="text-xs sm:text-sm font-sans-ui text-amber-900 font-bold tracking-wider mb-1">
                    비밀 초대코드
                  </div>
                  <div className="font-mono text-4xl sm:text-5xl font-bold tracking-[0.25em] text-[#6B1724] my-2 sm:my-3 select-all">
                    {generatedCode}
                  </div>
                  <p className="text-xs sm:text-sm text-stone-600 font-serif-warm font-medium">
                    상대방에게 이 코드를 알려주세요.
                  </p>
                </div>

                {/* 코드 복사 & 공유 버튼들 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="py-3 px-3 rounded-xl border border-stone-300 hover:bg-stone-50 active:scale-98 text-sm font-sans-ui font-semibold text-stone-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-stone-500" />
                        <span>코드 복사</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareInvite}
                    className="py-3 px-3 rounded-xl bg-amber-900/10 hover:bg-amber-900/15 border border-amber-900/20 active:scale-98 text-sm font-sans-ui font-semibold text-amber-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-amber-800" />
                    <span>초대장 복사</span>
                  </button>
                </div>

                {/* 상대방 대기 상태 안내 */}
                {isWaitingPartner && (
                  <div className="space-y-2">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-[#FFFDF9] border border-amber-200/80 flex items-center gap-3">
                      <Clock className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                      <div className="text-xs sm:text-sm text-stone-700 font-serif-warm flex-1 font-medium">
                        상대방이 입장하기를 기다리는 중...
                      </div>
                    </div>
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleCancelWaiting}
                        className="text-xs text-stone-500 hover:text-stone-800 underline font-sans-ui cursor-pointer transition-colors py-1"
                      >
                        대기 취소하고 새 코드 발급하기
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* 탭 2: 초대코드 입력하기 */}
        {activeTab === 'JOIN' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-stone-700 mb-1.5 font-sans-ui">
                전달받은 6자리 코드 입력
              </label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6자리 숫자"
                className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-mono text-center text-2xl sm:text-3xl tracking-[0.25em] font-bold text-stone-900"
              />
            </div>

            {joinError && (
              <p className="text-xs sm:text-sm text-rose-600 font-sans-ui text-center font-medium">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 sm:py-4 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
              ) : (
                <HeartHandshake className="w-4 h-4 text-amber-200" />
              )}
              <span>일기장 연결하기</span>
            </button>
          </form>
        )}

        {/* iOS Safari 7일 미접속 초기화 방지 안내 & 홈 화면 추가 팁 */}
        <div className="mt-5 p-3.5 sm:p-4 rounded-2xl bg-[#F4EFE6]/90 border border-[#E3D7C5] text-stone-700 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">💡</span>
            <div className="text-xs leading-relaxed font-sans-ui text-stone-600">
              <span className="font-bold text-amber-950 block mb-1">
                iOS Safari 이용 시 유의사항
              </span>
              사파리 일반 웹 브라우저에서는 애플의 보안 정책(ITP)으로 인해{' '}
              <strong className="text-amber-900 font-semibold">7일 동안 켜지지 않으면</strong> 로그인 및 방 연결 정보가 자동으로 초기화될 수 있습니다.
              <div className="mt-2 pt-2 border-t border-amber-900/10 text-stone-600">
                📌 사파리 하단의 <strong>공유 버튼( <Share2 className="w-3.5 h-3.5 inline text-amber-800 -mt-0.5" /> )</strong>을 누른 뒤{' '}
                <strong className="text-[#6B1724]">‘홈 화면에 추가’</strong>를 해주시면, 7일이 지나도 정보가 유지되고 앱처럼 푸시 알림도 받아보실 수 있습니다.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
