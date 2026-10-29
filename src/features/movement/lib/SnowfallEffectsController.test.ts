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
        alpha: expect.objectContaining({
          onEmit: expect.any(Function),
          onUpdate: expect.any(Function),
        }),
        frequency: 140,
        lifespan: expect.objectContaining({ onEmit: expect.any(Function) }),
        maxAliveParticles: 40,
        scale: { min: 0.5, max: 0.7 },
        speedY: expect.objectContaining({ onEmit: expect.any(Function) }),
        x: expect.objectContaining({
          onEmit: expect.any(Function),
          onUpdate: expect.any(Function),
        }),
      }),
    );
    expect(particleConfigs[0]).not.toHaveProperty("accelerationX");
    expect(particleConfigs[0]).not.toHaveProperty("speedX");
    expect(particleConfigs[1]).toEqual(
      expect.objectContaining({ frequency: 140, maxAliveParticles: 40 }),
    );
    const config = particleConfigs[0] as {
      emitZone: { source: { getRandomPoint: (point: { x: number; y: number }) => void } };
      x: {
        onEmit: (particle: Phaser.GameObjects.Particles.Particle) => number;
        onUpdate: (
          particle: Phaser.GameObjects.Particles.Particle,
          key: string,
          lifetime: number,
          value: number,
        ) => number;
      };
      lifespan: { onEmit: (particle: Phaser.GameObjects.Particles.Particle) => number };
      speedY: { onEmit: (particle: Phaser.GameObjects.Particles.Particle) => number };
      alpha: {
        onEmit: (particle: Phaser.GameObjects.Particles.Particle) => number;
        onUpdate: (
          particle: Phaser.GameObjects.Particles.Particle,
          key: string,
          lifetime: number,
          value: number,
        ) => number;
      };
    };
    const particle = { x: 25, y: 20, life: 1000 } as Phaser.GameObjects.Particles.Particle;
    expect(config.x.onEmit(particle)).toBe(0);
    expect(config.x.onUpdate(particle, "x", 0, particle.x)).toBeCloseTo(25);
    expect(config.x.onUpdate(particle, "x", 0.25, particle.x)).toBeCloseTo(33);
    expect(config.x.onUpdate(particle, "x", 0.75, particle.x)).toBeCloseTo(17);
    expect(config.x.onUpdate(particle, "x", 1, particle.x)).toBeCloseTo(25);
    const lifespan = config.lifespan.onEmit(particle);
    const fallSpeed = config.speedY.onEmit(particle);
    expect(fallSpeed).toBeGreaterThanOrEqual(18);
    expect(fallSpeed).toBeLessThanOrEqual(34);
    expect((lifespan * fallSpeed) / 1000).toBeCloseTo(80);
    const initialAlpha = config.alpha.onEmit(particle);
    expect(initialAlpha).toBeGreaterThanOrEqual(0.55);
    expect(initialAlpha).toBeLessThanOrEqual(0.9);
    expect(config.alpha.onUpdate(particle, "alpha", 0.9, initialAlpha)).toBe(initialAlpha);
    particle.y = 96;
    expect(config.alpha.onUpdate(particle, "alpha", 0.95, initialAlpha)).toBeLessThan(initialAlpha);
    particle.y = 100;
    expect(config.alpha.onUpdate(particle, "alpha", 1, initialAlpha)).toBe(0);
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
