import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { DiaryData, RoomData } from '@/types/diary';

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

// 0. 특정 일기 실시간 구독 (onSnapshot)
export function subscribeDiary(
  roomCode: string,
  diaryId: string,
  onUpdate: (diary: DiaryData) => void
): Unsubscribe {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  return onSnapshot(diaryRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as DiaryData);
    }
  });
}

// 1. 방 생성 (6자리 난수 코드 발급 및 Firestore 저장)
export async function createRoomInFirestore(creatorNickname: string): Promise<string> {
  const myUid = getOrCreateUserId();
  
  // 6자리 난수 코드 생성
  let roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 이미 존재하는 방인지 체크 (중복 방지)
  const roomRef = doc(db, 'rooms', roomCode);
  const existing = await getDoc(roomRef);
  if (existing.exists()) {
    roomCode = Math.floor(100000 + Math.random() * 900000).toString();
  }

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
  };

  // Firestore rooms/{roomCode} 위치에 저장
  await setDoc(doc(db, 'rooms', roomCode), {
    ...newRoomData,
    createdAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  return roomCode;
}

// 2. 방 참여 (6자리 초대코드 입력하여 1:1 매칭)
export async function joinRoomInFirestore(
  roomCode: string, 
  partnerNickname: string
): Promise<{ success: boolean; message: string; room?: RoomData }> {
  const myUid = getOrCreateUserId();
  const roomRef = doc(db, 'rooms', roomCode);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    return { success: false, message: '존재하지 않는 초대코드입니다. 코드를 다시 확인해주세요.' };
  }

  const room = snap.data() as RoomData;

  // 이미 2명이 찬 경우
  if (room.members.length >= 2 && !room.members.includes(myUid)) {
    return { success: false, message: '이미 2명의 매칭이 완료된 일기장입니다.' };
  }

  // 아직 매칭 전인 경우 파트너로 등록
  if (!room.members.includes(myUid)) {
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
      updatedAt: serverTimestamp(),
    });

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

  return { success: true, message: '기존 방에 재입장했습니다.', room };
}

// 3. 방 실시간 구독 (onSnapshot)
export function subscribeRoom(
  roomCode: string, 
  onUpdate: (room: RoomData) => void
): Unsubscribe {
  const roomRef = doc(db, 'rooms', roomCode);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as RoomData);
    }
  });
}

// 4. 일기 저장 (rooms/{roomCode}/diaries/{diaryId})
export async function saveDiaryToFirestore(
  roomCode: string,
  diary: DiaryData
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diary.diaryId);
  await setDoc(diaryRef, {
    ...diary,
    createdAt: new Date().toISOString(),
  });

  // 방 최신 일기 ID 업데이트 및 턴 넘기기
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, {
    latestDiaryId: diary.diaryId,
    currentTurn: diary.recipientId,
    updatedAt: serverTimestamp(),
  });
}

// 5. 미션 통과 업데이트
export async function updateMissionInFirestore(
  roomCode: string,
  diaryId: string,
  submissionText: string
): Promise<void> {
  const diaryRef = doc(db, 'rooms', roomCode, 'diaries', diaryId);
  await updateDoc(diaryRef, {
    'mission.isPassed': true,
    'mission.submission': {
      text: submissionText,
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

// 7. 상대방에게 은은한 노크 전송 (Firestore rooms/{roomCode}에 latestKnock 기록)
export async function sendKnockInFirestore(
  roomCode: string,
  senderName: string,
  message?: string
): Promise<void> {
  const myUid = getOrCreateUserId();
  const roomRef = doc(db, 'rooms', roomCode);
  await updateDoc(roomRef, {
    latestKnock: {
      senderUid: myUid,
      senderName: senderName || '주형',
      message: message || '오늘의 교환일기를 기다리고 있어요 ✉️',
      knockedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
}

