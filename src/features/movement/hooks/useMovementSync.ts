"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { VillageId, getVisibleVillages } from "@/entities/village";
import { resolveCharacterId } from "@/features/movement/model/config";
import {
  createPresencePayload,
  createPresenceTrackSignature,
  createSyncPositionPayload,
} from "@/features/movement/model/payload";
import {
  PresenceMetadata,
  SyncLeavePayload,
  SyncPositionPayload,
} from "@/features/movement/model/types";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS } from "@/shared/constants";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
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
  REMOTE_PLAYER_REMOVAL_GRACE_MS,
  createMovementSyncState,
  getVillageSetKey,
} from "../lib/movementSyncState";
import {
  cancelRemotePlayerRemoval,
  scheduleRemotePlayerRemoval as scheduleRemotePlayerRemovalWithGrace,
} from "../lib/remotePlayerRemoval";

/**
 * 현재 village + 인접 village 범위를 기준으로 Realtime/Phaser visibility를 동기화한다.
 */
export function useMovementSync(enabled = true) {
  const supabase = useSupabase();

  const {
    villageId,
    nickname,
    characterId,
    setNickname,
    setCharacterId,
    setUserId,
    updateRemotePlayer,
    removeRemotePlayer,
    removeRemotePlayersOutsideVillages,
    lastSyncedPosition,
    localActionState,
  } = useMovementStore(
    useShallow((state) => ({
      villageId: state.villageId,
      nickname: state.nickname,
      characterId: state.characterId,
      setNickname: state.setNickname,
      setCharacterId: state.setCharacterId,
      setUserId: state.setUserId,
      updateRemotePlayer: state.updateRemotePlayer,
      removeRemotePlayer: state.removeRemotePlayer,
      removeRemotePlayersOutsideVillages: state.removeRemotePlayersOutsideVillages,
      lastSyncedPosition: state.lastSyncedPosition,
      localActionState: state.localActionState,
    })),
  );

  const { data: user } = useUserInfo();
  const channelUserId = user?.id;
  const { userId: playerId, userNickname, selectedCharacterId } = useUserStore();
  const debouncedTrackedVillageId = useDebouncedValue(
    villageId,
    PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS,
  );

  const syncStateRef = useRef(createMovementSyncState());

  useEffect(() => {
    const syncState = syncStateRef.current;

    const clearPendingRemoval = (remoteUserId: string) => {
      cancelRemotePlayerRemoval({
        pendingRemovalTimeouts: syncState.pendingRemovalTimeouts,
        remoteUserId,
      });
    };

    const upsertVisibleRemotePlayer = (player: PresenceMetadata | SyncPositionPayload) => {
      if (!player.userId || player.userId === playerId) return;

      clearPendingRemoval(player.userId);

      const visibleVillageSet = new Set(getVisibleVillages(useMovementStore.getState().villageId));
      if (!visibleVillageSet.has(player.villageId)) {
        removeRemotePlayer(player.userId);
        return;
      }

      updateRemotePlayer({
        ...player,
        characterId: resolveCharacterId(player.characterId),
        lastUpdatedAt: Date.now(),
      });
    };

    const isRemotePlayerStillPresent = (remoteUserId: string) =>
      Array.from(syncState.channelBindings.keys()).some((channelName) => {
        const channel = getTownChannel(channelName);
        if (!channel) return false;

        return Object.values(channel.presenceState<PresenceMetadata>())
          .flat()
          .some((presence) => presence.userId === remoteUserId);
      });

    const scheduleRemotePlayerRemoval = (remoteUserId: string) => {
      if (!remoteUserId || remoteUserId === playerId) return;

      scheduleRemotePlayerRemovalWithGrace({
        pendingRemovalTimeouts: syncState.pendingRemovalTimeouts,
        remoteUserId,
        graceMs: REMOTE_PLAYER_REMOVAL_GRACE_MS,
        isPresent: () => isRemotePlayerStillPresent(remoteUserId),
        onConfirmed: () => {
          removeRemotePlayer(remoteUserId);
        },
      });
    };

    const scheduleRemotePlayerRemovalCheck = (remoteUserId: string) => {
      scheduleRemotePlayerRemoval(remoteUserId);
    };

    const broadcastSyncLeave = (targetVillageId: VillageId) => {
      if (!playerId) return;

      const channelName = getVillageChannelName(targetVillageId);
      const channel = getTownChannel(channelName);
      if (!channel || getTownChannelStatus(channelName) !== "SUBSCRIBED") {
        return;
      }

      void channel
        .send({
          type: "broadcast",
          event: "sync-leave",
          payload: {
            userId: playerId,
          } satisfies SyncLeavePayload,
        })
        .then((res) => {
          if (res === "error") {
            console.warn("[useMovementSync] sync-leave broadcast failed (send error)");
          }
        });
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

      const payload: PresenceMetadata = createPresencePayload({
        userId: playerId,
        nickname: state.nickname || "익명",
        joinedAt: syncState.joinedAt,
        villageId: currentTrackedVillageId,
        position: state.lastSyncedPosition,
        characterId: state.characterId,
        actionState: state.localActionState,
      });

      const payloadSignature = createPresenceTrackSignature(payload);
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

        syncState.handlers.syncChannelSnapshot(channelName);

        if (useMovementStore.getState().villageId === targetVillageId) {
          void syncState.handlers.trackCurrentPresence();
        }
      });

      const unsubscribePresence = observeTownChannelPresence(channelName, (event, payload) => {
        if (event === "sync") {
          syncState.handlers.syncChannelSnapshot(channelName);
          return;
        }

        if (event === "join") {
          const newPresences = (payload as { newPresences?: PresenceMetadata[] } | undefined)
            ?.newPresences;

          newPresences?.forEach((presence) => {
            syncState.handlers.upsertVisibleRemotePlayer(presence);
          });
          return;
        }

        const leftPresences = (payload as { leftPresences?: PresenceMetadata[] } | undefined)
          ?.leftPresences;

        leftPresences?.forEach((presence) => {
          if (presence.userId) {
            syncState.handlers.scheduleRemotePlayerRemovalCheck(presence.userId);
          }
        });
      });

      const unsubscribeBroadcast = observeTownChannelBroadcast(channelName, (event, payload) => {
        if ((event === PLAYER_MOVE_EVENT || event === LEGACY_PLAYER_MOVE_EVENT) && payload) {
          syncState.handlers.upsertVisibleRemotePlayer(payload as SyncPositionPayload);
          return;
        }

        if (event !== "sync-leave" || !payload) return;

        const leavePayload = payload as SyncLeavePayload;
        if (leavePayload.userId) {
          syncState.handlers.scheduleRemotePlayerRemovalCheck(leavePayload.userId);
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
        syncState.handlers.syncChannelSnapshot(channelName);

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
        broadcastSyncLeave(trackedVillageId);
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
      broadcastSyncLeave,
      cleanupAllChannels,
      detachVillageChannel,
      scheduleRemotePlayerRemovalCheck,
      syncChannelSnapshot,
      trackCurrentPresence,
      upsertVisibleRemotePlayer,
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
    if (!enabled) return;

    if (playerId) setUserId(playerId);
    if (userNickname) setNickname(userNickname);
    setCharacterId(selectedCharacterId);
  }, [
    enabled,
    playerId,
    selectedCharacterId,
    setCharacterId,
    setNickname,
    setUserId,
    userNickname,
  ]);

  useEffect(() => {
    const syncState = syncStateRef.current;

    if (!enabled || !supabase || !channelUserId) {
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
  }, [channelUserId, enabled, removeRemotePlayersOutsideVillages, supabase, villageId]);

  useEffect(() => {
    if (!enabled) return;

    const syncState = syncStateRef.current;

    if (!supabase || !channelUserId || !playerId) return;

    const prevTrackedVillageId = syncState.trackedVillageId;
    if (prevTrackedVillageId && prevTrackedVillageId !== debouncedTrackedVillageId) {
      syncState.trackRequestId += 1;
      syncState.lastPresenceSignature = "";

      if (syncState.trackRetryTimeout) {
        clearTimeout(syncState.trackRetryTimeout);
        syncState.trackRetryTimeout = null;
      }

      syncState.handlers.broadcastSyncLeave(prevTrackedVillageId);

      const prevChannel = getTownChannel(getVillageChannelName(prevTrackedVillageId));
      if (prevChannel) {
        void prevChannel.untrack();
      }
    }

    syncState.trackedVillageId = debouncedTrackedVillageId;
    void syncState.handlers.trackCurrentPresence();
  }, [
    channelUserId,
    characterId,
    debouncedTrackedVillageId,
    enabled,
    lastSyncedPosition,
    localActionState,
    nickname,
    playerId,
    supabase,
  ]);

  useEffect(() => {
    if (!enabled) return;
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
        payload: createSyncPositionPayload({
          userId: playerId,
          nickname,
          characterId,
          position: lastSyncedPosition,
          villageId,
          actionState: localActionState,
        }),
      })
      .then((res) => {
        if (res === "error") {
          console.warn("[useMovementSync] Broadcast failed (send error)");
        }
      });
  }, [characterId, enabled, lastSyncedPosition, localActionState, nickname, playerId, villageId]);

  useEffect(() => {
    const syncState = syncStateRef.current;

    return () => {
      syncState.handlers.cleanupAllChannels();
    };
  }, []);
}
