# FSD 폴더 구조 & 레이어 규칙

> Feature-Sliced Design 구조 패턴에 대한 상세 규칙이다.

---

## 폴더 구조

```
src/
├── app/              # Next.js App Router (라우팅, 레이아웃, 프로바이더)
│   └── providers/    # QueryProvider, SupabaseProvider, AppProviders
├── widgets/          # 독립적 UI 블록 (조합된 feature 단위)
├── features/         # 비즈니스 기능 단위
│   └── [feature]/
│       ├── ui/       # UI 컴포넌트
│       ├── hooks/    # 커스텀 훅
│       ├── model/    # 도메인 로직, 상태, 서비스
│       ├── lib/      # feature 내부 순수 유틸
│       ├── api/      # feature API 연동
│       └── types/    # 타입 정의
├── entities/         # 도메인 모델 (사용자, 메시지, 빌리지 등)
├── shared/           # 공용 유틸, 상수, 타입, UI
│   ├── ui/           # 공용 UI 컴포넌트
│   ├── hooks/        # 공용 커스텀 훅
│   ├── lib/          # 외부 라이브러리 래퍼 (supabase client 등)
│   ├── constants/    # 상수 정의
│   └── types/        # 공용 타입
```

## 네이밍 규칙

### 폴더명

- `features/*`, `widgets/*`, `entities/*`의 슬라이스 폴더는 camelCase로 작성한다.
- `ui`, `model`, `hooks`, `lib`, `api`, `store`, `types` 같은 역할 폴더는 소문자 단어를 사용한다.

### 파일명

- React 컴포넌트 파일은 PascalCase로 작성한다. 단, `shared/ui/`의 shadcn/ui 컴포넌트는 CLI가 생성하는 kebab-case 파일명을 그대로 사용한다.
- `src/app` 하위 라우트 segment는 URL 경로가 되므로 Next.js 라우팅 규칙을 우선한다.

---

## 레이어 계층 & 의존성 방향

```
app → widgets → features → entities → shared
```

- 상위 레이어는 하위 레이어만 import 가능
- 역방향 참조 절대 금지 (shared가 features를 import하면 안 됨)

---

## 핵심 규칙

### 1. 슬라이스 간 직접 참조 금지

같은 레이어 내의 슬라이스끼리 직접 import하지 않는다.

```typescript
// ✕ features/chat에서 features/voice를 직접 import
import { useVoice } from "@/features/voice/hooks/useVoice";

// ✓ shared를 통해 공유하거나, 상위 레이어(widgets)에서 조합
```

### 2. 배럴 파일로 public API 노출

각 슬라이스는 `index.ts`를 통해 외부에서 실제로 사용하는 항목만 좁게 export한다. 내부 구현 파일을 한 번에 모두 노출하지 않는다.

```typescript
// features/chat/index.ts
export { ChatPanel } from "./ui/ChatPanel";
export { useChatStore } from "./model/useChatStore";
export type { Message } from "./types";
```

### 3. app 레이어의 역할

- 라우팅과 레이아웃만 담당
- 비즈니스 로직 포함 금지
- 프로바이더 초기화 (`providers/` 디렉터리)

### 4. shared 레이어의 역할

- 프로젝트 전반에서 재사용되는 코드만 배치
- 특정 feature에 종속되는 코드는 해당 feature 슬라이스로 이동
- shadcn/ui 설정상 `cn` 유틸은 `src/lib/utils.ts`에 둘 수 있다. 이 파일은 `components.json`의 `utils` alias와 연결된 예외 경로로 본다.

### 5. 중복 helper 방지

같은 helper 함수나 순수 로직을 여러 파일에 복사하지 않는다.

- hook, component 안에 helper를 새로 만들기 전에 같은 slice의 `model`, `lib`, `hooks`에 이미 책임을 가진 파일이 있는지 먼저 확인한다.
- 같은 로직이 두 파일 이상에서 필요해지는 순간, 두 번째 파일에 복사하지 말고 공통 책임 파일로 이동한다.
- 특정 feature 안에서만 쓰는 helper는 `shared`로 올리지 않고 해당 feature slice 내부에 둔다.
- 저장소 key, ID 생성, parse/serialize, lock 판정처럼 UI와 직접 관련 없는 순수 로직은 hook/component가 아니라 `model` 또는 `lib`에 둔다.
- hook은 외부 시스템 연결, React 상태 관리, lifecycle 연결을 담당하고, 순수 계산/생성 로직은 가능한 한 hook 밖으로 분리한다.

```typescript
// ✕ 같은 helper가 여러 hook에 복사됨
function createBrowserTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}
```

```typescript
// ✓ 탭 ID 책임을 가진 feature model로 이동
// features/singleTownTab/model/townTabIdentity.ts
export function createBrowserTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}
```

---

## 상태 관리 배치

| 상태 종류            | 도구                 | 배치 위치                   |
| -------------------- | -------------------- | --------------------------- |
| 서버 데이터          | TanStack React Query | `features/[feature]/hooks/` |
| feature 전역 상태    | Zustand              | `features/[feature]/model/` |
| 공용 클라이언트 상태 | Zustand              | `shared/store/`             |

현재 프로젝트는 `features/*/model/use*Store.ts` 패턴을 주로 사용한다. 새 Zustand 스토어도 특별한 이유가 없다면 같은 패턴을 따른다.
