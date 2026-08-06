"use client";

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/** Realtime town/village 채널을 전역 싱글톤과 ref-count로 관리한다. */
const MAX_AUTO_RECONNECT = 5;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];
const CHANNEL_CLEANUP_DELAY_MS = 3000;
const GLOBAL_KEY = "__townChannelState";
// 채널 레벨 재연결이 MAX_AUTO_RECONNECT만큼 반복 실패하면, 채널이 아니라
// 그 밑에 있는 realtime 소켓 자체가 손상된 것으로 보고 소켓을 통째로 재연결한다.
// 이 값은 여러 채널이 거의 동시에 임계치를 넘겨도 소켓 리셋이 중복 실행되지 않도록 막는 디바운스 창이다.
const SOCKET_RESET_DEDUPE_MS = 3000;
// 소켓이 손상된 경우 "SUBSCRIBED -> CLOSED -> (재연결 성공) -> SUBSCRIBED -> CLOSED -> ..."처럼
// 매번 재연결에는 성공하지만 곧바로 다시 끊기는 flapping 패턴으로 나타난다. 이 경우
// SUBSCRIBED에 도달할 때마다 reconnectCount가 0으로 리셋되어 MAX_AUTO_RECONNECT에 영영 도달하지 못한다.
// 그래서 SUBSCRIBED 후 FLAP_STABILITY_MS를 못 버틴 실패가 (간격 무관) 누적
// MAX_FLAPS_BEFORE_SOCKET_RESET회에 도달하면 소켓 리셋을 트리거한다.
const FLAP_STABILITY_MS = 8000;
const MAX_FLAPS_BEFORE_SOCKET_RESET = 3;
// realtime-js: disconnect() 직후 소켓이 실제로 닫히기 전에 connect()를 부르면 no-op으로 무시된다.
// 타임아웃 초과 시에는 (onclose 누락 대비) 그냥 connect()를 시도한다.
const SOCKET_CLOSE_POLL_INTERVAL_MS = 20;
const SOCKET_CLOSE_WAIT_TIMEOUT_MS = 1000;

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
  lastSocketResetAt: number;
  recentFailureCounts: Map<string, number>;
  stabilityTimers: Map<string, ReturnType<typeof setTimeout>>;
  lastSubscribedAt: Map<string, number>;
  // visibilitychange 리스너가 탭 복귀 시 재연결을 걸 때 필요한, 채널별 마지막 userId.
  channelUserIds: Map<string, string>;
  visibilityListenerRegistered: boolean;
  lastSupabaseClient: SupabaseClient | null;
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
      lastSocketResetAt: 0,
      recentFailureCounts: new Map(),
      stabilityTimers: new Map(),
      lastSubscribedAt: new Map(),
      channelUserIds: new Map(),
      visibilityListenerRegistered: false,
      lastSupabaseClient: null,
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

const clearStabilityTimer = (channelName: string) => {
  const timer = globals.stabilityTimers.get(channelName);
  if (timer) {
    clearTimeout(timer);
    globals.stabilityTimers.delete(channelName);
  }
};

/** SUBSCRIBED가 FLAP_STABILITY_MS 동안 유지되면 그제서야 flapping 카운트를 리셋한다. */
const scheduleFlapStabilityReset = (channelName: string) => {
  clearStabilityTimer(channelName);
  const timer = setTimeout(() => {
    globals.stabilityTimers.delete(channelName);
    globals.recentFailureCounts.set(channelName, 0);
  }, FLAP_STABILITY_MS);
  globals.stabilityTimers.set(channelName, timer);
};

/** 실패를 기록하고, SUBSCRIBED 후 안정 유지 시간을 채우지 못한 실패가 누적됐는지(flapping) 여부를 반환한다. */
const recordChannelFailure = (channelName: string): boolean => {
  clearStabilityTimer(channelName);
  const count = (globals.recentFailureCounts.get(channelName) || 0) + 1;
  globals.recentFailureCounts.set(channelName, count);
  return count >= MAX_FLAPS_BEFORE_SOCKET_RESET;
};

const notifyStatusObservers = (channelName: string, status: ChannelStatus, err?: Error) => {
  globals.statuses.set(channelName, status);

  if (status === "SUBSCRIBED") {
    globals.reconnectCounts.set(channelName, 0);
    globals.lastSubscribedAt.set(channelName, Date.now());
    scheduleFlapStabilityReset(channelName);
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

/** destroyChannel과 달리 removeChannel()의 완료(unsubscribe 완료)를 기다린다. */
const destroyChannelAndWait = async (
  supabase: SupabaseClient,
  channelName: string,
): Promise<void> => {
  const channel = globals.channels.get(channelName);
  if (!channel) return;

  globals.channels.delete(channelName);
  notifyStatusObservers(channelName, "CLOSED");
  await supabase.removeChannel(channel);
};

const waitUntilSocketClosed = (supabase: SupabaseClient): Promise<void> =>
  new Promise((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      const stillDisconnecting = supabase.realtime.isDisconnecting();
      if (!stillDisconnecting || Date.now() - startedAt >= SOCKET_CLOSE_WAIT_TIMEOUT_MS) {
        resolve();
        return;
      }
      setTimeout(check, SOCKET_CLOSE_POLL_INTERVAL_MS);
    };

    check();
  });

/**
 * 채널을 아무리 새로 만들어도 계속 실패한다면, 문제는 채널이 아니라 그 밑에 있는
 * 하나의 WebSocket(소켓) 자체일 가능성이 높다. 이 경우 채널 객체를 갈아끼우는 것만으로는
 * 절대 회복되지 않는다 (새로고침이 고치는 이유가 바로 완전히 새 소켓을 여는 것이기 때문).
 * 그래서 소켓 자체를 끊었다 다시 연결하고, 현재 구독 중이던 채널을 전부 처음부터 다시 붙인다.
 */
const resetRealtimeSocket = async (
  supabase: SupabaseClient,
  userId: string,
  triggerChannelName: string,
  reason: string,
) => {
  const now = Date.now();
  if (now - globals.lastSocketResetAt < SOCKET_RESET_DEDUPE_MS) return;
  globals.lastSocketResetAt = now;

  console.warn(
    `[townChannelManager] ${triggerChannelName}: ${reason}. ` +
      `채널만 다시 만드는 대신 realtime 소켓 자체를 재연결합니다.`,
  );

  const channelNamesToResume = Array.from(globals.subscribersCount.entries())
    .filter(([, count]) => count > 0)
    .map(([name]) => name);

  channelNamesToResume.forEach((name) => {
    clearConnectTimeout(name);
    globals.reconnectCounts.set(name, 0);
    clearStabilityTimer(name);
    globals.recentFailureCounts.set(name, 0);
  });

  // removeChannel()이 끝나기 전에 disconnect()를 부르면 언바인드되지 않은 채널의 leave 메시지가
  // 유실될 수 있으므로, 채널 정리를 먼저 완료한 뒤 소켓을 끊는다.
  await Promise.all(channelNamesToResume.map((name) => destroyChannelAndWait(supabase, name)));

  supabase.realtime.disconnect();
  await waitUntilSocketClosed(supabase);
  supabase.realtime.connect();

  channelNamesToResume.forEach((name) => {
    scheduleConnect({ supabase, channelName: name, userId, immediate: true });
  });
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
    void resetRealtimeSocket(
      supabase,
      userId,
      channelName,
      `채널 레벨 재연결이 ${MAX_AUTO_RECONNECT}회 연속 실패함`,
    );
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
      // removeChannel()로 이 채널을 직접 제거했을 때도 내부적으로 이 콜백에 CLOSED가
      // 한 번 더 뒤늦게 전달될 수 있다. 이미 다른 채널 객체로 교체(또는 삭제)된 이후의
      // 이벤트라면 우리 재연결 로직을 새치기하지 못하도록 무시한다.
      if (globals.channels.get(channelName) !== channel) return;

      notifyStatusObservers(channelName, status, err);

      if (
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
        (globals.subscribersCount.get(channelName) || 0) > 0
      ) {
        const isFlapping = recordChannelFailure(channelName);
        if (isFlapping) {
          const lastSubscribedAt = globals.lastSubscribedAt.get(channelName);
          console.info("[townChannelManager] socket reset", {
            channelName,
            flapCount: globals.recentFailureCounts.get(channelName) || 0,
            stableDurationMs: lastSubscribedAt ? Date.now() - lastSubscribedAt : null,
          });

          void resetRealtimeSocket(
            supabase,
            userId,
            channelName,
            `SUBSCRIBED 후 ${FLAP_STABILITY_MS}ms 안정 유지를 채우지 못한 실패가 ${MAX_FLAPS_BEFORE_SOCKET_RESET}회 누적됨(flapping)`,
          );
          return;
        }

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
  globals.channelUserIds.set(channelName, userId);
  globals.lastSupabaseClient = supabase;
  ensureVisibilityListenerRegistered();

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
    clearStabilityTimer(channelName);
    globals.recentFailureCounts.delete(channelName);
    globals.lastSubscribedAt.delete(channelName);
    globals.channelUserIds.delete(channelName);
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
  globals.channelUserIds.set(channelName, userId);

  scheduleConnect({ supabase, channelName, userId, immediate: true });
};

/**
 * 탭이 숨겨졌다가 다시 보일 때(hidden -> visible), 현재 구독 중(subscribers > 0)이면서
 * SUBSCRIBED가 아닌 채널만 즉시 재연결한다. 백그라운드 탭에서는 브라우저가 타이머를
 * 강하게 스로틀링해서 backoff 재연결 자체가 늦게 발동할 수 있으므로, 탭 복귀는
 * 대기 없이 바로 재연결을 시도할 좋은 신호다.
 */
const reconnectStaleChannelsOnVisible = (supabase: SupabaseClient) => {
  globals.subscribersCount.forEach((count, channelName) => {
    if (count <= 0) return;

    const status = globals.statuses.get(channelName);
    if (status === "SUBSCRIBED" || status === "SUBSCRIBING") return;

    const userId = globals.channelUserIds.get(channelName);
    if (!userId) return;

    reconnectTownChannel({ supabase, channelName, userId });
  });
};

const handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") return;
  if (!globals.lastSupabaseClient) return;

  reconnectStaleChannelsOnVisible(globals.lastSupabaseClient);
};

const ensureVisibilityListenerRegistered = () => {
  if (globals.visibilityListenerRegistered) return;
  if (typeof document === "undefined") return;

  document.addEventListener("visibilitychange", handleVisibilityChange);
  globals.visibilityListenerRegistered = true;
};
