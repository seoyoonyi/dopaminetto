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
  it("기본값은 트리 캐롤 음량 30%, 음소거 해제", async () => {
    const store = await importStore();
    expect(store.getState()).toMatchObject({
      christmasTreeVolume: 0.3,
      isChristmasTreeMuted: false,
    });
  });

  it("변경값을 저장하고 새 store 인스턴스에서 복원한다", async () => {
    const store = await importStore();
    store.getState().setChristmasTreeVolume(0.4);
    store.getState().toggleChristmasTreeMute();

    vi.resetModules();
    const restored = await importStore();
    expect(restored).not.toBe(store);
    expect(restored.getState()).toMatchObject({
      christmasTreeVolume: 0.4,
      isChristmasTreeMuted: true,
    });

    restored.getState().toggleChristmasTreeMute();
    expect(restored.getState()).toMatchObject({
      christmasTreeVolume: 0.4,
      isChristmasTreeMuted: false,
    });
  });

  it("음량과 음소거는 서로 독립적이다 (음량 0 ≠ 음소거)", async () => {
    const store = await importStore();
    store.getState().toggleChristmasTreeMute();
    store.getState().setChristmasTreeVolume(0);
    expect(store.getState()).toMatchObject({ christmasTreeVolume: 0, isChristmasTreeMuted: true });

    store.getState().toggleChristmasTreeMute();
    expect(store.getState()).toMatchObject({ christmasTreeVolume: 0, isChristmasTreeMuted: false });
  });

  it("캐롤 음량 범위 밖 입력을 즉시 클램프한다", async () => {
    const store = await importStore();
    store.getState().setChristmasTreeVolume(-1);
    expect(store.getState().christmasTreeVolume).toBe(0);
    store.getState().setChristmasTreeVolume(5);
    expect(store.getState().christmasTreeVolume).toBe(1);
    store.getState().setChristmasTreeVolume(Number.NaN);
    expect(store.getState().christmasTreeVolume).toBe(0.3);
  });

  it.each([
    [
      "음수 → 0",
      { christmasTreeVolume: -0.5, isChristmasTreeMuted: true },
      { christmasTreeVolume: 0, isChristmasTreeMuted: true },
    ],
    [
      "1 초과 → 1",
      { christmasTreeVolume: 1.8, isChristmasTreeMuted: false },
      { christmasTreeVolume: 1, isChristmasTreeMuted: false },
    ],
    [
      "null → 기본 음량",
      { christmasTreeVolume: null, isChristmasTreeMuted: true },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: true },
    ],
    [
      "문자열 → 기본 음량",
      { christmasTreeVolume: "invalid", isChristmasTreeMuted: false },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: false },
    ],
    [
      "음량 필드 누락 → 기본 음량",
      { isChristmasTreeMuted: true },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: true },
    ],
    [
      "음소거 필드 누락 → false",
      { christmasTreeVolume: 0.3 },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: false },
    ],
    [
      "non-bool 음소거 → false",
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: "yes" },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: false },
    ],
    [
      "음소거 0 → false",
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: 0 },
      { christmasTreeVolume: 0.3, isChristmasTreeMuted: false },
    ],
  ])("손상된 저장값 정규화: %s", async (_label, stored, expected) => {
    seed(stored);
    const store = await importStore();
    expect(store.getState()).toMatchObject(expected);
  });

  it("배열/원시값 저장값은 전체 기본값으로 복구한다", async () => {
    seed([1, 2, 3]);
    const store = await importStore();
    expect(store.getState()).toMatchObject({
      christmasTreeVolume: 0.3,
      isChristmasTreeMuted: false,
    });
  });

  it("malformed JSON에서도 crash 없이 기본 상태로 시작한다", async () => {
    localStorage.setItem(STORAGE_KEY, "{ not valid json ");
    const store = await importStore();
    expect(store.getState()).toMatchObject({
      christmasTreeVolume: 0.3,
      isChristmasTreeMuted: false,
    });
  });
});
