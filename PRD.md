# [PRD] 아날로그 커플 교환일기: 온기 (Warmth)

> **둘만의 비밀 교환일기 — 서재 책상 위 가죽 양장 다이어리와 편지 봉투**

---

## 1. 프로젝트 요약 (Executive Summary)

- **서비스명**: 온기 (Warmth) — 둘만의 비밀 교환일기
- **타깃 유저**: 아날로그 감성의 소통과 프라이빗한 공간을 선호하는 2인(연인, 절친, 부부)
- **핵심 가치**:
  1. **턴제 교환일기 (Turn-based Diary)**: 메신저의 피로도에서 벗어나, 하루걸러 한 사람이 정성스레 써서 전달하는 느린 호흡의 소통
  2. **데일리 미션 게이트 (Daily Mission Gate)**: 일기를 열람하기 전, 서로의 일상이나 감정을 공유하는 데일리 미션 또는 커스텀 퀴즈 관문
  3. **3초 실링 왁스 롱프레스 (Haptic / Audio Sealed Wax)**: 3초간 꾹 눌러 인장을 녹이고 봉투를 뜯는 아날로그 촉각/청각 마이크로 인터랙션
- **배포 타깃**: Next.js 기반 모바일 반응형 Web App / PWA (향후 Capacitor / 하이브리드 앱 확장)

---

## 2. 디자인 시스템 & 비주얼 가이드 (UI/UX Design System)

### 2.1 콘셉트 & 분위기
- **콘셉트**: *"은은한 스탠드 조명이 켜진 늦은 밤, 서재 책상 위에 놓인 가죽 양장 다이어리와 두툼한 편지 봉투"*
- 클래식 아날로그 질감(종이 질감, 가죽 스티치, 왁스 인장)과 현대적인 미니멀리즘 인터페이스의 결합

### 2.2 컬러 팔레트
| 역할 | 색상명 | Hex Code | 설명 |
| :--- | :--- | :--- | :--- |
| **Background (Main)** | Cream Ivory | `#FDFBF7` | 부드럽고 따뜻한 미색 배경 |
| **Background (Alt)** | Vintage Linen | `#F4EFEA` | 리넨 패브릭 질감의 보조 배경 |
| **Surface / Card** | Warm Paper | `#FFFDF9` | 고급 양장지/편지지 표면 톤 |
| **Border / Line** | Antique Border | `#E6DDD2` | 종이 경계선 및 프레임 라인 |
| **Point 1 (Primary)** | Deep Burgundy Wax | `#6B1724` | 클래식한 버건디 왁스 인장 컬러 |
| **Point 2 (Accent)** | Antique Gold Wax | `#B8860B` | 앤틱 골드 왁스 인장 컬러 |
| **Point 3 (Accent)** | Forest Green Wax | `#2E473B` | 차분한 포레스트 그린 왁스 인장 컬러 |
| **Text (Heading/Body)** | Ink Charcoal | `#2C2A29` | 잉크 만년필로 꾹꾹 눌러쓴 먹색 텍스트 |
| **Text (Caption/Sub)** | Sub Ink | `#78716C` | 연한 먹색의 보조 안내 문구 |

### 2.3 타이포그래피
- **제목 & 일기 본문**: 마루부리(MaruBuri) / KoPubWorld 바탕체 계열 (서정적이고 따뜻한 세리프)
- **UI & 시스템 텍스트**: Pretendard / San-serif (시인성과 조작성을 높인 산세리프)

### 2.4 핵심 인터랙션 (실링 왁스 개봉)
- **동작**: 편지 봉투 중앙의 실링 왁스를 3초간 롱프레스
- **피드백**:
  - **시각**: 터치 시 인장 주변으로 원형 게이지 차오름 $\rightarrow$ 게이지 100% 도달 시 왁스 파쇄 및 봉투 펼침 애니메이션
  - **햅틱 (Android)**: 터치 중 `navigator.vibrate([40])` 지속 $\rightarrow$ 완료 시 `navigator.vibrate([100, 50, 200])`
  - **오디오 & 진동 (iOS/Web fallback)**: Web Audio API 기반의 저음 앰비언스 험(Hum) $\rightarrow$ 파쇄 시 사각사각 깨지는 오디오 이펙트 + CSS 미세 셰이크(`@keyframes shake`)

---

## 3. 핵심 규칙 & 사용자 플로우 (Core Flow & Rules)

```
[방 생성 (6자리 초대코드 발급)]
       │
       ▼
[상대방 코드 입력 & 1:1 페어링 완료]
       │
       ▼
[내 턴: 일기 작성 + 미션/퀴즈 설정 후 '봉인 발송'] ──(FCM 알림)──► [상대방: '봉인된 편지 도착']
                                                                     │
[상대방 턴: 일기 작성 권한 획득] ◄── [실링 왁스 3초 롱프레스] ◄── [오늘의 미션 클리어]
```

1. **페어링 룰**: 방 하나당 인원은 정확히 2명으로 제한, 6자리 난수 코드로 1:1 매칭
2. **턴제 작성 룰**:
   - 하루 한 명만 작성 권한 보유 (`currentTurn`)
   - 일기 본문 + 사진(최대 3장) + 실링 왁스 색상 선택
3. **열람 게이트웨이 룰**:
   - **1차 관문 (미션)**: 매일 요일별 자동 배정 시스템 미션 또는 작성자 커스텀 퀴즈 완수
   - **2차 관문 (실링 왁스)**: 미션 통과 후 봉투 중앙의 실링 왁스를 3초간 꾹 눌러 개봉
4. **페일세이프 (안전장치)**:
   - 미션 변경권: 하루 1회 "다른 미션으로 변경" 가능
   - 퀴즈 힌트: 상대방 커스텀 퀴즈 3회 오답 시 힌트 자동 노출, 24시간 미해결 시 자동 패스 옵션

---

## 4. 데일리 미션 로테이션 (Daily Mission Categories)

- **월/화 (감정/애정)**:
  - 오늘의 다정 쪽지 쓰기 (최소 20자 이상)
  - 오늘 내 감정 날씨 스탬프 찍기
  - 오늘 상대방에게 고마웠던 점 1가지
- **수/목 (시선/일상 공유)**:
  - 지금 내 시야 사진 1장 찍어 올리기
  - 오늘 가장 맛있었던 한 입/음료 사진
  - 오늘의 발끝 체크인 사진
- **금/토 (퀴즈/추억)**:
  - 작성자 TMI 단답형 퀴즈 (작성자가 일기 작성 시 정답 지정)
  - 오늘의 기분 초성 맞히기
  - 텔레파시 밸런스 게임 선택 일치시키기
- **일 (회고/음성)**:
  - 이번 주를 마무리하는 3초 목소리 음성 메시지
  - 상대방을 떠올리며 고른 BGM 한 곡 공유
  - 이번 주 최고의 순간 한 줄 요약

---

## 5. Firebase 아키텍처 & NoSQL 데이터 모델

### 5.1 기술 스택
- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion, Canvas-confetti, Lucide React
- **Auth**: Firebase Authentication (Google, Kakao 간편 로그인)
- **Database**: Cloud Firestore
- **Storage**: Firebase Cloud Storage
- **Serverless**: Cloud Functions for Firebase
- **Notification**: Firebase Cloud Messaging (FCM)

### 5.2 Firestore 데이터 스키마

#### `users/{userId}`
```json
{
  "uid": "USER_AUTH_UID",
  "nickname": "이주형",
  "roomId": "ROOM_DOC_ID",
  "fcmToken": "FCM_DEVICE_TOKEN_STRING",
  "createdAt": "2026-09-27T17:30:00Z"
}
```

#### `rooms/{roomId}`
```json
{
  "roomCode": "829104",
  "status": "MATCHED",
  "members": ["UID_A", "UID_B"],
  "memberInfo": {
    "UID_A": { "nickname": "주형", "role": "CREATOR" },
    "UID_B": { "nickname": "유라", "role": "PARTNER" }
  },
  "currentTurn": "UID_A",
  "latestDiaryId": "DIARY_DOC_ID",
  "createdAt": "2026-09-27T17:30:00Z"
}
```

#### `rooms/{roomId}/diaries/{diaryId}`
```json
{
  "diaryId": "DIARY_UUID",
  "authorId": "UID_A",
  "recipientId": "UID_B",
  "title": "서촌 골목길을 걷다가",
  "content": "오늘 날씨가 정말 선선해서 네 생각이 많이 났어...",
  "photos": [
    "https://firebasestorage.googleapis.com/.../photo1.jpg"
  ],
  "waxColor": "#6B1724",
  "createdAt": "2026-09-27T21:00:00Z",
  "mission": {
    "type": "TEXT",
    "prompt": "오늘 고생한 나에게 다정한 한 줄 응원을 남겨줘 (20자 이상)",
    "quizAnswer": null,
    "isCustom": false,
    "submission": {
      "text": "오늘 하루도 정말 고생 많았어 주형아, 푹 자고 내일 보자!",
      "mediaUrl": null,
      "submittedAt": "2026-09-27T22:15:00Z"
    },
    "isPassed": true
  },
  "isWaxBroken": false,
  "openedAt": null
}
```

#### `system_missions/{missionId}`
```json
{
  "dayOfWeek": "MON",
  "category": "EMOTION",
  "type": "TEXT",
  "prompt": "오늘 하루 고생한 서로에게 20자 이상의 다정한 한 줄 쪽지를 남겨주세요."
}
```

---

## 6. 클라이언트 상태 머신 (UI State Machine)

Firestore의 `onSnapshot` 구독을 통해 아래 4단계 뷰 상태를 실시간 동기화:

1. **`VIEW_WAITING`**: 상대방 턴 진행 중 (대기 편지 봉투 애니메이션)
2. **`VIEW_SEALED_LETTER`**: 새 일기 도착, 미션 미완수 (`isPassed === false`)
3. **`VIEW_WAX_READY`**: 미션 통과 후 봉인 해제 대기 (`isPassed === true && !isWaxBroken`)
4. **`VIEW_OPENED_DIARY`**: 왁스 개봉 완료 (`isWaxBroken === true`), 편지지 오픈 & 본문 열람

---

## 7. 보안 규칙 (Firestore Security Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, update: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      
      match /diaries/{diaryId} {
        allow read: if request.auth != null && 
          request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.members;
        
        allow create: if request.auth != null && 
          request.auth.uid == request.resource.data.authorId;
        
        allow update: if request.auth != null && 
          request.auth.uid == resource.data.recipientId;
      }
    }
    
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
