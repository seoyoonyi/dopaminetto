// @vitest-environment jsdom
import { useAmbientSoundStore } from "@/features/ambientSound";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TownInputController } from "./TownInputController";
import { TownLocalPlayerController } from "./TownLocalPlayerController";
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
    Input: {
      Keyboard: {
        KeyCodes: { H: 72, ZERO: 48, X: 88, SPACE: 32 },
        JustDown: (key: { _justDown: boolean }) => {
          if (!key._justDown) return false;
          key._justDown = false;
          return true;
        },
      },
    },
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
  wasd: { A: { isDown: boolean; _justDown: boolean } };
  scene: Record<string, unknown>;
};

type TestKey = { isDown: boolean; _justDown: boolean };

const updatePosition = vi.fn();
const ambientUpdate = vi.fn();
let scene: SceneHarness;

function makeScene(): SceneHarness {
  const keys: Record<string, TestKey> = {};
  const getKey = (name: string) => (keys[name] ??= { isDown: false, _justDown: false });
  const cursors = {
    left: getKey("LEFT"),
    right: getKey("RIGHT"),
    up: getKey("UP"),
    down: getKey("DOWN"),
    space: getKey("SPACE"),
    shift: getKey("SHIFT"),
  };
  const keyNameByCode: Record<number, string> = { 72: "H", 48: "ZERO", 88: "X", 32: "SPACE" };
  const keyboard = {
    createCursorKeys: () => cursors,
    addKey: (code: number) => getKey(keyNameByCode[code]),
    addKeys: (names: string) =>
      Object.fromEntries(names.split(",").map((name) => [name, getKey(name)])),
    addCapture: vi.fn(),
    removeCapture: vi.fn(),
  };
  const instance = new TownScene() as unknown as Record<string, unknown> & SceneHarness;
  const player = {
    x: 100,
    y: 200,
    active: true,
    frame: { name: 0 },
    anims: { isPlaying: false, currentAnim: null, play: vi.fn(), stop: vi.fn() },
    setPosition: vi.fn(),
    setTexture: vi.fn(),
    setScale: vi.fn(),
    setOrigin: vi.fn(),
    setFlipX: vi.fn(),
    setFrame: vi.fn(),
  };
  Object.assign(instance, {
    player,
    campfireAmbientController: { update: ambientUpdate },
    input: { keyboard },
    inputController: new TownInputController(keyboard as never),
    localPlayerController: new TownLocalPlayerController(player as never, {
      updatePosition: (delta) => useMovementStore.getState().updatePosition(delta),
      startLocalAction: (actionId) => useMovementStore.getState().startLocalAction(actionId),
      stopLocalAction: () => useMovementStore.getState().stopLocalAction(),
    }),
    localUserId: "local",
  });
  return {
    update: (time, delta) => instance.update(time, delta),
    wasd: { A: getKey("A") },
    scene: instance,
  };
}

beforeEach(() => {
  updatePosition.mockReset();
  ambientUpdate.mockClear();
  useMovementStore.setState({
    villageId: "village-a",
    remotePlayers: {},
    localActionState: null,
    updatePosition,
  });
  useAmbientSoundStore.setState({ volume: 0.6, isMuted: false });
  useSettingsDialogStore.setState({ isOpen: false });
  useNicknameDialogStore.setState({ isOpen: false });
  scene = makeScene();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("TownScene.update() — 입력 차단과 환경음 갱신 분리", () => {
  it("닉네임 변경창에서 이동을 차단하고 닫으면 복구한다", () => {
    scene.wasd.A.isDown = true;
    useNicknameDialogStore.setState({ isOpen: true });
    scene.update(0, 16);
    expect(updatePosition).not.toHaveBeenCalled();
    expect(ambientUpdate).toHaveBeenCalledTimes(1);

    useNicknameDialogStore.setState({ isOpen: false });
    scene.update(0, 16);
    expect(updatePosition).toHaveBeenCalledWith({ x: -4, y: 0 });
  });

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

  it("채팅 포커스와 설정창이 함께 있으면 둘 다 해제된 뒤 이동을 복구한다", () => {
    const chatInput = document.createElement("input");
    document.body.appendChild(chatInput);
    chatInput.focus();
    scene.wasd.A.isDown = true;
    useSettingsDialogStore.setState({ isOpen: true });

    scene.update(0, 16);
    useSettingsDialogStore.setState({ isOpen: false });
    scene.update(0, 16);
    expect(updatePosition).not.toHaveBeenCalled();

    chatInput.blur();
    scene.update(0, 16);
    expect(updatePosition).toHaveBeenCalledWith({ x: -4, y: 0 });
  });

  it("이동 중 빌리지가 바뀌면 같은 프레임의 환경음에 새 빌리지를 전달한다", () => {
    updatePosition.mockImplementation(() => {
      useMovementStore.setState({ villageId: "village-b" });
    });
    scene.wasd.A.isDown = true;

    scene.update(0, 16);

    expect(ambientUpdate).toHaveBeenLastCalledWith(expect.anything(), "village-b", 0.6);
  });
});
