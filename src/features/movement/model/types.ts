import { VillageId } from "@/entities/village";
import type { LocalActionId } from "@/features/movement/model/actionAnimation";
import { CharacterId } from "@/features/movement/model/config";

export const MOVEMENT_EVENT_TYPES = {
  VILLAGE_CHANGE: "VILLAGE_CHANGE",
  NONE: "NONE",
} as const;

export type MovementEventType = (typeof MOVEMENT_EVENT_TYPES)[keyof typeof MOVEMENT_EVENT_TYPES];

export type RestoreStatus = "loading" | "restored" | "fallback";

export interface Position {
  x: number;
  y: number;
}

export interface MovementState {
  position: Position;
  villageId: VillageId;
  nickname: string;
  userId: string;
  characterId: CharacterId;
  localActionState: SyncedActionState;
  remotePlayers: Record<string, RemotePlayer>;
}

export interface RemotePlayer {
  userId: string;
  /** 같은 사용자의 이전 방문과 재입장을 구분한다. */
  joinedAt?: string;
  sessionId?: string;
  nickname: string;
  characterId: CharacterId;
  position: Position;
  villageId: VillageId;
  actionState: SyncedActionState;
  lastUpdatedAt: number;
}

export type ActiveSyncedActionState = {
  actionId: LocalActionId;
  sequence: number;
};

export type SyncedActionState = ActiveSyncedActionState | null;

/**
 * Presence 메타데이터 구조 (RemotePlayer와 호환)
 */
export interface PresenceMetadata {
  userId: string;
  sessionId?: string;
  nickname: string;
  characterId: CharacterId;
  position: Position;
  villageId: VillageId;
  actionState: SyncedActionState;
  joinedAt: string;
}

/**
 * Broadcast 페이로드 정의
 */
export interface SyncPositionPayload {
  userId: string;
  joinedAt?: string;
  sessionId?: string;
  nickname: string;
  characterId: CharacterId;
  position: Position;
  villageId: VillageId;
  actionState: SyncedActionState;
}

export interface SyncLeavePayload {
  userId: string;
  joinedAt?: string;
  sessionId?: string;
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
