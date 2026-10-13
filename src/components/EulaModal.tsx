'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Mail, FileText, AlertOctagon } from 'lucide-react';

interface EulaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EulaModal({ isOpen, onClose }: EulaModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] bg-black/60 backdrop-blur-xs select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg bg-[#FAF7F2] rounded-2xl border border-[#E5DAC8] shadow-2xl overflow-hidden font-sans-ui text-stone-800 flex flex-col max-h-[82dvh] my-auto"
          >
          {/* 헤더 */}
          <div className="bg-[#6B1724] px-5 py-4 text-amber-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-200" />
              <h2 className="font-serif-warm font-bold text-base sm:text-lg tracking-wide">
                온기 이용약관 및 커뮤니티 가이드라인 (EULA)
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-amber-200/80 hover:text-amber-100 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 스크롤 영역 */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-stone-700 font-sans-ui">
            {/* 1. 무관용 원칙 강조 박스 */}
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>유해 콘텐츠 및 악의적 행위에 대한 무관용 원칙 (Zero-Tolerance)</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-normal">
                온기(Warmth)는 소중한 두 사람만의 안전하고 따뜻한 기록 공간입니다. 불쾌감을 주는 비방, 폭력, 음란물, 괴롭힘 및 타인에 대한 침해 행위는 엄격히 금지되며, 위반 적발 시 사전 경고 없이 즉각적인 계정 영구 제재 및 법적 조치가 취해집니다.
              </p>
            </div>

            {/* 제1조 */}
            <div className="space-y-1">
              <h3 className="font-bold text-stone-900 text-sm">제1조 (목적 및 서비스 정의)</h3>
              <p>
                본 약관은 ‘온기’가 제공하는 비밀 교환일기, 감정 기록 및 2인 연결 서비스(이하 ‘서비스’)의 이용 조건과 권리 및 의무 사항을 규정합니다.
              </p>
            </div>

            {/* 제2조 */}
            <div className="space-y-1">
              <h3 className="font-bold text-stone-900 text-sm">제2조 (유저 생성 콘텐츠 및 금지 행위)</h3>
              <p>사용자는 다음과 같은 콘텐츠를 일기, 사진, 포스트잇 반응 등을 통해 작성하거나 공유할 수 없습니다:</p>
              <ul className="list-disc list-inside space-y-0.5 text-stone-600 pl-1">
                <li>타인을 비방, 모욕, 협박하거나 명예를 훼손하는 콘텐츠</li>
                <li>성적으로 노골적이거나 음란한 이미지 및 텍스트</li>
                <li>자해, 폭력, 범죄를 조장하거나 혐오를 부추기는 표현</li>
                <li>타인의 지적재산권 및 개인정보를 무단 침해하는 내용</li>
              </ul>
            </div>

            {/* 제3조 */}
            <div className="space-y-1">
              <h3 className="font-bold text-stone-900 text-sm">제3조 (신고 및 차단 기능의 제공)</h3>
              <p>
                1. 사용자는 상대방이 작성한 부적절한 일기나 포스트잇에 대해 언제든지 앱 내 <strong>[신고]</strong> 버튼을 통해 신고할 수 있습니다.<br />
                2. 신고된 콘텐츠는 즉시 사용자의 화면에서 차단되며, <strong>24시간 이내에 운영팀의 검토를 거쳐 영구 삭제 및 제재</strong>됩니다.<br />
                3. 사용자는 언제든지 <strong>[사용자 차단 및 방 연결 해제]</strong> 기능을 통해 상대방과의 연결을 영구히 끊을 수 있습니다.
              </p>
            </div>

            {/* 제4조 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-stone-900 text-sm">제4조 (데이터 보호 및 개인정보)</h3>
                <Link
                  href="/privacy"
                  onClick={onClose}
                  className="text-[11px] text-[#6B1724] hover:underline font-semibold"
                >
                  개인정보 처리방침 전문 →
                </Link>
              </div>
              <p>
                모든 교환일기와 개인 데이터는 강력한 암호화 및 보안 전송을 통해 보호되며, 사용자는 언제든지 데이터 삭제 및 방 탈퇴를 요청할 수 있습니다. 수집 항목 및 파기 절차에 대한 세부 사항은 개인정보 처리방침을 준수합니다.
              </p>
            </div>

            {/* 제5조 */}
            <div className="space-y-1">
              <h3 className="font-bold text-stone-900 text-sm">제5조 (개발자 연락처 및 고객지원 창구)</h3>
              <p>
                서비스 이용 관련 불편 사항, 유해 콘텐츠 즉시 조치 요청은 아래 창구를 통해 24시간 상시 접수 가능합니다.
              </p>
              <div className="p-2.5 rounded-lg bg-stone-100 flex items-center gap-2 text-stone-700">
                <Mail className="w-4 h-4 text-[#6B1724]" />
                <span>운영 및 고객지원: <strong>yjh020701@gmail.com</strong> (support@warmth.app)</span>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-4 bg-stone-100/80 border-t border-stone-200 flex items-center justify-between shrink-0">
            <Link
              href="/privacy"
              onClick={onClose}
              className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 font-medium"
            >
              개인정보 처리방침 보기
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold cursor-pointer transition-all"
            >
              확인 및 닫기
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
