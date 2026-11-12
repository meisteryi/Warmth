import { storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * 클라이언트 사이드 이미지 압축 및 리사이징 결과
 */
export interface CompressedImageResult {
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
  fileName: string;
}

const MAX_FIRESTORE_SAFE_DATAURL_CHARS = 600_000;

function canvasToBoundedDataUrl(
  sourceCanvas: HTMLCanvasElement,
  initialQuality: number,
  maxChars = MAX_FIRESTORE_SAFE_DATAURL_CHARS
): { dataUrl: string; width: number; height: number } {
  let currentCanvas = sourceCanvas;
  const qualities = [initialQuality, 0.7, 0.56, 0.44];

  for (let scalePass = 0; scalePass < 3; scalePass++) {
    for (const q of qualities) {
      const dataUrl = currentCanvas.toDataURL('image/jpeg', q);
      if (dataUrl.length <= maxChars) {
        return { dataUrl, width: currentCanvas.width, height: currentCanvas.height };
      }
    }

    const nextW = Math.max(320, Math.round(currentCanvas.width * 0.75));
    const nextH = Math.max(320, Math.round(currentCanvas.height * 0.75));
    const resized = document.createElement('canvas');
    resized.width = nextW;
    resized.height = nextH;
    const ctx = resized.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentCanvas, 0, 0, nextW, nextH);
    currentCanvas = resized;
  }

  return {
    dataUrl: currentCanvas.toDataURL('image/jpeg', 0.4),
    width: currentCanvas.width,
    height: currentCanvas.height,
  };
}

/**
 * 클라이언트 사이드 이미지 리사이징 및 압축 함수
 * - 모바일 스마트폰의 고화질 원본 사진(5MB~15MB)을 브라우저 캔버스로 리사이징/압축
 * - Storage 업로드 실패/타임아웃으로 Base64 저장 + E2EE 암호화(약 1.35배 증가)가 되더라도
 *   Firestore 1MB(1,048,487 bytes) 단일 필드 제한을 절대 넘지 않도록 용량을 자동 상한 제한합니다.
 */
export async function compressImage(
  file: File,
  maxWidth = 1080,
  maxHeight = 1080,
  quality = 0.8
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 원본 종횡비 유지 리사이징
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // 이미지 고품질 스무딩
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Firestore 1MB 제한(+E2EE 암호화 오버헤드) 안전 상한 내 JPEG 압축
        const bounded = canvasToBoundedDataUrl(canvas, quality);
        const head = 'data:image/jpeg;base64,';
        const base64Len = bounded.dataUrl.length - head.length;
        const sizeBytes = Math.round((base64Len * 3) / 4);
        const sizeKb = Math.round(sizeBytes / 1024);

        resolve({
          dataUrl: bounded.dataUrl,
          sizeKb,
          width: bounded.width,
          height: bounded.height,
          fileName: file.name,
        });
      };
      img.onerror = (err) => reject(err);
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Data URL (Base64) 이미지를 리사이징 및 압축합니다.
 * - AI가 생성한 이미지를 웹/모바일 최적화 규격(최대 800x800, JPEG 0.82)으로 압축하여
 *   Firestore 용량 및 슬라이딩 퍼즐 렌더링 성능을 보장합니다.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.82,
  fileName = 'ai-illustration.jpg'
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const bounded = canvasToBoundedDataUrl(canvas, quality);
      const head = 'data:image/jpeg;base64,';
      const base64Len = bounded.dataUrl.length - head.length;
      const sizeBytes = Math.round((base64Len * 3) / 4);
      const sizeKb = Math.round(sizeBytes / 1024);

      resolve({
        dataUrl: bounded.dataUrl,
        sizeKb,
        width: bounded.width,
        height: bounded.height,
        fileName,
      });
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * Firebase Storage 업로드 시도 (1.5초 타임아웃 적용하여 무한 대기 방지, 실패 시 즉시 초경량 압축 dataUrl 반환)
 */
export async function uploadPhotoIfPossible(roomCode: string, dataUrl: string): Promise<string> {
  // 이미 일반 웹 URL(Unsplash 등)인 경우 그대로 반환
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  try {
    if (!storage) return dataUrl;
    const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const storageRef = ref(storage, `rooms/${roomCode}/photos/${photoId}.jpg`);

    const uploadTask = (async () => {
      await uploadString(storageRef, dataUrl, 'data_url');
      return await getDownloadURL(storageRef);
    })();

    // 2.5초 타임아웃: 스토리지 권한 오류나 재시도로 무한 대기하는 현상을 차단
    const timeoutTask = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 2500)
    );

    return await Promise.race([uploadTask, timeoutTask]);
  } catch (error) {
    console.warn('Firebase Storage upload notice (falling back to compressed dataURL):', error);
    return dataUrl;
  }
}
