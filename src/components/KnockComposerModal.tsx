'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, PenLine, Send, X } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

export const KNOCK_PRESETS = [
  '오늘의 일기를 기다리고 있어요 ✉️',
  '오늘 하루는 어땠어? 네 이야기가 궁금해 ✨',
  '차 한잔 마시며 편안한 시간에 적어줘 🍵',
] as const;

export const MAX_KNOCK_MESSAGE_LENGTH = 60;

interface KnockComposerModalProps {
  isOpen: boolean;
  partnerName: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void> | void;
}

export default function KnockComposerModal({
  isOpen,
  partnerName,
  onClose,
  onSend,
}: KnockComposerModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(KNOCK_PRESETS[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const finalMessage = isCustomMode ? customMessage.trim() : selectedPreset;
  const canSend = Boolean(finalMessage) && !isSending;

  const handleSubmit = async () => {
    if (!canSend) return;
    setIsSending(true);
    soundEngine.playWindChimeKnock();
    try {
      await onSend(finalMessage);
      setCustomMessage('');
      setIsCustomMode(false);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#FAF6EE] border border-[#E3DACB] shadow-2xl p-5 sm:p-6 space-y-4 paper-texture"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100/90 border border-amber-200/80 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[#6B1724]" />
                </div>
                <div>
                  <h3 className="font-serif-warm font-bold text-stone-900 text-base leading-tight">
                    {partnerName} 님에게 노크하기
                  </h3>
                  <p className="text-[11px] text-stone-500 font-sans-ui">
                    선택한 문구가 푸시 알림으로 그대로 전달돼요
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 프리셋 3개 + 직접 작성 칸 */}
            <div className="space-y-2">
              {KNOCK_PRESETS.map((msg) => {
                const isSelected = !isCustomMode && selectedPreset === msg;
                return (
                  <button
                    key={msg}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(msg);
                      setIsCustomMode(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-between font-sans-ui cursor-pointer ${
                      isSelected
                        ? 'bg-[#6B1724] text-amber-50 font-bold shadow-xs'
                        : 'bg-white/90 hover:bg-white text-stone-700 border border-stone-200/80 font-medium'
                    }`}
                  >
                    <span className="truncate pr-2">{msg}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-200 shrink-0" />}
                  </button>
                );
              })}

              {/* 직접 작성 칸 */}
              <div
                onClick={() => setIsCustomMode(true)}
                className={`rounded-xl border transition-all p-2.5 bg-white ${
                  isCustomMode
                    ? 'border-[#6B1724] ring-1 ring-[#6B1724]/25 shadow-xs'
                    : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-sans-ui mb-1">
                  <span className={`flex items-center gap-1 font-semibold ${isCustomMode ? 'text-[#6B1724]' : 'text-stone-500'}`}>
                    <PenLine className="w-3 h-3" />
                    직접 작성하기
                  </span>
                  <span className="text-[10px] text-stone-400 tabular-nums">
                    {customMessage.length}/{MAX_KNOCK_MESSAGE_LENGTH}
                  </span>
                </div>
                <input
                  type="text"
                  value={customMessage}
                  maxLength={MAX_KNOCK_MESSAGE_LENGTH}
                  onFocus={() => setIsCustomMode(true)}
                  onChange={(e) => {
                    setCustomMessage(e.target.value);
                    setIsCustomMode(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="예: 오늘 밤엔 꼭 답장 보고 싶어 🌙"
                  className="w-full text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 bg-transparent focus:outline-none font-sans-ui"
                />
              </div>
            </div>

            {/* 전송 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className="flex-1 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#58131e] text-[#FFFDF9] text-xs sm:text-sm font-sans-ui font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-98"
              >
                <Bell className="w-3.5 h-3.5 text-amber-300" />
                <span>{isSending ? '보내는 중...' : '노크 보내기'}</span>
                <Send className="w-3.5 h-3.5 opacity-80" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
