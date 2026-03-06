import { VillageId } from "@/entities/village";

export interface PresenceParticipant {
  userId: string;
  nickname: string;
  joinedAt?: string;
  presenceRef: string;
  villageId: VillageId;
}
