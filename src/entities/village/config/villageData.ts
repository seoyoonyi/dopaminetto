import { LOBBY_VILLAGE_ID, VillageConfig, VillageId } from "../model/types";

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

export const LOBBY_VILLAGE_CONFIG: VillageConfig = {
  id: LOBBY_VILLAGE_ID,
  name: "Lobby",
  boundary: { x1: 0, y1: 600, x2: 1600, y2: 1200 },
  color: "#94a3b8",
};

export const VILLAGES = {
  [VILLAGE_A_CONFIG.id]: VILLAGE_A_CONFIG,
  [VILLAGE_B_CONFIG.id]: VILLAGE_B_CONFIG,
  [LOBBY_VILLAGE_CONFIG.id]: LOBBY_VILLAGE_CONFIG,
} as const;

// 이동 구역 (Transition zones) - 경계선 근처를 트리거로 설정
export const TRANSITION_ZONES = [
  // Lobby -> Village A (left half of top edge)
  {
    fromVillageId: LOBBY_VILLAGE_ID as VillageId,
    toVillageId: "village-a" as VillageId,
    triggerZone: { x1: 0, y1: 600, x2: 799, y2: 620 },
    spawnPosition: { x: 400, y: 560 },
  },
  // Lobby -> Village B (right half of top edge)
  {
    fromVillageId: LOBBY_VILLAGE_ID as VillageId,
    toVillageId: "village-b" as VillageId,
    triggerZone: { x1: 800, y1: 600, x2: 1600, y2: 620 },
    spawnPosition: { x: 1200, y: 560 },
  },
  // Village A -> Lobby (bottom edge)
  {
    fromVillageId: "village-a" as VillageId,
    toVillageId: LOBBY_VILLAGE_ID as VillageId,
    triggerZone: { x1: 0, y1: 600, x2: 800, y2: 620 },
    spawnPosition: { x: 400, y: 640 },
  },
  // Village B -> Lobby (bottom edge)
  {
    fromVillageId: "village-b" as VillageId,
    toVillageId: LOBBY_VILLAGE_ID as VillageId,
    triggerZone: { x1: 800, y1: 600, x2: 1600, y2: 620 },
    spawnPosition: { x: 1200, y: 640 },
  },
  // Village A -> Village B (side gate)
  {
    fromVillageId: "village-a" as VillageId,
    toVillageId: "village-b" as VillageId,
    triggerZone: { x1: 795, y1: 0, x2: 800, y2: 600 },
    spawnPosition: { x: 820, y: 300 },
  },
  // Village B -> Village A (side gate)
  {
    fromVillageId: "village-b" as VillageId,
    toVillageId: "village-a" as VillageId,
    triggerZone: { x1: 800, y1: 0, x2: 805, y2: 600 },
    spawnPosition: { x: 780, y: 300 },
  },
] as const;
