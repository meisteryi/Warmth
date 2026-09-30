import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  collection, 
  onSnapshot, 
  serverTimestamp,
  runTransaction,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { DiaryData, RoomData } from '@/types/diary';
import { 
  encryptDiaryData, 
  decryptDiaryData, 
  encryptText,
  generateRoomSalt 
} from './crypto';

// 방 고유 솔트 메모리 캐시 (불필요한 Firestore 반복 조회 방지)
const roomSaltCache = new Map<string, string>();

export function setCachedRoomSalt(roomCode: string, salt: string) {
  if (salt) roomSaltCache.set(roomCode, salt);
}

export async function getOrFetchRoomSalt(roomCode: string): Promise<string | undefined> {
  if (roomSaltCache.has(roomCode)) {
    return roomSaltCache.get(roomCode);
  }
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      const data = snap.data() as RoomData;
      if (data.roomSalt) {
        roomSaltCache.set(roomCode, data.roomSalt);
        return data.roomSalt;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch roomSalt:', e);
  }
  return undefined;
}

// ===============================================================
// 클라이언트 브루트포스 스캐닝 방지용 레이트 리미터 (MEDIUM 3.2)
// 5회 연속 실패 시 30초간 코드 입력 잠금
// ===============================================================
const RATE_LIMIT_KEY_ATTEMPTS = 'warmth_join_failed_count';
const RATE_LIMIT_KEY_LOCKOUT = 'warmth_join_lockout_until';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30초 쿨다운

export function checkJoinRateLimit(): { isBlocked: boolean; remainingSec: number } {
  if (typeof window === 'undefined') return { isBlocked: false, remainingSec: 0 };
  const lockoutUntilStr = sessionStorage.getItem(RATE_LIMIT_KEY_LOCKOUT);
  if (lockoutUntilStr) {
    const lockoutUntil = parseInt(lockoutUntilStr, 10);
    const now = Date.now();
    if (now < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
      return { isBlocked: true, remainingSec };
    } else {
      sessionStorage.removeItem(RATE_LIMIT_KEY_LOCKOUT);
      sessionStorage.setItem(RATE_LIMIT_KEY_ATTEMPTS, '0');
    }
  }
  return { isBlocked: false, remainingSec: 0 };
}

export function recordFailedJoinAttempt(): { isNowBlocked: boolean; remainingSec: number } {
  if (typeof window === 'undefined') return { isNowBlocked: false, remainingSec: 0 };
  const count = parseInt(sessionStorage.getItem(RATE_LIMIT_KEY_ATTEMPTS) || '0', 10) + 1;
  sessionStorage.setItem(RATE_LIMIT_KEY_ATTEMPTS, count.toString());

  if (count >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    sessionStorage.setItem(RATE_LIMIT_KEY_LOCKOUT, lockoutUntil.toString());
    return { isNowBlocked: true, remainingSec: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }
  return { isNowBlocked: false, remainingSec: 0 };
}

export function resetJoinRateLimit(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RATE_LIMIT_KEY_ATTEMPTS);
  sessionStorage.removeItem(RATE_LIMIT_KEY_LOCKOUT);
}

// 사용자 고유 클라이언트 ID 생성/가져오기 (역할 및 URL 파라미터 기반 분리 지원)
export function getOrCreateUserId(userRoleKey?: string): string {
  if (typeof window === 'undefined') return 'user_ssr';
  let role = userRoleKey;
  if (!role) {
    try {
      const param = new URLSearchParams(window.location.search).get('user');
      role = param || 'default';
    } catch {
      role = 'default';
    }
  }
  const storageKey = `warmth_user_uid_${role}`;
  let uid = localStorage.getItem(storageKey);
  if (!uid) {
    uid = `user_${role}_` + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem(storageKey, uid);
  }
  return uid;
}

// 0. 특정 일기 실시간 구독 (onSnapshot + E2EE 복호화)
export function subscribeDiary(
  roomCode: string,
  diaryId: string,
  onUpdate: (diary: DiaryData) => void
): Unsubscribe {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  return onSnapshot(diaryRef, async (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.data() as DiaryData;
      const roomSalt = await getOrFetchRoomSalt(roomCode);
      const decrypted = await decryptDiaryData(roomCode, raw, roomSalt);
      onUpdate(decrypted);
    }
  });
}

// 1. 방 생성 (6자리 난수 코드 발급, 128비트 암호학적 솔트 발급 및 충돌 방지 루프)
export async function createRoomInFirestore(creatorNickname: string): Promise<string> {
  const myUid = getOrCreateUserId();
  
  // 6자리 난수 코드 생성 (충돌 방지 최대 10회 검증 루프 - MEDIUM 3.2 해결)
  let roomCode = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = Math.floor(100000 + Math.random() * 900000).toString();
    const snap = await getDoc(doc(db, 'rooms', candidate));
    if (!snap.exists()) {
      roomCode = candidate;
      break;
    }
  }

  if (!roomCode) {
    roomCode = (Math.floor(100000 + Math.random() * 800000) + (Date.now() % 100000)).toString().substring(0, 6);
  }

  // 방 고유 128-bit E2EE 솔트 생성 (레인보우 테이블 무력화)
  const roomSalt = generateRoomSalt();
  setCachedRoomSalt(roomCode, roomSalt);

  const newRoomData: RoomData = {
    roomId: roomCode,
    roomCode: roomCode,
    status: 'WAITING_PARTNER',
    currentTurn: myUid,
    members: [myUid],
    memberInfo: {
      [myUid]: {
        nickname: creatorNickname || '주형',
        role: 'CREATOR',
      },
    },
    roomSalt,
  };

  // Firestore rooms/{roomCode} 위치에 저장
  await setDoc(doc(db, 'rooms', roomCode), {
    ...newRoomData,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  return roomCode;
}

// 2. 방 참여 (6자리 초대코드 입력하여 1:1 매칭, iOS PWA 세션 복구 및 레이트 리밋)
export async function joinRoomInFirestore(
  roomCode: string, 
  partnerNickname: string
): Promise<{ success: boolean; message: string; room?: RoomData }> {
  // 0) 브루트포스 스캐닝 방지 검사 (연속 5회 실패 시 30초 차단)
  const rateLimit = checkJoinRateLimit();
  if (rateLimit.isBlocked) {
    return {
      success: false,
      message: `연속된 코드 입력 실패로 보안 잠금 상태입니다. ${rateLimit.remainingSec}초 후에 다시 시도해주세요.`,
    };
  }

  const myUid = getOrCreateUserId();
  const roomRef = doc(db, 'rooms', roomCode);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    const failStatus = recordFailedJoinAttempt();
    if (failStatus.isNowBlocked) {
      return {
        success: false,
        message: `존재하지 않는 코드입니다. 5회 연속 실패하여 보안을 위해 ${failStatus.remainingSec}초간 입장이 제한됩니다.`,
      };
    }
    return { success: false, message: '존재하지 않는 초대코드입니다. 코드를 다시 확인해주세요.' };
  }

  const room = snap.data() as RoomData;
  if (room.roomSalt) {
    setCachedRoomSalt(roomCode, room.roomSalt);
  }

  // 1) 이미 현재 UID가 members에 속해 있는 경우 즉시 재입장
  if (room.members.includes(myUid)) {
    resetJoinRateLimit();
    return { success: true, message: '기존 방에 재입장했습니다.', room };
  }

  const normalizedNick = (partnerNickname || '').trim().toLowerCase();

  // 2) iOS Safari ↔ PWA(홈 화면 추가) 세션 분리(LocalStorage 파티셔닝) 대응:
  // 입력한 닉네임이 기존 방 참여자 중 일치하는 슬롯이 있으면, 해당 슬롯의 UID를 현재 myUid로 자동 갱신 및 복구
  const matchedOldUid = Object.keys(room.memberInfo || {}).find(
    (uid) => (room.memberInfo[uid]?.nickname || '').trim().toLowerCase() === normalizedNick
  );

  if (matchedOldUid) {
    const oldMemberData = room.memberInfo[matchedOldUid];
    const updatedMembers = room.members.map((id) => (id === matchedOldUid ? myUid : id));
    const updatedMemberInfo = { ...room.memberInfo };
    delete updatedMemberInfo[matchedOldUid];
    updatedMemberInfo[myUid] = oldMemberData;

    const updatedTurn = room.currentTurn === matchedOldUid ? myUid : room.currentTurn;

    await updateDoc(roomRef, {
      members: updatedMembers,
      memberInfo: updatedMemberInfo,
      currentTurn: updatedTurn,
      status: 'MATCHED',
      lastDisconnection: null,
      updatedAt: serverTimestamp(),
    });

    const recoveredRoom: RoomData = {
      ...room,
      members: updatedMembers,
      memberInfo: updatedMemberInfo,
      currentTurn: updatedTurn,
    };

    resetJoinRateLimit();
    return {
      success: true,
      message: `${oldMemberData.nickname} 님의 일기장 세션이 성공적으로 복구되었습니다!`,
      room: recoveredRoom,
    };
  }

  // 3) 닉네임 불일치 및 이미 2명 매칭이 완료된 경우 무단 입장 차단
  if (room.members.length >= 2) {
    recordFailedJoinAttempt();
    return { success: false, message: '이미 2명의 매칭이 완료된 일기장입니다.' };
  }

  // 4) 아직 매칭 대기 중인 경우 파트너로 신규 등록
  const updatedMembers = [...room.members, myUid];
  const updatedMemberInfo = {
    ...room.memberInfo,
    [myUid]: {
      nickname: partnerNickname || '유라',
      role: 'PARTNER' as const,
    },
  };

  await updateDoc(roomRef, {
    status: 'MATCHED',
    members: updatedMembers,
    memberInfo: updatedMemberInfo,
    lastDisconnection: null,
    updatedAt: serverTimestamp(),
  });

  resetJoinRateLimit();
  return {
    success: true,
    message: '매칭이 완료되었습니다!',
    room: {
      ...room,
      status: 'MATCHED',
      members: updatedMembers,
      memberInfo: updatedMemberInfo,
    },
  };
}

// 3. 방 실시간 구독 (onSnapshot)
export function subscribeRoom(
  roomCode: string, 
  onUpdate: (room: RoomData) => void
): Unsubscribe {
  const roomRef = doc(db, 'rooms', roomCode);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      const room = snapshot.data() as RoomData;
      if (room.roomSalt) {
        setCachedRoomSalt(roomCode, room.roomSalt);
      }
      onUpdate(room);
    }
  });
}

// 4. 일기 저장 (rooms/{roomCode}/diaries/{diaryId} - 종단간 암호화 & 동시 작성 충돌 방지 트랜잭션)
export async function saveDiaryToFirestore(
  roomCode: string,
  diary: DiaryData
): Promise<void> {
  const roomSalt = await getOrFetchRoomSalt(roomCode);
  const encryptedDiary = await encryptDiaryData(roomCode, diary, roomSalt);

  const roomRef = doc(db, 'rooms', roomCode);
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diary.diaryId);

  // Firestore runTransaction을 통한 원자적(Atomic) 턴 검증 및 Race Condition 방지 (MEDIUM 3.3 해결)
  await runTransaction(db, async (transaction) => {
    const roomSnap = await transaction.get(roomRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as RoomData;
      // 상대방의 턴이거나 이미 다른 최신 일기가 전송된 경우 덮어쓰기 방지
      if (roomData.currentTurn && diary.authorId && roomData.currentTurn !== diary.authorId) {
        if (roomData.members.length >= 2 && roomData.status === 'MATCHED') {
          throw new Error('현재 상대방의 작성 턴이거나 이미 새 일기가 전송되었습니다.');
        }
      }

      // 파트너 UID 결정 (턴 넘기기용)
      const partnerUid = roomData.members.find((id) => id !== diary.authorId) || diary.recipientId || 'partner';

      transaction.set(diaryRef, {
        ...encryptedDiary,
        createdAt: new Date().toISOString(),
      });

      transaction.update(roomRef, {
        latestDiaryId: diary.diaryId,
        currentTurn: partnerUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(diaryRef, {
        ...encryptedDiary,
        createdAt: new Date().toISOString(),
      });
      transaction.set(roomRef, {
        roomId: roomCode,
        roomCode: roomCode,
        latestDiaryId: diary.diaryId,
        currentTurn: diary.recipientId || 'partner',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });
}

// 5. 미션 통과 업데이트 (답변 텍스트 암호화)
export async function updateMissionInFirestore(
  roomCode: string,
  diaryId: string,
  submissionText: string
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  const roomSalt = await getOrFetchRoomSalt(roomCode);
  const encryptedSubmission = await encryptText(roomCode, submissionText, roomSalt);

  await updateDoc(diaryRef, {
    'mission.isPassed': true,
    'mission.submission': {
      text: encryptedSubmission,
      submittedAt: new Date().toISOString(),
    },
  });
}

// 6. 실링 왁스 개봉 완료 업데이트
export async function unsealDiaryInFirestore(
  roomCode: string,
  diaryId: string
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  await updateDoc(diaryRef, {
    isWaxBroken: true,
    openedAt: new Date().toISOString(),
  });
}

// 7. 상대방에게 은은한 노크 전송 (메시지 암호화)
export async function sendKnockInFirestore(
  roomCode: string,
  senderName: string,
  message?: string
): Promise<void> {
  const myUid = getOrCreateUserId();
  const roomRef = doc(db, 'rooms', roomCode);
  const rawMsg = message || '오늘의 교환일기를 기다리고 있어요 ✉️';
  const roomSalt = await getOrFetchRoomSalt(roomCode);
  const encryptedMsg = await encryptText(roomCode, rawMsg, roomSalt);

  await updateDoc(roomRef, {
    latestKnock: {
      senderUid: myUid,
      senderName: senderName || '주형',
      message: encryptedMsg,
      knockedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
}

// 8. 둘만의 서재(아카이브) 일기 목록 전체 가져오기 및 복호화
export async function getRoomDiariesFromFirestore(
  roomCode: string
): Promise<DiaryData[]> {
  try {
    const colRef = collection(db, 'rooms', roomCode, 'diaries');
    const snapshot = await getDocs(colRef);
    const roomSalt = await getOrFetchRoomSalt(roomCode);
    const list: DiaryData[] = [];
    
    for (const docSnap of snapshot.docs) {
      const raw = docSnap.data() as DiaryData;
      const decrypted = await decryptDiaryData(roomCode, raw, roomSalt);
      list.push(decrypted);
    }

    // 최신 날짜 순으로 정렬
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.warn('Failed to fetch room diaries for archive:', error);
    return [];
  }
}

// 9. 상대방(partnerName)이 이미 본(열람했거나 작성한) 편지 중 가장 최근 편지 1건 조회
export async function getLatestReadDiaryForPartner(
  roomCode: string,
  partnerName: string
): Promise<DiaryData | null> {
  try {
    const list = await getRoomDiariesFromFirestore(roomCode);
    // 상대방(partnerName)이 이미 내용을 알고 있는 편지:
    // 1) 상대방이 직접 작성했던 편지 (authorName === partnerName)
    // 2) 내가 작성했고 상대방이 이미 실링 왁스를 개봉(isWaxBroken)해서 읽은 편지
    const readByPartner = list.filter(
      (d) => d.authorName === partnerName || Boolean(d.isWaxBroken)
    );

    return readByPartner.length > 0 ? readByPartner[0] : null;
  } catch (e) {
    console.warn('Failed to get latest read diary for partner:', e);
    return null;
  }
}

// 10. 방 나가기 / 일기장 연결 해제 (Firestore 실시간 알림 전송 및 상태 전이)
export async function leaveRoomInFirestore(
  roomCode: string,
  leaverUid: string,
  leaverNickname: string
): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;

    const updatedMembers = (room.members || []).filter((id) => id !== leaverUid);

    await updateDoc(roomRef, {
      status: 'WAITING_PARTNER',
      members: updatedMembers,
      lastDisconnection: {
        leaverUid,
        leaverNickname: leaverNickname || '상대방',
        disconnectedAt: new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Failed to leave room in Firestore:', e);
  }
}
