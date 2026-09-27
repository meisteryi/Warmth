export type UIState = 
  | 'VIEW_WAITING'        // 상대방이 일기 작성 중
  | 'VIEW_SEALED_LETTER'  // 새 일기 도착, 미션 미완수
  | 'VIEW_WAX_READY'      // 미션 완료, 실링 왁스 봉인 해제 대기 (3초 롱프레스 가능)
  | 'VIEW_OPENED_DIARY';  // 왁스 개봉 완료, 일기 열람 가능

export type WaxColor = '#6B1724' | '#B8860B' | '#2E473B';

export interface WaxOption {
  name: string;
  hex: WaxColor;
  label: string;
  shadow: string;
  highlight: string;
}

export const WAX_COLORS: WaxOption[] = [
  {
    name: 'Burgundy',
    hex: '#6B1724',
    label: '딥 버건디 (사랑과 온기)',
    shadow: '#3D0B14',
    highlight: '#9E2A3C',
  },
  {
    name: 'Antique Gold',
    hex: '#B8860B',
    label: '앤틱 골드 (영원한 추억)',
    shadow: '#694B02',
    highlight: '#E3B338',
  },
  {
    name: 'Forest Green',
    hex: '#2E473B',
    label: '포레스트 그린 (차분한 위로)',
    shadow: '#15251D',
    highlight: '#446E5A',
  },
];

export interface MissionData {
  type: 'TEXT' | 'PHOTO' | 'QUIZ' | 'VOICE';
  prompt: string;
  quizAnswer?: string | null;
  quizHint?: string | null;
  isCustom: boolean;
  submission?: {
    text?: string;
    mediaUrl?: string;
    submittedAt: string;
  } | null;
  isPassed: boolean;
}

export interface DiaryData {
  diaryId: string;
  authorId: string;
  authorName: string;
  recipientId: string;
  recipientName: string;
  title: string;
  content: string;
  photos: string[];
  waxColor: WaxColor;
  createdAt: string;
  mission: MissionData;
  isWaxBroken: boolean;
  openedAt?: string | null;
}

export interface RoomData {
  roomId: string;
  roomCode: string;
  status: 'MATCHED' | 'WAITING_PARTNER';
  currentTurn: string; // author UID
  members: string[];
  memberInfo: {
    [uid: string]: {
      nickname: string;
      role: 'CREATOR' | 'PARTNER';
    };
  };
  latestDiary?: DiaryData;
}
