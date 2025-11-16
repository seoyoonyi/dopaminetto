"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { TOWN_MAIN_CHANNEL } from "@/shared/config/supabase.client";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

import { useEffect, useMemo, useState } from "react";

import { PresenceParticipant } from "../types";

type PresencePayload = {
  userId: string;
  nickname?: string;
  joinedAt?: string;
  presence_ref?: string;
};

const mapPresenceState = (state: RealtimePresenceState): PresenceParticipant[] => {
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

export function useTownPresence() {
  const supabase = useSupabase();
  const [participants, setParticipants] = useState<PresenceParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let channel: RealtimeChannel | null = null;
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

        if (status === "SUBSCRIBED") {
          await channel?.track({
            userId: user.id,
            nickname: (user.user_metadata?.nickname as string) || "익명",
            joinedAt: new Date().toISOString(),
          });
        }
      });
    };

    subscribePresence();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  const orderedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => a.nickname.localeCompare(b.nickname));
  }, [participants]);

  return {
    participants: orderedParticipants,
    isConnected,
  };
}
