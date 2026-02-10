import { VillageId } from "@/entities/village";

export const MOVEMENT_EVENT_TYPES = {
  VILLAGE_CHANGE: "VILLAGE_CHANGE",
  NONE: "NONE",
} as const;

export type MovementEventType = (typeof MOVEMENT_EVENT_TYPES)[keyof typeof MOVEMENT_EVENT_TYPES];

export interface Position {
  x: number;
  y: number;
}

export interface MovementState {
  position: Position;
  villageId: VillageId;
  nickname: string;
  userId: string;
  remotePlayers: Record<string, RemotePlayer>;
}

export interface RemotePlayer {
  userId: string;
  nickname: string;
  position: Position;
  villageId: VillageId;
  lastUpdatedAt: number;
}

/**
 * Presence 메타데이터 구조 (RemotePlayer와 호환)
 */
export interface PresenceMetadata {
  userId: string;
  nickname: string;
  position: Position;
  villageId: VillageId;
  joinedAt: string;
}

/**
 * Broadcast 페이로드 정의
 */
export interface SyncPositionPayload {
  userId: string;
  nickname: string;
  position: Position;
  villageId: VillageId;
}

export interface SyncLeavePayload {
  userId: string;
}

/**
 * 이동 중에 발생할 수 있는 특이 이벤트 (예: 마을 이동) 정보
 */
export interface ValidationEvent {
  type: MovementEventType;
  fromVillageId?: VillageId;
  toVillageId?: VillageId;
}

/**
 * 이동 검증 함수의 최종 출력 구조
 */
export interface ValidationResult {
  nextPosition: Position;
  nextVillageId: VillageId;
  event: ValidationEvent;
}
