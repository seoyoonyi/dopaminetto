import type { MapLoader } from "@/entities/village";
import type * as Phaser from "phaser";

import { createSnowPointGenerator } from "./snowfallSpawnZone";

const SNOW_TEXTURE_KEY = "town-snowflake";
const SNOW_DEPTH = 900;

/** Tiled 맵 전체에 눈 파티클을 표시한다. */
export class SnowfallEffectsController {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    mapLoader: MapLoader,
  ) {
    if (!scene.textures.exists(SNOW_TEXTURE_KEY)) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xffffff, 0.9).fillCircle(4, 4, 3.5);
      graphics.generateTexture(SNOW_TEXTURE_KEY, 8, 8);
      graphics.destroy();
    }

    const generateSnowPoint = createSnowPointGenerator(mapLoader.getMapBounds());

    this.emitter = scene.add
      .particles(0, 0, SNOW_TEXTURE_KEY, {
        alpha: { min: 0.55, max: 0.9 },
        emitting: false,
        emitZone: {
          type: "random",
          source: { getRandomPoint: generateSnowPoint },
        },
        frequency: 70,
        lifespan: { min: 5000, max: 7000 },
        maxAliveParticles: 80,
        quantity: 1,
        speedX: { min: -8, max: 8 },
        speedY: { min: 18, max: 34 },
        scale: { min: 0.7, max: 1.1 },
      })
      .setDepth(SNOW_DEPTH);

    this.emitter.start();
  }

  destroy(): void {
    this.emitter.destroy();
    this.scene.textures.remove(SNOW_TEXTURE_KEY);
  }
}
