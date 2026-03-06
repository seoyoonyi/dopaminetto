import { VillageId } from "@/entities/village";
import { PresenceParticipant } from "@/features/presence/types";

export const groupParticipantsByVillage = (participants: PresenceParticipant[]) =>
  participants.reduce(
    (acc, participant) => {
      if (!acc[participant.villageId]) acc[participant.villageId] = [];
      acc[participant.villageId]?.push(participant);
      return acc;
    },
    {} as Partial<Record<VillageId, PresenceParticipant[]>>,
  );
