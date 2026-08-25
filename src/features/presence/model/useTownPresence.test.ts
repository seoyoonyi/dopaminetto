import { DEPARTURE_GRACE_MS } from "@/shared/lib/realtime/departureGrace";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 회귀 테스트: town:main channel 객체가 재연결로 새로 만들어질 때(아직 서버 sync를
 * 받기 전) useTownPresence.ts가 presenceState()를 즉시 읽어 setParticipants()를
 * 호출하던 버그(#173)를 검증한다. 새로고침 없이도, 실제로 퇴장한 참여자가 서버가
 * 보낸 fresh presence sync만으로 정상 제거되는지가 핵심이다.
 *
 * useMovementSync.remotePlayerReconnectGrace.test.ts와 동일하게, jsdom/testing-library
 * 없이 react의 useEffect를 "즉시 실행"으로 모킹해 훅을 순수 함수처럼 호출한다.
 */

let channelStatus = "SUBSCRIBED";

type FakeChannel = { presenceState: () => Record<string, unknown[]> };

let currentChannel: FakeChannel | null = null;
let presenceHandler: ((event: string, payload?: unknown) => void) | undefined;

const subscribeToPresenceMock = vi.fn((callback: (event: string, payload?: unknown) => void) => {
  presenceHandler = callback;
  return vi.fn();
});

vi.mock("react", () => ({
  useEffect: (effect: () => void) => effect(),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T>(selector: T) => selector,
}));

vi.mock("@/entities/village", () => ({
  LOBBY_VILLAGE_ID: "lobby",
  VILLAGES: { lobby: {} },
}));

vi.mock("@/features/movement/model/useMovementStore", () => ({
  useMovementStore: (selector: (state: { villageId: string }) => unknown) =>
    selector({ villageId: "lobby" }),
}));

vi.mock("@/shared/constants", () => ({
  PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS: 0,
}));

vi.mock("@/shared/hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T>(value: T) => value,
}));

vi.mock("@/shared/hooks/useUserInfo", () => ({
  useUserInfo: () => ({ data: { id: "me", user_metadata: { nickname: "나" } } }),
}));

vi.mock("@/shared/hooks/useTownChannel", () => ({
  useTownChannel: () => ({
    channel: currentChannel,
    status: channelStatus,
    isConnected: channelStatus === "SUBSCRIBED",
    reconnect: vi.fn(),
    subscribeToPresence: subscribeToPresenceMock,
  }),
}));

vi.mock("@/shared/lib/realtime/townChannelManager", () => ({
  getTownChannelStatus: () => channelStatus,
}));

vi.mock("@/features/presence/model/useTownPresenceStore", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/presence/model/useTownPresenceStore")
  >("@/features/presence/model/useTownPresenceStore");
  const realStore = actual.useTownPresenceStore;

  const hook = ((selector?: (state: ReturnType<typeof realStore.getState>) => unknown) =>
    selector ? selector(realStore.getState()) : realStore.getState()) as typeof realStore;

  return { useTownPresenceStore: Object.assign(hook, realStore) };
});

const presenceStateOf = (participants: { userId: string; nickname: string }[]) =>
  Object.fromEntries(
    participants.map((p) => [
      p.userId,
      [
        {
          userId: p.userId,
          nickname: p.nickname,
          presence_ref: `ref-${p.userId}`,
          villageId: "lobby",
        },
      ],
    ]),
  );

const ME = { userId: "me", nickname: "나" };
const REMOTE_A = { userId: "remote-a", nickname: "A" };
const REMOTE_B = { userId: "remote-b", nickname: "B" };

describe("useTownPresence: town:main 재연결 시 stale participant 회귀 방지", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    channelStatus = "SUBSCRIBED";
    currentChannel = null;
    presenceHandler = undefined;

    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    useTownPresenceStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("channel 참조가 바뀌어도(재연결) 실제 sync 이벤트가 오기 전에는 참여자 목록을 비우지 않는다", async () => {
    const { useTownPresence } = await import("./useTownPresence");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");

    currentChannel = { presenceState: () => presenceStateOf([ME, REMOTE_A, REMOTE_B]) };
    useTownPresence();
    presenceHandler?.("sync");

    expect(
      useTownPresenceStore
        .getState()
        .participants.map((p) => p.userId)
        .sort(),
    ).toEqual(["me", "remote-a", "remote-b"].sort());

    // 재연결: 새 channel 객체가 만들어졌지만 아직 subscribe가 끝나지 않아 presenceState()가 비어 있다.
    currentChannel = { presenceState: () => ({}) };
    useTownPresence();

    expect(
      useTownPresenceStore
        .getState()
        .participants.map((p) => p.userId)
        .sort(),
    ).toEqual(["me", "remote-a", "remote-b"].sort());
  });

  it("서버가 보낸 fresh presence sync만 참여자 목록에 반영된다", async () => {
    const { useTownPresence } = await import("./useTownPresence");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");

    currentChannel = { presenceState: () => presenceStateOf([ME, REMOTE_A]) };
    useTownPresence();
    presenceHandler?.("sync");

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain("remote-a");

    currentChannel = { presenceState: () => presenceStateOf([ME, REMOTE_A, REMOTE_B]) };
    useTownPresence();
    // 아직 진짜 이벤트가 없으므로 B는 반영되지 않는다.
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      "remote-b",
    );

    presenceHandler?.("join", { newPresences: [REMOTE_B] });
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain("remote-b");
  });

  it("새로고침 없이 reconnect 이후에도 실제로 퇴장한 참여자가 grace 만료 후 제거된다", async () => {
    const { useTownPresence } = await import("./useTownPresence");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");

    currentChannel = { presenceState: () => presenceStateOf([ME, REMOTE_A, REMOTE_B]) };
    useTownPresence();
    presenceHandler?.("sync");

    // town:main 재연결로 channel 객체가 바뀐다. 서버 sync는 아직 오지 않았다(진짜
    // 이벤트를 발생시키지 않음) — 수정 전 코드라면 여기서 즉시 presenceState()를
    // 읽어 빈 스냅샷을 authoritative로 취급, A/B 모두를 이탈 후보로 잘못 예약한다.
    currentChannel = { presenceState: () => ({}) };
    useTownPresence();

    // 이후 아무 presence 이벤트도 없이(=관찰자도 상대도 조용히 안정화) grace가
    // 다 지나가도, 실제로는 아무도 퇴장하지 않았으므로 전원 그대로 남아있어야 한다.
    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);
    expect(
      useTownPresenceStore
        .getState()
        .participants.map((p) => p.userId)
        .sort(),
    ).toEqual(["me", "remote-a", "remote-b"].sort());

    // B가 실제로 퇴장한 뒤, 재연결이 안정화되고 서버가 fresh sync를 보낸다.
    currentChannel = { presenceState: () => presenceStateOf([ME, REMOTE_A]) };
    useTownPresence();
    presenceHandler?.("sync");

    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      "remote-b",
    );
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toEqual(
      expect.arrayContaining(["me", "remote-a"]),
    );
  });
});
