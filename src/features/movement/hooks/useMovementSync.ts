"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { VillageId, getVisibleVillages } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/store";
import {
  PresenceMetadata,
  SyncLeavePayload,
  SyncPositionPayload,
} from "@/features/movement/model/types";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { getVillageChannelName } from "@/shared/lib/realtime";
import {
  acquireTownChannel,
  getTownChannel,
  getTownChannelStatus,
  observeTownChannelBroadcast,
  observeTownChannelPresence,
  observeTownChannelStatus,
  reconnectTownChannel,
} from "@/shared/lib/realtime/townChannelManager";
import { useUserStore } from "@/shared/store/useUserStore";
import { useShallow } from "zustand/react/shallow";

import { useEffect, useRef } from "react";

import {
  LEGACY_PLAYER_MOVE_EVENT,
  PLAYER_MOVE_EVENT,
  PRESENCE_LEAVE_REMOVAL_DELAY_MS,
  createMovementSyncState,
  getVillageSetKey,
} from "../lib/movementSyncState";

/**
 * 현재 village + 인접 village 범위를 기준으로 Realtime/Phaser visibility를 동기화한다.
 */
export function useMovementSync() {
  const supabase = useSupabase();

  const {
    villageId,
    nickname,
    setNickname,
    setUserId,
    updateRemotePlayer,
    removeRemotePlayer,
    removeRemotePlayersOutsideVillages,
    lastSyncedPosition,
  } = useMovementStore(
    useShallow((state) => ({
      villageId: state.villageId,
      nickname: state.nickname,
      setNickname: state.setNickname,
      setUserId: state.setUserId,
      updateRemotePlayer: state.updateRemotePlayer,
      removeRemotePlayer: state.removeRemotePlayer,
      removeRemotePlayersOutsideVillages: state.removeRemotePlayersOutsideVillages,
      lastSyncedPosition: state.lastSyncedPosition,
    })),
  );

  const { data: user } = useUserInfo();
  const channelUserId = user?.id;
  const { userId: playerId, userNickname } = useUserStore();

  const syncStateRef = useRef(createMovementSyncState());

  useEffect(() => {
    const syncState = syncStateRef.current;

    const clearPendingRemoval = (remoteUserId: string) => {
      const timeout = syncState.pendingRemovalTimeouts.get(remoteUserId);
      if (!timeout) return;

      clearTimeout(timeout);
      syncState.pendingRemovalTimeouts.delete(remoteUserId);
    };

    const upsertVisibleRemotePlayer = (player: PresenceMetadata | SyncPositionPayload) => {
      if (!player.userId || player.userId === playerId) return;

      clearPendingRemoval(player.userId);

      const visibleVillageSet = new Set(getVisibleVillages(useMovementStore.getState().villageId));
      if (!visibleVillageSet.has(player.villageId)) {
        removeRemotePlayer(player.userId);
        return;
      }

      updateRemotePlayer({ ...player, lastUpdatedAt: Date.now() });
    };

    const scheduleRemotePlayerRemovalCheck = (remoteUserId: string) => {
      if (!remoteUserId || remoteUserId === playerId) return;

      clearPendingRemoval(remoteUserId);

      const timeout = setTimeout(() => {
        syncState.pendingRemovalTimeouts.delete(remoteUserId);

        const isStillPresent = Array.from(syncState.channelBindings.keys()).some((channelName) => {
          const channel = getTownChannel(channelName);
          if (!channel) return false;

          return Object.values(channel.presenceState<PresenceMetadata>())
            .flat()
            .some((presence) => presence.userId === remoteUserId);
        });

        if (!isStillPresent) {
          removeRemotePlayer(remoteUserId);
        }
      }, PRESENCE_LEAVE_REMOVAL_DELAY_MS);

      syncState.pendingRemovalTimeouts.set(remoteUserId, timeout);
    };

    const syncChannelSnapshot = (channelName: string) => {
      const channel = getTownChannel(channelName);
      if (!channel) return;

      const presenceState = channel.presenceState<PresenceMetadata>();
      const nextPresenceUserIds = new Set<string>();

      Object.values(presenceState)
        .flat()
        .forEach((presence) => {
          if (presence.userId) {
            nextPresenceUserIds.add(presence.userId);
          }

          upsertVisibleRemotePlayer(presence);
        });

      const prevPresenceUserIds =
        syncState.channelBindings.get(channelName)?.presenceUserIds ?? new Set<string>();
      prevPresenceUserIds.forEach((remoteUserId) => {
        if (!nextPresenceUserIds.has(remoteUserId)) {
          scheduleRemotePlayerRemovalCheck(remoteUserId);
        }
      });

      const binding = syncState.channelBindings.get(channelName);
      if (binding) {
        binding.presenceUserIds = nextPresenceUserIds;
      }
    };

    const trackCurrentPresence = async (retryCount = 0) => {
      if (!supabase || !channelUserId || !playerId) return;

      const state = useMovementStore.getState();
      const currentTrackedVillageId = syncState.trackedVillageId ?? state.villageId;
      const channelName = getVillageChannelName(currentTrackedVillageId);
      const channel = getTownChannel(channelName);

      if (!channel || getTownChannelStatus(channelName) !== "SUBSCRIBED") {
        return;
      }

      const payload: PresenceMetadata = {
        userId: playerId,
        nickname: state.nickname || "익명",
        joinedAt: syncState.joinedAt,
        villageId: currentTrackedVillageId,
        position: state.lastSyncedPosition,
      };

      const payloadSignature = JSON.stringify(payload);
      if (retryCount === 0 && syncState.lastPresenceSignature === payloadSignature) {
        return;
      }

      const requestId = ++syncState.trackRequestId;

      try {
        const res = await channel.track(payload);

        if (requestId !== syncState.trackRequestId) return;

        if (res !== "ok") {
          throw new Error(`Track result: ${res}`);
        }

        if (syncState.trackRetryTimeout) {
          clearTimeout(syncState.trackRetryTimeout);
          syncState.trackRetryTimeout = null;
        }

        syncState.lastPresenceSignature = payloadSignature;
      } catch (err) {
        if (requestId !== syncState.trackRequestId) return;

        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`[useMovementSync] Track failed (Attempt ${retryCount + 1}): ${errorMessage}`);

        if (retryCount >= 3) {
          console.warn("[useMovementSync] Start reconnecting due to track failure.");
          reconnectTownChannel({ supabase, channelName, userId: channelUserId });
          return;
        }

        if (syncState.trackRetryTimeout) {
          clearTimeout(syncState.trackRetryTimeout);
        }

        syncState.trackRetryTimeout = setTimeout(() => {
          void syncState.handlers.trackCurrentPresence(retryCount + 1);
        }, 3000);
      }
    };

    const detachVillageChannel = (targetVillageId: VillageId) => {
      const channelName = getVillageChannelName(targetVillageId);
      const binding = syncState.channelBindings.get(channelName);
      if (!binding) return;

      binding.cleanupObservers();
      binding.release();
      syncState.channelBindings.delete(channelName);
    };

    const attachVillageChannel = (targetVillageId: VillageId) => {
      if (!supabase || !channelUserId) return;

      const channelName = getVillageChannelName(targetVillageId);
      if (syncState.channelBindings.has(channelName)) return;

      const releaseChannel = acquireTownChannel({ supabase, channelName, userId: channelUserId });

      const unsubscribeStatus = observeTownChannelStatus(channelName, (nextStatus) => {
        if (nextStatus !== "SUBSCRIBED") return;

        syncChannelSnapshot(channelName);

        if (useMovementStore.getState().villageId === targetVillageId) {
          void syncState.handlers.trackCurrentPresence();
        }
      });

      const unsubscribePresence = observeTownChannelPresence(channelName, (event, payload) => {
        if (event === "sync") {
          syncChannelSnapshot(channelName);
          return;
        }

        if (event === "join") {
          const newPresences = (payload as { newPresences?: PresenceMetadata[] } | undefined)
            ?.newPresences;

          newPresences?.forEach((presence) => {
            upsertVisibleRemotePlayer(presence);
          });
          return;
        }

        const leftPresences = (payload as { leftPresences?: PresenceMetadata[] } | undefined)
          ?.leftPresences;

        leftPresences?.forEach((presence) => {
          if (presence.userId) {
            scheduleRemotePlayerRemovalCheck(presence.userId);
          }
        });
      });

      const unsubscribeBroadcast = observeTownChannelBroadcast(channelName, (event, payload) => {
        if ((event === PLAYER_MOVE_EVENT || event === LEGACY_PLAYER_MOVE_EVENT) && payload) {
          upsertVisibleRemotePlayer(payload as SyncPositionPayload);
          return;
        }

        if (event !== "sync-leave" || !payload) return;

        const leavePayload = payload as SyncLeavePayload;
        if (leavePayload.userId) {
          scheduleRemotePlayerRemovalCheck(leavePayload.userId);
        }
      });

      syncState.channelBindings.set(channelName, {
        cleanupObservers: () => {
          unsubscribeStatus();
          unsubscribePresence();
          unsubscribeBroadcast();
        },
        presenceUserIds: new Set<string>(),
        release: releaseChannel,
      });

      if (getTownChannelStatus(channelName) === "SUBSCRIBED") {
        syncChannelSnapshot(channelName);

        if (useMovementStore.getState().villageId === targetVillageId) {
          void syncState.handlers.trackCurrentPresence();
        }
      }
    };

    const cleanupAllChannels = () => {
      if (syncState.trackRetryTimeout) {
        clearTimeout(syncState.trackRetryTimeout);
        syncState.trackRetryTimeout = null;
      }

      syncState.trackRequestId += 1;
      syncState.lastPresenceSignature = "";

      const trackedVillageId = syncState.trackedVillageId;
      if (trackedVillageId) {
        const trackedChannel = getTownChannel(getVillageChannelName(trackedVillageId));
        if (trackedChannel) {
          void trackedChannel.untrack();
        }
      }

      syncState.trackedVillageId = null;
      syncState.activeUserId = null;

      syncState.pendingRemovalTimeouts.forEach((timeout) => clearTimeout(timeout));
      syncState.pendingRemovalTimeouts.clear();

      Array.from(syncState.channelBindings.values()).forEach((binding) => {
        binding.cleanupObservers();
        binding.release();
      });

      syncState.channelBindings.clear();
      syncState.visibleVillages = [];
      syncState.visibleVillageKey = "";
      removeRemotePlayersOutsideVillages([]);
    };

    syncState.handlers = {
      attachVillageChannel,
      cleanupAllChannels,
      detachVillageChannel,
      trackCurrentPresence,
    };
  }, [
    removeRemotePlayer,
    removeRemotePlayersOutsideVillages,
    playerId,
    supabase,
    updateRemotePlayer,
    channelUserId,
  ]);

  useEffect(() => {
    if (playerId) setUserId(playerId);
    if (userNickname) setNickname(userNickname);
  }, [playerId, setNickname, setUserId, userNickname]);

  useEffect(() => {
    const syncState = syncStateRef.current;

    if (!supabase || !channelUserId) {
      syncState.handlers.cleanupAllChannels();
      return;
    }

    if (syncState.activeUserId && syncState.activeUserId !== channelUserId) {
      syncState.handlers.cleanupAllChannels();
      syncState.joinedAt = new Date().toISOString();
    }

    syncState.activeUserId = channelUserId;

    const prevVisibleVillages = syncState.visibleVillages;
    const nextVisibleVillages = getVisibleVillages(villageId);
    const nextVisibleVillageKey = getVillageSetKey(nextVisibleVillages);

    syncState.visibleVillages = nextVisibleVillages;

    if (syncState.visibleVillageKey === nextVisibleVillageKey) {
      return;
    }

    const prevVisibleVillageSet = new Set(prevVisibleVillages);
    const nextVisibleVillageSet = new Set(nextVisibleVillages);

    const villagesToUnsubscribe = prevVisibleVillages.filter(
      (prevVillageId) => !nextVisibleVillageSet.has(prevVillageId),
    );
    const villagesToSubscribe = nextVisibleVillages.filter(
      (nextVillageId) => !prevVisibleVillageSet.has(nextVillageId),
    );

    syncState.visibleVillageKey = nextVisibleVillageKey;

    removeRemotePlayersOutsideVillages(nextVisibleVillages);

    villagesToUnsubscribe.forEach((targetVillageId) => {
      syncState.handlers.detachVillageChannel(targetVillageId);
    });

    villagesToSubscribe.forEach((targetVillageId) => {
      syncState.handlers.attachVillageChannel(targetVillageId);
    });
  }, [channelUserId, removeRemotePlayersOutsideVillages, supabase, villageId]);

  useEffect(() => {
    const syncState = syncStateRef.current;

    if (!supabase || !channelUserId || !playerId) return;

    const prevTrackedVillageId = syncState.trackedVillageId;
    if (prevTrackedVillageId && prevTrackedVillageId !== villageId) {
      syncState.trackRequestId += 1;
      syncState.lastPresenceSignature = "";

      if (syncState.trackRetryTimeout) {
        clearTimeout(syncState.trackRetryTimeout);
        syncState.trackRetryTimeout = null;
      }

      const prevChannel = getTownChannel(getVillageChannelName(prevTrackedVillageId));
      if (prevChannel) {
        void prevChannel.untrack();
      }
    }

    syncState.trackedVillageId = villageId;
    void syncState.handlers.trackCurrentPresence();
  }, [channelUserId, lastSyncedPosition, nickname, playerId, supabase, villageId]);

  useEffect(() => {
    if (!playerId || !nickname) return;

    const channelName = getVillageChannelName(villageId);
    const channel = getTownChannel(channelName);

    if (!channel || getTownChannelStatus(channelName) !== "SUBSCRIBED") {
      return;
    }

    channel
      .send({
        type: "broadcast",
        event: PLAYER_MOVE_EVENT,
        payload: {
          userId: playerId,
          nickname,
          position: lastSyncedPosition,
          villageId,
        },
      })
      .then((res) => {
        if (res === "error") {
          console.warn("[useMovementSync] Broadcast failed (send error)");
        }
      });
  }, [lastSyncedPosition, nickname, playerId, villageId]);

  useEffect(() => {
    const syncState = syncStateRef.current;

    return () => {
      syncState.handlers.cleanupAllChannels();
    };
  }, []);
}
