import { EventEmitter } from "node:events";
import { vi } from "vitest";

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

export function makeScene(): {
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
        createdLabels.push(label);
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

export const shutdownScenes: Array<() => void> = [];

export { mockAmbientDestroy, mockSnowfall };
