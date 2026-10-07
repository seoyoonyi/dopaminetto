import { afterEach, describe, expect, it, vi } from "vitest";

import { TownMapCameraController } from "./TownMapCameraController";

vi.mock("phaser", () => ({
  Scale: { Events: { RESIZE: "resize" } },
}));

function createImageLayer(
  overrides: Partial<{
    name: "Background" | "Front";
    url: string;
    x: number;
    y: number;
    visible: boolean;
  }> = {},
) {
  return {
    name: "Background" as const,
    url: "/map.png",
    x: 0,
    y: 0,
    visible: true,
    ...overrides,
  };
}

function createSceneHarness() {
  const handlers = new Set<(...args: unknown[]) => void>();
  const background = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
  const front = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
  const camera = {
    width: 500,
    height: 400,
    setBounds: vi.fn(),
    setZoom: vi.fn(),
    startFollow: vi.fn(),
  };
  const scene = {
    load: { image: vi.fn() },
    add: {
      image: vi.fn((_x: number, _y: number, key: string) =>
        key === "town-map-front" ? front : background,
      ),
    },
    cameras: { main: camera },
    scale: {
      on: vi.fn((_event: string, handler: (...args: unknown[]) => void) => handlers.add(handler)),
      off: vi.fn((event: string, handler?: (...args: unknown[]) => void) => {
        if (event !== "resize") return;
        if (handler) handlers.delete(handler);
        else handlers.clear();
      }),
      handlers,
    },
  };

  return { scene, background, front, camera, handlers };
}

function createMapLoader(
  overrides: {
    background?: ReturnType<typeof createImageLayer>;
    front?: ReturnType<typeof createImageLayer>;
    bounds?: { x: number; y: number; width: number; height: number };
  } = {},
) {
  return {
    getBackgroundImage: () => overrides.background ?? createImageLayer(),
    getFrontImage: () => overrides.front ?? createImageLayer({ name: "Front", url: "/front.png" }),
    getMapBounds: () => overrides.bounds ?? { x: 20, y: 30, width: 300, height: 200 },
  };
}

describe("TownMapCameraController — 맵·카메라 생명주기", () => {
  afterEach(() => vi.restoreAllMocks());

  it("맵 레이어가 표시될 때만 이미지 에셋을 등록하고 렌더링한다", () => {
    const { scene, background, front } = createSceneHarness();
    const mapLoader = createMapLoader({
      background: createImageLayer({ visible: false }),
    });

    TownMapCameraController.preload(scene as never, mapLoader as never);
    const controller = new TownMapCameraController(scene as never, mapLoader as never);
    controller.renderFrontLayer();

    expect(scene.load.image).toHaveBeenCalledTimes(1);
    expect(scene.load.image).toHaveBeenCalledWith("town-map-front", "/front.png");
    expect(scene.add.image).toHaveBeenCalledTimes(1);
    expect(front.setDepth).toHaveBeenCalledWith(8000);
    expect(background.setDepth).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("작은 맵은 중앙 정렬하고 화면 크기가 바뀌면 카메라 bounds를 다시 계산한다", () => {
    const { scene, camera, handlers } = createSceneHarness();
    const controller = new TownMapCameraController(
      scene as never,
      createMapLoader({ bounds: { x: 20, y: 30, width: 300, height: 200 } }) as never,
    );
    const [resizeHandler] = handlers;

    expect(camera.setBounds).toHaveBeenLastCalledWith(-80, -70, 500, 400);
    expect(camera.setZoom).toHaveBeenCalledWith(1);

    camera.width = 700;
    camera.height = 500;
    resizeHandler?.();

    expect(camera.setBounds).toHaveBeenLastCalledWith(-180, -120, 700, 500);
    controller.destroy();
  });

  it("큰 맵은 원래 bounds를 유지한다", () => {
    const { scene, camera } = createSceneHarness();
    const controller = new TownMapCameraController(
      scene as never,
      createMapLoader({ bounds: { x: 20, y: 30, width: 900, height: 700 } }) as never,
    );

    expect(camera.setBounds).toHaveBeenLastCalledWith(20, 30, 900, 700);
    controller.destroy();
  });

  it("기존 카메라 추적 설정으로 전달된 캐릭터를 따라간다", () => {
    const { scene, camera } = createSceneHarness();
    const controller = new TownMapCameraController(scene as never, null);
    const target = {} as Phaser.GameObjects.GameObject;

    controller.follow(target);

    expect(camera.startFollow).toHaveBeenCalledWith(target, true, 1, 1);
  });

  it("Scene 종료 시 자신이 등록한 resize 핸들러만 해제한다", () => {
    const { scene, handlers } = createSceneHarness();
    const otherOwnerHandler = vi.fn();
    handlers.add(otherOwnerHandler);
    const controller = new TownMapCameraController(scene as never, createMapLoader() as never);
    const ownedHandler = [...handlers].find((handler) => handler !== otherOwnerHandler);

    controller.destroy();

    expect(handlers.has(otherOwnerHandler)).toBe(true);
    expect(handlers.size).toBe(1);
    expect(scene.scale.off).toHaveBeenCalledWith("resize", ownedHandler);
  });

  it("맵 데이터가 없으면 맵·카메라 설정과 resize 구독을 건너뛴다", () => {
    const { scene, camera } = createSceneHarness();
    const controller = new TownMapCameraController(scene as never, null);

    expect(scene.add.image).not.toHaveBeenCalled();
    expect(camera.setBounds).not.toHaveBeenCalled();
    expect(camera.setZoom).not.toHaveBeenCalled();
    expect(scene.scale.on).not.toHaveBeenCalled();

    controller.destroy();
    expect(scene.scale.off).not.toHaveBeenCalled();
  });

  it("Scene 재진입 때 resize 핸들러가 중복되지 않고 다른 소유자 핸들러를 유지한다", () => {
    const { scene, handlers } = createSceneHarness();
    const otherOwnerHandler = vi.fn();
    handlers.add(otherOwnerHandler);

    const firstController = new TownMapCameraController(scene as never, createMapLoader() as never);
    expect(handlers.size).toBe(2);
    firstController.destroy();
    expect(handlers.size).toBe(1);

    const secondController = new TownMapCameraController(
      scene as never,
      createMapLoader() as never,
    );
    expect(handlers.size).toBe(2);
    secondController.destroy();

    expect(handlers.size).toBe(1);
    expect(handlers.has(otherOwnerHandler)).toBe(true);
  });
});
