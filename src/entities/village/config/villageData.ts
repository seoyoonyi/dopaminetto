import { VillageConfig, VillageId } from "../model/types";

export const VILLAGE_A_CONFIG: VillageConfig = {
  id: "village-a",
  name: "Village A",
  boundary: { x1: 0, y1: 0, x2: 800, y2: 600 },
  color: "#4e79a7",
};

export const VILLAGE_B_CONFIG: VillageConfig = {
  id: "village-b",
  name: "Village B",
  boundary: { x1: 800, y1: 0, x2: 1600, y2: 600 },
  color: "#f28e2c",
};

export const VILLAGES = {
  [VILLAGE_A_CONFIG.id]: VILLAGE_A_CONFIG,
  [VILLAGE_B_CONFIG.id]: VILLAGE_B_CONFIG,
} as const;

// 이동 구역 (Transition zones) - 경계선 근처를 트리거로 설정
export const TRANSITION_ZONES = [
  {
    fromVillageId: "village-a" as VillageId,
    toVillageId: "village-b" as VillageId,
    triggerZone: { x1: 795, y1: 0, x2: 800, y2: 600 },
    spawnPosition: { x: 820, y: 300 },
  },
  {
    fromVillageId: "village-b" as VillageId,
    toVillageId: "village-a" as VillageId,
    triggerZone: { x1: 800, y1: 0, x2: 805, y2: 600 },
    spawnPosition: { x: 780, y: 300 },
  },
] as const;
