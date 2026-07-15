import type { MapLoader } from "@/entities/village";

export const DEFAULT_CAMPFIRE_ANIMATION_KEY = "campfire-burning";

// 0.15는 너무 작고 이전 기본값(1)은 너무 컸다는 피드백에 따라 재조정. Tiled의 campfire
// 오브젝트에 scale custom property가 있으면 그 값이 우선 적용되고(아래 resolveCampfireVisuals
// 참고), 이 기본값은 property가 없을 때만 사용된다.
const DEFAULT_CAMPFIRE_SCALE = 0.4;
const DEFAULT_CAMPFIRE_DEPTH_OFFSET = 0;

export interface CampfireVisual {
  id: number;
  x: number;
  y: number;
  animationKey: string;
  scale: number;
  depthOffset: number;
}

/**
 * MapLoader가 제공하는 원시 CampfireEffect(Tiled custom property 미설정 시 값이 없을 수 있음)에
 * 렌더링 기본값을 채워 TownScene이 바로 사용할 수 있는 형태로 변환한다.
 * 충돌 관련 필드(colliderWidth/colliderHeight)는 이미 MapLoader 내부에서 collisionRects에
 * 반영되므로 여기서는 다루지 않는다.
 */
export const resolveCampfireVisuals = (mapLoader: MapLoader): CampfireVisual[] =>
  mapLoader.getCampfireEffects().map((effect) => ({
    id: effect.id,
    x: effect.x,
    y: effect.y,
    animationKey: effect.animationKey ?? DEFAULT_CAMPFIRE_ANIMATION_KEY,
    scale: effect.scale ?? DEFAULT_CAMPFIRE_SCALE,
    depthOffset: effect.depthOffset ?? DEFAULT_CAMPFIRE_DEPTH_OFFSET,
  }));
