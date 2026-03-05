"use client";

import { LOBBY_VILLAGE_ID, VILLAGES, VillageId } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/store";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { useTownChannel } from "@/shared/hooks/useTownChannel";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { RealtimePresenceState } from "@supabase/supabase-js";
import { useShallow } from "zustand/react/shallow";

import { useEffect, useMemo } from "react";

import { PresenceParticipant } from "../types";

// Supabase Presence payload의 villageId를 런타임에서 검증해 내부 VillageId 타입으로 좁힌다.
const isVillageId = (value: unknown): value is VillageId =>
  typeof value === "string" && value in VILLAGES;

const mapPresenceState = (state: RealtimePresenceState): PresenceParticipant[] => {
  if (!state) return [];

  return Object.entries(state)
    .flatMap(([key, presences]) =>
      presences.map((p) => {
        const untyped = p as {
          userId?: string;
          user_id?: string;
          nickname?: string;
          user_nickname?: string;
          joinedAt?: string;
          online_at?: string;
          joined_at?: string;
          presence_ref: string;
          villageId?: string | null;
        };

        const userId = untyped.userId || untyped.user_id || key;
        const nickname = untyped.nickname || untyped.user_nickname || "익명";
        const joinedAt = untyped.joinedAt || untyped.online_at || untyped.joined_at;
        const villageId = isVillageId(untyped.villageId) ? untyped.villageId : LOBBY_VILLAGE_ID;

        return {
          userId,
          nickname,
          joinedAt,
          villageId,
          presenceRef: untyped.presence_ref,
        } as PresenceParticipant;
      }),
    )
    .filter((p) => {
      const isValid = !!(p.userId && p.nickname);
      if (!isValid) console.warn("[useTownPresence] Invalid participant filtered out:", p);
      return isValid;
    });
};

/**
 * Supabase Presence `town:main` 채널을 구독해
 * 접속 중인 사용자 목록과 연결 상태를 제공하는 훅입니다.
 */
export const useTownPresenceView = () => {
  const participants = useTownPresenceStore((state) => state.participants);
  const isConnected = useTownPresenceStore((state) => state.isConnected);

  const orderedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }, [participants]);

  return {
    participants: orderedParticipants,
    isConnected,
  };
};

export const useTownPresence = () => {
  const { data: user } = useUserInfo();
  const userId = user?.id;
  const userNickname = user?.user_metadata?.nickname as string | undefined;

  const villageId = useMovementStore((state) => state.villageId);

  const {
    channel,
    isConnected,
    status: channelStatus,
    subscribeToPresence,
    reconnect,
  } = useTownChannel();

  const { setParticipantsState, setConnectionState } = useTownPresenceStore(
    useShallow((state) => ({
      setParticipantsState: state.setParticipants,
      setConnectionState: state.setConnectionState,
    })),
  );
  const localJoinedAt = useTownPresenceStore((state) => state.localJoinedAt);

  const presenceView = useTownPresenceView();

  useEffect(() => {
    setConnectionState(isConnected);
  }, [isConnected, setConnectionState]);

  useEffect(() => {
    const trackPresence = async (retryCount = 0) => {
      if (channelStatus !== "SUBSCRIBED" || !channel || !userId) return;

      const payload = {
        userId,
        nickname: userNickname || "익명",
        joinedAt: localJoinedAt,
        villageId,
        username: userNickname,
      };

      try {
        const res = await channel.track(payload);
        if (res !== "ok") {
          throw new Error(`Track result: ${res}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`[useTownPresence] Track failed (Attempt ${retryCount + 1}): ${errorMessage}`);

        if (retryCount >= 3) {
          console.warn(`[useTownPresence] Start reconnecting due to track failure.`);
          reconnect();
          return;
        }

        setTimeout(() => trackPresence(retryCount + 1), 3000);
      }
    };

    if (channelStatus === "SUBSCRIBED") {
      trackPresence();
    }
  }, [channelStatus, channel, userId, userNickname, villageId, reconnect, localJoinedAt]);

  useEffect(() => {
    const onPresenceEvent = () => {
      if (channel) {
        const state = channel.presenceState();
        const mapped = mapPresenceState(state);
        setParticipantsState(mapped, userNickname || "", userId || "");
      }
    };

    if (channel) {
      onPresenceEvent();
    }

    const unsubscribe = subscribeToPresence(onPresenceEvent);
    return () => {
      unsubscribe();
    };
  }, [channel, subscribeToPresence, setParticipantsState, userNickname, userId]);

  // 4. 연결 피드백 토스트
  useEffect(() => {
    if (channelStatus === "SUBSCRIBED") {
      // toast.success("타운에 연결되었습니다."); // 필요 시 주석 해제하여 사용
    } else if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
      // toast.error("연결에 문제가 발생했습니다. 재시도 중...");
    }
  }, [channelStatus]);

  return {
    participants: presenceView.participants,
    isConnected,
    channelStatus,
  };
};
