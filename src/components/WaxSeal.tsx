'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { soundEngine } from '@/lib/audio';
import { WaxColor } from '@/types/diary';
import { Lock, Sparkles } from 'lucide-react';

interface WaxSealProps {
  color?: WaxColor;
  isLocked?: boolean;
  onBroken?: () => void;
  onClickLocked?: () => void;
  disabled?: boolean;
  size?: number;
}

export default function WaxSeal({
  color = '#6B1724',
  isLocked = false,
  onBroken,
  onClickLocked,
  disabled = false,
  size = 120,
}: WaxSealProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [isCracking, setIsCracking] = useState(false);
  const pressStartTime = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const REQUIRED_PRESS_DURATION = 3000; // 3초

  // 왁스 파쇄 및 파티클 발사
  const triggerWaxCrack = useCallback(() => {
    setIsCracking(true);
    soundEngine.playWaxCrackSound();

    // Canvas Confetti를 이용한 왁스 파편 파티클 연출 (커스텀 컬러 대응)
    const colors = color === '#6B1724' 
      ? ['#6B1724', '#8E1D31', '#B8860B', '#FDFBF7'] 
      : color === '#B8860B'
      ? ['#B8860B', '#D4AF37', '#6B1724', '#FFFDF9']
      : color === '#2E473B'
      ? ['#2E473B', '#446E5A', '#B8860B', '#F4EFEA']
      : [color, '#D4AF37', '#FAF7F2', '#3D0B14'];

    confetti({
      particleCount: 55,
      spread: 70,
      origin: { y: 0.55 },
      colors,
      scalar: 0.8,
      ticks: 120,
      gravity: 1.2,
      shapes: ['circle', 'square'],
    });

    setTimeout(() => {
      onBroken?.();
    }, 700);
  }, [color, onBroken]);

  // 프레스 진행 루프
  const handleTick = useCallback(() => {
    if (!pressStartTime.current) return;
    const elapsed = Date.now() - pressStartTime.current;
    const currentProgress = Math.min(elapsed / REQUIRED_PRESS_DURATION, 1);
    setProgress(currentProgress);
    soundEngine.updateMeltProgress(currentProgress);

    if (currentProgress >= 1) {
      // 3초 도달!
      setIsPressing(false);
      pressStartTime.current = null;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      triggerWaxCrack();
    } else {
      animationFrameId.current = requestAnimationFrame(handleTick);
    }
  }, [triggerWaxCrack]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isCracking) return;

    if (isLocked) {
      onClickLocked?.();
      return;
    }

    // 마우스 우클릭 등 방지
    if (e.button !== 0) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setIsPressing(true);
    pressStartTime.current = Date.now();
    soundEngine.startMeltHum();
    animationFrameId.current = requestAnimationFrame(handleTick);
  };

  const handlePointerUpOrLeave = (e?: React.PointerEvent) => {
    if (e) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (!isPressing || isCracking) return;
    setIsPressing(false);
    pressStartTime.current = null;
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    soundEngine.stopMeltHum();
    // 서서히 게이지 복구
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      soundEngine.stopMeltHum();
    };
  }, []);

  const strokeDashoffset = 2 * Math.PI * 52 * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center select-none touch-none touch-callout-none">
      {/* 3초 롱프레스 프로그레스 원형 게이지 */}
      {!isLocked && !isCracking && (
        <svg
          className="absolute pointer-events-none -rotate-90 z-20"
          width={size + 36}
          height={size + 36}
          viewBox="0 0 120 120"
        >
          {/* 배경 트랙 */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="rgba(180, 150, 130, 0.25)"
            strokeWidth="3.5"
            strokeDasharray="4 4"
          />
          {/* 진행 게이지 (골드/버건디 그라데이션) */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={color === '#B8860B' ? '#E3B338' : '#B8860B'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: isPressing ? 'none' : 'stroke-dashoffset 0.3s ease-out',
              filter: 'drop-shadow(0 0 6px rgba(227, 179, 56, 0.6))',
            }}
          />
        </svg>
      )}

      {/* 왁스 인장 본체 버튼 */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={isLocked ? "잠긴 미션 봉인" : "실링 왁스 3초간 꾹 눌러 개봉"}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        className={`relative cursor-pointer transition-transform touch-none touch-callout-none ${
          isPressing && progress > 0.3 ? 'anim-shake' : ''
        } ${!isLocked && !isPressing && !isCracking ? 'anim-wax-pulse' : ''}`}
        style={{
          width: size,
          height: size,
        }}
        whileHover={{ scale: isLocked ? 1.05 : 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        {/* 왁스 자연스러운 유기적 외곽 SVG */}
        {(() => {
          const safeColorId = color.replace(/[^a-zA-Z0-9]/g, '');
          return (
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full filter drop-shadow-md"
              style={{
                filter: `drop-shadow(0 6px 12px ${color}66) drop-shadow(0 2px 4px rgba(0,0,0,0.3))`,
              }}
            >
              <defs>
                <radialGradient id={`waxGrad-${safeColorId}`} cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
                  <stop offset="35%" stopColor={color} />
                  <stop offset="90%" stopColor={color} />
                  <stop offset="100%" stopColor="#1A0508" stopOpacity="0.8" />
                </radialGradient>
                <filter id="waxTexture" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                  <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.12 0" />
                  <feComposite in2="SourceGraphic" in="gl" operator="in" />
                </filter>
              </defs>

              {/* 울퉁불퉁 자연스러운 왁스 덩어리 외곽 패스 */}
              <motion.path
                d="M 50,5 
                   C 65,4 78,12 86,22 
                   C 94,32 97,48 94,62 
                   C 91,76 82,88 68,94 
                   C 54,100 38,98 26,90 
                   C 14,82 6,69 6,54 
                   C 6,39 15,24 28,14 
                   C 38,6 45,5 50,5 Z"
                fill={`url(#waxGrad-${safeColorId})`}
                animate={isCracking ? { scale: [1, 1.15, 0.4], opacity: [1, 0.8, 0] } : {}}
                transition={{ duration: 0.6 }}
              />

          {/* 중앙 양각 테두리 원 */}
          <circle
            cx="50"
            cy="50"
            r="32"
            fill="none"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2.5"
          />
          <circle
            cx="50"
            cy="50"
            r="31"
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="1.5"
          />

          {/* 금박 가루 디테일 (골드 하이라이트) */}
          <circle cx="38" cy="34" r="1.5" fill="#FFE5A3" opacity="0.6" />
          <circle cx="62" cy="42" r="1.2" fill="#FFE5A3" opacity="0.5" />
          <circle cx="48" cy="65" r="1.4" fill="#FFE5A3" opacity="0.5" />
          <circle cx="65" cy="60" r="1.8" fill="#FFE5A3" opacity="0.4" />
        </svg>
          );
        })()}

        {/* 왁스 중앙 인장 심볼 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-100/90 pointer-events-none">
          <AnimatePresence mode="wait">
            {isLocked ? (
              <motion.div
                key="locked"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-center justify-center drop-shadow-md text-amber-200"
              >
                <Lock className="w-7 h-7 stroke-[2.2] animate-pulse" />
                <span className="text-[10px] font-sans-ui mt-0.5 tracking-tighter opacity-90">미션 확인</span>
              </motion.div>
            ) : isCracking ? (
              <motion.div
                key="cracking"
                initial={{ scale: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                className="text-amber-200"
              >
                <Sparkles className="w-9 h-9" />
              </motion.div>
            ) : (
              <motion.div
                key="ready"
                className="flex flex-col items-center justify-center"
                animate={isPressing ? { scale: 0.94 } : { scale: 1 }}
              >
                {/* 만년필 음각 이니셜 W */}
                <span 
                  className="font-serif-warm text-2xl font-bold tracking-widest text-amber-100/95"
                  style={{
                    textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 -1px 1px rgba(255,255,255,0.3)',
                  }}
                >
                  W
                </span>
                <span className="text-[9px] tracking-widest text-amber-200/80 font-sans uppercase -mt-1">
                  WARMTH
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 롱프레스 진행 시 퍼센트 안내 툴팁 */}
        {isPressing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900/90 text-amber-100 text-xs px-2.5 py-1 rounded-full whitespace-nowrap shadow-lg backdrop-blur-sm font-sans-ui flex items-center gap-1 z-30"
          >
            <span>녹이는 중...</span>
            <span className="font-mono font-bold text-amber-300">
              {Math.round(progress * 100)}%
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
