import { VillageId } from "@/entities/village";
import type { PresenceMetadata } from "@/features/movement/model/types";
import {
  DEPARTURE_GRACE_MS,
  createDepartureGraceController,
} from "@/shared/lib/realtime/departureGrace";
import { getTownChannel, getTownChannelStatus } from "@/shared/lib/realtime/townChannelManager";

import type { ChannelBinding, MovementSyncHandlers, MovementSyncState } from "./types";

export const PLAYER_MOVE_EVENT = "player_move";
export const LEGACY_PLAYER_MOVE_EVENT = "sync-position";

/** presence leave 후 원격 유저를 실제로 제거하기까지의 유예 시간이다. shared/departureGrace.ts 참고. */
export const REMOTE_PLAYER_REMOVAL_GRACE_MS = DEPARTURE_GRACE_MS;

const createInitialHandlers = () =>
  ({
    attachVillageChannel: () => {},
    broadcastSyncLeave: () => {},
    cleanupAllChannels: () => {},
    detachVillageChannel: () => {},
    removeConfirmedRemotePlayer: () => {},
    scheduleRemotePlayerRemovalCheck: () => {},
    syncChannelSnapshot: () => {},
    trackCurrentPresence: async () => {},
    upsertVisibleRemotePlayer: () => {},
  }) satisfies MovementSyncHandlers;

/** 바인딩된 village 채널 중 하나라도 SUBSCRIBED가 아니면 재연결 중으로 본다. */
const isAnyBoundChannelReconnecting = (channelBindings: Map<string, ChannelBinding>) =>
  Array.from(channelBindings.keys()).some(
    (channelName) => getTownChannelStatus(channelName) !== "SUBSCRIBED",
  );

/** 바인딩된 village 채널 중 하나라도 해당 유저의 presence를 갖고 있으면 생존으로 본다. */
const isPresentInAnyBoundChannel = (
  channelBindings: Map<string, ChannelBinding>,
  remoteUserId: string,
) =>
  Array.from(channelBindings.keys()).some((channelName) => {
    const channel = getTownChannel(channelName);
    if (!channel) return false;

    return Object.values(channel.presenceState<PresenceMetadata>())
      .flat()
      .some((presence) => presence.userId === remoteUserId);
  });

export const createMovementSyncState = (): MovementSyncState => {
  const state = {
    activeUserId: null,
    channelBindings: new Map<string, ChannelBinding>(),
    handlers: createInitialHandlers(),
    joinedAt: new Date().toISOString(),
    lastPresenceSignature: "",
    trackRequestId: 0,
    trackRetryTimeout: null,
    trackedVillageId: null,
    visibleVillageKey: "",
    visibleVillages: [],
  } as unknown as MovementSyncState;

  state.departureController = createDepartureGraceController({
    graceMs: REMOTE_PLAYER_REMOVAL_GRACE_MS,
    isChannelReconnecting: () => isAnyBoundChannelReconnecting(state.channelBindings),
    isPresentInSnapshot: (remoteUserId) =>
      isPresentInAnyBoundChannel(state.channelBindings, remoteUserId),
    onConfirmed: (remoteUserId) => state.handlers.removeConfirmedRemotePlayer(remoteUserId),
  });

  return state;
};

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
