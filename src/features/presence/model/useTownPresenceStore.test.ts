// @vitest-environment jsdom
import { DEPARTURE_GRACE_MS } from "@/shared/lib/realtime/departureGrace";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PresenceParticipant } from "../types";

let channelStatus: string = "SUBSCRIBED";

const toastMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/shared/lib/realtime/townChannelManager", () => ({
  getTownChannelStatus: () => channelStatus,
}));

const ME = {
  userId: "me",
  playerId: "player-me",
  nickname: "나",
  presenceRef: "ref-me",
  villageId: "lobby",
} satisfies PresenceParticipant;

const REMOTE = {
  userId: "remote-a",
  playerId: "player-remote-a",
  nickname: "원격 유저",
  presenceRef: "ref-remote",
  villageId: "lobby",
} satisfies PresenceParticipant;

describe("useTownPresenceStore 입장·퇴장 알림 설정", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    toastMock.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("presence 상태를 초기화해도 사용자가 선택한 알림 설정은 유지한다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    usePresenceNotificationStore.getState().togglePresenceNotification();

    useTownPresenceStore.getState().reset();

    expect(usePresenceNotificationStore.getState().isPresenceNotificationEnabled).toBe(false);
  });

  it("알림이 OFF여도 참여자를 추가하지만 입장 toast는 표시하지 않는다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    usePresenceNotificationStore.setState({ isPresenceNotificationEnabled: false });

    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);

    expect(toastMock).not.toHaveBeenCalled();
    expect(
      useTownPresenceStore.getState().participants.map((participant) => participant.userId),
    ).toEqual([ME.userId, REMOTE.userId]);
  });

  it("알림이 OFF여도 참여자를 제거하지만 퇴장 toast는 표시하지 않는다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    usePresenceNotificationStore.setState({ isPresenceNotificationEnabled: false });
    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    toastMock.mockClear();

    useTownPresenceStore.getState().markParticipantDeparted(REMOTE.userId);

    expect(toastMock).not.toHaveBeenCalled();
    expect(
      useTownPresenceStore.getState().participants.map((participant) => participant.userId),
    ).toEqual([ME.userId]);
  });

  it("알림이 ON이면 다른 사용자의 입장·퇴장 toast만 표시한다", async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    const { usePlayerRenderStore } = await import("@/entities/player");

    usePlayerRenderStore.getState().publishRenderedPlayers([ME.playerId]);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    usePlayerRenderStore.getState().publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    usePlayerRenderStore.getState().publishRenderedPlayers([ME.playerId]);
    useTownPresenceStore.getState().markParticipantDeparted(REMOTE.userId);

    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenNthCalledWith(1, "원격 유저님이 입장했습니다.", {
      duration: 3000,
    });
    expect(toastMock).toHaveBeenNthCalledWith(2, "원격 유저님이 퇴장했습니다.", {
      duration: 3000,
    });
  });
});

describe("입퇴장 알림과 실제 렌더 상태 동기화", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    toastMock.mockClear();
    channelStatus = "SUBSCRIBED";
  });

  const setup = async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    const { usePlayerRenderStore } = await import("@/entities/player");
    const presence = useTownPresenceStore.getState();
    const render = usePlayerRenderStore.getState();
    render.publishRenderedPlayers([ME.playerId]);
    presence.setParticipants([ME], ME.userId);
    toastMock.mockClear();
    return { presence, render };
  };

  it("최초 본인 presence만 도착했을 때 캐릭터보다 먼저 알리지 않는다", async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("본인은 첫 렌더와 반복 presence 수신 이후에도 입장 알림을 표시하지 않는다", async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    const { usePlayerRenderStore } = await import("@/entities/player");
    const presence = useTownPresenceStore.getState();
    presence.setParticipants([ME], ME.userId);
    usePlayerRenderStore.getState().publishRenderedPlayers([ME.playerId]);
    presence.flushPendingNotifications();
    presence.setParticipants([ME], ME.userId);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("다른 사용자의 playerId가 늦게 보강되면 알림 대기를 해제한다", async () => {
    const { presence, render } = await setup();
    presence.setParticipants([ME, { ...REMOTE, playerId: undefined }], ME.userId);
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
    presence.setParticipants([ME, REMOTE], ME.userId);
    expect(toastMock).toHaveBeenCalledExactlyOnceWith("원격 유저님이 입장했습니다.", {
      duration: 3000,
    });
  });

  it("playerId 없는 구버전 참여자의 목록은 갱신하되 제거 완료를 추측해 알리지 않는다", async () => {
    const { presence, render } = await setup();
    presence.setParticipants([ME, { ...REMOTE, playerId: undefined }], ME.userId);
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    presence.markParticipantDeparted(REMOTE.userId);
    expect(toastMock).not.toHaveBeenCalled();
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toEqual([ME.userId]);
  });

  it("입장 presence가 먼저 도착하면 실제 렌더 후 한 번 알린다", async () => {
    const { presence, render } = await setup();
    presence.setParticipants([ME, REMOTE], ME.userId);
    expect(toastMock).not.toHaveBeenCalled();
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    presence.setParticipants([ME, REMOTE], ME.userId);
    presence.flushPendingNotifications();
    expect(toastMock).toHaveBeenCalledExactlyOnceWith("원격 유저님이 입장했습니다.", {
      duration: 3000,
    });
  });

  it("입장 렌더가 먼저 완료돼도 presence에서 신규 입장일 때만 알린다", async () => {
    const { presence, render } = await setup();
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
    presence.setParticipants([ME, REMOTE], ME.userId);
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "퇴장 렌더 우선=%s에서도 두 조건이 충족돼야 알린다",
    async (renderFirst) => {
      const { presence, render } = await setup();
      render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
      presence.setParticipants([ME, REMOTE], ME.userId);
      toastMock.mockClear();
      if (renderFirst) {
        render.publishRenderedPlayers([ME.playerId]);
        presence.flushPendingNotifications();
      } else {
        presence.markParticipantDeparted(REMOTE.userId);
      }
      expect(toastMock).not.toHaveBeenCalled();
      if (renderFirst) presence.markParticipantDeparted(REMOTE.userId);
      else render.publishRenderedPlayers([ME.playerId]);
      presence.flushPendingNotifications();
      presence.markParticipantDeparted(REMOTE.userId);
      expect(toastMock).toHaveBeenCalledExactlyOnceWith("원격 유저님이 퇴장했습니다.", {
        duration: 3000,
      });
    },
  );

  it("표시되지 않은 입장 후보가 곧바로 퇴장하면 과거 알림을 재생하지 않는다", async () => {
    const { presence, render } = await setup();
    presence.setParticipants([ME, REMOTE], ME.userId);
    presence.markParticipantDeparted(REMOTE.userId);
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    render.publishRenderedPlayers([ME.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("퇴장 알림 대기 중 재입장하면 오래된 퇴장과 중복 입장을 취소한다", async () => {
    const { presence, render } = await setup();
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.setParticipants([ME, REMOTE], ME.userId);
    toastMock.mockClear();
    presence.markParticipantDeparted(REMOTE.userId);
    presence.setParticipants([ME, { ...REMOTE, presenceRef: "ref-rejoined" }], ME.userId);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("빌리지 이동과 렌더 재생성만으로 입퇴장 알림을 만들지 않는다", async () => {
    const { presence, render } = await setup();
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.setParticipants([ME, REMOTE], ME.userId);
    toastMock.mockClear();
    render.publishRenderedPlayers([ME.playerId]);
    presence.flushPendingNotifications();
    presence.setParticipants([ME, { ...REMOTE, villageId: "village-a" }], ME.userId);
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("대기 중 알림 OFF를 처리한 뒤 ON으로 바꿔도 과거 알림을 표시하지 않는다", async () => {
    const { presence, render } = await setup();
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");
    presence.setParticipants([ME, REMOTE], ME.userId);
    usePresenceNotificationStore.setState({ isPresenceNotificationEnabled: false });
    presence.flushPendingNotifications();
    usePresenceNotificationStore.setState({ isPresenceNotificationEnabled: true });
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("Scene 준비 전 빈 상태를 퇴장 렌더 완료로 해석하지 않는다", async () => {
    const { presence, render } = await setup();
    render.publishRenderedPlayers([ME.playerId, REMOTE.playerId]);
    presence.setParticipants([ME, REMOTE], ME.userId);
    toastMock.mockClear();
    render.reset();
    presence.markParticipantDeparted(REMOTE.userId);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
    presence.reset();
    render.publishRenderedPlayers([ME.playerId]);
    presence.flushPendingNotifications();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("useTownPresenceStore departure grace 통합", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    channelStatus = "SUBSCRIBED";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const importStore = async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    return useTownPresenceStore;
  };

  it("스냅샷에서 빠지자마자 즉시 참여자를 제거하지 않는다(grace 적용)", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toEqual(
      expect.arrayContaining([ME.userId, REMOTE.userId]),
    );

    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(
      REMOTE.userId,
    );
  });

  it("채널이 SUBSCRIBED 상태를 유지한 채 grace가 만료되면 참여자를 제거한다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      REMOTE.userId,
    );
  });

  it("grace 만료 전에 다시 나타나면 참여자를 유지한다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    vi.advanceTimersByTime(Math.floor(DEPARTURE_GRACE_MS / 2));
    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(
      REMOTE.userId,
    );
  });

  it("grace 만료 시점에 town:main이 재연결 중이면 제거를 유예하고, 재연결 후 fresh sync가 도착하면 확정한다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    channelStatus = "SUBSCRIBING";
    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);

    // grace가 만료됐지만 채널이 재연결 중이므로 아직 삭제되지 않는다.
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(
      REMOTE.userId,
    );

    channelStatus = "SUBSCRIBED";
    // 재연결 완료 후 도착한 fresh sync에서 여전히 없으면 그제서야 확정 삭제된다.
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      REMOTE.userId,
    );
  });

  it("재연결 이후 첫 sync에 다시 포함돼 있으면 재연결로 유예된 참여자를 삭제하지 않는다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    channelStatus = "SUBSCRIBING";
    vi.advanceTimersByTime(DEPARTURE_GRACE_MS);

    channelStatus = "SUBSCRIBED";
    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(
      REMOTE.userId,
    );
  });

  it("reset()은 대기 중인 grace 타이머를 정리해 오래된 상태에 대해 실행되지 않도록 한다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);

    useTownPresenceStore.getState().reset();
    vi.advanceTimersByTime(DEPARTURE_GRACE_MS * 2);

    expect(useTownPresenceStore.getState().participants).toEqual([]);
  });
});

describe("useTownPresenceStore: 정상 퇴장 신호 즉시 반영", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    channelStatus = "SUBSCRIBED";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const importStore = async () => {
    const { useTownPresenceStore } = await import("./useTownPresenceStore");
    return useTownPresenceStore;
  };

  it("markParticipantDeparted는 grace를 기다리지 않고 즉시 참여자를 제거한다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().markParticipantDeparted(REMOTE.userId);

    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      REMOTE.userId,
    );
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(ME.userId);
  });

  it("grace 대기 중이던 참여자도 신호가 오면 즉시 확정하고 뒤늦은 타이머는 부작용이 없다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME, REMOTE], ME.userId);
    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toContain(
      REMOTE.userId,
    );

    useTownPresenceStore.getState().markParticipantDeparted(REMOTE.userId);
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).not.toContain(
      REMOTE.userId,
    );

    vi.advanceTimersByTime(DEPARTURE_GRACE_MS * 2);
    expect(useTownPresenceStore.getState().participants.map((p) => p.userId)).toEqual([ME.userId]);
  });

  it("정상 퇴장 뒤 이전 presence 스냅샷이 다시 와도 목록과 인원이 되살아나지 않는다", async () => {
    const store = await importStore();
    store.getState().setParticipants([ME, REMOTE], ME.userId);
    store.getState().markParticipantDeparted(REMOTE.userId);
    store.getState().setParticipants([ME, REMOTE], ME.userId);
    store.getState().setParticipants([ME, REMOTE], ME.userId);

    expect(store.getState().participants).toEqual([ME]);
    expect(store.getState().groupedParticipants.lobby).toEqual([ME]);
  });

  it("퇴장 직후 새 presenceRef로 재입장하면 누락 없이 반영한다", async () => {
    const store = await importStore();
    store.getState().setParticipants([ME, REMOTE], ME.userId);
    store.getState().markParticipantDeparted(REMOTE.userId);
    const rejoined = { ...REMOTE, presenceRef: "ref-rejoined" };
    store.getState().setParticipants([ME, REMOTE, rejoined], ME.userId);

    expect(store.getState().participants).toEqual([ME, rejoined]);
  });

  it("이미 목록에 없는 userId에는 아무 동작도 하지 않는다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    const before = useTownPresenceStore.getState().participants;

    useTownPresenceStore.getState().markParticipantDeparted("ghost");

    expect(useTownPresenceStore.getState().participants).toBe(before);
  });

  it("정상 퇴장 기록도 reset 시 정리해 다음 방문의 초기 목록을 막지 않는다", async () => {
    const store = await importStore();
    store.getState().setParticipants([ME, REMOTE], ME.userId);
    store.getState().markParticipantDeparted(REMOTE.userId);
    store.getState().reset();
    store.getState().setParticipants([ME, REMOTE], ME.userId);

    expect(store.getState().participants).toEqual([ME, REMOTE]);
  });

  it("빠르게 두 번 입퇴장해 이전 등록들이 함께 남아도 모두 제외한다", async () => {
    const store = await importStore();
    store.getState().setParticipants([ME, REMOTE], ME.userId);
    store.getState().markParticipantDeparted(REMOTE.userId);
    const rejoined = { ...REMOTE, presenceRef: "ref-rejoined" };
    store.getState().setParticipants([ME, REMOTE, rejoined], ME.userId);
    store.getState().markParticipantDeparted(REMOTE.userId);
    store.getState().setParticipants([ME, REMOTE, rejoined], ME.userId);

    expect(store.getState().participants).toEqual([ME]);
  });
});
