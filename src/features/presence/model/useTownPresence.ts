"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { TOWN_MAIN_CHANNEL } from "@/shared/config/supabase.client";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

import { useEffect, useMemo, useState } from "react";

import { PresenceParticipant } from "../types";

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
export function useTownPresence() {
  const supabase = useSupabase();
  const [participants, setParticipants] = useState<PresenceParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let channel: RealtimeChannel | null = null;
    let channelPromise: Promise<void> | null = null;
    let isMounted = true;

    const subscribePresence = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      channel = supabase.channel(TOWN_MAIN_CHANNEL, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted || !channel) return;
          setParticipants(mapPresenceState(channel.presenceState()));
        })
        .on("presence", { event: "join" }, () => {
          if (!isMounted || !channel) return;
          setParticipants(mapPresenceState(channel.presenceState()));
        })
        .on("presence", { event: "leave" }, () => {
          if (!isMounted || !channel) return;
          setParticipants(mapPresenceState(channel.presenceState()));
        });

      channel.subscribe(async (status) => {
        if (!isMounted) return;
        setIsConnected(status === "SUBSCRIBED");

        if (status === "SUBSCRIBED" && isMounted) {
          await channel?.track({
            userId: user.id,
            nickname: (user.user_metadata?.nickname as string) || "익명",
            joinedAt: new Date().toISOString(),
          });
        }
      });
    };

    channelPromise = subscribePresence();

    return () => {
      isMounted = false;
      channelPromise
        ?.catch(() => undefined)
        .finally(() => {
          if (channel) {
            supabase.removeChannel(channel);
          }
        });
    };
  }, [supabase]);

  const orderedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko-KR"));
  }, [participants]);

  return {
    participants: orderedParticipants,
    isConnected,
  };
}
