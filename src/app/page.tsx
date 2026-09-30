'use client';

import React, { useState, useEffect, useRef } from 'react';
import RoomHeader from '@/components/RoomHeader';
import OnboardingView from '@/components/OnboardingView';
import Envelope from '@/components/Envelope';
import MissionModal from '@/components/MissionModal';
import OpenedLetter from '@/components/OpenedLetter';
import WaitingLetter from '@/components/WaitingLetter';
import EmptyDeskView from '@/components/EmptyDeskView';
import WriteDiaryModal from '@/components/WriteDiaryModal';
import KnockNotificationModal from '@/components/KnockNotificationModal';
import ArchiveModal from '@/components/ArchiveModal';
import { DiaryData, KnockData, UIState, WaxColor } from '@/types/diary';
import { soundEngine } from '@/lib/audio';
import { LogOut } from 'lucide-react';
import { 
  saveDiaryToFirestore, 
  updateMissionInFirestore, 
  unsealDiaryInFirestore,
  sendKnockInFirestore,
  subscribeRoom,
  leaveRoomInFirestore,
  getOrCreateUserId
} from '@/lib/roomService';
import { decryptDiaryData, decryptKnockData } from '@/lib/crypto';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { registerServiceWorker, sendLocalNotification } from '@/lib/notifications';

// 초기 PRD 스펙 기반 샘플 일기 데이터 (데모 전환 및 폴백용)
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
    type: 'QUIZ',
    prompt: '저번에 내가 가장 행복했다고 말했던 순간이 언제였게?',
    quizAnswer: '너랑 통화할 때',
    quizHint: '매일 밤 네 목소리가 들리는 시간이야!',
    isCustom: true,
    submission: null,
    isPassed: false,
  },
  isWaxBroken: false,
  openedAt: null,
  warmthScore: {
    temperature: 37.8,
    comment: '서촌 골목길의 바람마저 다정하게 녹여낸 따뜻한 온기',
    keywords: ['#서촌골목길', '#돌담길시집', '#따뜻한차한잔'],
  },
};

const STORAGE_KEYS = {
  ROOM_CODE: 'warmth_active_room_code',
  USER_NAME: 'warmth_active_user_name',
  PARTNER_NAME: 'warmth_active_partner_name',
};

export default function HomePage() {
  const [uiState, setUiState] = useState<UIState>('VIEW_ONBOARDING');
  const [roomCode, setRoomCode] = useState('829104');
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const param = new URLSearchParams(window.location.search).get('user');
        if (param === 'yura') return '유라';
      } catch {}
    }
    return '주형';
  });
  const [partnerName, setPartnerName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const param = new URLSearchParams(window.location.search).get('user');
        if (param === 'yura') return '주형';
      } catch {}
    }
    return '유라';
  });

  // 초기 상태: 작성된 편지가 없을 때는 null (맨 처음 편지 쓰기 플로우 우선)
  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 실시간 노크 수신 상태
  const [receivedKnock, setReceivedKnock] = useState<KnockData | null>(null);
  const [isKnockModalOpen, setIsKnockModalOpen] = useState(false);
  const handledKnockTimeRef = useRef<string | null>(null);
  const handledDiaryIdRef = useRef<string | null>(null);

  // 상대방 연결 해제 수신 모달 상태
  const [isPartnerDisconnectedModalOpen, setIsPartnerDisconnectedModalOpen] = useState(false);
  const [partnerDisconnectedNickname, setPartnerDisconnectedNickname] = useState('');
  const handledDisconnectionTimeRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. 앱 마운트 시 저장된 세션(방 코드 및 닉네임) 자동 복구 & 재접속 및 서비스 워커 등록
  useEffect(() => {
    if (typeof window === 'undefined') return;
    registerServiceWorker();
    try {
      const savedRoom = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER_NAME);
      const savedPartner = localStorage.getItem(STORAGE_KEYS.PARTNER_NAME);

      if (savedRoom && savedUser && savedPartner) {
        setRoomCode(savedRoom);
        setUserName(savedUser);
        setPartnerName(savedPartner);

        (async () => {
          try {
            const roomRef = doc(db, 'rooms', savedRoom);
            const snap = await getDoc(roomRef);
            if (snap.exists()) {
              const roomData = snap.data();
              if (roomData.latestDiaryId) {
                const diaryRef = doc(db, 'rooms', savedRoom, 'diaries', roomData.latestDiaryId);
                const diarySnap = await getDoc(diaryRef);
                if (diarySnap.exists()) {
                  const rawDiary = diarySnap.data() as DiaryData;
                  const decrypted = await decryptDiaryData(savedRoom, rawDiary, roomData.roomSalt);
                  setDiary(decrypted);
                  if (decrypted.authorName === savedUser) {
                    setUiState(decrypted.isWaxBroken ? 'VIEW_OPENED_DIARY' : 'VIEW_WAITING');
                  } else {
                    setUiState(
                      decrypted.isWaxBroken
                        ? 'VIEW_OPENED_DIARY'
                        : decrypted.mission?.isPassed
                        ? 'VIEW_WAX_READY'
                        : 'VIEW_SEALED_LETTER'
                    );
                  }
                  showToast(`📖 ${savedPartner} 님과의 일기장으로 복귀했습니다.`);
                  return;
                }
              }
              // 일기가 아직 없는 방
              setDiary(null);
              setUiState('VIEW_EMPTY');
              showToast(`📖 ${savedPartner} 님과의 일기장으로 복귀했습니다.`);
            } else {
              // 방이 삭제되었거나 존재하지 않는 경우 초기화
              localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
              localStorage.removeItem(STORAGE_KEYS.USER_NAME);
              localStorage.removeItem(STORAGE_KEYS.PARTNER_NAME);
              setUiState('VIEW_ONBOARDING');
            }
          } catch (err) {
            console.warn('Auto-reconnect failed:', err);
          }
        })();
      }
    } catch (e) {
      console.warn('Failed to load session:', e);
    }
  }, []);

  // 실시간 Firestore 룸 및 일기 구독 (상대방의 노크 및 새 일기 실시간 감지 + E2EE 복호화 + 웹 푸시 알림)
  useEffect(() => {
    if (!roomCode || uiState === 'VIEW_ONBOARDING') return;
    const myUid = getOrCreateUserId();

    const unsubscribe = subscribeRoom(roomCode, async (room) => {
      // 1. 방에 상대방이 보낸 새 노크가 있는지 실시간 감지 & E2EE 복호화
      if (room.latestKnock) {
        const rawKnock = room.latestKnock;
        const isFromPartner = rawKnock.senderUid !== myUid;
        const isNewKnock = rawKnock.knockedAt !== handledKnockTimeRef.current;
        const isRecent = Date.now() - new Date(rawKnock.knockedAt).getTime() < 10 * 60 * 1000;

        if (isFromPartner && isNewKnock && isRecent) {
          handledKnockTimeRef.current = rawKnock.knockedAt;
          soundEngine.playWindChimeKnock();
          const decryptedKnock = await decryptKnockData(roomCode, rawKnock, room.roomSalt);
          setReceivedKnock(decryptedKnock);
          setIsKnockModalOpen(true);
          sendLocalNotification(
            '🔔 똑똑, 노크가 도착했습니다!',
            `${decryptedKnock.senderName || partnerName} 님이 일기장 문을 두드렸어요.`
          );
        }
      }

      // 2. 방에 최신 일기(latestDiaryId)가 업데이트되었을 때 실시간 동기화 & E2EE 복호화
      if (room.latestDiaryId && room.latestDiaryId !== handledDiaryIdRef.current) {
        handledDiaryIdRef.current = room.latestDiaryId;
        try {
          const diaryRef = doc(db, 'rooms', roomCode, 'diaries', room.latestDiaryId);
          const snap = await getDoc(diaryRef);
          if (snap.exists()) {
            const rawDiary = snap.data() as DiaryData;
            // 클라이언트에서 256-bit 복호화 수행 (서버는 암호문만 보관)
            const latestDiary = await decryptDiaryData(roomCode, rawDiary, room.roomSalt);
            setDiary(latestDiary);

            // 작성자인지 수신자인지에 따른 UI 상태 결정
            if (latestDiary.authorName === userName) {
              setUiState(latestDiary.isWaxBroken ? 'VIEW_OPENED_DIARY' : 'VIEW_WAITING');
            } else {
              soundEngine.playPaperRustle();
              // 상대방 편지가 있으므로 편지를 까는 메뉴 (봉인 해제 관문 열기)가 뜸
              if (latestDiary.isWaxBroken) {
                setUiState('VIEW_OPENED_DIARY');
              } else if (latestDiary.mission?.isPassed) {
                setUiState('VIEW_WAX_READY');
              } else {
                setUiState('VIEW_SEALED_LETTER');
              }
              showToast(`📬 ${latestDiary.authorName} 님에게서 새 일기가 도착했습니다!`);
              sendLocalNotification(
                '📬 새 일기가 도착했습니다!',
                `${latestDiary.authorName} 님이 보낸 비밀 편지가 서재에 도착했습니다.`
              );
            }
          }
        } catch (err) {
          console.warn('Failed to fetch latest diary:', err);
        }
      } else if (!room.latestDiaryId) {
        // 일기가 아직 없는 맨 처음 초기 상태 -> 편지 쓰기가 제일 먼저 나옴
        setDiary(null);
        setUiState('VIEW_EMPTY');
      }

      // 3. 상대방이 일기장 연결을 해제(방 나가기)했을 때 실시간 감지 및 알림
      if (room.lastDisconnection) {
        const disc = room.lastDisconnection;
        const isFromPartner = disc.leaverUid !== myUid;
        const isNewDisconnection = disc.disconnectedAt !== handledDisconnectionTimeRef.current;

        if (isFromPartner && isNewDisconnection) {
          handledDisconnectionTimeRef.current = disc.disconnectedAt;
          soundEngine.playWindChimeKnock();
          const leaver = disc.leaverNickname || partnerName || '상대방';
          setPartnerDisconnectedNickname(leaver);
          setIsPartnerDisconnectedModalOpen(true);
          showToast(`💔 ${leaver} 님이 일기장 연결을 해제했습니다.`);
          sendLocalNotification(
            '💔 상대방이 일기장을 떠났습니다',
            `${leaver} 님이 일기장 연결을 해제했습니다.`
          );
        }
      }
    });

    return () => unsubscribe();
  }, [roomCode, uiState, userName]);

  // 0. 초대코드 매칭 완료 처리
  const handleMatched = async (code: string, me: string, partner: string) => {
    setRoomCode(code);
    setUserName(me);
    setPartnerName(partner);

    // 세션 영구 보관 (PWA 재접속 시 자동 매칭 복구)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, me);
        localStorage.setItem(STORAGE_KEYS.PARTNER_NAME, partner);
      } catch (e) {
        console.warn('Failed to save session to localStorage:', e);
      }
    }

    // 방에 기존 일기가 있는지 Firestore에서 즉시 확인
    try {
      const roomRef = doc(db, 'rooms', code);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const roomData = snap.data();
        if (roomData.latestDiaryId) {
          // 일기가 존재하는 경우: 일기를 불러와서 수신자이면 편지 까는 메뉴(VIEW_SEALED_LETTER)로 이동
          const diaryRef = doc(db, 'rooms', code, 'diaries', roomData.latestDiaryId);
          const diarySnap = await getDoc(diaryRef);
          if (diarySnap.exists()) {
            const rawDiary = diarySnap.data() as DiaryData;
            const decrypted = await decryptDiaryData(code, rawDiary, roomData.roomSalt);
            setDiary(decrypted);
            if (decrypted.authorName === me) {
              setUiState(decrypted.isWaxBroken ? 'VIEW_OPENED_DIARY' : 'VIEW_WAITING');
            } else {
              setUiState(decrypted.isWaxBroken ? 'VIEW_OPENED_DIARY' : decrypted.mission?.isPassed ? 'VIEW_WAX_READY' : 'VIEW_SEALED_LETTER');
            }
            showToast(`🎉 ${partner} 님과 일기장이 연결되었습니다!`);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Check room on match:', e);
    }

    // 일기가 없는 맨 처음 초기 상태 -> 편지 쓰기가 제일 먼저 나와야 함!
    setDiary(null);
    setUiState('VIEW_EMPTY');
    setIsWriteModalOpen(true);
    showToast(`🎉 ${partner} 님과 연결되었습니다! 첫 편지를 작성해보세요.`);
  };

  // 방 나가기 (감성 인앱 확인 모달 표시)
  const handleLeaveRoom = () => {
    setIsLeaveConfirmOpen(true);
  };

  const confirmLeaveRoom = async () => {
    setIsLeaveConfirmOpen(false);

    // Firestore에 나가기 상태 동기화 (상대방 기기에 실시간 알림 전송)
    if (roomCode) {
      try {
        const myUid = getOrCreateUserId();
        await leaveRoomInFirestore(roomCode, myUid, userName);
      } catch (e) {
        console.warn('Failed to leave room in firestore:', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        localStorage.removeItem(STORAGE_KEYS.PARTNER_NAME);
      } catch {}
    }

    setDiary(null);
    setRoomCode('');
    setUiState('VIEW_ONBOARDING');
    showToast('일기장 연결이 해제되었습니다.');
  };

  // 상대방의 연결 해제 확인 후 세션 정리 및 시작 화면 복귀
  const handleAcknowledgePartnerDisconnect = () => {
    setIsPartnerDisconnectedModalOpen(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        localStorage.removeItem(STORAGE_KEYS.PARTNER_NAME);
      } catch {}
    }

    setDiary(null);
    setRoomCode('');
    setUiState('VIEW_ONBOARDING');
  };


  // 1. 미션 통과 처리 -> Firestore 동기화 & VIEW_WAX_READY
  const handlePassMission = async (submissionText: string) => {
    if (!diary) return;
    setDiary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        mission: {
          ...prev.mission,
          isPassed: true,
          submission: {
            text: submissionText,
            submittedAt: new Date().toISOString(),
          },
        },
      };
    });
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
    if (!diary) return;
    soundEngine.playPaperRustle();
    setDiary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isWaxBroken: true,
        openedAt: new Date().toISOString(),
      };
    });
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
    const myUid = getOrCreateUserId();
    const updated: DiaryData = {
      ...(diary || INITIAL_DIARY),
      ...newDiaryPart,
      authorId: myUid,
      authorName: userName,
      recipientName: partnerName,
      diaryId: 'diary-' + Date.now(),
      isWaxBroken: false,
      openedAt: null,
    };
    setDiary(updated);
    setUiState('VIEW_WAITING');
    showToast(`📮 일기가 왁스로 단단히 봉인되어 ${partnerName} 님에게 전달되었습니다!`);

    try {
      await saveDiaryToFirestore(roomCode, updated);
    } catch (e: unknown) {
      console.warn('Firestore save diary sync:', e);
      const errMsg = e instanceof Error ? e.message : '';
      if (errMsg.includes('턴') || errMsg.includes('전송')) {
        showToast('⚠️ 상대방이 이미 새 일기를 등록했습니다.');
      }
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

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-[#FDFBF7] text-[#2C2A29] selection:bg-[#6B1724]/20 selection:text-[#6B1724]">
      {/* 서재 상단 바 (정식 상용 헤더) */}
      <RoomHeader
        currentState={uiState}
        onOpenWriteModal={() => setIsWriteModalOpen(true)}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onLeaveRoom={handleLeaveRoom}
        roomCode={roomCode}
        userName={userName}
        partnerName={partnerName}
      />

      {/* 메인 뷰 컨테이너 (iOS 스크롤 및 키보드 오버플로우 방지) */}
      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] relative overflow-y-auto sm:overflow-visible">
        {/* 토스트 알림 (iOS 홈 바 위로 안전 배치) */}
        {toastMessage && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] z-50 px-4 py-2.5 rounded-full bg-stone-900/90 text-amber-100 text-xs sm:text-sm font-sans-ui shadow-2xl backdrop-blur-md animate-fade-in border border-amber-900/40 max-w-[90vw] text-center">
            {toastMessage}
          </div>
        )}

        {/* 0. VIEW_ONBOARDING: 방 생성(6자리 코드 발급) 및 1:1 초대코드 매칭 */}
        {uiState === 'VIEW_ONBOARDING' && (
          <OnboardingView onMatched={handleMatched} />
        )}

        {/* 1. VIEW_EMPTY: 초기 상태 - 아직 편지가 없을 때 편지 쓰기가 제일 먼저 나옴 */}
        {uiState === 'VIEW_EMPTY' && (
          <EmptyDeskView
            partnerName={partnerName}
            userName={userName}
            onOpenWriteModal={() => setIsWriteModalOpen(true)}
            roomCode={roomCode}
          />
        )}

        {/* 2. VIEW_WAITING: 내가 작성 후 상대방 턴 진행 중 (답장 대기) */}
        {uiState === 'VIEW_WAITING' && (
          <WaitingLetter
            partnerName={partnerName}
            onSendKnock={handleSendKnock}
          />
        )}

        {/* 3. VIEW_SEALED_LETTER: 편지가 있을 때 -> 편지를 까는 메뉴 (미션 게이트 대기) */}
        {uiState === 'VIEW_SEALED_LETTER' && (
          diary ? (
            <Envelope
              diary={diary}
              isLocked={true}
              onOpenMission={() => setIsMissionModalOpen(true)}
              onUnsealComplete={handleUnsealComplete}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={() => setIsWriteModalOpen(true)}
              roomCode={roomCode}
            />
          )
        )}

        {/* 4. VIEW_WAX_READY: 미션 클리어 후 3초 실링 왁스 롱프레스 개봉 */}
        {uiState === 'VIEW_WAX_READY' && (
          diary ? (
            <Envelope
              diary={diary}
              isLocked={false}
              onOpenMission={() => setIsMissionModalOpen(true)}
              onUnsealComplete={handleUnsealComplete}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={() => setIsWriteModalOpen(true)}
              roomCode={roomCode}
            />
          )
        )}

        {/* 5. VIEW_OPENED_DIARY: 왁스 개봉 완료, 일기 본문 열람 */}
        {uiState === 'VIEW_OPENED_DIARY' && (
          diary ? (
            <OpenedLetter
              diary={diary}
              onWriteReply={() => setIsWriteModalOpen(true)}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={() => setIsWriteModalOpen(true)}
              roomCode={roomCode}
            />
          )
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
        mission={diary?.mission || INITIAL_DIARY.mission}
        onPassMission={handlePassMission}
        diaryPhoto={diary?.photos && diary.photos.length > 0 ? diary.photos[0] : undefined}
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
        fallbackPreviousDiary={diary}
      />

      {/* 둘만의 서재(아카이브) 모달 (E2EE 암호화 해제 열람) */}
      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        roomCode={roomCode}
        currentUserName={userName}
        partnerName={partnerName}
        onSelectDiary={(selectedDiary) => {
          setDiary(selectedDiary);
          setUiState('VIEW_OPENED_DIARY');
          setIsArchiveOpen(false);
          showToast(`📖 ${selectedDiary.authorName} 님의 '${selectedDiary.title}' 일기를 서재에서 펼쳤습니다.`);
        }}
      />

      {/* 일기장 연결 해제 확인 인앱 모달 */}
      {isLeaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 mx-auto shadow-2xs">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-serif-warm font-bold text-stone-900 text-lg">
                일기장 연결을 해제하시겠습니까?
              </h3>
              <p className="text-xs text-stone-600 font-serif-warm leading-relaxed">
                현재 기기에서 일기장의 연결을 끊고 초기 화면으로 돌아갑니다.
                <br />
                <span className="font-mono font-semibold text-amber-950 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                  초대코드 #{roomCode}
                </span>{' '}
                로 언제든 다시 연결하실 수 있습니다.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaveConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold font-sans-ui cursor-pointer active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmLeaveRoom}
                className="flex-1 py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold font-sans-ui shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                연결 해제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상대방이 일기장 연결을 해제했을 때의 안내 모달 */}
      {isPartnerDisconnectedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-xl mx-auto shadow-2xs">
              🍂
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-serif-warm font-bold text-stone-900 text-lg">
                상대방이 일기장을 떠났습니다
              </h3>
              <p className="text-xs text-stone-600 font-serif-warm leading-relaxed">
                <span className="font-semibold text-stone-800">
                  {partnerDisconnectedNickname || partnerName || '상대방'}
                </span>
                {' '}님이 일기장 연결을 해제했습니다.
                <br />
                함께 작성했던 소중한 시간들이 마무리되었습니다.
                <br />
                새로운 일기장을 시작하시려면 초기 화면으로 이동해주세요.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAcknowledgePartnerDisconnect}
                className="w-full py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold font-sans-ui shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                확인 (시작 화면으로 이동)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 푸터 (iOS 홈 인디케이터 제스처 여백 확보) */}
      <footer className="py-2 sm:py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] text-center text-[10px] sm:text-[11px] text-stone-400 font-serif-warm border-t border-[#EAE1D5]/40 bg-[#FAF7F2]/50 px-3 shrink-0">
        <p>온기 (Warmth) · 하루걸러 띄우는 우리 둘만의 아날로그 비밀 교환일기</p>
      </footer>
    </div>
  );
}
