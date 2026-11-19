'use client';

import React, { useState } from 'react';
import { UIState } from '@/types/diary';
import {
  BookOpen,
  Settings,
  Heart,
  Check,
  Copy,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';

interface RoomHeaderProps {
  currentState: UIState;
  onOpenWriteModal?: () => void;
  onOpenArchive?: () => void;
  onLeaveRoom?: () => void;
  onGoHome?: () => void;
  onOpenMemoryJar?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  roomCode: string;
  userName: string;
  partnerName: string;
  isMyTurn?: boolean;
  isTodayDiaryWritten?: boolean;
  countdownFormatted?: string;
}

/**
 * 3D 온기 유리병 전용 아날로그 보틀 SVG 아이콘
 */
function GlassJarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 코르크 마개 */}
      <rect x="9" y="2" width="6" height="3" rx="1" fill="currentColor" fillOpacity="0.25" />
      {/* 병목 림 */}
      <path d="M7.5 5h9" />
      {/* 유리병 본체 */}
      <path d="M8 5v2.2a2.5 2.5 0 0 1-.7 1.8C6.5 9.8 6 11.2 6 12.8V19a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6.2c0-1.6-.5-3-1.3-3.8a2.5 2.5 0 0 1-.7-1.8V5" />
      {/* 내부 실링 왁스 인장 실루엣 */}
      <circle cx="12" cy="15.5" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

export default function RoomHeader({
  currentState,
  onOpenArchive,
  onGoHome,
  onOpenMemoryJar,
  onOpenSettings,
  roomCode,
  userName,
  partnerName,
}: RoomHeaderProps) {
  const { language, t } = useLanguage();
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const isMatched = currentState !== 'VIEW_ONBOARDING';

  return (
    <header className="sticky top-0 w-full bg-[#FAF7F2] border-b border-[#E8DFD3] shrink-0 z-40 px-3.5 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.65rem)] pb-2.5 sm:pb-3 select-none">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* 좌측: 로고 및 다정한 커플 상태 (클릭 시 홈으로 이동) */}
        <div 
          onClick={onGoHome}
          className={`flex items-center gap-2 sm:gap-2.5 shrink-0 ${onGoHome ? 'cursor-pointer group' : ''}`}
          title={onGoHome ? '홈 화면으로 이동' : undefined}
        >
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-sm border border-amber-200/20 shrink-0 ${onGoHome ? 'group-hover:scale-105 transition-transform' : ''}`}>
            <WarmthHanjaIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-100" />
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-serif-warm font-bold text-stone-900 text-lg sm:text-xl leading-none whitespace-nowrap shrink-0">
                {language === 'en' ? 'Warmth' : '온기'}
              </span>
              {language === 'ko' && (
                <span className="text-xs font-serif-warm text-stone-400 hidden sm:inline whitespace-nowrap">· Warmth</span>
              )}
              {isMatched && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyCode();
                  }}
                  title={t('menu.copy')}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100/90 hover:bg-amber-200/80 text-amber-950 text-[11px] sm:text-xs font-mono font-bold border border-amber-300/60 transition-colors cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                >
                  <span>#{roomCode}</span>
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-amber-800/70" />
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-sans-ui leading-tight mt-0.5 shrink-0">
              {isMatched ? (
                <div className="inline-flex items-center gap-1 text-stone-700 font-medium whitespace-nowrap">
                  <span className="font-bold text-[#6B1724] max-w-[55px] sm:max-w-[80px] truncate">{userName}</span>
                  <Heart className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                  <span className="text-stone-600 max-w-[55px] sm:max-w-[80px] truncate">{partnerName}</span>
                </div>
              ) : (
                <span className="text-amber-800 font-medium text-[11px] sm:text-xs whitespace-nowrap">
                  {language === 'en' ? 'Awaiting connection' : '일기장 연결 대기 중'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 정식 서비스 전용 액션 (홈, 둘만의 서재, 일기 쓰기, 더보기) */}
        {isMatched && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 온기 유리병 바로가기 버튼 (상단 바 토글 대응) */}
            {onOpenMemoryJar && (
              <button
                onClick={() => {
                  if (currentState === 'VIEW_MEMORY_JAR') {
                    onGoHome?.();
                  } else {
                    onOpenMemoryJar();
                  }
                }}
                title={
                  currentState === 'VIEW_MEMORY_JAR'
                    ? language === 'en'
                      ? 'Back to Desk'
                      : '책상으로 돌아가기'
                    : '온기 유리병 (기억의 병)'
                }
                className={`h-9 sm:h-10 px-2 sm:px-3 rounded-xl border text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                  currentState === 'VIEW_MEMORY_JAR'
                    ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/40 font-bold ring-1 ring-[#6B1724]/20'
                    : 'border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800'
                }`}
              >
                <GlassJarIcon className="w-4 h-4 text-[#6B1724] shrink-0" />
                <span className="hidden sm:inline">온기 병</span>
              </button>
            )}

            {/* 둘만의 서재 버튼 (상단바 고정 뷰 토글 대응) */}
            <button
              onClick={() => {
                if (currentState === 'VIEW_ARCHIVE') {
                  onGoHome?.();
                } else if (onOpenArchive) {
                  onOpenArchive();
                }
              }}
              title={currentState === 'VIEW_ARCHIVE' ? (language === 'en' ? 'Back to Desk' : '책상으로 돌아가기') : t('nav.archive')}
              className={`h-9 sm:h-10 px-2 sm:px-3 rounded-xl border text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                currentState === 'VIEW_ARCHIVE'
                  ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/40 font-bold ring-1 ring-[#6B1724]/20'
                  : 'border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#6B1724] shrink-0" />
              <span className="hidden sm:inline">{t('nav.archive')}</span>
            </button>

            {/* 설정 탭 버튼 (서재처럼 상단바 고정 인라인 뷰 토글) */}
            <button
              type="button"
              onClick={() => {
                if (currentState === 'VIEW_SETTINGS') {
                  onGoHome?.();
                } else if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
              title={
                currentState === 'VIEW_SETTINGS'
                  ? language === 'en'
                    ? 'Back to Desk'
                    : '책상으로 돌아가기'
                  : t('nav.more')
              }
              aria-label={t('nav.more')}
              aria-expanded={currentState === 'VIEW_SETTINGS'}
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border text-sm flex items-center justify-center shrink-0 active:scale-95 cursor-pointer shadow-2xs transition-colors ${
                currentState === 'VIEW_SETTINGS'
                  ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/40 ring-1 ring-[#6B1724]/20'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </header>
  );
}
