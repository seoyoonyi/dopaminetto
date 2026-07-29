# Git 워크플로우

> 커밋 컨벤션, 브랜치 전략, PR 규칙, 코드 리뷰 프로세스다.

---

## 1. 커밋 메시지 컨벤션

### 포맷

```
<type>: <subject> (#이슈번호)

<body>
```

### 커밋 타입 (소문자)

| 타입       | 설명                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `feat`     | 새로운 기능 추가                                                         |
| `fix`      | 버그 수정                                                                |
| `refactor` | 코드 리팩토링 (비즈니스 로직 변경 없음)                                  |
| `design`   | CSS 등 사용자 UI 디자인 변경                                             |
| `style`    | 코드 스타일 (코드 형식, 줄바꿈, 주석, 세미콜론: 비즈니스 로직 변경 없음) |
| `docs`     | 문서 수정 (문서 추가, 수정, 삭제, README)                                |
| `test`     | 테스트 코드 추가/수정 (비즈니스 로직 변경 없음)                          |
| `settings` | 프로젝트 세팅 관련                                                       |
| `chore`    | 패키지 매니저 수정, 그 외 기타 수정 (ex: .gitignore)                     |
| `init`     | 초기 생성                                                                |
| `rename`   | 파일/폴더명 수정 또는 이동만 수행                                        |
| `remove`   | 파일 삭제만 수행                                                         |

### 작성 규칙

- 제목 첫 글자를 소문자로 작성
- 제목은 명령문으로 작성
- 제목 끝에 마침표(.) 금지
- 제목과 본문을 한 줄 띄워 분리
- 본문은 "어떻게" 보다 "무엇을", "왜"를 설명
- 본문에 여러 줄의 메시지를 작성할 땐 `-`로 구분

### 예시

```
feat: 로그인 화면 키보드 UX 개선 (#12)

- TextInput ref를 사용하여 자동 포커스 기능 추가
- returnKeyType 설정으로 키보드 엔터키 동작 개선
- 전화번호 입력 후 자동으로 비밀번호 입력창으로 포커스 이동
```

### 커밋 메시지 템플릿 설정

```bash
git config commit.template .github/.gitmessage.txt
```

---

## 2. 브랜치 전략

### 브랜치 구조

```
main          ← 프로덕션 배포
  └── develop ← 개발 통합 (PR의 베이스 브랜치)
       ├── feature/기능명-이슈번호
       ├── fix/버그명-이슈번호
       └── refactor/대상-이슈번호
```

### 브랜치 명명 규칙

```
<type>/기능명-이슈번호
```

- 기능 브랜치는 `feature`를 사용한다. 커밋 타입의 `feat`와 구분한다.
- 예시: `feature/add-login-10`, `fix/chat-scroll-42`, `refactor/message-gc-73`
- 브랜치 소스는 반드시 **develop**에서 생성
- GitHub 이슈에서 "Create a branch"로 생성 권장

---

## 3. Pull Request 규칙

- 베이스 브랜치: **develop** (main이 아님)
- PR 제목, 설명, 변경 파일 내용 작성 후 리뷰어 지정
- PR 생성 후 제목, 설명, 파일 변경 내용, 리뷰어 지정이 올바른지 확인
- 이슈 단위 작업은 `agent-docs/issue-workflow.md`에 따라 spec, plan, troubleshooting 문서를 생성하거나 갱신

---

## 4. 코드 리뷰 규칙

### 리뷰 방법

- **Add single comment**: 간단한 질문/제안 시 즉시 게시
- **Start a review**: 체계적인 종합 리뷰 시 여러 코멘트를 모아서 한 번에 제출

### 리뷰 완료 시 상태 선택

| 상태                | 용도                                          |
| ------------------- | --------------------------------------------- |
| **Comment**         | 일반 피드백, 질문, 토론 (PR 상태에 영향 없음) |
| **Approve**         | 코드 품질 기준 충족, 머지 가능                |
| **Request changes** | 수정 필수, 수정 완료 전 머지 차단             |

### 주의사항

- Start a review 선택 시 반드시 **Finish your review**로 제출 완료할 것
- Pending 상태로 방치하면 다른 팀원이 코멘트를 볼 수 없음

---

## 5. 이슈 작업 문서화

GitHub 이슈, PR 리뷰 대응, 버그 수정, 기능 추가처럼 이슈 단위로 추적 가능한 작업은 사용자가 별도로 요청하지 않아도 다음 문서를 생성하거나 갱신한다. 단순 질의응답, 커밋 메시지 추천, 짧은 문구 수정, 사용자가 문서 생성을 원하지 않는다고 명시한 경우에는 자동 생성하지 않는다.

- Spec: `docs/specs/YYYY-MM-DD-<issue-slug>-spec.md`
- Plan: `docs/tasks/YYYY-MM-DD-<issue-slug>-plan.md`
- Troubleshooting: `docs/troubleshooting/YYYY-MM-DD-<issue-slug>-troubleshooting.md`

상세 작성 기준과 예외 조건은 `agent-docs/issue-workflow.md`를 따른다.
