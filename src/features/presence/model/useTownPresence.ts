"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { TOWN_MAIN_CHANNEL } from "@/shared/config/supabase.client";
import { RealtimePresenceState } from "@supabase/supabase-js";

import { useEffect, useMemo } from "react";

import { PresenceParticipant } from "../types";
import { useTownPresenceStore } from "./useTownPresenceStore";

type PresencePayload = {
  userId: string;
  nickname: string;
  joinedAt?: string;
  presence_ref?: string;
};

const mapPresenceState = (state: RealtimePresenceState): PresenceParticipant[] => {
  if (!state || typeof state !== "object") {
    return [];
  }

  return Object.entries(state).flatMap(([userId, presences]) =>
    presences.map((presence, index) => {
      const payload = presence as PresencePayload;
      const resolvedUserId = payload.userId ?? userId;
      return {
        userId: resolvedUserId,
        nickname: payload.nickname || "익명",
        joinedAt: payload.joinedAt,
        presenceRef: payload.presence_ref ?? `${resolvedUserId}-${index}`,
      };
    }),
  );
};

/**
 * Supabase Presence `town:main` 채널을 구독해
 * 접속 중인 사용자 목록과 연결 상태를 제공하는 훅입니다.
 *
 * @returns {{
 *   participants: PresenceParticipant[];
 *   isConnected: boolean;
 * }} 닉네임 오름차순 정렬된 접속자 목록과 Presence 채널 연결 여부
 */
export const useTownPresenceView = () => {
  const participants = useTownPresenceStore((state) => state.participants);
  const isConnected = useTownPresenceStore((state) => state.isConnected);

  const orderedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko-KR"));
  }, [participants]);

  return {
    participants: orderedParticipants,
    isConnected,
  };
};

export function useTownPresence() {
  const supabase = useSupabase();
  const setParticipantsState = useTownPresenceStore((state) => state.setParticipants);
  const setConnectionState = useTownPresenceStore((state) => state.setConnectionState);
  const resetStore = useTownPresenceStore((state) => state.reset);
  const presenceView = useTownPresenceView();

  useEffect(() => {
    if (!supabase) return;

    let channelPromise: Promise<void> | null = null;
    let cleanupChannel: (() => void) | null = null;
    let isMounted = true;
    let currentUserNickname = "";

    const subscribePresence = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) {
        return;
      }

      currentUserNickname = user.user_metadata?.nickname as string;

      const newChannel = supabase.channel(TOWN_MAIN_CHANNEL, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      if (!isMounted) {
        supabase.removeChannel(newChannel);
        return;
      }

      newChannel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          setParticipantsState(mapPresenceState(newChannel.presenceState()), currentUserNickname);
        })
        .on("presence", { event: "join" }, () => {
          if (!isMounted) return;
          setParticipantsState(mapPresenceState(newChannel.presenceState()), currentUserNickname);
        })
        .on("presence", { event: "leave" }, () => {
          if (!isMounted) return;
          setParticipantsState(mapPresenceState(newChannel.presenceState()), currentUserNickname);
        });

      newChannel.subscribe(async (status) => {
        if (!isMounted) return;
        setConnectionState(status === "SUBSCRIBED");

        if (status === "SUBSCRIBED" && isMounted) {
          await newChannel.track({
            userId: user.id,
            nickname: currentUserNickname,
            joinedAt: new Date().toISOString(),
          });
        }
      });

      return () => {
        supabase.removeChannel(newChannel);
      };
    };

    channelPromise = subscribePresence().then((cleanup) => {
      cleanupChannel = cleanup ?? null;
    });

    return () => {
      isMounted = false;
      resetStore();
      channelPromise
        ?.catch(() => undefined)
        .finally(() => {
          cleanupChannel?.();
          cleanupChannel = null;
        });
    };
  }, [supabase, resetStore, setConnectionState, setParticipantsState]);

  return presenceView;
}
