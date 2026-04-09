import { VillageId } from "@/entities/village";

/** 타운 presence 채널에서 동기화되는 참여자 정보 */
export interface PresenceParticipant {
  userId: string;
  nickname: string;
  joinedAt?: string;
  presenceRef: string;
  villageId: VillageId;
  /** 음성 채널에 연결되어 있는지 여부 */
  voiceConnected?: boolean;
}
