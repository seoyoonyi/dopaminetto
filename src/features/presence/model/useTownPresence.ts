"use client";

import { LOBBY_VILLAGE_ID, VILLAGES, VillageId } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import {
  PRESENCE_RECONCILE_INTERVAL_MS,
  PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS,
} from "@/shared/constants";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useTownChannel } from "@/shared/hooks/useTownChannel";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { TOWN_MAIN_CHANNEL } from "@/shared/lib/realtime";
import {
  getTownChannel,
  getTownChannelStatus,
  observeTownChannelBroadcast,
} from "@/shared/lib/realtime/townChannelManager";
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

export const useTownPresence = () => {
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

  const { setParticipantsState, setConnectionState, markParticipantDeparted } =
    useTownPresenceStore(
      useShallow((state) => ({
        setParticipantsState: state.setParticipants,
        setConnectionState: state.setConnectionState,
        markParticipantDeparted: state.markParticipantDeparted,
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
    /**
     * channel 참조는 재연결/소켓 리셋 때마다 바뀌지만(town:main이 아닌 다른 채널의
     * flapping으로 인한 socket reset 포함), 새로 만들어진 채널 객체는 아직 구독이
     * 완료되기 전이라 이 시점의 presenceState()는 서버 상태를 반영하지 않는다.
     * 여기서 즉시 읽어버리면 "아무도 없다"는 가짜 스냅샷이 실제 sync인 것처럼
     * store에 들어가 정상 참여자까지 이탈 후보로 잘못 분류될 수 있다(#173).
     * Movement(useMovementSync.ts)와 동일하게, town:main이 실제로 보낸
     * sync/join/leave 이벤트(subscribeToPresence)만을 신뢰한다.
     */
    const onPresenceEvent = () => {
      if (channel) {
        const state = channel.presenceState();
        const mapped = mapPresenceState(state);
        setParticipantsState(mapped, userId || "");
      }
    };

    const unsubscribe = subscribeToPresence(onPresenceEvent);
    return () => {
      unsubscribe();
    };
  }, [channel, subscribeToPresence, setParticipantsState, userId]);

  useEffect(() => {
    if (!userId) return;

    /**
     * 정상 퇴장(뒤로가기/페이지 이탈)은 sync-leave 브로드캐스트로 즉시 목록에 반영한다.
     * Movement(useMovementSync.ts)의 원격 캐릭터 제거와 같은 신호를 써서 접속자 목록과
     * 캐릭터 렌더링의 퇴장 시점을 맞춘다. 신호가 없는 비정상 종료(크래시/네트워크 단절)는
     * presence leave + grace가 fallback으로 처리한다.
     */
    const unsubscribe = observeTownChannelBroadcast(TOWN_MAIN_CHANNEL, (event, payload) => {
      if (event !== "sync-leave" || !payload) return;

      const leavingUserId = (payload as { userId?: string }).userId;
      if (!leavingUserId || leavingUserId === userId) return;

      markParticipantDeparted(leavingUserId);
    });

    return () => {
      unsubscribe();

      // 언마운트 시점의 최신 채널을 조회해 낡은 참조로 보내지 않는다.
      if (getTownChannelStatus(TOWN_MAIN_CHANNEL) !== "SUBSCRIBED") return;

      void getTownChannel(TOWN_MAIN_CHANNEL)?.send({
        type: "broadcast",
        event: "sync-leave",
        payload: { userId },
      });
    };
  }, [userId, markParticipantDeparted]);

  useEffect(() => {
    /**
     * 이탈 확정(departureGrace.reconcile)과 재입장 반영은 setParticipants() 안에서만
     * 일어나는데, setParticipants()는 서버 sync/join/leave 이벤트로만 호출된다. 장시간
     * 재연결 뒤 채널이 안정화됐지만 아무도 join/leave하지 않으면 재검증 트리거가 오지 않아
     * stale 이탈/재입장이 새로고침 전까지 남는다(#173). 이 폴링이 그 공백을 메운다.
     */
    if (channelStatus !== "SUBSCRIBED") return;

    const reconcileFromLocalPresence = () => {
      // 클로저의 낡은 채널을 쓰지 않도록 매 tick 최신값을 조회한다.
      if (getTownChannelStatus(TOWN_MAIN_CHANNEL) !== "SUBSCRIBED") return;

      const liveChannel = getTownChannel(TOWN_MAIN_CHANNEL);
      if (!liveChannel) return;

      // 재연결 직후 미완성 스냅샷을 전원 이탈로 오판하지 않는다.
      const state = liveChannel.presenceState();
      if (Object.keys(state).length === 0) return;

      setParticipantsState(mapPresenceState(state), userId || "");
    };

    const interval = setInterval(reconcileFromLocalPresence, PRESENCE_RECONCILE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [channelStatus, setParticipantsState, userId]);

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
