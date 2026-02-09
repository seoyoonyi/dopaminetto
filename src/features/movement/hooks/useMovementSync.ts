"use client";

import { useMovementStore } from "@/features/movement/model/store";
import {
  PresenceMetadata,
  SyncLeavePayload,
  SyncPositionPayload,
} from "@/features/movement/model/types";
import { useTownChannel } from "@/shared/hooks/useTownChannel";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { useUserStore } from "@/shared/store/useUserStore";
import { useShallow } from "zustand/react/shallow";

import { useEffect } from "react";

/**
 * 전역 빌리지 좌표 동기화 훅
 * - 모든 빌리지 채널을 동시에 구독하여 어느 룸에 있든 서로 보이게 합니다.
 * - 자신의 브로드캐스트와 Presence 트래킹은 현재 속한 villageId 채널에만 수행합니다.
 */
export function useMovementSync() {
  const {
    villageId,
    nickname,
    setNickname,
    setUserId,
    updateRemotePlayer,
    removeRemotePlayer,
    lastSyncedPosition,
  } = useMovementStore(
    useShallow((state) => ({
      villageId: state.villageId,
      nickname: state.nickname,
      setNickname: state.setNickname,
      setUserId: state.setUserId,
      updateRemotePlayer: state.updateRemotePlayer,
      removeRemotePlayer: state.removeRemotePlayer,
      lastSyncedPosition: state.lastSyncedPosition,
    })),
  );

  const { channel, status, reconnect } = useTownChannel(villageId);
  const { data: user } = useUserInfo();
  const userId = user?.id;
  const { userNickname } = useUserStore();

  useEffect(() => {
    if (userId) setUserId(userId);
    if (userNickname) setNickname(userNickname);
  }, [userId, userNickname, setUserId, setNickname]);

  useEffect(() => {
    if (!channel || !userId) return;

    channel.on<SyncPositionPayload>("broadcast", { event: "sync-position" }, ({ payload }) => {
      updateRemotePlayer({ ...payload, lastUpdatedAt: Date.now() });
    });

    channel.on<SyncLeavePayload>("broadcast", { event: "sync-leave" }, ({ payload }) => {
      if (payload.userId) removeRemotePlayer(payload.userId);
    });

    const syncRemotePlayers = () => {
      const newState = channel.presenceState<PresenceMetadata>();
      Object.values(newState)
        .flat()
        .forEach((presence) => {
          if (presence.userId && presence.userId !== userId) {
            updateRemotePlayer({ ...presence, lastUpdatedAt: Date.now() });
          }
        });
    };

    channel
      .on("presence", { event: "sync" }, syncRemotePlayers)
      .on("presence", { event: "join" }, ({ newPresences }) => {
        newPresences.forEach((p) => {
          const presence = p as unknown as PresenceMetadata;
          if (presence.userId && presence.userId !== userId) {
            updateRemotePlayer({ ...presence, lastUpdatedAt: Date.now() });
          }
        });

        if (newPresences.length > 0 && channel && userId) {
          const state = useMovementStore.getState();
          channel.send({
            type: "broadcast",
            event: "sync-position",
            payload: {
              userId,
              nickname: state.nickname,
              position: state.lastSyncedPosition,
              villageId: state.villageId,
            },
          });
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        leftPresences.forEach((p) => {
          const presence = p as unknown as PresenceMetadata;
          if (presence.userId) removeRemotePlayer(presence.userId);
        });
      });

    syncRemotePlayers();

    const trackPresence = async (retryCount = 0) => {
      if (status !== "SUBSCRIBED" || !channel || !userId) return;

      const state = useMovementStore.getState();
      const payload: PresenceMetadata = {
        userId,
        nickname: state.nickname || "익명",
        joinedAt: new Date().toISOString(),
        villageId: state.villageId,
        position: state.lastSyncedPosition,
      };

      try {
        const res = await channel.track(payload);
        if (res !== "ok") {
          throw new Error(`Track result: ${res}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`[useMovementSync] Track failed (Attempt ${retryCount + 1}): ${errorMessage}`);

        if (retryCount >= 3) {
          console.warn(`[useMovementSync] Start reconnecting due to track failure.`);
          reconnect();
          return;
        }

        setTimeout(() => trackPresence(retryCount + 1), 3000);
      }
    };

    if (status === "SUBSCRIBED") {
      trackPresence();
    }

    return () => {
      // 싱글톤 채널이므로 채널을 닫거나 unsubscribe하면 안 됨
      // 의존성을 최소화했기 때문에 이 이펙트는 channel/userId가 바뀔 때만 재실행됨
      // → 리스너 중복 누적 문제가 사실상 발생하지 않음
    };
  }, [channel, userId, updateRemotePlayer, removeRemotePlayer, status, reconnect]);

  useEffect(() => {
    if (!channel || !userId || !nickname) return;
    if (status !== "SUBSCRIBED") return;

    channel
      .send({
        type: "broadcast",
        event: "sync-position",
        payload: {
          userId,
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
  }, [channel, status, lastSyncedPosition, villageId, nickname, userId]);
}
