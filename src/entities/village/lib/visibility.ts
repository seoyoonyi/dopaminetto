import { VILLAGE_IDS } from "../config/villageData";
import { VillageId } from "../model/types";

/** 현재 village에서 직접 이어진 village 목록을 반환한다. */
export const getAdjacentVillages = (villageId: VillageId): VillageId[] =>
  VILLAGE_IDS.filter((adjacentVillageId) => adjacentVillageId !== villageId);

/** 현재 village 자신과 인접 village를 합친 visible 범위를 반환한다. */
export const getVisibleVillages = (villageId: VillageId): VillageId[] => [
  villageId,
  ...VILLAGE_IDS.filter((visibleVillageId) => visibleVillageId !== villageId),
];
