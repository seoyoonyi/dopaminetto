"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { getVillageChannelName } from "@/shared/lib/realtime";
import {
  acquireTownChannel,
  getTownChannel,
  getTownChannelStatus,
  observeTownChannelPresence,
  observeTownChannelStatus,
  reconnectTownChannel,
} from "@/shared/lib/realtime/townChannelManager";

import { useCallback, useEffect, useState } from "react";

import { useUserInfo } from "./useUserInfo";

/**
 * 채널을 관리하는 훅.
 * - channelName: 접속할 채널 이름 (예: "town:main", "village:a")
 */
export const useTownChannel = (villageId?: string | null) => {
  const channelName = getVillageChannelName(villageId);

  const supabase = useSupabase();
  const { data: user } = useUserInfo();
  const userId = user?.id;

  const [status, setStatus] = useState<string>(() => getTownChannelStatus(channelName));

  useEffect(() => {
    return observeTownChannelStatus(channelName, (newStatus) => setStatus(newStatus));
  }, [channelName]);

  useEffect(() => {
    if (!supabase || !userId) return;
    return acquireTownChannel({ supabase, channelName, userId });
  }, [channelName, supabase, userId]);

  return {
    channel: getTownChannel(channelName),
    status,
    isConnected: status === "SUBSCRIBED",
    reconnect: useCallback(() => {
      if (!supabase || !userId) return;
      reconnectTownChannel({ supabase, channelName, userId });
    }, [channelName, supabase, userId]),
    subscribeToPresence: useCallback(
      (callback: (event: string, payload?: unknown) => void) => {
        return observeTownChannelPresence(channelName, callback);
      },
      [channelName],
    ),
  };
};
