import { MAX_AUTO_RECONNECT, getReconnectDelayMs } from "@/shared/lib/realtime/reconnectBackoff";
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

type ChatChannelStatus = string;

interface SubscribeChatChannelParams<T extends object> {
  supabase: SupabaseClient;
  channelName: string;
  table: string;
  roomFilter: string;
  onInsert: (payload: RealtimePostgresInsertPayload<T>) => void;
  onStatusChange: (status: ChatChannelStatus) => void;
}

/**
 * 채팅 채널은 town 채널과 같은 Supabase Realtime 소켓을 공유하지만 독립적으로 관리되므로,
 * townChannelManager가 소켓을 재연결해도 그 사실을 알 수 없다. 이 함수가 CLOSED/CHANNEL_ERROR/
 * TIMED_OUT을 직접 감지해 backoff로 재구독한다.
 */
export function subscribeChatChannelWithReconnect<T extends object>({
  supabase,
  channelName,
  table,
  roomFilter,
  onInsert,
  onStatusChange,
}: SubscribeChatChannelParams<T>): () => void {
  let isActive = true;
  let currentChannel: RealtimeChannel | null = null;
  let currentStatus: ChatChannelStatus = "INITIAL";
  let reconnectCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** connect() 호출 직후부터 첫 상태 콜백을 받기 전까지의 in-flight 구간을 나타낸다. */
  let isConnecting = false;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (!isActive) return;

    isConnecting = true;

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
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          scheduleReconnect();
        }
      });
  };

  const scheduleReconnect = (immediate = false) => {
    if (!isActive) return;
    if (isConnecting || reconnectTimer) return;
    if (reconnectCount >= MAX_AUTO_RECONNECT) return;

    const delay = immediate ? 0 : getReconnectDelayMs(reconnectCount);
    reconnectCount += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!isActive) return;

      const staleChannel = currentChannel;
      currentChannel = null;
      if (staleChannel) {
        void supabase.removeChannel(staleChannel);
      }

      connect();
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

  connect();

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
