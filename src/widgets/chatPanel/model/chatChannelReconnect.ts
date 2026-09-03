import { ensureFreshRealtimeAuthOnce } from "@/shared/lib/realtime/realtimeAuthFreshness";
import { MAX_AUTO_RECONNECT, getReconnectDelayMs } from "@/shared/lib/realtime/reconnectBackoff";
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

type ChatChannelStatus = string;

/** MAX_AUTO_RECONNECT 소진 후에도 이 간격으로 재구독을 계속 시도한다(#173: 영구 정지 방지). */
export const KEEPALIVE_RECONNECT_INTERVAL_MS = 30_000;

interface SubscribeChatChannelParams<T extends object> {
  supabase: SupabaseClient;
  channelName: string;
  table: string;
  roomFilter: string;
  onInsert: (payload: RealtimePostgresInsertPayload<T>) => void;
  onStatusChange: (status: ChatChannelStatus) => void;
  /**
   * 한 번 SUBSCRIBED 됐다가 끊긴 뒤 다시 SUBSCRIBED 될 때마다 호출한다. 채널이 끊겨
   * 있던 구간(재구독 갭)에 서버로 들어온 postgres_changes INSERT는 이 클라이언트가
   * 받지 못하므로, 호출부에서 메시지 목록을 다시 fetch해 유실분을 backfill 한다.
   * 최초 SUBSCRIBED에는 호출하지 않는다(초기 목록 fetch가 이미 최신이므로).
   */
  onResubscribe?: () => void;
}

/**
 * 채팅 채널은 town 채널과 같은 Supabase Realtime 소켓을 공유하지만 독립적으로 관리되므로,
 * townChannelManager가 소켓을 재연결해도 알 수 없다. 이 함수가 CLOSED/CHANNEL_ERROR/TIMED_OUT을
 * 직접 감지해 backoff로 재구독하고, 재구독 직전에 ensureFreshRealtimeAuthOnce()로 stale JWT를
 * 막는다(town 채널과 동일 패턴).
 */
export function subscribeChatChannelWithReconnect<T extends object>({
  supabase,
  channelName,
  table,
  roomFilter,
  onInsert,
  onStatusChange,
  onResubscribe,
}: SubscribeChatChannelParams<T>): () => void {
  let isActive = true;
  let currentChannel: RealtimeChannel | null = null;
  let currentStatus: ChatChannelStatus = "INITIAL";
  let reconnectCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** connect() 호출 직후(auth await 포함)부터 첫 상태 콜백까지의 in-flight 구간. */
  let isConnecting = false;
  /** 한 번이라도 SUBSCRIBED에 도달한 적이 있는지. 최초 구독과 재구독을 구분한다. */
  let hasEverSubscribed = false;
  /** 마지막 SUBSCRIBED 이후 CLOSED/CHANNEL_ERROR/TIMED_OUT을 본 적이 있는지. */
  let sawDisconnectSinceSubscribe = false;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = async () => {
    if (!isActive || isConnecting) return;

    isConnecting = true;

    // 재구독 직전 auth session을 최신화한다. 실패하면 이번 시도만 건너뛰고 재예약한다.
    const freshAccessToken = await ensureFreshRealtimeAuthOnce(supabase);

    if (!isActive) {
      isConnecting = false;
      return;
    }

    // await 도중 이미 정상 연결됐으면 중복 채널을 만들지 않는다.
    if (currentStatus === "SUBSCRIBED") {
      isConnecting = false;
      return;
    }

    if (!freshAccessToken) {
      isConnecting = false;
      scheduleReconnect();
      return;
    }

    const channel = supabase.channel(channelName);
    currentChannel = channel;
    channel
      .on<T>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: roomFilter },
        (payload) => onInsert(payload),
      )
      .subscribe((status) => {
        // 이전 채널의 뒤늦은 CLOSED 콜백이 정상 연결된 새 채널을 재연결시키지 않도록,
        // 현재 활성 채널의 콜백이 아니면 무시한다.
        if (channel !== currentChannel) return;

        isConnecting = false;

        if (!isActive) return;

        currentStatus = status;
        onStatusChange(status);

        if (status === "SUBSCRIBED") {
          reconnectCount = 0;
          clearReconnectTimer();
          // 재구독(끊겼다가 다시 붙음)이면, 끊긴 구간에 유실됐을 수 있는 메시지를 backfill 한다.
          if (hasEverSubscribed && sawDisconnectSinceSubscribe) {
            onResubscribe?.();
          }
          hasEverSubscribed = true;
          sawDisconnectSinceSubscribe = false;
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          sawDisconnectSinceSubscribe = true;
          scheduleReconnect();
        }
      });
  };

  const scheduleReconnect = (immediate = false) => {
    if (!isActive) return;
    if (isConnecting || reconnectTimer) return;

    // 소진 후에는 backoff 대신 keepalive 간격으로 계속 시도한다(reconnectCount는 더 안 올림).
    const exhausted = reconnectCount >= MAX_AUTO_RECONNECT;
    const delay = immediate
      ? 0
      : exhausted
        ? KEEPALIVE_RECONNECT_INTERVAL_MS
        : getReconnectDelayMs(reconnectCount);

    if (!exhausted) reconnectCount += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!isActive) return;

      const staleChannel = currentChannel;
      currentChannel = null;
      if (staleChannel) {
        void supabase.removeChannel(staleChannel);
      }

      void connect();
    }, delay);
  };

  // 탭 복귀(visible)나 네트워크 복구(online) 시, 채널 status가 바뀌지 않아
  // scheduleReconnect가 호출되지 않는 경우를 대비해 즉시 재연결을 시도한다.
  // reconnectCount를 리셋하므로 MAX_AUTO_RECONNECT를 소진한 뒤에도 복구된다.
  const forceReconnectFromRecoverySignal = () => {
    if (currentStatus === "SUBSCRIBED" || isConnecting) return;

    clearReconnectTimer();
    reconnectCount = 0;
    scheduleReconnect(true);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    forceReconnectFromRecoverySignal();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("online", forceReconnectFromRecoverySignal);
  }

  void connect();

  return () => {
    isActive = false;
    clearReconnectTimer();

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", forceReconnectFromRecoverySignal);
    }

    const staleChannel = currentChannel;
    currentChannel = null;
    if (staleChannel) {
      void supabase.removeChannel(staleChannel);
    }
  };
}
