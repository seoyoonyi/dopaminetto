import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeChannel {
  presenceState: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  untrack: ReturnType<typeof vi.fn>;
}

const createFakeChannel = (): FakeChannel => ({
  presenceState: vi.fn(() => ({})),
  send: vi.fn().mockResolvedValue("ok"),
  track: vi.fn().mockResolvedValue("ok"),
  untrack: vi.fn().mockResolvedValue("ok"),
});

let channels: Record<string, FakeChannel> = {};
let presenceHandlers: Record<string, (event: string, payload?: unknown) => void> = {};

const acquireTownChannelMock = vi.fn(() => vi.fn());
const removeRemotePlayerMock = vi.fn();
const removeRemotePlayersOutsideVillagesMock = vi.fn();

const movementState = {
  villageId: "lobby",
  nickname: "로컬 사용자",
  characterId: "p-boy",
  lastSyncedPosition: { x: 120, y: 240 },
  localActionState: null,
  remotePlayers: {},
  setNickname: vi.fn(),
  setCharacterId: vi.fn(),
  setUserId: vi.fn(),
  updateRemotePlayer: vi.fn(),
  removeRemotePlayer: removeRemotePlayerMock,
  removeRemotePlayersOutsideVillages: removeRemotePlayersOutsideVillagesMock,
};

// village 전환처럼 "같은 컴포넌트 인스턴스가 여러 번 리렌더된다"를 재현하려면
// syncStateRef가 useMovementSync() 재호출 사이에도 유지되어야 한다.
let persistentSyncStateRef: { current: unknown } | undefined;

vi.mock("react", () => ({
  useEffect: (effect: () => void) => {
    effect();
  },
  useRef: <T>(initialValue: T) => {
    if (!persistentSyncStateRef) {
      persistentSyncStateRef = { current: initialValue };
    }
    return persistentSyncStateRef as { current: T };
  },
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T>(selector: T) => selector,
}));

vi.mock("@/app/providers/SupabaseProvider", () => ({
  useSupabase: () => ({}),
}));

// 프로덕션 getVisibleVillages는 항상 전체 village를 반환하므로(visibility.ts), mock도 이를 반영한다.
vi.mock("@/entities/village", () => ({
  getVisibleVillages: () => ["lobby", "riverside"],
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
  acquireTownChannel: () => acquireTownChannelMock(),
  getTownChannel: (channelName: string) => channels[channelName],
  getTownChannelStatus: () => "SUBSCRIBED",
  observeTownChannelBroadcast: () => vi.fn(),
  observeTownChannelPresence: (
    channelName: string,
    handler: (event: string, payload?: unknown) => void,
  ) => {
    presenceHandlers[channelName] = handler;
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

const syncLeaveCallsFor = (channelName: string) =>
  channels[channelName].send.mock.calls.filter(
    ([message]) => (message as { event?: string })?.event === "sync-leave",
  );

describe("useMovementSync village 전환", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    persistentSyncStateRef = undefined;
    presenceHandlers = {};
    movementState.villageId = "lobby";
    channels = {
      "village:lobby": createFakeChannel(),
      "village:riverside": createFakeChannel(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("로컬 유저가 village 간 이동할 때 sync-leave를 브로드캐스트하지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync();

    movementState.villageId = "riverside";
    useMovementSync();

    expect(syncLeaveCallsFor("village:lobby")).toHaveLength(0);
  });

  it("서버 주도의 grace 보호 leave가 여전히 발생하도록 이전 village 채널은 untrack한다", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync();

    movementState.villageId = "riverside";
    useMovementSync();

    expect(channels["village:lobby"].untrack).toHaveBeenCalledTimes(1);
  });

  it("전환 후 새로 진입한 village 채널에 presence를 track한다", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync();
    channels["village:riverside"].track.mockClear();

    movementState.villageId = "riverside";
    useMovementSync();

    expect(channels["village:riverside"].track).toHaveBeenCalled();
  });

  it("반복적인 왕복 전환에서도 채널 바인딩이 중복되거나 untrack 호출이 새지 않는다", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync(); // lobby (initial)

    movementState.villageId = "riverside";
    useMovementSync(); // lobby -> riverside

    movementState.villageId = "lobby";
    useMovementSync(); // riverside -> lobby

    movementState.villageId = "riverside";
    useMovementSync(); // lobby -> riverside

    // village당 최초 1회만 채널을 획득한다(반복 전환으로 재획득하지 않음).
    expect(acquireTownChannelMock).toHaveBeenCalledTimes(2);

    // 전환 3회(lobby→riverside→lobby→riverside) 기준 untrack 횟수.
    expect(channels["village:lobby"].untrack).toHaveBeenCalledTimes(2);
    expect(channels["village:riverside"].untrack).toHaveBeenCalledTimes(1);

    // 반복 전환 중에도 sync-leave는 발생하지 않아야 한다(깜빡임 방지).
    expect(syncLeaveCallsFor("village:lobby")).toHaveLength(0);
    expect(syncLeaveCallsFor("village:riverside")).toHaveLength(0);
  });

  it("실제 접속 종료(cleanupAllChannels) 시에는 여전히 즉시 sync-leave를 브로드캐스트한다", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync(); // tracked village: lobby

    useMovementSync(false); // enabled=false -> 실제 접속 종료 경로

    expect(syncLeaveCallsFor("village:lobby").length).toBeGreaterThanOrEqual(1);
  });
});
