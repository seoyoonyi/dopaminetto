import { TRANSITION_ZONES } from "../config/villageData";
import { VillageId } from "../model/types";

const adjacencyMap = TRANSITION_ZONES.reduce((map, { fromVillageId, toVillageId }) => {
  if (!map.has(fromVillageId)) {
    map.set(fromVillageId, new Set<VillageId>());
  }

  map.get(fromVillageId)!.add(toVillageId);
  return map;
}, new Map<VillageId, Set<VillageId>>());

export const getAdjacentVillages = (villageId: VillageId): VillageId[] =>
  Array.from(adjacencyMap.get(villageId) ?? []);

export const getVisibleVillages = (villageId: VillageId): VillageId[] => [
  villageId,
  ...getAdjacentVillages(villageId).filter((adjacentVillageId) => adjacentVillageId !== villageId),
];
