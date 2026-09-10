import { DEPARTURE_GRACE_MS } from "@/shared/lib/realtime/departureGrace";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PresenceParticipant } from "../types";

let channelStatus: string = "SUBSCRIBED";

vi.mock("@/shared/lib/realtime/townChannelManager", () => ({
  getTownChannelStatus: () => channelStatus,
}));

const ME: PresenceParticipant = {
  userId: "me",
  nickname: "나",
  presenceRef: "ref-me",
  villageId: "lobby",
};

const REMOTE: PresenceParticipant = {
  userId: "remote-a",
  nickname: "원격 유저",
  presenceRef: "ref-remote",
  villageId: "lobby",
};

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

  it("이미 목록에 없는 userId에는 아무 동작도 하지 않는다", async () => {
    const useTownPresenceStore = await importStore();

    useTownPresenceStore.getState().setParticipants([ME], ME.userId);
    const before = useTownPresenceStore.getState().participants;

    useTownPresenceStore.getState().markParticipantDeparted("ghost");

    expect(useTownPresenceStore.getState().participants).toBe(before);
  });
});
