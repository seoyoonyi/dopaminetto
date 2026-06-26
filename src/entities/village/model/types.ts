export const LOBBY_VILLAGE_ID = "lobby";
export type LobbyVillageId = typeof LOBBY_VILLAGE_ID;
export type PlayableVillageId = "village-a" | "village-b";
export type VillageId = LobbyVillageId | PlayableVillageId;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VillageConfig {
  id: VillageId;
  name: string;
  color: string; // 테스트 시 시각적 식별을 위한 색상
}

export interface CollisionRect extends Rect {
  id: number;
  name: string;
  type: string;
}

export interface VillageArea extends Rect {
  id: number;
  name: VillageId;
  type: "VillageArea";
}

export interface SpawnPoint {
  id: number;
  name: string;
  type: "SpawnPoint";
  x: number;
  y: number;
}

export interface MapImageLayer {
  name: "Background" | "Front";
  image: string;
  url: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  visible: boolean;
}

export type MapBounds = Rect;
