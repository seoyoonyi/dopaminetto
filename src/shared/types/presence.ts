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
  isSpeaker?: boolean;
  /** 음성 채널에 연결되어 있는지 여부 */
  voiceConnected?: boolean;
  /** 발표자의 마이크가 실제로 활성화되어 있는지 여부 */
  audioEnabled?: boolean;
}

/**
 * Supabase presenceState() raw item 구조
 * - presence_ref는 snake_case로 내려옵니다.
 * - joinedAt / villageId는 누락될 수 있습니다.
 */
export interface PresenceStateItem extends Partial<Omit<PresenceTrackPayload, "villageId">> {
  presence_ref: string;
  villageId?: string | null;
  user_id?: string;
  user_nickname?: string;
  joined_at?: string;
  online_at?: string;
}
