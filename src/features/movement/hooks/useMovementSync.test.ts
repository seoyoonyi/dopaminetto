import { beforeEach, describe, expect, it, vi } from "vitest";

const channelTrackMock = vi.fn().mockResolvedValue("ok");
const channelSendMock = vi.fn().mockResolvedValue("ok");
const presenceStateMock = vi.fn(() => ({}));
const observePresenceMock = vi.fn();
const observeStatusMock = vi.fn();
const observeBroadcastMock = vi.fn();
const removeRemotePlayerMock = vi.fn();
const removeRemotePlayersOutsideVillagesMock = vi.fn();
const setUserIdMock = vi.fn();
const setNicknameMock = vi.fn();
const setCharacterIdMock = vi.fn();

let presenceHandler: ((event: string, payload?: unknown) => void) | undefined;

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
  remotePlayers: {},
  setNickname: setNicknameMock,
  setCharacterId: setCharacterIdMock,
  setUserId: setUserIdMock,
  updateRemotePlayer: vi.fn(),
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
  observeTownChannelBroadcast: (...args: unknown[]) => observeBroadcastMock(...args),
  observeTownChannelPresence: (_channelName: string, handler: typeof presenceHandler) => {
    presenceHandler = handler;
    observePresenceMock();
    return vi.fn();
  },
  observeTownChannelStatus: (...args: unknown[]) => observeStatusMock(...args),
  reconnectTownChannel: vi.fn(),
}));

vi.mock("@/shared/store/useUserStore", () => ({
  useUserStore: () => ({
    selectedCharacterId: "p-boy",
    userId: "local-user",
    userNickname: "로컬 사용자",
  }),
}));

describe("useMovementSync presence join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presenceHandler = undefined;
  });

  it("tracks the local latest position when a remote user joins", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync();
    const initialTrackCount = channelTrackMock.mock.calls.length;

    presenceHandler?.("join", {
      newPresences: [{ userId: "remote-user", villageId: "lobby", position: { x: 1, y: 2 } }],
    });

    expect(channelTrackMock).toHaveBeenCalledTimes(initialTrackCount + 1);
    expect(channelTrackMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: { x: 120, y: 240 },
        userId: "local-user",
      }),
    );
  });

  it("does not retrack when the joining presence belongs to the local user", async () => {
    const { useMovementSync } = await import("./useMovementSync");

    useMovementSync();
    const initialTrackCount = channelTrackMock.mock.calls.length;

    presenceHandler?.("join", {
      newPresences: [{ userId: "local-user", villageId: "lobby", position: { x: 1, y: 2 } }],
    });

    expect(channelTrackMock).toHaveBeenCalledTimes(initialTrackCount);
  });
});
