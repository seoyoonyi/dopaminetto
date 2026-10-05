// @vitest-environment jsdom
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RemotePlayer } from "../model/types";
import { TownScene } from "./TownScene";

vi.mock("phaser", () => ({
  __esModule: true,
  default: { Scene: class Scene {} },
  Scene: class Scene {},
  Math: {
    Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    Linear: (start: number, end: number, amount: number) => start + (end - start) * amount,
    Distance: { Between: () => 0 },
  },
  Input: {
    Keyboard: {
      KeyCodes: { H: 1, ZERO: 2, X: 3, SHIFT: 4 },
      JustDown: () => false,
    },
  },
  Scale: { Events: { RESIZE: "resize" } },
}));

vi.mock("@/features/movement", async () => {
  const config = await vi.importActual<Record<string, unknown>>("@/features/movement/model/config");
  const actionAnimation = await vi.importActual<Record<string, unknown>>(
    "@/features/movement/model/actionAnimation",
  );
  const store = await vi.importActual<Record<string, unknown>>(
    "@/features/movement/model/useMovementStore",
  );

  return { ...config, ...actionAnimation, ...store, TownEngine: () => null };
});

vi.mock("@/features/ambientSound/phaser", () => ({
  AMBIENT_AUDIO_KEYS: { CAMPFIRE: "campfire" },
  AMBIENT_AUDIO_URLS: { CAMPFIRE: "" },
  CAMPFIRE_SOUND_CONFIG: {},
  AmbientSoundController: class AmbientSoundController {
    destroy = vi.fn();
    update = vi.fn();
  },
  resolveCampfireSources: () => [],
}));

type DisplayObject = {
  x: number;
  y: number;
  text?: string;
  destroyed?: boolean;
  texture?: { key: string };
  frame?: { name: number };
  active?: boolean;
  anims?: {
    isPlaying: boolean;
    currentAnim: { key: string } | null;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  setTexture: (key: string, frame?: number) => DisplayObject;
  setScale: () => DisplayObject;
  setOrigin: () => DisplayObject;
  setFlipX: () => DisplayObject;
  setFrame: () => DisplayObject;
  setDepth: () => DisplayObject;
  setPosition: (x: number, y: number) => DisplayObject;
  setText: (text: string) => DisplayObject;
  destroy: ReturnType<typeof vi.fn>;
};

type SceneHarness = {
  create: () => void;
  update: (time: number, delta: number) => void;
  events: { once: (event: string, handler: () => void) => void };
  add: {
    sprite: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
  };
  anims: {
    create: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    generateFrameNumbers: ReturnType<typeof vi.fn>;
  };
};

function makeDisplayObject(x: number, y: number, text?: string): DisplayObject {
  const object: DisplayObject = {
    x,
    y,
    text,
    texture: { key: "" },
    frame: { name: 0 },
    active: true,
    anims: {
      isPlaying: false,
      currentAnim: null,
      play: vi.fn(),
      stop: vi.fn(),
    },
    setTexture(key, frame) {
      this.texture = { key };
      this.frame = { name: frame ?? 0 };
      return this;
    },
    setScale: () => object,
    setOrigin: () => object,
    setFlipX: () => object,
    setFrame: () => object,
    setDepth: () => object,
    setPosition(nextX, nextY) {
      this.x = nextX;
      this.y = nextY;
      return this;
    },
    setText(nextText) {
      this.text = nextText;
      return this;
    },
    destroy: vi.fn(function (this: DisplayObject) {
      this.destroyed = true;
    }),
  };

  return object;
}

function makeScene(): {
  scene: SceneHarness;
  sprites: DisplayObject[];
  labels: DisplayObject[];
  getShutdown: () => (() => void) | undefined;
} {
  const createdSprites: DisplayObject[] = [];
  const createdLabels: DisplayObject[] = [];
  let shutdownHandler: (() => void) | undefined;
  const keyboard = {
    createCursorKeys: () => ({
      left: { isDown: false },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
      space: {},
    }),
    addKeys: () => ({
      W: { isDown: false },
      A: { isDown: false },
      S: { isDown: false },
      D: { isDown: false },
    }),
    addKey: () => ({}),
    addCapture: vi.fn(),
    removeCapture: vi.fn(),
  };
  const instance = new TownScene() as unknown as Record<string, unknown> & SceneHarness;

  Object.assign(instance, {
    load: { audio: vi.fn(), image: vi.fn(), spritesheet: vi.fn() },
    add: {
      sprite: vi.fn((x: number, y: number) => {
        const sprite = makeDisplayObject(x, y);
        createdSprites.push(sprite);
        return sprite;
      }),
      text: vi.fn((x: number, y: number, text: string) => {
        const label = makeDisplayObject(x, y, text);
        createdLabels.push(label);
        return label;
      }),
      image: vi.fn(() => makeDisplayObject(0, 0)),
    },
    anims: {
      create: vi.fn(),
      exists: vi.fn(() => true),
      generateFrameNumbers: vi.fn(() => []),
    },
    cameras: {
      main: {
        width: 800,
        height: 600,
        setBounds: vi.fn(),
        setZoom: vi.fn(),
        setBackgroundColor: vi.fn(),
        startFollow: vi.fn(),
      },
    },
    input: { keyboard },
    events: {
      once: vi.fn((_event: string, handler: () => void) => {
        shutdownHandler = handler;
      }),
    },
    scale: { on: vi.fn(), off: vi.fn() },
  });

  return {
    scene: instance,
    sprites: createdSprites,
    labels: createdLabels,
    getShutdown: () => shutdownHandler,
  };
}

function makeRemotePlayer(overrides: Partial<RemotePlayer> = {}): RemotePlayer {
  return {
    userId: "remote-user",
    nickname: "원격 사용자",
    characterId: "p-boy",
    position: { x: 20, y: 30 },
    villageId: "lobby",
    actionState: null,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

let shutdownScene: (() => void) | undefined;

describe("TownScene 원격 캐릭터 재시작", () => {
  beforeEach(() => {
    useMovementStore.setState({
      position: { x: 100, y: 200 },
      nickname: "로컬 사용자",
      characterId: "p-boy",
      userId: "local-user",
      remotePlayers: {
        "remote-user": makeRemotePlayer({ actionState: { actionId: "dance", sequence: 5 } }),
      },
    });
    useSettingsDialogStore.setState({ isOpen: false });
    useNicknameDialogStore.setState({ isOpen: false });
  });

  afterEach(() => {
    shutdownScene?.();
    shutdownScene = undefined;
    useMovementStore.setState({ remotePlayers: {}, userId: "" });
    vi.restoreAllMocks();
  });

  it("Scene 재시작 후 같은 사용자의 새 액션 sequence를 다시 표시한다", () => {
    const { scene, sprites, getShutdown } = makeScene();

    scene.create();
    shutdownScene = getShutdown();
    const firstRemoteSprite = sprites[1];
    expect(firstRemoteSprite.anims?.play).toHaveBeenCalled();

    getShutdown()?.();
    useMovementStore.setState({
      remotePlayers: {
        "remote-user": {
          ...useMovementStore.getState().remotePlayers["remote-user"],
          actionState: { actionId: "dance", sequence: 1 },
        },
      },
    });

    scene.create();
    shutdownScene = getShutdown();
    const restartedRemoteSprite = sprites[3];

    expect(restartedRemoteSprite.anims?.play).toHaveBeenCalled();
  });

  it("로컬 사용자를 원격으로 중복 표시하지 않고 위치 수신 뒤 원격 캐릭터를 한 번 생성한다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missingPosition = {
      ...makeRemotePlayer(),
      position: undefined,
    } as unknown as RemotePlayer;
    useMovementStore.setState({
      remotePlayers: {
        "local-user": makeRemotePlayer({ userId: "local-user" }),
        "remote-user": missingPosition,
      },
    });
    const { scene, sprites, labels, getShutdown } = makeScene();
    shutdownScene = getShutdown();

    scene.create();

    expect(sprites).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();

    useMovementStore.setState({
      remotePlayers: { "remote-user": makeRemotePlayer({ position: { x: 20, y: 30 } }) },
    });
    useMovementStore.setState({
      remotePlayers: { "remote-user": makeRemotePlayer({ position: { x: 20, y: 30 } }) },
    });

    expect(sprites).toHaveLength(2);
    expect(labels[1].text).toBe("원격 사용자");
  });

  it("원격 사용자 이탈 시 표시를 제거하고 재입장 때 새 표시를 만든다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, labels, getShutdown } = makeScene();
    shutdownScene = getShutdown();

    scene.create();
    const departedSprite = sprites[1];
    const departedLabel = labels[1];

    useMovementStore.setState({ remotePlayers: {} });
    expect(departedSprite.destroyed).toBe(true);
    expect(departedLabel.destroyed).toBe(true);

    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });

    expect(sprites).toHaveLength(3);
    expect(sprites[2]).not.toBe(departedSprite);
  });

  it("같은 빌리지에서는 보간하고 빌리지 변경이나 긴 프레임에서는 목표 위치에 맞춘다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, getShutdown } = makeScene();
    shutdownScene = getShutdown();
    scene.create();
    const remoteSprite = sprites[1];

    scene.update(0, 16);
    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ position: { x: 120, y: 30 } }),
      },
    });
    scene.update(0, 16);
    expect(remoteSprite.x).toBeGreaterThan(20);
    expect(remoteSprite.x).toBeLessThan(120);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          position: { x: 300, y: 400 },
          villageId: "village-a",
        }),
      },
    });
    scene.update(0, 16);
    expect(remoteSprite.x).toBe(300);
    expect(remoteSprite.y).toBe(400);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          position: { x: 500, y: 600 },
          villageId: "village-a",
        }),
      },
    });
    scene.update(0, 251);
    expect(remoteSprite.x).toBe(500);
    expect(remoteSprite.y).toBe(600);
  });

  it("액션 중 이름표를 갱신하고 종료 시 최신 캐릭터로 복원한다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, labels, getShutdown } = makeScene();
    shutdownScene = getShutdown();
    scene.create();
    const remoteSprite = sprites[1];
    const remoteLabel = labels[1];

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ actionState: { actionId: "dance", sequence: 1 } }),
      },
    });
    const actionTexture = remoteSprite.texture?.key;

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          nickname: "바뀐 이름",
          characterId: "p-girl",
          actionState: { actionId: "dance", sequence: 1 },
        }),
      },
    });

    expect(remoteLabel.text).toBe("바뀐 이름");
    expect(remoteSprite.texture?.key).toBe(actionTexture);
    expect(remoteSprite.anims?.play).toHaveBeenCalledTimes(1);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ nickname: "바뀐 이름", characterId: "p-girl" }),
      },
    });

    expect(remoteSprite.texture?.key).not.toBe(actionTexture);
  });
});
