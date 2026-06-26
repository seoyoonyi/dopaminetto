import { LOBBY_VILLAGE_ID, VillageConfig, VillageId } from "../model/types";

export const VILLAGE_A_CONFIG: VillageConfig = {
  id: "village-a",
  name: "Village A",
  color: "#4e79a7",
};

export const VILLAGE_B_CONFIG: VillageConfig = {
  id: "village-b",
  name: "Village B",
  color: "#f28e2c",
};

export const LOBBY_VILLAGE_CONFIG: VillageConfig = {
  id: LOBBY_VILLAGE_ID,
  name: "Lobby",
  color: "#94a3b8",
};

export const VILLAGES = {
  [VILLAGE_A_CONFIG.id]: VILLAGE_A_CONFIG,
  [VILLAGE_B_CONFIG.id]: VILLAGE_B_CONFIG,
  [LOBBY_VILLAGE_CONFIG.id]: LOBBY_VILLAGE_CONFIG,
} as const;

export const VILLAGE_IDS = Object.keys(VILLAGES) as VillageId[];

export const isVillageId = (value: string): value is VillageId => value in VILLAGES;
