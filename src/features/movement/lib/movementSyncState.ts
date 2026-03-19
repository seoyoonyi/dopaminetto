import { VillageId } from "@/entities/village";

import type { ChannelBinding, MovementSyncHandlers, MovementSyncState } from "./types";

export const PLAYER_MOVE_EVENT = "player_move";
export const LEGACY_PLAYER_MOVE_EVENT = "sync-position";
export const PRESENCE_LEAVE_REMOVAL_DELAY_MS = 250;

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
