import { VillageId } from "@/entities/village";

import type { ChannelBinding, MovementSyncHandlers, MovementSyncState } from "./types";

export const PLAYER_MOVE_EVENT = "player_move";
export const LEGACY_PLAYER_MOVE_EVENT = "sync-position";
export const REMOTE_PLAYER_REMOVAL_GRACE_MS = 8_000;

const createInitialHandlers = () =>
  ({
    attachVillageChannel: () => {},
    broadcastSyncLeave: () => {},
    cleanupAllChannels: () => {},
    detachVillageChannel: () => {},
    scheduleRemotePlayerRemovalCheck: () => {},
    syncChannelSnapshot: () => {},
    trackCurrentPresence: async () => {},
    upsertVisibleRemotePlayer: () => {},
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

/**
 * Presence sync에서는 처음 확인한 원격 플레이어만 초기 위치로 추가한다.
 * 이미 렌더링 중인 플레이어의 최신 Broadcast 좌표는 유지한다.
 */
export const shouldInitializeRemotePlayerFromPresence = ({
  currentUserId,
  knownRemotePlayerIds,
  presenceUserId,
}: {
  currentUserId?: string;
  knownRemotePlayerIds: Set<string>;
  presenceUserId?: string;
}) =>
  Boolean(
    presenceUserId && presenceUserId !== currentUserId && !knownRemotePlayerIds.has(presenceUserId),
  );
