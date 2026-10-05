export type UIState = 
  | 'VIEW_ONBOARDING'     // 초기 방 생성 / 초대코드 입력 & 매칭 화면
  | 'VIEW_HOME'           // 둘만의 아늑한 홈 화면 (이어진 지 N일 차, 오늘 편지 상태 및 바로가기)
  | 'VIEW_EMPTY'          // 초기 상태: 아직 작성된 편지 없음 -> 편지 쓰기가 제일 먼저 나옴
  | 'VIEW_WAITING'        // 상대방이 일기 작성 중 (답장 대기)
  | 'VIEW_SEALED_LETTER'  // 편지 도착 -> 편지 까는 메뉴 (봉인 해제 관문 열기)
  | 'VIEW_WAX_READY'      // 미션 완료, 실링 왁스 봉인 해제 대기 (3초 롱프레스 가능)
  | 'VIEW_OPENED_DIARY';  // 왁스 개봉 완료, 일기 열람 가능

export type WaxColor = string;

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
  type: 'TEXT' | 'PHOTO' | 'QUIZ' | 'VOICE' | 'PUZZLE_PHOTO' | 'PUZZLE_STAMP';
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

export interface WarmthScore {
  temperature: number; // e.g. 37.8
  comment: string; // e.g. "추운 하루 속 서로를 포근하게 안아주는 따뜻한 온기"
  keywords: string[]; // e.g. ["#퇴근길", "#붕어빵", "#다정한위로"]
}

export type StampStyle = 'BADGE' | 'EMOJI_TITLE';

export interface WeatherStamp {
  id: string;
  name: string;
  symbol: string;
  color: string;
  style?: StampStyle; // 'BADGE': 날짜 옆 빈티지 인장 도장, 'EMOJI_TITLE': 편지 제목 좌측 상단 대형 스티커
}

export const WEATHER_STAMPS: WeatherStamp[] = [
  { id: 'sunny', name: '맑고 화창한 날', symbol: '☀️', color: '#A83232' },
  { id: 'flutter', name: '두근두근 설렘', symbol: '🌸', color: '#B53350' },
  { id: 'starry', name: '고요한 밤하늘', symbol: '🌙', color: '#2B3B60' },
  { id: 'rainy', name: '촉촉한 빗소리', symbol: '🌧️', color: '#265476' },
  { id: 'snowy', name: '포근한 하얀 눈', symbol: '❄️', color: '#3E6677' },
  { id: 'cloudy', name: '나른한 뭉게구름', symbol: '⛅', color: '#5B626C' },
  { id: 'tired', name: '수고한 지친 하루', symbol: '☕', color: '#684530' },
];

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
  warmthScore?: WarmthScore | null;
  stamp?: WeatherStamp | null;
}

export interface KnockData {
  senderUid: string;
  senderName: string;
  message: string;
  knockedAt: string;
}

export interface DisconnectionData {
  leaverUid: string;
  leaverNickname: string;
  disconnectedAt: string;
}

export interface RoomData {
  roomId: string;
  roomCode: string;
  status: 'MATCHED' | 'WAITING_PARTNER' | 'DISCONNECTED';
  currentTurn: string; // author UID
  members: string[];
  memberInfo: {
    [uid: string]: {
      nickname: string;
      role: 'CREATOR' | 'PARTNER';
      pushSubscription?: string;
      birthDate?: string; // YYYY-MM-DD
    };
  };
  roomSalt?: string;
  latestDiary?: DiaryData;
  latestDiaryId?: string;
  latestKnock?: KnockData | null;
  lastDisconnection?: DisconnectionData | null;
  createdAt?: string;
  matchedAt?: string;
  anniversaryDate?: string;
  lastWrittenByUser?: {
    [uidOrName: string]: string;
  };
}

