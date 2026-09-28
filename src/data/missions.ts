export interface SystemMissionItem {
  id: string;
  days: string; // e.g. "월/화"
  category: 'EMOTION' | 'DAILY' | 'QUIZ' | 'REVIEW';
  categoryLabel: string;
  type: 'TEXT' | 'PHOTO' | 'QUIZ' | 'VOICE';
  prompt: string;
  description: string;
  badgeColor: string;
}

export const SYSTEM_MISSIONS: SystemMissionItem[] = [
  // 월/화 (감정/애정)
  {
    id: 'mission-mon-1',
    days: '월/화',
    category: 'EMOTION',
    categoryLabel: '감정 · 애정',
    type: 'TEXT',
    prompt: '오늘의 다정 쪽지 쓰기 (최소 20자 이상)',
    description: '지친 하루 끝, 서로에게 따뜻한 온기가 되는 위로의 한 줄을 남겨보세요.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    id: 'mission-mon-2',
    days: '월/화',
    category: 'EMOTION',
    categoryLabel: '감정 · 애정',
    type: 'TEXT',
    prompt: '오늘 내 감정 날씨 스탬프 찍기',
    description: '설렘, 평온, 고단함, 보고픔, 감사함 중 오늘의 내 마음 날씨를 골라보세요.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    id: 'mission-tue-1',
    days: '월/화',
    category: 'EMOTION',
    categoryLabel: '감정 · 애정',
    type: 'TEXT',
    prompt: '오늘 상대방에게 고마웠던 점 1가지',
    description: '작고 사소하지만 마음 깊이 고마웠던 순간을 떠올려 적어보세요.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },

  // 수/목 (시선/일상 공유)
  {
    id: 'mission-wed-1',
    days: '수/목',
    category: 'DAILY',
    categoryLabel: '시선 · 일상 공유',
    type: 'PHOTO',
    prompt: '지금 내 시야 사진 1장 찍어 올리기',
    description: '지금 내가 바라보고 있는 풍경이나 시선을 상대방에게 그대로 전해보세요.',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'mission-wed-2',
    days: '수/목',
    category: 'DAILY',
    categoryLabel: '시선 · 일상 공유',
    type: 'PHOTO',
    prompt: '오늘 가장 맛있었던 한 입/음료 사진',
    description: '오늘 먹은 메뉴 중 가장 맛있었던 순간을 사진으로 남겨보세요.',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    id: 'mission-thu-1',
    days: '수/목',
    category: 'DAILY',
    categoryLabel: '시선 · 일상 공유',
    type: 'PHOTO',
    prompt: '오늘의 발끝 체크인 사진',
    description: '길을 걷다 멈춰 서서 내 발끝과 오늘의 바닥 풍경을 담아보세요.',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
  },

  // 금/토 (퀴즈/추억)
  {
    id: 'mission-fri-1',
    days: '금/토',
    category: 'QUIZ',
    categoryLabel: '퀴즈 · 추억',
    type: 'QUIZ',
    prompt: '작성자 TMI 단답형 퀴즈 (작성자가 정답 지정)',
    description: '오늘 나에게 일어났던 사소한 일에 대한 단답형 퀴즈를 맞혀보세요.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'mission-fri-2',
    days: '금/토',
    category: 'QUIZ',
    categoryLabel: '퀴즈 · 추억',
    type: 'QUIZ',
    prompt: '오늘의 기분 초성 맞히기',
    description: '예: ㅂㄱㅍ (배고파 or 보고파) 초성을 보고 맞춰보세요.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'mission-sat-1',
    days: '금/토',
    category: 'QUIZ',
    categoryLabel: '퀴즈 · 추억',
    type: 'QUIZ',
    prompt: '텔레파시 밸런스 게임 선택 일치시키기',
    description: '둘 중 하나를 선택하여 서로의 마음이 통했는지 확인해보세요.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },

  // 일 (회고/음성)
  {
    id: 'mission-sun-1',
    days: '일',
    category: 'REVIEW',
    categoryLabel: '회고 · 음성',
    type: 'VOICE',
    prompt: '이번 주를 마무리하는 3초 목소리 음성 메시지',
    description: '"잘 자", "보고 싶어" 등 따뜻한 내 목소리를 3초간 녹음해 들려주세요.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'mission-sun-2',
    days: '일',
    category: 'REVIEW',
    categoryLabel: '회고 · 음성',
    type: 'TEXT',
    prompt: '상대방을 떠올리며 고른 BGM 한 곡 공유',
    description: '오늘 밤 함께 듣고 싶은 감미로운 노래 한 곡을 추천해보세요.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'mission-sun-3',
    days: '일',
    category: 'REVIEW',
    categoryLabel: '회고 · 음성',
    type: 'TEXT',
    prompt: '이번 주 최고의 순간 한 줄 요약',
    description: '지나간 일주일 중 가장 반짝였던 행복한 순간을 짧게 기록해보세요.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];
