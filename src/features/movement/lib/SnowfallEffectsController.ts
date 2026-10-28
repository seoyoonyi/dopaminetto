import type { MapLoader } from "@/entities/village";
import type * as Phaser from "phaser";

import { createSnowPointGenerator } from "./snowfallSpawnZone";

const SNOW_TEXTURE_KEY = "town-snowflake";
const SNOW_DEPTHS = [900, 9000];
const MIN_FALL_SPEED = 18;
const MAX_FALL_SPEED = 34;

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

    const mapBounds = mapLoader.getMapBounds();
    const groundY = mapBounds.y + mapBounds.height;
    const fadeDistance = mapBounds.height * 0.1;
    const generateSnowPoint = createSnowPointGenerator(mapBounds);
    // 수명과 실제 낙하 속도를 입자별로 연결한다.
    const fallSpeedByParticle = new WeakMap<Phaser.GameObjects.Particles.Particle, number>();
    const startXByParticle = new WeakMap<Phaser.GameObjects.Particles.Particle, number>();
    // 기준 알파를 보존해 매 프레임 투명도가 누적 감소하지 않게 한다.
    const alphaByParticle = new WeakMap<Phaser.GameObjects.Particles.Particle, number>();

    // 맵 아래쪽 10% 구간에서만 투명도를 1에서 0으로 낮춘다.
    const getGroundOpacity = (y: number) => Math.min(1, Math.max(0, (groundY - y) / fadeDistance));

    const config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      // 가속도를 계속 적용하면 한 주기에도 한쪽으로 밀릴 수 있어 생성 X를 중심으로 흔든다.
      x: {
        onEmit: (particle) => {
          if (particle) startXByParticle.set(particle, particle.x);
          return 0;
        },
        onUpdate: (particle, _key, lifetime, value) =>
          (startXByParticle.get(particle) ?? value) + Math.sin(lifetime * Math.PI * 2) * 8,
      },
      alpha: {
        onEmit: (particle) => {
          const alpha = 0.55 + Math.random() * 0.35;
          if (particle) alphaByParticle.set(particle, alpha);
          return alpha * (particle ? getGroundOpacity(particle.y) : 1);
        },
        onUpdate: (particle, _key, _lifetime, value) =>
          (alphaByParticle.get(particle) ?? value) * getGroundOpacity(particle.y),
      },
      emitting: false,
      emitZone: {
        type: "random",
        source: { getRandomPoint: generateSnowPoint },
      },
      frequency: 140,
      lifespan: {
        onEmit: (particle) => {
          if (!particle) return 1000;

          // Phaser는 speedY보다 lifespan 콜백을 먼저 실행하므로 선택한 속도를 공유한다.
          const fallSpeed = MIN_FALL_SPEED + Math.random() * (MAX_FALL_SPEED - MIN_FALL_SPEED);
          fallSpeedByParticle.set(particle, fallSpeed);
          // 입자가 맵 하단에 도달할 때 수명이 끝나도록 남은 거리를 사용한다.
          return Math.max(0, ((groundY - particle.y) / fallSpeed) * 1000);
        },
      },
      maxAliveParticles: 40,
      quantity: 1,
      speedY: { onEmit: (particle) => (particle ? (fallSpeedByParticle.get(particle) ?? 26) : 26) },
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
