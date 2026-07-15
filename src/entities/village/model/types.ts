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

/**
 * Effects 오브젝트 레이어의 campfire Point Object에서 파싱된 원시 데이터
 * animationKey/scale/depthOffset/colliderWidth/colliderHeight/colliderOffsetX/colliderOffsetY는
 * Tiled custom property로 설정된 경우에만 값이 채워지며, 없으면 소비하는 쪽(예:
 * resolveCampfireVisuals, MapLoader의 충돌 사각형 파생 로직)에서 기본값을 적용한다.
 * MapLoader는 원시 값만 전달하고 도메인 기본값은 알지 못한다.
 */
export interface CampfireEffect {
  id: number;
  name: string;
  x: number;
  y: number;
  animationKey?: string;
  scale?: number;
  depthOffset?: number;
  colliderWidth?: number;
  colliderHeight?: number;
  colliderOffsetX?: number;
  colliderOffsetY?: number;
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
