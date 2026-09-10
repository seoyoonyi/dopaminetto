// @vitest-environment jsdom
import { useAmbientSoundStore } from "@/features/ambientSound";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TownScene } from "./TownScene";

/**
 * 실제 TownScene.update() 경로를 실행해 다음을 검증한다.
 * - 설정 다이얼로그가 열리거나 채팅 입력이 포커스되면 이동/액션 입력은 차단된다.
 * - 그와 무관하게 모닥불 환경음 갱신(update() 4번 단계)은 매 프레임 계속 도달한다.
 *   (`if (isInputFocused) return;`으로 되돌아가면 이 테스트가 깨진다)
 * - 다이얼로그를 닫으면 이동 입력이 복구된다.
 *
 * phaser와 @/features/movement 배럴(= TownEngine → Supabase 체인)만 격리한다.
 * useMovementStore / config / actionAnimation은 실제 구현을 그대로 쓴다.
 */
vi.mock("phaser", () => {
  class Scene {}
  return {
    __esModule: true,
    default: { Scene },
    Scene,
    Math: {
      Clamp: (v: number, a: number, b: number) => Math.min(Math.max(v, a), b),
      Linear: (p0: number, p1: number, t: number) => (p1 - p0) * t + p0,
      Distance: {
        Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
      },
    },
    Input: { Keyboard: { JustDown: () => false } },
  };
});

vi.mock("@/features/movement", async () => {
  const config = await vi.importActual<Record<string, unknown>>("@/features/movement/model/config");
  const actionAnimation = await vi.importActual<Record<string, unknown>>(
    "@/features/movement/model/actionAnimation",
  );
  const storeMod = await vi.importActual<Record<string, unknown>>(
    "@/features/movement/model/useMovementStore",
  );
  return { ...config, ...actionAnimation, ...storeMod, TownEngine: () => null };
});

type SceneHarness = {
  update: (time: number, delta: number) => void;
  wasd: { A: { isDown: boolean } };
};

const updatePosition = vi.fn();
const ambientUpdate = vi.fn();
let scene: SceneHarness;

function makeScene(): SceneHarness {
  const instance = new TownScene() as unknown as Record<string, unknown> & SceneHarness;
  Object.assign(instance, {
    player: {
      x: 100,
      y: 200,
      active: true,
      anims: { isPlaying: false, currentAnim: null, play: vi.fn(), stop: vi.fn() },
      setFlipX: vi.fn(),
      setFrame: vi.fn(),
    },
    campfireAmbientController: { update: ambientUpdate },
    input: { keyboard: { addCapture: vi.fn(), removeCapture: vi.fn() } },
    cursors: {
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
    },
    wasd: {
      W: { isDown: false },
      A: { isDown: false },
      S: { isDown: false },
      D: { isDown: false },
    },
    spaceKey: {},
    localActionKeys: {},
    localUserId: "local",
  });
  return instance;
}

beforeEach(() => {
  updatePosition.mockClear();
  ambientUpdate.mockClear();
  useMovementStore.setState({ villageId: "village-a", remotePlayers: {}, updatePosition });
  useAmbientSoundStore.setState({ volume: 0.6, isMuted: false });
  useSettingsDialogStore.setState({ isOpen: false });
  scene = makeScene();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("TownScene.update() — 입력 차단과 환경음 갱신 분리", () => {
  it("이동키를 누른 채 설정 다이얼로그가 열리면 이동은 차단되지만 환경음 갱신은 계속된다", () => {
    scene.wasd.A.isDown = true; // 왼쪽 이동 시도
    useSettingsDialogStore.setState({ isOpen: true });

    scene.update(0, 16);

    expect(updatePosition).not.toHaveBeenCalled();
    expect(ambientUpdate).toHaveBeenCalledTimes(1);
    expect(ambientUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 100, y: 200 }),
      "village-a",
      0.6,
    );
  });

  it("채팅 입력이 포커스돼도 이동은 차단되지만 환경음 갱신은 계속된다", () => {
    const chatInput = document.createElement("input");
    document.body.appendChild(chatInput);
    chatInput.focus();
    scene.wasd.A.isDown = true;

    scene.update(0, 16);

    expect(updatePosition).not.toHaveBeenCalled();
    expect(ambientUpdate).toHaveBeenCalledTimes(1);
  });

  it("음소거 상태면 환경음 출력 배율 0을 전달한다", () => {
    useAmbientSoundStore.setState({ volume: 0.6, isMuted: true });
    useSettingsDialogStore.setState({ isOpen: true });

    scene.update(0, 16);

    expect(ambientUpdate).toHaveBeenLastCalledWith(expect.anything(), "village-a", 0);
  });

  it("다이얼로그를 닫으면 이동 입력이 복구된다", () => {
    scene.wasd.A.isDown = true;

    useSettingsDialogStore.setState({ isOpen: true });
    scene.update(0, 16);
    expect(updatePosition).not.toHaveBeenCalled();

    useSettingsDialogStore.setState({ isOpen: false });
    scene.update(0, 16);

    expect(updatePosition).toHaveBeenCalledWith({ x: -4, y: 0 });
    expect(ambientUpdate).toHaveBeenCalledTimes(2);
  });
});
