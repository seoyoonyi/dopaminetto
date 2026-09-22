// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "town-presence-settings";

describe("usePresenceNotificationStore", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("저장된 설정이 없으면 입장·퇴장 알림을 켠 상태로 시작한다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");

    expect(usePresenceNotificationStore.getState().isPresenceNotificationEnabled).toBe(true);
  });

  it("입장·퇴장 알림 상태를 반전할 수 있다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");

    usePresenceNotificationStore.getState().togglePresenceNotification();

    expect(usePresenceNotificationStore.getState().isPresenceNotificationEnabled).toBe(false);
  });

  it("변경한 알림 설정만 localStorage에 저장하고 store 재생성 후 복원한다", async () => {
    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");

    usePresenceNotificationStore.getState().togglePresenceNotification();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      state: { isPresenceNotificationEnabled: false },
      version: 1,
    });

    vi.resetModules();
    const { usePresenceNotificationStore: reloadedStore } =
      await import("./usePresenceNotificationStore");
    expect(reloadedStore.getState().isPresenceNotificationEnabled).toBe(false);
  });

  it("저장된 알림 설정이 boolean이 아니면 기본값 ON으로 복구한다", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { isPresenceNotificationEnabled: "false" }, version: 1 }),
    );

    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");

    expect(usePresenceNotificationStore.getState().isPresenceNotificationEnabled).toBe(true);
  });

  it("저장된 JSON이 손상됐으면 기본값 ON으로 시작한다", async () => {
    localStorage.setItem(STORAGE_KEY, "{broken");

    const { usePresenceNotificationStore } = await import("./usePresenceNotificationStore");

    expect(usePresenceNotificationStore.getState().isPresenceNotificationEnabled).toBe(true);
  });
});
