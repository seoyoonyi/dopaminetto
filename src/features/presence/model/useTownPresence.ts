"use client";

import { LOBBY_VILLAGE_ID, VILLAGES, VillageId } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS } from "@/shared/constants";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useTownChannel } from "@/shared/hooks/useTownChannel";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { RealtimePresenceState } from "@supabase/supabase-js";
import { useShallow } from "zustand/react/shallow";

import { useEffect } from "react";

import type { PresenceStateItem, PresenceTrackPayload } from "../types";
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
 * 접속 중인 사용자 목록과 연결 상태를 제공하는 훅이다.
 */
export const useTownPresenceView = () => {
  const participants = useTownPresenceStore((state) => state.participants);
  const isConnected = useTownPresenceStore((state) => state.isConnected);

  return {
    participants,
    isConnected,
  };
};

/**
 * 서버에서 확정된 음성 역할을 Presence에 반영한다.
 * 닉네임만으로 speaker 여부를 다시 판정하지 않는다.
 */
export const useTownPresence = (isSpeaker = false) => {
  const { data: user } = useUserInfo();
  const userId = user?.id;
  const userNickname = user?.user_metadata?.nickname as string | undefined;

  const villageId = useMovementStore((state) => state.villageId);
  const debouncedVillageId = useDebouncedValue(villageId, PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS);

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
  const presenceView = useTownPresenceView();

  useEffect(() => {
    setConnectionState(isConnected);
  }, [isConnected, setConnectionState]);

  useEffect(() => {
    /**
     * effect cleanup 이후 비동기 재시도가 실행되지 않도록 취소 플래그를 사용한다.
     * retryTimerIds 배열 방식은 channel.track()이 await 중일 때 cleanup이 실행되면
     * 배열이 비어 있어 이후 등록되는 타이머를 정리하지 못하는 타이밍 버그가 있었다.
     */
    let isCancelled = false;

    const trackPresence = async (retryCount = 0) => {
      // effect가 cleanup된 이후에는 실행하지 않는다.
      if (isCancelled || channelStatus !== "SUBSCRIBED" || !channel || !userId) return;

      const payload: PresenceTrackPayload = {
        userId,
        nickname: userNickname || "익명",
        joinedAt: localJoinedAt,
        villageId: debouncedVillageId,
        username: userNickname,
        isSpeaker,
        voiceConnected,
        audioEnabled,
      };

      // 이동(village 경계 통과) 중 track() 실패가 몰려서 강제 재연결로 이어지는지
      // 진단하기 위해 소요 시간을 함께 기록한다.
      const attemptStartedAt = Date.now();

      try {
        const res = await channel.track(payload);
        if (res !== "ok") {
          throw new Error(`Track result: ${res}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(
          `[useTownPresence] track 실패 (userId=${userId}, 시도=${retryCount + 1}회, ` +
            `소요시간=${Date.now() - attemptStartedAt}ms, 채널상태=${channelStatus}): ${errorMessage}`,
        );

        // cleanup 이후라면 reconnect와 재시도 타이머를 등록하지 않는다.
        if (isCancelled) return;

        if (retryCount >= 3) {
          console.warn(
            `[useTownPresence] track 반복 실패로 town:main을 재연결합니다 ` +
              `(userId=${userId}, villageId=${debouncedVillageId}, 채널상태=${channelStatus})`,
          );
          reconnect();
          return;
        }

        setTimeout(() => trackPresence(retryCount + 1), 3000);
      }
    };

    if (channelStatus !== "SUBSCRIBED") return;

    const timer = setTimeout(() => void trackPresence(), 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    channelStatus,
    channel,
    userId,
    userNickname,
    debouncedVillageId,
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
        setParticipantsState(mapped, userId || "");
      }
    };

    if (channel) {
      onPresenceEvent();
    }

    const unsubscribe = subscribeToPresence(onPresenceEvent);
    return () => {
      unsubscribe();
    };
  }, [channel, subscribeToPresence, setParticipantsState, userId]);

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
