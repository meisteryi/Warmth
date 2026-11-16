'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Copy,
  Check,
  Volume2,
  Volume1,
  VolumeX,
  User,
  Globe,
  ShieldAlert,
  ShieldCheck,
  FileText,
  LogOut,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  getNotificationStatus,
  requestNotificationPermission,
  refreshNotificationPermissionAsync,
} from '@/lib/notifications';
import { soundEngine } from '@/lib/audio';
import { useLanguage } from '@/lib/i18n';
import EulaModal from '@/components/EulaModal';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';
import {
  JarItemStyle,
  getDefaultJarItemStyle,
  setDefaultJarItemStyle,
} from '@/features/memory-jar-3d/types';

interface SettingsViewProps {
  onClose: () => void;
  onOpenProfile?: () => void;
  onLeaveRoom?: () => void;
  roomCode: string;
  userName: string;
}

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
      <rect x="9" y="2" width="6" height="3" rx="1" fill="currentColor" fillOpacity="0.25" />
      <path d="M7.5 5h9" />
      <path d="M8 5v2.2a2.5 2.5 0 0 1-.7 1.8C6.5 9.8 6 11.2 6 12.8V19a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6.2c0-1.6-.5-3-1.3-3.8a2.5 2.5 0 0 1-.7-1.8V5" />
      <circle cx="12" cy="15.5" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

export default function SettingsView({
  onClose,
  onOpenProfile,
  onLeaveRoom,
  roomCode,
  userName,
}: SettingsViewProps) {
  const { language, setLanguage, t } = useLanguage();
  const [copiedCode, setCopiedCode] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    getNotificationStatus().permission
  );
  const [volume, setVolume] = useState<number>(() => soundEngine.getVolume());
  const [jarItemStyle, setJarItemStyle] = useState<JarItemStyle>(() => getDefaultJarItemStyle());
  const [isEulaOpen, setIsEulaOpen] = useState(false);
  const [dangerConfirmMode, setDangerConfirmMode] = useState<'block' | 'leave' | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState('');

  const requiredName = userName.trim();
  const isNameMatched =
    requiredName.length > 0 ? confirmNameInput.trim() === requiredName : true;

  const openDangerConfirm = (mode: 'block' | 'leave') => {
    setConfirmNameInput('');
    setDangerConfirmMode(mode);
    soundEngine.playTileSlideSound();
  };

  const handleConfirmDangerAction = () => {
    if (!isNameMatched || !onLeaveRoom) return;
    setDangerConfirmMode(null);
    setConfirmNameInput('');
    onLeaveRoom();
  };

  useEffect(() => {
    const handlePermissionGranted = () => {
      setNotifPermission('granted');
    };
    window.addEventListener('warmth-notification-permission-granted', handlePermissionGranted);

    refreshNotificationPermissionAsync()
      .then((p) => {
        if (p) setNotifPermission(p);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('warmth-notification-permission-granted', handlePermissionGranted);
    };
  }, []);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      soundEngine.playTileSlideSound();
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleToggleNotification = async () => {
    if (notifPermission === 'granted') {
      window.dispatchEvent(new CustomEvent('warmth-notification-permission-granted'));
      alert('이미 알림 권한이 허용되어 있습니다. 새로운 편지나 노크가 올 때 알림이 전달됩니다.');
      return;
    }
    const status = getNotificationStatus();
    if (!status.isSupported) {
      alert(
        '현재 브라우저 환경에서는 백그라운드 푸시 알림이 직접 지원되지 않습니다. 아이폰(iOS)의 경우 사파리 하단 공유 버튼(네모+화살표)을 눌러 "홈 화면에 추가"하신 뒤 앱처럼 실행하시면 잠금 화면에서도 백그라운드 푸시를 받으실 수 있습니다.'
      );
      return;
    }
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      alert('🔔 알림이 켜졌습니다! 상대방이 보낸 새 편지와 노크를 실시간으로 받아보실 수 있습니다.');
    } else if (result === 'denied') {
      if (Capacitor.isNativePlatform()) {
        alert('기기 설정에서 알림 권한이 차단되어 있습니다. 아이폰 [설정 > 온기]에서 알림 권한을 허용해주세요.');
      } else {
        alert('기기 설정에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서 알림 권한을 허용해주세요.');
      }
    }
  };

  return (
    <motion.div
      key="inline-settings-view"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full max-w-2xl flex flex-col my-1 sm:my-2"
    >
      {/* 서재와 동일한 상단 섹션 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-2 sm:px-3 py-3 mb-4 bg-transparent border-b border-stone-200/50">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 select-none">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shadow-sm border border-amber-200/20 shrink-0 select-none pointer-events-none"
            role="img"
            aria-label="온기 로고"
          >
            <WarmthHanjaIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-100 select-none pointer-events-none" />
          </div>
          <div className="flex items-center min-w-0 select-none">
            <h2 className="text-base sm:text-xl font-serif-warm font-bold text-stone-900 whitespace-nowrap shrink-0">
              {language === 'en' ? 'Settings' : '설정'}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 text-xs font-serif-warm font-medium transition-all active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          title={language === 'en' ? 'Back to Desk' : '책상으로 돌아가기'}
        >
          <span>{language === 'en' ? 'Back to Desk' : '책상 복귀'}</span>
        </button>
      </div>

      {/* 설정 항목 카드 목록 (기존 점 세 개 메뉴와 동일한 내용) */}
      <div className="space-y-3 px-1 sm:px-2 font-sans-ui text-stone-700">
        {/* 0~1. 내 프로필 & 방 코드 */}
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E8DFD3] shadow-2xs overflow-hidden divide-y divide-[#E8DFD3]/80">
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="w-full px-4 py-3.5 text-left flex items-center justify-between hover:bg-stone-100/70 transition-colors text-sm cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-[#6B1724]" />
                <span className="font-semibold text-stone-800">{t('menu.profile')}</span>
              </span>
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <span className="font-medium text-stone-700 max-w-[140px] truncate">{userName}</span>
                <span className="text-stone-400">✏️</span>
              </span>
            </button>
          )}

          <div className="px-4 py-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-stone-500 font-medium">{t('menu.roomCode')}</div>
              <div className="text-base font-mono font-bold text-amber-950">#{roomCode}</div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-amber-100/70 border border-stone-200 text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title={t('menu.copy')}
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-stone-500" />
              )}
              <span>{copiedCode ? t('menu.copied') : t('menu.copy')}</span>
            </button>
          </div>
        </div>

        {/* 2~5. 알림, 효과음 볼륨, 언어, 유리병 기본 */}
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E8DFD3] shadow-2xs overflow-hidden divide-y divide-[#E8DFD3]/80">
          {/* 웹 푸시 알림 설정 토글 */}
          <button
            type="button"
            onClick={handleToggleNotification}
            className="w-full px-4 py-3.5 text-left flex items-center justify-between hover:bg-stone-100/70 transition-colors text-sm cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-[#6B1724]" />
              <span className="font-medium text-stone-800">{t('menu.pushNotification')}</span>
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                notifPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-stone-200 text-stone-600'
              }`}
            >
              {notifPermission === 'granted' ? t('menu.notificationOn') : t('menu.notificationEnable')}
            </span>
          </button>

          {/* 효과음 볼륨 조절 */}
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2.5 font-medium text-stone-800">
                {volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-stone-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4 text-[#6B1724]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#6B1724]" />
                )}
                <span>{t('menu.volume')}</span>
              </span>
              <span className="font-mono text-xs font-semibold text-stone-600">
                {Math.round(volume * 100)}%
              </span>
            </div>
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

          {/* 한국어 / 영어 언어 전환 */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-sm font-medium text-stone-800">
              <Globe className="w-4 h-4 text-[#6B1724]" />
              <span>{t('menu.language')}</span>
            </span>
            <div className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setLanguage('ko');
                  soundEngine.playTileSlideSound();
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
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
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  language === 'en'
                    ? 'bg-white text-[#6B1724] shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* 유리병 기본 담김 스타일 (실링 왁스 / 유리구슬) */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-sm font-medium text-stone-800">
              <GlassJarIcon className="w-4 h-4 text-[#6B1724]" />
              <span>{language === 'en' ? 'Jar Default' : '유리병 기본'}</span>
            </span>
            <div className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setJarItemStyle('wax');
                  setDefaultJarItemStyle('wax');
                  soundEngine.playTileSlideSound();
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  jarItemStyle === 'wax'
                    ? 'bg-white text-[#6B1724] shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {language === 'en' ? 'Wax' : '실링 왁스'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setJarItemStyle('marble');
                  setDefaultJarItemStyle('marble');
                  soundEngine.playTileSlideSound();
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  jarItemStyle === 'marble'
                    ? 'bg-white text-[#6B1724] shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {language === 'en' ? 'Marble' : '유리구슬'}
              </button>
            </div>
          </div>
        </div>

        {/* 6. 사파리 7일 보관 안내 */}
        <div className="px-4 py-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 text-xs text-stone-600 leading-relaxed">
          💡 {t('menu.safariNotice')}
        </div>

        {/* 7. 이용약관 및 개인정보 처리방침 */}
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E8DFD3] shadow-2xs overflow-hidden divide-y divide-[#E8DFD3]/80">
          <button
            type="button"
            onClick={() => {
              setIsEulaOpen(true);
              soundEngine.playTileSlideSound();
            }}
            className="w-full px-4 py-3.5 text-left flex items-center gap-2.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100/60 transition-colors text-sm cursor-pointer"
          >
            <FileText className="w-4 h-4 text-stone-500" />
            <span>{language === 'en' ? 'Community Guidelines & EULA' : '이용약관 및 가이드라인'}</span>
          </button>
          <Link
            href="/privacy"
            className="w-full px-4 py-3.5 text-left flex items-center gap-2.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100/60 transition-colors text-sm cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-stone-500" />
            <span>{language === 'en' ? 'Privacy Policy' : '개인정보 처리방침'}</span>
          </Link>
        </div>

        {/* 8~9. 상대방 차단/연결 해제 & 방 나가기 */}
        {onLeaveRoom && (
          <div className="bg-[#FDFBF7] rounded-2xl border border-[#E8DFD3] shadow-2xs overflow-hidden divide-y divide-[#E8DFD3]/80">
            <button
              type="button"
              onClick={() => openDangerConfirm('block')}
              className="w-full px-4 py-3.5 text-left flex items-center gap-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50/60 transition-colors text-sm cursor-pointer font-semibold"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{language === 'en' ? 'Block Partner & Disconnect' : '상대방 차단 및 연결 해제'}</span>
            </button>

            <button
              type="button"
              onClick={() => openDangerConfirm('leave')}
              className="w-full px-4 py-3.5 text-left flex items-center gap-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100/60 transition-colors text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('menu.leaveRoom')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 실수 방지: 내 이름 정확히 입력하기 확인 모달 */}
      <AnimatePresence>
        {dangerConfirmMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
            onClick={() => setDangerConfirmMode(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#FAF7F2] rounded-3xl border border-[#E8DFD3] shadow-2xl p-5 sm:p-6 space-y-4 font-sans-ui"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  {dangerConfirmMode === 'block' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : (
                    <LogOut className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-serif-warm font-bold text-stone-900">
                    {dangerConfirmMode === 'block'
                      ? language === 'en'
                        ? 'Block Partner & Disconnect'
                        : '상대방 차단 및 연결 해제'
                      : language === 'en'
                      ? 'Disconnect Diary Room'
                      : '일기장 연결 해제'}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {dangerConfirmMode === 'block'
                      ? language === 'en'
                        ? 'All partner content will be hidden and you will leave this room immediately.'
                        : '차단 시 상대방의 모든 글이 숨겨지며, 일기장에서 즉시 퇴장 처리됩니다.'
                      : language === 'en'
                      ? 'To prevent accidental disconnection, please type your exact name below.'
                      : '실수로 연결이 해제되는 것을 방지하기 위해 아래에 본인의 이름을 정확히 입력해주세요.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-700">
                  {language === 'en' ? (
                    <>
                      Type <span className="font-bold text-[#6B1724]">&quot;{requiredName}&quot;</span> to confirm
                    </>
                  ) : (
                    <>
                      확인을 위해 <span className="font-bold text-[#6B1724]">&quot;{requiredName}&quot;</span> 을(를) 직접 입력해주세요
                    </>
                  )}
                </label>
                <input
                  type="text"
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isNameMatched) {
                      handleConfirmDangerAction();
                    }
                  }}
                  placeholder={requiredName}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDangerConfirmMode(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
                >
                  {language === 'en' ? 'Cancel' : '취소'}
                </button>
                <button
                  type="button"
                  disabled={!isNameMatched}
                  onClick={handleConfirmDangerAction}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isNameMatched
                      ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs active:scale-95'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {dangerConfirmMode === 'block'
                    ? language === 'en'
                      ? 'Block & Leave'
                      : '차단 및 연결 해제'
                    : language === 'en'
                    ? 'Disconnect'
                    : '연결 해제하기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 이용약관 모달 */}
      <EulaModal isOpen={isEulaOpen} onClose={() => setIsEulaOpen(false)} />
    </motion.div>
  );
}
