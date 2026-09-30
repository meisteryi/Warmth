'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UIState } from '@/types/diary';
import { 
  PenLine, 
  BookOpen, 
  LogOut, 
  MoreHorizontal, 
  Bell, 
  Copy, 
  Check, 
  Heart 
} from 'lucide-react';
import { getNotificationStatus, requestNotificationPermission } from '@/lib/notifications';

interface RoomHeaderProps {
  currentState: UIState;
  onOpenWriteModal: () => void;
  onOpenArchive?: () => void;
  onLeaveRoom?: () => void;
  roomCode: string;
  userName: string;
  partnerName: string;
}

export default function RoomHeader({
  currentState,
  onOpenWriteModal,
  onOpenArchive,
  onLeaveRoom,
  roomCode,
  userName,
  partnerName,
}: RoomHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const status = getNotificationStatus();
    setNotifPermission(status.permission);
  }, []);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      alert('🔔 알림이 켜졌습니다! 상대방이 보낸 새 일기와 노크를 실시간으로 받아보실 수 있습니다.');
    } else if (result === 'denied') {
      alert('기기 설정에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서 권한을 허용해주세요.');
    }
  };

  const isMatched = currentState !== 'VIEW_ONBOARDING';

  return (
    <header className="w-full bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E8DFD3] sticky top-0 z-40 px-3.5 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+0.65rem)] pb-2.5 sm:pb-3 shrink-0 shadow-2xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* 좌측: 로고 및 다정한 커플 상태 */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center font-serif-warm font-bold text-base sm:text-lg shadow-sm border border-amber-200/20 shrink-0">
            溫
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-warm font-bold text-stone-900 text-lg sm:text-xl leading-tight">
                온기
              </span>
              <span className="text-xs font-serif-warm text-stone-500 hidden xs:inline">· Warmth</span>
              {isMatched && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="초대코드 복사하기"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 hover:bg-amber-200/80 text-amber-950 text-xs font-mono font-bold border border-amber-300/60 transition-colors cursor-pointer active:scale-95"
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
            <div className="flex items-center gap-1.5 text-xs font-sans-ui leading-tight mt-0.5">
              {isMatched ? (
                <div className="inline-flex items-center gap-1.5 text-stone-700 font-medium">
                  <span className="font-bold text-[#6B1724]">{userName}</span>
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
                  <span className="text-stone-600">{partnerName}</span>
                </div>
              ) : (
                <span className="text-amber-800 font-medium text-xs">일기장 연결 대기 중</span>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 정식 서비스 전용 액션 (둘만의 서재, 일기 쓰기, 더보기) */}
        {isMatched && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 둘만의 서재 버튼 */}
            <button
              onClick={onOpenArchive}
              title="둘만의 서재 (지난 일기 보관함)"
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-stone-300/90 hover:border-[#6B1724]/40 bg-white hover:bg-stone-50 text-stone-800 text-xs font-serif-warm font-bold shadow-2xs flex items-center gap-1.5 min-h-[36px] sm:min-h-[38px] active:scale-95 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#6B1724]" />
              <span className="hidden xs:inline">둘만의 서재</span>
            </button>

            {/* 일기 쓰기 버튼 */}
            <button
              onClick={onOpenWriteModal}
              title="새 일기 쓰기"
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold shadow-xs flex items-center gap-1.5 min-h-[36px] sm:min-h-[38px] active:scale-95 transition-all cursor-pointer"
            >
              <PenLine className="w-3.5 h-3.5 text-amber-200" />
              <span>일기 쓰기</span>
            </button>

            {/* 더보기 메뉴 버튼 */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="더보기 설정"
              className="p-2 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-sm min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] flex items-center justify-center active:scale-95 cursor-pointer shadow-2xs transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 설정 / 더보기 팝오버 드롭다운 */}
      {isMatched && isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3.5 sm:right-6 top-[calc(100%+6px)] w-64 bg-[#FAF7F2] rounded-2xl shadow-xl border border-[#E8DFD3] py-2 z-50 animate-in fade-in zoom-in-95 font-sans-ui text-stone-700"
        >
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
        </div>
      )}
    </header>
  );
}
