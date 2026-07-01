import { LOBBY_VILLAGE_ID, PlayableVillageId, VillageConfig, VillageId } from "../model/types";

type VillageRegistry = {
  [K in VillageId]: VillageConfig & { id: K };
};

export const VILLAGE_A_CONFIG = {
  id: "village-a",
  name: "Village A",
  color: "#4e79a7",
} as const satisfies VillageConfig;

export const VILLAGE_B_CONFIG = {
  id: "village-b",
  name: "Village B",
  color: "#f28e2c",
} as const satisfies VillageConfig;

export const LOBBY_VILLAGE_CONFIG = {
  id: LOBBY_VILLAGE_ID,
  name: "Lobby",
  color: "#94a3b8",
} as const satisfies VillageConfig;

export const VILLAGES = {
  "village-a": VILLAGE_A_CONFIG,
  "village-b": VILLAGE_B_CONFIG,
  [LOBBY_VILLAGE_ID]: LOBBY_VILLAGE_CONFIG,
} as const satisfies VillageRegistry;

export const VILLAGE_IDS = Object.keys(VILLAGES) as VillageId[];

export const PLAYABLE_VILLAGE_IDS = VILLAGE_IDS.filter(
  (villageId): villageId is PlayableVillageId => villageId !== LOBBY_VILLAGE_ID,
);

export const isVillageId = (value: string): value is VillageId => value in VILLAGES;
