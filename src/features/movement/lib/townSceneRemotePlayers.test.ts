// @vitest-environment jsdom
import type { MapLoader } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RemotePlayer } from "../model/types";
import { TownScene } from "./TownScene";

const mockAmbientDestroy = vi.hoisted(() => vi.fn());
const mockSnowfall = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("@/features/movement/lib/SnowfallEffectsController", () => ({
  SnowfallEffectsController: class SnowfallEffectsController {
    constructor(...args: unknown[]) {
      mockSnowfall.create(...args);
    }
    destroy = mockSnowfall.destroy;
  },
}));

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
  AMBIENT_AUDIO_KEYS: { CHRISTMAS_TREE: "christmas-tree" },
  AMBIENT_AUDIO_URLS: { CHRISTMAS_TREE: "" },
  CHRISTMAS_TREE_SOUND_CONFIG: {},
  AmbientSoundController: class AmbientSoundController {
    destroy = mockAmbientDestroy;
    update = vi.fn();
  },
  resolveChristmasTreeSources: () => [],
}));

type DisplayObject = {
  x: number;
  y: number;
  text?: string;
  destroyed?: boolean;
  texture?: { key: string };
  frame?: { name: number };
  active?: boolean;
  depth?: number;
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
  setDepth: (depth: number) => DisplayObject;
  play: (key: string) => DisplayObject;
  setPosition: (x: number, y: number) => DisplayObject;
  setText: (text: string) => DisplayObject;
  setVisible: (visible: boolean) => DisplayObject;
  setInteractive: () => DisplayObject;
  getCenter: () => { x: number; y: number };
  disableInteractive: () => DisplayObject;
  on: (event: string, handler: (...args: unknown[]) => void) => DisplayObject;
  off: (event: string, handler?: (...args: unknown[]) => void) => DisplayObject;
  emit: (event: string, ...args: unknown[]) => void;
  destroy: ReturnType<typeof vi.fn>;
};

type SceneHarness = {
  preload: () => void;
  create: () => void;
  update: (time: number, delta: number) => void;
  game: { canvas: HTMLCanvasElement };
  load: {
    image: ReturnType<typeof vi.fn>;
    spritesheet: ReturnType<typeof vi.fn>;
  };
  events: EventEmitter;
  add: {
    image: ReturnType<typeof vi.fn>;
    sprite: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
  };
  anims: {
    create: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    generateFrameNumbers: ReturnType<typeof vi.fn>;
  };
  scale: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
};

function makeDisplayObject(x: number, y: number, text?: string): DisplayObject {
  const handlers = new Map<string, (...args: unknown[]) => void>();
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
    setDepth(nextDepth) {
      this.depth = nextDepth;
      return object;
    },
    play() {
      return object;
    },
    setPosition(nextX, nextY) {
      this.x = nextX;
      this.y = nextY;
      return this;
    },
    setText(nextText) {
      this.text = nextText;
      return this;
    },
    setVisible: () => object,
    setInteractive: () => object,
    getCenter: () => ({ x: 734, y: 678.5 }),
    disableInteractive: () => object,
    on(event, handler) {
      handlers.set(event, handler);
      return object;
    },
    off(event) {
      handlers.delete(event);
      return object;
    },
    emit(event, ...args) {
      handlers.get(event)?.(...args);
    },
    destroy: vi.fn(function (this: DisplayObject) {
      this.destroyed = true;
    }),
  };

  return object;
}

function makeScene(): {
  scene: SceneHarness;
  events: EventEmitter;
  sprites: DisplayObject[];
  labels: DisplayObject[];
  images: DisplayObject[];
} {
  const createdSprites: DisplayObject[] = [];
  const createdLabels: DisplayObject[] = [];
  const createdImages: DisplayObject[] = [];
  const events = new EventEmitter();
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const keyboard = {
    manager: { removeCapture: vi.fn() },
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
  // Phaser destroys the input and keyboard plugins before later Scene destroy handlers run.
  events.once("destroy", () => Object.assign(keyboard, { manager: null }));
  const instance = new TownScene() as unknown as Record<string, unknown> & SceneHarness;
  shutdownScenes.push(() => events.emit("shutdown"));
  const load = { audio: vi.fn(), image: vi.fn(), spritesheet: vi.fn() };

  Object.assign(instance, {
    load,
    add: {
      sprite: vi.fn((x: number, y: number, key: string, frame: number) => {
        const sprite = makeDisplayObject(x, y).setTexture(key, frame);
        createdSprites.push(sprite);
        return sprite;
      }),
      text: vi.fn((x: number, y: number, text: string) => {
        const label = makeDisplayObject(x, y, text);
        if (text !== "트리를 누르면 카드를 작성할 수 있어요! 🎄") createdLabels.push(label);
        return label;
      }),
      image: vi.fn((_x: number, _y: number, key: string) => {
        const image = makeDisplayObject(0, 0).setTexture(key);
        createdImages.push(image);
        return image;
      }),
    },
    anims: {
      create: vi.fn(),
      exists: vi.fn(() => true),
      generateFrameNumbers: vi.fn(() => []),
    },
    cameras: {
      main: {
        x: 0,
        y: 0,
        zoom: 1,
        worldView: { x: 0, y: 0 },
        width: 800,
        height: 600,
        setBounds: vi.fn(),
        setZoom: vi.fn(),
        setBackgroundColor: vi.fn(),
        startFollow: vi.fn(),
      },
    },
    input: { keyboard, setDefaultCursor: vi.fn() },
    events,
    scale: { width: 800, height: 600, on: vi.fn(), off: vi.fn() },
    game: { canvas },
  });

  return {
    scene: instance,
    events,
    sprites: createdSprites,
    labels: createdLabels,
    images: createdImages,
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

const shutdownScenes: Array<() => void> = [];

describe("TownScene 원격 캐릭터 재시작", () => {
  beforeEach(() => {
    useMovementStore.setState({
      mapLoader: null,
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
    useGuestbookDialogStore.setState({ isOpen: false });
    mockAmbientDestroy.mockClear();
    mockSnowfall.create.mockClear();
    mockSnowfall.destroy.mockClear();
  });

  afterEach(() => {
    shutdownScenes.splice(0).forEach((shutdown) => shutdown());
    useMovementStore.setState({ remotePlayers: {}, userId: "" });
    vi.restoreAllMocks();
  });

  it("트리 본체와 24프레임 장식 시트를 미리 불러온다", () => {
    const { scene } = makeScene();

    scene.preload();

    expect(scene.load.image).toHaveBeenCalledWith(
      "christmas-tree-base",
      "/assets/images/christmas-tree-base.png",
    );
    expect(scene.load.spritesheet).toHaveBeenCalledWith(
      "christmas-tree-decoration",
      "/assets/images/christmas-tree-decoration.png",
      { frameWidth: 320, frameHeight: 357 },
    );
  });

  it("승인된 맵 위치에 트리 본체와 첫 장식 프레임을 표시한다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    const { scene } = makeScene();

    scene.create();

    expect(scene.add.image).toHaveBeenCalledWith(734, 857, "christmas-tree-base");
    expect(scene.add.sprite).toHaveBeenCalledWith(734, 857, "christmas-tree-decoration", 0);
  });

  it("트리 클릭으로 방명록 상태를 열고 Scene 종료 시 상태와 트리 객체를 정리한다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    const { scene, events, images, sprites } = makeScene();

    scene.create();
    const treeBase = images.find((image) => image.texture?.key === "christmas-tree-base");
    const treeDecoration = sprites.find(
      (sprite) => sprite.texture?.key === "christmas-tree-decoration",
    );
    expect(treeBase).toBeDefined();
    expect(treeDecoration).toBeDefined();

    treeBase?.emit("pointerdown", {
      downElement: scene.game.canvas,
      event: { clientX: 734, clientY: 857 },
    });
    expect(useGuestbookDialogStore.getState().isOpen).toBe(true);

    events.emit("shutdown");
    events.emit("destroy");

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
    expect(treeBase?.destroy).toHaveBeenCalledOnce();
    expect(treeDecoration?.destroy).toHaveBeenCalledOnce();
  });

  it("설정 다이얼로그가 열린 동안 트리를 눌러도 방명록을 열지 않는다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    useSettingsDialogStore.setState({ isOpen: true });
    const { scene, images } = makeScene();

    scene.create();
    const treeBase = images.find((image) => image.texture?.key === "christmas-tree-base");
    treeBase?.emit("pointerdown", {
      downElement: scene.game.canvas,
      event: { clientX: 734, clientY: 857 },
    });

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });

  it("빌리지 B에서도 맵 기반 눈 효과를 만들고 Scene 종료 때 정리한다", () => {
    const { scene, events } = makeScene();
    const mapLoader = {
      getBackgroundImage: () => ({ visible: false }),
      getFrontImage: () => ({ visible: false }),
      getMapBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      getVillageAreas: () => [],
      getChristmasTreeEffect: () => undefined,
    } as unknown as MapLoader;
    useMovementStore.setState({ mapLoader, villageId: "village-b" });

    scene.create();
    expect(mockSnowfall.create).toHaveBeenCalledWith(scene, mapLoader);

    scene.update(0, 16);

    events.emit("shutdown");
    expect(mockSnowfall.destroy).toHaveBeenCalledOnce();
  });

  it("원격 캐릭터 이름표도 캐릭터와 같은 깊이로 정렬한다", () => {
    const { scene, sprites, labels } = makeScene();

    scene.create();

    expect(labels[1].depth).toBe(sprites[1].depth);
  });

  it("Scene 재시작 후 같은 사용자의 새 액션 sequence를 다시 표시한다", () => {
    const { scene, sprites, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

    scene.create();
    const firstRemoteSprite = sprites[1];
    expect(firstRemoteSprite.anims?.play).toHaveBeenCalled();

    events.emit("shutdown");
    useMovementStore.setState({
      remotePlayers: {
        "remote-user": {
          ...useMovementStore.getState().remotePlayers["remote-user"],
          actionState: { actionId: "dance", sequence: 1 },
        },
      },
    });

    scene.create();
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
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

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
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

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
    const { scene, sprites, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));
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
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));
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

  it("Game destroy 경로에서 Scene 자원을 정리하고 이후 스토어 변경을 받지 않는다", () => {
    const { scene, events, sprites } = makeScene();
    const otherShutdownListener = vi.fn();
    const otherDestroyListener = vi.fn();
    events.on("shutdown", otherShutdownListener);
    events.on("destroy", otherDestroyListener);
    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    const localSprite = sprites[0];

    events.emit("destroy");
    useMovementStore.setState({ position: { x: 150, y: 250 } });

    expect(mockAmbientDestroy).toHaveBeenCalledOnce();
    expect(localSprite.x).toBe(100);
    expect(events.listenerCount("shutdown")).toBe(1);
    expect(events.listenerCount("destroy")).toBe(1);

    events.emit("shutdown");
    expect(otherShutdownListener).toHaveBeenCalledOnce();
    expect(otherDestroyListener).toHaveBeenCalledOnce();
  });

  it("shutdown 후 재시작하고 destroy해도 각 실행의 자원을 한 번씩 정리한다", () => {
    const { scene, events } = makeScene();
    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    events.emit("shutdown");

    expect(mockAmbientDestroy).toHaveBeenCalledTimes(1);
    expect(events.listenerCount("destroy")).toBe(1);

    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    events.emit("destroy");

    expect(mockAmbientDestroy).toHaveBeenCalledTimes(2);
    expect(events.listenerCount("shutdown")).toBe(0);
    expect(events.listenerCount("destroy")).toBe(0);
  });

  it("초기화 도중 실패한 뒤 destroy해도 먼저 생성된 카메라 자원을 정리한다", () => {
    const { scene, events } = makeScene();
    const mapLoader = {
      getBackgroundImage: () => ({ visible: false }),
      getFrontImage: () => ({ visible: false }),
      getMapBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    } as unknown as MapLoader;
    useMovementStore.setState({ mapLoader });
    vi.spyOn(scene.add, "text").mockImplementation(() => {
      throw new Error("이름표 생성 실패");
    });

    expect(() => scene.create()).toThrow("이름표 생성 실패");
    events.emit("destroy");

    expect(scene.scale.on).toHaveBeenCalledOnce();
    expect(scene.scale.off).toHaveBeenCalledOnce();
    expect(mockAmbientDestroy).not.toHaveBeenCalled();
  });
});
