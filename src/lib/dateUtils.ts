/**
 * D-Day and couple relationship anniversary calculations
 * & Daily 04:00 AM Reset Timer calculations
 */

export interface DaysTogetherInfo {
  days: number;
  formattedStartDate: string;
  startDateIso: string;
}

/**
 * 시작일(또는 방 연결일)로부터 오늘까지 며칠째인지 계산 (당일 = 1일 차)
 */
export function calculateDaysTogether(startDateStr?: string | null, lang: 'ko' | 'en' = 'ko'): DaysTogetherInfo {
  const now = new Date();
  let start = new Date();

  if (startDateStr) {
    const parsed = new Date(startDateStr);
    if (!isNaN(parsed.getTime())) {
      start = parsed;
    }
  }

  // 자정(00:00:00) 기준 일수 차이 계산하여 시간 왜곡 방지
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const diffDays = Math.floor((nowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
  const days = Math.max(1, diffDays + 1);

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedStartDate = lang === 'en'
    ? `${monthsEn[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`
    : `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일`;
  const startDateIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  return {
    days,
    formattedStartDate,
    startDateIso,
  };
}

/**
 * 주어진 시각의 04:00 AM 기준 일기 주기 식별자 반환 (YYYY-MM-DD)
 * 예: 10월 1일 03:30 -> 4시간을 빼면 9월 30일 23:30 -> "2026-09-30" 주기
 * 예: 10월 1일 04:15 -> 4시간을 빼면 10월 1일 00:15 -> "2026-10-01" 주기
 */
export function getDiaryCycleKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 해당 일기가 현재 주기(새벽 4시 이후 작성된 일기)에 이미 작성되었는지 검사
 */
export function isDiaryWrittenInCurrentCycle(diaryCreatedAt?: string | null): boolean {
  if (!diaryCreatedAt) return false;
  const diaryDate = new Date(diaryCreatedAt);
  if (isNaN(diaryDate.getTime())) return false;
  return getDiaryCycleKey(diaryDate) === getDiaryCycleKey(new Date());
}

/**
 * 다음 새벽 04:00까지 남은 시간 계산
 */
export interface ResetCountdownInfo {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string; // e.g. "03:14:22"
  formattedKorean: string; // e.g. "3시간 14분"
  nextResetTime: Date;
}

export function getTimeUntilNextReset(now: Date = new Date(), lang: 'ko' | 'en' = 'ko'): ResetCountdownInfo {
  const nextReset = new Date(now);
  // 만약 현재 시각이 04:00 이전이면 오늘 04:00이 리셋 시각
  // 현재 시각이 04:00 이후이면 내일 04:00이 리셋 시각
  if (now.getHours() < 4) {
    nextReset.setHours(4, 0, 0, 0);
  } else {
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(4, 0, 0, 0);
  }

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const formattedKorean = lang === 'en'
    ? (hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`)
    : (hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분 ${seconds}초`);

  return {
    totalSeconds,
    hours,
    minutes,
    seconds,
    formatted,
    formattedKorean,
    nextResetTime: nextReset,
  };
}

/**
 * 오늘 날짜를 감성 포맷으로 반환 (예: "10월 5일 (월)" 또는 "Oct 5 (Mon)")
 */
export function formatTodayKorean(now: Date = new Date(), includeYear = false, lang: 'ko' | 'en' = 'ko'): string {
  const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dayName = lang === 'en' ? daysEn[now.getDay()] : daysKo[now.getDay()];

  if (lang === 'en') {
    return includeYear
      ? `${monthsEn[now.getMonth()]} ${d}, ${y} (${dayName})`
      : `${monthsEn[now.getMonth()]} ${d} (${dayName})`;
  }
  return includeYear ? `${y}년 ${m}월 ${d}일 (${dayName})` : `${m}월 ${d}일 (${dayName})`;
}

/**
 * 일기 작성 일시를 날짜 및 상대 시간("오늘", "어제", "N일 전" / "Today", "Yesterday", "N days ago")으로 포맷
 */
export function formatDiaryDateWithRelative(dateStr?: string | null, lang: 'ko' | 'en' = 'ko'): { dateText: string; relativeText: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;

  const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
  const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const dayName = lang === 'en' ? daysEn[d.getDay()] : daysKo[d.getDay()];
  const dateText = lang === 'en' ? `${monthsEn[d.getMonth()]} ${date} (${dayName})` : `${m}월 ${date}일 (${dayName})`;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((todayMidnight - targetMidnight) / (1000 * 60 * 60 * 24));

  let relativeText = '';
  if (lang === 'en') {
    if (diffDays <= 0) {
      relativeText = 'Today';
    } else if (diffDays === 1) {
      relativeText = 'Yesterday';
    } else if (diffDays === 2) {
      relativeText = '2 days ago';
    } else {
      relativeText = `${diffDays} days ago`;
    }
  } else {
    if (diffDays <= 0) {
      relativeText = '오늘';
    } else if (diffDays === 1) {
      relativeText = '어제';
    } else if (diffDays === 2) {
      relativeText = '그저께';
    } else {
      relativeText = `${diffDays}일 전`;
    }
  }

  return { dateText, relativeText };
}

