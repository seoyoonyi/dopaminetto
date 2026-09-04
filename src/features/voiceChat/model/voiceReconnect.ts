import type { LeaveRoomState } from "@cloudflare/realtimekit-react";

export const isUnintentionalRoomLeave = (state: LeaveRoomState) =>
  state === "disconnected" || state === "failed";

export const canAutoReconnectAfterRoomLeft = (attempts: number, maxAttempts: number) =>
  attempts < maxAttempts;

/**
 * online/visible 복구 신호가 왔을 때 음성 재연결을 트리거해야 하는지 판단한다(#173).
 * 장시간 Offline 중에는 `fetch("/api/voice/token")`가 `TypeError: Failed to fetch`로 실패하는데,
 * 이는 isRetryableVoiceConnectError에서 재시도 불가로 분류되고 TownVoiceClient에는 online 리스너가
 * 없어서, 네트워크가 돌아와도 새로고침 전까지 "Failed to fetch" error에 고착됐다.
 * 이미 방에 있거나(joinedRoom) 연결 시도가 진행 중이면(connectInFlight) 재연결하지 않는다.
 */
export const shouldTriggerVoiceRecovery = ({
  joinedRoom,
  connectInFlight,
}: {
  joinedRoom: boolean;
  connectInFlight: boolean;
}) => !joinedRoom && !connectInFlight;

/**
 * RealtimeKit이 소켓/전송 계층에서 스스로 정의하는 에러 이름이다(node_modules/@cloudflare/
 * realtimekit/dist/index.es.js 확인). 서버가 명시적으로 거부한 게 아니라 로컬 소켓이 아직
 * 붙지 않았거나(재연결 도중의 좁은 시간창) 일시적으로 끊긴 상태를 뜻하므로 재시도할 가치가 있다.
 */
const RETRYABLE_TRANSPORT_ERROR_NAMES = new Set(["TransportConnectionError", "InvalidStateError"]);

/**
 * RealtimeKit의 ClientError는 `code`로 서버 응답의 실패 사유를 구분한다(같은 번들의 에러
 * 코드 테이블 `sd` 확인). 네트워크성/일시적 코드만 재시도 대상으로 허용한다.
 * - 0002: Failed to join room (미디어 서버 연결 실패 등 네트워크성 원인을 감싸는 일반 코드)
 * - 0011: HTTP Network Error
 * - 0012: Websocket Network Error
 * - 0013: Rate Limited
 * 반대로 0004(Invalid auth token), 0010(Browser not supported)나 `*01`류 Permission denied
 * 코드처럼 재시도해도 결과가 달라지지 않는 코드는 포함하지 않는다.
 */
const RETRYABLE_CLIENT_ERROR_CODES = new Set(["0002", "0011", "0012", "0013"]);

/**
 * 음성 연결 실패가 재시도할 가치가 있는지 판단한다. 인식하지 못한 에러(우리 자신이 던진
 * 토큰/설정 오류 포함)는 기본적으로 재시도하지 않는다 — 원인을 모르는 실패를 조용히
 * 반복하는 것보다, 무엇이 잘못됐는지 바로 드러나는 쪽이 안전하다.
 */
export function isRetryableVoiceConnectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (RETRYABLE_TRANSPORT_ERROR_NAMES.has(error.name)) return true;

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && RETRYABLE_CLIENT_ERROR_CODES.has(code);
}
