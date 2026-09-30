/**
 * D-Day and couple relationship anniversary calculations
 */

export interface DaysTogetherInfo {
  days: number;
  formattedStartDate: string;
  startDateIso: string;
  nextMilestone: {
    label: string;
    remainingDays: number;
    targetDays: number;
  } | null;
}

/**
 * 시작일(또는 방 연결일)로부터 오늘까지 며칠째인지 계산 (당일 = 1일 차)
 */
export function calculateDaysTogether(startDateStr?: string | null): DaysTogetherInfo {
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

  const formattedStartDate = `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일`;
  const startDateIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  // 다음 주요 기념일 계산 (100일, 200일, 300일, 1주년(365일), 500일, 2주년(730일), 1000일 등)
  const milestones = [
    { target: 100, label: '100일' },
    { target: 200, label: '200일' },
    { target: 300, label: '300일' },
    { target: 365, label: '1주년' },
    { target: 500, label: '500일' },
    { target: 730, label: '2주년' },
    { target: 1000, label: '1000일' },
  ];

  let nextMilestone: DaysTogetherInfo['nextMilestone'] = null;
  for (const m of milestones) {
    if (m.target >= days) {
      nextMilestone = {
        label: m.label,
        remainingDays: m.target - days,
        targetDays: m.target,
      };
      break;
    }
  }

  return {
    days,
    formattedStartDate,
    startDateIso,
    nextMilestone,
  };
}
