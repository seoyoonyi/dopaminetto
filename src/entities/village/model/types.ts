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
  name: VillageId;
  type: "SpawnPoint";
  x: number;
  y: number;
}

/** Effects 오브젝트 레이어의 크리스마스트리 기준점. 렌더링과 환경음이 같은 위치를 사용한다. */
export interface ChristmasTreeEffect {
  id: number;
  name: string;
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
