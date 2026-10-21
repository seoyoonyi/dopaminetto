import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REMOTE_PLAYER_REMOVAL_GRACE_MS as GRACE_MS } from "../lib/movementSyncState";

/**
 * GRACE_MS가 재연결 시나리오에서 실제로 의도대로 동작하는지 fake timer로 검증한다.
 * 값은 하드코딩하지 않고 실제 상수를 사용해 movementSyncState.ts 변경 시 함께 갱신된다.
 * 관찰자 자신의 채널(getTownChannelStatus)은 항상 SUBSCRIBED로 고정한다 —
 * 불안정한 건 원격 유저 A의 연결이지 관찰자의 연결이 아니다.
 */

const channelTrackMock = vi.fn().mockResolvedValue("ok");
const channelSendMock = vi.fn().mockResolvedValue("ok");
const presenceStateMock = vi.fn<() => Record<string, { userId: string }[]>>(() => ({}));
const removeRemotePlayerMock = vi.fn();
const updateRemotePlayerMock = vi.fn();
const removeRemotePlayersOutsideVillagesMock = vi.fn();

let presenceHandler: ((event: string, payload?: unknown) => void) | undefined;
let broadcastHandler: ((event: string, payload?: unknown) => void) | undefined;

const channel = {
  presenceState: presenceStateMock,
  send: channelSendMock,
  track: channelTrackMock,
  untrack: vi.fn().mockResolvedValue("ok"),
};

const movementState = {
  villageId: "lobby",
  nickname: "로컬 사용자",
  characterId: "p-boy",
  lastSyncedPosition: { x: 120, y: 240 },
  localActionState: null,
  remotePlayers: {} as Record<
    string,
    { userId: string; joinedAt?: string; sessionId?: string; position?: { x: number; y: number } }
  >,
  setNickname: vi.fn(),
  setCharacterId: vi.fn(),
  setUserId: vi.fn(),
  updateRemotePlayer: updateRemotePlayerMock,
  removeRemotePlayer: removeRemotePlayerMock,
  removeRemotePlayersOutsideVillages: removeRemotePlayersOutsideVillagesMock,
};

vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: <T>(initialValue: T) => ({ current: initialValue }),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T>(selector: T) => selector,
}));

vi.mock("@/app/providers/SupabaseProvider", () => ({
  useSupabase: () => ({}),
}));

vi.mock("@/entities/village", () => ({
  getVisibleVillages: () => ["lobby"],
}));

vi.mock("@/features/movement/model/config", () => ({
  resolveCharacterId: (characterId: string) => characterId,
}));

vi.mock("@/features/movement/model/payload", () => ({
  createPresencePayload: (payload: unknown) => payload,
  createPresenceTrackSignature: () => "same-signature",
  createSyncPositionPayload: (payload: unknown) => payload,
}));

vi.mock("@/features/movement/model/useMovementStore", () => ({
  useMovementStore: Object.assign(
    (selector: (state: typeof movementState) => unknown) => selector(movementState),
    { getState: () => movementState },
  ),
}));

vi.mock("@/shared/constants", () => ({
  PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS: 0,
}));

vi.mock("@/shared/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/shared/hooks/useUserInfo", () => ({
  useUserInfo: () => ({ data: { id: "auth-user" } }),
}));

vi.mock("@/shared/lib/realtime", () => ({
  getVillageChannelName: (villageId: string) => `village:${villageId}`,
}));

vi.mock("@/shared/lib/realtime/townChannelManager", () => ({
  acquireTownChannel: () => vi.fn(),
  getTownChannel: () => channel,
  getTownChannelStatus: () => "SUBSCRIBED",
  observeTownChannelBroadcast: (
    _channelName: string,
    handler: (event: string, payload?: unknown) => void,
  ) => {
    broadcastHandler = handler;
    return vi.fn();
  },
  observeTownChannelPresence: (
    _channelName: string,
    handler: (event: string, payload?: unknown) => void,
  ) => {
    presenceHandler = handler;
    return vi.fn();
  },
  observeTownChannelStatus: () => vi.fn(),
  reconnectTownChannel: vi.fn(),
}));

vi.mock("@/shared/store/useUserStore", () => ({
  useUserStore: () => ({
    selectedCharacterId: "p-boy",
    userId: "local-user",
    userNickname: "로컬 사용자",
  }),
}));

const REMOTE_USER_ID = "remote-user-a";

const simulateRemoteUserLeave = () => {
  presenceHandler?.("leave", {
    leftPresences: [{ userId: REMOTE_USER_ID }],
  });
};

const simulateRemoteUserJoin = () => {
  presenceStateMock.mockReturnValue({
    [REMOTE_USER_ID]: [{ userId: REMOTE_USER_ID }],
  });
  presenceHandler?.("join", {
    newPresences: [{ userId: REMOTE_USER_ID, villageId: "lobby", position: { x: 5, y: 5 } }],
  });
};

describe("REMOTE_PLAYER_REMOVAL_GRACE_MS vs 원격 유저 재연결 소요 시간 검증", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    presenceHandler = undefined;
    broadcastHandler = undefined;
    presenceStateMock.mockReturnValue({});
    movementState.remotePlayers = {};
    updateRemotePlayerMock.mockImplementation((player) => {
      movementState.remotePlayers[player.userId] = player;
    });
    removeRemotePlayerMock.mockImplementation((userId: string) => {
      delete movementState.remotePlayers[userId];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("A. grace 이내의 단절 후 재연결되면 캐릭터가 삭제되지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();

    simulateRemoteUserLeave();
    vi.advanceTimersByTime(Math.floor(GRACE_MS / 2));
    simulateRemoteUserJoin();
    // grace 만료 시점을 지나가도 안전해야 한다.
    vi.advanceTimersByTime(GRACE_MS);

    expect(removeRemotePlayerMock).not.toHaveBeenCalledWith(REMOTE_USER_ID);
  });

  it("B. grace를 넘는 단절이면 만료 시점에 실제로 삭제되고, 이후 재연결 시 다시 생성된다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();

    simulateRemoteUserLeave();
    vi.advanceTimersByTime(GRACE_MS);

    expect(removeRemotePlayerMock).toHaveBeenCalledWith(REMOTE_USER_ID);
    expect(removeRemotePlayerMock).toHaveBeenCalledTimes(1);

    simulateRemoteUserJoin();

    expect(updateRemotePlayerMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: REMOTE_USER_ID }),
    );

    // stale 타이머로 인한 중복 삭제가 없어야 한다.
    vi.advanceTimersByTime(GRACE_MS * 2);
    expect(removeRemotePlayerMock).toHaveBeenCalledTimes(1);
  });

  it("C. 실제 접속 종료(재연결 없음)는 정상적으로 삭제되고 계속 삭제 상태로 유지된다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();

    simulateRemoteUserLeave();
    vi.advanceTimersByTime(GRACE_MS);

    expect(removeRemotePlayerMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(GRACE_MS * 5);

    expect(removeRemotePlayerMock).toHaveBeenCalledTimes(1);
  });

  it("D. grace 경계 바로 직전에 재연결되면 취소된 타이머가 뒤늦게 실행되지 않는다(stale timeout race 없음)", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();

    simulateRemoteUserLeave();
    vi.advanceTimersByTime(GRACE_MS - 1);
    simulateRemoteUserJoin();
    vi.advanceTimersByTime(1);

    expect(removeRemotePlayerMock).not.toHaveBeenCalledWith(REMOTE_USER_ID);
  });

  it("E. 짧은 단절이 반복돼도(모두 grace 이내 재연결) 삭제가 발생하지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();

    const shortFlapMs = Math.floor(GRACE_MS / 4);

    for (let i = 0; i < 3; i += 1) {
      simulateRemoteUserLeave();
      vi.advanceTimersByTime(shortFlapMs);
      simulateRemoteUserJoin();
      vi.advanceTimersByTime(shortFlapMs);
    }

    expect(removeRemotePlayerMock).not.toHaveBeenCalledWith(REMOTE_USER_ID);
  });

  it("정상 퇴장 뒤 이전 presence와 위치가 늦게 와도 캐릭터를 다시 만들지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = {
      userId: REMOTE_USER_ID,
      joinedAt: "2026-10-14T12:00:00.000Z",
      villageId: "lobby",
      position: { x: 5, y: 5 },
    };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    updateRemotePlayerMock.mockClear();

    presenceStateMock.mockReturnValue({ [REMOTE_USER_ID]: [oldPlayer] });
    presenceHandler?.("sync");
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("player_move", oldPlayer);

    expect(updateRemotePlayerMock).not.toHaveBeenCalled();
    expect(movementState.remotePlayers[REMOTE_USER_ID]).toBeUndefined();
  });

  it("재입장은 허용하고 이전 방문의 늦은 퇴장·위치 신호는 새 캐릭터에 적용하지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = {
      userId: REMOTE_USER_ID,
      joinedAt: "2026-10-14T12:00:00.000Z",
      sessionId: "old-visit",
      villageId: "lobby",
      position: { x: 5, y: 5 },
    };
    const newPlayer = { ...oldPlayer, sessionId: "new-visit" };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    broadcastHandler?.("player_move", newPlayer);
    expect(movementState.remotePlayers[REMOTE_USER_ID]?.sessionId).toBe(newPlayer.sessionId);

    broadcastHandler?.("sync-leave", oldPlayer);
    broadcastHandler?.("player_move", oldPlayer);
    expect(movementState.remotePlayers[REMOTE_USER_ID]?.sessionId).toBe(newPlayer.sessionId);

    broadcastHandler?.("sync-leave", newPlayer);
    presenceStateMock.mockReturnValue({ [REMOTE_USER_ID]: [oldPlayer, newPlayer] });
    presenceHandler?.("sync");
    expect(movementState.remotePlayers[REMOTE_USER_ID]).toBeUndefined();
  });

  it("퇴장 이력 뒤 식별자 없는 지연 위치가 새 방문의 좌표를 덮어쓰지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = {
      userId: REMOTE_USER_ID,
      sessionId: "old-visit",
      villageId: "lobby",
      position: { x: 1, y: 1 },
    };
    const newPlayer = { ...oldPlayer, sessionId: "new-visit", position: { x: 8, y: 8 } };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    broadcastHandler?.("player_move", newPlayer);

    broadcastHandler?.("player_move", {
      userId: REMOTE_USER_ID,
      villageId: "lobby",
      position: { x: 1, y: 1 },
    });

    expect(movementState.remotePlayers[REMOTE_USER_ID]).toEqual(
      expect.objectContaining({ sessionId: "new-visit", position: { x: 8, y: 8 } }),
    );
  });

  it("식별자 없는 지연 퇴장은 새 방문의 캐릭터를 제거하지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = { userId: REMOTE_USER_ID, sessionId: "old-visit", villageId: "lobby" };
    const newPlayer = { ...oldPlayer, sessionId: "new-visit" };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    presenceHandler?.("join", { newPresences: [newPlayer] });

    broadcastHandler?.("sync-leave", { userId: REMOTE_USER_ID });

    expect(movementState.remotePlayers[REMOTE_USER_ID]?.sessionId).toBe("new-visit");
  });

  it("새 방문이 끊겼을 때 이전 방문의 stale snapshot이 grace 확정을 막지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = { userId: REMOTE_USER_ID, joinedAt: "old", villageId: "lobby" };
    const newPlayer = { ...oldPlayer, joinedAt: "new" };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    presenceHandler?.("join", { newPresences: [newPlayer] });
    presenceStateMock.mockReturnValue({ [REMOTE_USER_ID]: [oldPlayer] });
    presenceHandler?.("leave", { leftPresences: [newPlayer] });
    vi.advanceTimersByTime(GRACE_MS);
    expect(movementState.remotePlayers[REMOTE_USER_ID]).toBeUndefined();
  });

  it("방문 식별자 없는 오래된 snapshot은 새 방문의 grace 확정을 막지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");
    useMovementSync();
    const oldPlayer = { userId: REMOTE_USER_ID, sessionId: "old-visit", villageId: "lobby" };
    const newPlayer = { ...oldPlayer, sessionId: "new-visit" };
    presenceHandler?.("join", { newPresences: [oldPlayer] });
    broadcastHandler?.("sync-leave", oldPlayer);
    presenceHandler?.("join", { newPresences: [newPlayer] });
    presenceStateMock.mockReturnValue({ [REMOTE_USER_ID]: [{ userId: REMOTE_USER_ID }] });
    presenceHandler?.("leave", { leftPresences: [newPlayer] });

    vi.advanceTimersByTime(GRACE_MS);

    expect(movementState.remotePlayers[REMOTE_USER_ID]).toBeUndefined();
  });
});
