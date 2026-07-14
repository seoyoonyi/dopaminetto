import type { MapLoader } from "@/entities/village";
import { CAMPFIRE_VILLAGE_IDS } from "@/features/ambientSound/model/config";
import { AmbientSoundSource } from "@/features/ambientSound/model/types";

/**
 * Tiled Effects 레이어에 배치된 실제 campfire Point Object 좌표를 그대로 환경음 소스로 사용한다
 * (새 오브젝트를 만들지 않고 CampfireEffectsController가 렌더링에 쓰는 것과 동일한 좌표를 재사용).
 * 각 campfire가 속한 마을은 좌표 기준으로 getVillageAt을 통해 판정하며, CAMPFIRE_VILLAGE_IDS에
 * 포함된 마을(현재는 village-a) 소속 campfire만 남기고 나머지(village-b, lobby)는 걸러낸다.
 * 실제 가청 여부는 거리뿐 아니라 소스의 villageId와 플레이어의 현재 villageId 일치 여부로도
 * 게이트되므로(AmbientSoundController 참고), village-a 경계 바로 바깥까지 소리가 새어나가지는 않는다.
 */
const CAMPFIRE_VILLAGE_ID_SET: Set<string> = new Set(CAMPFIRE_VILLAGE_IDS);

export const resolveCampfireSources = (mapLoader: MapLoader): AmbientSoundSource[] =>
  mapLoader
    .getCampfireEffects()
    .map((effect) => ({
      id: `campfire-${effect.id}`,
      villageId: mapLoader.getVillageAt({ x: effect.x, y: effect.y }),
      x: effect.x,
      y: effect.y,
    }))
    .filter((source) => CAMPFIRE_VILLAGE_ID_SET.has(source.villageId));
