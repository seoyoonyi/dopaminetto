import { describe, expect, it, vi } from "vitest";

import { SnowfallEffectsController } from "./SnowfallEffectsController";

describe("SnowfallEffectsController", () => {
  it("맵 범위 전체에서 빌리지 상태와 무관하게 눈을 계속 내린다", () => {
    const emitter = {
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const graphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      generateTexture: vi.fn(),
      destroy: vi.fn(),
    };
    const worldView = { x: 20, y: 30, width: 800, height: 600 };
    let particleConfig:
      | {
          emitZone: {
            source: { getRandomPoint: (point: { x: number; y: number }) => void };
          };
        }
      | undefined;
    const mapLoader = {
      getMapBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      getVillageAreas: vi.fn(() => [
        { id: 1, name: "village-b", type: "VillageArea", x: 40, y: 20, width: 40, height: 60 },
      ]),
    };
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
        particles: vi.fn(
          (...args: [number, number, string, NonNullable<typeof particleConfig>]) => {
            particleConfig = args[3];
            return emitter;
          },
        ),
      },
      textures: { exists: vi.fn(() => false), remove: vi.fn() },
      cameras: { main: { worldView } },
    };

    const controller = new SnowfallEffectsController(scene as never, mapLoader as never);

    expect(emitter.start).toHaveBeenCalledOnce();
    expect(scene.add.particles).toHaveBeenCalledWith(
      0,
      0,
      "town-snowflake",
      expect.objectContaining({
        alpha: { min: 0.55, max: 0.9 },
        scale: { min: 0.7, max: 1.1 },
      }),
    );
    const config = particleConfig!;
    const generatePoint = config.emitZone.source.getRandomPoint;
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);
    const point = { x: 0, y: 0 };
    generatePoint(point);
    expect(point).toEqual({ x: 50, y: 50 });
    expect(mapLoader.getVillageAreas).not.toHaveBeenCalled();
    expect(emitter.setPosition).not.toHaveBeenCalled();
    expect(emitter.stop).not.toHaveBeenCalled();

    controller.destroy();
    expect(emitter.destroy).toHaveBeenCalledOnce();
  });
});
