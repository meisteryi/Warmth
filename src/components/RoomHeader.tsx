'use client';

import React from 'react';
import { UIState } from '@/types/diary';
import { Heart, PenLine, RotateCcw, Scroll } from 'lucide-react';

interface RoomHeaderProps {
  currentState: UIState;
  onSelectState: (state: UIState) => void;
  onOpenWriteModal: () => void;
  onResetDemo: () => void;
  roomCode: string;
  userName: string;
  partnerName: string;
}

export default function RoomHeader({
  currentState,
  onSelectState,
  onOpenWriteModal,
  onResetDemo,
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
    <header className="w-full bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E8DFD3] sticky top-0 z-40 px-3 sm:px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2.5">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* 상단 정보 행 (모바일에서는 로고/이름과 우측 간편 액션 분할) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center font-serif-warm font-bold text-sm shadow-sm shrink-0">
              溫
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif-warm font-bold text-stone-900 text-base">온기</span>
                <span className="text-xs font-serif-warm text-stone-500">· Warmth</span>
                {isMatched && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-medium">
                    #{roomCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-stone-500 font-sans-ui">
                {isMatched ? (
                  <>
                    <span>{userName}</span>
                    <Heart className="w-2.5 h-2.5 text-rose-500 fill-current" />
                    <span>{partnerName}</span>
                  </>
                ) : (
                  <span className="text-amber-800 font-medium">새 일기장 페어링 대기 중</span>
                )}
              </div>
            </div>
          </div>

          {/* 모바일 우측 빠른 액션 */}
          <div className="flex sm:hidden items-center gap-1.5">
            <button
              onClick={onResetDemo}
              title="초기 상태로 되돌리기"
              className="p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {isMatched && (
              <button
                onClick={onOpenWriteModal}
                className="px-2.5 py-1.5 rounded-xl bg-[#6B1724] text-amber-50 text-xs font-serif-warm font-medium shadow-sm flex items-center gap-1 min-h-[36px] active:scale-95"
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
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap min-h-[32px] ${
                  currentState === st.id
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>{st.icon}</span>
                <span className="text-[11px] sm:text-xs">{st.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onResetDemo}
            title="초기 상태로 되돌리기"
            className="hidden sm:flex p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {isMatched && (
            <button
              onClick={onOpenWriteModal}
              className="hidden sm:flex px-3 py-1.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-medium shadow-sm transition-all items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
            >
              <PenLine className="w-3.5 h-3.5 text-amber-200" />
              <span>일기 쓰기</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
