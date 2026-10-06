import * as Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TownInputController } from "./TownInputController";

vi.mock("phaser", () => ({
  Input: {
    Keyboard: {
      KeyCodes: { H: 1, ZERO: 2, X: 3, SPACE: 4, SHIFT: 5 },
      JustDown: (key: TestKey) => {
        if (!key._justDown) return false;
        key._justDown = false;
        return true;
      },
    },
  },
}));

interface TestKey {
  isDown: boolean;
  _justDown: boolean;
}

type KeyboardHarness = {
  plugin: Phaser.Input.Keyboard.KeyboardPlugin;
  keys: Record<string, TestKey>;
  addCapture: ReturnType<typeof vi.fn>;
  removeCapture: ReturnType<typeof vi.fn>;
  destroyManager: () => void;
};

function createKeyboardHarness(): KeyboardHarness {
  const keys: Record<string, TestKey> = {};
  const getKey = (key: string) => {
    keys[key] ??= { isDown: false, _justDown: false };
    return keys[key];
  };
  const cursorKeys = {
    left: getKey("LEFT"),
    right: getKey("RIGHT"),
    up: getKey("UP"),
    down: getKey("DOWN"),
    space: getKey("SPACE"),
    shift: getKey("SHIFT"),
  };
  const addCapture = vi.fn();
  const manager = { removeCapture: vi.fn() };
  const plugin = {
    manager,
    createCursorKeys: vi.fn(() => cursorKeys),
    addKey: vi.fn((code: number) => getKey(String(code))),
    addKeys: vi.fn((keyNames: string) =>
      Object.fromEntries(keyNames.split(",").map((key) => [key, getKey(key)])),
    ),
    addCapture,
  } as unknown as Phaser.Input.Keyboard.KeyboardPlugin;
  const removeCapture = vi.fn((keycode: string | number) => {
    if (!plugin.manager) throw new Error("Keyboard manager is destroyed");
    plugin.manager.removeCapture(keycode);
  });
  Object.assign(plugin, { removeCapture });

  keys.H = getKey("1");
  keys.ZERO = getKey("2");
  keys.X = getKey("3");
  keys.SPACE = cursorKeys.space;

  return {
    plugin,
    keys,
    addCapture,
    removeCapture,
    destroyManager: () => Object.assign(plugin, { manager: null }),
  };
}

function press(key: TestKey) {
  key.isDown = true;
  key._justDown = true;
}

function release(key: TestKey) {
  key.isDown = false;
  key._justDown = false;
}

describe("TownInputController — 키보드 입력 처리", () => {
  const controllers: TownInputController[] = [];

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.destroy());
  });

  it("축마다 4만큼 이동하고 반대 방향 키를 함께 누르면 왼쪽과 위쪽을 우선한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    keyboard.keys.LEFT.isDown = true;
    keyboard.keys.RIGHT.isDown = true;
    keyboard.keys.UP.isDown = true;
    keyboard.keys.DOWN.isDown = true;
    keyboard.keys.W.isDown = true;

    expect(controller.read(false)).toEqual({
      dx: -4,
      dy: -4,
      isSpacePressed: false,
      actionId: null,
    });
  });

  it("액션 키를 한 번만 처리하고 키를 놓은 뒤 다시 눌렀을 때 재처리한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    press(keyboard.keys.H);

    expect(controller.read(false)?.actionId).toBe("happy");
    expect(controller.read(false)?.actionId).toBeNull();

    release(keyboard.keys.H);
    press(keyboard.keys.H);
    expect(controller.read(false)?.actionId).toBe("happy");
  });

  it("Space 키를 누르고 있는 동안 한 번만 감지한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    press(keyboard.keys.SPACE);

    expect(controller.read(false)?.isSpacePressed).toBe(true);
    expect(controller.read(false)?.isSpacePressed).toBe(false);
  });

  it("액션 키를 여러 개 눌러도 기존 H, 0, X 순서대로 처리한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    press(keyboard.keys.H);
    press(keyboard.keys.ZERO);

    expect(controller.read(false)?.actionId).toBe("happy");
    expect(controller.read(false)?.actionId).toBe("dance");
  });

  it("입력이 차단된 동안 누른 액션 키를 소비하지 않는다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    press(keyboard.keys.H);

    expect(controller.read(true)).toBeNull();
    expect(controller.read(false)?.actionId).toBe("happy");
  });

  it("입력이 차단된 동안 놓은 액션 키를 다시 처리하지 않는다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    press(keyboard.keys.H);

    expect(controller.read(true)).toBeNull();
    release(keyboard.keys.H);
    expect(controller.read(false)?.actionId).toBeNull();
  });

  it("입력 차단 상태가 바뀔 때만 키 캡처를 변경한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);
    const capturedKeys = "W,A,S,D,H,X,ZERO,UP,DOWN,LEFT,RIGHT,SPACE";

    controller.read(false);
    controller.read(true);
    controller.read(true);
    controller.read(false);

    expect(keyboard.addCapture.mock.calls).toEqual([[capturedKeys], [capturedKeys]]);
    expect(keyboard.removeCapture).toHaveBeenCalledTimes(1);
    expect(keyboard.removeCapture).toHaveBeenCalledWith(capturedKeys);
  });

  it("종료될 때 자신이 등록한 키 캡처만 해제한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    controllers.push(controller);

    controller.destroy();

    expect(keyboard.removeCapture).toHaveBeenCalledWith(
      "W,A,S,D,H,X,ZERO,UP,DOWN,LEFT,RIGHT,SPACE",
    );
    expect(keyboard.removeCapture).toHaveBeenCalledWith(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    expect(keyboard.removeCapture).toHaveBeenCalledTimes(2);
  });

  it("키보드 플러그인이 먼저 파괴된 뒤 종료해도 오류 없이 참조를 정리한다", () => {
    const keyboard = createKeyboardHarness();
    const controller = new TownInputController(keyboard.plugin);
    keyboard.destroyManager();

    expect(() => controller.destroy()).not.toThrow();
    expect(keyboard.removeCapture).not.toHaveBeenCalled();
  });
});
