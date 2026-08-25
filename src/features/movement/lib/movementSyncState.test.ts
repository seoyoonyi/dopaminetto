import { RECONNECT_BACKOFF_MS } from "@/shared/lib/realtime/reconnectBackoff";
import { describe, expect, it } from "vitest";

import * as movementSyncState from "./movementSyncState";
import { REMOTE_PLAYER_REMOVAL_GRACE_MS } from "./movementSyncState";

type ShouldInitializeRemotePlayerFromPresence = (params: {
  currentUserId?: string;
  knownRemotePlayerIds: Set<string>;
  presenceUserId?: string;
}) => boolean;

const shouldInitializeRemotePlayerFromPresence = (
  movementSyncState as typeof movementSyncState & {
    shouldInitializeRemotePlayerFromPresence?: ShouldInitializeRemotePlayerFromPresence;
  }
).shouldInitializeRemotePlayerFromPresence;

describe("REMOTE_PLAYER_REMOVAL_GRACE_MS", () => {
  it("3번째 재연결 시도(2000ms + 4000ms)와 왕복 여유시간까지 커버한다", () => {
    // 첫 재시도는 즉시(0ms) 실행되므로(scheduleConnect), 3번째 시도까지는 backoff[1]+backoff[2]만 누적된다.
    const cumulativeWaitBeforeThirdAttempt = RECONNECT_BACKOFF_MS[1] + RECONNECT_BACKOFF_MS[2];

    expect(cumulativeWaitBeforeThirdAttempt).toBe(6_000);
    expect(REMOTE_PLAYER_REMOVAL_GRACE_MS).toBeGreaterThan(cumulativeWaitBeforeThirdAttempt);
    // backoff 값이 바뀌면 이 근거도 재검토해야 하므로 정확한 값으로 고정한다.
    expect(REMOTE_PLAYER_REMOVAL_GRACE_MS).toBe(12_000);
  });
});

describe("shouldInitializeRemotePlayerFromPresence", () => {
  it("아직 렌더링되지 않은 원격 플레이어만 초기화한다", () => {
    expect(shouldInitializeRemotePlayerFromPresence).toBeTypeOf("function");

    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(["remote-user"]),
        presenceUserId: "remote-user",
      }),
    ).toBe(false);
    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(),
        presenceUserId: "new-remote-user",
      }),
    ).toBe(true);
    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(),
        presenceUserId: "local-user",
      }),
    ).toBe(false);
  });
});
