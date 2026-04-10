"use client";

import { LOBBY_VILLAGE_ID, VILLAGES, VillageId } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { useTownChannel } from "@/shared/hooks/useTownChannel";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { PresenceStateItem, PresenceTrackPayload } from "@/shared/types/presence";
import { RealtimePresenceState } from "@supabase/supabase-js";
import { useShallow } from "zustand/react/shallow";

import { useEffect } from "react";

import { PresenceParticipant } from "../types";

// Supabase Presence payload의 villageId를 런타임에서 검증해 내부 VillageId 타입으로 좁힌다.
const isVillageId = (value: unknown): value is VillageId =>
  typeof value === "string" && Object.hasOwn(VILLAGES, value);

/**
 * Supabase Presence 상태를 PresenceParticipant 배열로 변환한다.
 * 유효한 참여자만 필터링하여 반환한다.
 */
const mapPresenceState = (state: RealtimePresenceState): PresenceParticipant[] => {
  if (!state) return [];

  return Object.entries(state)
    .flatMap(([key, presences]) =>
      presences.map((p) => {
        const raw = p as PresenceStateItem;

        const userId = raw.userId || raw.user_id || key;
        const nickname = raw.nickname || raw.user_nickname || "익명";
        const joinedAt = raw.joinedAt || raw.online_at || raw.joined_at;
        const villageId = isVillageId(raw.villageId) ? raw.villageId : LOBBY_VILLAGE_ID;

        return {
          userId,
          nickname,
          joinedAt,
          villageId,
          presenceRef: raw.presence_ref,
          isSpeaker: raw.isSpeaker ?? false,
          voiceConnected: raw.voiceConnected ?? false,
          audioEnabled: raw.audioEnabled ?? false,
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

  return {
    participants,
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
  const voiceConnected = useTownPresenceStore((state) => state.voiceConnected);
  const audioEnabled = useTownPresenceStore((state) => state.audioEnabled);
  const isSpeaker = userNickname === process.env.NEXT_PUBLIC_SPEAKER_NICKNAME;

  const presenceView = useTownPresenceView();

  useEffect(() => {
    setConnectionState(isConnected);
  }, [isConnected, setConnectionState]);

  useEffect(() => {
    const trackPresence = async (retryCount = 0) => {
      if (channelStatus !== "SUBSCRIBED" || !channel || !userId) return;

      const payload: PresenceTrackPayload = {
        userId,
        nickname: userNickname || "익명",
        joinedAt: localJoinedAt,
        villageId,
        username: userNickname,
        isSpeaker,
        voiceConnected,
        audioEnabled,
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

    if (channelStatus !== "SUBSCRIBED") return;

    const timer = setTimeout(() => void trackPresence(), 300);
    return () => clearTimeout(timer);
  }, [
    channelStatus,
    channel,
    userId,
    userNickname,
    villageId,
    reconnect,
    localJoinedAt,
    isSpeaker,
    voiceConnected,
    audioEnabled,
  ]);

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
