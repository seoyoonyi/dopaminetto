import * as Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocalInputFrame } from "./TownInputController";
import { TownLocalPlayerController } from "./TownLocalPlayerController";

interface PlayerHarness {
  sprite: Phaser.GameObjects.Sprite;
  anims: {
    isPlaying: boolean;
    currentAnim: { key: string } | null;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  setTexture: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setFlipX: ReturnType<typeof vi.fn>;
  setFrame: ReturnType<typeof vi.fn>;
}

function createPlayerHarness(): PlayerHarness {
  const anims = {
    isPlaying: false,
    currentAnim: null as { key: string } | null,
    play: vi.fn((key: string) => {
      anims.isPlaying = true;
      anims.currentAnim = { key };
    }),
    stop: vi.fn(() => {
      anims.isPlaying = false;
      anims.currentAnim = null;
    }),
  };
  const setTexture = vi.fn();
  const setScale = vi.fn();
  const setOrigin = vi.fn();
  const setFlipX = vi.fn();
  const setFrame = vi.fn();
  const sprite = {
    x: 100,
    y: 200,
    active: true,
    frame: { name: 0 },
    anims,
    setTexture,
    setScale,
    setOrigin,
    setFlipX,
    setFrame,
  } as unknown as Phaser.GameObjects.Sprite;

  return { sprite, anims, setTexture, setScale, setOrigin, setFlipX, setFrame };
}

const neutralInput: LocalInputFrame = {
  dx: 0,
  dy: 0,
  isSpacePressed: false,
  actionId: null,
};

describe("TownLocalPlayerController — 로컬 캐릭터 조작", () => {
  const controllers: TownLocalPlayerController[] = [];

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.destroy());
  });

  it("기존 이동량을 전달하고 방향에 맞는 걷기 애니메이션을 재생한다", () => {
    const player = createPlayerHarness();
    const updatePosition = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition,
      startLocalAction: vi.fn(),
      stopLocalAction: vi.fn(),
    });
    controllers.push(controller);

    controller.update({ ...neutralInput, dx: -4, dy: 4 }, "p-boy");

    expect(updatePosition).toHaveBeenCalledWith({ x: -4, y: 4 });
    expect(player.anims.play).toHaveBeenCalledWith("p-boy-sprite-walk-left", true);
  });

  it("춤 액션 키를 다시 누르면 춤을 멈춘다", () => {
    const player = createPlayerHarness();
    const startLocalAction = vi.fn();
    const stopLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition: vi.fn(),
      startLocalAction,
      stopLocalAction,
    });
    controllers.push(controller);
    const danceInput = { ...neutralInput, actionId: "dance" as const };

    controller.update(danceInput, "p-boy");
    controller.update(danceInput, "p-boy");

    expect(startLocalAction).toHaveBeenCalledTimes(1);
    expect(stopLocalAction).toHaveBeenCalledTimes(1);
    expect(controller.isActionActive()).toBe(false);
  });

  it("춤이 아닌 액션 키를 다시 누르면 해당 액션을 다시 시작한다", () => {
    const player = createPlayerHarness();
    const startLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition: vi.fn(),
      startLocalAction,
      stopLocalAction: vi.fn(),
    });
    controllers.push(controller);
    const happyInput = { ...neutralInput, actionId: "happy" as const };

    controller.update(happyInput, "p-boy");
    controller.update(happyInput, "p-boy");

    expect(startLocalAction).toHaveBeenCalledTimes(2);
    expect(player.anims.play).toHaveBeenCalledTimes(2);
    expect(controller.isActionActive()).toBe(true);
  });

  it("이동을 요청하기 전에 진행 중인 액션을 취소한다", () => {
    const player = createPlayerHarness();
    const callOrder: string[] = [];
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition: vi.fn(() => callOrder.push("move")),
      startLocalAction: vi.fn(),
      stopLocalAction: vi.fn(() => callOrder.push("stop")),
    });
    controllers.push(controller);

    controller.update({ ...neutralInput, actionId: "sit" }, "p-boy");
    controller.update({ ...neutralInput, dx: 4 }, "p-boy");

    expect(callOrder).toEqual(["stop", "move"]);
    expect(controller.isActionActive()).toBe(false);
  });

  it("같은 프레임에 이동을 요청하면 새 액션을 시작하지 않는다", () => {
    const player = createPlayerHarness();
    const updatePosition = vi.fn();
    const startLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition,
      startLocalAction,
      stopLocalAction: vi.fn(),
    });
    controllers.push(controller);

    controller.update({ ...neutralInput, dx: -4, actionId: "sit" }, "p-boy");

    expect(startLocalAction).not.toHaveBeenCalled();
    expect(updatePosition).toHaveBeenCalledWith({ x: -4, y: 0 });
    expect(controller.isActionActive()).toBe(false);
  });

  it("Space 키로 이동 없이 진행 중인 액션을 취소한다", () => {
    const player = createPlayerHarness();
    const updatePosition = vi.fn();
    const stopLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition,
      startLocalAction: vi.fn(),
      stopLocalAction,
    });
    controllers.push(controller);
    controller.update({ ...neutralInput, actionId: "sit" }, "p-boy");

    controller.update({ ...neutralInput, isSpacePressed: true }, "p-boy");

    expect(stopLocalAction).toHaveBeenCalledTimes(1);
    expect(updatePosition).not.toHaveBeenCalled();
    expect(controller.isActionActive()).toBe(false);
  });

  it("액션이 자연 종료되면 최신 캐릭터 설정을 복원한다", () => {
    const player = createPlayerHarness();
    const stopLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition: vi.fn(),
      startLocalAction: vi.fn(),
      stopLocalAction,
    });
    controllers.push(controller);

    controller.update({ ...neutralInput, actionId: "happy" }, "p-boy");
    player.anims.isPlaying = false;
    controller.update(neutralInput, "p-girl");

    expect(stopLocalAction).toHaveBeenCalledTimes(1);
    expect(player.setTexture).toHaveBeenLastCalledWith("p-girl-sprite", 0);
    expect(player.setScale).toHaveBeenLastCalledWith(1);
    expect(player.setOrigin).toHaveBeenLastCalledWith(0.5, 1);
    expect(controller.isActionActive()).toBe(false);
  });

  it("종료될 때 공유 스토어는 유지하고 로컬 액션 상태만 초기화한다", () => {
    const player = createPlayerHarness();
    const stopLocalAction = vi.fn();
    const controller = new TownLocalPlayerController(player.sprite, {
      updatePosition: vi.fn(),
      startLocalAction: vi.fn(),
      stopLocalAction,
    });
    controllers.push(controller);
    controller.update({ ...neutralInput, actionId: "sit" }, "p-boy");

    controller.destroy();

    expect(controller.isActionActive()).toBe(false);
    expect(stopLocalAction).not.toHaveBeenCalled();
  });
});
