import { VillageId } from "@/entities/village";
import type { PresenceMetadata, SyncPositionPayload } from "@/features/movement/model/types";

export interface MovementSyncHandlers {
  attachVillageChannel: (targetVillageId: VillageId) => void;
  broadcastSyncLeave: (targetVillageId: VillageId) => void;
  cleanupAllChannels: () => void;
  detachVillageChannel: (targetVillageId: VillageId) => void;
  scheduleRemotePlayerRemovalCheck: (remoteUserId: string) => void;
  syncChannelSnapshot: (channelName: string) => void;
  trackCurrentPresence: (retryCount?: number) => Promise<void>;
  upsertVisibleRemotePlayer: (player: PresenceMetadata | SyncPositionPayload) => void;
}

export interface ChannelBinding {
  cleanupObservers: () => void;
  presenceUserIds: Set<string>;
  release: () => void;
}

export interface MovementSyncState {
  activeUserId: string | null;
  channelBindings: Map<string, ChannelBinding>;
  handlers: MovementSyncHandlers;
  joinedAt: string;
  lastPresenceSignature: string;
  pendingRemovalTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  trackRequestId: number;
  trackRetryTimeout: ReturnType<typeof setTimeout> | null;
  trackedVillageId: VillageId | null;
  visibleVillageKey: string;
  visibleVillages: VillageId[];
}
