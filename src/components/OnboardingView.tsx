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
  UserCheck,
  Loader2
} from 'lucide-react';

interface OnboardingViewProps {
  onMatched: (roomCode: string, myName: string, partnerName: string) => void;
}

export default function OnboardingView({ onMatched }: OnboardingViewProps) {
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const param = new URLSearchParams(window.location.search).get('user');
        if (param === 'yura') return 'JOIN';
      } catch {}
    }
    return 'CREATE';
  });

  const [myName, setMyName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const param = new URLSearchParams(window.location.search).get('user');
        if (param === 'yura') return '유라';
        if (param === 'joohyoung') return '주형';
      } catch {}
    }
    return '주형';
  });

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isWaitingPartner, setIsWaitingPartner] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Firestore 실시간 구독: 상대방이 방에 입장하면 자동으로 매칭 축하 및 입장 처리
  useEffect(() => {
    if (!generatedCode || !isWaitingPartner) return;

    const unsubscribe = subscribeRoom(generatedCode, (room) => {
      if (room.status === 'MATCHED' && room.members.length >= 2) {
        let partner = '유라';
        if (room.memberInfo) {
          const otherKey = Object.keys(room.memberInfo).find(
            (k) => room.memberInfo[k]?.role === 'PARTNER'
          );
          if (otherKey && room.memberInfo[otherKey]) {
            partner = room.memberInfo[otherKey].nickname;
          }
        }
        triggerMatchCelebration(generatedCode, myName, partner);
      }
    });

    return () => unsubscribe();
  }, [generatedCode, isWaitingPartner, myName]);

  // 1. 6자리 난수 코드 발급 및 실제 Firestore에 방 저장
  const handleGenerateCode = async () => {
    if (!myName.trim()) return;
    setIsLoading(true);
    try {
      const code = await createRoomInFirestore(myName.trim());
      setGeneratedCode(code);
      setIsWaitingPartner(true);
      soundEngine.playPaperRustle();
    } catch (e) {
      console.error('Failed to create room in Firestore', e);
      // 에러 발생 시 오프라인/로컬 난수 발급 fallback
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(fallbackCode);
      setIsWaitingPartner(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 클립보드 복사
  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 초대 링크 / 텍스트 공유
  const handleShareInvite = () => {
    if (!generatedCode) return;
    const shareText = `📮 [온기: 둘만의 비밀 교환일기]\n${myName} 님이 보낸 교환일기 초대코드입니다: [${generatedCode}]\n아날로그 서재에서 함께 일기를 써보아요.`;
    navigator.clipboard.writeText(shareText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 상대방 입장 시뮬레이션
  const handleSimulatePartnerJoin = async () => {
    if (!generatedCode) return;
    setIsLoading(true);
    try {
      await joinRoomInFirestore(generatedCode, '유라');
      triggerMatchCelebration(generatedCode, myName, '유라');
    } catch {
      triggerMatchCelebration(generatedCode, myName, '유라');
    } finally {
      setIsLoading(false);
    }
  };

  // 코드 입력하여 Firestore에서 방 조회 및 매칭
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

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
      let partner = '유라';
      if (res.room && res.room.memberInfo) {
        const otherKey = Object.keys(res.room.memberInfo).find(
          (k) => res.room?.memberInfo[k]?.role === 'CREATOR'
        );
        if (otherKey && res.room.memberInfo[otherKey]) {
          partner = res.room.memberInfo[otherKey].nickname;
        }
      }

      triggerMatchCelebration(inputCode.trim(), myName, partner);
    } catch (err) {
      console.error(err);
      setJoinError('데이터베이스 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 매칭 완료 축하 연출
  const triggerMatchCelebration = (code: string, me: string, partner: string) => {
    soundEngine.playMissionPassChime();

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#6B1724', '#B8860B', '#FDFBF7', '#E3B338'],
    });

    setTimeout(() => {
      onMatched(code, me, partner);
    }, 1200);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-2 sm:py-6 flex flex-col items-center my-auto">
      {/* 헤더 타이틀 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-3 sm:mb-6"
      >
        <div className="w-11 h-11 sm:w-14 sm:h-14 mx-auto rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center font-serif-warm text-xl sm:text-2xl font-bold shadow-md border-2 border-amber-200/30 mb-2">
          溫
        </div>
        <h1 className="font-serif-warm text-xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
          온기 · 둘만의 비밀 교환일기
        </h1>
        <p className="mt-1 text-stone-600 font-serif-warm text-[11px] sm:text-sm">
          서재 책상 위, 오직 둘만의 따뜻한 온기가 머무는 교환일기장을 열어보세요.
        </p>
      </motion.div>

      {/* 가죽 양장 스타일 카드 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full bg-[#FFFDF9] rounded-2xl p-4 sm:p-7 paper-texture border border-[#E8DFC8] shadow-xl relative overflow-hidden"
      >
        {/* 상단 탭 전환 (방 생성 vs 코드 참여) */}
        <div className="flex bg-[#F4EFEA] p-1 rounded-xl mb-4 sm:mb-6 text-xs font-sans-ui">
          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE');
              setJoinError('');
            }}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'CREATE'
                ? 'bg-white shadow-xs text-stone-900 font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookHeart className="w-3.5 h-3.5 text-[#6B1724]" />
            <span>새 일기장 만들기</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('JOIN');
              setJoinError('');
            }}
            className={`flex-1 py-1.5 sm:py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'JOIN'
                ? 'bg-white shadow-xs text-stone-900 font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-800" />
            <span>초대코드 입력하기</span>
          </button>
        </div>

        {/* 사용자 이름 입력 필드 (공통) */}
        <div className="mb-3.5 sm:mb-5">
          <label className="block text-[11px] sm:text-xs font-sans-ui text-stone-600 mb-1">
            일기장에 사용할 나의 이름 / 애칭
          </label>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="예: 주형"
            className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-serif-warm text-sm text-stone-900"
          />
        </div>

        {/* 탭 1: 방 새로 만들기 (6자리 난수 코드 발급 및 Firestore 저장) */}
        {activeTab === 'CREATE' && (
          <div className="space-y-3 sm:space-y-4">
            {!generatedCode ? (
              <div className="text-center py-2 sm:py-3">
                <p className="text-stone-600 text-xs sm:text-sm font-serif-warm mb-3.5 sm:mb-5 leading-relaxed">
                  방을 생성하면 상대방과 1:1로 매칭할 수 있는<br />
                  <strong>6자리 비밀 초대코드</strong>가 발급되어 데이터베이스에 보관됩니다.
                </p>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGenerateCode}
                  className="w-full py-3 sm:py-3.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-200" />
                  )}
                  <span>6자리 초대코드 발급받기</span>
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5"
              >
                {/* 6자리 난수 코드 카드 (스탬프 느낌) */}
                <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-[#D9CEBE] text-center relative overflow-hidden">
                  <div className="text-[11px] font-sans-ui text-amber-900/80 font-semibold tracking-wider uppercase mb-1">
                    둘만의 비밀 초대코드 (Firestore 보관 중)
                  </div>
                  <div className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.25em] text-[#6B1724] my-2 select-all">
                    {generatedCode}
                  </div>
                  <p className="text-[11px] text-stone-500 font-serif-warm">
                    유라 님에게 이 코드를 공유하여 일기장에 초대하세요.
                  </p>
                </div>

                {/* 코드 복사 & 공유 버튼들 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-50 active:scale-98 text-xs font-sans-ui font-medium text-stone-700 flex items-center justify-center gap-1.5 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span>코드 복사하기</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareInvite}
                    className="py-2.5 px-3 rounded-xl bg-amber-900/10 hover:bg-amber-900/15 border border-amber-900/20 active:scale-98 text-xs font-sans-ui font-medium text-amber-950 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-800" />
                    <span>초대장 문구 복사</span>
                  </button>
                </div>

                {/* 상대방 대기 상태 안내 */}
                {isWaitingPartner && (
                  <div className="p-4 rounded-xl bg-[#FFFDF9] border border-amber-200/80 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                    <div className="text-xs text-stone-700 font-serif-warm flex-1">
                      상대방이 코드를 입력하고 입장하기를 기다리는 중입니다...
                    </div>
                  </div>
                )}

                {/* 개발/테스트용 즉시 매칭 시뮬레이션 버튼 */}
                <div className="pt-2 border-t border-stone-200">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSimulatePartnerJoin}
                    className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-98 text-xs font-sans-ui text-stone-700 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>(시뮬레이션) 상대방(유라) 입장시키기</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* 탭 2: 초대코드 입력하기 (Firestore 1:1 매칭 검증) */}
        {activeTab === 'JOIN' && (
          <form onSubmit={handleJoinSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-sans-ui text-stone-600 mb-1.5">
                상대방에게 전달받은 6자리 코드
              </label>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6자리 숫자 (예: 829104)"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#6B1724]/20 focus:border-[#6B1724] font-mono text-center text-xl tracking-[0.2em] font-bold text-stone-900"
              />
            </div>

            {joinError && (
              <p className="text-xs text-rose-600 font-sans-ui text-center">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] active:scale-[0.99] text-amber-50 font-serif-warm font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
              ) : (
                <HeartHandshake className="w-4 h-4 text-amber-200" />
              )}
              <span>일기장 연결하고 입장하기</span>
            </button>
          </form>
        )}
      </motion.div>

      {/* 하단 감성 가이드 문구 */}
      <div className="mt-8 text-center text-stone-500 text-xs font-serif-warm flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6B1724]" />
        <span>온기는 Firestore `rooms` 컬렉션에 암호화 보관됩니다</span>
      </div>
    </div>
  );
}
