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
  boundary: { x1: 900, y1: 0, x2: 1700, y2: 600 },
  color: "#f28e2c",
};

export const VILLAGES = {
  [VILLAGE_A_CONFIG.id]: VILLAGE_A_CONFIG,
  [VILLAGE_B_CONFIG.id]: VILLAGE_B_CONFIG,
} as const;

// 이동 구역 (Transition zones)
// 현재는 단순하게 구현됨: A 마을에서 B 마을 방향의 끝에 도달하면 텔레포트합니다.
export const TRANSITION_ZONES = [
  {
    fromVillageId: "village-a" as VillageId,
    toVillageId: "village-b" as VillageId,
    triggerZone: { x1: 790, y1: 250, x2: 800, y2: 350 },
    spawnPosition: { x: 910, y: 300 },
  },
  {
    fromVillageId: "village-b" as VillageId,
    toVillageId: "village-a" as VillageId,
    triggerZone: { x1: 900, y1: 250, x2: 910, y2: 350 },
    spawnPosition: { x: 790, y: 300 },
  },
] as const;
