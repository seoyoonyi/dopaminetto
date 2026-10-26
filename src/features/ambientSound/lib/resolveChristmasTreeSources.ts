import type { MapLoader } from "@/entities/village";
import type { AmbientSoundSource } from "@/features/ambientSound/model/types";

/** 트리 Effects 기준점을 렌더링 위치와 공유하는 환경음 소스로 변환한다. */
export const resolveChristmasTreeSources = (mapLoader: MapLoader): AmbientSoundSource[] => {
  const effect = mapLoader.getChristmasTreeEffect();
  if (!effect) return [];

  return [
    {
      id: `christmas-tree-${effect.id}`,
      villageId: mapLoader.getVillageAt({ x: effect.x, y: effect.y }),
      x: effect.x,
      y: effect.y,
    },
  ];
};
