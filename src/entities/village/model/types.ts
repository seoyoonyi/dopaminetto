export const LOBBY_VILLAGE_ID = "lobby";
export type LobbyVillageId = typeof LOBBY_VILLAGE_ID;
export type PlayableVillageId = "village-a" | "village-b";
export type VillageId = LobbyVillageId | PlayableVillageId;

export interface Boundary {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface VillageConfig {
  id: VillageId;
  name: string;
  boundary: Boundary;
  color: string; // 테스트 시 시각적 식별을 위한 색상
}
