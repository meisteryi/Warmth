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
} from 'lucide-react';
import { getNotificationStatus, requestNotificationPermission } from '@/lib/notifications';
import { soundEngine } from '@/lib/audio';

import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';

interface RoomHeaderProps {
  currentState: UIState;
  onOpenWriteModal: () => void;
  onOpenArchive?: () => void;
  onLeaveRoom?: () => void;
  onGoHome?: () => void;
  onOpenProfile?: () => void;
  roomCode: string;
  userName: string;
  partnerName: string;
  isMyTurn?: boolean;
  isTodayDiaryWritten?: boolean;
  countdownFormatted?: string;
}

export default function RoomHeader({
  currentState,
  onOpenWriteModal,
  onOpenArchive,
  onLeaveRoom,
  onGoHome,
  onOpenProfile,
  roomCode,
  userName,
  partnerName,
  isMyTurn,
  isTodayDiaryWritten,
  countdownFormatted,
}: RoomHeaderProps) {
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
                온기
              </span>
              <span className="text-xs font-serif-warm text-stone-400 hidden sm:inline whitespace-nowrap">· Warmth</span>
              {isMatched && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyCode();
                  }}
                  title="초대코드 복사하기"
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
                <span className="text-amber-800 font-medium text-[11px] sm:text-xs whitespace-nowrap">일기장 연결 대기 중</span>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 정식 서비스 전용 액션 (홈, 둘만의 서재, 일기 쓰기, 더보기) */}
        {isMatched && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 홈 바로가기 버튼 */}
            {onGoHome && (
              <button
                onClick={onGoHome}
                title="홈 화면"
                className={`h-9 sm:h-10 px-2 sm:px-3 rounded-xl border text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                  currentState === 'VIEW_HOME'
                    ? 'bg-[#6B1724]/10 text-[#6B1724] border-[#6B1724]/30'
                    : 'border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800'
                }`}
              >
                <Home className="w-4 h-4 text-[#6B1724] shrink-0" />
                <span className="hidden sm:inline">홈</span>
              </button>
            )}

            {/* 둘만의 서재 버튼 */}
            <button
              onClick={onOpenArchive}
              title="둘만의 서재 (지난 일기 보관함)"
              className="h-9 sm:h-10 px-2 sm:px-3 rounded-xl border border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800 text-xs font-serif-warm font-bold shadow-2xs flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#6B1724] shrink-0" />
              <span className="hidden sm:inline">서재</span>
            </button>

            {/* 일기 쓰기 버튼 (상대방 답장 대기 상태 우선 판별 & 동일 높이 고정) */}
            <button
              onClick={onOpenWriteModal}
              title={
                isMyTurn === false
                  ? `${partnerName} 님의 작성 차례입니다 (답장을 기다려주세요)`
                  : isTodayDiaryWritten
                  ? `오늘의 일기는 이미 작성되었습니다. 내일 새벽 04:00에 리셋됩니다 (남은 시간: ${countdownFormatted || ''})`
                  : '새 일기 쓰기'
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
                  <span className="whitespace-nowrap">답장 대기</span>
                </>
              ) : isTodayDiaryWritten ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span className="whitespace-nowrap">04시 리셋</span>
                </>
              ) : (
                <>
                  <PenLine className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                  <span className="whitespace-nowrap">일기 쓰기</span>
                </>
              )}
            </button>

            {/* 더보기 메뉴 버튼 */}
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="더보기 설정"
              aria-label="더보기 설정"
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
                  <span className="font-semibold text-stone-800">내 프로필 편집</span>
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
                <div className="text-[10px] text-stone-500 font-medium">연결된 일기장 방 코드</div>
                <div className="text-sm font-mono font-bold text-amber-950">#{roomCode}</div>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-amber-100/70 border border-stone-200 text-xs font-semibold text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                title="방 코드 복사"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                <span>{copiedCode ? '복사됨' : '복사'}</span>
              </button>
            </div>

            {/* 2. 웹 푸시 알림 설정 토글 */}
            <button
              onClick={handleToggleNotification}
              className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-stone-100/70 transition-colors text-xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-[#6B1724]" />
                <span className="font-medium text-stone-800">새 일기/노크 알림</span>
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {notifPermission === 'granted' ? '켜짐' : '알림 켜기'}
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
                  <span>효과음 볼륨</span>
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

            {/* 3. 사파리 7일 보관 안내 */}
            <div className="px-3.5 py-2 text-[10.5px] text-stone-500 leading-snug border-t border-[#E8DFD3]/60 bg-amber-50/40">
              💡 Safari 7일 미접속 초기화 방지를 위해 <strong>‘홈 화면에 추가’</strong>를 권장합니다.
            </div>

            {/* 4. 방 나가기 */}
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
                  <span>일기장 연결 해제 (방 나가기)</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
