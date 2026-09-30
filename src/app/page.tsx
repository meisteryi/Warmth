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
import { 
  saveDiaryToFirestore, 
  updateMissionInFirestore, 
  unsealDiaryInFirestore,
  sendKnockInFirestore,
  subscribeRoom,
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
    prompt: '오늘 내가 가장 행복했던 순간은 언제였을까요?',
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 실시간 노크 수신 상태
  const [receivedKnock, setReceivedKnock] = useState<KnockData | null>(null);
  const [isKnockModalOpen, setIsKnockModalOpen] = useState(false);
  const handledKnockTimeRef = useRef<string | null>(null);
  const handledDiaryIdRef = useRef<string | null>(null);

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

  // 방 나가기 (일기장 연결 해제)
  const handleLeaveRoom = () => {
    const confirmed = window.confirm(
      '현재 일기장과의 연결을 해제하고 방을 나가시겠습니까?\n(초대코드로 언제든 다시 연결할 수 있습니다)'
    );
    if (!confirmed) return;

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        localStorage.removeItem(STORAGE_KEYS.PARTNER_NAME);
      } catch {}
    }

    setDiary(null);
    setUiState('VIEW_ONBOARDING');
    showToast('일기장 연결이 해제되었습니다.');
  };

  // 시점 전환 (주형 ⇄ 유라 2인 시뮬레이션 지원)
  const handleSwitchUser = () => {
    soundEngine.playTileSlideSound();
    const nextUser = userName === '주형' ? '유라' : '주형';
    const nextPartner = nextUser === '주형' ? '유라' : '주형';

    setUserName(nextUser);
    setPartnerName(nextPartner);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.USER_NAME, nextUser);
        localStorage.setItem(STORAGE_KEYS.PARTNER_NAME, nextPartner);
      } catch {}
    }

    // 새 사용자의 시점에 맞추어 UI 상태 자동 갱신
    if (uiState !== 'VIEW_ONBOARDING') {
      if (!diary) {
        // 일기가 없는 초기 상태
        setUiState('VIEW_EMPTY');
      } else if (diary.authorName === nextUser) {
        // 내가 쓴 일기 -> 상대방 턴 대기 화면
        setUiState(diary.isWaxBroken ? 'VIEW_OPENED_DIARY' : 'VIEW_WAITING');
      } else {
        // 상대방이 내게 보낸 편지가 있으므로 -> 편지를 까는 메뉴 (미션/봉인 상태에 따라 표시)
        if (diary.isWaxBroken) {
          setUiState('VIEW_OPENED_DIARY');
        } else if (diary.mission?.isPassed) {
          setUiState('VIEW_WAX_READY');
        } else {
          setUiState('VIEW_SEALED_LETTER');
        }
      }
    }

    showToast(`👤 시점이 전환되었습니다: ${nextUser} 님의 시점`);
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

  // 상태 수동 전환 시 일관성 유지 (데모 및 리뷰 지원)
  const handleSelectState = (nextState: UIState) => {
    setUiState(nextState);
    if (nextState === 'VIEW_EMPTY') {
      setIsWriteModalOpen(true);
    } else if (nextState === 'VIEW_SEALED_LETTER') {
      setDiary((prev) => {
        const base = prev || INITIAL_DIARY;
        return {
          ...base,
          authorName: partnerName,
          recipientName: userName,
          isWaxBroken: false,
          mission: { ...base.mission, isPassed: false },
        };
      });
    } else if (nextState === 'VIEW_WAX_READY') {
      setDiary((prev) => {
        const base = prev || INITIAL_DIARY;
        return {
          ...base,
          authorName: partnerName,
          recipientName: userName,
          isWaxBroken: false,
          mission: { ...base.mission, isPassed: true },
        };
      });
    } else if (nextState === 'VIEW_OPENED_DIARY') {
      setDiary((prev) => {
        const base = prev || INITIAL_DIARY;
        return {
          ...base,
          authorName: partnerName,
          recipientName: userName,
          isWaxBroken: true,
          mission: { ...base.mission, isPassed: true },
        };
      });
    }
  };

  const handleResetDemo = () => {
    setDiary(null);
    setUiState('VIEW_EMPTY');
    setIsWriteModalOpen(true);
    showToast('초기 상태로 되돌아왔습니다. 첫 편지를 작성해보세요.');
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-[#FDFBF7] text-[#2C2A29] selection:bg-[#6B1724]/20 selection:text-[#6B1724]">
      {/* 서재 상단 바 */}
      <RoomHeader
        currentState={uiState}
        onSelectState={handleSelectState}
        onOpenWriteModal={() => setIsWriteModalOpen(true)}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onLeaveRoom={handleLeaveRoom}
        onResetDemo={handleResetDemo}
        onSwitchUser={handleSwitchUser}
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

      {/* 푸터 (iOS 홈 인디케이터 제스처 여백 확보) */}
      <footer className="py-2 sm:py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] text-center text-[10px] sm:text-[11px] text-stone-400 font-serif-warm border-t border-[#EAE1D5]/40 bg-[#FAF7F2]/50 px-3 shrink-0">
        <p>온기 (Warmth) · 하루걸러 띄우는 우리 둘만의 아날로그 비밀 교환일기</p>
      </footer>
    </div>
  );
}
