// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "listener-broadcast-volume";

describe("useListeningVolumeStore", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const importStore = async () => {
    const { useListeningVolumeStore } = await import("./useListeningVolumeStore");
    return useListeningVolumeStore;
  };

  it("기본 음량은 100%이고 설정값을 브라우저 저장소에 유지한다", async () => {
    const useListeningVolumeStore = await importStore();

    expect(useListeningVolumeStore.getState().listeningVolume).toBe(1);

    useListeningVolumeStore.getState().setListeningVolume(0.3);

    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0.3);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state.listeningVolume).toBe(0.3);
  });

  it("저장된 음량을 다시 불러온다", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { listeningVolume: 0.8 }, version: 0 }),
    );

    const useListeningVolumeStore = await importStore();

    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0.8);
  });

  it("음량을 0부터 1 사이로 제한한다", async () => {
    const useListeningVolumeStore = await importStore();

    useListeningVolumeStore.getState().setListeningVolume(-1);
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0);

    useListeningVolumeStore.getState().setListeningVolume(2);
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(1);
  });
});
