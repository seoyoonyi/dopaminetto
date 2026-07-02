# Dopaminetto

[![preview](https://gist.github.com/user-attachments/assets/fc5eda72-cfde-40d3-b5fb-9d7d8280bf7b)](https://github.com/user-attachments/assets/54e387cc-c4a8-4aa8-b027-f5eea4c8005a)

## 📄 개요

Dopaminetto는 글또 커뮤니티를 위한 2D 타운 기반 실시간 커뮤니케이션 MVP입니다.

사용자는 익명 닉네임으로 타운에 입장해 캐릭터를 이동하고, 빌리지 단위로 채팅하며, 접속자 상태와 1인 방송자 기준의 음성 기능을 확인할 수 있습니다. Tiled 기반 맵 렌더링, Supabase Realtime, Cloudflare RealtimeKit을 활용해 작은 온라인 모임 공간에서 기본적인 상호작용이 가능하도록 하는 것을 목표로 합니다.

---

## ✨ 주요 기능

- 익명 닉네임으로 홈에서 타운에 진입할 수 있습니다.
- 같은 브라우저에서 타운을 중복 탭으로 여는 상황을 제한합니다.
- Tiled 기반 타운 맵을 렌더링하고, 캐릭터 이동과 충돌 판정을 처리합니다.
- 빌리지 영역 기준으로 현재 위치와 채팅 채널을 관리합니다.
- 접속자 패널에서 현재 참여자와 음성 상태를 확인할 수 있습니다.
- 입장/퇴장 토스트로 다른 사용자의 접속 상태 변화를 안내합니다.
- Cloudflare RealtimeKit 기반 1인 방송자 음성 기능을 제공합니다.

---

## 🚀 시작하기

프로젝트를 로컬 환경에서 실행하려면 아래 단계를 따르세요.

### 의존성 설치

```bash
npm install
```

### 필수 환경변수

프로젝트 루트의 `.env.local.example` 파일을 `.env.local`로 복사하고 다음 값들을 설정하세요:

```env.local
# Supabase Configuration (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Cloudflare Configuration (음성 채팅용)
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_REALTIME_APP_ID=your-realtime-app-id
CLOUDFLARE_REALTIME_MEETING_ID=your-realtime-meeting-id

# Speaker Configuration
NEXT_PUBLIC_SPEAKER_NICKNAME=your-speaker-nickname

# Development Configuration
NODE_ENV=development
```

### 개발 서버 실행

```bash
npm run dev
```

이제 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 프로젝트를 확인할 수 있습니다.

### 검증 명령

```bash
npm test
npm run type-check
npm run build
```

---

## ⚠️ 주의사항

### WebRTC 솔루션 선택 이유

- **P2P 방식 불가**: 40~50명 동시 접속 시 각자 49개 연결 필요 (총 1,225개 연결)
- **SFU 필수**: 서버 중계 방식으로 확장성 확보
- **Cloudflare RealtimeKit 선택**: 비용과 편의성 고려

### 익명 접속 구현

- 회원가입 없이 UUID 기반 사용자 식별
- 로컬 스토리지를 통한 세션 유지
- 임시 닉네임 유저가 생성
- Supabase `user.id`를 우선 사용하되, 아직 값이 없을 때는 클라이언트(`user-storage` 스토어)가 `uuid`로 임시 `userId`를 생성해 동일 브라우저/탭에서 일관된 식별자를 유지합니다.

### Supabase 익명 인증 활성화

- 이 프로젝트는 회원가입 없이 익명으로 서비스를 이용할 수 있습니다.
- 프로젝트에서 익명 인증을 사용하려면 다음 단계를 따르세요.
  1.  Supabase 대시보드에 로그인하여 프로젝트를 선택합니다.
  2.  왼쪽 사이드바에서 **Authentication** 메뉴로 이동합니다.
  3.  **Sign In / Providers** 섹션을 클릭합니다.
  4.  **Anonymous** 옵션을 활성화(enable)하고 저장합니다.

[Supabase Anonymous 활성화 스크린샷](https://gist.github.com/user-attachments/assets/c753a45d-c15b-4731-9dff-2e6513545990)

**중요**: 익명 사용자는 `authenticated` 역할을 부여받습니다. 데이터베이스
접근 제어를 위해 RLS(Row-Level Security) 정책을 반드시 검토하고, 필요한 경우
`is_anonymous` 필드를 확인하여 익명 사용자와 일반 사용자를 구분하는 정책을 추가해야 합니다.

---

## 🏗️ 기술 스택

### Frontend

- **Framework**: Next.js 15.5.10 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

### Backend & Database

- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime (채팅, 시그널링)
- **Authentication**: 익명 접속 (회원가입 불필요)

### WebRTC & Voice Chat

- **Voice SDK/API**: Cloudflare RealtimeKit
- **Voice Transport**: SFU 기반 WebRTC
- **User Identification**: UUID 기반 익명 사용자

### Game Engine

- **2D Game Engine**: Phaser 3
- **Rendering**: Phaser Renderer (WebGL, Canvas fallback)

### State Management

- **Global State**: Zustand
- **Server State**: TanStack React Query

---

## 🎨 디자인 시스템

- shadcn/ui `new-york` 스타일을 기준으로 공용 UI 컴포넌트를 구성합니다.
- Radix UI primitive를 기반으로 접근성 동작을 확보하고, 스타일은 Tailwind CSS v4와 CSS variable 토큰으로 관리합니다.
- 색상, radius, 폰트 토큰은 `src/app/globals.css`의 `:root`, `@theme inline`에 정의되어 있습니다.
- 공용 UI 컴포넌트는 `src/shared/ui/`에 배치하며, 현재 button, input, textarea, card, dialog, popover, tooltip, avatar, scroll-area, carousel, sonner, spinner 등을 사용합니다.
- 버튼 variant와 size 같은 UI 변형은 `class-variance-authority`와 `tailwind-merge` 기반의 `cn` 유틸리티로 조합합니다.
- 아이콘은 `components.json` 기준 `lucide`를 사용합니다.

---

## 🧱 설계 원칙

- 모든 구현은 SOLID 원칙을 따르며 책임을 분리합니다.
- 클린 코드 규칙을 지켜 명확하고 유지보수 가능한 구조를 유지합니다.
- 비즈니스 로직과 UI를 분리하여 테스트와 확장성을 확보합니다.

---

## 📁 FSD 폴더 구조

- 기능별로 FSD 레이어(entities, features, widgets, shared)로 나누어 책임을 분리합니다.
- 설계 원칙에 따라 비즈니스 로직과 UI를 명확히 구분하고, 필요한 경우 배럴(index.ts)을 활용해 공용 진입점을 제공합니다.

<details>
<summary>📂 프로젝트 폴더 구조 보기</summary>

```text
📦src
 ┣ 📂app              # Next.js App Router (페이지 라우팅 및 진입점)
 ┃ ┣ 📂api            # 서버 사이드 API 라우트
 ┃ ┣ 📂providers      # 전역 컨텍스트 프로바이더
 ┃ ┗ 📂town           # 메인 게임 타운 페이지 경로
 ┣ 📂entities         # 비즈니스 엔티티
 ┃ ┣ 📂player         # 플레이어 모델
 ┃ ┗ 📂village        # 빌리지/맵 설정과 로더
 ┣ 📂features         # 기능 단위 (비즈니스 로직)
 ┃ ┣ 📂auth           # 인증 관련
 ┃ ┣ 📂chat           # 채팅 기능
 ┃ ┣ 📂movement       # 이동, 위치 복원, 맵 로딩
 ┃ ┣ 📂panelToggle    # 패널 토글
 ┃ ┣ 📂presence       # 접속 상태
 ┃ ┣ 📂roomSwitch     # 방 이동
 ┃ ┣ 📂singleTownTab  # 단일 타운 탭 입장 제한
 ┃ ┗ 📂voiceChat      # 음성 채팅
 ┣ 📂widgets          # 독립적인 UI 블록
 ┃ ┣ 📂chatPanel      # 채팅 패널
 ┃ ┣ 📂gameCanvas     # 게임 캔버스
 ┃ ┣ 📂home           # 홈 진입 화면
 ┃ ┣ 📂roomLayout     # 방 레이아웃
 ┃ ┣ 📂townPageContent # 타운 페이지 콘텐츠
 ┃ ┣ 📂townToolbar    # 하단 툴바
 ┃ ┣ 📂townVoiceSection # 음성 채팅 영역
 ┃ ┗ 📂usersPanel     # 접속자 패널
 ┗ 📂shared           # 공용 모듈
   ┣ 📂config         # 환경 설정
   ┣ 📂hooks          # 공용 훅
   ┣ 📂lib            # 유틸리티
   ┣ 📂store          # 전역 상태
   ┣ 📂types          # 공용 타입
   ┗ 📂ui             # 공용 UI 컴포넌트
```

</details>

---

## ⚙️ 기본 설정 요약

- `.env.local.example`을 복사해 `.env.local`을 생성하고 실 서비스 키를 입력합니다.
- Supabase 익명 접속과 Cloudflare RealtimeKit 설정을 환경변수로 구성합니다.
- Supabase Provider, Zustand 스토어, Phaser 엔진 등을 초기화하는 Provider 계층을 `src/app/providers/`에 배치합니다.
- 상태 관리는 React Query(@tanstack/react-query)로 서버 데이터, Zustand로 클라이언트 상태를 관리합니다.

---

## 🔧 Providers 구조

### App Layer Providers (`src/app/providers/`)

애플리케이션 전체에서 사용하는 프로바이더들을 관리합니다.

#### 필요한 프로바이더들

| 프로바이더         | 용도                        | 라이브러리            | 특징                 |
| ------------------ | --------------------------- | --------------------- | -------------------- |
| `QueryProvider`    | 서버 상태 관리 및 캐싱      | @tanstack/react-query | 전역 쿼리 클라이언트 |
| `SupabaseProvider` | 데이터베이스 및 실시간 기능 | @supabase/ssr         | 익명 접속, SSR 지원  |
| `AppProviders`     | 모든 프로바이더 통합        | -                     | 계층적 구조          |

---

## 🔧 주요 라이브러리 역할

| 패키지                             | 용도                               |
| ---------------------------------- | ---------------------------------- |
| `@supabase/ssr`                    | Supabase SSR 지원                  |
| `@supabase/supabase-js`            | Supabase 클라이언트 SDK            |
| `@cloudflare/realtimekit-react`    | Cloudflare 음성 채팅 React SDK     |
| `@cloudflare/realtimekit-react-ui` | Cloudflare 음성 채팅 UI 컴포넌트   |
| `@radix-ui/react-*`                | shadcn/ui 기반 접근성 UI primitive |
| `zustand`                          | 경량 상태 관리 라이브러리          |
| `@tanstack/react-query`            | 서버 상태 관리 및 캐싱             |
| `phaser`                           | 2D 게임 엔진 (WebGL/Canvas 렌더링) |
| `uuid`                             | 익명 사용자 고유 식별자 생성       |
| `class-variance-authority`         | UI 컴포넌트 variant 스타일 관리    |
| `clsx`                             | 조건부 className 조합              |
| `tailwind-merge`                   | Tailwind CSS 클래스 병합 유틸리티  |
| `embla-carousel-react`             | 반응형 캐러셀 컴포넌트             |
| `lucide-react`                     | 아이콘 라이브러리                  |
| `sonner`                           | 토스트 알림 UI                     |

### 개발/검증 도구

| 패키지        | 용도                                    |
| ------------- | --------------------------------------- |
| `typescript`  | 정적 타입 검사                          |
| `vitest`      | 단위 테스트 실행                        |
| `eslint`      | 코드 품질 검사와 자동 수정              |
| `husky`       | Git hook 실행                           |
| `lint-staged` | staged 파일 대상 pre-commit 검사/포맷팅 |

---

## 🔌 환경 및 프로바이더 체크리스트

- `.env.local.example`을 복사하여 `.env.local`을 만들고 Supabase, Cloudflare RealtimeKit, speaker 닉네임, NODE_ENV 값을 실제 키로 설정합니다.
- React Query(`@tanstack/react-query`), Supabase(`@supabase/supabase-js`, `@supabase/ssr`), Zustand, Phaser 등 주요 라이브러리가 `src/app/providers/` 내부에서 초기화됩니다.
- 필요한 프로바이더는 `QueryProvider`, `SupabaseProvider`, `AppProviders`이며, Supabase는 익명 접속·SSR·Realtime을 지원하고 AppProviders가 전체 계층을 감쌉니다.
- 상태 관리는 React Query가 서버 데이터를, Zustand가 클라이언트 상태를 담당하며, 관련 스토어는 FSD 레이어별 `model/store`에 배치합니다.
- Cloudflare RealtimeKit, Phaser 게임 엔진 설정, Supabase Realtime 설정 등은 위 구성이 정상적으로 작동할 수 있도록 환경변수, provider hooks, `AppProviders` 계층에서 연결합니다.

---

## 📚 참고 자료

- [Next.js 공식 문서](https://nextjs.org/docs)
- [TypeScript 공식 문서](https://www.typescriptlang.org/docs/)
- [FSD 아키텍처 가이드](https://feature-sliced.design/)
- [shadcn/ui 문서](https://ui.shadcn.com/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [Radix Primitives 문서](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Supabase Realtime 가이드](https://supabase.com/docs/guides/realtime)
- [Cloudflare RealtimeKit 문서](https://developers.cloudflare.com/realtime/realtimekit/)
- [Phaser 공식 문서](https://docs.phaser.io/phaser/getting-started/what-is-phaser)
- [TanStack Query React 문서](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Zustand 문서](https://zustand.docs.pmnd.rs/)
- [Embla Carousel React 문서](https://www.embla-carousel.com/docs/v8/get-started/react)
- [Sonner 문서](https://sonner.emilkowal.ski/)
- [Lucide React 문서](https://lucide.dev/guide/react)
