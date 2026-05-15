import { VillageId } from "@/entities/village";
import { CharacterId, resolveCharacterId } from "@/features/movement/model/config";
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

export const normalizeCharacterId = (characterId?: string | null): CharacterId =>
  resolveCharacterId(characterId);

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
  characterId: normalizeCharacterId(characterId),
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
  characterId: normalizeCharacterId(characterId),
});
