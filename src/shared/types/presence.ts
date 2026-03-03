import { VillageId } from "@/entities/village";

/**
 * Presence 공용 타입 (BE/FE 공유)
 * - Supabase Presence track/payload 구조를 통합합니다.
 */
export interface PresenceTrackPayload {
  userId: string;
  nickname: string;
  villageId: VillageId;
  joinedAt: string;
  username?: string;
}

/**
 * Presence 상태 조회 시 포함되는 필드
 */
export interface PresenceStateItem extends PresenceTrackPayload {
  presenceRef: string;
}
