import type { MapLoader } from "@/entities/village";
import type * as Phaser from "phaser";

import { createSnowPointGenerator } from "./snowfallSpawnZone";

const SNOW_TEXTURE_KEY = "town-snowflake";
const SNOW_DEPTHS = [900, 9000];

/** Tiled 맵 전체에 눈 파티클을 표시한다. */
export class SnowfallEffectsController {
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[];

  constructor(
    private readonly scene: Phaser.Scene,
    mapLoader: MapLoader,
  ) {
    if (!scene.textures.exists(SNOW_TEXTURE_KEY)) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xffffff, 0.9).fillCircle(8, 8, 6);
      graphics.generateTexture(SNOW_TEXTURE_KEY, 16, 16);
      graphics.destroy();
    }

    const generateSnowPoint = createSnowPointGenerator(mapLoader.getMapBounds());

    const config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      accelerationX: {
        onUpdate: (_particle, _key, lifetime) => Math.sin(lifetime * Math.PI * 2) * 4,
      },
      alpha: { min: 0.55, max: 0.9 },
      emitting: false,
      emitZone: {
        type: "random",
        source: { getRandomPoint: generateSnowPoint },
      },
      frequency: 140,
      lifespan: { min: 5000, max: 7000 },
      maxAliveParticles: 40,
      quantity: 1,
      speedX: { min: -8, max: 8 },
      speedY: { min: 18, max: 34 },
      scale: { min: 0.5, max: 0.7 },
    };

    this.emitters = SNOW_DEPTHS.map((depth) =>
      scene.add.particles(0, 0, SNOW_TEXTURE_KEY, { ...config }).setDepth(depth),
    );
    this.emitters.forEach((emitter) => emitter.start());
  }

  destroy(): void {
    this.emitters.forEach((emitter) => emitter.destroy());
    this.scene.textures.remove(SNOW_TEXTURE_KEY);
  }
}
