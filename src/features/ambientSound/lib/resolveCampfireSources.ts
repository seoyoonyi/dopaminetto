import type { MapLoader } from "@/entities/village";
import { CAMPFIRE_SOUND_CONFIG, CAMPFIRE_VILLAGE_IDS } from "@/features/ambientSound/model/config";
import { AmbientSoundSource } from "@/features/ambientSound/model/types";

/**
 * CAMPFIRE_VILLAGE_IDS에 포함된 마을(VillageArea)의 기하학적 중심에 모닥불을 배치한다.
 * 중심점은 사각형 대각선 절반 거리 안에서 모든 모서리를 커버하는 위치다. 여기에 맞춰
 * outerRadius도 "대각선 절반 거리 + OUTER_RADIUS_MARGIN"으로 마을별로 동적 계산하므로,
 * Tiled에서 village-a 영역 크기/위치를 바꿔도 재계산되어 항상 영역 전체에서 소리가 들린다.
 * 실제 가청 여부는 거리뿐 아니라 소스의 villageId와 플레이어의 현재 villageId 일치 여부로도
 * 게이트되므로(CampfireAmbientController 참고), 반경이 넓어져도 마을 경계 바로 바깥(예: lobby)까지
 * 소리가 새어나가지는 않는다.
 * lobby와 CAMPFIRE_VILLAGE_IDS에 없는 마을(village-b)에는 모닥불을 두지 않는다.
 */
const CAMPFIRE_VILLAGE_ID_SET: Set<string> = new Set(CAMPFIRE_VILLAGE_IDS);

export const resolveCampfireSources = (mapLoader: MapLoader): AmbientSoundSource[] =>
  mapLoader
    .getVillageAreas()
    .filter((area) => CAMPFIRE_VILLAGE_ID_SET.has(area.name))
    .map((area) => {
      const centerX = area.x + area.width / 2;
      const centerY = area.y + area.height / 2;
      const halfDiagonal = Math.hypot(area.width / 2, area.height / 2);
      const outerRadius = Math.max(
        CAMPFIRE_SOUND_CONFIG.MIN_OUTER_RADIUS,
        halfDiagonal + CAMPFIRE_SOUND_CONFIG.OUTER_RADIUS_MARGIN,
      );

      return {
        id: `campfire-${area.name}`,
        villageId: area.name,
        x: centerX,
        y: centerY,
        outerRadius,
      };
    });
