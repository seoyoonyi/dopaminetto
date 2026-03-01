# 2026-02-24 작업 기록 - 채팅 스크롤 알림 버그 수정

## 작업한 내용

- 메시지 전송 시 하단 이동 및 새 메시지 알림 발생(시나리오 E) 버그 수정
- `src/widgets/chatPanel/model/useChatPanel.ts`
  - 불필요해진 `selfSendScrollSignal` 상태 제거
  - `ChatHistory` 컴포넌트에서 내 메시지 여부를 판별할 수 있도록 `userId` 반환
- `src/features/chat/ui/ChatHistory.tsx`
  - 메시지를 추가 수신할 때의 `useEffect` 내에서 `isMyMessage` 판별 분기 추가
  - 내 메시지일 경우 알림 카운트 증가를 건너뛰고 스크롤만 하단으로 부드럽게 이동하도록 로직 수정
  - 기존의 불안정했던 `selfSendScrollSignal` 구독 및 렌더링 의존성 정리

## 트러블슈팅

1. 본인 메시지 전송 후 발생하는 새 메시지 알림(카운트 증가) 이슈

- 원인
  - `useChatPanel` 내에서 `selfSendScrollSignal` 값을 증가시켜 알림을 무시하려 했으나, 리액트 `useEffect`의 실행 순서 문제로 인해 카운트가 먼저 증가하는 이슈 발생.
  - 임시 메시지-실제 메시지 간 데이터 교체 과정에서 스크롤 애니메이션과 겹쳐 `isAtBottomRef`가 false인 상태에서 새 메시지로 인지.
- 해결
  - `selfSendScrollSignal` 대신 현재 메시지의 `user_id`를 검사하는 본질적인 식별 방법(`isMyMessage`)으로 방향 전환.
  - 최신 수신 메시지의 `user_id`가 본인의 아이디(`currentUserId`)와 일치하는 경우 알림 상태 업데이트를 무조건 `return`하여 중단시키고 즉시 스크롤만 이동하도록 구현.

## 검증/산출물

- 자동 검증:
  - (생략됨 - 로컬 확인 대체)
- 녹화/스크린샷:
  - `artifacts/chat-scroll-videos/scenario_e_fix_v2.webp` (에이전트 스크롤 동작 녹화본)
- 정적 검증:
  - `npm run type-check` 무결점 통과
  - `npm run lint` 무결점 통과
  - `npm run test` (Vitest) 21개 항목 모두 통과 (Chat Message Utils 관련 GC 로직 포함)

## 써머리

- `selfSendScrollSignal`이라는 우회적인 식별 방법을 제거하고, 실제 `user_id` 기반 식별을 통해 복잡한 useEffect 꼬임을 근본적으로 해결했습니다.
- 채팅 스크롤 기능의 부작용을 통제하여 보다 안정적인 사용자 경험을 보장할 수 있게 되었습니다.
