import type * as Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";

import { SnowfallEffectsController } from "./SnowfallEffectsController";

describe("SnowfallEffectsController", () => {
  it("맵 범위 전체에서 빌리지 상태와 무관하게 눈을 계속 내린다", () => {
    const emitters = Array.from({ length: 2 }, () => ({
      start: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }));
    const graphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      generateTexture: vi.fn(),
      destroy: vi.fn(),
    };
    const worldView = { x: 20, y: 30, width: 800, height: 600 };
    const particleConfigs: unknown[] = [];
    const mapLoader = {
      getMapBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      getVillageAreas: vi.fn(() => [
        { id: 1, name: "village-b", type: "VillageArea", x: 40, y: 20, width: 40, height: 60 },
      ]),
    };
    const scene = {
      add: {
        graphics: vi.fn(() => graphics),
        particles: vi.fn((...args: unknown[]) => {
          particleConfigs.push(args[3]);
          return emitters[particleConfigs.length - 1];
        }),
      },
      textures: { exists: vi.fn(() => false), remove: vi.fn() },
      cameras: { main: { worldView } },
    };

    const controller = new SnowfallEffectsController(scene as never, mapLoader as never);

    expect(graphics.fillCircle).toHaveBeenCalledWith(8, 8, 6);
    expect(graphics.generateTexture).toHaveBeenCalledWith("town-snowflake", 16, 16);
    expect(scene.add.particles).toHaveBeenCalledTimes(2);
    expect(emitters.map((emitter) => emitter.setDepth.mock.calls[0]?.[0])).toEqual([900, 9000]);
    expect(emitters.every((emitter) => emitter.start.mock.calls.length === 1)).toBe(true);
    expect(particleConfigs).toHaveLength(2);
    expect(particleConfigs[0]).toEqual(
      expect.objectContaining({
        alpha: { min: 0.55, max: 0.9 },
        accelerationX: expect.objectContaining({ onUpdate: expect.any(Function) }),
        frequency: 140,
        maxAliveParticles: 40,
        scale: { min: 0.5, max: 0.7 },
      }),
    );
    expect(particleConfigs[1]).toEqual(
      expect.objectContaining({ frequency: 140, maxAliveParticles: 40 }),
    );
    const config = particleConfigs[0] as {
      emitZone: { source: { getRandomPoint: (point: { x: number; y: number }) => void } };
      accelerationX: {
        onUpdate: (
          particle: Phaser.GameObjects.Particles.Particle,
          key: string,
          t: number,
          value: number,
        ) => number;
      };
    };
    expect(
      config.accelerationX.onUpdate(
        {} as Phaser.GameObjects.Particles.Particle,
        "accelerationX",
        0.25,
        0,
      ),
    ).toBeCloseTo(4);
    expect(
      config.accelerationX.onUpdate(
        {} as Phaser.GameObjects.Particles.Particle,
        "accelerationX",
        0.75,
        0,
      ),
    ).toBeCloseTo(-4);
    const generatePoint = config.emitZone.source.getRandomPoint;
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);
    const point = { x: 0, y: 0 };
    generatePoint(point);
    expect(point).toEqual({ x: 50, y: 50 });
    expect(mapLoader.getVillageAreas).not.toHaveBeenCalled();
    expect(emitters.every((emitter) => emitter.setPosition.mock.calls.length === 0)).toBe(true);
    expect(emitters.every((emitter) => emitter.stop.mock.calls.length === 0)).toBe(true);

    controller.destroy();
    expect(emitters.every((emitter) => emitter.destroy.mock.calls.length === 1)).toBe(true);
  });
});
