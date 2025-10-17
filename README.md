# Dopaminetto

## 📄 개요

게더타운 서비스 종료에 아쉬움을 느끼고, 음성/텍스트 채팅 기능에 초점을 맞춘 MVP 웹 애플리케이션을 직접 만들어보기 위해 시작된 프로젝트입니다.

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

- **SFU Solution**: Cloudflare Realtime(Calls) (via Workers API)
- **User Identification**: UUID 기반 익명 사용자

### Game Engine

- **2D Game Engine**: Phaser 3
- **Canvas Rendering**: WebGL/Canvas API

### State Management

- **Global State**: Zustand
- **Server State**: TanStack React Query

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

### 3. 개발 서버 실행

```bash
npm run dev
```

이제 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 프로젝트를 확인할 수 있습니다.

## 📁 FSD 폴더 구조

  <details>
    <summary>📂 프로젝트 폴더 구조 보기</summary>
```text
src
 ┣ app
 ┃ ┣ api
 ┃ ┃ ┗ rooms
 ┃ ┃ ┃ ┗ route.ts
 ┃ ┣ game
 ┃ ┃ ┗ page.tsx
 ┃ ┣ providers
 ┃ ┃ ┣ AppProviders.tsx
 ┃ ┃ ┣ QueryProvider.tsx
 ┃ ┃ ┣ SupabaseProvider.tsx
 ┃ ┃ ┗ index.ts
 ┃ ┣ favicon.ico
 ┃ ┣ globals.css
 ┃ ┣ index.ts
 ┃ ┣ layout.tsx
 ┃ ┗ page.tsx
 ┣ entities
 ┃ ┣ player
 ┃ ┃ ┗ index.ts
 ┃ ┣ room
 ┃ ┃ ┗ index.ts
 ┃ ┗ index.ts
 ┣ features
 ┃ ┣ chat
 ┃ ┃ ┗ index.ts
 ┃ ┣ movement
 ┃ ┃ ┗ index.ts
 ┃ ┣ room-switch
 ┃ ┃ ┗ index.ts
 ┃ ┣ voice
 ┃ ┃ ┗ index.ts
 ┃ ┗ index.ts
 ┣ lib
 ┃ ┗ utils.ts
 ┣ shared
 ┃ ┣ config
 ┃ ┃ ┣ index.ts
 ┃ ┃ ┣ supabase.client.ts
 ┃ ┃ ┗ supabase.server.ts
 ┃ ┣ hooks
 ┃ ┃ ┗ index.ts
 ┃ ┣ lib
 ┃ ┃ ┣ phaser
 ┃ ┃ ┃ ┣ createGame.ts
 ┃ ┃ ┃ ┗ index.ts
 ┃ ┃ ┣ realtime
 ┃ ┃ ┃ ┗ index.ts
 ┃ ┃ ┗ index.ts
 ┃ ┣ store
 ┃ ┃ ┗ index.ts
 ┃ ┣ types
 ┃ ┃ ┗ index.ts
 ┃ ┣ ui
 ┃ ┃ ┗ index.ts
 ┃ ┗ index.ts
 ┗ widgets
 ┃ ┣ chatPanel
 ┃ ┃ ┗ index.ts
 ┃ ┣ gameCanvas
 ┃ ┃ ┣ scene
 ┃ ┃ ┃ ┗ .gitkeep
 ┃ ┃ ┗ index.ts
 ┃ ┣ roomLayout
 ┃ ┃ ┗ index.ts
 ┃ ┗ index.ts
```
   </details>
   
## 🔧 주요 라이브러리 역할

| 패키지                           | 용도                                    |
| -------------------------------- | --------------------------------------- |
| `@supabase/ssr`                  | Supabase SSR 지원                       |
| `@supabase/supabase-js`          | Supabase 클라이언트 SDK                 |
| `zustand`                        | 경량 상태 관리 라이브러리               |
| `@tanstack/react-query`          | 서버 상태 관리 및 캐싱                  |
| `@tanstack/react-query-devtools` | React Query 개발 도구 (DevDependency)   |
| `wrangler`                       | Cloudflare Workers CLI 도구             |
| `@cloudflare/workers-types`      | Cloudflare Workers TypeScript 타입 정의 |
| `phaser`                         | 2D 게임 엔진 (WebGL/Canvas 렌더링)      |
| `uuid`                           | 익명 사용자 고유 식별자 생성            |
| `tailwind-merge`                 | Tailwind CSS 클래스 병합 유틸리티       |
| `@slick-carousel`                | 반응형 캐러셀 컴포넌트                  |
| `lucide-react`                   | 아이콘 라이브러리                       |

## 🔧 Providers 구조

### App Layer Providers (`src/app/providers/`)

애플리케이션 전체에서 사용하는 프로바이더들을 관리합니다.

#### 필요한 프로바이더들

| 프로바이더         | 용도                        | 라이브러리            | 특징                |
| ------------------ | --------------------------- | --------------------- | ------------------- |
| `QueryProvider`    | 서버 상태 관리 및 캐싱      | @tanstack/react-query | DevTools 포함       |
| `SupabaseProvider` | 데이터베이스 및 실시간 기능 | @supabase/ssr         | 익명 접속, SSR 지원 |
| `AppProviders`     | 모든 프로바이더 통합        | -                     | 계층적 구조         |

### SupabaseProvider 특징

- **익명 접속**: 회원가입 없이 UUID 기반 사용자 식별
- **SSR 지원**: `@supabase/ssr`을 사용하여 Next.js App Router 최적화
- **Realtime 지원**: 채팅 및 음성 채팅 시그널링 기능

## ⚠️ 주의사항

### WebRTC 솔루션 선택 이유

- **P2P 방식 불가**: 40~50명 동시 접속 시 각자 49개 연결 필요 (총 1,225개 연결)
- **SFU 필수**: 서버 중계 방식으로 확장성 확보
- **Cloudflare Realtime 선택**: Workers API를 통한 비용과 편의성 고려

### Cloudflare Workers 사용법

- **Workers API 직접 호출**: REST API 또는 Workers 환경에서 사용
- **wrangler CLI**: 로컬 개발 및 배포 도구

### 익명 접속 구현

- 회원가입 없이 UUID 기반 사용자 식별
- 로컬 스토리지를 통한 세션 유지
- 임시 닉네임 자동 생성

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

## 📚 참고 자료

- [FSD 아키텍처 가이드](https://feature-sliced.design/)
- [Cloudflare Realtime 문서](https://developers.cloudflare.com/realtime/)
- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [Supabase Realtime 가이드](https://supabase.com/docs/guides/realtime)
