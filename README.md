# Dopaminetto

## 📄 개요

게더타운이 종료된다는 말에 괜히 아쉬운 마음이 들더라고요.
그래서 “이왕 이렇게 된 거, **우리(글또)의 작은 음성·텍스트 채팅 MVP라도 만들어볼까?**” 싶어서
가볍게 시작해본 프로젝트입니다!

---

## 🚀 시작하기

프로젝트를 로컬 환경에서 실행하려면 아래 단계를 따르세요.

### 의존성 설치

```bash
npm install
```

### 필수 환경변수

프로젝트 루트에 `.env.local.ex` 파일을 `.env.local`로 복사하고 다음 값들을 설정하세요:

```env.local
# Supabase Configuration (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Cloudflare Configuration (음성 채팅용)
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_CALLS_APP_ID=your-calls-app-id

# Development Configuration
NODE_ENV=development
```

### 개발 서버 실행

```bash
npm run dev
```

이제 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 프로젝트를 확인할 수 있습니다.

---

## ⚠️ 주의사항

### WebRTC 솔루션 선택 이유

- **P2P 방식 불가**: 40~50명 동시 접속 시 각자 49개 연결 필요 (총 1,225개 연결)
- **SFU 필수**: 서버 중계 방식으로 확장성 확보
- **Cloudflare Realtime 선택**: 비용과 편의성 고려

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

- **Framework**: Next.js 15.5.3 with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

### Backend & Database

- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime (채팅, 시그널링)
- **Authentication**: 익명 접속 (회원가입 불필요)

### WebRTC & Voice Chat

- **SFU Solution**: Cloudflare Realtime + SFU
- **User Identification**: UUID 기반 익명 사용자

### Game Engine

- **2D Game Engine**: Phaser 3
- **Canvas Rendering**: WebGL/Canvas API

### State Management

- **Global State**: Zustand
- **Server State**: TanStack React Query

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
 ┃ ┣ 📂api            # 서버 사이드 API 라우트 (예정)
 ┃ ┣ 📂providers      # 전역 컨텍스트 프로바이더
 ┃ ┗ 📂town           # 메인 게임 타운 페이지 경로
 ┣ 📂entities         # 비즈니스 엔티티 (예정)
 ┃ ┣ 📂player         # 플레이어 모델
 ┃ ┗ 📂room           # 방(Room) 모델
 ┣ 📂features         # 기능 단위 (비즈니스 로직)
 ┃ ┣ 📂auth           # 인증 관련
 ┃ ┣ 📂chat           # 채팅 기능
 ┃ ┣ 📂movement       # 이동 로직 (예정)
 ┃ ┣ 📂panelToggle    # 패널 토글
 ┃ ┣ 📂presence       # 접속 상태
 ┃ ┣ 📂room-switch    # 방 이동 (예정)
 ┃ ┗ 📂voice          # 음성 채팅 (예정)
 ┣ 📂widgets          # 독립적인 UI 블록
 ┃ ┣ 📂chatPanel      # 채팅 패널
 ┃ ┣ 📂gameCanvas     # 게임 캔버스 (예정)
 ┃ ┣ 📂roomLayout     # 방 레이아웃 (예정)
 ┃ ┣ 📂townToolbar    # 하단 툴바
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
- Supabase 익명 접속, Cloudflare Realtime, Cloudflare Calls 설정을 환경변수로 구성합니다.
- React Query DevTools, Supabase Provider, Zustand 스토어, Phaser 엔진 등을 초기화하는 Provider 계층을 `src/app/providers/`에 배치합니다.
- 상태 관리는 React Query(@tanstack/react-query)로 서버 데이터, Zustand로 클라이언트 상태를 관리합니다.

---

## 🔧 Providers 구조

### App Layer Providers (`src/app/providers/`)

애플리케이션 전체에서 사용하는 프로바이더들을 관리합니다.

#### 필요한 프로바이더들

| 프로바이더         | 용도                        | 라이브러리            | 특징                |
| ------------------ | --------------------------- | --------------------- | ------------------- |
| `QueryProvider`    | 서버 상태 관리 및 캐싱      | @tanstack/react-query | DevTools 포함       |
| `SupabaseProvider` | 데이터베이스 및 실시간 기능 | @supabase/ssr         | 익명 접속, SSR 지원 |
| `AppProviders`     | 모든 프로바이더 통합        | -                     | 계층적 구조         |

---

## 🔧 주요 라이브러리 역할

| 패키지                           | 용도                                  |
| -------------------------------- | ------------------------------------- |
| `@supabase/ssr`                  | Supabase SSR 지원                     |
| `@supabase/supabase-js`          | Supabase 클라이언트 SDK               |
| `zustand`                        | 경량 상태 관리 라이브러리             |
| `@tanstack/react-query`          | 서버 상태 관리 및 캐싱                |
| `@tanstack/react-query-devtools` | React Query 개발 도구 (DevDependency) |
| `phaser`                         | 2D 게임 엔진 (WebGL/Canvas 렌더링)    |
| `uuid`                           | 익명 사용자 고유 식별자 생성          |
| `tailwind-merge`                 | Tailwind CSS 클래스 병합 유틸리티     |
| `@slick-carousel`                | 반응형 캐러셀 컴포넌트                |
| `lucide-react`                   | 아이콘 라이브러리                     |

---

## 🔌 환경 및 프로바이더 체크리스트

- `.env.local.ex`를 복사하여 `.env.local`을 만들고 Supabase, Cloudflare Realtime/Calls, NODE_ENV 값을 실제 키로 설정합니다.
- React Query(`@tanstack/react-query`), Supabase(`@supabase/supabase-js`, `@supabase/ssr`), Zustand, Phaser 등 주요 라이브러리가 `src/app/providers/` 내부에서 초기화됩니다.
- 필요한 프로바이더는 `QueryProvider`, `SupabaseProvider`, `AppProviders`이며, Supabase는 익명 접속·SSR·Realtime을 지원하고 AppProviders가 전체 계층을 감쌉니다.
- 상태 관리는 React Query가 서버 데이터를, Zustand가 클라이언트 상태를 담당하며, 관련 스토어는 FSD 레이어별 `model/store`에 배치합니다.
- Cloudflare Realtime + SFU, Phaser 게임 엔진 설정, Supabase Realtime 설정 등은 위 구성이 정상적으로 작동할 수 있도록 환경변수, provider hooks, `AppProviders` 계층에서 연결합니다.

---

## 📚 참고 자료

- [FSD 아키텍처 가이드](https://feature-sliced.design/)
- [Cloudflare Realtime 문서](https://developers.cloudflare.com/realtime/)
- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [Supabase Realtime 가이드](https://supabase.com/docs/guides/realtime)
