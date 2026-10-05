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
  query,
  orderBy,
  limit,
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

// 방별 최근 일기 메모리 캐시 (오프라인 회복력 및 Stale-While-Revalidate 지원)
const roomDiariesCache = new Map<string, DiaryData[]>();

export function getCachedRoomDiaries(roomCode: string): DiaryData[] | undefined {
  return roomDiariesCache.get(roomCode);
}

export async function getOrFetchRoomSalt(roomCode: string): Promise<string | undefined> {
  if (roomSaltCache.has(roomCode)) {
    return roomSaltCache.get(roomCode);
  }
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    // 소켓 정체 시 무한 대기를 막는 3.5초 안전 타임아웃
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getDoc roomSalt timeout')), 3500)
    );
    const snap = await Promise.race([getDoc(roomRef), timeoutPromise]);
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

// 사용자 고유 클라이언트 ID 명시적 동기화 (방에 등록된 본인 실제 UID 바인딩)
export function setExplicitUserId(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    sessionStorage.setItem('warmth_active_uid', uid);
    sessionStorage.setItem('warmth_user_uid', uid);
    localStorage.setItem('warmth_user_uid', uid);
  } catch {}
}

// 사용자 고유 클라이언트 ID 신규 발급 (동일 브라우저 탭 격리 및 신규 세션 생성용)
export function createNewTabUserId(role: string = 'default'): string {
  if (typeof window === 'undefined') return 'user_ssr';
  const newUid = `user_${role}_` + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  try {
    sessionStorage.setItem('warmth_active_uid', newUid);
    sessionStorage.setItem('warmth_user_uid', newUid);
    sessionStorage.setItem(`warmth_user_uid_${role}`, newUid);
    localStorage.setItem('warmth_user_uid', newUid);
    localStorage.setItem(`warmth_user_uid_${role}`, newUid);
  } catch {}
  return newUid;
}

// 사용자 고유 클라이언트 ID 생성/가져오기 (통합 키 warmth_user_uid 우선)
export function getOrCreateUserId(userRoleKey?: string): string {
  if (typeof window === 'undefined') return 'user_ssr';
  let uid: string | null = null;
  try {
    uid = sessionStorage.getItem('warmth_active_uid') || sessionStorage.getItem('warmth_user_uid');
  } catch {}

  if (!uid) {
    try {
      uid = localStorage.getItem('warmth_user_uid');
    } catch {}

    // 레거시 롤 기반 키 마이그레이션 fallback
    if (!uid) {
      try {
        uid = localStorage.getItem('warmth_user_uid_CREATOR') || 
              localStorage.getItem('warmth_user_uid_PARTNER') || 
              localStorage.getItem('warmth_user_uid_default');
      } catch {}
    }

    if (!uid) {
      const role = userRoleKey || 'user';
      uid = `user_${role}_` + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    }
    try {
      localStorage.setItem('warmth_user_uid', uid);
      sessionStorage.setItem('warmth_user_uid', uid);
      sessionStorage.setItem('warmth_active_uid', uid);
    } catch {}
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
  // 방 생성 시 이 탭의 고유 UID를 신규 발급하여 동일 브라우저의 다른 창과 충돌 방지
  const myUid = createNewTabUserId('CREATOR');
  
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
    currentTurn: '', // 파트너 입장 시 파트너(방장이 아닌 사람)에게 첫 턴 부여
    members: [myUid],
    memberInfo: {
      [myUid]: {
        nickname: creatorNickname || '나',
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

  let myUid = getOrCreateUserId();
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

  const normalizedNick = (partnerNickname || '').trim().toLowerCase();

  // 1) 이미 현재 UID가 members에 속해 있는 경우:
  // 등록된 닉네임과 지금 입력한 닉네임이 일치할 때만 정상 재입장으로 인정.
  // 만약 닉네임이 다르면(동일 브라우저 2개 창 테스트 등으로 방장 UID를 공유받은 경우),
  // 이 참여자 창을 위한 고유 UID를 신규 발급하여 정상적인 신규 매칭 진행!
  if (room.members.includes(myUid)) {
    const existingMemberInfo = room.memberInfo ? room.memberInfo[myUid] : null;
    const existingNick = (existingMemberInfo?.nickname || '').trim().toLowerCase();

    if (existingNick === normalizedNick) {
      resetJoinRateLimit();
      return { success: true, message: '기존 방에 재입장했습니다.', room };
    } else {
      myUid = createNewTabUserId('PARTNER');
    }
  }

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
  // 방에 현재 남아있는 활성 멤버들의 memberInfo만 유지하여 최대 2명 정원 엄수
  const activeMemberInfo: Record<string, any> = {};
  for (const mId of room.members) {
    if (room.memberInfo && room.memberInfo[mId]) {
      activeMemberInfo[mId] = room.memberInfo[mId];
    }
  }
  const updatedMemberInfo = {
    ...activeMemberInfo,
    [myUid]: {
      nickname: partnerNickname || '상대방',
      role: 'PARTNER' as const,
    },
  };

  await updateDoc(roomRef, {
    status: 'MATCHED',
    members: updatedMembers,
    memberInfo: updatedMemberInfo,
    currentTurn: myUid, // 코드로 입장한 방장이 아닌 사람이 첫 편지 작성 턴을 가짐
    lastDisconnection: null,
    matchedAt: room.matchedAt || new Date().toISOString(),
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

      // 작성자의 UID를 memberInfo에서 닉네임으로 우선 정확히 매칭 (PWA/브라우저 세션 재접속 시 UID 불일치 방지)
      let authorUid = diary.authorId;
      if (roomData.memberInfo) {
        const matchedMemberEntry = Object.entries(roomData.memberInfo).find(
          ([_, info]: [string, any]) => info?.nickname && info.nickname.trim().toLowerCase() === (diary.authorName || '').trim().toLowerCase()
        );
        if (matchedMemberEntry) {
          authorUid = matchedMemberEntry[0];
        }
      }

      // 턴 일치 여부 검사: UID 또는 닉네임 일치 시 정상 턴으로 통과
      let isAuthorTurn = false;
      if (!roomData.currentTurn) {
        isAuthorTurn = true;
      } else if (roomData.currentTurn === authorUid || roomData.currentTurn === diary.authorId) {
        isAuthorTurn = true;
      } else if (roomData.memberInfo && roomData.memberInfo[roomData.currentTurn]) {
        const turnOwnerNickname = (roomData.memberInfo[roomData.currentTurn]?.nickname || '').trim().toLowerCase();
        if (turnOwnerNickname === (diary.authorName || '').trim().toLowerCase()) {
          isAuthorTurn = true;
        }
      }

      // 추가 안전망: 상대방이 마지막으로 일기를 작성했거나 내가 아직 답장을 안 쓴 상태라면 무조건 내 턴으로 인정
      if (!isAuthorTurn && roomData.lastWrittenByUser) {
        const myTimeStr = (
          roomData.lastWrittenByUser[authorUid] ||
          roomData.lastWrittenByUser[diary.authorId] ||
          roomData.lastWrittenByUser[diary.authorName]
        );
        const myTime = myTimeStr ? new Date(myTimeStr as string).getTime() : 0;

        const partnerTimes = Object.entries(roomData.lastWrittenByUser)
          .filter(([key]) => key !== authorUid && key !== diary.authorId && key !== diary.authorName)
          .map(([_, val]) => new Date(val as string).getTime())
          .filter((t) => !isNaN(t));

        const latestPartnerTime = partnerTimes.length > 0 ? Math.max(...partnerTimes) : 0;
        if (latestPartnerTime > myTime) {
          isAuthorTurn = true;
        }
      }

      // 두 명 모두 입장해 있고, 명백하게 상대방의 턴인 경우만 차단
      if (!isAuthorTurn && (roomData.members?.length || 0) >= 2 && roomData.status === 'MATCHED') {
        throw new Error('현재 상대방의 작성 턴이거나 이미 새 일기가 전송되었습니다.');
      }

      // 파트너 UID 결정 (턴을 넘겨줄 상대방)
      const partnerUid = (roomData.members || []).find((id: string) => id !== authorUid && id !== diary.authorId) || diary.recipientId || 'partner';
      const nowIso = new Date().toISOString();
      const writtenTime = diary.createdAt || nowIso;
      const existingLastWritten = roomData.lastWrittenByUser || {};

      transaction.set(diaryRef, {
        ...encryptedDiary,
        authorId: authorUid,
        createdAt: writtenTime,
      });

      transaction.update(roomRef, {
        latestDiaryId: diary.diaryId,
        currentTurn: partnerUid,
        lastWrittenByUser: {
          ...existingLastWritten,
          ...(authorUid ? { [authorUid]: writtenTime } : {}),
          ...(diary.authorId ? { [diary.authorId]: writtenTime } : {}),
          ...(diary.authorName ? { [diary.authorName]: writtenTime } : {}),
        },
        updatedAt: serverTimestamp(),
      });
    } else {
      const nowIso = new Date().toISOString();
      const writtenTime = diary.createdAt || nowIso;
      transaction.set(diaryRef, {
        ...encryptedDiary,
        createdAt: writtenTime,
      });
      transaction.set(roomRef, {
        roomId: roomCode,
        roomCode: roomCode,
        latestDiaryId: diary.diaryId,
        currentTurn: diary.recipientId || 'partner',
        lastWrittenByUser: {
          ...(diary.authorId ? { [diary.authorId]: writtenTime } : {}),
          ...(diary.authorName ? { [diary.authorName]: writtenTime } : {}),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });

  // 새 일기 작성 완료 시 캐시 무효화 (서재 즉시 갱신 보장)
  roomDiariesCache.delete(roomCode);
}

// 5. 미션 통과 업데이트 (답변 텍스트 암호화)
export async function updateMissionInFirestore(
  roomCode: string,
  diaryId: string,
  submissionText: string
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  const roomRef = doc(db, 'rooms', roomCode);
  const roomSalt = await getOrFetchRoomSalt(roomCode);
  const encryptedSubmission = await encryptText(roomCode, submissionText, roomSalt);

  await updateDoc(diaryRef, {
    'mission.isPassed': true,
    'mission.submission': {
      text: encryptedSubmission,
      submittedAt: new Date().toISOString(),
    },
  });

  await updateDoc(roomRef, {
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  roomDiariesCache.delete(roomCode);
}

// 6. 실링 왁스 개봉 완료 업데이트
export async function unsealDiaryInFirestore(
  roomCode: string,
  diaryId: string
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  const roomRef = doc(db, 'rooms', roomCode);

  await updateDoc(diaryRef, {
    isWaxBroken: true,
    openedAt: new Date().toISOString(),
  });

  // 방 문서에도 실링 해제 시간 업데이트 (상대방 기기에 즉각 실시간 동기화)
  await updateDoc(roomRef, {
    lastUnsealedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((err) => {
    console.warn('Failed to update room unseal status:', err);
  });

  // 개봉 상태 갱신 시 캐시 무효화
  roomDiariesCache.delete(roomCode);
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
      senderName: senderName || '나',
      message: encryptedMsg,
      knockedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
}


// 8. 둘만의 서재(아카이브) 일기 목록 가져오기 및 복호화 (최근 5건 기본 쿼리 & 5초 타임아웃으로 렉·무한로딩 원천 방지)
export async function getRoomDiariesFromFirestore(
  roomCode: string,
  limitCount = 5
): Promise<DiaryData[]> {
  try {
    const colRef = collection(db, 'rooms', roomCode, 'diaries');
    let snapshot;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore getDocs timeout')), 5000)
      );
      snapshot = await Promise.race([getDocs(q), timeoutPromise]);
    } catch (queryErr) {
      console.warn('Ordered query fallback or timeout:', queryErr);
      try {
        const fallbackTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore fallback timeout')), 3000)
        );
        snapshot = await Promise.race([getDocs(colRef), fallbackTimeout]);
      } catch (fallbackErr) {
        console.warn('Firestore getDocs fallback also failed/timed out:', fallbackErr);
        // 네트워크 타임아웃 발생 시 기존 메모리 캐시가 있다면 즉시 반환하여 무한 로딩 차단
        if (roomDiariesCache.has(roomCode)) {
          return roomDiariesCache.get(roomCode)!.slice(0, limitCount);
        }
        return [];
      }
    }

    const roomSalt = await getOrFetchRoomSalt(roomCode);
    const list: DiaryData[] = [];
    
    for (const docSnap of snapshot.docs) {
      const raw = docSnap.data() as DiaryData;
      const decrypted = await decryptDiaryData(roomCode, raw, roomSalt);
      list.push(decrypted);
    }

    // 최신 날짜 순으로 정렬 후 상위 limitCount건 반환
    const sorted = list
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount);

    if (sorted.length > 0) {
      roomDiariesCache.set(roomCode, sorted);
    }

    return sorted;
  } catch (error) {
    console.warn('Failed to fetch room diaries for archive:', error);
    if (roomDiariesCache.has(roomCode)) {
      return roomDiariesCache.get(roomCode)!.slice(0, limitCount);
    }
    return [];
  }
}

// 9. 상대방(partnerName)이 이미 본(열람했거나 작성한) 편지 중 가장 최근 편지 1건 조회
export async function getLatestReadDiaryForPartner(
  roomCode: string,
  partnerName: string
): Promise<DiaryData | null> {
  try {
    // 최근 5건 내에서 탐색하여 성능 최적화
    const list = await getRoomDiariesFromFirestore(roomCode, 5);
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

    roomDiariesCache.delete(roomCode);
    roomSaltCache.delete(roomCode);
  } catch (e) {
    console.warn('Failed to leave room in firestore:', e);
  }
}

// 11. 커플 기념일 / 이어진 시작일 수정 저장
export async function updateAnniversaryDateInFirestore(
  roomCode: string,
  anniversaryDate: string
): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    await updateDoc(roomRef, {
      anniversaryDate,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Failed to update anniversary date in Firestore:', e);
  }
}

// 12. 웹 푸시 구독 정보 저장 (백그라운드 Web Push 알림용)
export async function savePushSubscriptionToRoom(
  roomCode: string,
  uid: string,
  subscription: PushSubscription | null
): Promise<void> {
  if (!roomCode || !uid || !subscription) return;
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    await updateDoc(roomRef, {
      [`memberInfo.${uid}.pushSubscription`]: JSON.stringify(subscription),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Failed to save push subscription to room:', e);
  }
}

// 13. 방 내 사용자 프로필 (이름, 생년월일) 실시간 업데이트
export async function updateUserProfileInFirestore(
  roomCode: string,
  uid: string,
  newNickname: string,
  newBirthDate?: string
): Promise<boolean> {
  if (!roomCode || !uid || !newNickname.trim()) return false;
  try {
    const roomRef = doc(db, 'rooms', roomCode);
    const updates: Record<string, any> = {
      [`memberInfo.${uid}.nickname`]: newNickname.trim(),
      updatedAt: serverTimestamp(),
    };
    if (newBirthDate !== undefined) {
      updates[`memberInfo.${uid}.birthDate`] = newBirthDate.trim();
    }
    await updateDoc(roomRef, updates);
    return true;
  } catch (e) {
    console.warn('Failed to update user profile in Firestore:', e);
    return false;
  }
}


