# 💌 온기 (Warmth) — 둘만의 아날로그 비밀 교환일기

<p align="center">
  <img src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=80" alt="Warmth Banner" width="100%" style="border-radius: 20px; max-height: 360px; object-fit: cover;" />
</p>

<p align="center">
  <strong>"서재 책상 위에 놓인 가죽 양장 다이어리와 편지 봉투. 하루걸러 쓰는 턴제 비밀 교환일기"</strong><br />
  인스턴트 메신저의 즉답 피로에서 벗어나, 기다림의 설렘과 손편지의 따스한 온기를 전합니다.
</p>

<p align="center">
  <a href="https://meisteryi.github.io/Warmth/"><img src="https://img.shields.io/badge/Live%20Service-배포%20사이트%20바로가기-8C2131?style=for-the-badge&logo=githubpages&logoColor=white" alt="Live Service" /></a>
  <img src="https://img.shields.io/badge/Next.js%2016-App%20Router-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React%2019-UI-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Capacitor%208-iOS%20%26%20Android-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Canvas-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%20E2EE-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Google%20Gemini-Flash%203.5-8E75C4?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini AI" />
</p>

---

## 📖 서비스 소개 (About Warmth)

> **"소중한 사람들과 실제로 주고받기 위해 만들고 다듬어온 프로덕션 레벨의 웹·모바일 애플리케이션입니다."**

**온기(Warmth)**는 둘만의 6자리 고유 초대코드로 안전하게 연결되어 편지를 번갈아 주고받는 **턴제(Turn-based) 아날로그 교환일기**입니다.  
디지털 화면 속에서도 한 장의 종이를 만지는 듯한 서정적 감성을 위해 **종단간 암호화(E2EE), Web Audio 절차적 사운드, 3D 온기 유리병(왁스·유리구슬), 4대 봉인 해제 관문, Web Push 알림, AI 온기 지수 및 수채화 삽화, iOS/Android 네이티브 패키징** 등 기술적 디테일을 정교하게 녹여냈습니다.

---

## 🌟 핵심 기능 및 사용자 경험 (Key Features)

### ✍️ 인라인 편지쓰기 & 아날로그 커스터마이징
- **상단바 고정 인라인 작성 뷰**: 모달 팝업 대신 서재·설정과 일관된 인라인 탭 흐름으로 집중해서 편지를 작성할 수 있습니다.
- **7종 편지지 스킨 테마**: 아이보리 줄노트, 빈티지 크라프트, 문학 원고지, 항공우편(에어메일), 별밤 네이비, 벚꽃 로즈, 세이지 포레스트 중 분위기에 맞는 편지지를 선택할 수 있습니다.
- **7종 날씨·기분 잉크 도장 & 위치 선택**: 날짜 옆 빈티지 인장 또는 제목 위 대형 스티커 스타일을 선택할 수 있으며, 편지 날짜(오늘/어제/직접 지정)도 자유롭게 설정할 수 있습니다.
- **사진 첨부 & AI 감성 수채화 삽화**: 기기 앨범/카메라 사진을 자동 압축 업로드하거나, 작성한 편지 내용을 바탕으로 **AI 수채화 삽화**를 4단계 진행 시각화와 함께 생성해 첨부할 수 있습니다.
- **AI 오늘의 추천 글감 & 자동 임시저장/이어쓰기**: 캐시·새로고침 기반 오늘의 글감을 바로 적용할 수 있으며, 턴별 실시간 자동 임시저장(탭 이탈 시 즉시 저장 및 대용량 사진 폴백 포함)으로 작성 중이던 편지를 안전하게 이어 쓸 수 있습니다.

### 🕯️ 3초 롱프레스 실링 왁스 (Wax Seal Interaction)
- **커스텀 왁스 색상**: 기본 3종(딥 버건디, 앤틱 골드, 포레스트 그린) 외에 컬러 휠로 원하는 왁스 색상을 직접 선택해 봉인할 수 있습니다.
- 편지 봉투에 찍힌 실링 왁스를 **3초간 길게 누르면(Long-press)** 시각·청각·촉각 피드백과 함께 왁스가 사르르 녹아내리며 편지가 개봉됩니다.
- **Web Audio API 절차적 사운드 합성**: 외부 음원 파일 없이 브라우저 오디오 노드로 왁스 용해 저주파 험(`Melt Hum`), 파열음(`Wax Crack`), 종이 바스락거림, 도장 타격음, 풍경 종소리 및 햅틱 진동을 실시간 합성합니다.

### 🏺 3D 기억의 온기 유리병 (Three.js 3D Memory Jar)
- 편지를 주고받을 때마다 둘만의 추억이 담긴 형형색색의 오브젝트들이 유리병 안으로 사르르 떨어지며 쌓입니다.
- **실링 왁스 & 유리구슬 스타일 전환**: 설정 또는 유리병 화면에서 왁스 조각과 반짝이는 유리구슬 테마를 자유롭게 전환할 수 있습니다.
- **반응형 3D 인터랙션**: 마우스 드래그 및 터치로 유리병을 360도 회전하며 감상할 수 있고, 각 알갱이를 터치하면 해당 일기로 바로 이동합니다. 상단 바 버튼 재클릭으로 홈과 간편하게 토글됩니다.

### 🧩 4대 봉인 해제 관문 (Unlock Mission Gates)
편지를 읽기 전, 상대방이 지정한 다정한 관문을 통과해야만 왁스 봉인을 풀 수 있습니다(긴급 해제 `도와줘!` 지원):
1. **🧩 사진 슬라이딩 퍼즐 (Photo Sliding Puzzle)**: 첨부한 사진이 3×3 조각으로 분리되어 손끝으로 밀어 맞추는 추억 복원 퍼즐.
2. **📮 빈티지 찢긴 우표 직소 퍼즐 (Torn Stamp Puzzle)**: 빈티지 우표가 무작위로 찢겨 흩어지며 탭 회전(90°)과 드래그 결합, 소인 타격으로 완성하는 퍼즐.
3. **❓ AI 감성 추억 퀴즈 (Surprise Memory Quiz)**: 상대방이 이미 읽은 내 최근 편지를 기반으로 Gemini AI가 출제하며, 의미가 통하는 유사 정답도 유연하게 인정합니다.
4. **💞 이심전심 텔레파시 (Telepathy 2-Choice)**: 작성자가 고른 A/B 선택지를 맞추는 2지선다 관문으로, 오답 시 30초 재시도 쿨다운이 적용됩니다.

### 🌡️ Gemini AI 온기 지수 & 감성 해시태그
- **정서적 공기감 분석**: 단순 단어 매칭이 아닌 글 전체의 서사와 감정의 결을 Gemini 모델이 분석하여 **-20.0°C ~ 40.0°C의 온기 온도**를 측정합니다.
- **다정한 한 줄 헌사 & 키워드**: 글의 분위기를 함축한 시적 코멘트와 감성 해시태그를 일기에 새겨주며, API 지연·오프라인 시에도 감성 휴리스틱 폴백을 지원합니다.

### 📮 둘만의 보관된 서재 & 월말 온기 결산 (Monthly Warmth Recap)
- **둘만의 서재**: 서로 주고받은 모든 편지를 날짜별·작성자별로 한눈에 읽어볼 수 있는 아늑한 양장본 서재 인라인 뷰(작성자 교차 정렬 및 미개봉 잠금 카드 지원).
- **매월 말일 종합 결산**: 말일이 되면 그달의 모든 일기를 종합하여 **이달의 평균 온기 지수, 대표 우표, 온도 흐름 SVG 차트, 35mm 빈티지 카메라 필름 롤**을 E2EE 암호화하여 1회 영구 생성·공유합니다.
- **결정론적 35mm 필름 롤**: 상하 스프로킷 구멍이 뚫린 암실 필름 프레임에 그달의 사진들을 시드 기반으로 고정 배치합니다.

### 🏷️ 1:1 독립 포스트잇(Post-it) & 실시간 자동 임시저장
- **방 & 일기 & 작성자별 1:1 격리**: 개봉된 일기마다 개별 부착되는 포스트잇 반응(이모티콘 + 100자 코멘트)으로, 다른 일기나 상대방 화면에 메모가 절대 섞이지 않습니다.
- **기기 재부팅 복구 & 실시간 동기화**: 작성 중 브라우저를 닫아도 메모가 자동 복원되며, 등록·수정 시 상대방에게 실시간 토스트와 웹 푸시 알림이 전달됩니다.
- **미개봉 스포일러 차단**: 상대방이 왁스를 깨기 전까지는 포스트잇 내용과 작성 버튼이 완전히 차단됩니다.

### 🔔 실시간 웹 푸시 & 커스텀 바람 종소리 노크 (Windchime Knock)
- **프리셋 3종 + 직접 작성 노크**: 홈과 답장 대기 화면에서 기본 노크 프리셋 3종 중 하나를 고르거나 직접 문구(최대 60자)를 작성해 보낼 수 있으며, 선택한 문구가 상대방의 **OS 푸시 알림과 인앱 노크 모달에 그대로 표시**됩니다.
- **OS 백그라운드 푸시 알림**: 앱이 닫혀 있어도 새 편지 도착, 편지 개봉, 노크, 포스트잇 반응, 연결 해제 알림이 백그라운드 웹 푸시로 전달됩니다(VAPID 키 자동 회전 감지 및 구독 복구 지원).
- **감성 노크 사운드**: 맑은 윈드차임 풍경 종소리와 함께 부드럽게 소식을 전합니다.

### 🖨️ 소책자 PDF 인쇄 (Booklet Printable)
- 둘만의 기념일(100일, 1주년 등)에 모아둔 일기들을 표지, 목차, 본문 사진이 포함된 정갈한 종이책 레이아웃으로 즉시 인쇄하거나 PDF로 소장할 수 있습니다.

### ⚙️ 설정·프로필·다국어 & 멀티 플랫폼 (PWA / iOS / Android)
- **상단바 고정 설정 탭**: 알림 권한 관리, 사운드 볼륨 조절, 3D 유리병 기본 스타일(왁스/구슬), 다국어 전환(한국어/영어), 내 프로필(닉네임·생년월일) 편집, 초대코드 복사 및 연결 해제를 한곳에서 관리합니다.
- **안전 및 심사 대응 기능**: 부적절한 콘텐츠/포스트잇 신고 및 즉시 가리기(`ReportModal`), 이용약관(`EulaModal`), 개인정보 처리방침(`/privacy`)을 제공합니다.
- **Capacitor 8 네이티브 패키징**: PWA뿐만 아니라 iOS(`.ipa`)와 Android(`.apk`) 네이티브 앱 빌드 및 릴리즈 자동화(`scripts/release.mjs`)를 지원합니다.

---

## 🔄 턴제 교환 흐름도 (State Machine Architecture)

```mermaid
flowchart TD
    A["0. 온보딩 (6자리 초대코드로 1:1 연결)"] --> B["1. 커플 홈 데스크 (D-Day · 상태 카드 · 글감)"]
    B -->|"내 작성 턴"| C["인라인 일기 쓰기 (편지지 · 도장 · 사진/AI삽화 · 관문 · 임시저장)"]
    B -->|"상대방 편지 도착"| D["4대 봉인 해제 관문 (사진퍼즐 / 우표 / AI퀴즈 / 텔레파시)"]
    C -->|"봉인 및 전송"| E["답장 대기 화면 (프리셋·직접작성 노크 지원)"]
    D -->|"관문 통과"| F["3초 롱프레스 실링 왁스 개봉"]
    F -->|"봉인 해제"| G["일기 열람 · 1:1 포스트잇 · AI 온기 온도"]
    G -->|"매일 새벽 04:00 턴 리셋"| B
    B -.-> H["둘만의 서재 (보관함 · 월말 결산 · 소책자 인쇄)"]
    B -.-> I["3D 온기 유리병 (왁스 · 유리구슬 360° 감상)"]
    B -.-> J["설정 탭 (알림 · 사운드 · 언어 · 프로필 · 연결 관리)"]
```

---

## 🛡️ 보안 및 아키텍처 원칙 (Security & Architecture)

1. **종단간 암호화 (E2EE - End-to-End Encryption)**
   - 모든 일기 제목, 본문, 사진, 캡션, 미션, 온기 코멘트, 포스트잇 코멘트, 노크 메시지, 월간 결산은 클라이언트 단에서 방 고유 128비트 솔트(Salt)와 PBKDF2(100,000회) 기반 AES-GCM 256 키로 암호화된 후 Firestore에 저장됩니다.
   - 서버나 데이터베이스 관리자조차 둘만의 비밀 일기를 평문으로 열람할 수 없습니다.

2. **클라이언트 사이드 메모리 마스킹**
   - 아직 왁스를 깨지 않은 미개봉 편지는 개발자 도구(F12 / React 상태)를 통해서도 본문·사진·포스트잇을 엿볼 수 없도록 상태 레벨에서 원천 마스킹됩니다.

3. **원자적 트랜잭션 (Atomic Concurrency Control)**
   - 두 사람이 동시에 편지를 작성하거나 전송하더라도 Firestore `runTransaction`을 통해 턴 충돌(Race Condition)을 방지합니다.

4. **24시간 미매칭 방 자동 만료 및 브루트포스 방어**
   - 5회 연속 잘못된 초대코드 입력 시 30초 쿨다운이 적용되며, 연결되지 않고 24시간 방치된 대기 방은 자동 만료됩니다(매칭된 방은 영구 보존).

---

## 🛠 기술 스택 (Tech Stack)

| 영역 | 기술 스택 | 적용 목적 |
|:---|:---|:---|
| **Frontend Framework** | **Next.js 16 (App Router)** | 고속 컴파일 파이프라인, SSR 및 정적 배포(`output: export`) 양방향 지원 |
| **Language** | **TypeScript 5.x** | 엄격한 인터페이스 정의를 통한 일기 및 상태 머신 무결성 보장 |
| **Styling** | **Tailwind CSS v4 & Vanilla CSS** | 7종 편지지 질감, 앤틱 실링 왁스 셰이딩, 무한 롤링 마키 |
| **3D Graphics** | **Three.js & React Canvas** | 360도 인터랙티브 3D 온기 유리병(실링 왁스 / 유리구슬) 렌더링 |
| **Motion & FX** | **Framer Motion & Canvas-Confetti** | 자연스러운 화면 전환, 모달 애니메이션, 축하 파티클 |
| **Audio Engine** | **Web Audio API** | 저주파 왁스 험, 크랙 타격음, 도장음, 풍경 종소리 절차적 오디오 합성 |
| **Database & Sync** | **Firebase Cloud Firestore** | `onSnapshot` 기반 실시간 1:1 양방향 동기화 및 E2EE 데이터 저장 |
| **AI Engine** | **Google Gemini 3.5 Flash Lite** | 온기 온도 측정, 시적 코멘트, 추억 퀴즈 출제·채점, 추천 글감, 수채화 삽화, 월말 회고록 |
| **Push Notification** | **Web Push API & Service Worker** | 백그라운드 PWA 실시간 푸시 알림 및 VAPID 키 회전 자동 복구 |
| **Mobile Native** | **Capacitor 8 (iOS / Android)** | 네이티브 햅틱, 로컬 알림, `.ipa` / `.apk` 빌드 및 릴리즈 파이프라인 |
| **Deployment & CI/CD** | **Vercel & GitHub Actions** | Vercel 서버리스 호스팅 및 GitHub Pages 정적 배포 이중화 지원 |

---

## 📁 프로젝트 구조 (Directory Structure)

```text
Warmth/
├── .github/workflows/          # GitHub Actions CI/CD 파이프라인 (deploy.yml)
├── public/                     # PWA manifest, 서비스 워커, 앱 아이콘
│   ├── manifest.json           # iOS/Android 홈 화면 PWA 설정
│   └── sw.js                   # 백그라운드 웹 푸시 알림 수신 서비스 워커
├── scripts/
│   └── release.mjs             # 버전 범프, iOS/Android 빌드, GitHub Release 자동화
├── src/
│   ├── app/
│   │   ├── api/                # Gemini AI(/api/gemini) 및 Web Push(/api/push) API
│   │   ├── privacy/            # 개인정보 처리방침 페이지
│   │   ├── globals.css         # 7종 편지지 질감, 명조 폰트, 실링 왁스 애니메이션
│   │   ├── layout.tsx          # 뷰포트, PWA 메타데이터, 다국어 프로바이더
│   │   └── page.tsx            # 메인 상태 머신 오케스트레이터 및 실시간 동기화
│   ├── components/
│   │   ├── ArchiveModal.tsx         # 둘만의 서재 (보관함, 월말 결산, 35mm 필름 롤, 소책자)
│   │   ├── EmptyDeskView.tsx        # 첫 일기 작성 전 아늑한 초기 책상 뷰
│   │   ├── Envelope.tsx             # 앤틱 편지 봉투 및 AIR MAIL 소인 렌더러
│   │   ├── EulaModal.tsx            # 최종 사용자 이용약관 모달
│   │   ├── HomeView.tsx             # 메인 D-Day 카드, 롤링 상태 배너, 빠른 액션
│   │   ├── KnockComposerModal.tsx   # 노크 프리셋 3종 + 직접 작성 모달
│   │   ├── KnockNotificationModal.tsx # 실시간 풍경 종소리 노크 수신 모달
│   │   ├── MissionModal.tsx         # 4대 봉인 해제 관문 통합 모달
│   │   ├── OnboardingView.tsx       # 6자리 초대코드 발급 및 1:1 페어링
│   │   ├── OpenedLetter.tsx         # 양장 다이어리 편지 뷰어, 1:1 포스트잇
│   │   ├── PhotoSlidingPuzzle.tsx   # 3×3 사진 조각 맞추기 관문
│   │   ├── ProfileEditModal.tsx     # 내 닉네임·생년월일 프로필 편집 모달
│   │   ├── ReportModal.tsx          # 유해 콘텐츠·포스트잇 신고 및 차단 모달
│   │   ├── RoomHeader.tsx           # 상단바 (로고, 방코드, 온기 병/서재/설정 토글)
│   │   ├── SettingsView.tsx         # 설정 인라인 뷰 (알림, 볼륨, 유리병 스타일, 언어, 연결 해제)
│   │   ├── StampJigsawPuzzle.tsx    # 4조각 찢김 우표 직소 퍼즐 관문
│   │   ├── WaitingLetter.tsx        # 상대방 턴 대기 화면 (프리셋·직접작성 노크 전송)
│   │   ├── WarmthHanjaIcon.tsx      # 만년필 음각 溫(온) 벡터 아이콘
│   │   ├── WaxSeal.tsx              # 3초 롱프레스 실링 왁스 인터랙션
│   │   └── WriteDiaryModal.tsx      # 인라인 일기 작성, 사진/AI삽화, 관문 지정, 임시저장
│   ├── features/
│   │   └── memory-jar-3d/           # Three.js 기반 3D 온기 유리병 (왁스·유리구슬 물리/렌더링)
│   ├── lib/
│   │   ├── aiClient.ts         # AI 퀴즈·온기·글감 클라이언트 래퍼 및 캐시
│   │   ├── audio.ts            # Web Audio API 절차적 사운드 합성기
│   │   ├── crypto.ts           # 종단간(E2EE) 암호화 및 복호화 엔진
│   │   ├── dateUtils.ts        # 새벽 04:00 기준 턴 판별 및 D-Day 계산기
│   │   ├── firebase.ts         # Firebase SDK 클라이언트 초기화
│   │   ├── gemini.ts           # Gemini AI 감정 분석, 삽화 생성, 월말 회고 내러티브
│   │   ├── haptics.ts          # Capacitor 네이티브 및 웹 햅틱 피드백
│   │   ├── i18n.tsx            # 한국어/영어 다국어 컨텍스트 및 번역 사전
│   │   ├── imageUtils.ts       # 클라이언트 이미지 압축 및 Storage 업로드
│   │   ├── notifications.ts    # 웹 푸시 권한, VAPID 키 회전 및 구독 복구
│   │   ├── roomService.ts      # Firestore 실시간 CRUD 및 원자적 트랜잭션
│   │   ├── scrollUtils.ts      # 뷰 전환 시 스크롤 초기화 유틸리티
│   │   └── secureKeys.ts       # 클라이언트 키/환경변수 안전 접근 헬퍼
│   └── types/
│       └── diary.ts            # 일기, 미션, 반응, 월간 결산 TypeScript 타입 정의
├── firestore.rules             # Firestore 보안 규칙 (데이터 격리 및 인덱싱)
├── next.config.ts              # Next.js 빌드 설정
└── README.md
```

---

## 🚀 로컬 개발 및 실행 (Getting Started)

### 1. 저장소 클론 및 의존성 설치
```bash
git clone https://github.com/meisteryi/Warmth.git
cd Warmth
npm install
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 아래 설정값을 입력합니다:

```env
# FIREBASE CONFIG
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# GEMINI AI
GEMINI_API_KEY=your_gemini_api_key

# WEB PUSH VAPID KEYS
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your_email@example.com
```

### 3. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속하여 즉시 테스트할 수 있습니다.

### 4. 코드 품질 검증 및 프로덕션 빌드
```bash
# ESLint & TypeScript 타입 검사
npm run lint
npx tsc --noEmit

# Next.js 프로덕션 빌드
npm run build
```

---

## 📬 제작자 정보 (Creator & Contact)

- **Developer**: 이주형 (Joohyoung Yi / meisteryi)
- **Email**: [yjh020701@gmail.com](mailto:yjh020701@gmail.com)
- **GitHub**: [@meisteryi](https://github.com/meisteryi)
- **Live Service**: [https://meisteryi.github.io/Warmth/](https://meisteryi.github.io/Warmth/)

---

## 📜 라이선스 (License)

This project is licensed under the MIT License.  
Copyright (c) 2026 Joohyoung Yi (meisteryi). All rights reserved.
