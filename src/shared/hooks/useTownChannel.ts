"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { getVillageChannelName } from "@/shared/lib/realtime";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useCallback, useEffect, useState } from "react";

import { useUserInfo } from "./useUserInfo";

const MAX_AUTO_RECONNECT = 5;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

// globalThis를 사용하여 HMR에서도 참조 유지
const GLOBAL_KEY = "__townChannelState";

interface TownChannelGlobalState {
  channels: Map<string, RealtimeChannel>;
  statuses: Map<string, string>;
  reconnectCounts: Map<string, number>;
  channelObservers: Map<string, Set<(status: string) => void>>;
  presenceObservers: Map<string, Set<(event: string, payload?: unknown) => void>>;
  subscribersCount: Map<string, number>;
  cleanupTimeouts: Map<string, NodeJS.Timeout>;
}

function getGlobals(): TownChannelGlobalState {
  const globalWithChannelState = globalThis as unknown as Record<string, TownChannelGlobalState>;
  if (!globalWithChannelState[GLOBAL_KEY]) {
    globalWithChannelState[GLOBAL_KEY] = {
      channels: new Map(),
      statuses: new Map(),
      reconnectCounts: new Map(),
      channelObservers: new Map(),
      presenceObservers: new Map(),
      subscribersCount: new Map(),
      cleanupTimeouts: new Map(),
    };
  }
  return globalWithChannelState[GLOBAL_KEY];
}

const globals = getGlobals();

const notifyObservers = (channelName: string, status: string) => {
  globals.statuses.set(channelName, status);
  const observers = globals.channelObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(status));
  }
};

const notifyPresenceObservers = (channelName: string, event: string, payload?: unknown) => {
  const observers = globals.presenceObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(event, payload));
  }
};

/**
 * 채널을 관리하는 훅.
 * - channelName: 접속할 채널 이름 (예: "town:main", "village:a")
 */
export const useTownChannel = (villageId?: string | null) => {
  const channelName = getVillageChannelName(villageId);

  const supabase = useSupabase();
  const { data: user } = useUserInfo();
  const userId = user?.id;

  const [status, setStatus] = useState<string>(
    () => globals.statuses.get(channelName) || "INITIAL",
  );

  useEffect(() => {
    if (!globals.channelObservers.has(channelName)) {
      globals.channelObservers.set(channelName, new Set());
    }
    const observers = globals.channelObservers.get(channelName)!;

    const callback = (newStatus: string) => setStatus(newStatus);
    observers.add(callback);

    return () => {
      observers.delete(callback);
    };
  }, [channelName]);

  useEffect(() => {
    const currentCount = globals.subscribersCount.get(channelName) || 0;
    globals.subscribersCount.set(channelName, currentCount + 1);

    const timeout = globals.cleanupTimeouts.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      globals.cleanupTimeouts.delete(channelName);
    }

    return () => {
      const remaining = (globals.subscribersCount.get(channelName) || 1) - 1;
      globals.subscribersCount.set(channelName, remaining);

      if (remaining === 0) {
        const t = setTimeout(() => {
          const checkCount = globals.subscribersCount.get(channelName) || 0;
          if (checkCount === 0) {
            const channel = globals.channels.get(channelName);
            if (channel) {
              supabase.removeChannel(channel);
              globals.channels.delete(channelName);
              notifyObservers(channelName, "CLOSED");

              globals.presenceObservers.delete(channelName);
            }
          }
        }, 3000);
        globals.cleanupTimeouts.set(channelName, t);
      }
    };
  }, [channelName, supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const currentStatus = globals.statuses.get(channelName);
    const channel = globals.channels.get(channelName);

    if (currentStatus === "SUBSCRIBED") {
      globals.reconnectCounts.set(channelName, 0);
      return;
    }

    if (
      !channel ||
      currentStatus === "CLOSED" ||
      currentStatus === "CHANNEL_ERROR" ||
      currentStatus === "TIMED_OUT"
    ) {
      const count = globals.reconnectCounts.get(channelName) || 0;
      if (count >= MAX_AUTO_RECONNECT) {
        console.warn(`[useTownChannel] Max reconnect attempts reached for ${channelName}`);
        return;
      }

      const waitTime = RECONNECT_BACKOFF_MS[count] || 16000;

      const timer = setTimeout(() => {
        if (channel) {
          supabase.removeChannel(channel);
          globals.channels.delete(channelName);
        }

        const newChannel = supabase.channel(channelName, {
          config: {
            presence: { key: userId },
            broadcast: { self: false },
          },
        });
        globals.channels.set(channelName, newChannel);
        globals.reconnectCounts.set(channelName, count + 1);

        newChannel
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
      }, waitTime);

      return () => clearTimeout(timer);
    }
  }, [channelName, supabase, userId, status]);

  return {
    channel: globals.channels.get(channelName) || null,
    status,
    isConnected: status === "SUBSCRIBED",
    reconnect: useCallback(() => {
      notifyObservers(channelName, "CHANNEL_ERROR");
    }, [channelName]),
    subscribeToPresence: useCallback(
      (callback: (event: string, payload?: unknown) => void) => {
        if (!globals.presenceObservers.has(channelName)) {
          globals.presenceObservers.set(channelName, new Set());
        }
        const observers = globals.presenceObservers.get(channelName)!;
        observers.add(callback);
        return () => observers.delete(callback);
      },
      [channelName],
    ),
  };
};
