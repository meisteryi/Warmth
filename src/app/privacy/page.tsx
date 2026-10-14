'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  Database, 
  Trash2, 
  Server, 
  Mail, 
  Globe, 
  FileText,
  AlertCircle,
  Clock
} from 'lucide-react';
import WarmthHanjaIcon from '@/components/WarmthHanjaIcon';

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  return (
    <div className="h-full overflow-y-auto bg-[#FDFBF7] text-[#2C2A29] font-sans-ui selection:bg-[#6B1724]/20 selection:text-[#6B1724]">
      <header className="sticky top-0 z-40 bg-[#FAF7F2] border-b border-[#E8DFD3] px-3.5 sm:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 px-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '돌아가기' : 'Back'}</span>
          </Link>
          <div className="flex items-center gap-1.5 shrink min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#6B1724] text-amber-100 flex items-center justify-center shrink-0">
              <WarmthHanjaIcon className="w-3.5 h-3.5 text-amber-100" />
            </div>
            <span className="font-serif-warm font-bold text-xs sm:text-sm tracking-wide text-stone-900 truncate">
              {lang === 'ko' ? '개인정보 처리방침' : 'Privacy Policy'}
            </span>
          </div>
        </div>

        {/* 언어 전환 스위처 */}
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-xs shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setLang('ko')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-semibold cursor-pointer transition-all whitespace-nowrap ${
              lang === 'ko' ? 'bg-white text-[#6B1724] shadow-xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-semibold cursor-pointer transition-all whitespace-nowrap ${
              lang === 'en' ? 'bg-white text-[#6B1724] shadow-xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            English
          </button>
        </div>
      </header>

      {/* 본문 컨테이너 */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* 헤더 섹션 */}
        <div className="text-center space-y-2 pb-6 border-b border-[#E8DFD3]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[#6B1724] text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Apple App Store Review Guideline 5.1.1 Compliant</span>
          </div>
          <h1 className="font-serif-warm font-bold text-2xl sm:text-3xl text-stone-900 tracking-tight">
            {lang === 'ko' ? '온기(Warmth) 개인정보 처리방침' : 'Warmth Privacy Policy'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            {lang === 'ko' 
              ? '최종 수정일 및 시행일자: 2026년 10월 14일 (v1.0)' 
              : 'Last Updated & Effective Date: October 14, 2026 (v1.0)'}
          </p>
        </div>

        {lang === 'ko' ? (
          /* ======================= 한국어 버전 ======================= */
          <div className="space-y-8 text-stone-700 text-sm leading-relaxed">
            {/* 요약 박스 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-stone-800">
              <div className="flex items-center gap-2 font-bold text-[#6B1724]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>데이터 최소화 및 비밀 보장의 원칙 (Privacy by Design)</span>
              </div>
              <p className="text-xs text-stone-600 leading-normal">
                ‘온기’는 둘만의 소중한 교환일기 경험을 제공하기 위해 필요한 <strong>최소한의 정보만을 처리</strong>하며,
                불필요한 주민등록번호, 연락처, 결제정보를 일체 요구하지 않습니다. 사용자가 작성한 일기와 데이터는
                암호화되어 안전하게 보관되며, 사용자가 요청할 경우 언제든지 완전히 영구 삭제할 수 있습니다.
              </p>
            </div>

            {/* 1. 수집하는 개인정보 항목 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#6B1724]" />
                <span>1. 수집하는 개인정보 항목 및 수집 방법</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs">
                <p>온기 서비스는 회원가입 없는 간편 연결 및 서비스 제공을 위해 다음 정보를 수집합니다:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-stone-600">
                  <li>
                    <strong>필수 항목:</strong> 닉네임(호칭), 생성/참여한 방 코드, 임의 생성된 익명 기기 식별자(UUID/User ID), 푸시 알림 수신 동의 시 웹 푸시 구독 토큰(Endpoint Token).
                  </li>
                  <li>
                    <strong>서비스 이용 과정에서 생성되는 정보:</strong> 사용자가 직접 작성한 일기 본문(텍스트), 첨부 이미지(사진 데이터), 포스트잇 답장 및 반응 데이터, 온기 온도 및 작성 일시.
                  </li>
                  <li>
                    <strong>수집하지 않는 정보:</strong> 주민등록번호, 본인인증 정보, 위치 정보, 연락처 목록, 금융/결제 정보 등은 일체 수집하거나 저장하지 않습니다.
                  </li>
                </ul>
              </div>
            </section>

            {/* 2. 개인정보의 수집 및 이용 목적 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6B1724]" />
                <span>2. 개인정보의 수집 및 이용 목적</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>수집된 개인정보는 다음의 목적을 위해서만 엄격히 이용됩니다:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>2인 간 비밀 교환일기 방 생성, 상대방 연결 및 턴제 일기 작성·동기화 기능 제공</li>
                  <li>상대방의 일기 작성 완료 알림, 콕 찌르기(노크) 실시간 웹/앱 푸시 알림 발송</li>
                  <li>지난 일기 모아보기(서재 보관함) 및 추억의 유리병 3D 시각화 제공</li>
                  <li>부적절한 유해 콘텐츠 신고 접수 시 검토 및 이용 제한 조치 (Apple Review Guideline 1.2 준수)</li>
                </ul>
              </div>
            </section>

            {/* 3. 개인정보의 보유 및 파기 절차 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6B1724]" />
                <span>3. 개인정보의 보유 및 파기 기간</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>
                  1. 이용자의 개인정보는 <strong>교환일기 방이 유지되는 기간 동안에 한하여 보유 및 이용</strong>됩니다.<br />
                  2. 사용자가 앱 내 <strong>[설정] &gt; [상대방 차단 및 연결 해제]</strong> 또는 <strong>[방 나가기]</strong>를 수행할 경우, 이용자의 데이터 접근 권한이 즉시 차단됩니다.<br />
                  3. 사용자가 아래 고객지원 창구를 통해 일기 데이터 및 계정의 영구 삭제를 요청하는 경우, <strong>지체 없이 24시간 이내에 데이터베이스에서 복구 불가능한 방법으로 영구 파기</strong>합니다.
                </p>
              </div>
            </section>

            {/* 4. 개인정보의 기술적·관리적 보호 조치 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6B1724]" />
                <span>4. 개인정보의 암호화 및 기술적 보호 조치</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>
                    <strong>전송 구간 암호화:</strong> 모든 네트워크 통신은 최신 TLS/HTTPS 보안 프로토콜을 적용하여 데이터 전송 중 도청이나 위변조를 방지합니다.
                  </li>
                  <li>
                    <strong>데이터베이스 접근 통제:</strong> Firebase Firestore의 엄격한 보안 규칙(Security Rules)을 적용하여, 해당 일기방에 소속된 인증된 두 사용자 외에는 제3자가 일기나 정보를 열람할 수 없도록 원천 차단합니다.
                  </li>
                </ul>
              </div>
            </section>

            {/* 5. 개인정보의 제3자 제공 및 처리 위탁 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#6B1724]" />
                <span>5. 개인정보의 제3자 제공 및 처리 위탁</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>
                  ‘온기’는 이용자의 동의 없이 개인정보를 제3자에게 판매하거나 외부에 제공하지 않습니다. 다만, 글로벌 수준의 안정적인 인프라 유지를 위해 아래 전문 서비스에 데이터 처리를 위탁하고 있습니다:
                </p>
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-left border-collapse border border-stone-200">
                    <thead>
                      <tr className="bg-stone-100 text-stone-800">
                        <th className="p-2 border border-stone-200">수탁 업체</th>
                        <th className="p-2 border border-stone-200">위탁 업무 내용</th>
                        <th className="p-2 border border-stone-200">보유 및 이용 기간</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-stone-200 font-semibold">Google Cloud Platform (Firebase)</td>
                        <td className="p-2 border border-stone-200">클라우드 데이터베이스(Firestore) 및 파일 저장소 인프라 운영</td>
                        <td className="p-2 border border-stone-200">회원 탈퇴 또는 서비스 종료 시까지</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 6. 정보주체의 권리 및 행사 방법 (삭제 권리) */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#6B1724]" />
                <span>6. 이용자의 권리 및 데이터 삭제 요청 방법 (Apple Guideline 5.1.1 준수)</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>
                  사용자는 언제든지 자신에 관한 개인정보에 대해 열람, 정정, 삭제(파기), 처리 정지를 요구할 수 있습니다:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>인앱 데이터 삭제:</strong> 앱 내 상단바 메뉴의 [상대방 차단 및 연결 해제]를 통해 즉시 방에서 퇴장하고 연결을 끊을 수 있습니다.</li>
                  <li>
                    <strong>영구 데이터 삭제(계정 파기) 접수:</strong> 아래 기재된 공식 고객지원 이메일로 접속 시 사용한 닉네임 또는 방 코드를 기재하여 삭제를 요청하시면 <strong>영구히 데이터베이스에서 파기 처리</strong>해 드립니다.
                  </li>
                </ul>
              </div>
            </section>

            {/* 7. 개인정보 보호책임자 및 고객지원 창구 */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#6B1724]" />
                <span>7. 개인정보 보호책임자 및 고객지원 연락처</span>
              </h2>
              <div className="bg-[#FAF7F2] rounded-xl p-4 sm:p-5 border border-stone-300 space-y-3 text-xs">
                <p className="text-stone-700">
                  개인정보 보호와 관련된 모든 문의, 데이터 삭제 요청, 불편 사항은 아래의 공식 창구를 통해 문의하시면 신속히 답변드리겠습니다:
                </p>
                <div className="space-y-1.5 text-stone-800 font-mono">
                  <p>• <strong>서비스명:</strong> 온기 (Warmth)</p>
                  <p>• <strong>개발 및 개인정보 보호책임자:</strong> 이주형 (Developer)</p>
                  <p>• <strong>문의 이메일:</strong> <a href="mailto:yjh020701@gmail.com" className="text-[#6B1724] underline font-bold">yjh020701@gmail.com</a></p>
                  <p>• <strong>응답 시간:</strong> 영업일 기준 24시간 이내 신속 대응</p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* ======================= English Version ======================= */
          <div className="space-y-8 text-stone-700 text-sm leading-relaxed">
            {/* Summary Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-stone-800">
              <div className="flex items-center gap-2 font-bold text-[#6B1724]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Privacy by Design & Data Minimization</span>
              </div>
              <p className="text-xs text-stone-600 leading-normal">
                &lsquo;Warmth&rsquo; is designed to protect your most intimate exchange diary conversations. 
                We collect only the <strong>minimum necessary information</strong> to enable the two-person shared journaling experience. 
                We never ask for national IDs, financial data, or phone numbers. All your data is encrypted and can be permanently deleted upon request at any time.
              </p>
            </div>

            {/* 1. Data Collected */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#6B1724]" />
                <span>1. Information We Collect</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs">
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-stone-600">
                  <li>
                    <strong>Required identifiers:</strong> Display nickname, shared room code, an anonymous random device identifier (UUID), and optional web push subscription tokens.
                  </li>
                  <li>
                    <strong>User Generated Content:</strong> Diary entries (text), optional photo attachments, sticky-note reactions/stickers, warmth temperature values, and timestamp records.
                  </li>
                  <li>
                    <strong>What we do NOT collect:</strong> We do not collect government identification numbers, contacts, location, or payment card information.
                  </li>
                </ul>
              </div>
            </section>

            {/* 2. Purpose */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6B1724]" />
                <span>2. Purpose of Information Use</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>Collected information is used exclusively to:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Facilitate turn-based exchange diary writing, synchronization, and archiving between two connected partners.</li>
                  <li>Deliver optional real-time push notifications when a partner writes or sends a knock.</li>
                  <li>Render the 3D memory bottle visualizer and historical timeline archives.</li>
                  <li>Review objectionable content reports and enforce community safety (App Store Guideline 1.2).</li>
                </ul>
              </div>
            </section>

            {/* 3. Retention & Deletion */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6B1724]" />
                <span>3. Retention Period & Permanent Deletion</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>
                  1. Your data is retained only for the duration that your diary room remains active.<br />
                  2. Users may leave the room or disconnect from their partner at any time via <strong>[Block Partner &amp; Disconnect]</strong>.<br />
                  3. Users may request complete, permanent erasure of all their data and history by contacting support, and all corresponding database records will be <strong>irreversibly purged within 24 hours</strong>.
                </p>
              </div>
            </section>

            {/* 4. Security */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6B1724]" />
                <span>4. Security &amp; Encryption</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>TLS/HTTPS:</strong> All data transmissions are encrypted using industry-standard TLS encryption.</li>
                  <li><strong>Database Access Rules:</strong> Strict Cloud Firestore Security Rules enforce access control so that only the two authenticated participants in a room can view diary records.</li>
                </ul>
              </div>
            </section>

            {/* 5. Third Party Services */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#6B1724]" />
                <span>5. Third-Party Service Providers</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>We do not sell or monetize personal information. We utilize trusted cloud infrastructure:</p>
                <p>• <strong>Google Cloud Platform (Firebase):</strong> Secure cloud database and storage hosting.</p>
              </div>
            </section>

            {/* 6. User Rights & Data Erasure */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#6B1724]" />
                <span>6. User Rights &amp; How to Request Data Deletion</span>
              </h2>
              <div className="bg-white rounded-xl p-4 border border-[#E8DFD3] space-y-2 text-xs text-stone-600">
                <p>You have full authority to access, rectify, or permanently delete your information:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li><strong>In-App Deletion:</strong> Tap &lsquo;Block Partner &amp; Disconnect&rsquo; in the room header menu to immediately unlink and exit.</li>
                  <li><strong>Complete Database Purge:</strong> Email our support desk below with your nickname or room code to request immediate, permanent deletion.</li>
                </ul>
              </div>
            </section>

            {/* 7. Contact */}
            <section className="space-y-3">
              <h2 className="font-serif-warm font-bold text-lg text-stone-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#6B1724]" />
                <span>7. Contact Information &amp; Data Protection Officer</span>
              </h2>
              <div className="bg-[#FAF7F2] rounded-xl p-4 sm:p-5 border border-stone-300 space-y-3 text-xs">
                <div className="space-y-1.5 text-stone-800 font-mono">
                  <p>• <strong>Service:</strong> Warmth (온기)</p>
                  <p>• <strong>Developer / Lead:</strong> Joohyoung Yi</p>
                  <p>• <strong>Inquiry Email:</strong> <a href="mailto:yjh020701@gmail.com" className="text-[#6B1724] underline font-bold">yjh020701@gmail.com</a></p>
                  <p>• <strong>Support Response SLA:</strong> Within 24 business hours</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 하단 푸터 */}
        <div className="pt-8 border-t border-[#E8DFD3] text-center text-xs text-stone-400 space-y-2">
          <p>© 2026 온기 (Warmth). All rights reserved.</p>
          <div className="flex justify-center gap-4">
            <Link href="/" className="hover:text-stone-700 underline transition-colors">
              {lang === 'ko' ? '홈으로 돌아가기' : 'Return to Home'}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
