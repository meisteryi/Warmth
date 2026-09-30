import { DiaryData, KnockData } from '@/types/diary';

// 클라이언트 고유 솔트 (고정 페퍼): 방 코드와 결합하여 강력한 256비트 AES-GCM 키 생성
const E2EE_SALT = new TextEncoder().encode('warmth-analog-diary-secret-salt-2026');

// 암호화 키 캐시 (반복 계산 방지)
const keyCache = new Map<string, CryptoKey>();

/**
 * 6자리 방 코드로부터 PBKDF2 100,000회 반복을 거쳐 256비트 AES-GCM 키를 유도
 * -> 이 키는 절대 서버/데이터베이스에 전송되거나 저장되지 않습니다.
 */
async function getEncryptionKey(roomCode: string): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }

  const normalized = roomCode.trim();
  if (keyCache.has(normalized)) {
    return keyCache.get(normalized)!;
  }

  const rawSecret = new TextEncoder().encode(`warmth_room_e2ee_${normalized}`);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    rawSecret,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: E2EE_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(normalized, derivedKey);
  return derivedKey;
}

/**
 * 단일 텍스트 문자열 암호화 (AES-GCM 256)
 * 출력 포맷: e2ee:v1:<base64-iv>:<base64-ciphertext>
 */
export async function encryptText(roomCode: string, plainText: string): Promise<string> {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (plainText.startsWith('e2ee:v1:')) return plainText; // 이미 암호화됨

  try {
    const key = await getEncryptionKey(roomCode);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
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
export async function decryptText(roomCode: string, cipherText: string): Promise<string> {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  if (!cipherText.startsWith('e2ee:v1:')) return cipherText; // 기존 평문 호환

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;

    const iv = base64ToBuffer(parts[2]);
    const ciphertext = base64ToBuffer(parts[3]);
    const key = await getEncryptionKey(roomCode);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
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
 * 일기 객체 전체의 민감 데이터(제목, 본문, 퀴즈, 힌트, 감성평)를 암호화하여 반환
 * -> Firestore에 저장하기 직전에 호출
 */
export async function encryptDiaryData(roomCode: string, diary: DiaryData): Promise<DiaryData> {
  try {
    const encryptedTitle = await encryptText(roomCode, diary.title);
    const encryptedContent = await encryptText(roomCode, diary.content);

    let encryptedMission = { ...diary.mission };
    if (encryptedMission) {
      encryptedMission = {
        ...encryptedMission,
        prompt: await encryptText(roomCode, encryptedMission.prompt),
        quizAnswer: encryptedMission.quizAnswer
          ? await encryptText(roomCode, encryptedMission.quizAnswer)
          : null,
        quizHint: encryptedMission.quizHint
          ? await encryptText(roomCode, encryptedMission.quizHint)
          : null,
        submission: encryptedMission.submission
          ? {
              ...encryptedMission.submission,
              text: encryptedMission.submission.text
                ? await encryptText(roomCode, encryptedMission.submission.text)
                : undefined,
            }
          : null,
      };
    }

    let encryptedWarmth = diary.warmthScore;
    if (encryptedWarmth) {
      encryptedWarmth = {
        ...encryptedWarmth,
        comment: await encryptText(roomCode, encryptedWarmth.comment),
        keywords: await Promise.all(
          (encryptedWarmth.keywords || []).map((k) => encryptText(roomCode, k))
        ),
      };
    }

    return {
      ...diary,
      title: encryptedTitle,
      content: encryptedContent,
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
export async function decryptDiaryData(roomCode: string, diary: DiaryData): Promise<DiaryData> {
  try {
    const decryptedTitle = await decryptText(roomCode, diary.title);
    const decryptedContent = await decryptText(roomCode, diary.content);

    let decryptedMission = { ...diary.mission };
    if (decryptedMission) {
      decryptedMission = {
        ...decryptedMission,
        prompt: await decryptText(roomCode, decryptedMission.prompt),
        quizAnswer: decryptedMission.quizAnswer
          ? await decryptText(roomCode, decryptedMission.quizAnswer)
          : null,
        quizHint: decryptedMission.quizHint
          ? await decryptText(roomCode, decryptedMission.quizHint)
          : null,
        submission: decryptedMission.submission
          ? {
              ...decryptedMission.submission,
              text: decryptedMission.submission.text
                ? await decryptText(roomCode, decryptedMission.submission.text)
                : undefined,
            }
          : null,
      };
    }

    let decryptedWarmth = diary.warmthScore;
    if (decryptedWarmth) {
      decryptedWarmth = {
        ...decryptedWarmth,
        comment: await decryptText(roomCode, decryptedWarmth.comment),
        keywords: await Promise.all(
          (decryptedWarmth.keywords || []).map((k) => decryptText(roomCode, k))
        ),
      };
    }

    return {
      ...diary,
      title: decryptedTitle,
      content: decryptedContent,
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
export async function encryptKnockData(roomCode: string, knock: KnockData): Promise<KnockData> {
  return {
    ...knock,
    message: await encryptText(roomCode, knock.message),
  };
}

export async function decryptKnockData(roomCode: string, knock: KnockData): Promise<KnockData> {
  return {
    ...knock,
    message: await decryptText(roomCode, knock.message),
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
