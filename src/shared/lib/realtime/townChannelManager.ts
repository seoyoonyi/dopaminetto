"use client";

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Realtime town/village 채널을 전역 싱글톤과 ref-count로 관리한다. */
const MAX_AUTO_RECONNECT = 5;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const CHANNEL_CLEANUP_DELAY_MS = 3000;
const GLOBAL_KEY = "__townChannelState";

type ChannelStatus = string;
type StatusObserver = (status: ChannelStatus, err?: Error) => void;
type PresenceEvent = "join" | "leave" | "sync";
type PresenceObserver = (event: PresenceEvent, payload?: unknown) => void;
type BroadcastObserver = (event: string, payload?: unknown) => void;

interface TownChannelGlobalState {
  channels: Map<string, RealtimeChannel>;
  statuses: Map<string, ChannelStatus>;
  reconnectCounts: Map<string, number>;
  statusObservers: Map<string, Set<StatusObserver>>;
  presenceObservers: Map<string, Set<PresenceObserver>>;
  broadcastObservers: Map<string, Set<BroadcastObserver>>;
  subscribersCount: Map<string, number>;
  cleanupTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  connectTimeouts: Map<string, ReturnType<typeof setTimeout>>;
}

function getGlobals(): TownChannelGlobalState {
  const globalWithChannelState = globalThis as unknown as Record<string, TownChannelGlobalState>;

  if (!globalWithChannelState[GLOBAL_KEY]) {
    globalWithChannelState[GLOBAL_KEY] = {
      channels: new Map(),
      statuses: new Map(),
      reconnectCounts: new Map(),
      statusObservers: new Map(),
      presenceObservers: new Map(),
      broadcastObservers: new Map(),
      subscribersCount: new Map(),
      cleanupTimeouts: new Map(),
      connectTimeouts: new Map(),
    };
  }

  return globalWithChannelState[GLOBAL_KEY];
}

const globals = getGlobals();

const getObserverSet = <T>(observersMap: Map<string, Set<T>>, channelName: string): Set<T> => {
  if (!observersMap.has(channelName)) {
    observersMap.set(channelName, new Set<T>());
  }

  return observersMap.get(channelName)!;
};

const clearConnectTimeout = (channelName: string) => {
  const timeout = globals.connectTimeouts.get(channelName);
  if (timeout) {
    clearTimeout(timeout);
    globals.connectTimeouts.delete(channelName);
  }
};

const clearCleanupTimeout = (channelName: string) => {
  const timeout = globals.cleanupTimeouts.get(channelName);
  if (timeout) {
    clearTimeout(timeout);
    globals.cleanupTimeouts.delete(channelName);
  }
};

const notifyStatusObservers = (channelName: string, status: ChannelStatus, err?: Error) => {
  globals.statuses.set(channelName, status);

  if (status === "SUBSCRIBED") {
    globals.reconnectCounts.set(channelName, 0);
  }

  const observers = globals.statusObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(status, err));
  }
};

const notifyPresenceObservers = (channelName: string, event: PresenceEvent, payload?: unknown) => {
  const observers = globals.presenceObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(event, payload));
  }
};

const notifyBroadcastObservers = (channelName: string, event: string, payload?: unknown) => {
  const observers = globals.broadcastObservers.get(channelName);
  if (observers) {
    observers.forEach((callback) => callback(event, payload));
  }
};

const destroyChannel = (supabase: SupabaseClient, channelName: string) => {
  const channel = globals.channels.get(channelName);
  if (!channel) return;

  void supabase.removeChannel(channel);
  globals.channels.delete(channelName);
  notifyStatusObservers(channelName, "CLOSED");
};

const scheduleConnect = ({
  supabase,
  channelName,
  userId,
  immediate = false,
}: {
  supabase: SupabaseClient;
  channelName: string;
  userId: string;
  immediate?: boolean;
}) => {
  if (!userId) return;

  const subscriberCount = globals.subscribersCount.get(channelName) || 0;
  if (subscriberCount === 0) return;

  const currentStatus = globals.statuses.get(channelName);
  if (currentStatus === "SUBSCRIBED" || currentStatus === "SUBSCRIBING") return;
  if (globals.connectTimeouts.has(channelName)) return;

  const reconnectCount = globals.reconnectCounts.get(channelName) || 0;
  if (reconnectCount >= MAX_AUTO_RECONNECT) {
    console.warn(`[townChannelManager] Max reconnect attempts reached for ${channelName}`);
    return;
  }

  const waitTime = immediate ? 0 : RECONNECT_BACKOFF_MS[reconnectCount] || 16000;

  const timer = setTimeout(() => {
    globals.connectTimeouts.delete(channelName);

    const latestSubscriberCount = globals.subscribersCount.get(channelName) || 0;
    if (latestSubscriberCount === 0) return;

    const existingChannel = globals.channels.get(channelName);
    if (existingChannel) {
      void supabase.removeChannel(existingChannel);
      globals.channels.delete(channelName);
    }

    const nextReconnectCount = globals.reconnectCounts.get(channelName) || 0;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => notifyPresenceObservers(channelName, "sync"))
      .on("presence", { event: "join" }, (payload) =>
        notifyPresenceObservers(channelName, "join", payload),
      )
      .on("presence", { event: "leave" }, (payload) =>
        notifyPresenceObservers(channelName, "leave", payload),
      )
      .on("broadcast", { event: "player_move" }, ({ payload }) =>
        notifyBroadcastObservers(channelName, "player_move", payload),
      )
      .on("broadcast", { event: "sync-position" }, ({ payload }) =>
        notifyBroadcastObservers(channelName, "sync-position", payload),
      )
      .on("broadcast", { event: "sync-leave" }, ({ payload }) =>
        notifyBroadcastObservers(channelName, "sync-leave", payload),
      );

    globals.channels.set(channelName, channel);
    globals.reconnectCounts.set(channelName, nextReconnectCount + 1);
    notifyStatusObservers(channelName, "SUBSCRIBING");

    channel.subscribe((status, err) => {
      notifyStatusObservers(channelName, status, err);

      if (
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
        (globals.subscribersCount.get(channelName) || 0) > 0
      ) {
        scheduleConnect({ supabase, channelName, userId });
      }
    });
  }, waitTime);

  globals.connectTimeouts.set(channelName, timer);
};

export const getTownChannel = (channelName: string) => globals.channels.get(channelName) || null;

export const getTownChannelStatus = (channelName: string) =>
  globals.statuses.get(channelName) || "INITIAL";

export const observeTownChannelStatus = (channelName: string, callback: StatusObserver) => {
  const observers = getObserverSet(globals.statusObservers, channelName);
  observers.add(callback);
  return () => {
    observers.delete(callback);
  };
};

export const observeTownChannelPresence = (channelName: string, callback: PresenceObserver) => {
  const observers = getObserverSet(globals.presenceObservers, channelName);
  observers.add(callback);
  return () => {
    observers.delete(callback);
  };
};

export const observeTownChannelBroadcast = (channelName: string, callback: BroadcastObserver) => {
  const observers = getObserverSet(globals.broadcastObservers, channelName);
  observers.add(callback);
  return () => {
    observers.delete(callback);
  };
};

export const acquireTownChannel = ({
  supabase,
  channelName,
  userId,
}: {
  supabase: SupabaseClient;
  channelName: string;
  userId: string;
}) => {
  const currentCount = globals.subscribersCount.get(channelName) || 0;
  globals.subscribersCount.set(channelName, currentCount + 1);
  clearCleanupTimeout(channelName);

  scheduleConnect({
    supabase,
    channelName,
    userId,
    immediate: !globals.channels.has(channelName) && !globals.statuses.has(channelName),
  });

  return () => releaseTownChannel({ supabase, channelName });
};

export const releaseTownChannel = ({
  supabase,
  channelName,
}: {
  supabase: SupabaseClient;
  channelName: string;
}) => {
  const remaining = Math.max((globals.subscribersCount.get(channelName) || 0) - 1, 0);
  globals.subscribersCount.set(channelName, remaining);

  if (remaining > 0) return;

  clearConnectTimeout(channelName);
  clearCleanupTimeout(channelName);

  const timeout = setTimeout(() => {
    const latestSubscriberCount = globals.subscribersCount.get(channelName) || 0;
    if (latestSubscriberCount > 0) return;

    destroyChannel(supabase, channelName);
    globals.presenceObservers.delete(channelName);
    globals.broadcastObservers.delete(channelName);
    globals.statusObservers.delete(channelName);
    globals.statuses.delete(channelName);
    globals.reconnectCounts.delete(channelName);
  }, CHANNEL_CLEANUP_DELAY_MS);

  globals.cleanupTimeouts.set(channelName, timeout);
};

export const reconnectTownChannel = ({
  supabase,
  channelName,
  userId,
}: {
  supabase: SupabaseClient;
  channelName: string;
  userId: string;
}) => {
  clearConnectTimeout(channelName);
  clearCleanupTimeout(channelName);

  destroyChannel(supabase, channelName);
  globals.reconnectCounts.set(channelName, 0);

  scheduleConnect({ supabase, channelName, userId, immediate: true });
};
