'use client';

import React, { useState, useEffect, useRef } from 'react';
import RoomHeader from '@/components/RoomHeader';
import OnboardingView from '@/components/OnboardingView';
import Envelope from '@/components/Envelope';
import MissionModal from '@/components/MissionModal';
import OpenedLetter from '@/components/OpenedLetter';
import WaitingLetter from '@/components/WaitingLetter';
import WriteDiaryModal from '@/components/WriteDiaryModal';
import KnockNotificationModal from '@/components/KnockNotificationModal';
import { DiaryData, KnockData, UIState, WaxColor } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { 
  saveDiaryToFirestore, 
  updateMissionInFirestore, 
  unsealDiaryInFirestore,
  sendKnockInFirestore,
  subscribeRoom,
  getOrCreateUserId
} from '@/lib/roomService';

// 초기 PRD 스펙 기반 일기 데이터
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
  createdAt: '2026-09-28T21:00:00.000Z',
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
  const [uiState, setUiState] = useState<UIState>('VIEW_ONBOARDING');
  const [roomCode, setRoomCode] = useState('829104');
  const [userName, setUserName] = useState('주형');
  const [partnerName, setPartnerName] = useState('유라');
  const [diary, setDiary] = useState<DiaryData>(INITIAL_DIARY);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 실시간 노크 수신 상태
  const [receivedKnock, setReceivedKnock] = useState<KnockData | null>(null);
  const [isKnockModalOpen, setIsKnockModalOpen] = useState(false);
  const handledKnockTimeRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 실시간 Firestore 룸 구독 (상대방의 노크 감지 및 실시간 상태 동기화)
  useEffect(() => {
    if (!roomCode) return;
    const myUid = getOrCreateUserId();

    const unsubscribe = subscribeRoom(roomCode, (room) => {
      // 1. 방에 상대방이 보낸 새 노크가 있는지 실시간 감지
      if (room.latestKnock) {
        const knock = room.latestKnock;
        const isFromPartner = knock.senderUid !== myUid;
        const isNewKnock = knock.knockedAt !== handledKnockTimeRef.current;
        // 10분 이내의 노크만 활성화
        const isRecent = Date.now() - new Date(knock.knockedAt).getTime() < 10 * 60 * 1000;

        if (isFromPartner && isNewKnock && isRecent) {
          handledKnockTimeRef.current = knock.knockedAt;
          soundEngine.playWindChimeKnock();
          setReceivedKnock(knock);
          setIsKnockModalOpen(true);
        }
      }
    });

    return () => unsubscribe();
  }, [roomCode]);

  // 0. 초대코드 매칭 완료 처리
  const handleMatched = (code: string, me: string, partner: string) => {
    setRoomCode(code);
    setUserName(me);
    setPartnerName(partner);
    setDiary((prev) => ({
      ...prev,
      authorName: partner,
      recipientName: me,
    }));
    setUiState('VIEW_SEALED_LETTER');
    showToast(`🎉 ${partner} 님과 일기장이 성공적으로 연결되었습니다! (방 번호: #${code})`);
  };

  // 1. 미션 통과 처리 -> Firestore 동기화 & VIEW_WAX_READY
  const handlePassMission = async (submissionText: string) => {
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

    try {
      await updateMissionInFirestore(roomCode, diary.diaryId, submissionText);
    } catch (e) {
      console.warn('Firestore update mission sync:', e);
    }
  };

  // 2. 3초 실링 왁스 해제 완료 -> Firestore 동기화 & VIEW_OPENED_DIARY
  const handleUnsealComplete = async () => {
    soundEngine.playPaperRustle();
    setDiary((prev) => ({
      ...prev,
      isWaxBroken: true,
      openedAt: new Date().toISOString(),
    }));
    setUiState('VIEW_OPENED_DIARY');
    showToast('📬 편지 봉인이 해제되었습니다. 정성스레 적은 일기를 읽어보세요.');

    try {
      await unsealDiaryInFirestore(roomCode, diary.diaryId);
    } catch (e) {
      console.warn('Firestore unseal sync:', e);
    }
  };

  // 3. 새 일기 작성 완료 -> Firestore 저장 & VIEW_WAITING (상대방 턴으로 전환)
  const handleSaveDiary = async (newDiaryPart: Partial<DiaryData>) => {
    const updated: DiaryData = {
      ...diary,
      ...newDiaryPart,
      diaryId: 'diary-' + Date.now(),
      isWaxBroken: false,
      openedAt: null,
    };
    setDiary(updated);
    setUiState('VIEW_WAITING');
    showToast(`📮 일기가 왁스로 단단히 봉인되어 ${partnerName} 님에게 전달되었습니다!`);

    try {
      await saveDiaryToFirestore(roomCode, updated);
    } catch (e) {
      console.warn('Firestore save diary sync:', e);
    }
  };

  // 4. 노크 보내기 처리 (Firestore에 기록하여 상대방에게 실시간 인앱 노크 전송)
  const handleSendKnock = async (message: string) => {
    try {
      await sendKnockInFirestore(roomCode, userName, message);
      showToast(`🔔 ${partnerName} 님에게 은은한 노크를 전했습니다.`);
    } catch (e) {
      console.warn('Firestore knock sync:', e);
      showToast(`🔔 ${partnerName} 님에게 은은한 노크를 전했습니다.`);
    }
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
    setUiState('VIEW_ONBOARDING');
    showToast('초기 매칭(온보딩) 상태로 전환되었습니다.');
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-[#FDFBF7] text-[#2C2A29] selection:bg-[#6B1724]/20 selection:text-[#6B1724]">
      {/* 서재 상단 바 */}
      <RoomHeader
        currentState={uiState}
        onSelectState={handleSelectState}
        onOpenWriteModal={() => setIsWriteModalOpen(true)}
        onResetDemo={handleResetDemo}
        roomCode={roomCode}
        userName={userName}
        partnerName={partnerName}
      />

      {/* 메인 뷰 컨테이너 */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 relative">
        {/* 토스트 알림 */}
        {toastMessage && (
          <div className="fixed bottom-[max(env(safe-area-inset-bottom),1.5rem)] z-50 px-4 py-2.5 rounded-full bg-stone-900/90 text-amber-100 text-xs sm:text-sm font-sans-ui shadow-2xl backdrop-blur-md animate-fade-in border border-amber-900/40 max-w-[90vw] text-center">
            {toastMessage}
          </div>
        )}

        {/* 0. VIEW_ONBOARDING: 방 생성(6자리 코드 발급) 및 1:1 초대코드 매칭 */}
        {uiState === 'VIEW_ONBOARDING' && (
          <OnboardingView onMatched={handleMatched} />
        )}

        {/* 1. VIEW_WAITING: 상대방 턴 진행 중 */}
        {uiState === 'VIEW_WAITING' && (
          <WaitingLetter
            partnerName={partnerName}
            onSendKnock={handleSendKnock}
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

      {/* 실시간 인앱 노크 도착 알림 팝업 모달 */}
      <KnockNotificationModal
        isOpen={isKnockModalOpen}
        knock={receivedKnock}
        onClose={() => setIsKnockModalOpen(false)}
        onWriteDiary={() => setIsWriteModalOpen(true)}
      />

      {/* 미션 수행 팝업 모달 */}
      <MissionModal
        isOpen={isMissionModalOpen}
        onClose={() => setIsMissionModalOpen(false)}
        mission={diary.mission}
        onPassMission={handlePassMission}
        diaryPhoto={diary.photos && diary.photos.length > 0 ? diary.photos[0] : undefined}
        partnerName={partnerName}
      />

      {/* 일기 작성 모달 */}
      <WriteDiaryModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        onSaveDiary={handleSaveDiary}
        currentUserName={userName}
        partnerName={partnerName}
        roomCode={roomCode}
      />

      {/* 푸터 */}
      <footer className="py-4 pb-[max(env(safe-area-inset-bottom),1rem)] text-center text-[11px] text-stone-500 font-serif-warm border-t border-[#EAE1D5]/60 bg-[#FAF7F2]/50 px-4">
        <p>온기 (Warmth) · 하루걸러 띄우는 우리 둘만의 아날로그 비밀 교환일기</p>
      </footer>
    </div>
  );
}
