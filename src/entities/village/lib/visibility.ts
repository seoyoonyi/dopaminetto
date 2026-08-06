import { VILLAGE_IDS } from "../config/villageData";
import { VillageId } from "../model/types";

/** 모든 village의 유저가 서로의 이동/presence를 볼 수 있도록 전체 village를 반환한다. */
export const getVisibleVillages = (villageId: VillageId): VillageId[] => [
  villageId,
  ...VILLAGE_IDS.filter((otherVillageId) => otherVillageId !== villageId),
];
