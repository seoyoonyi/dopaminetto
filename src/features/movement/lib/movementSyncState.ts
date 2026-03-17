import { VillageId } from "@/entities/village";

export const PLAYER_MOVE_EVENT = "player_move";
export const LEGACY_PLAYER_MOVE_EVENT = "sync-position";
export const PRESENCE_LEAVE_REMOVAL_DELAY_MS = 250;

interface MovementSyncHandlers {
  attachVillageChannel: (targetVillageId: VillageId) => void;
  cleanupAllChannels: () => void;
  detachVillageChannel: (targetVillageId: VillageId) => void;
  trackCurrentPresence: (retryCount?: number) => Promise<void>;
}

interface ChannelBinding {
  cleanupObservers: () => void;
  presenceUserIds: Set<string>;
  release: () => void;
}

interface MovementSyncState {
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

const createInitialHandlers = () =>
  ({
    attachVillageChannel: () => {},
    cleanupAllChannels: () => {},
    detachVillageChannel: () => {},
    trackCurrentPresence: async () => {},
  }) satisfies MovementSyncHandlers;

export const createMovementSyncState = (): MovementSyncState => ({
  activeUserId: null,
  channelBindings: new Map<string, ChannelBinding>(),
  handlers: createInitialHandlers(),
  joinedAt: new Date().toISOString(),
  lastPresenceSignature: "",
  pendingRemovalTimeouts: new Map<string, ReturnType<typeof setTimeout>>(),
  trackRequestId: 0,
  trackRetryTimeout: null,
  trackedVillageId: null,
  visibleVillageKey: "",
  visibleVillages: [],
});

export const getVillageSetKey = (villages: VillageId[]) => [...new Set(villages)].sort().join("|");
