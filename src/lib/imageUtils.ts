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

/**
 * 클라이언트 사이드 이미지 리사이징 및 압축 함수
 * - 모바일 스마트폰의 고화질 원본 사진(5MB~15MB)을 브라우저 캔버스로 리사이징/압축하여
 *   150KB~250KB 수준으로 줄입니다.
 * - Firestore 1MB 문서 용량 제한을 안전하게 준수하며, 네트워크 전송 및 렌더링 속도를 극대화합니다.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
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

        // JPEG 압축 (0.82 퀄리티: 감성 화질 유지 + 극적인 용량 절감)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const head = 'data:image/jpeg;base64,';
        const base64Len = dataUrl.length - head.length;
        const sizeBytes = Math.round((base64Len * 3) / 4);
        const sizeKb = Math.round(sizeBytes / 1024);

        resolve({
          dataUrl,
          sizeKb,
          width,
          height,
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

    // 1.5초 타임아웃: 스토리지 권한 오류나 재시도로 무한 대기하는 현상을 완벽 차단
    const timeoutTask = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 1500)
    );

    return await Promise.race([uploadTask, timeoutTask]);
  } catch (error) {
    console.warn('Firebase Storage upload notice (falling back to compressed dataURL):', error);
    return dataUrl;
  }
}
