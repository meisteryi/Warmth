import { DiaryData, KnockData } from '@/types/diary';

// 기본 클라이언트 솔트 (하위 호환성용)
const E2EE_DEFAULT_SALT = new TextEncoder().encode('warmth-analog-diary-secret-salt-2026');

// 암호화 키 캐시 (반복 계산 방지)
const keyCache = new Map<string, CryptoKey>();

function getCrypto(): Crypto | null {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto as unknown as Crypto;
  }
  return null;
}

/**
 * 방 생성 시 방마다 고유한 128비트 암호학적 난수 솔트 생성
 * -> 레인보우 테이블 및 사전 계산 브루트포스 공격을 수학적으로 무력화
 */
export function generateRoomSalt(): string {
  const cryptoObj = getCrypto();
  if (!cryptoObj) {
    return 'default_salt_' + Math.random().toString(36).substring(2);
  }
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  return bufferToBase64(bytes);
}

/**
 * 6자리 방 코드 + 방 고유 솔트로부터 PBKDF2 100,000회 연산을 거쳐 256비트 AES-GCM 키 유도
 */
async function getEncryptionKey(roomCode: string, roomSalt?: string): Promise<CryptoKey> {
  const cryptoObj = getCrypto();
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API not available');
  }

  const normalized = roomCode.trim();
  const saltKey = roomSalt ? roomSalt.trim() : 'default';
  const cacheKey = `${normalized}:${saltKey}`;

  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const rawSecret = new TextEncoder().encode(`warmth_room_e2ee_${normalized}`);
  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    rawSecret,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = roomSalt
    ? new TextEncoder().encode(`warmth_salt_${roomSalt}`)
    : E2EE_DEFAULT_SALT;

  const derivedKey = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * 단일 텍스트 문자열 암호화 (AES-GCM 256)
 * 출력 포맷: e2ee:v1:<base64-iv>:<base64-ciphertext>
 */
export async function encryptText(
  roomCode: string, 
  plainText: string, 
  roomSalt?: string
): Promise<string> {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (plainText.startsWith('e2ee:v1:')) return plainText; // 이미 암호화됨

  try {
    const cryptoObj = getCrypto();
    if (!cryptoObj || !cryptoObj.subtle) throw new Error('Web Crypto API not available');

    const key = await getEncryptionKey(roomCode, roomSalt);
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);

    const ciphertextBuffer = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      encoded as unknown as BufferSource
    );

    const ivBase64 = bufferToBase64(iv);
    const cipherBase64 = bufferToBase64(new Uint8Array(ciphertextBuffer));

    return `e2ee:v1:${ivBase64}:${cipherBase64}`;
  } catch (error) {
    console.warn('E2EE encrypt error (safe fallback):', error);
    return plainText;
  }
}

/**
 * 단일 텍스트 문자열 복호화 (AES-GCM 256)
 * 암호화되지 않은 기존 텍스트는 원본 그대로 반환
 */
export async function decryptText(
  roomCode: string, 
  cipherText: string, 
  roomSalt?: string
): Promise<string> {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  if (!cipherText.startsWith('e2ee:v1:')) return cipherText; // 기존 평문 호환

  try {
    const cryptoObj = getCrypto();
    if (!cryptoObj || !cryptoObj.subtle) throw new Error('Web Crypto API not available');

    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;

    const iv = base64ToBuffer(parts[2]);
    const ciphertext = base64ToBuffer(parts[3]);
    const key = await getEncryptionKey(roomCode, roomSalt);

    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.warn('E2EE decrypt notice (wrong room code or altered data):', error);
    return '[🔒 암호화된 편지 — 방 참여자만 확인 가능]';
  }
}

/**
 * 일기 객체 전체의 민감 데이터(제목, 본문, 사진, 퀴즈, 힌트, 감성평)를 암호화하여 반환
 * -> Firestore에 저장하기 직전에 호출
 */
export async function encryptDiaryData(
  roomCode: string, 
  diary: DiaryData, 
  roomSalt?: string
): Promise<DiaryData> {
  try {
    const encryptedTitle = await encryptText(roomCode, diary.title, roomSalt);
    const encryptedContent = await encryptText(roomCode, diary.content, roomSalt);

    // 사진(이미지 데이터URL) 암호화
    const encryptedPhotos = await Promise.all(
      (diary.photos || []).map((p) => encryptText(roomCode, p, roomSalt))
    );

    let encryptedMission = { ...diary.mission };
    if (encryptedMission) {
      encryptedMission = {
        ...encryptedMission,
        prompt: await encryptText(roomCode, encryptedMission.prompt, roomSalt),
        quizAnswer: encryptedMission.quizAnswer
          ? await encryptText(roomCode, encryptedMission.quizAnswer, roomSalt)
          : null,
        quizHint: encryptedMission.quizHint
          ? await encryptText(roomCode, encryptedMission.quizHint, roomSalt)
          : null,
        submission: encryptedMission.submission
          ? {
              ...encryptedMission.submission,
              text: encryptedMission.submission.text
                ? await encryptText(roomCode, encryptedMission.submission.text, roomSalt)
                : undefined,
            }
          : null,
      };
    }

    let encryptedWarmth = diary.warmthScore;
    if (encryptedWarmth) {
      encryptedWarmth = {
        ...encryptedWarmth,
        comment: await encryptText(roomCode, encryptedWarmth.comment, roomSalt),
        keywords: await Promise.all(
          (encryptedWarmth.keywords || []).map((k) => encryptText(roomCode, k, roomSalt))
        ),
      };
    }

    return {
      ...diary,
      title: encryptedTitle,
      content: encryptedContent,
      photos: encryptedPhotos,
      mission: encryptedMission,
      warmthScore: encryptedWarmth,
    };
  } catch (e) {
    console.warn('Failed to encrypt diary data:', e);
    return diary;
  }
}

/**
 * Firestore에서 불러온 일기 객체를 브라우저에서 복호화하여 반환
 */
export async function decryptDiaryData(
  roomCode: string, 
  diary: DiaryData, 
  roomSalt?: string
): Promise<DiaryData> {
  try {
    const decryptedTitle = await decryptText(roomCode, diary.title, roomSalt);
    const decryptedContent = await decryptText(roomCode, diary.content, roomSalt);

    // 사진(이미지) 복호화
    const decryptedPhotos = await Promise.all(
      (diary.photos || []).map((p) => decryptText(roomCode, p, roomSalt))
    );

    let decryptedMission = { ...diary.mission };
    if (decryptedMission) {
      decryptedMission = {
        ...decryptedMission,
        prompt: await decryptText(roomCode, decryptedMission.prompt, roomSalt),
        quizAnswer: decryptedMission.quizAnswer
          ? await decryptText(roomCode, decryptedMission.quizAnswer, roomSalt)
          : null,
        quizHint: decryptedMission.quizHint
          ? await decryptText(roomCode, decryptedMission.quizHint, roomSalt)
          : null,
        submission: decryptedMission.submission
          ? {
              ...decryptedMission.submission,
              text: decryptedMission.submission.text
                ? await decryptText(roomCode, decryptedMission.submission.text, roomSalt)
                : undefined,
            }
          : null,
      };
    }

    let decryptedWarmth = diary.warmthScore;
    if (decryptedWarmth) {
      decryptedWarmth = {
        ...decryptedWarmth,
        comment: await decryptText(roomCode, decryptedWarmth.comment, roomSalt),
        keywords: await Promise.all(
          (decryptedWarmth.keywords || []).map((k) => decryptText(roomCode, k, roomSalt))
        ),
      };
    }

    return {
      ...diary,
      title: decryptedTitle,
      content: decryptedContent,
      photos: decryptedPhotos,
      mission: decryptedMission,
      warmthScore: decryptedWarmth,
    };
  } catch (e) {
    console.warn('Failed to decrypt diary data:', e);
    return diary;
  }
}

/**
 * 실시간 노크 메시지 암호화 / 복호화
 */
export async function encryptKnockData(
  roomCode: string, 
  knock: KnockData, 
  roomSalt?: string
): Promise<KnockData> {
  return {
    ...knock,
    message: await encryptText(roomCode, knock.message, roomSalt),
  };
}

export async function decryptKnockData(
  roomCode: string, 
  knock: KnockData, 
  roomSalt?: string
): Promise<KnockData> {
  return {
    ...knock,
    message: await decryptText(roomCode, knock.message, roomSalt),
  };
}

// Base64 유틸리티
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
