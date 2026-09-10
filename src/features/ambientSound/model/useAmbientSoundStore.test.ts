// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "ambient-sound-settings";

const importStore = async () => (await import("./useAmbientSoundStore")).useAmbientSoundStore;
const seed = (state: unknown, version = 1) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("useAmbientSoundStore", () => {
  it("기본값은 volume 1, isMuted false", async () => {
    const store = await importStore();
    expect(store.getState()).toMatchObject({ volume: 1, isMuted: false });
  });

  it("변경값을 저장하고 새 store 인스턴스에서 복원한다", async () => {
    const store = await importStore();
    store.getState().setVolume(0.4);
    store.getState().toggleMute();

    vi.resetModules();
    const restored = await importStore();
    expect(restored).not.toBe(store);
    expect(restored.getState()).toMatchObject({ volume: 0.4, isMuted: true });

    restored.getState().toggleMute();
    expect(restored.getState()).toMatchObject({ volume: 0.4, isMuted: false });
  });

  it("setVolume과 toggleMute는 서로 독립적이다 (volume 0 ≠ 음소거)", async () => {
    const store = await importStore();
    store.getState().toggleMute();
    store.getState().setVolume(0);
    expect(store.getState()).toMatchObject({ volume: 0, isMuted: true });

    store.getState().toggleMute();
    expect(store.getState()).toMatchObject({ volume: 0, isMuted: false });
  });

  it("setVolume 범위 밖 입력을 즉시 클램프한다", async () => {
    const store = await importStore();
    store.getState().setVolume(-1);
    expect(store.getState().volume).toBe(0);
    store.getState().setVolume(5);
    expect(store.getState().volume).toBe(1);
    store.getState().setVolume(Number.NaN);
    expect(store.getState().volume).toBe(1);
  });

  it.each([
    ["음수 → 0", { volume: -0.5, isMuted: true }, { volume: 0, isMuted: true }],
    ["1 초과 → 1", { volume: 1.8, isMuted: false }, { volume: 1, isMuted: false }],
    ["null(직렬화된 NaN) → 1", { volume: null, isMuted: true }, { volume: 1, isMuted: true }],
    ["문자열 → 1", { volume: "invalid", isMuted: false }, { volume: 1, isMuted: false }],
    ["volume 필드 누락 → 1", { isMuted: true }, { volume: 1, isMuted: true }],
    ["isMuted 필드 누락 → false", { volume: 0.3 }, { volume: 0.3, isMuted: false }],
    ["non-bool isMuted → false", { volume: 0.3, isMuted: "yes" }, { volume: 0.3, isMuted: false }],
    ["isMuted 0 → false", { volume: 0.3, isMuted: 0 }, { volume: 0.3, isMuted: false }],
  ])("손상된 저장값 정규화: %s", async (_label, stored, expected) => {
    seed(stored);
    const store = await importStore();
    expect(store.getState()).toMatchObject(expected);
  });

  it("배열/원시값 저장값은 전체 기본값으로 복구한다", async () => {
    seed([1, 2, 3]);
    const store = await importStore();
    expect(store.getState()).toMatchObject({ volume: 1, isMuted: false });
  });

  it("malformed JSON에서도 crash 없이 기본 상태로 시작한다", async () => {
    localStorage.setItem(STORAGE_KEY, "{ not valid json ");
    const store = await importStore();
    expect(store.getState()).toMatchObject({ volume: 1, isMuted: false });
  });
});
