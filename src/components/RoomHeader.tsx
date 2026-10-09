'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UIState } from '@/types/diary';
import { 
  PenLine, 
  BookOpen, 
  LogOut, 
  MoreHorizontal, 
  Bell, 
  Copy, 
  Check, 
  Heart,
  Volume2,
  Volume1,
  VolumeX,
  Home,
  Clock,
  User,
  Globe,
} from 'lucide-react';
import { getNotificationStatus, requestNotificationPermission } from '@/lib/notifications';
import { soundEngine } from '@/lib/audio';
import { useLanguage } from '@/lib/i18n';

import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';

interface RoomHeaderProps {
  currentState: UIState;
  onOpenWriteModal: () => void;
  onOpenArchive?: () => void;
  onLeaveRoom?: () => void;
  onGoHome?: () => void;
  onOpenMemoryJar?: () => void;
  onOpenProfile?: () => void;
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
  onOpenWriteModal,
  onOpenArchive,
  onLeaveRoom,
  onGoHome,
  onOpenMemoryJar,
  onOpenProfile,
  roomCode,
  userName,
  partnerName,
  isMyTurn,
  isTodayDiaryWritten,
  countdownFormatted,
}: RoomHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [volume, setVolume] = useState<number>(0.8);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const status = getNotificationStatus();
    setNotifPermission(status.permission);
    setVolume(soundEngine.getVolume());
  }, []);

  // 외부 클릭 또는 ESC 키 누름 시 메뉴 닫기 (토글 버튼 클릭 시에는 버튼 onClick에서 안전하게 토글되도록 제외)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        (menuRef.current && menuRef.current.contains(target)) ||
        (buttonRef.current && buttonRef.current.contains(target))
      ) {
        return;
      }
      setIsMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleToggleNotification = async () => {
    if (notifPermission === 'granted') {
      alert('이미 알림 권한이 허용되어 있습니다. 새로운 일기나 노크가 올 때 알림이 전달됩니다.');
      return;
    }
    const status = getNotificationStatus();
    if (!status.isSupported) {
      alert('현재 브라우저 환경에서는 백그라운드 푸시 알림이 직접 지원되지 않습니다. 아이폰(iOS)의 경우 사파리 하단 공유 버튼(네모+화살표)을 눌러 "홈 화면에 추가"하신 뒤 앱처럼 실행하시면 잠금 화면에서도 백그라운드 푸시를 받으실 수 있습니다.');
      return;
    }
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      alert('🔔 알림이 켜졌습니다! 상대방이 보낸 새 일기와 노크를 백그라운드에서도 받아보실 수 있습니다.');
    } else if (result === 'denied') {
      alert('기기 설정에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서 알림 권한을 허용해주세요.');
    }
  };

  const isMatched = currentState !== 'VIEW_ONBOARDING';

  return (
    <header className="w-full bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFD3] sticky top-0 z-40 px-3.5 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.65rem)] pb-2.5 sm:pb-3 shrink-0 shadow-2xs">
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
            {/* 온기 유리병 바로가기 버튼 (상단 바 홈 버튼을 병 아이콘으로 변경) */}
            {onOpenMemoryJar && (
              <button
                onClick={onOpenMemoryJar}
                title="온기 유리병 (기억의 병)"
                className={`h-9 sm:h-10 px-2 sm:px-3 rounded-xl border text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                  currentState === 'VIEW_MEMORY_JAR'
                    ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/30'
                    : 'border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800'
                }`}
              >
                <GlassJarIcon className="w-4 h-4 text-[#6B1724] shrink-0" />
                <span className="hidden sm:inline">온기 병</span>
              </button>
            )}

            {/* 둘만의 서재 버튼 */}
            <button
              onClick={onOpenArchive}
              title={t('nav.archive')}
              className="h-9 sm:h-10 px-2 sm:px-3 rounded-xl border border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800 text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#6B1724] shrink-0" />
              <span className="hidden sm:inline">{t('nav.archive')}</span>
            </button>

            {/* 일기 쓰기 버튼 (상대방 답장 대기 상태 우선 판별 & 동일 높이 고정) */}
            <button
              onClick={() => onOpenWriteModal()}
              title={
                isMyTurn === false
                  ? language === 'en'
                    ? `It's ${partnerName}'s turn to write (Awaiting reply)`
                    : `${partnerName} 님의 작성 차례입니다 (답장을 기다려주세요)`
                  : isTodayDiaryWritten
                  ? language === 'en'
                    ? `Today's letter is already written. Resets at 04:00 AM (${countdownFormatted || ''})`
                    : `오늘의 일기는 이미 작성되었습니다. 내일 새벽 04:00에 리셋됩니다 (남은 시간: ${countdownFormatted || ''})`
                  : t('nav.write')
              }
              className={`h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-serif-warm font-bold shadow-xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                isMyTurn === false
                  ? 'bg-stone-200/90 hover:bg-stone-300/80 text-stone-600 border border-stone-300'
                  : isTodayDiaryWritten
                  ? 'bg-amber-100/70 hover:bg-amber-200/70 text-amber-950 border border-amber-300/80'
                  : 'bg-[#6B1724] hover:bg-[#831D2D] text-amber-50'
              }`}
            >
              {isMyTurn === false ? (
                <>
                  <PenLine className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span className="whitespace-nowrap">{t('nav.waiting')}</span>
                </>
              ) : isTodayDiaryWritten ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span className="whitespace-nowrap">{t('nav.reset')}</span>
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                  <span className="whitespace-nowrap">{t('nav.write')}</span>
                </>
              )}
            </button>

            {/* 더보기 메뉴 버튼 */}
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title={t('nav.more')}
              aria-label={t('nav.more')}
              aria-expanded={isMenuOpen}
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border text-sm flex items-center justify-center shrink-0 active:scale-95 cursor-pointer shadow-2xs transition-colors ${
                isMenuOpen
                  ? 'bg-stone-200/90 border-stone-400 text-stone-900'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 설정 / 더보기 팝오버 드롭다운 */}
      <AnimatePresence>
        {isMatched && isMenuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-3.5 sm:right-6 top-[calc(100%+6px)] w-64 bg-[#FAF7F2] rounded-2xl shadow-xl border border-[#E8DFD3] py-2 z-50 font-sans-ui text-stone-700"
          >
            {/* 0. 내 프로필 설정 (이름 · 생년월일) */}
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-stone-100/70 transition-colors text-xs cursor-pointer border-b border-[#E8DFD3]/80"
              >
                <span className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#6B1724]" />
                  <span className="font-semibold text-stone-800">{t('menu.profile')}</span>
                </span>
                <span className="text-[11px] text-stone-500 font-sans-ui flex items-center gap-1">
                  <span className="font-medium text-stone-700 max-w-[80px] truncate">{userName}</span>
                  <span className="text-stone-400">✏️</span>
                </span>
              </button>
            )}

            {/* 1. 방 정보 및 코드 복사 */}
            <div className="px-3.5 py-2 border-b border-[#E8DFD3]/80 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-stone-500 font-medium">{t('menu.roomCode')}</div>
                <div className="text-sm font-mono font-bold text-amber-950">#{roomCode}</div>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-100/70 border border-stone-200 text-xs font-semibold text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                title={t('menu.copy')}
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                <span>{copiedCode ? t('menu.copied') : t('menu.copy')}</span>
              </button>
            </div>

            {/* 2. 웹 푸시 알림 설정 토글 */}
            <button
              onClick={handleToggleNotification}
              className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-stone-100/70 transition-colors text-xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-[#6B1724]" />
                <span className="font-medium text-stone-800">{t('menu.pushNotification')}</span>
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {notifPermission === 'granted' ? t('menu.notificationOn') : t('menu.notificationEnable')}
              </span>
            </button>

            {/* 3. 효과음 볼륨 조절 */}
            <div className="px-3.5 py-2.5 border-t border-[#E8DFD3]/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-medium text-stone-800">
                  {volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-stone-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-3.5 h-3.5 text-[#6B1724]" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#6B1724]" />
                  )}
                  <span>{t('menu.volume')}</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-stone-600">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    soundEngine.setVolume(val);
                  }}
                  onMouseUp={() => {
                    soundEngine.playTileSlideSound();
                  }}
                  onTouchEnd={() => {
                    soundEngine.playTileSlideSound();
                  }}
                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#6B1724]"
                />
              </div>
            </div>

            {/* 4. 한국어 / 영어 언어 전환 */}
            <div className="px-3.5 py-2.5 border-t border-[#E8DFD3]/80 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium text-stone-800">
                <Globe className="w-3.5 h-3.5 text-[#6B1724]" />
                <span>{t('menu.language')}</span>
              </span>
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-[11px] font-sans-ui">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('ko');
                    soundEngine.playTileSlideSound();
                  }}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-all ${
                    language === 'ko'
                      ? 'bg-white text-[#6B1724] shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
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
                    language === 'en'
                      ? 'bg-white text-[#6B1724] shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* 5. 사파리 7일 보관 안내 */}
            <div className="px-3.5 py-2 text-[10.5px] text-stone-500 leading-snug border-t border-[#E8DFD3]/60 bg-amber-50/40">
              💡 {t('menu.safariNotice')}
            </div>

            {/* 6. 방 나가기 */}
            {onLeaveRoom && (
              <div className="border-t border-[#E8DFD3]/80 pt-1 mt-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLeaveRoom();
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50/60 transition-colors text-xs cursor-pointer font-sans-ui"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('menu.leaveRoom')}</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
