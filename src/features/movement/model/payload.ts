import { VillageId } from "@/entities/village";
import { resolveCharacterId } from "@/features/movement/model/config";
import { Position, PresenceMetadata, SyncPositionPayload } from "@/features/movement/model/types";

interface CreatePresencePayloadParams {
  userId: string;
  nickname: string;
  joinedAt: string;
  villageId: VillageId;
  position: Position;
  characterId?: string | null;
}

interface CreateSyncPositionPayloadParams {
  userId: string;
  nickname: string;
  villageId: VillageId;
  position: Position;
  characterId?: string | null;
}

export const createPresencePayload = ({
  userId,
  nickname,
  joinedAt,
  villageId,
  position,
  characterId,
}: CreatePresencePayloadParams): PresenceMetadata => ({
  userId,
  nickname,
  joinedAt,
  villageId,
  position,
  characterId: resolveCharacterId(characterId),
});

export const createPresenceTrackSignature = ({
  userId,
  nickname,
  joinedAt,
  villageId,
  characterId,
}: PresenceMetadata) =>
  JSON.stringify({
    userId,
    nickname,
    joinedAt,
    villageId,
    characterId,
  });

export const createSyncPositionPayload = ({
  userId,
  nickname,
  villageId,
  position,
  characterId,
}: CreateSyncPositionPayloadParams): SyncPositionPayload => ({
  userId,
  nickname,
  villageId,
  position,
  characterId: resolveCharacterId(characterId),
});
