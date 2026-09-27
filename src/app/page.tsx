'use client';

import React, { useState } from 'react';
import RoomHeader from '@/components/RoomHeader';
import Envelope from '@/components/Envelope';
import MissionModal from '@/components/MissionModal';
import OpenedLetter from '@/components/OpenedLetter';
import WaitingLetter from '@/components/WaitingLetter';
import WriteDiaryModal from '@/components/WriteDiaryModal';
import { DiaryData, UIState, WaxColor } from '@/types/diary';
import { soundEngine } from '@/lib/audio';

// 초기 PRD 스펙 기반 목업 일기 데이터
const INITIAL_DIARY: DiaryData = {
  diaryId: 'diary-demo-01',
  authorId: 'UID_B',
  authorName: '유라',
  recipientId: 'UID_A',
  recipientName: '주형',
  title: '서촌 골목길을 걷다가',
  content: `오늘 날씨가 정말 선선해서 걸어가는 내내 네 생각이 많이 났어.

오랜만에 서촌의 한적한 돌담길을 천천히 걸었는데, 작은 독립서점 쇼윈도 앞에서 우리가 작년에 함께 골랐던 시집이 놓여있더라. 문득 그날 우리가 나눴던 시시콜콜한 농담들이 떠올라 나도 모르게 혼자 피식 웃었지 뭐야.

유난히 피곤하고 길었던 한 주였지만, 네가 어제 남겨준 다정한 일기 한 편을 퇴근길에 꺼내 읽으며 마음에 큰 위로를 얻었어.

내일 저녁엔 우리 그때 그 골목 카페에서 따뜻한 차 한잔 같이 할까?
오늘 밤도 찬바람 들지 않게 이불 포근하게 덮고, 편안한 꿈꾸길 바라.`,
  photos: [
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80',
  ],
  waxColor: '#6B1724' as WaxColor,
  createdAt: new Date().toISOString(),
  mission: {
    type: 'TEXT',
    prompt: '오늘 하루도 정말 고생 많았을 서로에게 20자 이상의 다정한 한 줄 쪽지를 남겨주세요.',
    quizAnswer: null,
    isCustom: false,
    submission: null,
    isPassed: false,
  },
  isWaxBroken: false,
  openedAt: null,
};

export default function HomePage() {
  const [uiState, setUiState] = useState<UIState>('VIEW_SEALED_LETTER');
  const [diary, setDiary] = useState<DiaryData>(INITIAL_DIARY);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. 미션 통과 처리 -> VIEW_WAX_READY
  const handlePassMission = (submissionText: string) => {
    setDiary((prev) => ({
      ...prev,
      mission: {
        ...prev.mission,
        isPassed: true,
        submission: {
          text: submissionText,
          submittedAt: new Date().toISOString(),
        },
      },
    }));
    setUiState('VIEW_WAX_READY');
    showToast('✨ 미션을 완료했습니다! 이제 실링 왁스를 3초 동안 눌러 봉인을 풀어보세요.');
  };

  // 2. 3초 실링 왁스 해제 완료 -> VIEW_OPENED_DIARY
  const handleUnsealComplete = () => {
    soundEngine.playPaperRustle();
    setDiary((prev) => ({
      ...prev,
      isWaxBroken: true,
      openedAt: new Date().toISOString(),
    }));
    setUiState('VIEW_OPENED_DIARY');
    showToast('📬 편지 봉인이 해제되었습니다. 정성스레 적은 일기를 읽어보세요.');
  };

  // 3. 새 일기 작성 완료 -> VIEW_WAITING (상대방 턴으로 전환)
  const handleSaveDiary = (newDiaryPart: Partial<DiaryData>) => {
    const updated: DiaryData = {
      ...diary,
      ...newDiaryPart,
      diaryId: 'diary-' + Date.now(),
      isWaxBroken: false,
      openedAt: null,
    };
    setDiary(updated);
    setUiState('VIEW_WAITING');
    showToast('📮 일기가 왁스로 단단히 봉인되어 유라 님에게 전달되었습니다!');
  };

  // 상태 수동 전환 시 일관성 유지
  const handleSelectState = (nextState: UIState) => {
    setUiState(nextState);
    if (nextState === 'VIEW_SEALED_LETTER') {
      setDiary((prev) => ({
        ...prev,
        isWaxBroken: false,
        mission: { ...prev.mission, isPassed: false },
      }));
    } else if (nextState === 'VIEW_WAX_READY') {
      setDiary((prev) => ({
        ...prev,
        isWaxBroken: false,
        mission: { ...prev.mission, isPassed: true },
      }));
    } else if (nextState === 'VIEW_OPENED_DIARY') {
      setDiary((prev) => ({
        ...prev,
        isWaxBroken: true,
        mission: { ...prev.mission, isPassed: true },
      }));
    }
  };

  const handleResetDemo = () => {
    setDiary(INITIAL_DIARY);
    setUiState('VIEW_SEALED_LETTER');
    showToast('데모 상태가 초기화되었습니다.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-[#2C2A29] selection:bg-[#6B1724]/20 selection:text-[#6B1724]">
      {/* 서재 상단 바 */}
      <RoomHeader
        currentState={uiState}
        onSelectState={handleSelectState}
        onOpenWriteModal={() => setIsWriteModalOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* 메인 뷰 컨테이너 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* 토스트 알림 */}
        {toastMessage && (
          <div className="fixed bottom-6 z-50 px-4 py-2.5 rounded-full bg-stone-900/90 text-amber-100 text-xs sm:text-sm font-sans-ui shadow-2xl backdrop-blur-md animate-fade-in border border-amber-900/40">
            {toastMessage}
          </div>
        )}

        {/* 1. VIEW_WAITING: 상대방 턴 진행 중 */}
        {uiState === 'VIEW_WAITING' && (
          <WaitingLetter
            partnerName="유라"
            onSendKnock={() => showToast('🔔 유라 님에게 은은한 노크 알림을 보냈습니다.')}
          />
        )}

        {/* 2. VIEW_SEALED_LETTER: 새 일기 도착, 미션 미완수 */}
        {uiState === 'VIEW_SEALED_LETTER' && (
          <Envelope
            diary={diary}
            isLocked={true}
            onOpenMission={() => setIsMissionModalOpen(true)}
            onUnsealComplete={handleUnsealComplete}
          />
        )}

        {/* 3. VIEW_WAX_READY: 미션 클리어 후 3초 실링 왁스 롱프레스 대기 */}
        {uiState === 'VIEW_WAX_READY' && (
          <Envelope
            diary={diary}
            isLocked={false}
            onOpenMission={() => setIsMissionModalOpen(true)}
            onUnsealComplete={handleUnsealComplete}
          />
        )}

        {/* 4. VIEW_OPENED_DIARY: 왁스 개봉 완료, 일기 본문 열람 */}
        {uiState === 'VIEW_OPENED_DIARY' && (
          <OpenedLetter
            diary={diary}
            onWriteReply={() => setIsWriteModalOpen(true)}
          />
        )}
      </main>

      {/* 미션 수행 팝업 모달 */}
      <MissionModal
        isOpen={isMissionModalOpen}
        onClose={() => setIsMissionModalOpen(false)}
        mission={diary.mission}
        onPassMission={handlePassMission}
      />

      {/* 일기 작성 모달 */}
      <WriteDiaryModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        onSaveDiary={handleSaveDiary}
        currentUserName="주형"
        partnerName="유라"
      />

      {/* 푸터 */}
      <footer className="py-4 text-center text-[11px] text-stone-500 font-serif-warm border-t border-[#EAE1D5]/60 bg-[#FAF7F2]/50">
        <p>온기 (Warmth) · 하루걸러 띄우는 우리 둘만의 아날로그 비밀 교환일기</p>
      </footer>
    </div>
  );
}
