## Skills

아래 조건에 해당하면 반드시 해당 문서를 먼저 읽은 뒤 작업하세요.

| 조건                                        | 반드시 읽을 문서                 |
| ------------------------------------------- | -------------------------------- |
| 파일/폴더 생성, import 경로 결정            | `agent-docs/fsd-structure.md`    |
| className, 스타일 관련 코드 수정            | `agent-docs/styling.md`          |
| git commit, branch, PR 작성                 | `agent-docs/git-workflow.md`     |
| GitHub 이슈, PR 리뷰, 버그/기능 작업        | `agent-docs/issue-workflow.md`   |
| HTML 태그, aria 속성, 이미지/비디오         | `agent-docs/a11y-performance.md` |
| React 컴포넌트 작성, 훅 사용, TSX 타입 선언 | `agent-docs/react-tsx.md`        |

## Planning Rule

모든 작업은 먼저 작업 계획을 제시한 뒤 진행합니다.

- 구현 또는 수정 작업 전, 반드시 `<proposed_plan>`을 먼저 제시합니다.
- **큰 변경, 파일 생성/이동/삭제, 구조 변경, 여러 파일에 걸친 수정**은 사용자 확인 후 진행합니다.
- **작은 범위의 단순 수정**은 계획 제시 후 바로 진행할 수 있습니다.
- 규칙 문서와 충돌하거나 영향 범위가 불분명한 경우에는 먼저 사용자에게 확인합니다.

## Project Defaults

이 프로젝트의 기본 기준은 아래와 같습니다.

- Next.js 15
- App Router 사용
- TypeScript 사용
- `src/` 디렉터리 사용
- FSD 구조 기반으로 폴더 구성
- 패키지 매니저는 `npm` 사용
- 스타일링은 Tailwind CSS + shadcn/ui를 기본으로 사용하고, 전역 CSS는 `src/app/globals.css`에서 관리
- CSS Modules는 현재 사용하지 않으며, 새로 추가해야 한다면 먼저 필요성을 확인

## 이슈 작업 기본값

GitHub 이슈, PR 리뷰 대응, 버그 수정, 기능 추가처럼 이슈 단위로 추적 가능한 작업을 진행할 때는 사용자가 별도로 요청하지 않아도 다음 문서를 생성하거나 갱신한다.

- Spec: `docs/specs/YYYY-MM-DD-<issue-slug>-spec.md`
- Plan: `docs/tasks/YYYY-MM-DD-<issue-slug>-plan.md`
- Troubleshooting: `docs/troubleshooting/YYYY-MM-DD-<issue-slug>-troubleshooting.md`

단순 질의응답, 커밋 메시지 추천, 짧은 문구 수정, 사용자가 문서 생성을 원하지 않는다고 명시한 경우에는 자동 생성하지 않는다.
