import { describe, expect, it } from "vitest";

import {
  canAutoReconnectAfterRoomLeft,
  isRetryableVoiceConnectError,
  isUnintentionalRoomLeave,
} from "./voiceReconnect";

describe("isUnintentionalRoomLeave", () => {
  it("disconnected와 failed는 의도하지 않은 이탈(재연결 대상)로 처리한다", () => {
    expect(isUnintentionalRoomLeave("disconnected")).toBe(true);
    expect(isUnintentionalRoomLeave("failed")).toBe(true);
  });

  it("의도된 퇴장(kicked/ended/left/rejected/stageLeft)은 재연결 대상으로 처리하지 않는다", () => {
    expect(isUnintentionalRoomLeave("left")).toBe(false);
    expect(isUnintentionalRoomLeave("kicked")).toBe(false);
    expect(isUnintentionalRoomLeave("ended")).toBe(false);
    expect(isUnintentionalRoomLeave("rejected")).toBe(false);
    expect(isUnintentionalRoomLeave("stageLeft")).toBe(false);
    expect(isUnintentionalRoomLeave("connected-meeting")).toBe(false);
  });
});

describe("canAutoReconnectAfterRoomLeft", () => {
  it("최대 시도 횟수 이내에서는 재연결 시도를 허용한다", () => {
    expect(canAutoReconnectAfterRoomLeft(0, 3)).toBe(true);
    expect(canAutoReconnectAfterRoomLeft(2, 3)).toBe(true);
  });

  it("최대 횟수에 도달하면 추가 재연결 시도를 막는다", () => {
    expect(canAutoReconnectAfterRoomLeft(3, 3)).toBe(false);
    expect(canAutoReconnectAfterRoomLeft(10, 3)).toBe(false);
  });
});

describe("isRetryableVoiceConnectError", () => {
  it("RealtimeKit 자체 transport/state 오류는 재시도 가능으로 처리한다", () => {
    const transportError = new Error("Socket is not connected");
    transportError.name = "TransportConnectionError";
    expect(isRetryableVoiceConnectError(transportError)).toBe(true);

    const invalidStateError = new Error("some invalid state");
    invalidStateError.name = "InvalidStateError";
    expect(isRetryableVoiceConnectError(invalidStateError)).toBe(true);
  });

  it("네트워크/일시적 코드의 RealtimeKit ClientError는 재시도 가능으로 처리한다", () => {
    for (const code of ["0002", "0011", "0012", "0013"]) {
      const clientError = Object.assign(new Error("failed"), { code });
      expect(isRetryableVoiceConnectError(clientError)).toBe(true);
    }
  });

  it("ClientError 코드를 갖고 있어도 인증/권한/설정 오류는 재시도하지 않는다", () => {
    const invalidToken = Object.assign(new Error("Invalid auth token"), { code: "0004" });
    expect(isRetryableVoiceConnectError(invalidToken)).toBe(false);

    const unsupportedBrowser = Object.assign(new Error("Browser not supported"), { code: "0010" });
    expect(isRetryableVoiceConnectError(unsupportedBrowser)).toBe(false);

    const permissionDenied = Object.assign(new Error("Permission denied."), { code: "0501" });
    expect(isRetryableVoiceConnectError(permissionDenied)).toBe(false);
  });

  it("인식되지 않은 오류(우리가 직접 던진 오류 포함)는 기본적으로 재시도하지 않는다", () => {
    expect(
      isRetryableVoiceConnectError(new Error("음성 연결 클라이언트 초기화에 실패했습니다.")),
    ).toBe(false);
    expect(isRetryableVoiceConnectError(new Error("인증 세션이 없습니다."))).toBe(false);
    expect(isRetryableVoiceConnectError("not an Error instance")).toBe(false);
    expect(isRetryableVoiceConnectError(null)).toBe(false);
  });
});
