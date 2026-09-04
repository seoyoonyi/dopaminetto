import { VillageId } from "@/entities/village";
import type { PresenceMetadata, SyncPositionPayload } from "@/features/movement/model/types";
import type { DepartureGraceController } from "@/shared/lib/realtime/departureGrace";

export interface MovementSyncHandlers {
  attachVillageChannel: (targetVillageId: VillageId) => void;
  broadcastSyncLeave: (targetVillageId: VillageId) => void;
  cleanupAllChannels: () => void;
  detachVillageChannel: (targetVillageId: VillageId) => void;
  /** departureController가 이탈을 확정했을 때 실제로 remotePlayers에서 제거한다. */
  removeConfirmedRemotePlayer: (remoteUserId: string) => void;
  scheduleRemotePlayerRemovalCheck: (remoteUserId: string) => void;
  syncChannelSnapshot: (channelName: string, removeMissing?: boolean) => void;
  trackCurrentPresence: (retryCount?: number, force?: boolean) => Promise<void>;
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
  departureController: DepartureGraceController;
  handlers: MovementSyncHandlers;
  joinedAt: string;
  lastPresenceSignature: string;
  trackRequestId: number;
  trackRetryTimeout: ReturnType<typeof setTimeout> | null;
  trackedVillageId: VillageId | null;
  visibleVillageKey: string;
  visibleVillages: VillageId[];
}
