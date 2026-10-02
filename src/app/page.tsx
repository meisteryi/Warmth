'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import HomeView from '@/components/HomeView';
import { DiaryData, KnockData, UIState, WaxColor, RoomData } from '@/types/diary';
import { isDiaryWrittenInCurrentCycle, getTimeUntilNextReset, ResetCountdownInfo } from '@/lib/dateUtils';
import { soundEngine } from '@/lib/audio';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, BookOpen, Sparkles } from 'lucide-react';
import { 
  saveDiaryToFirestore, 
  updateMissionInFirestore, 
  unsealDiaryInFirestore,
  sendKnockInFirestore,
  subscribeRoom,
  subscribeDiary,
  leaveRoomInFirestore,
  getOrCreateUserId,
  setExplicitUserId
} from '@/lib/roomService';
import { decryptDiaryData, decryptKnockData } from '@/lib/crypto';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { registerServiceWorker, sendLocalNotification } from '@/lib/notifications';

// 초기 PRD 스펙 기반 샘플 일기 데이터 (데모 전환 및 폴백용)
const INITIAL_DIARY: DiaryData = {
  diaryId: 'diary-demo-01',
  authorId: 'UID_B',
  authorName: '연인',
  recipientId: 'UID_A',
  recipientName: '나',
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
  USER_ROLE: 'warmth_active_user_role',
};

// 동일 브라우저 다중 탭/창 격리 및 새로고침/PWA 복원을 지원하는 하이브리드 세션 스토리지
const sessionStore = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const sess = sessionStorage.getItem(key);
      if (sess !== null && sess !== '') return sess;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, val: string) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, val);
      localStorage.setItem(key, val);
    } catch {}
  },
  remove: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {}
  },
};

export default function HomePage() {
  const [uiState, setUiState] = useState<UIState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRoom = sessionStore.get(STORAGE_KEYS.ROOM_CODE);
        const savedUser = sessionStore.get(STORAGE_KEYS.USER_NAME);
        const savedPartner = sessionStore.get(STORAGE_KEYS.PARTNER_NAME);
        if (savedRoom && savedUser && savedPartner) {
          return 'VIEW_HOME';
        }
      } catch {}
    }
    return 'VIEW_ONBOARDING';
  });
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStore.get(STORAGE_KEYS.ROOM_CODE);
        if (saved) return saved;
      } catch {}
    }
    return '';
  });
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStore.get(STORAGE_KEYS.USER_NAME);
        if (saved) return saved;
      } catch {}
    }
    return '나';
  });
  const [partnerName, setPartnerName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStore.get(STORAGE_KEYS.PARTNER_NAME);
        if (saved) return saved;
      } catch {}
    }
    return '상대방';
  });

  // 방장(CREATOR) vs 초대받은 사람(PARTNER) 역할 상태
  const [userRole, setUserRole] = useState<'CREATOR' | 'PARTNER'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStore.get(STORAGE_KEYS.USER_ROLE) as 'CREATOR' | 'PARTNER';
        if (saved === 'CREATOR' || saved === 'PARTNER') return saved;
      } catch {}
    }
    return 'CREATOR';
  });

  // 초기 상태: 작성된 편지가 없을 때는 null (맨 처음 편지 쓰기 플로우 우선)
  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [writeModalInitialTitle, setWriteModalInitialTitle] = useState<string | undefined>(undefined);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 껐다 켤 때 방 재입장 안내 반투명 팝업 상태
  const [isReentryModalOpen, setIsReentryModalOpen] = useState(false);
  const [reentryInfo, setReentryInfo] = useState<{
    roomCode: string;
    userName: string;
    partnerName: string;
  } | null>(null);

  // 실시간 노크 수신 상태
  const [receivedKnock, setReceivedKnock] = useState<KnockData | null>(null);
  const [isKnockModalOpen, setIsKnockModalOpen] = useState(false);
  const handledKnockTimeRef = useRef<string | null>(null);
  const handledDiaryIdRef = useRef<string | null>(null);
  const diaryUnsubRef = useRef<(() => void) | null>(null);
  const currentDiaryRef = useRef<DiaryData | null>(null);

  // 상대방 연결 해제 수신 모달 상태
  const [isPartnerDisconnectedModalOpen, setIsPartnerDisconnectedModalOpen] = useState(false);
  const [partnerDisconnectedNickname, setPartnerDisconnectedNickname] = useState('');
  const handledDisconnectionTimeRef = useRef<string | null>(null);

  // 마지막 남은 퇴장자 여부 및 2차 방 코드 기억 경고 모달 상태
  const [isLastPersonRemaining, setIsLastPersonRemaining] = useState(false);
  const [isLastLeaverWarningOpen, setIsLastLeaverWarningOpen] = useState(false);
  const [hasCopiedLeaveCode, setHasCopiedLeaveCode] = useState(false);
  const isLeavingRef = useRef(false);

  // 매일 새벽 04:00 리셋 타이머 (1초 간격 갱신)
  const [countdown, setCountdown] = useState<ResetCountdownInfo>(() => getTimeUntilNextReset());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilNextReset());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 내가 오늘(새벽 4시 이후) 이미 편지를 썼는지 검사 (각자 하루 1통 규칙)
  const hasMyQuotaBeenUsedToday = useMemo(() => {
    // 만약 현재 최신 일기가 상대방이 작성한 일기라면, 교환일기 특성상 내가 답장을 작성할 차례이므로 쿼터 미사용으로 간주
    if (diary && diary.authorName !== userName) {
      return false;
    }

    // 1) Firestore roomData의 lastWrittenByUser 확인
    const myUid = getOrCreateUserId();
    const myLastTime = roomData?.lastWrittenByUser?.[myUid] || roomData?.lastWrittenByUser?.[userName];
    if (myLastTime && isDiaryWrittenInCurrentCycle(myLastTime)) {
      return true;
    }
    // 2) 현재 최신 일기가 내가 작성한 것이고 오늘 주기인 경우
    if (diary && diary.authorName === userName && isDiaryWrittenInCurrentCycle(diary.createdAt)) {
      return true;
    }
    // 3) 로컬 세션스토리지 확인 (내가 마지막 일기를 작성한 경우에만 적용)
    const localLast = sessionStore.get(`warmth_last_written_${roomCode}_${userName}`);
    if (localLast && isDiaryWrittenInCurrentCycle(localLast)) {
      return true;
    }
    return false;
  }, [roomData, diary, userName, roomCode]);

  // 턴 로테이션 판별:
  // 1) 아직 일기가 없는 초기 상태: "코드를 써서 로그인하면, 무조건 방장이 아닌 사람이 편지를 먼저 써야 해."
  // 2) 이미 일기가 있는 상태: 번갈아가며 로테이션 (마지막 일기를 쓴 사람이 아니면 내 턴)
  const isMyTurn = useMemo(() => {
    if (!diary) {
      return userRole === 'PARTNER';
    }
    return diary.authorName !== userName;
  }, [diary, userRole, userName]);

  const handleOpenWriteModal = (initialTitle?: string) => {
    if (!isMyTurn) {
      if (!diary) {
        showToast(`초대받은 ${partnerName} 님이 첫 번째 편지를 먼저 작성할 차례입니다.`);
      } else if (diary.authorName === userName && !diary.isWaxBroken) {
        showToast(`${partnerName} 님이 아직 편지를 읽지 않았습니다. 상대방이 편지를 읽고 답장을 보낸 후에 새 일기를 쓸 수 있습니다.`);
      } else {
        showToast(`지금은 ${partnerName} 님의 답장 차례입니다. 답장이 도착하면 새 일기를 쓸 수 있습니다.`);
      }
      return;
    }
    if (hasMyQuotaBeenUsedToday) {
      showToast(`오늘의 일기는 이미 작성하셨습니다 (하루 각자 1통). 다음 편지는 내일 새벽 04:00(남은 시간: ${countdown.formattedKorean})에 열립니다.`);
      return;
    }
    setWriteModalInitialTitle(initialTitle);
    setIsWriteModalOpen(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. 앱 마운트 시 저장된 세션(방 코드 및 닉네임) 자동 복구 & 재접속 및 서비스 워커 등록
  useEffect(() => {
    if (typeof window === 'undefined') return;
    registerServiceWorker();
    try {
      const savedRoom = sessionStore.get(STORAGE_KEYS.ROOM_CODE);
      const savedUser = sessionStore.get(STORAGE_KEYS.USER_NAME);
      const savedPartner = sessionStore.get(STORAGE_KEYS.PARTNER_NAME);

      if (savedRoom && savedUser && savedPartner) {
        setRoomCode(savedRoom);
        setUserName(savedUser);
        setPartnerName(savedPartner);

        (async () => {
          try {
            const roomRef = doc(db, 'rooms', savedRoom);
            const snap = await getDoc(roomRef);
            if (snap.exists()) {
              const loadedRoomData = snap.data() as RoomData;
              setRoomData(loadedRoomData);

              if (loadedRoomData.memberInfo) {
                const myUid = getOrCreateUserId();
                const entry = Object.entries(loadedRoomData.memberInfo).find(([uid, info]: any) => {
                  return (info.nickname && info.nickname.trim().toLowerCase() === savedUser.trim().toLowerCase()) || uid === myUid;
                });
                if (entry) {
                  const role = (entry[1] as any).role as 'CREATOR' | 'PARTNER';
                  setUserRole(role);
                  sessionStore.set(STORAGE_KEYS.USER_ROLE, role);
                  // Firestore 방에 등록된 본인 실제 UID로 확정 바인딩
                  setExplicitUserId(entry[0]);
                }
              }
              if (loadedRoomData.members) {
                const myUid = getOrCreateUserId();
                const partnerLeft = Boolean(
                  (loadedRoomData.lastDisconnection && loadedRoomData.lastDisconnection.leaverUid !== myUid) ||
                  (loadedRoomData.members.length === 1 && loadedRoomData.members.includes(myUid))
                );
                setIsLastPersonRemaining(partnerLeft);
              }
              // 방 재입장 반투명 팝업창 띄우기
              setReentryInfo({
                roomCode: savedRoom,
                userName: savedUser,
                partnerName: savedPartner,
              });
              setIsReentryModalOpen(true);
              soundEngine.playPaperRustle();
              setTimeout(() => {
                setIsReentryModalOpen(false);
              }, 3200);

              if (loadedRoomData.latestDiaryId) {
                const diaryRef = doc(db, 'rooms', savedRoom, 'diaries', loadedRoomData.latestDiaryId);
                const diarySnap = await getDoc(diaryRef);
                if (diarySnap.exists()) {
                  const rawDiary = diarySnap.data() as DiaryData;
                  const decrypted = await decryptDiaryData(savedRoom, rawDiary, loadedRoomData.roomSalt);
                  setDiary(decrypted);
                  setUiState('VIEW_HOME');
                  return;
                }
              }
              // 일기가 아직 없는 방 -> 커플 홈 화면으로 복귀
              setDiary(null);
              setUiState('VIEW_HOME');
              setIsWriteModalOpen(false);
            } else {
              // 방이 삭제되었거나 존재하지 않는 경우 초기화
              sessionStore.remove(STORAGE_KEYS.ROOM_CODE);
              sessionStore.remove(STORAGE_KEYS.USER_NAME);
              sessionStore.remove(STORAGE_KEYS.PARTNER_NAME);
              sessionStore.remove(STORAGE_KEYS.USER_ROLE);
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
      if (isLeavingRef.current) return;
      setRoomData(room);

      // 0. 방 멤버 정보로부터 내 역할(CREATOR vs PARTNER) 동기화
      if (room.memberInfo) {
        const myUid = getOrCreateUserId();
        const entry = Object.entries(room.memberInfo).find(([uid, info]) => {
          return (info.nickname && info.nickname.trim().toLowerCase() === userName.trim().toLowerCase()) || uid === myUid;
        });
        if (entry) {
          const role = entry[1].role;
          setUserRole(role);
          try {
            sessionStore.set(STORAGE_KEYS.USER_ROLE, role);
            setExplicitUserId(entry[0]);
          } catch {}
        }
      }

      // 0-1. 마지막 남은 사람(상대방이 이미 퇴장함) 여부 판별
      if (room.members) {
        const partnerLeft = Boolean(
          (room.lastDisconnection && room.lastDisconnection.leaverUid !== myUid) ||
          (room.members.length === 1 && room.members.includes(myUid))
        );
        setIsLastPersonRemaining(partnerLeft);
      }

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
      if (room.latestDiaryId) {
        if (room.latestDiaryId !== handledDiaryIdRef.current || !diaryUnsubRef.current) {
          handledDiaryIdRef.current = room.latestDiaryId;
          if (diaryUnsubRef.current) {
            diaryUnsubRef.current();
            diaryUnsubRef.current = null;
          }

          diaryUnsubRef.current = subscribeDiary(roomCode, room.latestDiaryId, (latestDiary) => {
            const prev = currentDiaryRef.current;

            // 1) 내가 보낸 편지를 상대방이 개봉했을 때 실시간 감지 & 차임벨 & 축하 토스트
            if (
              prev &&
              prev.diaryId === latestDiary.diaryId &&
              !prev.isWaxBroken &&
              latestDiary.isWaxBroken &&
              latestDiary.authorName === userName
            ) {
              soundEngine.playWaxCrackSound();
              showToast(`💌 ${partnerName} 님이 내가 보낸 편지의 실링 왁스를 개봉했습니다! 💖`);
              sendLocalNotification(
                '💌 편지 개봉 알림',
                `${partnerName} 님이 비밀 편지를 열어 읽기 시작했어요.`
              );
            }

            // 2) 상대방이 작성한 새 편지가 도착했을 때
            if (
              (!prev || prev.diaryId !== latestDiary.diaryId) &&
              latestDiary.authorName !== userName
            ) {
              soundEngine.playPaperRustle();
              showToast(`📬 ${latestDiary.authorName} 님에게서 새 일기가 도착했습니다!`);
              sendLocalNotification(
                '📬 새 일기가 도착했습니다!',
                `${latestDiary.authorName} 님이 보낸 비밀 편지가 서재에 도착했습니다.`
              );
              setUiState((p) => (p === 'VIEW_WAITING' || p === 'VIEW_EMPTY' ? 'VIEW_HOME' : p));
            }

            currentDiaryRef.current = latestDiary;
            setDiary(latestDiary);
          });
        }
      } else {
        if (diaryUnsubRef.current) {
          diaryUnsubRef.current();
          diaryUnsubRef.current = null;
        }
        handledDiaryIdRef.current = null;
        currentDiaryRef.current = null;
        setDiary(null);
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

    return () => {
      unsubscribe();
      if (diaryUnsubRef.current) {
        diaryUnsubRef.current();
        diaryUnsubRef.current = null;
      }
    };
  }, [roomCode, uiState, userName, partnerName]);

  // 모바일 PWA 환경 백그라운드 복귀(잠금 해제, 앱 전환) 시 최신 방/일기 즉각 재검증
  useEffect(() => {
    if (!roomCode || uiState === 'VIEW_ONBOARDING') return;

    const handleVisibilityOrFocus = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          const roomRef = doc(db, 'rooms', roomCode);
          const snap = await getDoc(roomRef);
          if (snap.exists()) {
            const freshRoom = snap.data() as RoomData;
            setRoomData(freshRoom);
            if (freshRoom.latestDiaryId) {
              const diaryRef = doc(db, 'rooms', roomCode, 'diaries', freshRoom.latestDiaryId);
              const dSnap = await getDoc(diaryRef);
              if (dSnap.exists()) {
                const rawDiary = dSnap.data() as DiaryData;
                const decrypted = await decryptDiaryData(roomCode, rawDiary, freshRoom.roomSalt);
                currentDiaryRef.current = decrypted;
                setDiary(decrypted);
              }
            }
          }
        } catch (e) {
          console.warn('Visibility resume sync check failed:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [roomCode, uiState]);

  // 0. 초대코드 매칭 완료 처리
  const handleMatched = async (code: string, me: string, partner: string, role?: 'CREATOR' | 'PARTNER') => {
    setRoomCode(code);
    setUserName(me);
    setPartnerName(partner);

    const detectedRole = role || (userRole === 'PARTNER' ? 'PARTNER' : 'CREATOR');
    setUserRole(detectedRole);

    // 세션 영구 보관 (PWA 재접속 시 자동 매칭 복구 & 탭 격리 보장)
    sessionStore.set(STORAGE_KEYS.ROOM_CODE, code);
    sessionStore.set(STORAGE_KEYS.USER_NAME, me);
    sessionStore.set(STORAGE_KEYS.PARTNER_NAME, partner);
    sessionStore.set(STORAGE_KEYS.USER_ROLE, detectedRole);

    // 방에 기존 일기 및 정보가 있는지 Firestore에서 즉시 확인
    try {
      const roomRef = doc(db, 'rooms', code);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const loadedRoom = snap.data() as RoomData;
        setRoomData(loadedRoom);
        if (loadedRoom.latestDiaryId) {
          const diaryRef = doc(db, 'rooms', code, 'diaries', loadedRoom.latestDiaryId);
          const diarySnap = await getDoc(diaryRef);
          if (diarySnap.exists()) {
            const rawDiary = diarySnap.data() as DiaryData;
            const decrypted = await decryptDiaryData(code, rawDiary, loadedRoom.roomSalt);
            setDiary(decrypted);
          }
        }
      }
    } catch (e) {
      console.warn('Check room on match:', e);
    }

    // 매칭 완료 후 메인 홈 화면(이어진 지 N일 차)으로 진입
    setUiState('VIEW_HOME');
    setIsWriteModalOpen(false);
    showToast(`🎉 ${partner} 님과 연결되었습니다! 둘만의 온기 홈에 오신 것을 환영합니다.`);
  };

  // 방 나가기 (1단계로 깔끔하게 처리)
  const handleLeaveRoom = () => {
    // 둘 중 마지막에 나가는 사람은 곧바로 방 코드 기억 경고 모달을 띄워 1단계로 안내
    if (isLastPersonRemaining) {
      setIsLastLeaverWarningOpen(true);
    } else {
      setIsLeaveConfirmOpen(true);
    }
  };

  // 1차 모달에서 '연결 해제하기'를 눌렀을 때
  const confirmLeaveRoom = () => {
    setIsLeaveConfirmOpen(false);
    executeLeaveRoom(false);
  };

  // 상대방이 먼저 방을 나가서 뜬 모달에서 '확인(시작 화면으로 이동)'을 눌렀을 때
  const handleAcknowledgePartnerDisconnect = () => {
    setIsPartnerDisconnectedModalOpen(false);
    executeLeaveRoom(false);
  };

  // 실제 방 나가기 및 세션 클리어 수행 (경쟁 상태 없이 1번에 즉각 퇴장)
  const executeLeaveRoom = async (withCopyNotice: boolean = false) => {
    isLeavingRef.current = true;
    setIsLeaveConfirmOpen(false);
    setIsLastLeaverWarningOpen(false);
    setIsPartnerDisconnectedModalOpen(false);

    const targetRoomCode = roomCode;

    // 즉시 로컬 세션 삭제 및 온보딩 화면으로 전환 (UI 즉각 반영)
    sessionStore.remove(STORAGE_KEYS.ROOM_CODE);
    sessionStore.remove(STORAGE_KEYS.USER_NAME);
    sessionStore.remove(STORAGE_KEYS.PARTNER_NAME);
    sessionStore.remove(STORAGE_KEYS.USER_ROLE);

    setDiary(null);
    setRoomCode('');
    setIsLastPersonRemaining(false);
    setUiState('VIEW_ONBOARDING');

    if (withCopyNotice) {
      showToast('초대코드가 복사되었습니다. 일기장 연결이 해제되었습니다.');
    } else {
      showToast('일기장 연결이 해제되었습니다.');
    }

    // 백그라운드에서 Firestore 비동기 상태 갱신
    if (targetRoomCode) {
      try {
        const myUid = getOrCreateUserId();
        await leaveRoomInFirestore(targetRoomCode, myUid, userName);
      } catch (e) {
        console.warn('Failed to leave room in firestore:', e);
      }
    }

    setTimeout(() => {
      isLeavingRef.current = false;
    }, 1000);
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
    const unsealed: DiaryData = {
      ...diary,
      isWaxBroken: true,
      openedAt: new Date().toISOString(),
    };
    currentDiaryRef.current = unsealed;
    setDiary(unsealed);
    setUiState('VIEW_OPENED_DIARY');
    showToast('📬 편지 봉인이 해제되었습니다. 정성스레 적은 일기를 읽어보세요.');

    try {
      await unsealDiaryInFirestore(roomCode, diary.diaryId);
    } catch (e) {
      console.warn('Firestore unseal sync:', e);
    }
  };

  // 3. 새 일기 작성 완료 -> Firestore 저장 & VIEW_WAITING (상대방 턴으로 전환)
  const handleSaveDiary = async (newDiaryPart: Partial<DiaryData>): Promise<boolean> => {
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
    const nowIso = new Date().toISOString();

    try {
      // 1. Firestore에 먼저 안전하게 저장 및 턴 검증
      await saveDiaryToFirestore(roomCode, updated);

      // 2. 저장이 성공했을 때만 로컬 상태 및 UI 턴 전환
      currentDiaryRef.current = updated;
      sessionStore.set(`warmth_last_written_${roomCode}_${userName}`, nowIso);
      setDiary(updated);
      setUiState('VIEW_WAITING');
      showToast(`📮 일기가 왁스로 단단히 봉인되어 ${partnerName} 님에게 전달되었습니다!`);
      return true;
    } catch (e: unknown) {
      console.warn('Firestore save diary sync:', e);
      const errMsg = e instanceof Error ? e.message : '알 수 없는 오류';
      if (errMsg.includes('턴') || errMsg.includes('전송')) {
        showToast('⚠️ 현재 상대방의 작성 턴이거나 이미 상대방의 새 일기가 도착하여 전송되지 않았습니다.');
      } else {
        showToast(`⚠️ 일기 전송에 실패했습니다: ${errMsg}`);
      }
      return false;
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
        onOpenWriteModal={handleOpenWriteModal}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onLeaveRoom={handleLeaveRoom}
        onGoHome={() => setUiState('VIEW_HOME')}
        roomCode={roomCode}
        userName={userName}
        partnerName={partnerName}
        isMyTurn={isMyTurn}
        isTodayDiaryWritten={hasMyQuotaBeenUsedToday}
        countdownFormatted={countdown.formatted}
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

        {/* 1. VIEW_HOME: 우리가 온기로 이어진 지 N일 차 커플 메인 홈 화면 */}
        {uiState === 'VIEW_HOME' && (
          <HomeView
            partnerName={partnerName}
            userName={userName}
            roomCode={roomCode}
            roomData={roomData}
            diary={diary}
            isMyTurn={isMyTurn}
            hasMyQuotaBeenUsedToday={hasMyQuotaBeenUsedToday}
            userRole={userRole}
            onOpenWriteModal={handleOpenWriteModal}
            onOpenArchive={() => setIsArchiveOpen(true)}
            onSendKnock={() => handleSendKnock('오늘의 교환일기를 기다리고 있어요 ✉️')}
            onOpenSealedLetter={() => {
              if (!diary) return;
              setUiState(diary.mission?.isPassed ? 'VIEW_WAX_READY' : 'VIEW_SEALED_LETTER');
            }}
            onOpenDiary={() => {
              if (!diary) return;
              setUiState('VIEW_OPENED_DIARY');
            }}
          />
        )}

        {/* 2. VIEW_EMPTY: 초기 상태 - 방 화면(책상) */}
        {uiState === 'VIEW_EMPTY' && (
          <EmptyDeskView
            partnerName={partnerName}
            userName={userName}
            onOpenWriteModal={handleOpenWriteModal}
            onSendKnock={() => handleSendKnock('첫 번째 교환일기장을 기다리고 있어요 ✉️')}
            roomCode={roomCode}
            isMyTurn={isMyTurn}
            userRole={userRole}
          />
        )}

        {/* 3. VIEW_WAITING: 내가 작성 후 상대방 턴 진행 중 (답장 대기) */}
        {uiState === 'VIEW_WAITING' && (
          <WaitingLetter
            partnerName={partnerName}
            onSendKnock={handleSendKnock}
            onGoHome={() => setUiState('VIEW_HOME')}
          />
        )}

        {/* 4. VIEW_SEALED_LETTER: 편지가 있을 때 -> 편지를 까는 메뉴 (미션 게이트 대기) */}
        {uiState === 'VIEW_SEALED_LETTER' && (
          diary ? (
            <Envelope
              diary={diary}
              isLocked={true}
              onOpenMission={() => setIsMissionModalOpen(true)}
              onUnsealComplete={handleUnsealComplete}
              onGoHome={() => setUiState('VIEW_HOME')}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={handleOpenWriteModal}
              onSendKnock={() => handleSendKnock('첫 번째 교환일기장을 기다리고 있어요 ✉️')}
              roomCode={roomCode}
              isMyTurn={isMyTurn}
              userRole={userRole}
            />
          )
        )}

        {/* 5. VIEW_WAX_READY: 미션 클리어 후 3초 실링 왁스 롱프레스 개봉 */}
        {uiState === 'VIEW_WAX_READY' && (
          diary ? (
            <Envelope
              diary={diary}
              isLocked={false}
              onOpenMission={() => setIsMissionModalOpen(true)}
              onUnsealComplete={handleUnsealComplete}
              onGoHome={() => setUiState('VIEW_HOME')}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={handleOpenWriteModal}
              onSendKnock={() => handleSendKnock('첫 번째 교환일기장을 기다리고 있어요 ✉️')}
              roomCode={roomCode}
              isMyTurn={isMyTurn}
              userRole={userRole}
            />
          )
        )}

        {/* 6. VIEW_OPENED_DIARY: 왁스 개봉 완료, 일기 본문 열람 */}
        {uiState === 'VIEW_OPENED_DIARY' && (
          diary ? (
            <OpenedLetter
              diary={diary}
              onWriteReply={handleOpenWriteModal}
              onResetView={() => setUiState('VIEW_HOME')}
              userName={userName}
              isMyTurn={isMyTurn}
            />
          ) : (
            <EmptyDeskView
              partnerName={partnerName}
              userName={userName}
              onOpenWriteModal={handleOpenWriteModal}
              onSendKnock={() => handleSendKnock('첫 번째 교환일기장을 기다리고 있어요 ✉️')}
              roomCode={roomCode}
              isMyTurn={isMyTurn}
              userRole={userRole}
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
        onClose={() => {
          setIsWriteModalOpen(false);
          setWriteModalInitialTitle(undefined);
        }}
        onSaveDiary={handleSaveDiary}
        currentUserName={userName}
        partnerName={partnerName}
        roomCode={roomCode}
        fallbackPreviousDiary={diary}
        initialTitle={writeModalInitialTitle}
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
                나중에 다시 접속하시려면 아래 초대코드를 기억해주세요.
              </p>

              {/* 방 코드 복사 카드 */}
              {roomCode && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-300/80 flex items-center justify-between shadow-inner">
                  <div className="text-left">
                    <div className="text-[10px] text-amber-800 font-sans-ui font-medium">우리 둘만의 초대코드</div>
                    <div className="text-lg font-mono font-bold tracking-widest text-[#6B1724]">
                      #{roomCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(roomCode);
                        setHasCopiedLeaveCode(true);
                        showToast('초대코드가 클립보드에 복사되었습니다.');
                        setTimeout(() => setHasCopiedLeaveCode(false), 3000);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-sans-ui font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95"
                  >
                    {hasCopiedLeaveCode ? '복사됨 ✓' : '코드 복사'}
                  </button>
                </div>
              )}
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

      {/* 둘 중 마지막에 나가는 사람을 위한 방 코드 기억 경고 모달 */}
      {isLastLeaverWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#FFFDF9] rounded-2xl p-5 sm:p-6 paper-texture border border-[#E8DFC8] shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-xl mx-auto shadow-2xs">
              ⚠️
            </div>
            <div className="text-center space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-sans-ui font-semibold">
                마지막 퇴장 전 필수 확인
              </span>
              <h3 className="font-serif-warm font-bold text-stone-900 text-lg">
                방 코드를 꼭 기억해두세요!
              </h3>
              <p className="text-xs text-stone-600 font-serif-warm leading-relaxed">
                상대방이 이미 일기장을 떠나 <strong className="text-stone-900">{userName}</strong> 님이 마지막으로 방을 나가게 됩니다.
                <br />
                둘 다 방을 나가면, 아래 <strong>6자리 초대코드</strong>를 알고 있어야만 나중에 다시 접속하여 소중한 추억들을 열람할 수 있습니다.
              </p>

              {/* 코드 복사 카드 */}
              <div className="mt-2 p-3 rounded-xl bg-amber-50/90 border border-amber-300/80 flex items-center justify-between shadow-inner">
                <div className="text-left">
                  <div className="text-[10px] text-amber-800 font-sans-ui font-medium">우리 둘만의 초대코드</div>
                  <div className="text-xl font-mono font-bold tracking-widest text-[#6B1724]">
                    #{roomCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(roomCode);
                      setHasCopiedLeaveCode(true);
                      showToast('초대코드가 클립보드에 복사되었습니다.');
                      setTimeout(() => setHasCopiedLeaveCode(false), 3000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-xs font-sans-ui font-semibold shadow-2xs transition-colors cursor-pointer active:scale-95"
                >
                  {hasCopiedLeaveCode ? '복사됨 ✓' : '코드 복사'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(roomCode);
                  }
                  executeLeaveRoom(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold font-sans-ui shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                초대코드 복사하고 나가기
              </button>
              <button
                type="button"
                onClick={() => executeLeaveRoom(false)}
                className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-semibold font-sans-ui cursor-pointer active:scale-95 transition-all"
              >
                코드 기억했으니 바로 나가기
              </button>
              <button
                type="button"
                onClick={() => setIsLastLeaverWarningOpen(false)}
                className="w-full py-1.5 text-center text-[11px] text-stone-400 hover:text-stone-600 font-sans-ui transition-colors cursor-pointer"
              >
                취소 (서재에 머무르기)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 껐다 켤 때 방으로 재입장할 때 안내하는 반투명 팝업창 */}
      <AnimatePresence>
        {isReentryModalOpen && reentryInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 반투명 블러 백드롭 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReentryModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />

            {/* 반투명 글래스모피즘 모달 카드 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative z-10 w-full max-w-sm rounded-3xl p-6 sm:p-7 bg-[#FFFDF9]/90 backdrop-blur-md border border-[#E8DFD3]/90 shadow-2xl text-center space-y-4 paper-texture"
            >
              {/* 상단 엠블럼 아이콘 */}
              <div className="relative mx-auto w-14 h-14 rounded-full bg-gradient-to-tr from-amber-100/90 to-rose-100/90 border border-amber-300/80 flex items-center justify-center shadow-inner">
                <BookOpen className="w-6 h-6 text-[#6B1724]" />
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1 -right-1 text-amber-600"
                >
                  <Sparkles className="w-4 h-4 fill-amber-400 text-amber-500" />
                </motion.div>
              </div>

              {/* 텍스트 안내 */}
              <div className="space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#6B1724]/10 text-[#6B1724] text-[11px] font-sans-ui font-semibold">
                  비밀 서재 자동 연결
                </span>
                <h3 className="font-serif-warm font-bold text-stone-900 text-xl tracking-tight">
                  방으로 재입장합니다
                </h3>
                <p className="text-xs text-stone-600 font-serif-warm leading-relaxed">
                  이전에 함께 나누던 따뜻한 일기장으로
                  <br />
                  안전하게 복귀했습니다.
                </p>
              </div>

              {/* 방 정보 요약 카드 */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-left space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-serif-warm">
                  <span className="text-stone-500">방 번호</span>
                  <span className="font-mono font-bold text-[#6B1724] text-sm tracking-wider">
                    #{reentryInfo.roomCode}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] font-serif-warm">
                  <span className="text-stone-500">대화 상대</span>
                  <span className="font-semibold text-stone-800">
                    {reentryInfo.userName} & {reentryInfo.partnerName}
                  </span>
                </div>
              </div>

              {/* 확인 버튼 */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsReentryModalOpen(false);
                    soundEngine.playPaperRustle();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-bold font-sans-ui shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  일기장 열기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 푸터 (iOS 홈 인디케이터 제스처 여백 확보) */}
      <footer className="py-2 sm:py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] text-center text-[10px] sm:text-[11px] text-stone-400 font-serif-warm border-t border-[#EAE1D5]/40 bg-[#FAF7F2]/50 px-3 shrink-0">
        <p>온기 (Warmth) · 하루걸러 띄우는 우리 둘만의 아날로그 비밀 교환일기</p>
      </footer>
    </div>
  );
}
