import { VillageId } from "@/entities/village";
import { resolveCharacterId } from "@/features/movement/model/config";
import {
  Position,
  PresenceMetadata,
  SyncPositionPayload,
  SyncedActionState,
} from "@/features/movement/model/types";

interface CreatePresencePayloadParams {
  userId: string;
  nickname: string;
  joinedAt: string;
  villageId: VillageId;
  position: Position;
  characterId?: string | null;
  actionState?: SyncedActionState;
}

interface CreateSyncPositionPayloadParams {
  userId: string;
  nickname: string;
  villageId: VillageId;
  position: Position;
  characterId?: string | null;
  actionState?: SyncedActionState;
}

export const createPresencePayload = ({
  userId,
  nickname,
  joinedAt,
  villageId,
  position,
  characterId,
  actionState = null,
}: CreatePresencePayloadParams): PresenceMetadata => ({
  userId,
  nickname,
  joinedAt,
  villageId,
  position,
  characterId: resolveCharacterId(characterId),
  actionState,
});

export const createPresenceTrackSignature = ({
  userId,
  nickname,
  joinedAt,
  villageId,
  characterId,
  actionState,
}: PresenceMetadata) =>
  JSON.stringify({
    userId,
    nickname,
    joinedAt,
    villageId,
    characterId,
    actionState,
  });

export const createSyncPositionPayload = ({
  userId,
  nickname,
  villageId,
  position,
  characterId,
  actionState = null,
}: CreateSyncPositionPayloadParams): SyncPositionPayload => ({
  userId,
  nickname,
  villageId,
  position,
  characterId: resolveCharacterId(characterId),
  actionState,
});
