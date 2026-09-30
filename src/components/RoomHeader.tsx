'use client';

import React from 'react';
import { UIState } from '@/types/diary';
import { Heart, PenLine, RotateCcw, Scroll, Users, ArrowLeftRight, BookOpen, ShieldCheck } from 'lucide-react';

interface RoomHeaderProps {
  currentState: UIState;
  onSelectState: (state: UIState) => void;
  onOpenWriteModal: () => void;
  onOpenArchive?: () => void;
  onResetDemo: () => void;
  onSwitchUser?: () => void;
  roomCode: string;
  userName: string;
  partnerName: string;
}

export default function RoomHeader({
  currentState,
  onSelectState,
  onOpenWriteModal,
  onOpenArchive,
  onResetDemo,
  onSwitchUser,
  roomCode,
  userName,
  partnerName,
}: RoomHeaderProps) {
  const states: { id: UIState; label: string; icon: string }[] = [
    { id: 'VIEW_ONBOARDING', label: '0. 방 생성/매칭', icon: '🔑' },
    { id: 'VIEW_WAITING', label: '1. 상대방 턴 대기', icon: '⏳' },
    { id: 'VIEW_SEALED_LETTER', label: '2. 미션 게이트 대기', icon: '🔒' },
    { id: 'VIEW_WAX_READY', label: '3. 실링 왁스 3초 개봉', icon: '🕯️' },
    { id: 'VIEW_OPENED_DIARY', label: '4. 일기 열람 완료', icon: '📖' },
  ];

  const isMatched = currentState !== 'VIEW_ONBOARDING';

  return (
    <header className="w-full bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFD3] sticky top-0 z-40 px-3.5 sm:px-5 pt-[calc(env(safe-area-inset-top,0px)+0.65rem)] pb-2 sm:pb-3 shrink-0 shadow-2xs">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
        {/* 상단 정보 행 (모바일에서는 로고/이름과 우측 간편 액션 분할) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center font-serif-warm font-bold text-base sm:text-lg shadow-sm border border-amber-200/20 shrink-0">
              溫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-warm font-bold text-stone-900 text-lg sm:text-xl leading-tight">온기</span>
                <span className="text-xs font-serif-warm text-stone-500 hidden xs:inline">· Warmth</span>
                {isMatched && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-900 text-xs font-mono font-bold border border-amber-200/60">
                    #{roomCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-600 font-sans-ui leading-tight mt-0.5">
                {isMatched ? (
                  <>
                    <button
                      type="button"
                      onClick={onSwitchUser}
                      title="클릭하여 상대방 시점으로 전환 (2인 시뮬레이션)"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 hover:bg-amber-100/80 border border-stone-200 hover:border-amber-300 text-stone-700 hover:text-amber-900 transition-all active:scale-95 text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <span className="font-bold text-[#6B1724]">👤 {userName}</span>
                      <ArrowLeftRight className="w-3 h-3 text-stone-400" />
                      <span className="text-stone-500 font-normal">{partnerName}</span>
                    </button>
                  </>
                ) : (
                  <span className="text-amber-800 font-medium text-xs">일기장 연결 대기 중</span>
                )}
              </div>
            </div>
          </div>

          {/* 모바일 우측 빠른 액션 */}
          <div className="flex sm:hidden items-center gap-1.5">
            {isMatched && (
              <button
                onClick={onOpenArchive}
                title="둘만의 서재 (암호화 보관함)"
                className="p-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95 cursor-pointer shadow-2xs relative"
              >
                <BookOpen className="w-4 h-4 text-[#6B1724]" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </button>
            )}
            <button
              onClick={onResetDemo}
              title="초기 상태로 되돌리기"
              className="p-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm min-h-[38px] min-w-[38px] flex items-center justify-center active:scale-95 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            {isMatched && (
              <button
                onClick={onOpenWriteModal}
                className="px-3.5 py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs flex items-center gap-1.5 min-h-[38px] active:scale-95 cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5 text-amber-200" />
                <span>일기 쓰기</span>
              </button>
            )}
          </div>
        </div>

        {/* 데모 상태 전환 컨트롤러 (모바일에서 부드러운 가로 스와이프) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          {/* 상태 탭 셀렉터 */}
          <div className="inline-flex bg-stone-200/70 p-1 rounded-xl text-xs font-sans-ui shrink-0">
            {states.map((st) => (
              <button
                key={st.id}
                onClick={() => onSelectState(st.id)}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[30px] sm:min-h-[34px] font-medium cursor-pointer ${
                  currentState === st.id
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span className="text-xs sm:text-sm">{st.icon}</span>
                <span className="text-xs sm:text-sm">{st.label}</span>
              </button>
            ))}
          </div>

          {/* 데스크탑 서재 아카이브 버튼 */}
          {isMatched && (
            <button
              onClick={onOpenArchive}
              title="둘만의 서재 (암호화 보관함 열기)"
              className="hidden sm:flex px-3 py-2 rounded-xl border border-stone-300 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800 text-xs font-serif-warm font-bold shadow-2xs items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
            >
              <BookOpen className="w-4 h-4 text-[#6B1724]" />
              <span>둘만의 서재</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold">E2EE</span>
            </button>
          )}

          <button
            onClick={onResetDemo}
            title="초기 상태로 되돌리기"
            className="hidden sm:flex p-2 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-sm shrink-0 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {isMatched && (
            <button
              onClick={onOpenWriteModal}
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-sm transition-all items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PenLine className="w-4 h-4 text-amber-200" />
              <span>일기 쓰기</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

