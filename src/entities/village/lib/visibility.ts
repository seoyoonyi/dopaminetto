import { TRANSITION_ZONES } from "../config/villageData";
import { VillageId } from "../model/types";

/** 현재 village와 인접 village를 계산해 구독/렌더링 범위를 정한다. */
const adjacencyMap = TRANSITION_ZONES.reduce((map, { fromVillageId, toVillageId }) => {
  if (!map.has(fromVillageId)) {
    map.set(fromVillageId, new Set<VillageId>());
  }

  map.get(fromVillageId)!.add(toVillageId);
  return map;
}, new Map<VillageId, Set<VillageId>>());

/** 현재 village에서 직접 이어진 village 목록을 반환한다. */
export const getAdjacentVillages = (villageId: VillageId): VillageId[] =>
  Array.from(adjacencyMap.get(villageId) ?? []);

/** 현재 village 자신과 인접 village를 합친 visible 범위를 반환한다. */
export const getVisibleVillages = (villageId: VillageId): VillageId[] => [
  villageId,
  ...getAdjacentVillages(villageId).filter((adjacentVillageId) => adjacentVillageId !== villageId),
];
