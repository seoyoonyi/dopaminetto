"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { TOWN_MAIN_CHANNEL } from "@/shared/config/supabase.client";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useCallback, useEffect, useState } from "react";

import { useUserInfo } from "./useUserInfo";

// 채널 인스턴스와 상태를 관리하는 맵
const globalChannels = new Map<string, RealtimeChannel>();
const globalStatuses = new Map<string, string>();
const channelObservers = new Map<string, Set<(status: string) => void>>();
const presenceObservers = new Map<string, Set<(event: string, payload?: unknown) => void>>();
const channelSubscribersCount = new Map<string, number>();
const channelCleanupTimeouts = new Map<string, NodeJS.Timeout>();

const notifyObservers = (channelName: string, status: string) => {
  globalStatuses.set(channelName, status);
  const observers = channelObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(status));
  }
};

const notifyPresenceObservers = (channelName: string, event: string, payload?: unknown) => {
  const observers = presenceObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(event, payload));
  }
};

/**
 * 채널을 관리하는 훅.
 * - channelName: 접속할 채널 이름 (예: "town:main", "village:a")
 */
export const useTownChannel = (channelNameInput?: string | null) => {
  const channelName = channelNameInput || TOWN_MAIN_CHANNEL;

  const supabase = useSupabase();
  const { data: user } = useUserInfo();
  const userId = user?.id;

  const [status, setStatus] = useState<string>(() => globalStatuses.get(channelName) || "INITIAL");

  useEffect(() => {
    if (!channelObservers.has(channelName)) {
      channelObservers.set(channelName, new Set());
    }
    const observers = channelObservers.get(channelName)!;

    const callback = (newStatus: string) => setStatus(newStatus);
    observers.add(callback);

    return () => {
      observers.delete(callback);
    };
  }, [channelName]);

  useEffect(() => {
    const currentCount = channelSubscribersCount.get(channelName) || 0;
    channelSubscribersCount.set(channelName, currentCount + 1);

    const timeout = channelCleanupTimeouts.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      channelCleanupTimeouts.delete(channelName);
    }

    return () => {
      const remaining = (channelSubscribersCount.get(channelName) || 1) - 1;
      channelSubscribersCount.set(channelName, remaining);

      if (remaining === 0) {
        const t = setTimeout(() => {
          const checkCount = channelSubscribersCount.get(channelName) || 0;
          if (checkCount === 0) {
            const channel = globalChannels.get(channelName);
            if (channel) {
              supabase.removeChannel(channel);
              globalChannels.delete(channelName);
              notifyObservers(channelName, "CLOSED");

              presenceObservers.delete(channelName);
            }
          }
        }, 3000);
        channelCleanupTimeouts.set(channelName, t);
      }
    };
  }, [channelName, supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;

    let channel = globalChannels.get(channelName);
    const currentStatus = globalStatuses.get(channelName);

    if (
      !channel ||
      currentStatus === "CLOSED" ||
      currentStatus === "CHANNEL_ERROR" ||
      currentStatus === "TIMED_OUT"
    ) {
      if (channel) {
        supabase.removeChannel(channel);
        globalChannels.delete(channelName);
      }

      channel = supabase.channel(channelName, {
        config: {
          presence: { key: userId },
          broadcast: { self: false },
        },
      });
      globalChannels.set(channelName, channel);

      channel
        .on("presence", { event: "sync" }, () => notifyPresenceObservers(channelName, "sync"))
        .on("presence", { event: "join" }, (payload) =>
          notifyPresenceObservers(channelName, "join", payload),
        )
        .on("presence", { event: "leave" }, (payload) =>
          notifyPresenceObservers(channelName, "leave", payload),
        )
        .subscribe((newStatus) => {
          notifyObservers(channelName, newStatus);
        });
    }
  }, [channelName, supabase, userId, status]);

  return {
    channel: globalChannels.get(channelName) || null,
    status,
    isConnected: status === "SUBSCRIBED",
    reconnect: useCallback(() => {
      notifyObservers(channelName, "CHANNEL_ERROR");
    }, [channelName]),
    subscribeToPresence: useCallback(
      (callback: (event: string, payload?: unknown) => void) => {
        if (!presenceObservers.has(channelName)) {
          presenceObservers.set(channelName, new Set());
        }
        const observers = presenceObservers.get(channelName)!;
        observers.add(callback);
        return () => observers.delete(callback);
      },
      [channelName],
    ),
  };
};
