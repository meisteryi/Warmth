export type UIState = 
  | 'VIEW_ONBOARDING'     // 초기 방 생성 / 초대코드 입력 & 매칭 화면
  | 'VIEW_HOME'           // 둘만의 아늑한 홈 화면 (이어진 지 N일 차, 오늘 편지 상태 및 바로가기)
  | 'VIEW_EMPTY'          // 초기 상태: 아직 작성된 편지 없음 -> 편지 쓰기가 제일 먼저 나옴
  | 'VIEW_WAITING'        // 상대방이 일기 작성 중 (답장 대기)
  | 'VIEW_SEALED_LETTER'  // 편지 도착 -> 편지 까는 메뉴 (봉인 해제 관문 열기)
  | 'VIEW_WAX_READY'      // 미션 완료, 실링 왁스 봉인 해제 대기 (3초 롱프레스 가능)
  | 'VIEW_OPENED_DIARY'   // 왁스 개봉 완료, 일기 열람 가능
  | 'VIEW_MEMORY_JAR'     // 3D 온기 유리병 & 실링 왁스 뷰
  | 'VIEW_ARCHIVE';       // 둘만의 서재 (상단바 고정 인라인 뷰)

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

export type PaperTheme = 'IVORY' | 'KRAFT' | 'GRID' | 'AIRMAIL' | 'MIDNIGHT';

export interface PaperThemeOption {
  id: PaperTheme;
  name: string;
  desc: string;
  badge: string;
  previewColor: string;
  previewBorder: string;
  className: string;
}

export const PAPER_THEMES: PaperThemeOption[] = [
  {
    id: 'IVORY',
    name: '아이보리 줄노트',
    desc: '포근하고 단정한 클래식 줄노트',
    badge: '클래식',
    previewColor: '#FFFDF9',
    previewBorder: '#DECDBB',
    className: 'paper-theme-ivory',
  },
  {
    id: 'KRAFT',
    name: '빈티지 크라프트',
    desc: '따뜻한 감성의 앤틱 갈색지',
    badge: '앤틱',
    previewColor: '#F4E7D3',
    previewBorder: '#C8A882',
    className: 'paper-theme-kraft',
  },
  {
    id: 'GRID',
    name: '문학 원고지',
    desc: '정갈한 원고지 모눈격자',
    badge: '문학',
    previewColor: '#FAFBF7',
    previewBorder: '#BFD3C1',
    className: 'paper-theme-grid',
  },
  {
    id: 'AIRMAIL',
    name: '항공우편 (에어메일)',
    desc: '클래식 줄무늬 테두리 편지지',
    badge: '빈티지',
    previewColor: '#FDFCF9',
    previewBorder: '#8BA5C4',
    className: 'paper-theme-airmail',
  },
  {
    id: 'MIDNIGHT',
    name: '별밤 네이비',
    desc: '달빛과 은은한 별빛이 내리는 밤',
    badge: '야간',
    previewColor: '#181F2B',
    previewBorder: '#324058',
    className: 'paper-theme-midnight',
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

export interface DiaryReaction {
  emoji: string;
  comment?: string; // 공백 포함 100자 이내 코멘트
  reactorName: string;
  reactorId?: string; // 작성자 고유 UID
  reactedAt: string;
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
  photoCaption?: string | null;
  photoCaptions?: string[];
  waxColor: WaxColor;
  paperTheme?: PaperTheme;
  createdAt: string;
  mission: MissionData;
  isWaxBroken: boolean;
  openedAt?: string | null;
  warmthScore?: WarmthScore | null;
  stamp?: WeatherStamp | null;
  reaction?: DiaryReaction | null;
}

/**
 * 일기 객체에 부착된 포스트잇 반응(reaction) 유효성 검증
 * - 아직 개봉되지 않은 일기(!isWaxBroken)는 봉인 상태이므로 반응을 노출하지 않음
 * - 주의: 일기 작성 시점(createdAt 정오 보정)이나 날짜 사후 수정, 기기 간 시계 오차로 인해
 *   정상 등록된 포스트잇이 삭제되지 않도록 타임스탬프 역전 비교로 반응을 폐기하지 않음
 */
export function sanitizeDiaryReaction(diary: DiaryData): DiaryData {
  if (!diary) return diary;

  // 아직 실링 왁스가 개봉되지 않은 비밀 편지는 포스트잇 반응 노출 원천 차단
  if (!diary.isWaxBroken) {
    return { ...diary, reaction: null };
  }

  if (!diary.reaction) return diary;

  // 최소 필수 필드(emoji) 검증
  if (typeof diary.reaction.emoji !== 'string' || !diary.reaction.emoji.trim()) {
    return { ...diary, reaction: null };
  }

  return diary;
}

/**
 * 일기가 현재 사용자(나)가 작성한 편지인지 안전하게 판별하는 헬퍼 함수
 * - 1순위: diary.authorId와 myUid가 일치하면 닉네임 변경 직후라도 무조건 내 편지로 판별
 * - 2순위: authorName과 currentUserName이 일치하면 내 편지로 판별 (타 기기 재접속 및 데모룸 호환)
 */
export function isDiaryWrittenByMe(
  diary: Pick<DiaryData, 'authorId' | 'authorName'> | null | undefined,
  currentUserName: string,
  myUid?: string | null,
  partnerName?: string
): boolean {
  if (!diary) return false;
  if (myUid && diary.authorId && diary.authorId !== 'user_ssr' && diary.authorId === myUid) {
    return true;
  }
  const cleanAuthor = (diary.authorName || '').trim();
  const cleanMe = (currentUserName || '').trim();
  if (cleanMe && cleanAuthor === cleanMe) {
    return true;
  }
  if (partnerName && cleanAuthor && cleanAuthor === partnerName.trim()) {
    return false;
  }
  return false;
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

export interface MonthlyRecapData {
  monthKey: string; // e.g., '2026-10'
  summary: string; // Gemini AI 3~4문장 월간 온기 에세이 총평
  bestQuote: string; // 이달의 가장 다정했던 한 문장
  bestQuoteAuthor: string; // 발췌된 편지 작성자
  bestQuoteDate: string; // 발췌된 편지 날짜 (예: '10월 17일')
  nextSuggestion: string; // 다음 달을 위한 작은 제안
  analyzedCount: number; // 분석 당시 해당 월 편지 수
  generatedAt: string; // ISO 8601
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
  monthlyRecaps?: {
    [monthKey: string]: string; // E2EE encrypted MonthlyRecapData JSON
  };
}

