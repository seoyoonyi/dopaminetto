import { describe, expect, it } from "vitest";

import { MAX_AUTO_RECONNECT, RECONNECT_BACKOFF_MS, getReconnectDelayMs } from "./reconnectBackoff";

describe("getReconnectDelayMs", () => {
  it("각 시도 인덱스에 대해 설정된 backoff 값을 반환한다", () => {
    RECONNECT_BACKOFF_MS.forEach((delay, index) => {
      expect(getReconnectDelayMs(index)).toBe(delay);
    });
  });

  it("설정된 단계를 넘어서면 마지막 backoff 값으로 유지된다", () => {
    const lastDelay = RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1];

    expect(getReconnectDelayMs(RECONNECT_BACKOFF_MS.length)).toBe(lastDelay);
    expect(getReconnectDelayMs(MAX_AUTO_RECONNECT + 10)).toBe(lastDelay);
  });
});
