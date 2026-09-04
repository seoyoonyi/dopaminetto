"use client";

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { ensureFreshRealtimeAuthOnce } from "./realtimeAuthFreshness";
import { MAX_AUTO_RECONNECT, RECONNECT_BACKOFF_MS } from "./reconnectBackoff";

/** Realtime town/village 채널을 전역 싱글톤과 ref-count로 관리한다. */
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
// online/visibilitychange 복구 신호가 auth 게이트 실패로 무산됐을 때, 처음 MAX_RECOVERY_RETRIES회는
// backoff로 재시도하고 그 뒤엔 keepalive 간격으로 계속 재시도한다(#173: 신호는 edge-triggered라
// 한 번만 오므로, 재시도가 없으면 새로고침 전까지 stale하게 남았다).
const MAX_RECOVERY_RETRIES = RECONNECT_BACKOFF_MS.length;
const RECOVERY_RETRY_KEEPALIVE_MS = 30_000;
// 탭이 이 시간 이상 hidden이었다가 visible로 돌아오면, status가 SUBSCRIBED로 남아 있어도
// 소켓이 조용히 죽은 좀비 상태일 수 있다고 보고 강제 재구독한다(#173: 개발자도구 offline·
// 백그라운드 탭·sleep에서 heartbeat가 CLOSED를 못 잡아 Presence/연결표시가 stale하게 남던 문제).
// 짧은 탭 전환에서는 불필요한 재연결 churn을 만들지 않도록 임계치를 둔다.
const STALE_REVALIDATION_HIDDEN_MS = 30_000;

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
  recoveryListenersRegistered: boolean;
  lastSupabaseClient: SupabaseClient | null;
  // 복구 신호 이후 auth 게이트 실패 시의 재시도 상태.
  recoveryRetryTimer: ReturnType<typeof setTimeout> | null;
  recoveryRetryCount: number;
  // 재시도가 원래 강제 재구독(SUBSCRIBED 채널 포함) 신호였는지. 재시도 tick에서도 유지한다.
  recoveryRetryForce: boolean;
  // 탭이 hidden으로 전환된 시각(visible이면 null). visible 복귀 시 hidden 지속을 계산해
  // 강제 재구독 여부를 정한다.
  hiddenSince: number | null;
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
      recoveryListenersRegistered: false,
      lastSupabaseClient: null,
      recoveryRetryTimer: null,
      recoveryRetryCount: 0,
      recoveryRetryForce: false,
      hiddenSince: null,
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

/** 복구 재시도 타이머/예산을 리셋한다. SUBSCRIBED 도달, 새 복구 신호, stale 채널 없음일 때 호출. */
const clearRecoveryRetry = () => {
  if (globals.recoveryRetryTimer) {
    clearTimeout(globals.recoveryRetryTimer);
    globals.recoveryRetryTimer = null;
  }
  globals.recoveryRetryCount = 0;
  globals.recoveryRetryForce = false;
};

/** auth 게이트 실패로 무산된 복구를 재시도한다. backoff MAX_RECOVERY_RETRIES회 → 이후 keepalive 간격. */
const scheduleRecoveryRetry = (supabase: SupabaseClient, force = false) => {
  // 한 번이라도 강제 신호였다면 재시도 내내 유지한다(SUBSCRIBED 좀비 채널을 계속 대상에 포함).
  globals.recoveryRetryForce = globals.recoveryRetryForce || force;

  if (globals.recoveryRetryTimer) return;

  const exhausted = globals.recoveryRetryCount >= MAX_RECOVERY_RETRIES;
  const delay = exhausted
    ? RECOVERY_RETRY_KEEPALIVE_MS
    : (RECONNECT_BACKOFF_MS[globals.recoveryRetryCount] ?? 16000);
  if (!exhausted) globals.recoveryRetryCount += 1;

  globals.recoveryRetryTimer = setTimeout(() => {
    globals.recoveryRetryTimer = null;
    void reconnectStaleChannels(supabase, { force: globals.recoveryRetryForce });
  }, delay);
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

interface ChannelFailureRecord {
  isFlapping: boolean;
  flapCount: number;
  /** 이번 실패 시점 기준, 가장 최근 SUBSCRIBED로부터 경과한 실제 시간(ms). SUBSCRIBED 이력이 없으면 null. */
  stableDurationMs: number | null;
  /** 위 경과 시간이 FLAP_STABILITY_MS 이상이라, 이전 flapCount를 stale로 보고 이번 실패부터 다시 센 경우. */
  staleHistoryReset: boolean;
}

/**
 * 실패를 기록하고 flapping 여부를 반환한다.
 *
 * flapCount 리셋을 8초 setTimeout(scheduleFlapStabilityReset)의 실행 여부에만 맡기면, 그 타이머가
 * sleep/suspend로 인해 실행되지 못했을 때 SUBSCRIBED 이전의 낡은 flapCount가 그대로 남아있다가
 * wake 직후의 단 1회 실패만으로 flapping 임계치를 채우는 오탐이 생길 수 있다(#173). 그래서 타이머
 * 실행 여부와 무관하게, 실패 시점마다 lastSubscribedAt 기준 실제 경과 시간을 다시 확인해서 이미
 * FLAP_STABILITY_MS 이상 지났다면 이전 flapCount를 stale 이력으로 보고 0에서부터 다시 센다.
 */
const recordChannelFailure = (channelName: string): ChannelFailureRecord => {
  clearStabilityTimer(channelName);

  const lastSubscribedAt = globals.lastSubscribedAt.get(channelName);
  const stableDurationMs = lastSubscribedAt !== undefined ? Date.now() - lastSubscribedAt : null;
  const staleHistoryReset = stableDurationMs !== null && stableDurationMs >= FLAP_STABILITY_MS;

  const previousCount = staleHistoryReset ? 0 : globals.recentFailureCounts.get(channelName) || 0;
  const flapCount = previousCount + 1;
  globals.recentFailureCounts.set(channelName, flapCount);

  return {
    isFlapping: flapCount >= MAX_FLAPS_BEFORE_SOCKET_RESET,
    flapCount,
    stableDurationMs,
    staleHistoryReset,
  };
};

const notifyStatusObservers = (channelName: string, status: ChannelStatus, err?: Error) => {
  globals.statuses.set(channelName, status);

  if (status === "SUBSCRIBED") {
    globals.reconnectCounts.set(channelName, 0);
    globals.lastSubscribedAt.set(channelName, Date.now());
    scheduleFlapStabilityReset(channelName);
    // 하나라도 SUBSCRIBED면 네트워크가 회복된 것 → 복구 재시도 타이머 취소.
    clearRecoveryRetry();
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

  // 소켓을 완전히 갈아끼우기 전에 auth session이 최신인지 먼저 보장한다. 여기서 실패하면
  // (예: 만료된 JWT를 갱신하지 못함) 채널 teardown/소켓 disconnect 등 destructive한 작업은
  // 전혀 진행하지 않고 이번 recovery 시도를 그냥 건너뛴다 — reconnectCounts/subscribersCount
  // 등 기존 상태를 그대로 두므로, 다음 recovery 트리거(다른 채널의 소켓 리셋, 다음
  // visibilitychange 등)가 새로 이 게이트를 다시 시도한다. 여기서 별도의 재시도 타이머를
  // 걸지 않으므로 새로운 무한 루프가 생기지 않는다.
  const freshAccessToken = await ensureFreshRealtimeAuthOnce(supabase);
  if (!freshAccessToken) {
    console.warn(
      `[townChannelManager] ${triggerChannelName}: auth freshness 확보 실패로 이번 소켓 리셋을 건너뜁니다.`,
      { reason },
    );
    return;
  }

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
    // 다음 socket reset 로그의 stableDurationMs가 이번에 끊긴 낡은 SUBSCRIBED 시각을 참조해
    // 다시 의미 없는 값을 찍지 않도록, 재구독으로 새 SUBSCRIBED가 올 때까지 비워둔다.
    globals.lastSubscribedAt.delete(name);
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

  // 첫 재시도(reconnectCount === 0)는 backoff 없이 즉시 실행한다. 클라이언트 간 지터가 없어
  // 1초 대기도 분산 효과가 없었기 때문이며, 반복 실패부터는 기존 backoff로 flapping을 막는다.
  const waitTime =
    immediate || reconnectCount === 0 ? 0 : RECONNECT_BACKOFF_MS[reconnectCount] || 16000;

  const timer = setTimeout(() => {
    globals.connectTimeouts.delete(channelName);
    void attemptConnect({ supabase, channelName, userId });
  }, waitTime);

  globals.connectTimeouts.set(channelName, timer);
};

/**
 * scheduleConnect() 타이머가 만료된 후 실제로 channel을 만들고 subscribe하는 부분.
 * subscribe 직전에 ensureFreshRealtimeAuthOnce()를 반드시 통과시켜, 만료/stale JWT로
 * phx_join이 나가는 것을 구조적으로 차단한다(#173: expired token과 TOKEN_REFRESHED가
 * 거의 동시에 관측되는 race).
 */
const attemptConnect = async ({
  supabase,
  channelName,
  userId,
}: {
  supabase: SupabaseClient;
  channelName: string;
  userId: string;
}) => {
  const latestSubscriberCount = globals.subscribersCount.get(channelName) || 0;
  if (latestSubscriberCount === 0) return;

  // getSession()은 세션이 아직 유효하면 로컬 캐시를 그대로 반환하고, 만료가 임박했을 때만
  // network refresh를 트리거한다 — 정상 세션에서 매 attempt마다 호출해도 추가 비용이 없다.
  // 같은 client에 대해 여러 채널이 거의 동시에 이 게이트를 통과하려 해도
  // ensureFreshRealtimeAuthOnce의 in-flight dedup(WeakMap)으로 실제 호출은 1회로 합쳐진다.
  const freshAccessToken = await ensureFreshRealtimeAuthOnce(supabase);

  // await 도중 unsubscribe되었거나(subscribersCount -> 0), 다른 recovery 경로(visibility 복귀,
  // 소켓 리셋, reconnectTownChannel의 강제 재연결 등)가 이미 이 채널의 다음 연결을 새로
  // 스케줄했다면 이 continuation은 stale이다. 중복 channel 생성/subscribe를 막기 위해
  // lifecycle 상태를 다시 확인한다.
  const subscriberCountAfterAuth = globals.subscribersCount.get(channelName) || 0;
  if (subscriberCountAfterAuth === 0) return;

  const statusAfterAuth = globals.statuses.get(channelName);
  if (statusAfterAuth === "SUBSCRIBED" || statusAfterAuth === "SUBSCRIBING") return;
  if (globals.connectTimeouts.has(channelName)) return;

  if (!freshAccessToken) {
    console.warn(
      `[townChannelManager] ${channelName}: auth freshness 확보 실패로 이번 subscribe 시도를 건너뜁니다.`,
    );

    // 실제 channel.subscribe()를 시도하지 않았으므로 flap detector(recordChannelFailure)에는
    // 반영하지 않는다. 대신 기존 reconnectCounts/backoff 체계를 그대로 소비해 다음 시도 간격을
    // 벌리고(tight loop 방지), 반복되면 기존과 동일하게 MAX_AUTO_RECONNECT를 거쳐 소켓 리셋
    // 경로로 수렴한다.
    const reconnectCount = globals.reconnectCounts.get(channelName) || 0;
    globals.reconnectCounts.set(channelName, reconnectCount + 1);
    scheduleConnect({ supabase, channelName, userId });
    return;
  }

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
      const failure = recordChannelFailure(channelName);
      if (failure.isFlapping) {
        console.info("[townChannelManager] socket reset", {
          channelName,
          flapCount: failure.flapCount,
          // 이번 flapping 판정에 실제로 쓰인 경과 시간. staleHistoryReset이 true라면 이번 실패로
          // flapCount가 1부터 다시 시작했다는 뜻이라 isFlapping이 true일 수 없으므로, 이 값이 찍힐
          // 때는 항상 FLAP_STABILITY_MS 미만의, 진짜로 짧은 간격 안에서 반복된 실패를 의미한다.
          stableDurationMs: failure.stableDurationMs,
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
  ensureRecoveryListenersRegistered();

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
  // 이 채널은 여기서부터 새 연결 lifecycle을 시작하므로, 이전 연결에서 쌓인 flapping 이력이
  // 이번 강제 재연결의 실패에 그대로 전가되지 않도록 stability timer/flapCount를 함께 비운다.
  clearStabilityTimer(channelName);
  globals.recentFailureCounts.delete(channelName);
  globals.lastSubscribedAt.delete(channelName);
  globals.channelUserIds.set(channelName, userId);

  scheduleConnect({ supabase, channelName, userId, immediate: true });
};

/**
 * 탭 복귀(hidden -> visible)나 네트워크 복구(offline -> online) 시, 현재 구독 중
 * (subscribers > 0)이면서 SUBSCRIBED가 아닌 채널을 즉시 재연결한다. 백그라운드 탭에서는
 * 브라우저가 타이머를 강하게 스로틀링해서 backoff 재연결이 늦게 발동할 수 있고, 네트워크
 * 복구는 status 변화 없이 조용히 일어날 수 있으므로, 두 신호 모두 대기 없이 재연결을
 * 시도할 좋은 계기다. reconnectTownChannel이 reconnectCount를 리셋하므로, auth 실패나
 * MAX_AUTO_RECONNECT 소진으로 멈춰 있던 채널도 이 경로로 다시 복구된다.
 *
 * `force`이면 SUBSCRIBED 채널도 대상에 포함한다. offline 이벤트가 났거나 탭이 오래 hidden이었던
 * 뒤에는, 소켓이 죽었는데도 heartbeat가 CLOSED를 못 잡아 status가 SUBSCRIBED로 남는 좀비 상태가
 * 있을 수 있다(#173). 이 경우 강제 재구독으로 서버 full sync를 다시 받아 Presence/연결표시를
 * 정정한다. 진행 중인 재연결을 방해하지 않도록 SUBSCRIBING은 force여도 건드리지 않는다.
 */
const reconnectStaleChannels = async (
  supabase: SupabaseClient,
  { force = false }: { force?: boolean } = {},
) => {
  const staleChannelNames = Array.from(globals.subscribersCount.entries())
    .filter(([, count]) => count > 0)
    .map(([name]) => name)
    .filter((name) => {
      const status = globals.statuses.get(name);
      if (status === "SUBSCRIBING") return false;
      return force || status !== "SUBSCRIBED";
    });

  if (staleChannelNames.length === 0) {
    clearRecoveryRetry();
    return;
  }

  // 여러 채널이 동시에 stale이어도 auth freshness 확인은 한 번만 한다. 실패하면 이번엔
  // 재연결하지 않고 scheduleRecoveryRetry로 재시도를 예약한다(신호가 다시 안 와도 복구되도록).
  const freshAccessToken = await ensureFreshRealtimeAuthOnce(supabase);
  if (!freshAccessToken) {
    console.warn(
      "[townChannelManager] 복구 신호: auth freshness 확보 실패. 잠시 후 다시 시도합니다.",
    );
    scheduleRecoveryRetry(supabase, force);
    return;
  }

  clearRecoveryRetry();

  staleChannelNames.forEach((channelName) => {
    // auth 확인을 await하는 동안 채널이 스스로 정상 연결됐을 수 있다. force가 아니면 이미
    // 연결된 채널을 끊지 않는다. force면 좀비 SUBSCRIBED를 의심하는 상황이므로 재구독한다.
    const status = globals.statuses.get(channelName);
    if (status === "SUBSCRIBING") return;
    if (!force && status === "SUBSCRIBED") return;

    const userId = globals.channelUserIds.get(channelName);
    if (!userId) return;

    reconnectTownChannel({ supabase, channelName, userId });
  });
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    globals.hiddenSince = Date.now();
    return;
  }
  if (document.visibilityState !== "visible") return;
  if (!globals.lastSupabaseClient) return;

  // 탭이 오래 hidden이었으면 소켓이 좀비일 수 있으므로 SUBSCRIBED 채널도 강제 재구독한다.
  const hiddenDuration = globals.hiddenSince ? Date.now() - globals.hiddenSince : 0;
  globals.hiddenSince = null;
  const force = hiddenDuration >= STALE_REVALIDATION_HIDDEN_MS;

  // 새 신호이므로 재시도 예산을 새로 준다.
  clearRecoveryRetry();
  void reconnectStaleChannels(globals.lastSupabaseClient, { force });
};

const handleOnline = () => {
  if (!globals.lastSupabaseClient) return;

  // offline -> online 전이는 연결이 끊겼다 돌아온 강한 신호다. status가 SUBSCRIBED로 남은
  // 좀비 채널도 있을 수 있으므로 강제 재구독한다(전이당 1회라 churn은 무시할 수준).
  clearRecoveryRetry();
  void reconnectStaleChannels(globals.lastSupabaseClient, { force: true });
};

const ensureRecoveryListenersRegistered = () => {
  if (globals.recoveryListenersRegistered) return;
  if (typeof document === "undefined") return;

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
  }
  globals.recoveryListenersRegistered = true;
};
