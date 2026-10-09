/**
 * 3D 온기 유리병(Memory Jar) & 왁스 조각 에셋 타입 정의
 */

export interface WaxPieceData {
  id: string;
  diaryId?: string;
  color: string; // 왁스 색상 (Hex)
  label: string; // 색상 라벨
  title: string; // 연결된 일기 제목
  date: string;  // 일기 작성일
  authorName: string; // 작성자
  shapeType: 'FRAGMENT' | 'SEAL_COIN'; // 파편형 or 미니 인장 코인형
  size: number;
  photoUrl?: string; // 프리뷰 썸네일 사진 URL
  diary?: any; // 연결된 DiaryData 원본
}

export interface JarRenderOptions {
  enableSunlightParticles?: boolean; // 햇빛 먼지 입자 렌더링 여부
  enableGyroscope?: boolean; // 스마트폰 기울기 센서 연동 여부
  soundEnabled?: boolean; // 유리병/왁스 마찰 사운드
  autoRotate?: boolean; // 천천히 자동 회전 쇼케이스 모드
}

export const SAMPLE_WAX_PIECES: WaxPieceData[] = [
  { id: 'wax-1', color: '#6B1724', label: '딥 버건디', title: '서촌 골목길을 걷다가', date: '2026.10.01', authorName: '민우', shapeType: 'SEAL_COIN', size: 1 },
  { id: 'wax-2', color: '#B8860B', label: '앤틱 골드', title: '첫눈 오던 날, 너에게 쓴 답장', date: '2026.10.03', authorName: '서연', shapeType: 'SEAL_COIN', size: 0.95 },
  { id: 'wax-3', color: '#6B1724', label: '딥 버건디', title: '비 내리는 오후의 따뜻한 라떼', date: '2026.10.04', authorName: '민우', shapeType: 'SEAL_COIN', size: 1.1 },
  { id: 'wax-4', color: '#2E473B', label: '포레스트 그린', title: '지친 하루 끝 건넨 짧은 위로', date: '2026.10.05', authorName: '서연', shapeType: 'SEAL_COIN', size: 1.0 },
  { id: 'wax-5', color: '#B8860B', label: '앤틱 골드', title: '노을 지는 한강 다리 위에서', date: '2026.10.06', authorName: '민우', shapeType: 'SEAL_COIN', size: 0.95 },
  { id: 'wax-6', color: '#6B1724', label: '딥 버건디', title: '우리가 함께 고른 작은 화분', date: '2026.10.07', authorName: '서연', shapeType: 'SEAL_COIN', size: 1.05 },
  { id: 'wax-7', color: '#2E473B', label: '포레스트 그린', title: '가을바람 맞으며 마신 따뜻한 차', date: '2026.10.08', authorName: '민우', shapeType: 'SEAL_COIN', size: 1 },
  { id: 'wax-8', color: '#B8860B', label: '앤틱 골드', title: '어느덧 8번째로 이어진 우리의 온기', date: '2026.10.09', authorName: '서연', shapeType: 'SEAL_COIN', size: 1.1 },
];
