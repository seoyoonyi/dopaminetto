import { VillageId } from "@/entities/village";

export interface MovementSyncHandlers {
  attachVillageChannel: (targetVillageId: VillageId) => void;
  cleanupAllChannels: () => void;
  detachVillageChannel: (targetVillageId: VillageId) => void;
  trackCurrentPresence: (retryCount?: number) => Promise<void>;
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
