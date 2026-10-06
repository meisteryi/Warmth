'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ko' | 'en';

export const translations = {
  ko: {
    // 헤더 및 네비게이션
    'app.title': '온기',
    'app.subtitle': '둘만의 다정한 아날로그 교환일기',
    'nav.home': '홈',
    'nav.archive': '서재',
    'nav.write': '일기 쓰기',
    'nav.waiting': '답장 대기',
    'nav.reset': '04시 리셋',
    'nav.more': '더보기 설정',

    // 더보기 메뉴
    'menu.profile': '내 프로필 편집',
    'menu.roomCode': '연결된 일기장 방 코드',
    'menu.copy': '복사',
    'menu.copied': '복사됨',
    'menu.pushNotification': '새 일기/노크 알림',
    'menu.notificationOn': '켜짐',
    'menu.notificationEnable': '알림 켜기',
    'menu.volume': '효과음 볼륨',
    'menu.language': '언어 / Language',
    'menu.safariNotice': 'Safari 7일 미접속 초기화 방지를 위해 ‘홈 화면에 추가’를 권장합니다.',
    'menu.leaveRoom': '일기장 연결 해제 (방 나가기)',

    // 홈 화면: D-Day 카드
    'home.togetherDaysPrefix': '우리가 온기로 이어진 지',
    'home.daysUnit': '일 차',
    'home.togetherSince': '{date}부터 함께',
    'home.dailyReset': '매일 04:00 리셋',
    'home.quotaAvailableFull': '오늘 작성 가능 ({time} 남음)',
    'home.quotaAvailableShort': '작성 가능 ({time})',
    'home.quotaUsedFull': '오늘 작성 완료 (다음 편지까지 {time})',
    'home.quotaUsedShort': '작성 완료 ({time})',

    // 홈 화면: 오늘의 교환일기 카드
    'home.widgetTitle': '오늘의 교환일기',
    'home.status.sealedArrived': '{partner} 님이 보낸 비밀 편지 도착',
    'home.status.unopened': '{partner} 님이 아직 편지를 읽지 않음 (미개봉)',
    'home.status.waitingReply': '{partner} 님이 편지를 읽음 (답장 대기 중)',
    'home.status.quotaUsed': '오늘 나의 온기 작성 완료 (새벽 04시 리셋)',
    'home.status.myTurn': '내가 오늘 편지를 쓸 차례',
    'home.status.partnerTurn': '{partner} 님의 오늘 작성 차례',

    // 홈 화면: 상태 뱃지
    'badge.sealedArrived': '새 편지 도착 📬',
    'badge.unopened': '상대방 미개봉 ✉️',
    'badge.waitingReply': '상대방 답장 대기 ⏳',
    'badge.quotaUsed': '오늘 작성 완료 🌙',
    'badge.myTurn': '내 턴 ✍️',
    'badge.partnerTurn': '상대방 턴 ⏳',

    // 홈 화면: 마지막 일기 안내 바
    'home.lastDiaryLabel': '우리의 마지막 일기 :',
    'home.lastDiaryEmpty': '아직 없음 ✉️',
    'relative.today': '오늘',
    'relative.yesterday': '어제',
    'relative.dayBeforeYesterday': '그저께',
    'relative.daysAgo': '{days}일 전',

    // 홈 화면: 편지 액션 카드
    'action.openSealed': '편지 열어보기',
    'action.checkMyLetter': '내가 보낸 편지 확인하기',
    'action.sendKnock': '은은한 노크 보내기 ✉️',
    'action.knockSent': '노크 보냄 ✨',
    'action.letterDesc.sealedArrived': '{partner} 님이 보낸 비밀 편지가 도착했어요!',
    'action.letterDesc.sealedSub': '관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.',
    'action.letterDesc.unopened': '{partner} 님이 아직 편지를 읽지 않았어요',
    'action.letterDesc.unopenedSub': '내가 보낸 편지가 안전하게 봉인되어 상대방의 확인을 기다리고 있습니다.',
    'action.letterDesc.waitingReply': '{partner} 님이 편지를 열어보았어요! 답장을 기다려주세요.',
    'action.letterDesc.waitingReplySub': '상대방이 답장을 보내면 다음 편지를 작성할 수 있습니다.',
    'action.notice.lock': '상대방이 편지를 확인하고 답장을 보내기 전까지는 새 일기를 작성할 수 없습니다.',

    // 홈 화면: 글감 및 서재 카드
    'topic.title': '오늘의 다정한 글감',
    'topic.writeWithTopic': '이 글감으로 일기 쓰기',
    'topic.refresh': '다른 글감 뽑기',
    'archiveCard.title': '둘만의 비밀 서재',
    'archiveCard.sub': '주고받은 지난 편지들을 언제든 꺼내볼 수 있어요.',
    'archiveCard.btn': '지난 편지 모아보기',

    // 일기 작성 모달
    'write.title': '새 교환일기 쓰기',
    'write.titlePlaceholder': '오늘의 일기 제목...',
    'write.contentPlaceholder': '오늘 하루 서로에게 건네고 싶은 다정한 이야기를 적어보세요...',
    'write.selectWax': '실링 왁스 인장 색상',
    'write.selectStamp': '오늘의 우표 스탬프',
    'write.selectMission': '상대방이 열람할 봉인 관문 미션',
    'write.mission.puzzlePhoto': '📸 사진 직소 퍼즐',
    'write.mission.puzzleStamp': '📮 우표 직소 퍼즐',
    'write.mission.aiQuiz': '💡 지난 편지 회상 퀴즈 (AI)',
    'write.mission.system': '✨ 오늘의 온기 질문',
    'write.btn.save': '편지 봉인하고 보내기',
    'write.btn.draftRestore': '작성 중이던 임시 저장본이 있습니다. 복원하시겠습니까?',
    'write.draftSaved': '초안 저장됨',

    // 서재 모달
    'archive.title': '둘만의 보관된 서재',
    'archive.tab.list': '일기 목록',
    'archive.tab.report': '월간 온기 리포트',
    'archive.tab.booklet': '소책자 PDF / 인쇄',
    'archive.empty': '아직 보관된 일기가 없습니다',
    'archive.emptySub': '서로 주고받은 일기가 이곳에 소중히 보관됩니다.',
    'archive.secretLetter': '{name} 님이 보낸 비밀 편지',
    'archive.secretMasked': '실링 왁스로 봉인되어 있습니다. 메인 화면에서 관문을 풀고 왁스를 녹여 소중한 온기를 확인해 보세요.',
    'archive.unopenedByMe': '미개봉 비밀 편지',
    'archive.openOnMain': '메인에서 개봉하기',
    'archive.readDiary': '열람하기',
    'archive.loadMore': '📜 더 많은 지난 편지 불러오기 (+10건)',
    'archive.loading': '보관된 일기를 불러오는 중입니다...',
    'archive.loadFailed': '일기를 불러오지 못했습니다',
    'archive.retry': '다시 시도하기',

    // 열람 화면
    'opened.replyBtn': '답장 쓰기',
    'opened.waitingReply': '⏳ {name} 님의 답장을 기다리는 중입니다',
    'opened.backHome': '← 홈 화면으로',
    'opened.warmthTemp': '온기 지수',

    // 프로필 편집 모달
    'profile.title': '프로필 정보 수정',
    'profile.nameLabel': '내 닉네임',
    'profile.birthLabel': '내 생년월일 (선택)',
    'profile.saveBtn': '저장하기',
    'profile.saving': '저장 중...',

    // 온보딩
    'onboarding.title': '온기 (Warmth)',
    'onboarding.subtitle': '둘만의 아늑한 비밀 교환일기',
    'onboarding.createRoom': '새 일기장 방 만들기',
    'onboarding.joinRoom': '초대 코드로 참여하기',
    'onboarding.enterCode': '6자리 초대 코드 입력',
    'onboarding.start': '시작하기',

    // 공통
    'common.close': '닫기',
    'common.cancel': '취소',
    'common.confirm': '확인',
  },
  en: {
    // Header & Navigation
    'app.title': 'Warmth',
    'app.subtitle': 'An intimate analogue exchange journal for two',
    'nav.home': 'Home',
    'nav.archive': 'Library',
    'nav.write': 'Write',
    'nav.waiting': 'Waiting',
    'nav.reset': '04:00 Reset',
    'nav.more': 'Settings',

    // More Menu
    'menu.profile': 'Edit Profile',
    'menu.roomCode': 'Journal Room Code',
    'menu.copy': 'Copy',
    'menu.copied': 'Copied',
    'menu.pushNotification': 'New Letter & Knock Alerts',
    'menu.notificationOn': 'On',
    'menu.notificationEnable': 'Turn On',
    'menu.volume': 'Sound Volume',
    'menu.language': 'Language / 언어',
    'menu.safariNotice': 'Add to Home Screen to prevent Safari 7-day storage resets.',
    'menu.leaveRoom': 'Disconnect Journal (Leave Room)',

    // Home View: D-Day Card
    'home.togetherDaysPrefix': 'Connected in warmth for',
    'home.daysUnit': 'Days',
    'home.togetherSince': 'Together since {date}',
    'home.dailyReset': 'Resets daily at 04:00',
    'home.quotaAvailableFull': 'Ready to write today ({time} left)',
    'home.quotaAvailableShort': 'Ready ({time})',
    'home.quotaUsedFull': 'Written for today ({time} until next)',
    'home.quotaUsedShort': 'Written ({time})',

    // Home View: Today's Exchange Diary Card
    'home.widgetTitle': "Today's Exchange Letter",
    'home.status.sealedArrived': 'A sealed letter arrived from {partner}',
    'home.status.unopened': '{partner} hasn’t opened your letter yet',
    'home.status.waitingReply': '{partner} read your letter (Awaiting reply)',
    'home.status.quotaUsed': "Today's letter completed (Resets at 04:00 AM)",
    'home.status.myTurn': 'Your turn to write today',
    'home.status.partnerTurn': "It's {partner}'s turn to write",

    // Home View: Status Badges
    'badge.sealedArrived': 'New Letter 📬',
    'badge.unopened': 'Unopened ✉️',
    'badge.waitingReply': 'Awaiting Reply ⏳',
    'badge.quotaUsed': 'Done Today 🌙',
    'badge.myTurn': 'My Turn ✍️',
    'badge.partnerTurn': 'Partner Turn ⏳',

    // Home View: Last Diary Bar
    'home.lastDiaryLabel': 'Our last letter :',
    'home.lastDiaryEmpty': 'None yet ✉️',
    'relative.today': 'Today',
    'relative.yesterday': 'Yesterday',
    'relative.dayBeforeYesterday': '2 days ago',
    'relative.daysAgo': '{days} days ago',

    // Home View: Action Cards
    'action.openSealed': 'Open Letter',
    'action.checkMyLetter': 'View My Letter',
    'action.sendKnock': 'Send a Knock ✉️',
    'action.knockSent': 'Knocked ✨',
    'action.letterDesc.sealedArrived': 'A secret sealed letter arrived from {partner}!',
    'action.letterDesc.sealedSub': 'Solve the mission and melt the wax seal to reveal the warmth.',
    'action.letterDesc.unopened': '{partner} hasn’t opened your letter yet',
    'action.letterDesc.unopenedSub': 'Your letter is safely sealed and awaiting your partner’s discovery.',
    'action.letterDesc.waitingReply': '{partner} opened your letter! Please wait for their reply.',
    'action.letterDesc.waitingReplySub': 'You can write your next letter once your partner replies.',
    'action.notice.lock': 'You cannot write a new letter until your partner reads and replies.',

    // Home View: Topic & Archive Cards
    'topic.title': "Today's Gentle Topic",
    'topic.writeWithTopic': 'Write With This Topic',
    'topic.refresh': 'Get Another Topic',
    'archiveCard.title': 'Our Secret Library',
    'archiveCard.sub': 'Revisit all the letters and warm memories you shared.',
    'archiveCard.btn': 'Browse Past Letters',

    // Write Diary Modal
    'write.title': 'Write Exchange Letter',
    'write.titlePlaceholder': "Today's letter title...",
    'write.contentPlaceholder': 'Write down your heartfelt thoughts and everyday moments...',
    'write.selectWax': 'Wax Seal Color',
    'write.selectStamp': 'Weather Stamp',
    'write.selectMission': 'Unlock Mission for Partner',
    'write.mission.puzzlePhoto': '📸 Photo Sliding Puzzle',
    'write.mission.puzzleStamp': '📮 Stamp Jigsaw Puzzle',
    'write.mission.aiQuiz': '💡 Memory Quiz (AI)',
    'write.mission.system': '✨ Warmth Prompt',
    'write.btn.save': 'Seal & Send Letter',
    'write.btn.draftRestore': 'A saved draft was found. Would you like to restore it?',
    'write.draftSaved': 'Draft Saved',

    // Archive Modal
    'archive.title': 'Our Shared Library',
    'archive.tab.list': 'Letter List',
    'archive.tab.report': 'Warmth Report',
    'archive.tab.booklet': 'Booklet PDF / Print',
    'archive.empty': 'No letters archived yet',
    'archive.emptySub': 'Exchanged letters will be preserved here safely.',
    'archive.secretLetter': 'Secret letter from {name}',
    'archive.secretMasked': 'Sealed with wax. Solve the mission on the home screen to uncover the letter.',
    'archive.unopenedByMe': 'Sealed Secret Letter',
    'archive.openOnMain': 'Open on Home Screen',
    'archive.readDiary': 'Read Letter',
    'archive.loadMore': '📜 Load More Letters (+10)',
    'archive.loading': 'Loading archived letters...',
    'archive.loadFailed': 'Failed to load letters',
    'archive.retry': 'Try Again',

    // Opened Letter View
    'opened.replyBtn': 'Write Reply',
    'opened.waitingReply': '⏳ Awaiting reply from {name}',
    'opened.backHome': '← Back to Home',
    'opened.warmthTemp': 'Warmth Index',

    // Profile Edit Modal
    'profile.title': 'Edit Profile',
    'profile.nameLabel': 'My Nickname',
    'profile.birthLabel': 'My Birthday (Optional)',
    'profile.saveBtn': 'Save Changes',
    'profile.saving': 'Saving...',

    // Onboarding
    'onboarding.title': 'Warmth',
    'onboarding.subtitle': 'An intimate exchange journal for two',
    'onboarding.createRoom': 'Create New Journal Room',
    'onboarding.joinRoom': 'Join With Invite Code',
    'onboarding.enterCode': 'Enter 6-digit code',
    'onboarding.start': 'Get Started',

    // Common
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
  },
} as const;

export type TranslationKey = keyof typeof translations.ko;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ko',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'warmth_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ko');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === 'ko' || saved === 'en') {
        setLanguageState(saved);
        if (typeof document !== 'undefined') {
          document.documentElement.lang = saved;
        }
      } else {
        // 기본 언어는 항상 한국어('ko')로 시작
        setLanguageState('ko');
        if (typeof document !== 'undefined') {
          document.documentElement.lang = 'ko';
        }
      }
    } catch {}
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ko' ? 'en' : 'ko');
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.ko;
    let text: string = dict[key] || translations.ko[key] || key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
