'use client';

import React from 'react';
import { UIState } from '@/types/diary';
import { Heart, Sparkles, PenLine, RotateCcw } from 'lucide-react';

interface RoomHeaderProps {
  currentState: UIState;
  onSelectState: (state: UIState) => void;
  onOpenWriteModal: () => void;
  onResetDemo: () => void;
}

export default function RoomHeader({
  currentState,
  onSelectState,
  onOpenWriteModal,
  onResetDemo,
}: RoomHeaderProps) {
  const states: { id: UIState; label: string; icon: string }[] = [
    { id: 'VIEW_WAITING', label: '1. 상대방 턴 대기', icon: '⏳' },
    { id: 'VIEW_SEALED_LETTER', label: '2. 미션 게이트 대기', icon: '🔒' },
    { id: 'VIEW_WAX_READY', label: '3. 실링 왁스 3초 개봉', icon: '🕯️' },
    { id: 'VIEW_OPENED_DIARY', label: '4. 일기 열람 완료', icon: '📖' },
  ];

  return (
    <header className="w-full bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E8DFD3] sticky top-0 z-40 px-4 py-3">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* 서비스 타이틀 & 페어링 정보 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center font-serif-warm font-bold text-sm shadow-sm">
            溫
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif-warm font-bold text-stone-900 text-base">온기</span>
              <span className="text-xs font-serif-warm text-stone-500">· Warmth</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-mono font-medium">
                #829104
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-stone-500 font-sans-ui">
              <span>주형</span>
              <Heart className="w-2.5 h-2.5 text-rose-500 fill-current" />
              <span>유라 (매칭 완료)</span>
            </div>
          </div>
        </div>

        {/* 데모 상태 전환 컨트롤러 & 일기 쓰기 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 상태 탭 셀렉터 */}
          <div className="inline-flex bg-stone-200/70 p-1 rounded-xl text-xs font-sans-ui">
            {states.map((st) => (
              <button
                key={st.id}
                onClick={() => onSelectState(st.id)}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  currentState === st.id
                    ? 'bg-white shadow-xs text-stone-900 font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>{st.icon}</span>
                <span className="hidden md:inline">{st.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onResetDemo}
            title="초기 상태로 되돌리기"
            className="p-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenWriteModal}
            className="px-3 py-1.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-medium shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <PenLine className="w-3.5 h-3.5 text-amber-200" />
            <span>일기 쓰기</span>
          </button>
        </div>
      </div>
    </header>
  );
}
