'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, CheckCircle, X, Mail } from 'lucide-react';
import { soundEngine } from '@/lib/audio';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'DIARY' | 'REACTION' | 'USER';
  targetId?: string;
  targetAuthorName: string;
  onConfirmReport: (reason: string, blockPartner: boolean) => void;
}

const REPORT_REASONS = [
  { id: 'HARASSMENT', label: '불쾌하거나 모욕적인 언어, 괴롭힘 및 비방' },
  { id: 'SEXUAL', label: '음란물, 선정적이거나 부적절한 텍스트 또는 사진' },
  { id: 'VIOLENCE', label: '폭력적이거나 위협적인 표현, 자해 또는 위험 조장' },
  { id: 'SPAM_OTHER', label: '스팸, 도배 또는 기타 커뮤니티 가이드라인 위반' },
];

export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetAuthorName,
  onConfirmReport,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [blockPartnerAlso, setBlockPartnerAlso] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const targetTypeText =
    targetType === 'REACTION'
      ? '포스트잇 마음 반응'
      : targetType === 'DIARY'
      ? '일기 및 첨부 사진'
      : '사용자';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playTileSlideSound();
    setIsSubmitted(true);

    setTimeout(() => {
      onConfirmReport(
        `${selectedReason}: ${additionalDetails.trim() || '세부 사유 없음'}`,
        blockPartnerAlso
      );
      setIsSubmitted(false);
      setAdditionalDetails('');
      setBlockPartnerAlso(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#FAF7F2] rounded-2xl border border-[#E5DAC8] shadow-2xl overflow-hidden font-sans-ui text-stone-800"
        >
          {/* 헤더 */}
          <div className="bg-[#6B1724] px-5 py-4 text-amber-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-200" />
              <h2 className="font-serif-warm font-bold text-base sm:text-lg tracking-wide">
                콘텐츠 및 사용자 신고
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitted}
              className="text-amber-200/80 hover:text-amber-100 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 */}
          {isSubmitted ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>
              <h3 className="font-serif-warm font-bold text-lg text-stone-900">
                신고가 정상 접수되었습니다
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed font-serif-warm max-w-xs mx-auto">
                해당 콘텐츠는 즉시 내 화면에서 가려졌으며, 운영팀에 전송되어 24시간 이내 검토 및 제재 조치가 진행됩니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* 대상 요약 */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs leading-relaxed text-amber-950 font-serif-warm">
                <span className="font-bold text-[#6B1724]">신고 대상:</span> {targetAuthorName} 님이 작성한{' '}
                <strong className="underline underline-offset-2">{targetTypeText}</strong>
              </div>

              {/* 사유 선택 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  신고 사유를 선택해주세요
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedReason === reason.id
                          ? 'border-[#6B1724] bg-[#6B1724]/5 text-stone-900 font-medium'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={reason.id}
                        checked={selectedReason === reason.id}
                        onChange={() => setSelectedReason(reason.id)}
                        className="mt-0.5 accent-[#6B1724]"
                      />
                      <span>{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 세부 사유 입력 (선택) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  추가 설명 (선택 사항)
                </label>
                <textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="구체적인 상황을 적어주시면 신속한 조치에 도움이 됩니다."
                  maxLength={200}
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#6B1724] resize-none"
                />
              </div>

              {/* 차단 옵션 */}
              <label className="flex items-center gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs cursor-pointer text-stone-700">
                <input
                  type="checkbox"
                  checked={blockPartnerAlso}
                  onChange={(e) => setBlockPartnerAlso(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded-xs shrink-0"
                />
                <span className="font-semibold text-rose-900">
                  🚨 이 사용자를 차단하고 즉시 일기장 연결 해제하기
                </span>
              </label>

              {/* 애플 심사 지침 필수 안내 (무관용 원칙) */}
              <div className="p-2.5 rounded-xl bg-stone-100 text-[11px] text-stone-500 leading-normal font-sans-ui flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  온기는 악의적이거나 불쾌감을 주는 콘텐츠에 대해 <strong>무관용(Zero-tolerance) 원칙</strong>을 적용합니다. 
                  신고된 내용은 24시간 내 검토되며 위반 시 영구 제재됩니다. (문의: support@warmth.app)
                </span>
              </div>

              {/* 버튼 그룹 */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold shadow-md cursor-pointer transition-all active:scale-98"
                >
                  신고 접수하기
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
