import { MAX_AUTO_RECONNECT, RECONNECT_BACKOFF_MS } from "@/shared/lib/realtime/reconnectBackoff";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KEEPALIVE_RECONNECT_INTERVAL_MS,
  subscribeChatChannelWithReconnect,
} from "./chatChannelReconnect";

const ensureFreshRealtimeAuthOnce = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/realtime/realtimeAuthFreshness", () => ({
  ensureFreshRealtimeAuthOnce,
}));

type StatusCallback = (status: string) => void;

interface FakeChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  emitStatus: StatusCallback;
}

const createFakeChannel = (): FakeChannel => {
  const channel = {} as FakeChannel;
  let statusCallback: StatusCallback = () => {};

  channel.on = vi.fn(() => channel);
  channel.subscribe = vi.fn((callback: StatusCallback) => {
    statusCallback = callback;
    return channel;
  });
  channel.emitStatus = (status: string) => statusCallback(status);

  return channel;
};

const createFakeSupabase = () => {
  const channels: FakeChannel[] = [];
  const channel = vi.fn(() => {
    const fakeChannel = createFakeChannel();
    channels.push(fakeChannel);
    return fakeChannel;
  });
  const removeChannel = vi.fn();

  return { channel, removeChannel, channels };
};

/** connect()의 `await ensureFreshRealtimeAuthOnce` 이후 continuation(microtask)까지 흘려보낸다. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

let visibilityHandler: (() => void) | undefined;
let onlineHandler: (() => void) | undefined;
let fakeDocument: {
  visibilityState: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let fakeWindow: {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.useFakeTimers();
  ensureFreshRealtimeAuthOnce.mockReset();
  ensureFreshRealtimeAuthOnce.mockResolvedValue("test-access-token");
  visibilityHandler = undefined;
  onlineHandler = undefined;
  fakeDocument = {
    visibilityState: "visible",
    addEventListener: vi.fn((_event: string, handler: () => void) => {
      visibilityHandler = handler;
    }),
    removeEventListener: vi.fn(),
  };
  fakeWindow = {
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === "online") onlineHandler = handler;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const startSubscription = async () => {
  const supabase = createFakeSupabase();
  const onStatusChange = vi.fn();
  const onInsert = vi.fn();

  const cleanup = subscribeChatChannelWithReconnect({
    supabase: supabase as unknown as SupabaseClient,
    channelName: "chat:lobby",
    table: "chat",
    roomFilter: "room_id=eq.lobby",
    onInsert,
    onStatusChange,
  });

  // 최초 connect()의 auth 확인 microtask를 흘려보내 채널이 실제로 만들어지게 한다.
  await flushMicrotasks();

  return { supabase, onStatusChange, onInsert, cleanup };
};

describe("subscribeChatChannelWithReconnect", () => {
  it("시작 시 auth 확인 후 단일 채널을 구독한다", async () => {
    const { supabase } = await startSubscription();

    expect(ensureFreshRealtimeAuthOnce).toHaveBeenCalled();
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith("chat:lobby");
  });

  it("auth freshness 확보에 실패하면 채널을 만들지 않고, 이후 확보되면 재구독한다", async () => {
    ensureFreshRealtimeAuthOnce.mockResolvedValueOnce(null);
    const { supabase } = await startSubscription();

    // 첫 시도는 auth 실패로 채널이 만들어지지 않는다.
    expect(supabase.channel).not.toHaveBeenCalled();

    // scheduleReconnect가 backoff 타이머를 걸어두고, 다음 시도에서는 auth가 확보된다.
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("채널이 SUBSCRIBED 상태인 동안에는 재연결을 예약하지 않는다", async () => {
    const { supabase, onStatusChange } = await startSubscription();

    supabase.channels[0].emitStatus("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(KEEPALIVE_RECONNECT_INTERVAL_MS + 1000);

    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");
    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("CLOSED 상태 이후 backoff가 지나면 정확히 한 번만 재구독한다", async () => {
    const { supabase, onStatusChange } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    expect(onStatusChange).toHaveBeenCalledWith("CLOSED");

    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0] - 1);
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channels[0]);
  });

  it("재연결 시도가 SUBSCRIBED에 도달하면 재시도 카운터를 초기화한다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    await flushMicrotasks();
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    supabase.channels[1].emitStatus("SUBSCRIBED");
    supabase.channels[1].emitStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0] - 1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(supabase.channel).toHaveBeenCalledTimes(3);
  });

  it("MAX_AUTO_RECONNECT 소진 후에는 backoff 대신 느린 keepalive 간격으로 계속 재시도한다", async () => {
    const { supabase } = await startSubscription();

    for (let attempt = 0; attempt < MAX_AUTO_RECONNECT; attempt += 1) {
      const lastChannel = supabase.channels[supabase.channels.length - 1];
      lastChannel.emitStatus("CLOSED");
      await vi.runOnlyPendingTimersAsync();
      await flushMicrotasks();
    }

    // 최초 1회 + 재시도 MAX_AUTO_RECONNECT회.
    expect(supabase.channel).toHaveBeenCalledTimes(1 + MAX_AUTO_RECONNECT);

    const finalChannel = supabase.channels[supabase.channels.length - 1];
    finalChannel.emitStatus("CLOSED");

    // 소진 직후에는 짧은 backoff로 재시도하지 않는다.
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1]);
    expect(supabase.channel).toHaveBeenCalledTimes(1 + MAX_AUTO_RECONNECT);

    // keepalive 간격이 지나면 다시 재구독을 시도한다(영구 정지하지 않는다).
    await vi.advanceTimersByTimeAsync(KEEPALIVE_RECONNECT_INTERVAL_MS);
    await flushMicrotasks();
    expect(supabase.channel).toHaveBeenCalledTimes(2 + MAX_AUTO_RECONNECT);
  });

  it("탭 복귀 시 SUBSCRIBED 상태가 아니면 backoff를 건너뛰고 즉시 재연결한다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    fakeDocument.visibilityState = "visible";
    visibilityHandler?.();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channels[0]);
  });

  it("재연결로 교체된 이전 채널의 뒤늦은 CLOSED 콜백은 무시한다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(RECONNECT_BACKOFF_MS[0]);
    await flushMicrotasks();
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    supabase.channels[1].emitStatus("SUBSCRIBED");

    supabase.channels[0].emitStatus("CLOSED");
    await vi.advanceTimersByTimeAsync(KEEPALIVE_RECONNECT_INTERVAL_MS + 1000);

    expect(supabase.channel).toHaveBeenCalledTimes(2);
  });

  it("online 이벤트 발생 시 backoff를 건너뛰고 즉시 재연결한다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    onlineHandler?.();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channels[0]);
  });

  it("MAX_AUTO_RECONNECT 소진 후에도 online 이벤트가 오면 재연결을 재개한다", async () => {
    const { supabase } = await startSubscription();

    for (let attempt = 0; attempt < MAX_AUTO_RECONNECT; attempt += 1) {
      const lastChannel = supabase.channels[supabase.channels.length - 1];
      lastChannel.emitStatus("CLOSED");
      await vi.runOnlyPendingTimersAsync();
      await flushMicrotasks();
    }
    supabase.channels[supabase.channels.length - 1].emitStatus("CLOSED");
    expect(supabase.channel).toHaveBeenCalledTimes(1 + MAX_AUTO_RECONNECT);

    onlineHandler?.();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(2 + MAX_AUTO_RECONNECT);
  });

  it("이미 SUBSCRIBED 상태에서 online 이벤트가 발생해도 채널을 중복 생성하지 않는다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("SUBSCRIBED");
    onlineHandler?.();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("이미 SUBSCRIBED 상태에서 탭 가시성이 바뀌어도 채널을 중복 생성하지 않는다", async () => {
    const { supabase } = await startSubscription();

    supabase.channels[0].emitStatus("SUBSCRIBED");
    visibilityHandler?.();
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("connect 시도가 아직 진행 중일 때 가시성 이벤트가 발생해도 채널을 중복 생성하지 않는다", async () => {
    // auth 확인이 아직 pending인 in-flight 상황을 재현한다.
    let resolveAuth: (value: string) => void = () => {};
    ensureFreshRealtimeAuthOnce.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveAuth = resolve;
        }),
    );

    const supabase = createFakeSupabase();
    subscribeChatChannelWithReconnect({
      supabase: supabase as unknown as SupabaseClient,
      channelName: "chat:lobby",
      table: "chat",
      roomFilter: "room_id=eq.lobby",
      onInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    // 아직 auth가 resolve되지 않아 채널이 없다.
    expect(supabase.channel).not.toHaveBeenCalled();

    visibilityHandler?.();
    await flushMicrotasks();
    expect(supabase.channel).not.toHaveBeenCalled();

    resolveAuth("test-access-token");
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("cleanup 시 대기 중인 재연결 타이머를 취소하고 가시성 리스너를 제거한다", async () => {
    const { supabase, cleanup } = await startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    cleanup();

    await vi.advanceTimersByTimeAsync(KEEPALIVE_RECONNECT_INTERVAL_MS + 1000);
    await flushMicrotasks();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityHandler,
    );
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("online", onlineHandler);
  });

  it("cleanup 이후에는 insert와 상태 업데이트 전달을 중단한다", async () => {
    const { supabase, cleanup, onStatusChange } = await startSubscription();

    cleanup();
    onStatusChange.mockClear();

    supabase.channels[0].emitStatus("SUBSCRIBED");

    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
